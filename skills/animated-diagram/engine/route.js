// route.js — the routing envelope for steps that aren't neighbours: one-bend Ls, and two-bend routes round a vertical
// gutter for retries and back edges. Nothing else: a step that can't be routed so is refused with UNROUTABLE.
//   route(from, to, kind, obstacles, gutters, { back, step, stepId, k, prefer }) -> [x, y][]
//   from/to are placed nodes ({ id, cx, cy, box, iconBox, labelBoxes }); obstacles are { id, x, y, w, h } boxes
//   (every node's icon and text boxes); gutters.xs are the vertical gutters (column midlines and panel margins).
export const END = 14, CLEAR = 8;          // arrows stop 14 short of a node; routes keep 8 clear of every box

export class LayoutError extends Error {
  constructor({ code, step, stepId, blocking, detail }) {
    super(detail);
    this.name = 'LayoutError';
    Object.assign(this, { code, step, stepId, blocking, detail });
  }
}

// The x where a horizontal line at y leaves a node: the outer edge of the parts (icon, texts) the line passes.
export function edgeX(n, y, dir) {
  const parts = [n.iconBox, ...n.labelBoxes].filter(b => y >= b.y && y <= b.y + b.h);
  const use = parts.length ? parts : [n.iconBox];
  return dir > 0 ? Math.max(...use.map(b => b.x + b.w)) : Math.min(...use.map(b => b.x));
}

// Does the polyline cross the box (inflated by pad)? Each segment is clipped against the box (Liang–Barsky).
export function crosses(points, b, pad = 0) {
  const x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.w + pad, y1 = b.y + b.h + pad;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-12) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay) && t0 <= t1) return true;
  }
  return false;
}

const length = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
// The first obstacle along the route, or null.
function blocker(pts, obstacles, pad) {
  for (let i = 1; i < pts.length; i++) {
    const seg = [pts[i - 1], pts[i]], hit = obstacles.filter(o => crosses(seg, o, pad));
    if (hit.length) return hit.sort((a, b) => Math.hypot(a.x + a.w / 2 - seg[0][0], a.y + a.h / 2 - seg[0][1]) - Math.hypot(b.x + b.w / 2 - seg[0][0], b.y + b.h / 2 - seg[0][1]))[0];
  }
  return null;
}

// Out of a node's top or bottom toward y, or its left or right side toward x, stopping END short.
const vEnd = (n, toward, e) => toward > n.cy ? n.box.y + n.box.h + e : n.box.y - e;
const hEnd = (n, y, toward, e) => { const dir = toward > n.cx ? 1 : -1; return edgeX(n, y, dir) + dir * e; };

function ls(a, b, e) {
  return [
    [[hEnd(a, a.cy, b.cx, e), a.cy], [b.cx, a.cy], [b.cx, vEnd(b, a.cy, e)]],       // horizontal first
    [[a.cx, vEnd(a, b.cy, e)], [a.cx, b.cy], [hEnd(b, b.cy, a.cx, e), b.cy]],       // vertical first
  ].filter(p => length(p) > 0);
}

function viaGutters(a, b, xs, e) {
  return [...xs].sort((g, h) => Math.abs(g - a.cx) - Math.abs(h - a.cx))
    .filter(gx => Math.abs(gx - a.cx) > 1 && Math.abs(gx - b.cx) > 1)
    .map(gx => [[hEnd(a, a.cy, gx, e), a.cy], [gx, a.cy], [gx, b.cy], [hEnd(b, b.cy, gx, e), b.cy]]);
}

