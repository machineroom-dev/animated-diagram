// browser.mjs — one headless system Chrome at a time, serving the skill folder over http.
//   const { page, done } = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 } });
// Env: CHROME_PATH (a Chrome binary instead of the system channel), ANIMATED_DIAGRAM_RENDER_LOCK (a lock dir shared
// by every Chrome on the machine: mkdir + pid file, stale pids reaped).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupError } from './errors.mjs';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// One page per process at a time: a second openPage waits for the first one's done() (the lock is per process).
let queue = Promise.resolve();
// Ctrl-C or a kill still runs the 'exit' handlers, so the lock is released.
let signalsHooked = false;
const hookSignals = () => {
  if (signalsHooked) return;
  signalsHooked = true;
  process.once('SIGINT', () => process.exit(130));
  process.once('SIGTERM', () => process.exit(143));
};

async function lock(dir) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  for (let waited = 0; ; waited++) {
    try { fs.mkdirSync(dir); break; } catch {}
    try { const pid = +fs.readFileSync(path.join(dir, 'pid'), 'utf8'); if (pid && !alive(pid)) { fs.rmSync(dir, { recursive: true, force: true }); continue; } } catch {}
    if (waited % 60 === 0) console.error(`waiting for the render lock ${dir} (${waited}s)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
  fs.writeFileSync(path.join(dir, 'pid'), String(process.pid));
  hookSignals();
  const release = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  process.on('exit', release);
  return () => { process.off('exit', release); release(); };
}

// Software rasterising: GPU raster flips anti-aliased pixels between identical renders (a frame must be a pure
// function of f, and flips would read as flicker in the GIF). Measured: 5 of 15 runs flipped with GPU, 0 of 30 without.
const CHROME_ARGS = ['--disable-gpu'];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain',
};

function serve(mounts) {
  const roots = [...Object.entries(mounts).map(([pre, dir]) => [pre, path.resolve(dir)]), ['/', SKILL]];
  return http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const [pre, root] = roots.find(([p]) => url.startsWith(p));
    const fp = path.join(root, url.slice(pre.length));
    if (!(fp === root || fp.startsWith(root + path.sep)) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
}

export function openPage(relPath, { viewport, dsf = 1, mounts = {} } = {}) {
  const turn = queue.then(() => open(relPath, viewport, dsf, mounts));
  queue = turn.then(r => r.closed, () => {});
  return turn.then(r => ({ page: r.page, done: r.done }));
}

async function open(relPath, viewport, dsf, mounts) {
  const lockDir = process.env.ANIMATED_DIAGRAM_RENDER_LOCK;
  const release = lockDir ? await lock(path.resolve(lockDir)) : () => {};
  let server, browser;
  const cleanup = async () => { try { await browser?.close(); } catch {} server?.close(); release(); };
  try {
    server = serve(mounts);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const exe = process.env.CHROME_PATH;
    if (exe && !fs.existsSync(exe)) throw new SetupError(`CHROME_PATH=${exe} does not exist: point it at a Chrome binary, or unset it to use the system Chrome`);
    let chromium;
    try { ({ chromium } = await import('playwright-core')); }
    catch { throw new SetupError(`the skill's dependency isn't installed yet. Run once: npm install --prefix "${SKILL}"`); }
    try {
      browser = await chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true, args: CHROME_ARGS });
    } catch (e) {
      throw new SetupError(`could not launch Chrome${exe ? ` from CHROME_PATH=${exe}` : ' (system channel; set CHROME_PATH to a Chrome binary)'}: ${e.message.split('\n')[0]}`);
    }
    const page = await browser.newPage({ viewport, deviceScaleFactor: dsf });
    let pageError = null;
    page.on('pageerror', e => { pageError = e; console.error('[pageerror]', e.message); });
    page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/${relPath}`, { waitUntil: 'load' });
    await Promise.race([
      page.waitForFunction(() => window.ENGINE_LOADED === true, null, { timeout: 60_000 }),
      new Promise((_, rej) => page.on('pageerror', e => rej(new Error(`page error in ${relPath}: ${e.message}`)))),
    ]);
    if (pageError) throw new Error(`page error in ${relPath}: ${pageError.message}`);
    await page.evaluate(() => document.fonts.ready);
    let closed;
    const finished = new Promise(r => { closed = r; });
    return { page, closed: finished, done: async () => { await cleanup(); closed(); } };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
