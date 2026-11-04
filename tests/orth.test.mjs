// The map router, in plain Node: properties of the routes, never exact coordinates (measured text differs by platform).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeMap, END } from '../skills/animated-diagram/engine/orth.js';
import { crosses, LayoutError } from '../skills/animated-diagram/engine/route.js';

const CELL = { w: 171, h: 190 }, ORIGIN = { x: 40, y: 150 }, BOUNDS = { x: 30, y: 140, w: 7 * 171 + 20, h: 4 * 190 + 20 };

// A node as the layout places it: an icon with a name under it.
function node(id, c, r, nameW = 120) {
  const cx = ORIGIN.x + (c + 0.5) * CELL.w, cy = ORIGIN.y + (r + 0.42) * CELL.h;
  const iconBox = { x: cx - 40, y: cy - 36, w: 80, h: 72 }, label = { x: cx - nameW / 2, y: cy + 44, w: nameW, h: 24 };
  const box = { x: Math.min(iconBox.x, label.x), y: iconBox.y, w: Math.max(iconBox.w, nameW), h: label.y + label.h - iconBox.y };
  return { id, cx, cy, cell: [c, r], box, iconBox, labelBoxes: [label] };
}
// A zone as the bounding box of its members' cells, its title along the top.
function zone(id, nodes) {
  const cs = nodes.map(n => n.cell[0]), rs = nodes.map(n => n.cell[1]);
  const x = ORIGIN.x + Math.min(...cs) * CELL.w + 6, y = ORIGIN.y + Math.min(...rs) * CELL.h + 2;
  const w = (Math.max(...cs) - Math.min(...cs) + 1) * CELL.w - 12, h = (Math.max(...rs) - Math.min(...rs) + 1) * CELL.h - 4;
  return { id, x, y, w, h, title: { x: x + 14, y: y + 6, w: 110, h: 18 }, members: nodes.map(n => n.id) };
}

// The hero's topology: every node and arrow of "Anatomy of an AI app".
function hero() {
  const N = {};
  for (const [id, c, r] of [
    ['user', 0, 0], ['chat', 0, 1],
    ['gateway', 1, 0], ['auth', 2, 0], ['rate', 3, 0], ['output', 1, 1], ['input', 3, 1],
    ['orch', 4, 1], ['prompt', 4, 2], ['memory', 5, 2],
    ['large', 1, 2], ['router', 2, 2], ['fast', 2, 3],
    ['docs', 3, 3], ['reranker', 4, 3], ['vector', 5, 3], ['embedder', 6, 3],
    ['search', 4, 0], ['sandbox', 5, 0], ['apis', 6, 0],
    ['traces', 6, 1], ['evals', 6, 2],
  ]) N[id] = node(id, c, r);
  const pick = (...ids) => ids.map(i => N[i]);
  const zones = [
    zone('access', pick('gateway', 'auth', 'rate', 'output', 'input')),
    zone('agent', pick('orch', 'prompt', 'memory')),
    zone('models', pick('large', 'router', 'fast')),
    zone('retrieval', pick('docs', 'reranker', 'vector', 'embedder')),
    zone('tools', pick('search', 'sandbox', 'apis')),
    zone('obs', pick('traces', 'evals')),
  ];
  const steps = [
    ['user', 'chat'], ['chat', 'gateway'], ['gateway', 'auth'], ['auth', 'rate'], ['rate', 'input'], ['input', 'orch'],
    ['orch', 'memory'], ['orch', 'embedder'], ['embedder', 'vector'], ['vector', 'reranker'], ['reranker', 'prompt'],
    ['prompt', 'router'], ['router', 'large'], ['large', 'orch'], ['orch', 'zone:tools'], ['large', 'output'], ['output', 'chat'],
    ['router', 'fast'], ['zone:tools', 'orch'], ['docs', 'vector'], ['orch', 'traces'], ['traces', 'evals'],
  ].map(([from, to], i) => ({ id: `s${i}`, from, to }));
  return { nodes: Object.values(N), zones, steps, bounds: BOUNDS, k: 1 };
}

