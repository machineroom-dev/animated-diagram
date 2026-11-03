import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli, tmpDir } from './helpers/run.mjs';
import { parseGif } from '../skills/animated-diagram/scripts/check-pixels.mjs';

const FIX = path.resolve('tests/fixtures');
const probe = file => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', file], { encoding: 'utf8' }).stdout);

test('cdn renders', { timeout: 300_000 }, () => {
  const out = tmpDir('ad-render-');
  const r = cli(['render', path.join(FIX, 'cdn.json'), '--theme', 'machine-room-dark', '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  const gif = path.join(out, 'cdn.gif'), mp4 = path.join(out, 'cdn.mp4');
  const h = parseGif(fs.readFileSync(gif));
  assert.equal(h.frames, 90);
  assert.ok(h.delays.every(d => d === 3), h.delays.join());
  assert.equal(h.loop, 0);
  const p = probe(mp4), s = p.streams[0];
  assert.ok(Math.abs(+p.format.duration - 10.8) <= 0.1, `duration ${p.format.duration}`);
  assert.equal(s.width % 2, 0); assert.equal(s.height % 2, 0);
  assert.ok(fs.existsSync(path.join(out, 'cdn.png')));
  const check = JSON.parse(fs.readFileSync(path.join(out, 'cdn.check.json'), 'utf8'));
  assert.equal(check.ok, true);
  assert.equal(check.bytes, fs.statSync(gif).size);
  assert.ok(!fs.existsSync(path.join(out, '.frames')), 'frames are cleaned up');
  assert.match(r.out, /cdn\.gif/);
});

test('no theme exits 3', () => {
  const dir = tmpDir('ad-notheme-');
  fs.copyFileSync(path.join(FIX, 'cdn.json'), path.join(dir, 'cdn.json'));
  const r = cli(['render', path.join(dir, 'cdn.json'), '--out', path.join(dir, 'out')]);
  assert.equal(r.code, 3, r.out + r.err);
  assert.match(r.err, /no theme yet: run "cli\.mjs theme" first/);
});

test('a failing theme is refused', () => {
  const dir = tmpDir('ad-badtheme-');
  const t = JSON.parse(fs.readFileSync('skills/animated-diagram/themes/light.json', 'utf8'));
  t.colors.ink = '#DDDDDD';
  fs.writeFileSync(path.join(dir, 'diagram-theme.json'), JSON.stringify(t));
  fs.copyFileSync(path.join(FIX, 'cdn.json'), path.join(dir, 'cdn.json'));
  const r = cli(['render', path.join(dir, 'cdn.json'), '--out', path.join(dir, 'out')]);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.err, /CONTRAST \[ink, panel\]/);
  assert.ok(!fs.existsSync(path.join(dir, 'out', 'cdn.gif')));
});

test('an invalid diagram is refused with its errors', () => {
  const dir = tmpDir('ad-baddiagram-');
  const d = JSON.parse(fs.readFileSync(path.join(FIX, 'cdn.json'), 'utf8'));
  d.panels[0].nodes[3].icon = 'kafka';
  fs.writeFileSync(path.join(dir, 'cdn.json'), JSON.stringify(d));
  const r = cli(['render', path.join(dir, 'cdn.json'), '--theme', 'light', '--out', path.join(dir, 'out')]);
  assert.equal(r.code, 1, r.out + r.err);
  assert.match(r.err, /panels\[0\]\.nodes\[3\]\.icon: unknown icon "kafka"/);
});

test('geometry failure exits 2', { timeout: 120_000 }, () => {
  const dir = tmpDir('ad-geom-');
  const d = JSON.parse(fs.readFileSync(path.join(FIX, 'cdn.json'), 'utf8'));
  d.panels[0].nodes[5].offset = [-344, -158];
  fs.writeFileSync(path.join(dir, 'cdn.json'), JSON.stringify(d));
  const out = path.join(dir, 'out');
  const r = cli(['render', path.join(dir, 'cdn.json'), '--theme', 'light', '--out', out]);
  assert.equal(r.code, 2, r.out + r.err);
  assert.ok(fs.existsSync(path.join(out, 'cdn.png')), 'the still');
  const check = JSON.parse(fs.readFileSync(path.join(out, 'cdn.check.json'), 'utf8'));
  assert.equal(check.ok, false);
  assert.ok(check.failures.some(f => f.code === 'LABEL_ON_ICON'));
  assert.ok(!fs.existsSync(path.join(out, 'cdn.gif')), 'no GIF for a failed layout');
  assert.match(r.out, /LABEL_ON_ICON/);
});

test('a project icon in diagram-icons/ is used', { timeout: 120_000 }, () => {
  const dir = tmpDir('ad-local-');
  fs.mkdirSync(path.join(dir, 'diagram-icons'));
  const src = fs.readFileSync('skills/animated-diagram/engine/icons/lock.js', 'utf8').replace("name: 'lock'", "name: 'vault'").replace("from '../icon-kit.js'", "from '/engine/icon-kit.js'");
  fs.writeFileSync(path.join(dir, 'diagram-icons', 'vault.js'), src);
  const d = { canvas: 'square', template: 'flow-grid', title: 'Local icon', panels: [{ grid: { cols: 2, rows: 1 },
    nodes: [{ id: 'a', icon: 'vault', name: 'Vault', cell: [0, 0] }, { id: 'b', icon: 'user', name: 'User', cell: [1, 0] }],
    steps: [{ n: 1, from: 'b', to: 'a', label: 'open' }] }] };
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify(d));
  const r = cli(['render', path.join(dir, 'local.json'), '--theme', 'light', '--out', path.join(dir, 'out')]);
  assert.notEqual(r.code, 1, r.out + r.err);
  assert.ok(fs.existsSync(path.join(dir, 'out', 'local.png')));
});

