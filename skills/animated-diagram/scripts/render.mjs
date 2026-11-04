// render.mjs — one diagram to <name>.gif, .mp4, .png and .check.json.
//   render({ diagramPath, themePath, outDir, style?, keepFrames? }) -> { ok, files, failures, warnings }
// Order: validate → theme check → open the page → boot (layout + geometry check; on failure: still + check.json only)
// → 90 screenshots → encode → GIF checks → check.json. Throws RenderError for bad input (exit 1 in the CLI).
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './browser.mjs';
import { loadTheme, checkTheme, resolveThemePath } from './theme.mjs';
import { validateDiagram, CANVAS, DEFAULTS } from './schema.mjs';
import { encodeGif, encodeMp4, stillPng } from './encode.mjs';
import { checkGif } from './check-pixels.mjs';
import { ICONS } from '../engine/icons/index.js';

export const FRAMES = 90;
export class RenderError extends Error { constructor(msg) { super(msg); this.name = 'RenderError'; } }

// A project's own icons: <diagram dir>/diagram-icons/<name>.js, named by file.
export function localIcons(diagramPath) {
  const dir = path.join(path.dirname(path.resolve(diagramPath)), 'diagram-icons');
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^[a-z0-9-]+\.js$/.test(f)).map(f => f.slice(0, -3)) : [];
  return { dir, names };
}

export async function render({ diagramPath, themePath, outDir, style, keepFrames = false }) {
  let diagram;
  try { diagram = JSON.parse(fs.readFileSync(diagramPath, 'utf8')); }
  catch (e) { throw new RenderError(`${diagramPath}: ${e.code === 'ENOENT' ? 'no such file' : `not valid JSON (${e.message})`}`); }
  const local = localIcons(diagramPath);
  const v = validateDiagram(diagram, { icons: new Set([...Object.keys(ICONS), ...local.names]) });
  if (!v.ok) throw new RenderError(`${diagramPath} is not a valid diagram:\n${v.errors.map(e => `  ${e}`).join('\n')}`);

  const theme = loadTheme(themePath), tc = checkTheme(theme);
  if (!tc.ok) throw new RenderError(`the theme fails its check:\n${tc.failures.map(f => `  ${f.code}${f.pair ? ` [${f.pair.join(', ')}]` : ''}: ${f.detail}`).join('\n')}`);
  if (style && !['filled', 'line', 'duotone'].includes(style)) throw new RenderError(`--style must be filled, line or duotone, not "${style}"`);

  const canvas = CANVAS[diagram.canvas ?? DEFAULTS.canvas], still = diagram.still ?? DEFAULTS.still;
  const base = path.basename(diagramPath).replace(/\.json$/i, '');
  fs.mkdirSync(outDir, { recursive: true });
  const files = { gif: path.join(outDir, `${base}.gif`), mp4: path.join(outDir, `${base}.mp4`), png: path.join(outDir, `${base}.png`), check: path.join(outDir, `${base}.check.json`) };
  for (const f of Object.values(files)) fs.rmSync(f, { force: true });
  const writeCheck = r => fs.writeFileSync(files.check, JSON.stringify(r, null, 2) + '\n');

  const mounts = {};
  if (local.names.length) mounts['/local-icons/'] = local.dir;
  if (theme.brand?.logo) {
    const logo = path.resolve(path.dirname(resolveThemePath(themePath)), theme.brand.logo);
    if (!fs.existsSync(logo)) throw new RenderError(`theme brand.logo ${logo} does not exist`);
    mounts['/brand/'] = path.dirname(logo);
  }

  const framesDir = path.join(outDir, '.frames');
  const { page, done } = await openPage('engine/page.html', { viewport: { width: canvas.w, height: canvas.h }, mounts });
  let failures, moving, fills, warnings = [];
  try {
    ({ failures, moving, fills } = await page.evaluate(([d, t, o]) => window.boot(d, t, o), [diagram, theme, { style: style ?? theme.style, localIcons: local.names.map(n => `/local-icons/${n}.js`) }]));
    const shot = (f, file) => page.evaluate(f => window.seek(f), f).then(() => page.screenshot({ path: file, clip: { x: 0, y: 0, width: canvas.w, height: canvas.h } }));
    if (failures.length) {
      await shot(still, files.png);
      writeCheck({ ok: false, failures, warnings, bytes: null });
      return { ok: false, files: { png: files.png, check: files.check }, failures, warnings };
    }
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    for (let f = 0; f < FRAMES; f++) await shot(f, path.join(framesDir, `f${String(f).padStart(2, '0')}.png`));
  } finally { await done(); }

  encodeGif(framesDir, files.gif, path.join(framesDir, 'palette.png'));
  encodeMp4(framesDir, files.mp4, { loops: 4, padColor: theme.colors.bg, frames: FRAMES });
  stillPng(framesDir, still, files.png);
  const g = await checkGif(files.gif, { frames: FRAMES, delayCs: 3, maxBytes: canvas.maxGifBytes, budgetBytes: 1_000_000 * (canvas.w * canvas.h) / (1080 * 1350), moving, fills });
  failures = g.failures; warnings = g.warnings;
  writeCheck({ ok: failures.length === 0, failures, warnings, bytes: g.bytes });
  if (!keepFrames) fs.rmSync(framesDir, { recursive: true, force: true });
  return { ok: failures.length === 0, files, failures, warnings, bytes: g.bytes };
}