const segs = pts => pts.slice(1).map((q, i) => [pts[i], q]);
const len = ([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const pathLen = pts => segs(pts).reduce((s, g) => s + len(g), 0);
const parts = n => [n.iconBox, ...n.labelBoxes];

function crossings(routes) {
  let n = 0;
  for (let a = 0; a < routes.length; a++) for (let b = a + 1; b < routes.length; b++) for (const [p, q] of segs(routes[a])) for (const [r, s] of segs(routes[b])) {
    const pv = p[0] === q[0], rv = r[0] === s[0];
    if (pv === rv) continue;
    const [vx, v0, v1, hy, h0, h1] = pv ? [p[0], p[1], q[1], r[1], r[0], s[0]] : [r[0], r[1], s[1], p[1], p[0], q[0]];
    if (hy > Math.min(v0, v1) && hy < Math.max(v0, v1) && vx > Math.min(h0, h1) && vx < Math.max(h0, h1)) n++;
  }
  return n;
}
function sharedRun(A, B, near = 3) {
  let run = 0;
  for (const [p, q] of segs(A)) for (const [r, s] of segs(B)) {
    if (p[0] === q[0] && r[0] === s[0] && Math.abs(p[0] - r[0]) <= near) run += Math.max(0, Math.min(Math.max(p[1], q[1]), Math.max(r[1], s[1])) - Math.max(Math.min(p[1], q[1]), Math.min(r[1], s[1])));
    if (p[1] === q[1] && r[1] === s[1] && Math.abs(p[1] - r[1]) <= near) run += Math.max(0, Math.min(Math.max(p[0], q[0]), Math.max(r[0], s[0])) - Math.max(Math.min(p[0], q[0]), Math.min(r[0], s[0])));
  }
  return run;
}

test('neighbours in line get one straight segment', () => {
  const a = node('a', 0, 0), b = node('b', 2, 0);
  const { routes } = routeMap({ nodes: [a, b], zones: [], steps: [{ id: 's0', from: 'a', to: 'b' }], bounds: BOUNDS, k: 1 });
  assert.equal(routes[0].length, 2);
  assert.equal(routes[0][0][1], routes[0][1][1], 'horizontal');
  assert.ok(routes[0][0][0] < routes[0][1][0], 'left to right');
});

test('a route stops short of its nodes and leaves room for an arrowhead', () => {
  const a = node('a', 0, 0), b = node('b', 3, 2);
  const { routes: [pts] } = routeMap({ nodes: [a, b], zones: [], steps: [{ id: 's0', from: 'a', to: 'b' }], bounds: BOUNDS, k: 1 });
  const gap = (p, n) => Math.min(...parts(n).map(b => Math.max(b.x - p[0], p[0] - b.x - b.w, b.y - p[1], p[1] - b.y - b.h)));
  assert.ok(Math.abs(gap(pts[0], a) - END) < 2, `start gap ${gap(pts[0], a)}`);
  assert.ok(Math.abs(gap(pts.at(-1), b) - END) < 2, `end gap ${gap(pts.at(-1), b)}`);
  assert.ok(len(segs(pts).at(-1)) >= 22, `last segment ${len(segs(pts).at(-1))}`);
});

test('a route goes round a node in its way', () => {
  const a = node('a', 0, 0), m = node('m', 1, 0), b = node('b', 2, 0);
  const { routes: [pts] } = routeMap({ nodes: [a, m, b], zones: [], steps: [{ id: 's0', from: 'a', to: 'b' }], bounds: BOUNDS, k: 1 });
  assert.ok(pts.length > 2, 'not straight');
  for (const part of parts(m)) assert.ok(!crosses(pts, part), JSON.stringify(pts));
});

test('every segment is horizontal or vertical', () => {
  for (const pts of routeMap(hero()).routes) for (const [p, q] of segs(pts)) assert.ok(p[0] === q[0] || p[1] === q[1], JSON.stringify([p, q]));
});

test('the hero\'s topology routes: no route runs through a node', () => {
  const h = hero(), { routes } = routeMap(h);
  assert.equal(routes.length, h.steps.length);
  routes.forEach((pts, i) => {
    for (const n of h.nodes) if (![h.steps[i].from, h.steps[i].to].includes(n.id)) for (const part of parts(n)) assert.ok(!crosses(pts, part), `${h.steps[i].id} (${h.steps[i].from}→${h.steps[i].to}) through ${n.id}`);
  });
});

test('the hero\'s topology routes: no two routes share a line', () => {
  const { routes } = routeMap(hero());
  for (let a = 0; a < routes.length; a++) for (let b = a + 1; b < routes.length; b++) assert.ok(sharedRun(routes[a], routes[b]) < 16, `s${a} and s${b} run together for ${sharedRun(routes[a], routes[b])}`);
});

test('the hero\'s topology routes: untangled', () => {
  const h = hero(), { routes } = routeMap(h), c = crossings(routes);
  assert.ok(c <= 3, `${c} crossings`);
  routes.forEach((pts, i) => {
    assert.ok(pts.length - 2 <= 4, `${h.steps[i].from}→${h.steps[i].to}: ${pts.length - 2} bends`);
    const direct = Math.abs(pts[0][0] - pts.at(-1)[0]) + Math.abs(pts[0][1] - pts.at(-1)[1]);
    assert.ok(pathLen(pts) <= Math.max(2.5 * direct, 300), `${h.steps[i].from}→${h.steps[i].to}: ${pathLen(pts).toFixed(0)} for ${direct.toFixed(0)}`);
  });
});

test('routing is deterministic', () => {
  assert.deepEqual(routeMap(hero()).routes, routeMap(hero()).routes);
});

test('a route to a zone ends at its edge and stays out', () => {
  const h = hero(), i = h.steps.findIndex(s => s.to === 'zone:tools'), pts = routeMap(h).routes[i], z = h.zones.find(x => x.id === 'tools');
  const [x, y] = pts.at(-1);
  assert.ok(!(x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h), `tip (${x}, ${y}) is inside`);
  assert.ok(Math.max(z.x - x, x - z.x - z.w, z.y - y, y - z.y - z.h) <= END + 1, 'at the edge');
  assert.ok(!crosses(pts, { x: z.x + 2, y: z.y + 2, w: z.w - 4, h: z.h - 4 }), 'stays out');
});

test('a zone\'s title is never crossed', () => {
  const h = hero(), { routes } = routeMap(h);
  for (const z of h.zones) for (const pts of routes) assert.ok(!crosses(pts, z.title), `${z.id}: ${JSON.stringify(pts)}`);
});

test('a route keeps out of a zone it has no business in, when it can', () => {
  const a = node('a', 0, 0), m = node('m', 1, 0), b = node('b', 2, 0), z = zone('z', [m]);
  const { routes: [pts] } = routeMap({ nodes: [a, m, b], zones: [z], steps: [{ id: 's0', from: 'a', to: 'b' }], bounds: BOUNDS, k: 1 });
  assert.ok(!crosses(pts, { x: z.x + 2, y: z.y + 2, w: z.w - 4, h: z.h - 4 }), JSON.stringify(pts));
});

test('a boxed-in step is refused with UNROUTABLE naming the step and where to look', () => {
  const a = node('a', 0, 0), b = node('b', 5, 3);
  const wall = { id: 'wall', cx: 0, cy: 0, cell: [2, 0], box: { x: 400, y: 0, w: 30, h: 2000 }, iconBox: { x: 400, y: 0, w: 30, h: 2000 }, labelBoxes: [] };
  assert.throws(() => routeMap({ nodes: [a, b, wall], zones: [], steps: [{ id: 's0', from: 'a', to: 'b', n: 4 }], bounds: BOUNDS, k: 1 }), e => {
    assert.ok(e instanceof LayoutError);
    assert.equal(e.code, 'UNROUTABLE');
    assert.equal(e.stepId, 's0');
    assert.match(e.detail, /step 4/);
    assert.match(e.detail, /"a"/);
    return true;
  });
});

test('it reports how tangled the result is', () => {
  const r = routeMap(hero());
  assert.equal(typeof r.crossings, 'number');
  assert.ok(Number.isFinite(r.cost));
});
