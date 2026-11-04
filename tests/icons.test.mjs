// The icon contract, run over every library icon × filled/line/duotone × light/machine-room-dark.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';
import { ICONS } from '../skills/animated-diagram/engine/icons/index.js';
import { TOKENS } from '../skills/animated-diagram/scripts/theme.mjs';

const STYLES = ['filled', 'line', 'duotone'];
const PRESETS = ['light', 'machine-room-dark'];
const FRAMES = [0, 6, 12, 15, 18, 24, 30, 36, 42, 45, 48, 54, 60, 66, 72, 75, 78, 84, 90];
const TILE = 240, SCALE = 1.15;
const NAMES = Object.keys(ICONS);

let page, done;
before(async () => { ({ page, done } = await openPage('engine/icon-test.html', { viewport: { width: 1920, height: 1440 } })); });
after(async () => { await done?.(); });

// Renders one icon at each frame in FRAMES, always in the same 240×240 tile (Chrome does not rasterise identically at
// different offsets), and measures, in the page, how each frame differs from f0.
async function frameStats(name, style, preset, zone) {
  const theme = JSON.parse(fs.readFileSync(`skills/animated-diagram/themes/${preset}.json`, 'utf8'));
  const shots = [];
  for (const f of FRAMES) {      // a fresh tile per frame: incremental repaints drift by a pixel or two over many seeks
    await page.evaluate(([icon, style, theme, f, zone]) => window.grid([{ icon, style, f, zone }], { theme, cols: 1 }).then(() => 0), [name, style, theme, f, zone]);
    shots.push((await page.screenshot({ clip: { x: 0, y: 0, width: TILE, height: TILE } })).toString('base64'));
  }
  const [bw, bh] = ICONS[name].box;
  const home = { x0: TILE / 2 - bw * SCALE / 2 - 8, x1: TILE / 2 + bw * SCALE / 2 + 8, y0: TILE / 2 - bh * SCALE / 2 - 8, y1: TILE / 2 + bh * SCALE / 2 + 8 };
  return page.evaluate(async ([shots, tile, home]) => {
    const decode = async b64 => {
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = new OffscreenCanvas(tile, tile), x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, tile, tile).data;
    };
    const frames = await Promise.all(shots.map(decode)), d0 = frames[0];
    return frames.map(d => {
      let changed = 0, maxDelta = 0, away = 0;
      for (let j = 0; j < tile; j++) for (let i = 0; i < tile; i++) {
        const a = (j * tile + i) * 4;
        const dm = Math.max(Math.abs(d0[a] - d[a]), Math.abs(d0[a + 1] - d[a + 1]), Math.abs(d0[a + 2] - d[a + 2]));
        if (dm > 24) changed++;
        if (dm > maxDelta) maxDelta = dm;
        if (dm > 24 && (i < home.x0 || i >= home.x1 || j < home.y0 || j >= home.y1)) away++;
      }
      return { changed, maxDelta, away };
    });
  }, [shots, TILE, home]);
}

test('the library has the six spike icons, each with name, box, draw, loop', () => {
  for (const n of ['laptop', 'globe', 'rack', 'cache', 'tower', 'stopwatch']) assert.ok(ICONS[n], n);
  for (const [n, m] of Object.entries(ICONS)) {
    assert.equal(m.name, n);
    assert.ok(Array.isArray(m.box) && m.box.length === 2 && m.box.every(v => v > 0 && v <= 160), `${n}.box`);
    assert.equal(typeof m.draw, 'function');
    assert.equal(typeof m.loop, 'function');
  }
});

