// orth.js — orthogonal routing for a dense map. Pure: no DOM, so it tests in Node.
//   routeMap({ nodes, zones, steps, bounds, k }) -> { routes: [x, y][][] (one per step), crossings, cost, order }
//   nodes: placed nodes { id, cx, cy, box, iconBox, labelBoxes }
//   zones: { id, x, y, w, h, title?: box, members: [node ids] }
//   steps: { id, from, to, n? }, where from and to are node ids or "zone:<id>"
// A* over a grid of lines: the lines through every port, plus lanes laid out in whatever free space the nodes leave. The
// state is (vertex, heading), so a bend costs what it should. Routes are laid down one at a time; each may cross the ones
// before it at a cost, but never run along one, so a few orders are tried and the cheapest kept.
import { LayoutError, edgeX } from './route.js';

export const END = 14;              // a route stops this far short of what it joins (arrow.js draws the head inside it)
const CLEAR = 8;                    // and keeps this far from a name's sides as it passes (END from everything else, so
                                    // nothing ever runs through the gap an arrowhead would sit in)
const SEP = 9;                      // two parallel routes stay this far apart: a clear gap at line weight 3
const LANE = 13;                    // lanes in free space
const PORT = 16;                    // ports on a side, this far apart
const STUB_OUT = 10, STUB_IN = 26;  // a route runs straight this far out of its start, and into its end (room for the head)
const MERGE = 1;                    // lines closer than this are one line
const HUG = 7;                      // running this close alongside a zone's border costs extra
const COST = { bend: 70, cross: 120, port: 8, portBusy: 24, foreign: 1.2, hug: 1 };

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];                // heading: 0 right, 1 down, 2 left, 3 up
const opposite = h => (h + 2) % 4;

function snap(values, eps) {
  const sorted = [...values].sort((a, b) => a - b), out = [];
  for (const v of sorted) if (!out.length || v - out[out.length - 1] >= eps) out.push(+v.toFixed(3));
  return out;
}
function nearest(lines, v) {
  let lo = 0, hi = lines.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lines[m] <= v) lo = m; else hi = m; }
  return Math.abs(lines[lo] - v) <= Math.abs(lines[hi] - v) ? lo : hi;
}
const inflate = (b, d) => ({ x0: b.x - d, y0: b.y - d, x1: b.x + b.w + d, y1: b.y + b.h + d });

// Free stretches along one axis, given the boxes' extents on that axis.
function freeSpans(spans, lo, hi) {
  const out = [];
  let at = lo;
  for (const [a, b] of [...spans].sort((p, q) => p[0] - q[0])) { if (a > at) out.push([at, Math.min(a, hi)]); at = Math.max(at, b); }
  if (at < hi) out.push([at, hi]);
  return out;
}
// Lanes centred in a free stretch, as many as fit at the spacing.
function lanes(span, gap, max = 9) {
  const [a, b] = span, w = b - a;
  if (w < gap / 2) return [];
  const n = Math.min(max, Math.max(1, Math.floor(w / gap))), mid = (a + b) / 2;
  return Array.from({ length: n }, (_, i) => mid + (i - (n - 1) / 2) * gap);
}

// A binary heap of [f, seq, state]; seq breaks ties, so the result doesn't depend on heap order.
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(e) { const a = this.a; a.push(e); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (Heap.lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && Heap.lt(a[l], a[m])) m = l; if (r < a.length && Heap.lt(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
  static lt(p, q) { return p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]); }
}

// Every place a route may join a node or zone: a point END short of it, with the heading that leaves it.
// A zone's edges also get ports opposite each node that talks to it, so an arrow can run straight to any part of an edge.
function portsOf(end, k, partners = []) {
  const e = END * k, p = PORT * k;
  if (end.zone) {
    const z = end.zone, out = [], along = [0, -1, 1, -2, 2, -3, 3].map(i => i * p);
    const blocked = x => z.title && x >= z.title.x - 4 * k && x <= z.title.x + z.title.w + 4 * k;
    const horizontalEdges = (x, rank) => { if (x <= z.x + e || x >= z.x + z.w - e) return; if (!blocked(x)) out.push({ x, y: z.y - e, h: 3, rank }); out.push({ x, y: z.y + z.h + e, h: 1, rank }); };
    const verticalEdges = (y, rank) => { if (y <= z.y + e || y >= z.y + z.h - e) return; out.push({ x: z.x - e, y, h: 2, rank }); out.push({ x: z.x + z.w + e, y, h: 0, rank }); };
    along.forEach((o, rank) => { horizontalEdges(z.x + z.w / 2 + o, rank); verticalEdges(z.y + z.h / 2 + o, rank); });
    for (const n of partners) for (const [o, rank] of [[0, 0], [-p, 0], [p, 0]]) { horizontalEdges(n.cx + o, rank); verticalEdges(n.cy + o, rank); }
    return out;
  }
  const n = end.node, out = [];
  [0, -1, 1].forEach((i, rank) => {
    const o = i * p;
    out.push({ x: n.cx + o, y: n.iconBox.y - e, h: 3, rank });
    out.push({ x: n.cx + o, y: n.box.y + n.box.h + e, h: 1, rank });
    out.push({ x: edgeX(n, n.cy + o, -1) - e, y: n.cy + o, h: 2, rank });
    out.push({ x: edgeX(n, n.cy + o, 1) + e, y: n.cy + o, h: 0, rank });
  });
  return out;
}

