// layout.js — one panel: nodes into cells, paired arrows side by side (straight or bent), labels beside them, groups.
//   layoutPanel(panel, frame, ctx) -> { nodes, arrows, groups, cellW, cellH, inner }
//   ctx = { scene, theme, k, side?, prefix?, stack? }. Every px value is at width 1080 and scales by k.
//   stack: each row is a layer band across the frame (its group label top-left inside), a row's nodes spread evenly.
import { measureNode, drawNode } from './nodes.js';
import { TYPE } from './engine.js';
import { route, routePair, edgeX, crosses, END, CLEAR } from './route.js';
import { rowTracks, assignZones, labelStyle, pairSteps, isShort } from './grid.js';

const INNER = 56;           // panel inner margin
const PAIR = 20;           // a pair's lines sit ±20 off the centre line
const LABEL = { side: 22, above: 22, below: 30, clear: 8, band: 26, edge: 24 };   // labels may run to 24 inside the frame
const GROUP = { pad: 24, title: 30, r: 18, sw: 2.2, tx: 24, ty: 34 };
const BAND = { pad: 16, r: 16, sw: 2.4, tx: 20, ty: 26 };

const overlapsY = (b, y0, y1) => b.y < y1 && b.y + b.h > y0;

// How far a label at x may run toward its side before the label bounds (the frame inset by 24), a node block or an
// arrow drawn so far (walls) in its band.
function room(x, y, side, bounds, walls, k) {
  const y0 = y - LABEL.band * k, y1 = y + LABEL.band * k;
  let left = bounds.x, right = bounds.x + bounds.w;
  for (const b of walls) {
    if (!overlapsY(b, y0, y1)) continue;
    if (b.x + b.w <= x) left = Math.max(left, b.x + b.w + LABEL.clear * k);
    else if (b.x >= x) right = Math.min(right, b.x - LABEL.clear * k);
  }
  if (side === 'left') return Math.max(0, x - left);
  if (side === 'right') return Math.max(0, right - x);
  return Math.max(0, 2 * Math.min(x - left, right - x));
}

// A bent arrow's label: beside its longest segment — for a vertical one, at the roomiest of a few heights along it,
// on the roomier side; above the middle of a horizontal one. Half of a pair keeps to the side away from its partner.
function bentLabel(points, bounds, walls, k, partner = null) {
  let best = 1;
  for (let i = 2; i < points.length; i++) if (Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]) > Math.hypot(points[best][0] - points[best - 1][0], points[best][1] - points[best - 1][1])) best = i;
  const [p, q] = [points[best - 1], points[best]], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  if (Math.abs(p[0] - q[0]) < 1e-6) {
    let pick = null;
    const across = partner?.slice(1).map((q, i) => [partner[i], q]).find(([u, v]) => u[0] === v[0])?.[0][0];
    const sides = across === undefined ? ['right', 'left'] : [mx < across ? 'left' : 'right'];
    for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) for (const side of sides) {
      const y = p[1] + (q[1] - p[1]) * t, x = side === 'right' ? mx + LABEL.side * k : mx - LABEL.side * k, r = room(x, y, side, bounds, walls, k);
      if (!pick || r > pick.r + 1) pick = { x, y, side, grow: 'both', r };
    }
    return pick;
  }
  const along = partner?.slice(1).map((q, i) => [partner[i], q]).find(([u, v]) => u[1] === v[1])?.[0][1];
  if (along !== undefined && my > along) return { x: mx, y: my + LABEL.below * k, side: 'center', grow: 'down' };
  return { x: mx, y: my - LABEL.above * k, side: 'center', grow: 'up' };
}

// An arrow's segments as thin boxes, so later labels keep off them.
const segmentBoxes = points => points.slice(1).map((q, i) => { const p = points[i]; return { x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), w: Math.max(Math.abs(q[0] - p[0]), 0.01), h: Math.max(Math.abs(q[1] - p[1]), 0.01) }; });

