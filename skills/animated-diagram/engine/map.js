// map.js — the dense layout: colour zones, many small nodes, routed arrows, a numbered badge on each line and the words
// in a legend rail. Returns what layoutPanel returns, so the layout check needs no special case.
//   layoutMap(panel, frame, ctx) -> { nodes, arrows, groups, bands, cellW, cellH, inner, prefix, spare, legend, routing }
import { measureNode, drawNode, probe, fit } from './nodes.js';
import { TYPE, BADGE_R, LINE_STEP } from './engine.js';
import { routeMap } from './orth.js';
import { crosses } from './route.js';
import { rowTracks, assignZones, pairSteps, isShort } from './grid.js';

const METRICS = { iconScale: 0.72, name: [20, 640], sub: [15, 450], box: [18, 640], nameGap: 20, subGap: 19, pad: 30 };
const ZONE = { inset: 5, top: 32, bottom: 8, r: 16, sw: 2, tx: 14, ty: 22 };
const RAIL = { w: 300, pad: 24, head: 30, row: 8, type: [18, 500], headType: TYPE.group };
const INNER = 16;                                     // the map's margin inside the panel
const ROUTE_MARGIN = 12;                              // routes may run this far outside the cells
export const ROUTING = { bends: 4, detour: 2.5, floor: 420, crossings: 3, crossingShare: 0.25 };
const LEGEND_FONT = 18;

// The legend's rows, measured now because the rail's size decides the map's. The steps are in number order.
function planLegend(scene, steps, frame, k) {
  const rows = steps.filter(s => s.n !== undefined).sort((a, b) => a.n - b.n);
  const landscape = frame.w > frame.h, pad = RAIL.pad * k, r = BADGE_R * k, gap = 8 * k, col = landscape ? RAIL.w * k : (frame.w - 3 * pad) / 2;
  const p = probe(scene, RAIL.type, k), textW = col - (landscape ? 2 * pad : 0) - 2 * r - gap, step = LINE_STEP * LEGEND_FONT * k;
  const planned = rows.map(s => { const lines = fit(s.label, p, textW).lines.length; return { step: s, h: Math.max(2 * r, lines * step) + RAIL.row * k }; });
  p.done();
  return { rows: planned, landscape, pad, col, head: RAIL.head * k };
}

function drawLegend(scene, plan, frame, k, prefix) {
  const T = scene.T, { rows, landscape, pad, col, head } = plan, [hs, hw] = RAIL.headType;
  const stack = (list, x, y) => { let at = y; for (const row of list) { const mid = at + row.h / 2; scene.label({ n: row.step.n, text: row.step.label, x, y: mid, side: 'right', grow: 'both', maxWidth: col - (landscape ? 2 * pad : 0), fill: T.ink, weight: RAIL.type[1], size: LEGEND_FONT, owner: `legend${row.step.n}`, panel: prefix }); at += row.h; } return at - y; };
  if (landscape) {
    const x = frame.x + frame.w - RAIL.w * k, avail = frame.h - 2 * pad - head, total = rows.reduce((s, row) => s + row.h, 0), spread = Math.min(Math.max(0, (avail - total) / Math.max(1, rows.length)), 12 * k);
    scene.at('groups', () => {
      scene.rect(x, frame.y + pad, 1.5 * k, frame.h - 2 * pad, 0, T.panelStroke);
      scene.text(x + pad, frame.y + pad + hs * k * 0.8, 'STEPS', { size: hs * k, weight: hw, fill: T.groupText, anchor: 'start', ls: 1.4 * k, role: 'group', owner: 'legend' });
    });
    const padded = rows.map(row => ({ ...row, h: row.h + spread }));
    stack(padded, x + pad, frame.y + pad + head);
    return Math.max(0, total - avail);
  }
  const half = Math.ceil(rows.length / 2), railH = railHeight(plan), y = frame.y + frame.h - railH;
  scene.at('groups', () => scene.rect(frame.x + pad, y, frame.w - 2 * pad, 1.5 * k, 0, T.panelStroke));
  stack(rows.slice(0, half), frame.x + pad, y + pad);
  stack(rows.slice(half), frame.x + 2 * pad + col, y + pad);
  return 0;
}