export function routeMap({ nodes, zones = [], steps, bounds, k = 1 }) {
  const byId = new Map(nodes.map(n => [n.id, n])), zoneById = new Map(zones.map(z => [z.id, z]));
  const zoneOfNode = new Map();
  zones.forEach((z, i) => { for (const id of z.members ?? []) zoneOfNode.set(id, i); });
  const endOf = id => id.startsWith('zone:') ? { zone: zoneById.get(id.slice(5)), id } : { node: byId.get(id), id };
  const clear = CLEAR * k, sep = SEP * k, stubOut = STUB_OUT * k, stubIn = STUB_IN * k, hug = HUG * k;
  const ports = new Map();
  const partnersOf = id => steps.flatMap(s => s.from === id ? [s.to] : s.to === id ? [s.from] : []).filter(o => !o.startsWith('zone:')).map(o => byId.get(o));
  for (const s of steps) for (const id of [s.from, s.to]) if (!ports.has(id)) ports.set(id, portsOf(endOf(id), k, id.startsWith('zone:') ? partnersOf(id) : []));

  // ---------- the lines ----------
  const gap = (END - 1) * k;
  const boxes = nodes.flatMap(n => [
    inflate(n.iconBox, gap),
    ...n.labelBoxes.map(b => ({ x0: b.x - clear, x1: b.x + b.w + clear, y0: b.y - gap, y1: b.y + b.h + gap })),
  ]);
  for (const z of zones) if (z.title) boxes.push(inflate(z.title, 3 * k));
  const xs = [bounds.x, bounds.x + bounds.w], ys = [bounds.y, bounds.y + bounds.h];
  for (const list of ports.values()) for (const p of list) {
    const [dx, dy] = DIRS[p.h];
    xs.push(p.x, p.x + dx * stubOut, p.x + dx * stubIn);
    ys.push(p.y, p.y + dy * stubOut, p.y + dy * stubIn);
  }
  for (const b of boxes) { xs.push(b.x0 - 0.5 * k, b.x1 + 0.5 * k); ys.push(b.y0 - 0.5 * k, b.y1 + 0.5 * k); }
  // Lanes in the free stretches between the boxes and either side of the zones' borders, so routes have somewhere to run.
  const zoneXs = zones.flatMap(z => [[z.x - hug, z.x + hug], [z.x + z.w - hug, z.x + z.w + hug]]);
  const zoneYs = zones.flatMap(z => [[z.y - hug, z.y + hug], [z.y + z.h - hug, z.y + z.h + hug]]);
  for (const span of freeSpans([...boxes.map(b => [b.x0, b.x1]), ...zoneXs], bounds.x, bounds.x + bounds.w)) xs.push(...lanes(span, LANE * k));
  for (const span of freeSpans([...boxes.map(b => [b.y0, b.y1]), ...zoneYs], bounds.y, bounds.y + bounds.h)) ys.push(...lanes(span, LANE * k));
  const X = snap(xs.filter(v => v >= bounds.x && v <= bounds.x + bounds.w), MERGE * k), Y = snap(ys.filter(v => v >= bounds.y && v <= bounds.y + bounds.h), MERGE * k);
  const nx = X.length, ny = Y.length, at = (i, j) => j * nx + i;

  // ---------- static costs and walls, per unit edge. hEdge[at(i, j)] is (i, j)→(i+1, j); vEdge[at(i, j)] is (i, j)→(i, j+1) ----------
  const hWall = new Uint8Array(nx * ny), vWall = new Uint8Array(nx * ny), hHug = new Uint8Array(nx * ny), vHug = new Uint8Array(nx * ny);
  const hZone = new Uint8Array(nx * ny), vZone = new Uint8Array(nx * ny);
  for (const b of boxes) {
    for (let j = 0; j < ny; j++) if (Y[j] > b.y0 && Y[j] < b.y1) for (let i = 0; i < nx - 1; i++) if (X[i + 1] > b.x0 && X[i] < b.x1) hWall[at(i, j)] = 1;
    for (let i = 0; i < nx; i++) if (X[i] > b.x0 && X[i] < b.x1) for (let j = 0; j < ny - 1; j++) if (Y[j + 1] > b.y0 && Y[j] < b.y1) vWall[at(i, j)] = 1;
  }
  zones.forEach((z, zi) => {
    const bit = 1 << zi, x1 = z.x + z.w, y1 = z.y + z.h;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx - 1; i++) {
      const mx = (X[i] + X[i + 1]) / 2;
      if (mx > z.x && mx < x1) { if (Y[j] > z.y && Y[j] < y1) hZone[at(i, j)] |= bit; if (Math.abs(Y[j] - z.y) < hug || Math.abs(Y[j] - y1) < hug) hHug[at(i, j)] = 1; }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny - 1; j++) {
      const my = (Y[j] + Y[j + 1]) / 2;
      if (my > z.y && my < y1) { if (X[i] > z.x && X[i] < x1) vZone[at(i, j)] |= bit; if (Math.abs(X[i] - z.x) < hug || Math.abs(X[i] - x1) < hug) vHug[at(i, j)] = 1; }
    }
  });
  const nearY = Y.map(y => Y.flatMap((v, j) => Math.abs(v - y) < sep ? [j] : [])), nearX = X.map(x => X.flatMap((v, i) => Math.abs(v - x) < sep ? [i] : []));
  const ownMask = end => end.zone ? 1 << zones.indexOf(end.zone) : zoneOfNode.has(end.node.id) ? 1 << zoneOfNode.get(end.node.id) : 0;

  // ---------- one attempt: lay the steps down in this order ----------
  function attempt(order) {
    const hBusy = new Uint8Array(nx * ny), vBusy = new Uint8Array(nx * ny);       // an edge another route uses or runs too close to
    const passH = new Uint8Array(nx * ny), passV = new Uint8Array(nx * ny), corner = new Uint8Array(nx * ny), hot = new Uint8Array(nx * ny);
    const portUse = new Map();
    const routes = new Array(steps.length).fill(null), failed = [];
    let total = 0, crossings = 0;

    // The unit edges from vertex (i, j) to (i2, j2) on one line, or null if a wall or another route is in the way. Reports the crossings.
    const walk = (i, j, i2, j2) => {
      const out = { edges: [], cost: 0, crossings: 0 };
      const h = j === j2, sign = h ? Math.sign(i2 - i) : Math.sign(j2 - j);
      let a = i, b = j;
      while (a !== i2 || b !== j2) {
        const na = h ? a + sign : a, nb = h ? b : b + sign, lowI = Math.min(a, na), lowJ = Math.min(b, nb);
        const wall = h ? hWall[at(lowI, b)] || hBusy[at(lowI, b)] : vWall[at(a, lowJ)] || vBusy[at(a, lowJ)];
        if (wall) return null;
        const v = at(na, nb);
        if (corner[v] || hot[v] || (h ? passH[v] : passV[v])) { if (corner[v] || hot[v]) return null; }
        if (h ? passV[v] : passH[v]) { out.crossings++; out.cost += COST.cross * k; }
        out.edges.push([a, b, na, nb]);
        a = na; b = nb;
      }
      return out;
    };

    const commit = (route, cost, crossed) => {
      for (let s = 0; s < route.length - 1; s++) {
        const [i, j] = route[s], [i2, j2] = route[s + 1];
        if (j === j2) {
          for (let a = Math.min(i, i2); a < Math.max(i, i2); a++) for (const jj of nearY[j]) hBusy[at(a, jj)] = 1;
          for (let a = Math.min(i, i2); a <= Math.max(i, i2); a++) passH[at(a, j)] = 1;
        } else {
          for (let b = Math.min(j, j2); b < Math.max(j, j2); b++) for (const ii of nearX[i]) vBusy[at(ii, b)] = 1;
          for (let b = Math.min(j, j2); b <= Math.max(j, j2); b++) passV[at(i, b)] = 1;
        }
        if (s > 0) corner[at(i, j)] = 1;
      }
      // Nothing crosses the ends of a route: the head and the start of the line stay clear.
      for (const [v0, v1] of [[route[0], route[1]], [route[route.length - 1], route[route.length - 2]]]) {
        const [i, j] = v0, [i2, j2] = v1, far = Math.min(stubIn, Math.hypot(X[i2] - X[i], Y[j2] - Y[j]));
        const horizontal = j === j2, sign = horizontal ? Math.sign(i2 - i) : Math.sign(j2 - j);
        for (let a = i, b = j; ; horizontal ? a += sign : b += sign) {
          if (Math.hypot(X[a] - X[i], Y[b] - Y[j]) > far) break;
          hot[at(a, b)] = 1;
          if (horizontal ? a === i2 : b === j2) break;
        }
      }
      total += cost; crossings += crossed;
    };

    const portKey = (id, p) => `${id}|${p.h}|${p.x}|${p.y}`;
    const portCost = (id, p) => (p.rank ? COST.port * k : 0) + (portUse.get(`${id}|${p.h}`) ? COST.portBusy * k : 0);
    const toGrid = (x, y) => [nearest(X, x), nearest(Y, y)];

    // One step: the cheapest of a straight line between two facing ports and an A* from any start to any end.
    function routeStep(s) {
      const a = endOf(s.from), b = endOf(s.to), mask = ownMask(a) | ownMask(b);
      const starts = [], targets = [];
      for (const p of ports.get(s.from)) {
        if (portUse.has(portKey(s.from, p))) continue;
        const [i, j] = toGrid(p.x, p.y), [dx, dy] = DIRS[p.h], [si, sj] = toGrid(p.x + dx * stubOut, p.y + dy * stubOut);
        if (si === i && sj === j) continue;
        const w = walk(i, j, si, sj);
        if (w) starts.push({ p, i, j, si, sj, g: stubOut + portCost(s.from, p) + w.cost, crossed: w.crossings });
      }
      for (const p of ports.get(s.to)) {
        if (portUse.has(portKey(s.to, p))) continue;
        const [i, j] = toGrid(p.x, p.y), [dx, dy] = DIRS[p.h], [si, sj] = toGrid(p.x + dx * stubIn, p.y + dy * stubIn);
        if (si === i && sj === j) continue;
        const w = walk(si, sj, i, j);
        if (w) targets.push({ p, i, j, si, sj, g: stubIn + portCost(s.to, p) + w.cost, crossed: w.crossings });
      }
      let best = null;

      // Facing ports on one line, too close for both stubs to fit.
      for (const f of ports.get(s.from)) for (const t of ports.get(s.to)) {
        if (t.h !== opposite(f.h) || portUse.has(portKey(s.from, f)) || portUse.has(portKey(s.to, t))) continue;
        const [i, j] = toGrid(f.x, f.y), [i2, j2] = toGrid(t.x, t.y), [dx, dy] = DIRS[f.h];
        if ((dx && j !== j2) || (dy && i !== i2)) continue;
        const d = (X[i2] - X[i]) * dx + (Y[j2] - Y[j]) * dy;
        if (d < stubIn) continue;
        const w = walk(i, j, i2, j2);
        if (!w) continue;
        const cost = d + w.cost + portCost(s.from, f) + portCost(s.to, t);
        if (!best || cost < best.cost) best = { cost, crossed: w.crossings, route: [[i, j], [i2, j2]], from: f, to: t };
      }

      const size = nx * ny * 4, G = new Float64Array(size).fill(Infinity), prev = new Int32Array(size).fill(-1), Crossed = new Int16Array(size);
      const startOf = new Map(), heap = new Heap();
      let seq = 0;
      const hOf = (i, j) => { let m = Infinity; for (const t of targets) m = Math.min(m, Math.abs(X[t.si] - X[i]) + Math.abs(Y[t.sj] - Y[j])); return m; };
      const key = (i, j, h) => at(i, j) * 4 + h;
      for (const st of starts) {
        const state = key(st.si, st.sj, st.p.h);
        if (st.g < G[state]) { G[state] = st.g; startOf.set(state, st); Crossed[state] = st.crossed; heap.push([st.g + hOf(st.si, st.sj), seq++, state]); }
      }
      const targetAt = new Map();
      for (const t of targets) { const v = at(t.si, t.sj), list = targetAt.get(v) ?? []; list.push(t); targetAt.set(v, list); }
      let found = null;
      while (heap.size && targets.length) {
        const [f, , state] = heap.pop();
        const h = state % 4, v = (state - h) / 4, i = v % nx, j = (v - i) / nx, g = G[state];
        if (found && f >= found.cost) break;
        if (f > g + hOf(i, j) + 1e-6) continue;
        for (const t of targetAt.get(v) ?? []) {
          const inward = opposite(t.p.h);
          if (h === t.p.h) continue;                                              // would have to reverse into its stub
          const turning = h !== inward;
          if (turning && (passH[v] || passV[v])) continue;
          const cost = g + t.g + (turning ? COST.bend * k : 0);
          if (!found || cost < found.cost) found = { cost, state, target: t, crossed: Crossed[state] + t.crossed };
        }
        for (let nh = 0; nh < 4; nh++) {
          if (nh === opposite(h)) continue;
          const turning = nh !== h;
          if (turning && (passH[v] || passV[v] || corner[v] || hot[v])) continue;
          const [dx, dy] = DIRS[nh], ni = i + dx, nj = j + dy;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nv = at(ni, nj), horizontal = dy === 0, edge = horizontal ? at(Math.min(i, ni), j) : at(i, Math.min(j, nj));
          if (horizontal ? hWall[edge] || hBusy[edge] : vWall[edge] || vBusy[edge]) continue;
          if (corner[nv] || hot[nv]) continue;
          const d = horizontal ? Math.abs(X[ni] - X[i]) : Math.abs(Y[nj] - Y[j]);
          let step = d;
          if (((horizontal ? hZone[edge] : vZone[edge]) & ~mask) !== 0) step += d * COST.foreign;
          if (horizontal ? hHug[edge] : vHug[edge]) step += d * COST.hug;
          if (turning) step += COST.bend * k;
          const cross = horizontal ? passV[nv] : passH[nv];
          if (cross) step += COST.cross * k;
          const ns = key(ni, nj, nh), ng = g + step;
          if (ng < G[ns] - 1e-9) { G[ns] = ng; prev[ns] = state; Crossed[ns] = Crossed[state] + (cross ? 1 : 0); heap.push([ng + hOf(ni, nj), seq++, ns]); }
        }
      }
      if (found && (!best || found.cost < best.cost)) {
        const chain = [];
        for (let st = found.state; st !== -1; st = prev[st]) chain.push(st);
        chain.reverse();
        const start = startOf.get(chain[0]), t = found.target;
        const verts = chain.map(st => { const v = (st - st % 4) / 4, i = v % nx; return [i, (v - i) / nx]; });
        best = { cost: found.cost, crossed: found.crossed, route: [[start.i, start.j], ...verts, [t.si, t.sj], [t.i, t.j]], from: start.p, to: t.p };
      }
      if (!best) return null;
      const simple = [best.route[0]];
      for (let r = 1; r < best.route.length; r++) {
        const p = simple[simple.length - 1], q = best.route[r], nx2 = best.route[r + 1];
        if (p[0] === q[0] && p[1] === q[1]) continue;
        if (nx2 && ((p[0] === q[0] && q[0] === nx2[0]) || (p[1] === q[1] && q[1] === nx2[1]))) continue;
        simple.push(q);
      }
      commit(simple, best.cost, best.crossed);
      portUse.set(portKey(s.from, best.from), true); portUse.set(`${s.from}|${best.from.h}`, true);
      portUse.set(portKey(s.to, best.to), true); portUse.set(`${s.to}|${best.to.h}`, true);
      return simple.map(([i, j]) => [X[i], Y[j]]);
    }

    for (const idx of order) {
      const r = routeStep(steps[idx]);
      if (r) routes[idx] = r; else failed.push(idx);
    }
    return { routes, failed, cost: total, crossings, order };
  }

  // ---------- a few orders, one rip-up, keep the cheapest ----------
  const distance = s => {
    const c = id => { const e = endOf(id); return e.zone ? [e.zone.x + e.zone.w / 2, e.zone.y + e.zone.h / 2] : [e.node.cx, e.node.cy]; };
    const [a, b] = [c(s.from), c(s.to)];
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  };
  const reading = steps.map((_, i) => i);
  const byDistance = [...reading].sort((a, b) => distance(steps[a]) - distance(steps[b]) || a - b);
  const results = [reading, byDistance, [...byDistance].reverse()].map(attempt);
  for (const r of results.filter(r => r.failed.length).slice()) {
    const again = attempt([...r.failed, ...r.order.filter(i => !r.failed.includes(i))]);
    results.push(again);
  }
  const score = r => r.failed.length * 1e9 + r.cost;
  const best = results.reduce((p, q) => score(q) < score(p) ? q : p);
  if (best.failed.length) {
    const s = steps[best.failed[0]], name = s.n !== undefined && s.n !== null ? `step ${s.n}` : `step ${s.id}`;
    throw new LayoutError({ code: 'UNROUTABLE', step: s.n ?? null, stepId: s.id, blocking: null,
      detail: `${name} ("${s.from}" → "${s.to}") has no free path: the gutters around "${s.from}" and "${s.to}" are full. Move one of them next to the other, leave a cell empty on the way, or end the arrow at a zone` });
  }
  return { routes: best.routes, crossings: best.crossings, cost: best.cost, order: best.order };
}