export function layoutPanel(panel, frame, ctx) {
  const { scene, k } = ctx, T = scene.T, prefix = ctx.prefix ?? '';
  const inner = { x: frame.x + INNER * k, y: frame.y + INNER * k, w: frame.w - 2 * INNER * k, h: frame.h - 2 * INNER * k };
  const { cols, rows } = panel.grid, cellW = inner.w / cols, cellH = inner.h / rows;
  const nctx = { ...ctx, cellW, cellH };
  const byId = new Map(panel.nodes.map(n => [n.id, n]));

  // Groups widen their members' rows: a title band on top, padding below. In a stack, every row is a padded band
  // and the groups only name the bands.
  const stack = !!ctx.stack;
  const groups = stack ? [] : (panel.groups ?? []).map(g => ({ ...g, rows: g.nodes.map(id => byId.get(id).cell[1]) }));
  const extraTop = new Map(), extraBottom = new Map();
  if (stack) for (const n of panel.nodes) { extraTop.set(n.id, BAND.pad * k); extraBottom.set(n.id, BAND.pad * k); }
  for (const g of groups) for (const id of g.nodes) {
    const r = byId.get(id).cell[1];
    if (r === Math.min(...g.rows)) extraTop.set(id, (GROUP.pad + GROUP.title) * k);
    if (r === Math.max(...g.rows)) extraBottom.set(id, GROUP.pad * k);
  }

  const m = new Map(panel.nodes.map(n => [n.id, measureNode(n, nctx)]));
  const { up, down, used, spare, rowY } = rowTracks(panel.nodes, rows, m, extraTop, extraBottom, inner);
  const colX = c => inner.x + (c + 0.5) * cellW;
  const slotX = new Map();                    // stack: a row's nodes, in column order, spread evenly across the frame
  if (stack) for (let r = 0; r < rows; r++) {
    const inRow = panel.nodes.filter(n => n.cell[1] === r).sort((a, b) => a.cell[0] - b.cell[0]);
    inRow.forEach((n, i) => slotX.set(n.id, frame.x + (i + 0.5) * frame.w / inRow.length));
  }

  // What each node sits on decides its colours: a comparison's side, a stack's band, or a group's zone.
  const styleOf = new Map();
  const bands = [];
  if (stack) {
    const rowGroup = new Map((panel.groups ?? []).map(g => [byId.get(g.nodes[0]).cell[1], g]));
    const usedRows = used.flatMap((u, r) => u ? [r] : []), zones = assignZones(scene, usedRows.map(r => rowGroup.get(r) ?? {}));
    usedRows.forEach((r, i) => {
      const z = zones[i], b = { x: frame.x, y: rowY[r] - up[r], w: frame.w, h: up[r] + down[r], row: r, label: rowGroup.get(r)?.label ?? null, zone: z };
      scene.at('groups', () => {
        scene.rect(b.x, b.y, b.w, b.h, BAND.r * k, z.fill, z.stroke, BAND.sw * k);
        if (b.label) { const [size, weight] = TYPE.group; scene.text(b.x + BAND.tx * k, b.y + BAND.ty * k, b.label, { size: size * k, weight, fill: z.text, anchor: 'start', ls: 1.4 * k, role: 'group', owner: `${prefix}band${r}` }); }
      });
      for (const n of panel.nodes) if (n.cell[1] === r) styleOf.set(n.id, z);
      bands.push(b);
    });
  }
  const groupZones = ctx.side ? groups.map(() => null) : assignZones(scene, groups);
  groups.forEach((g, i) => { if (groupZones[i]) for (const id of g.nodes) if (!styleOf.has(id)) styleOf.set(id, groupZones[i]); });
  const sideStyle = ctx.side ? scene.sides[ctx.side] : null;

  const nodes = panel.nodes.map(n => {
    const [dx, dy] = n.offset ?? [0, 0], cx = (stack ? slotX.get(n.id) : colX(n.cell[0])) + dx * k, cy = rowY[n.cell[1]] + dy * k;
    const d = drawNode(scene, n, cx, cy, { ...nctx, style: sideStyle ?? styleOf.get(n.id) });
    return { id: n.id, cx, cy, cell: n.cell, ...d };
  });
  const placed = new Map(nodes.map(n => [n.id, n]));
  const blocks = nodes.map(n => n.box), walls = [...blocks];
  const bounds = { x: frame.x + LABEL.edge * k, y: frame.y, w: frame.w - 2 * LABEL.edge * k, h: frame.h };

  // Group rects come first in their layer, under everything; titles are placed once the arrows are known.
  const groupOut = groups.map((g, gi) => {
    const bs = g.nodes.map(id => placed.get(id).box);
    const x0 = Math.min(...bs.map(b => b.x)) - GROUP.pad * k, x1 = Math.max(...bs.map(b => b.x + b.w)) + GROUP.pad * k;
    const y0 = Math.min(...bs.map(b => b.y)) - (GROUP.pad + GROUP.title) * k, y1 = Math.max(...bs.map(b => b.y + b.h)) + GROUP.pad * k;
    const z = groupZones[gi];
    scene.at('groups', () => scene.rect(x0, y0, x1 - x0, y1 - y0, GROUP.r * k, z ? z.fill : T.bg, z ? z.stroke : T[`side${ctx.side}`], GROUP.sw * k));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, label: g.label, nodes: g.nodes, zone: z };
  });

  // A label takes its colour from what lies under it, so it passes on that ground.
  const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const groundAt = (x, y) => [...bands, ...groupOut].find(r => r.zone && inRect(r, x, y))?.zone ?? sideStyle;

  // Arrows. Neighbours get straight lines (pairs side by side); the rest go through route(): Ls, or round a gutter for
  // retries and back edges (the target first appears in an earlier step, and the step isn't half of a pair).
  const pairs = pairSteps(panel.steps), arrows = [], pairRoutes = new Map();
  const obstacles = nodes.flatMap(n => [n.iconBox, ...n.labelBoxes].map(b => ({ id: n.id, ...b })));
  const gutters = { xs: [frame.x + INNER / 2 * k, ...Array.from({ length: cols - 1 }, (_, c) => inner.x + (c + 1) * cellW), frame.x + frame.w - INNER / 2 * k], ys: [] };
  const order = new Map();
  panel.steps.forEach((s, i) => { for (const id of [s.from, s.to]) if (!order.has(id)) order.set(id, i); });
  panel.steps.forEach((s, i) => {
    const a = placed.get(s.from), b = placed.get(s.to), role = pairs[i].role, kind = s.kind ?? 'normal';
    const [ca, ra] = a.cell, [cb, rb] = b.cell, id = `${prefix}s${i}`;
    const off = role === 'single' ? 0 : (role === 'request' ? -PAIR : PAIR) * k;
    // Straight when the two share a column or row, the line (and its pair partner) runs inside both icons, and no
    // other node is in the way (so a step may skip an empty cell). A stack's rows don't share columns, and an offset
    // can push a node out of line.
    const lineX = (a.cx + b.cx) / 2, lineY = (a.cy + b.cy) / 2, m4 = 4 * k + PAIR * k;
    const inX = (n, x) => x - m4 > n.iconBox.x && x + m4 < n.iconBox.x + n.iconBox.w, inY = (n, y) => y - m4 > n.iconBox.y && y + m4 < n.iconBox.y + n.iconBox.h;
    const others = obstacles.filter(o => o.id !== a.id && o.id !== b.id), clear = pts => !others.some(o => crosses(pts, o, (PAIR + CLEAR) * k));
    const vertical = (stack ? Math.abs(ra - rb) === 1 : ca === cb && ra !== rb) && inX(a, lineX) && inX(b, lineX) && clear([[lineX, a.cy], [lineX, b.cy]]);
    const horizontal = !stack && ra === rb && ca !== cb && inY(a, lineY) && inY(b, lineY) && clear([[a.cx, lineY], [b.cx, lineY]]);
    let points, lab;
    if (!vertical && !horizontal && role !== 'single' && kind !== 'retry' && panel.steps[pairs[i].partner].kind !== 'retry') {
      // A pair that can't run straight: two nested Ls, shared by both halves whichever comes first.
      const reqIndex = role === 'request' ? i : pairs[i].partner, req = panel.steps[reqIndex];
      if (!pairRoutes.has(reqIndex)) pairRoutes.set(reqIndex, routePair(placed.get(req.from), placed.get(req.to), obstacles, { step: req.n ?? null, stepId: `${prefix}s${reqIndex}`, k, prefer: stack ? 0 : null, pair: PAIR * k }));
      const both = pairRoutes.get(reqIndex);
      points = both[role];
      lab = bentLabel(points, bounds, walls, k, both[role === 'request' ? 'reply' : 'request']);
    } else if (!vertical && !horizontal) {
      const back = role === 'single' && order.get(s.to) < order.get(s.from);
      points = route(a, b, kind, obstacles, gutters, { back, step: s.n ?? null, stepId: id, k, prefer: stack ? 0 : null });
      lab = bentLabel(points, bounds, walls, k);
    } else if (vertical) {
      const x = (a.cx + b.cx) / 2 + off, down = rb > ra;
      const y0 = down ? a.box.y + a.box.h + END * k : a.box.y - END * k, y1 = down ? b.box.y - END * k : b.box.y + b.box.h + END * k;
      points = [[x, y0], [x, y1]];
      const my = (y0 + y1) / 2, side = role === 'request' ? 'left' : 'right', lx = side === 'left' ? x - LABEL.side * k : x + LABEL.side * k;
      lab = { x: lx, y: my, side, grow: 'both' };
    } else {
      const yl = (a.cy + b.cy) / 2 + off, right = cb > ca;
      const x0 = right ? edgeX(a, yl, 1) + END * k : edgeX(a, yl, -1) - END * k, x1 = right ? edgeX(b, yl, -1) - END * k : edgeX(b, yl, 1) + END * k;
      points = [[x0, yl], [x1, yl]];
      const below = role === 'reply';
      lab = { x: (x0 + x1) / 2, y: below ? yl + LABEL.below * k : yl - LABEL.above * k, side: 'center', grow: below ? 'down' : 'up' };
    }
    const short = isShort(s, role);
    let labelId = null;
    if (s.label) {
      const [fillTok, weight] = labelStyle(s);
      labelId = scene.label({ n: s.n, text: s.label, x: lab.x, y: lab.y, side: lab.side, grow: lab.grow,
        maxWidth: room(lab.x, lab.y, lab.side, bounds, walls, k), fill: groundAt(lab.x, lab.y)?.[fillTok] ?? T[fillTok], weight, owner: id, panel: prefix });
    }
    scene.arrow(id, points, { short, kind, owner: id, labelId });
    walls.push(...segmentBoxes(points));
    arrows.push({ id, step: i, points, kind, short, labelId, from: s.from, to: s.to });
  });

  // Group titles: top-right inside the rect, or top-left when an arrow crosses the right-hand spot.
  groupOut.forEach((g, gi) => {
    const [size, weight] = TYPE.group, ls = 1.4 * k;
    const t = scene.at('groups', () => scene.text(0, g.y + GROUP.ty * k, g.label, { size: size * k, weight, fill: g.zone?.text ?? T.groupText, anchor: 'start', ls, role: 'group', owner: `${prefix}group${gi}` }));
    const w = t.getBBox().width, h = t.getBBox().height, ty = t.getBBox().y;
    const spot = x => ({ x, y: ty, w, h });
    let box = spot(g.x + g.w - GROUP.tx * k - w);
    if (arrows.some(a => crosses(a.points, box, 4 * k))) {
      const left = spot(g.x + GROUP.tx * k);
      if (!arrows.some(a => crosses(a.points, left, 4 * k))) box = left;
    }
    t.setAttribute('x', +box.x.toFixed(3));
    g.title = box;
  });

  return { nodes, arrows, groups: groupOut, bands, cellW, cellH, inner, prefix, spare };
}