const railHeight = plan => {
  const half = Math.ceil(plan.rows.length / 2), sum = list => list.reduce((s, row) => s + row.h, 0);
  return plan.pad * 2 + Math.max(sum(plan.rows.slice(0, half)), sum(plan.rows.slice(half)));
};

// Where a step's number goes: on the longest clear stretch of its own line, off any zone's border if it can be; else just
// beside the line if the line is short.
function placeBadge(points, clearOf, offBorders, k) {
  const r = BADGE_R * k, room = r + 3 * k, head = 16 * k;
  const segs = points.slice(1).map((q, i) => ({ p: points[i], q, last: i === points.length - 2 })).map(g => ({ ...g, len: Math.hypot(g.q[0] - g.p[0], g.q[1] - g.p[1]) })).sort((a, b) => b.len - a.len);
  const boxAt = (x, y) => ({ x: x - room, y: y - room, w: 2 * room, h: 2 * room });
  const ok = (x, y) => clearOf(boxAt(x, y));
  for (const strict of [true, false]) for (const s of segs) {
    const usable = s.len - 2 * room - (s.last ? head : 0);
    if (usable < 0) continue;
    for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const d = room + t * usable, ux = (s.q[0] - s.p[0]) / s.len, uy = (s.q[1] - s.p[1]) / s.len, x = s.p[0] + ux * d, y = s.p[1] + uy * d;
      if (ok(x, y) && (!strict || offBorders(boxAt(x, y)))) return [x, y];
    }
  }
  for (const s of segs) {
    const ux = (s.q[0] - s.p[0]) / s.len, uy = (s.q[1] - s.p[1]) / s.len, mx = (s.p[0] + s.q[0]) / 2, my = (s.p[1] + s.q[1]) / 2;
    for (const side of [1, -1]) { const off = side * (r + 6 * k), x = mx - uy * off, y = my + ux * off; if (ok(x, y)) return [x, y]; }
  }
  const s = segs[0];
  return [(s.p[0] + s.q[0]) / 2, (s.p[1] + s.q[1]) / 2];
}

