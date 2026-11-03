import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

let page, done;
before(async () => { ({ page, done } = await openPage('engine/test-page.html', { viewport: { width: 1080, height: 600 } })); });
after(async () => { await done?.(); });

// A fresh Scene (light theme, k = 1) and engine/nodes.js; `fn` runs in the page with (N, scene, T, arg).
const inScene = (fn, arg) => page.evaluate(async ([src, arg]) => {
  const theme = await (await fetch('/themes/light.json')).json();
  const N = await import('/engine/nodes.js');
  const svg = document.getElementById('card');
  svg.innerHTML = '';
  const scene = new window.E.Scene(svg, theme, 1, { style: 'filled', localIcons: {} });
  await document.fonts.ready;
  return new Function('N', 'scene', 'T', 'arg', `return (${src})(N, scene, T, arg)`)(N, scene, theme.colors, arg);
}, [fn.toString(), arg]);

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const sameBox = (m, box) => { near(m.w, box.w, 0.5, 'w'); near(m.h, box.h, 0.5, 'h'); };

test('icon node: name 30k below the nominal icon frame, sub 24k below that', async () => {
  const r = await inScene((N, scene) => {
    const node = { id: 'u', icon: 'laptop', name: 'User', sub: 'browser', cell: [0, 0] };
    const ctx = { scene, theme: scene.theme, k: 1, cellW: 480, cellH: 340 };
    const m = N.measureNode(node, ctx), d = N.drawNode(scene, node, 300, 262, ctx);
    const y = role => +[...scene.texts].find(t => t.role === role && t.owner === 'u').el.getAttribute('y');
    return { m, d, name: y('name'), sub: y('sub'), icons: scene.placed.map(p => [p.name, p.cx, p.cy, p.scale]) };
  });
  assert.deepEqual(r.icons, [['laptop', 300, 262, 1.15]]);
  near(r.name, 262 + 50 * 1.15 + 30, 0.01, 'name baseline');
  near(r.sub, r.name + 24, 0.01, 'sub baseline');
  assert.equal(r.m.nameLines, 1);
  sameBox(r.m, r.d.box);
  near(r.m.ay, 262 - r.d.box.y, 0.5, 'anchor from the top');
  near(r.d.iconBox.w, 124 * 1.15, 0.01, 'icon box');
  assert.equal(r.d.labelBoxes.length, 2);
});

test('a 28-character node name wraps to two lines', async () => {
  const r = await inScene((N, scene) => {
    const node = { id: 'g', icon: 'database', name: 'Global Distributed Key Store', sub: 'eventually consistent', cell: [0, 0] };
    const ctx = { scene, theme: scene.theme, k: 1, cellW: 300, cellH: 340 };
    const m = N.measureNode(node, ctx), d = N.drawNode(scene, node, 300, 262, ctx);
    const name = scene.texts.find(t => t.role === 'name').el;
    return { m, d, lines: [...name.querySelectorAll('tspan')].map(s => s.getComputedTextLength()),
      sub: +scene.texts.find(t => t.role === 'sub').el.getAttribute('y') };
  });
  assert.equal(r.m.nameLines, 2);
  assert.equal(r.lines.length, 2);
  for (const w of r.lines) assert.ok(w <= 300 - 24, `line ${w}`);
  near(r.sub, 262 + 57.5 + 30 + 1.26 * 25 + 24, 0.01, 'sub moves down a line');
  assert.equal(r.m.overflow, false);
  sameBox(r.m, r.d.box);
});

test('text box clamps its width to the cell', async () => {
  const r = await inScene((N, scene, T) => {
    const ctx = { scene, theme: scene.theme, k: 1, cellW: 240, cellH: 200 };
    const out = { want: [T.tint, T.primary] };
    for (const [id, name] of [['short', 'LLM'], ['mid', 'Prompt Builder'], ['long', 'Agent Orchestrator Service']]) {
      const node = { id, type: 'text', name, cell: [0, 0] };
      out[id] = { m: N.measureNode(node, ctx), d: N.drawNode(scene, node, 300, 100, ctx) };
    }
    const rect = scene.layers.nodes.querySelector('rect');
    out.fill = rect.getAttribute('fill'); out.stroke = rect.getAttribute('stroke'); out.sw = +rect.getAttribute('stroke-width');
    return out;
  });
  assert.equal(r.short.m.w, 150); assert.equal(r.short.m.h, 64); assert.equal(r.short.m.nameLines, 1);
  assert.ok(r.mid.m.w > 150 && r.mid.m.w < 200, `mid ${r.mid.m.w}`); assert.equal(r.mid.m.h, 64);
  assert.equal(r.long.m.w, 200); assert.equal(r.long.m.h, 88); assert.equal(r.long.m.nameLines, 2);
  for (const id of ['short', 'mid', 'long']) { sameBox(r[id].m, r[id].d.box); near(r[id].d.box.y, 100 - r[id].m.h / 2, 0.01, 'centred'); }
  assert.deepEqual([r.fill, r.stroke], r.want);
  assert.equal(r.sw, 2.2);
});

