import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

const fixture = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));

let page, done;
before(async () => { ({ page, done } = await openPage('engine/test-page.html', { viewport: { width: 1080, height: 1350 } })); });
after(async () => { await done?.(); });

// Lays one panel out in a frame on the test page (MR dark, k = 1). Returns the layout, or the thrown error's fields.
const lay = (panel, frame = { x: 36, y: 140, w: 1008, h: 1146 }) => page.evaluate(async ([panel, frame]) => {
  const theme = await (await fetch('/themes/machine-room-dark.json')).json();
  const { layoutPanel } = await import('/engine/layout.js');
  const svg = document.getElementById('card');
  svg.innerHTML = '';
  const scene = new window.E.Scene(svg, theme, 1, { style: 'filled', localIcons: {} });
  try {
    const L = layoutPanel(panel, frame, { scene, theme, k: 1 });
    const parts = L.nodes.map(n => ({ id: n.id, boxes: [n.iconBox, ...n.labelBoxes] }));
    return { arrows: L.arrows, parts };
  } catch (e) {
    return { error: { name: e.name, code: e.code, step: e.step, blocking: e.blocking, message: e.message } };
  }
}, [panel, frame]);

const corners = pts => pts.length - 2;
const node = (id, cell, icon = 'rack') => ({ id, icon, name: id, cell });
// Does segment p→q pass through box b (shrunk by 1 px so touching doesn't count)?
const hits = (p, q, b) => {
  const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]), y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
  return x1 > b.x + 1 && x0 < b.x + b.w - 1 && y1 > b.y + 1 && y0 < b.y + b.h - 1;
};
const crossesAny = (points, parts, ids) => parts.filter(p => ids.includes(p.id)).some(p => p.boxes.some(b => points.slice(1).some((q, i) => hits(points[i], q, b))));

test('one corner', async () => {
  const r = await lay({ grid: { cols: 2, rows: 3 }, nodes: [node('a', [0, 0]), node('b', [1, 2])], steps: [{ n: 1, from: 'a', to: 'b', label: 'go' }] });
  assert.equal(r.error, undefined, r.error?.message);
  assert.equal(corners(r.arrows[0].points), 1, JSON.stringify(r.arrows[0].points));
});

test('L avoids a node', async () => {
  // a at (0,0), b at (1,2). Horizontal-first turns at (1,0), vertical-first at (0,2); a node on one corner forces the other.
  for (const [cell, turnAt] of [[[1, 0], 'vertical-first'], [[0, 2], 'horizontal-first']]) {
    const r = await lay({ grid: { cols: 2, rows: 3 }, nodes: [node('a', [0, 0]), node('b', [1, 2]), node('x', cell, 'lock')], steps: [{ n: 1, from: 'a', to: 'b', label: 'go' }] });
    assert.equal(r.error, undefined, r.error?.message);
    const pts = r.arrows[0].points;
    assert.equal(corners(pts), 1);
    assert.equal(crossesAny(pts, r.parts, ['x']), false, `${turnAt}: ${JSON.stringify(pts)}`);
    const firstLegVertical = Math.abs(pts[0][0] - pts[1][0]) < 1e-6;
    assert.equal(firstLegVertical, turnAt === 'vertical-first', turnAt);
  }
});

test('retry uses a gutter', async () => {
  const panel = fixture('rag').panels[1];
  const r = await lay(panel, { x: 550, y: 140, w: 494, h: 1146 });   // panel B of a comparison
  assert.equal(r.error, undefined, r.error?.message);
  const retry = r.arrows.find(a => a.kind === 'retry');
  assert.equal(corners(retry.points), 2, JSON.stringify(retry.points));
  assert.equal(crossesAny(retry.points, r.parts, r.parts.map(p => p.id)), false, JSON.stringify(retry.points));
  assert.ok(retry.short, 'a retry has short dashes');
});

test('a step over an empty cell is straight, and over a node names that node', async () => {
  const col = await lay({ grid: { cols: 2, rows: 3 }, nodes: [node('a', [0, 0]), node('b', [0, 2])], steps: [{ n: 1, from: 'a', to: 'b', label: 'skip a row' }] });
  assert.equal(col.error, undefined, col.error?.message);
  assert.equal(corners(col.arrows[0].points), 0, JSON.stringify(col.arrows[0].points));
  const row = await lay({ grid: { cols: 3, rows: 1 }, nodes: [node('a', [0, 0]), node('c', [2, 0])], steps: [{ n: 1, from: 'a', to: 'c', label: 'skip' }] });
  assert.equal(row.error, undefined, row.error?.message);
  assert.equal(corners(row.arrows[0].points), 0);
  const blocked = await lay({ grid: { cols: 2, rows: 3 }, nodes: [node('a', [0, 0]), node('m', [0, 1], 'lock'), node('b', [0, 2])], steps: [{ n: 1, from: 'a', to: 'b', label: 'x' }] });
  assert.equal(blocked.error?.code, 'UNROUTABLE');
  assert.equal(blocked.error.blocking, 'm');
});