export function layoutMap(panel, frame, ctx) {
  const { scene, k } = ctx, prefix = ctx.prefix ?? '', { cols, rows } = panel.grid;
  const legendPlan = planLegend(scene, panel.steps, frame, k), m = INNER * k;
  const inner = legendPlan.landscape
    ? { x: frame.x + m, y: frame.y + m, w: frame.w - RAIL.w * k - 2 * m, h: frame.h - 2 * m }
    : { x: frame.x + m, y: frame.y + m, w: frame.w - 2 * m, h: frame.h - railHeight(legendPlan) - 2 * m };
  const cellW = inner.w / cols, cellH = inner.h / rows, nctx = { ...ctx, cellW, cellH, metrics: METRICS };
  const byId = new Map(panel.nodes.map(n => [n.id, n])), groups = (panel.groups ?? []).map(g => ({ ...g, cells: g.nodes.map(id => byId.get(id).cell) }));
  const zones = assignZones(scene, groups);

  // A zone's title and padding push its top and bottom rows apart from their neighbours.
  const extraTop = new Map(), extraBottom = new Map();
  groups.forEach(g => {
    const top = Math.min(...g.cells.map(c => c[1])), bottom = Math.max(...g.cells.map(c => c[1]));
    for (const n of panel.nodes) {
      if (!g.nodes.includes(n.id)) continue;
      if (n.cell[1] === top) extraTop.set(n.id, ZONE.top * k);
      if (n.cell[1] === bottom) extraBottom.set(n.id, ZONE.bottom * k);
    }
  });
  const measured = new Map(panel.nodes.map(n => [n.id, measureNode(n, nctx)]));
  const { up, down, spare, rowY } = rowTracks(panel.nodes, rows, measured, extraTop, extraBottom, inner);

  const zoneOut = groups.map((g, i) => {
    const z = zones[i], cs = g.cells.map(c => c[0]), rs = g.cells.map(c => c[1]), c0 = Math.min(...cs), c1 = Math.max(...cs), r0 = Math.min(...rs), r1 = Math.max(...rs), inset = ZONE.inset * k;
    const x = inner.x + c0 * cellW + inset, w = (c1 - c0 + 1) * cellW - 2 * inset, y = rowY[r0] - up[r0], h = rowY[r1] + down[r1] - y;
    scene.at('groups', () => scene.rect(x, y, w, h, ZONE.r * k, z.fill, z.stroke, ZONE.sw * k));
    const [size, weight] = TYPE.group;
    const t = scene.at('groups', () => scene.text(x + ZONE.tx * k, y + ZONE.ty * k, g.label, { size: size * k, weight, fill: z.text, anchor: 'start', ls: 1.4 * k, role: 'group', owner: `${prefix}group${i}` }));
    const b = t.getBBox();
    return { id: g.id ?? `group${i}`, x, y, w, h, label: g.label, nodes: g.nodes, zone: z, title: { x: b.x, y: b.y, w: b.width, h: b.height }, members: g.nodes };
  });
  const styleOf = new Map();
  zoneOut.forEach(z => { for (const id of z.nodes) styleOf.set(id, z.zone); });

  const nodes = panel.nodes.map(n => {
    const [dx, dy] = n.offset ?? [0, 0], cx = inner.x + (n.cell[0] + 0.5) * cellW + dx * k, cy = rowY[n.cell[1]] + dy * k;
    return { id: n.id, cx, cy, cell: n.cell, ...drawNode(scene, n, cx, cy, { ...nctx, style: styleOf.get(n.id) }) };
  });
  const legendOverflow = drawLegend(scene, legendPlan, frame, k, prefix);

  // Routes, then what's drawn on them. A step with nowhere to go is reported with the rest of the failures, as a flow-grid's is.
  const steps = panel.steps.map((s, i) => ({ id: `${prefix}s${i}`, from: s.from, to: s.to, n: s.n }));
  const out = { nodes, arrows: [], groups: zoneOut, bands: [], cellW, cellH, inner, prefix, spare, legend: { overflow: legendOverflow }, routing: ROUTING };
  const bounds = { x: inner.x - ROUTE_MARGIN * k, y: inner.y - ROUTE_MARGIN * k, w: inner.w + 2 * ROUTE_MARGIN * k, h: inner.h + 2 * ROUTE_MARGIN * k };
  const { routes } = routeMap({ nodes, zones: zoneOut, steps, bounds, k });
  const pairs = pairSteps(panel.steps), colourOf = id => (id.startsWith('zone:') ? zoneOut.find(z => z.id === id.slice(5))?.zone : styleOf.get(id))?.text;
  panel.steps.forEach((s, i) => {
    const kind = s.kind ?? 'normal', id = `${prefix}s${i}`, plain = kind === 'normal' || kind === 'solid';
    scene.arrow(id, routes[i], { short: isShort(s, pairs[i].role), kind, owner: id, radius: 8, colour: plain ? colourOf(s.from) : undefined });
    out.arrows.push({ id, step: i, points: routes[i], kind, short: isShort(s, pairs[i].role), labelId: null, from: s.from, to: s.to });
  });
  const parts = nodes.flatMap(n => [n.iconBox, ...n.labelBoxes]), titles = zoneOut.map(z => z.title), placed = [];
  panel.steps.forEach((s, i) => {
    if (s.n === undefined) return;
    const others = out.arrows.filter(a => a.step !== i);
    const clearOf = b => !parts.some(o => boxesTouch(o, b)) && !titles.some(o => boxesTouch(o, b)) && !placed.some(o => boxesTouch(o, b)) && !others.some(a => crosses(a.points, b));
    const offBorders = b => !zoneOut.some(z => boxesTouch(z, b) && !(b.x >= z.x && b.y >= z.y && b.x + b.w <= z.x + z.w && b.y + b.h <= z.y + z.h));
    const [x, y] = placeBadge(routes[i], clearOf, offBorders, k), R = BADGE_R * k;
    scene.badge(s.n, x, y, `${prefix}s${i}`, prefix);
    placed.push({ x: x - R, y: y - R, w: 2 * R, h: 2 * R });
  });
  return out;
}

const boxesTouch = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