// A request and its reply that can't run straight: two parallel Ls `pair` px either side of the centre line, nested
// (one outside the corner, one inside) so they never cross. Both lines must be clear, or the step is UNROUTABLE.
//   routePair(a, b, obstacles, { step, stepId, k, prefer, pair }) -> { request: [x, y][] a → b, reply: [x, y][] b → a }
export function routePair(a, b, obstacles, { step = null, stepId = null, k = 1, prefer = null, pair }) {
  const e = END * k, pad = CLEAR * k, sx = Math.sign(b.cx - a.cx), sy = Math.sign(b.cy - a.cy);
  const hFirst = (dx, dy) => { const x = b.cx + dx, y = a.cy + dy; return [[hEnd(a, y, x, e), y], [x, y], [x, vEnd(b, y, e)]]; };
  const vFirst = (dx, dy) => { const x = a.cx + dx, y = b.cy + dy; return [[x, vEnd(a, y, e)], [x, y], [hEnd(b, y, x, e), y]]; };
  const inLine = sx === 0
    ? [{ request: [[a.cx - pair, vEnd(a, b.cy, e)], [a.cx - pair, vEnd(b, a.cy, e)]], reply: [[a.cx + pair, vEnd(a, b.cy, e)], [a.cx + pair, vEnd(b, a.cy, e)]] }]
    : [{ request: [[hEnd(a, a.cy - pair, b.cx, e), a.cy - pair], [hEnd(b, b.cy - pair, a.cx, e), b.cy - pair]], reply: [[hEnd(a, a.cy + pair, b.cx, e), a.cy + pair], [hEnd(b, b.cy + pair, a.cx, e), b.cy + pair]] }];
  const bent = [
    { request: hFirst(sx * pair, -sy * pair), reply: hFirst(-sx * pair, sy * pair) },
    { request: vFirst(-sx * pair, sy * pair), reply: vFirst(sx * pair, -sy * pair) },
  ];
  const size = c => length(c.request) + length(c.reply);
  const tries = sx === 0 || sy === 0 ? inLine : prefer === 0 ? bent : bent.sort((p, q) => size(p) - size(q));
  const ok = tries.find(c => !blocker(c.request, obstacles, pad) && !blocker(c.reply, obstacles, pad));
  if (ok) return { request: ok.request, reply: [...ok.reply].reverse() };
  const b0 = blocker(tries[0].request, obstacles, pad) ?? blocker(tries[0].reply, obstacles, pad);
  const name = step !== null ? `step ${step}` : `step ${stepId}`;
  throw new LayoutError({ code: 'UNROUTABLE', step, stepId, blocking: b0?.id ?? null,
    detail: `${name} ("${a.id}" ⇄ "${b.id}") needs room for two lines side by side: "${b0?.id}" is in the way — move a cell so the pair joins neighbours or has a clear corner` });
}

// prefer: 0 tries the horizontal-first L before the shorter one (a stack forks out of a node's sides into the next
// layer's tops), null takes the shorter.
export function route(from, to, kind, obstacles, gutters, { back = false, step = null, stepId = null, k = 1, prefer = null } = {}) {
  const e = END * k, pad = CLEAR * k;
  const free = pts => !blocker(pts, obstacles, pad);
  // Two nodes in one column or row have no L: their one candidate is the straight line, so a refusal names what's between.
  const vertical = Math.abs(from.cx - to.cx) < 1, horizontal = Math.abs(from.cy - to.cy) < 1;
  const straight = vertical ? [[from.cx, vEnd(from, to.cy, e)], [from.cx, vEnd(to, from.cy, e)]] : [[hEnd(from, from.cy, to.cx, e), from.cy], [hEnd(to, to.cy, from.cx, e), to.cy]];
  const both = vertical || horizontal ? [straight] : ls(from, to, e), lShapes = prefer === 0 && both.length === 2 ? both : both.sort((p, q) => length(p) - length(q));
  const tries = back || kind === 'retry' ? [...viaGutters(from, to, gutters.xs ?? [], e), ...lShapes] : lShapes;
  const ok = tries.find(free);
  if (ok) return ok;
  const first = tries[0], b = first && blocker(first, obstacles, pad);
  const name = step !== null ? `step ${step}` : `step ${stepId}`;
  throw new LayoutError({ code: 'UNROUTABLE', step, stepId, blocking: b?.id ?? null,
    detail: `${name} ("${from.id}" → "${to.id}") can't be drawn straight, with one bend${back || kind === 'retry' ? ' or round a gutter' : ''}: "${b?.id}" is in the way — move a cell so the step joins neighbours or has a clear corner` });
}