test('a project icon is known by its file name, whatever its name field says', { timeout: 120_000 }, () => {
  const dir = tmpDir('ad-localname-');
  fs.mkdirSync(path.join(dir, 'diagram-icons'));
  const src = fs.readFileSync('skills/animated-diagram/engine/icons/lock.js', 'utf8').replace("name: 'lock'", "name: 'vault'").replace("from '../icon-kit.js'", "from '/engine/icon-kit.js'");
  fs.writeFileSync(path.join(dir, 'diagram-icons', 'safe.js'), src);
  const d = { template: 'flow-grid', title: 'Local icon', panels: [{ grid: { cols: 1, rows: 2 },
    nodes: [{ id: 'u', icon: 'user', name: 'User', cell: [0, 0] }, { id: 's', icon: 'safe', name: 'Safe', cell: [0, 1] }],
    steps: [{ n: 1, from: 'u', to: 's', label: 'open' }] }] };
  fs.writeFileSync(path.join(dir, 'safe.json'), JSON.stringify(d));
  const r = cli(['render', path.join(dir, 'safe.json'), '--theme', 'light', '--out', path.join(dir, 'out')]);
  assert.notEqual(r.code, 1, r.out + r.err);
  assert.ok(fs.existsSync(path.join(dir, 'out', 'safe.check.json')));
});

const stackless = s => !/\n\s+at /.test(s);

test('a theme in the working folder is used when none sits next to the diagram', { timeout: 120_000 }, () => {
  const dir = tmpDir();
  assert.equal(cli(['theme', '--preset', 'light'], { cwd: dir }).code, 0);
  const r = cli(['render', path.join(FIX, 'cdn.json'), '--out', 'out'], { cwd: dir });
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(dir, 'out', 'cdn.gif')));
});

test('no ffmpeg: one clear line, no stack', { timeout: 120_000 }, () => {
  const dir = tmpDir();
  const r = cli(['render', path.join(FIX, 'cdn.json'), '--theme', 'light', '--out', dir], { env: { ...process.env, PATH: '/nonexistent' } });
  assert.equal(r.code, 1);
  assert.match(r.err, /ffmpeg/);
  assert.ok(stackless(r.err), r.err);
});

test('a wrong CHROME_PATH: one clear line, no stack', () => {
  const dir = tmpDir();
  const r = cli(['render', path.join(FIX, 'cdn.json'), '--theme', 'light', '--out', dir], { env: { ...process.env, CHROME_PATH: '/nonexistent/chrome' } });
  assert.equal(r.code, 1);
  assert.match(r.err, /CHROME_PATH/);
  assert.ok(stackless(r.err), r.err);
});

test('before npm install: render says what to run, icons still work', () => {
  const copy = path.join(tmpDir(), 'skill');
  fs.cpSync(path.resolve('skills/animated-diagram'), copy, { recursive: true, filter: f => !f.includes('node_modules') });
  const run = args => spawnSync(process.execPath, [path.join(copy, 'scripts/cli.mjs'), ...args], { encoding: 'utf8' });
  const r = run(['render', path.join(FIX, 'cdn.json'), '--theme', 'light', '--out', tmpDir()]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /npm install --prefix/);
  assert.ok(stackless(r.stderr), r.stderr);
  assert.equal(run(['icons']).status, 0);
});

test('every library icon renders with no jump at the loop point', { timeout: 300_000 }, () => {
  const dir = tmpDir('ad-allicons-');
  const names = cli(['icons']).out.trim().split('\n').map(l => l.split(/\s+/)[0]);
  assert.ok(names.length >= 20, names.join());
  const bad = [];
  for (const icon of names) {
    const f = path.join(dir, `${icon}.json`);
    fs.writeFileSync(f, JSON.stringify({ template: 'flow-grid', title: icon, panels: [{ grid: { cols: 1, rows: 1 }, nodes: [{ id: 'a', icon, name: icon, cell: [0, 0] }], steps: [] }] }));
    const r = cli(['render', f, '--theme', 'machine-room-dark', '--out', path.join(dir, 'out')]);
    if (r.code !== 0) bad.push(`${icon}: ${r.out.split('\n').filter(l => /SEAM|FLICKER/.test(l)).join(' ') || r.err}`);
  }
  assert.deepEqual(bad, []);
});