for (const name of NAMES) {
  test(`${name}: seamless, moves, stays home — every style and preset`, async () => {
    for (const preset of PRESETS) for (const style of STYLES) {
      const s = await frameStats(name, style, preset), at = f => s[FRAMES.indexOf(f)], tag = `${name}/${style}/${preset}`;
      // Not byte-identical: redrawing the same picture (a 3-blade fan at 240°, meridians in a new order) moves anti-aliasing
      // by up to ~20 levels. A visible seam changes pixels by far more than 24, the change threshold the GIF checks use.
      assert.equal(at(90).changed, 0, `${tag}: f90 differs from f0 in ${at(90).changed} px (max Δ ${at(90).maxDelta})`);
      const moving = [15, 30, 45, 60, 75].filter(f => at(f).changed >= 40);
      assert.ok(moving.length >= 2, `${tag}: only frames [${moving}] differ from f0 by ≥ 40 px (${[15, 30, 45, 60, 75].map(f => at(f).changed)})`);
      const strays = FRAMES.filter(f => at(f).away > 0);
      assert.deepEqual(strays, [], `${tag}: pixels outside box × 1.15 + 8 change at frames [${strays}]`);
    }
  });
}

// A zone recolours an icon's body, which could hide a light drawn in the same hue (amber and lime lights, say).
for (const name of NAMES) {
  test(`${name}: still moves visibly in the amber and green zones`, async () => {
    for (const zone of ['amber', 'green']) {
      const s = await frameStats(name, 'filled', 'machine-room-dark', zone), at = f => s[FRAMES.indexOf(f)], tag = `${name}/${zone}`;
      assert.equal(at(90).changed, 0, `${tag}: f90 differs from f0`);
      const moving = [15, 30, 45, 60, 75].filter(f => at(f).changed >= 40);
      assert.ok(moving.length >= 2, `${tag}: only frames [${moving}] differ from f0 by ≥ 40 px (${[15, 30, 45, 60, 75].map(f => at(f).changed)})`);
    }
  });
}

test('tokens only: every colour in every icon is a theme token', async () => {
  const sentinel = { name: 's', mode: 'light', style: 'filled', radius: 13, lineWeight: 2.6, font: { family: 'InterV', file: 'fonts/InterVariable.woff2' }, brand: {}, colors: {} };
  TOKENS.forEach((t, i) => { sentinel.colors[t] = '#A0' + String(i).padStart(2, '0') + 'B0'; });
  const allowed = new Set(Object.values(sentinel.colors));
  for (const style of STYLES) {
    const html = await page.evaluate(([cells, theme]) => window.grid(cells, { theme, cols: 8 }).then(() => document.getElementById('card').outerHTML),
      [NAMES.flatMap(icon => [0, 37, 71].map(f => ({ icon, style, f }))), sentinel]);
    const hexes = [...html.matchAll(/#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![\w-])/g)].map(m => m[0].toUpperCase());
    const bad = [...new Set(hexes.filter(h => !allowed.has(h)))];
    assert.deepEqual(bad, [], `${style}: non-token colours ${bad}`);
    assert.doesNotMatch(html, /rgba?\(|="(white|black|red|green|blue|gray|grey)"/, `${style}: named or rgb() colour`);
  }
});

test('roles present: every shape carries data-fill and data-stroke', async () => {
  const theme = JSON.parse(fs.readFileSync('skills/animated-diagram/themes/light.json', 'utf8'));
  const missing = await page.evaluate(async ([cells, theme]) => {
    await window.grid(cells, { theme, cols: 8 });
    const FILL = ['fill', 'fill2', 'paper', 'accent', 'none'], STROKE = ['outline', 'detail', 'accent', 'none'];
    return [...document.querySelectorAll('[data-icon] :is(path,rect,circle,ellipse,line,polyline,polygon)')]
      .filter(e => !FILL.includes(e.dataset.fill) || !STROKE.includes(e.dataset.stroke))
      .map(e => `${e.closest('[data-icon]').dataset.icon}: <${e.tagName} ${e.id || ''}> fill=${e.dataset.fill} stroke=${e.dataset.stroke}`);
  }, [NAMES.map(icon => ({ icon, style: 'filled', f: 0 })), theme]);
  assert.deepEqual(missing, []);
});

test('loops leave style attributes alone (so every loop works in every style)', async () => {
  const theme = JSON.parse(fs.readFileSync('skills/animated-diagram/themes/machine-room-dark.json', 'utf8'));
  const changed = await page.evaluate(([names, theme]) => window.styleDrift(names, theme), [NAMES, theme]);
  assert.deepEqual(changed, []);
});
