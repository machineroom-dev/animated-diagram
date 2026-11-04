// check-geom.js — the layout check, in SVG user units: text inside the card and its panel, nothing lying on anything
// else, no empty band taller than a row, no text under the feed-reading minimum.
//   checkGeometry(composition, canvas, k, scene) -> { code, ids, detail }[]
// ids name what to fix: a node's id, a step's arrow id (s<index>, prefixed A-/B- in a comparison), a panel.
import { crosses } from './route.js';

const TOL = 2;                                  // overlaps up to 2 px are anti-aliasing, not collisions
const MIN_TEXT = 13, CANVAS_INSET = 16, PANEL_INSET = 12;

const bbox = el => { const b = el.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
const inside = (b, f, m) => b.x >= f.x + m - 0.5 && b.y >= f.y + m - 0.5 && b.x + b.w <= f.x + f.w - m + 0.5 && b.y + b.h <= f.y + f.h - m + 0.5;
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > TOL;
const shrink = (b, d) => ({ x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d });
const px = v => `${Math.round(v)}px`;

export function checkGeometry(composition, canvas, k, scene) {
  const out = [], fail = (code, ids, detail) => out.push({ code, ids, detail });
  const panels = composition.panels.map((p, i) => ({ ...p, index: i, prefix: p.layout.prefix ?? '', name: p.layout.prefix ? p.layout.prefix.slice(0, -1) : 'main' }));
  const panelOf = owner => panels.find(p => p.prefix && owner?.startsWith(p.prefix)) ?? (panels.length === 1 ? panels[0] : null);

  // Every piece of text: node names and the rest from scene.texts, step labels (badge included) from scene.labels.
  const items = [];
  for (const t of scene.texts) {
    const inPanel = !['title', 'subtitle', 'brand'].includes(t.role);
    items.push({ owner: t.owner, what: t.role === 'group' ? `the group title "${t.el.textContent}"` : `"${t.el.textContent}"`, box: bbox(t.el), size: t.size, panel: inPanel ? panelOf(t.owner) : null, step: false });
  }
  for (const L of scene.labels) if (L.box) items.push({ owner: L.owner, what: `the label "${L.text}"`, box: L.box, size: L.size, panel: panelOf(L.owner), step: true });

  const nodes = panels.flatMap(p => p.layout.nodes.map(n => ({ ...n, pid: p.prefix + n.id, panel: p })));
  const arrows = panels.flatMap(p => p.layout.arrows.map(a => ({ ...a, panel: p, ends: [p.prefix + a.from, p.prefix + a.to] })));
  const W = canvas.w, H = canvas.h, minText = canvas.minText ?? MIN_TEXT * k;

  for (const it of items) {
    if (it.size < minText - 1e-6) fail('TEXT_TOO_SMALL', [it.owner], `${it.what} is ${it.size.toFixed(1)}px; text must be at least ${px(minText)} to read in a feed`);
    if (!inside(it.box, { x: 0, y: 0, w: W, h: H }, CANVAS_INSET * k)) fail('TEXT_OUT_OF_CANVAS', [it.owner], `${it.what} runs off the card (it must stay ${px(CANVAS_INSET * k)} inside the edge) — shorten it or move its node`);
    if (it.panel && !inside(it.box, it.panel.frame, PANEL_INSET * k)) fail('TEXT_OUT_OF_PANEL', [it.owner], `${it.what} runs outside panel ${it.panel.name} — shorten it or move its node`);
  }

  // The headline must fit the card: it starts at the panel's left edge and may run to its right edge.
  const head = composition.header;
  if (head?.title) {
    const b = bbox(head.title), room = head.right - b.x;
    if (b.w > room + 0.5) fail('TITLE_TOO_WIDE', ['header'], `the headline "${head.title.textContent}" is ${px(b.w)} wide but the card holds ${px(room)} — shorten it`);
  }

  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.owner !== b.owner && overlap(a.box, b.box)) fail('LABEL_OVERLAP', [a.owner, b.owner], `${a.what} overlaps ${b.what}`);
  }

  for (const it of items) {
    if (!it.panel) continue;
    for (const n of nodes) if (n.pid !== it.owner && overlap(it.box, n.iconBox)) fail('LABEL_ON_ICON', [it.owner, n.pid], `${it.what} lies on node "${n.pid}"`);
    for (const a of arrows) if (a.id !== it.owner && crosses(a.points, shrink(it.box, 1))) fail('LABEL_ON_ARROW', [it.owner, a.id], `${it.what} crosses the arrow of ${a.id}`);
  }

  for (const a of arrows) for (const n of nodes) {
    if (a.ends.includes(n.pid)) continue;
    if ([n.iconBox, ...n.labelBoxes].some(b => crosses(a.points, shrink(b, 1)))) fail('ARROW_THROUGH_NODE', [a.id, n.pid], `the arrow of ${a.id} runs through node "${n.pid}" — move a cell so it can go round`);
  }

  // Two arrows on one line read as one: any stretch of 16 px or more, within 3 px of each other.
  const legs = a => a.points.slice(1).map((q, i) => [a.points[i], q]);
  const span = (p, q, r, s) => Math.max(0, Math.min(Math.max(p, q), Math.max(r, s)) - Math.max(Math.min(p, q), Math.min(r, s)));
  const sharedRun = (A, B) => legs(A).reduce((sum, [p, q]) => sum + legs(B).reduce((run, [r, s]) => {
    if (p[0] === q[0] && r[0] === s[0] && Math.abs(p[0] - r[0]) <= 3 * k) return run + span(p[1], q[1], r[1], s[1]);
    if (p[1] === q[1] && r[1] === s[1] && Math.abs(p[1] - r[1]) <= 3 * k) return run + span(p[0], q[0], r[0], s[0]);
    return run;
  }, 0), 0);
  for (let i = 0; i < arrows.length; i++) for (let j = i + 1; j < arrows.length; j++) {
    const [a, b] = [arrows[i], arrows[j]];
    if (a.panel !== b.panel) continue;
    const run = sharedRun(a, b);
    if (run >= 16 * k) fail('ARROW_OVERLAP', [a.id, b.id], `the arrows of ${a.id} and ${b.id} run on one line for ${px(run)}: move a cell so each has its own path`);
  }

  // Rows that don't fit: the row gaps would go negative and the rows would lie on each other.
  for (const p of panels) if (p.layout.spare < -0.5) fail('ROWS_TOO_TALL', [p.name], `panel ${p.name}: its rows need ${px(-p.layout.spare)} more than it has — use fewer rows, or drop sub-labels`);

  // A map's legend has to fit its rail.
  for (const p of panels) if (p.layout.legend?.overflow > 0) fail('LEGEND_OVERFLOW', [p.name], `the legend needs ${px(p.layout.legend.overflow)} more than its rail has — merge some steps or shorten their labels`);

  // A map's routes must read as routes: few bends, no long way round, few crossings. A layout that routes freely says so
  // by giving its limits; nothing else measures spaghetti.
  for (const p of panels) {
    const limit = p.layout.routing;
    if (!limit) continue;
    const mine = arrows.filter(a => a.panel === p);
    for (const a of mine) {
      const bends = a.points.length - 2, [s, e] = [a.points[0], a.points.at(-1)], direct = Math.abs(s[0] - e[0]) + Math.abs(s[1] - e[1]);
      const long = a.points.slice(1).reduce((sum, q, i) => sum + Math.abs(q[0] - a.points[i][0]) + Math.abs(q[1] - a.points[i][1]), 0);
      if (bends > limit.bends) fail('ARROW_TANGLE', [a.id], `the arrow of ${a.id} ("${a.from}" → "${a.to}") has ${bends} bends — move its ends closer`);
      else if (long > Math.max(limit.detour * direct, limit.floor * k)) fail('ARROW_TANGLE', [a.id], `the arrow of ${a.id} ("${a.from}" → "${a.to}") runs ${px(long)} to cover ${px(direct)} — move its ends closer`);
    }
    let crossings = 0;
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) for (const [p0, q0] of legs(mine[i])) for (const [r0, s0] of legs(mine[j])) {
      const pv = p0[0] === q0[0], rv = r0[0] === s0[0];
      if (pv === rv) continue;
      const [vx, v0, v1, hy, h0, h1] = pv ? [p0[0], p0[1], q0[1], r0[1], r0[0], s0[0]] : [r0[0], r0[1], s0[1], p0[1], p0[0], q0[0]];
      if (hy > Math.min(v0, v1) && hy < Math.max(v0, v1) && vx > Math.min(h0, h1) && vx < Math.max(h0, h1)) crossings++;
    }
    if (crossings > Math.max(limit.crossings, Math.ceil(limit.crossingShare * mine.length))) fail('ARROW_TANGLE', [p.name], `${crossings} arrows cross in panel ${p.name} — rearrange the cells so hubs sit beside what they talk to`);
  }

  // Empty bands: the panel's inner height minus everything drawn in it (nodes, labels, arrows, titles).
  for (const p of panels) {
    const { inner, cellH } = p.layout, spans = [];
    for (const n of nodes.filter(n => n.panel === p)) spans.push([n.box.y, n.box.y + n.box.h]);
    for (const it of items.filter(it => it.panel === p && !/^legend\d*$/.test(it.owner))) spans.push([it.box.y, it.box.y + it.box.h]);     // a legend beside the map doesn't fill it
    for (const a of arrows.filter(a => a.panel === p)) { const ys = a.points.map(q => q[1]); spans.push([Math.min(...ys), Math.max(...ys)]); }
    spans.sort((s, t) => s[0] - t[0]);
    let y = inner.y;
    for (const [s0, y1] of [...spans, [inner.y + inner.h, inner.y + inner.h]]) {
      const y0 = Math.min(s0, inner.y + inner.h);
      if (y0 - y > cellH + 0.5) fail('EMPTY_BAND', [p.name], `panel ${p.name}: ${px(y0 - y)} with nothing in it (y ${Math.round(y)}–${Math.round(y0)}), taller than a row (${px(cellH)}) — use fewer rows or fill them`);
      y = Math.max(y, y1);
    }
  }
  return out;
}