test('UNROUTABLE names the blocker', async () => {
  // One row: every L and every vertical gutter route from c back to a runs straight through b.
  const r = await lay({ grid: { cols: 3, rows: 1 }, nodes: [node('a', [0, 0]), node('b', [1, 0]), node('c', [2, 0])],
    steps: [{ n: 1, from: 'a', to: 'b', label: 'x' }, { n: 2, from: 'b', to: 'c', label: 'y' }, { n: 3, from: 'c', to: 'a', label: 'again', kind: 'retry' }] });
  assert.equal(r.error?.code, 'UNROUTABLE', JSON.stringify(r));
  assert.equal(r.error.blocking, 'b');
  assert.equal(r.error.step, 3);
  assert.match(r.error.message, /step 3/);
  assert.match(r.error.message, /"b"/);
});

test('a forward non-neighbour through a node is UNROUTABLE too', async () => {
  const r = await lay({ grid: { cols: 3, rows: 1 }, nodes: [node('a', [0, 0]), node('b', [1, 0]), node('c', [2, 0])], steps: [{ n: 1, from: 'a', to: 'c', label: 'skip' }] });
  assert.equal(r.error?.code, 'UNROUTABLE');
  assert.equal(r.error.blocking, 'b');
});

// Px two polylines share on one line (axis-aligned segments within 3 px of each other).
const sharedRun = (A, B) => {
  let run = 0;
  for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) {
    const [a, b, c, d] = [A[i - 1], A[i], B[j - 1], B[j]];
    const span = (p, q, r, s) => Math.max(0, Math.min(Math.max(p, q), Math.max(r, s)) - Math.max(Math.min(p, q), Math.min(r, s)));
    if (a[0] === b[0] && c[0] === d[0] && Math.abs(a[0] - c[0]) <= 3) run += span(a[1], b[1], c[1], d[1]);
    if (a[1] === b[1] && c[1] === d[1] && Math.abs(a[1] - c[1]) <= 3) run += span(a[0], b[0], c[0], d[0]);
  }
  return run;
};
// Does a horizontal leg of one polyline cross a vertical leg of the other?
const cross = (A, B) => {
  const legs = P => P.slice(1).map((q, i) => [P[i], q]);
  const x = ([p, q], [r, s]) => p[1] === q[1] && r[0] === s[0] && r[0] > Math.min(p[0], q[0]) && r[0] < Math.max(p[0], q[0]) && p[1] > Math.min(r[1], s[1]) && p[1] < Math.max(r[1], s[1]);
  return legs(A).some(a => legs(B).some(b => x(a, b) || x(b, a)));
};

for (const [name, cell] of [['down-left', [0, 2]], ['down-right', [2, 2]], ['up-left', [0, 0]], ['up-right', [2, 0]]]) {
  test(`a bent request and its reply run side by side (${name})`, async () => {
    const r = await lay({ grid: { cols: 3, rows: 3 }, nodes: [node('hub', [1, 1]), node('far', cell)],
      steps: [{ n: 1, from: 'hub', to: 'far', label: 'ask' }, { n: 2, from: 'far', to: 'hub', label: 'answer', reply: true }] });
    assert.equal(r.error, undefined, r.error?.message);
    const [req, rep] = r.arrows;
    assert.equal(corners(req.points), 1, JSON.stringify(req.points));
    assert.equal(corners(rep.points), 1, JSON.stringify(rep.points));
    assert.equal(sharedRun(req.points, rep.points), 0, `one line: ${JSON.stringify([req.points, rep.points])}`);
    assert.ok(!cross(req.points, rep.points), `they cross: ${JSON.stringify([req.points, rep.points])}`);
    // Each still runs its own way: the request ends nearer the far node, the reply nearer the hub.
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    assert.ok(d(req.points.at(-1), rep.points[0]) < d(req.points[0], rep.points[0]), 'the request heads for the far node');
  });
}

test('a pair whose reply comes first still runs side by side', async () => {
  const r = await lay({ grid: { cols: 3, rows: 3 }, nodes: [node('hub', [1, 1]), node('far', [0, 2])],
    steps: [{ n: 1, from: 'far', to: 'hub', label: 'answer', reply: true }, { n: 2, from: 'hub', to: 'far', label: 'ask' }] });
  assert.equal(r.error, undefined, r.error?.message);
  assert.equal(sharedRun(r.arrows[0].points, r.arrows[1].points), 0, JSON.stringify(r.arrows.map(a => a.points)));
});

test('boot reports UNROUTABLE as a failure, not a crash', async () => {
  await done(); done = null;
  const p = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 } });
  try {
    const r = await p.page.evaluate(async () => {
      const theme = await (await fetch('/themes/light.json')).json();
      const n = (id, cell) => ({ id, icon: 'rack', name: id, cell });
      const d = { template: 'flow-grid', title: 'x', panels: [{ grid: { cols: 3, rows: 1 }, nodes: [n('a', [0, 0]), n('b', [1, 0]), n('c', [2, 0])], steps: [{ n: 1, from: 'a', to: 'c', label: 'skip' }] }] };
      return window.boot(d, theme, { style: 'filled', localIcons: [] });
    });
    assert.equal(r.failures.length, 1);
    assert.equal(r.failures[0].code, 'UNROUTABLE');
    assert.deepEqual(r.failures[0].ids, ['s0', 'b']);
  } finally { await p.done(); }
});