test('text and tray boxes take the side colours', async () => {
  const r = await inScene((N, scene, T) => {
    const ctx = { scene, theme: scene.theme, k: 1, cellW: 300, cellH: 200, side: 'B' };
    N.drawNode(scene, { id: 't', type: 'text', name: 'Evaluator', cell: [0, 0] }, 200, 100, ctx);
    N.drawNode(scene, { id: 'y', type: 'tray', name: 'Tools', cell: [0, 0], items: [{ icon: 'api', caption: 'API' }, { icon: 'lock', caption: 'Auth' }] }, 600, 200, ctx);
    const [box, tray] = scene.layers.nodes.querySelectorAll(':scope > rect');
    return { box: [box.getAttribute('fill'), box.getAttribute('stroke')], tray: [tray.getAttribute('fill'), tray.getAttribute('stroke'), +tray.getAttribute('stroke-width')],
      want: [T.sideBTint, T.sideB, T.bg] };
  });
  assert.deepEqual(r.box, [r.want[0], r.want[1]]);
  assert.deepEqual(r.tray, [r.want[2], r.want[1], 2.1]);
});

test('tray of 5 items lays out in 2 rows', async () => {
  const r = await inScene((N, scene) => {
    const items = ['database', 'document', 'api', 'code-window', 'lock'].map(icon => ({ icon, caption: icon.slice(0, 6) }));
    const node = { id: 'tools', type: 'tray', name: 'Tools', cell: [0, 0], items };
    const ctx = { scene, theme: scene.theme, k: 1, cellW: 400, cellH: 300 };
    const m = N.measureNode(node, ctx), d = N.drawNode(scene, node, 500, 300, ctx);
    return { m, d, icons: scene.placed.map(p => [p.name, p.cx, p.cy, p.scale]), captions: scene.texts.filter(t => t.role === 'caption').length };
  });
  const rows = [...new Set(r.icons.map(i => i[2]))];
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(y => r.icons.filter(i => i[2] === y).length), [3, 2]);
  assert.ok(rows[1] - rows[0] === 74, `row pitch ${rows[1] - rows[0]}`);
  const top = r.icons.filter(i => i[2] === rows[0]).map(i => i[1]);
  assert.deepEqual(top, [500 - 74, 500, 500 + 74]);
  for (const i of r.icons) assert.equal(i[3], 0.42);
  assert.equal(r.captions, 5);
  assert.equal(r.m.w, 3 * 74 + 2 * 16);
  sameBox(r.m, r.d.box);
});

test('tray of 4 items balances 2 + 2, and a long title widens or wraps', async () => {
  const r = await inScene((N, scene) => {
    const items = ['database', 'document', 'api', 'code-window'].map(icon => ({ icon, caption: icon }));
    const ctx = { scene, theme: scene.theme, k: 1, cellW: 400, cellH: 300 };
    const wide = { id: 'a', type: 'tray', name: 'Tools & Retrieval Sources', cell: [0, 0], items };
    const narrow = { ...wide, id: 'b' };
    const mw = N.measureNode(wide, ctx), dw = N.drawNode(scene, wide, 300, 200, ctx);
    const mn = N.measureNode(narrow, { ...ctx, cellW: 200 });
    return { mw, dw, mn, ys: scene.placed.map(p => p.cy) };
  });
  assert.deepEqual([...new Set(r.ys)].length, 2);
  assert.equal(r.mw.nameLines, 1);
  assert.ok(r.mw.w > 2 * 74 + 32, `the title widens the tray: ${r.mw.w}`);
  assert.equal(r.mn.nameLines, 2);
  assert.ok(r.mn.h > r.mw.h, 'a wrapped title adds a line');
  sameBox(r.mw, r.dw.box);
});
