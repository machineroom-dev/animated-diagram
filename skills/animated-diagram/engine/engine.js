// engine.js — the scene: SVG primitives, marching arrows, measured badge labels, icons, and seek(f).
// Every px value is at canvas width 1080 and is multiplied by k = canvas width / 1080.
import { ICONS } from './icons/index.js';
import { applyStyle } from './styles.js';

export const FRAMES = 90;
export const PL = 30.70, PS = 15.35;          // dash periods: long (requests), short (replies, retries)
export const DL = 15, DS = 7.1;               // dash lengths
export const V = 8 * PL / FRAMES;             // 8 long periods per loop, so the march is seamless
export const ARM = 10, CORNER_R = 11.5, BADGE_R = 15.5;
export const TYPE = {                         // size / weight at 1080 wide
  title: [38, 780], name: [25, 640], sub: [15.5, 450], step: [17.5, 520], badge: [16.5, 650], group: [15, 760],
  box: [19, 640], trayTitle: [20, 650], caption: [13.5, 430], footer: [20, 560], vs: [44, 740],
};
export const LINE_STEP = 1.26;                // two-line labels: baseline step = 1.26 × size

const NS = 'http://www.w3.org/2000/svg';
const num = v => +(+v).toFixed(3);
const KIND = { normal: ['line', false, true], hit: ['hit', false, true], miss: ['miss', false, true], retry: ['miss', true, true], solid: ['line', false, false] };

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [a, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(a, typeof v === 'number' ? num(v) : v);
  parent?.appendChild(e);
  return e;
}

// A polyline with every inner corner rounded by an arc of radius r (clamped to half the shorter neighbouring segment).
// Returns the path data and its exact length.
export function roundedPath(points, r) {
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i], len = Math.hypot(x1 - x0, y1 - y0);
    if (len > 1e-9) segs.push({ x0, y0, x1, y1, len, ux: (x1 - x0) / len, uy: (y1 - y0) / len });
  }
  if (!segs.length) throw new Error('arrow: needs two distinct points');
  let d = `M${num(segs[0].x0)},${num(segs[0].y0)}`, L = 0, cut = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], n = segs[i + 1];
    if (!n) { d += ` L${num(s.x1)},${num(s.y1)}`; L += s.len - cut; break; }
    const cross = s.ux * n.uy - s.uy * n.ux, dot = s.ux * n.ux + s.uy * n.uy, th = Math.atan2(Math.abs(cross), dot);
    if (th < 1e-6) { L += s.len - cut; cut = 0; continue; }                     // collinear: no corner
    const rr = Math.min(r, (Math.min(s.len - cut, n.len / 2)) / Math.tan(th / 2)), t = rr * Math.tan(th / 2);
    const ax = s.x1 - s.ux * t, ay = s.y1 - s.uy * t, bx = s.x1 + n.ux * t, by = s.y1 + n.uy * t;
    d += ` L${num(ax)},${num(ay)} A${num(rr)},${num(rr)} 0 0 ${cross > 0 ? 1 : 0} ${num(bx)},${num(by)}`;
    L += s.len - cut - t + rr * th;
    cut = t;
  }
  return { d, L };
}

// Two lines from one, split at the space that balances the measured widths best (ties: nearest the middle).
// Returns null when the text has no space.
export function splitTwo(text, measure) {
  const mid = text.length / 2;
  let best = null;
  for (const m of text.matchAll(/ /g)) {
    const at = m.index, wider = Math.max(measure(text.slice(0, at)), measure(text.slice(at + 1)));
    if (!best || wider < best.wider - 1e-6 || (Math.abs(wider - best.wider) < 1e-6 && Math.abs(at - mid) < Math.abs(best.at - mid))) best = { at, wider };
  }
  return best ? [text.slice(0, best.at), text.slice(best.at + 1)] : null;
}

export class Scene {
  constructor(svgEl, theme, k, opts = {}) {
    this.svg = svgEl; this.theme = theme; this.T = theme.colors; this.k = k;
    this.style = opts.style ?? theme.style ?? 'filled';
    this.icons = { ...ICONS, ...(opts.localIcons ?? {}) };              // a project's own icon wins over the library's
    this.marching = []; this.placed = []; this.labels = []; this.texts = []; this.arrows = [];
    svgEl.setAttribute('font-family', `'${theme.font.family}', sans-serif`);
    this.layers = {};
    for (const name of ['back', 'groups', 'arrows', 'nodes', 'labels']) this.layers[name] = el('g', { 'data-layer': name }, svgEl);
    this.cur = 'back';
  }

  // Runs fn with rect() and text() drawing into the named layer.
  at(layer, fn) { const was = this.cur; this.cur = layer; try { return fn(); } finally { this.cur = was; } }

  rect(x, y, w, h, r, fill, stroke, sw) {
    return el('rect', { x, y, width: w, height: h, rx: r, fill, stroke, 'stroke-width': stroke ? sw : undefined }, this.layers[this.cur]);
  }

  text(x, y, str, { size, weight, fill, anchor = 'middle', id, ls, role = 'text', owner } = {}) {
    const t = el('text', { id, x, y, 'text-anchor': anchor, 'font-size': size, 'font-weight': weight, fill: fill ?? this.T.ink, 'letter-spacing': ls }, this.layers[this.cur]);
    t.textContent = String(str);
    this.texts.push({ el: t, role, size, owner });
    return t;
  }

  // A numbered badge plus its text. Placement waits for layoutLabels(), which measures with the real font.
  // grow: where a second line goes — 'both' keeps the lines centred on y, 'up' keeps the last line on y, 'down' the first.
  label({ n, text, x, y, side = 'center', grow = 'both', maxWidth = Infinity, fill, weight, size, owner, panel }) {
    const k = this.k, id = `lab${this.labels.length}`;
    const g = el('g', { id }, this.layers.labels);
    if (n !== undefined && n !== null) {
      el('circle', { r: BADGE_R * k, fill: this.T.badge }, g);
      const b = el('text', { class: 'bd', 'text-anchor': 'middle', 'font-size': TYPE.badge[0] * k, 'font-weight': TYPE.badge[1], fill: this.T.badgeText }, g);
      b.textContent = String(n);
    }
    const sz = (size ?? TYPE.step[0]) * k;
    const tx = el('text', { class: 'tx', 'font-size': sz, 'font-weight': weight ?? TYPE.step[1], fill: fill ?? this.T.ink }, g);
    tx.textContent = String(text);
    const L = { id, g, n, text: String(text), x, y, side, grow, maxWidth, size: sz, badge: n !== undefined && n !== null, owner, panel, lines: 1, box: null };
    this.labels.push(L);
    return id;
  }

  async layoutLabels() {
    await document.fonts.ready;
    const k = this.k, r = BADGE_R * k, gap = 8 * k;
    for (const L of this.labels) {
      const tx = L.g.querySelector('.tx');
      tx.textContent = L.text;
      let lines = [L.text];
      const room = L.maxWidth - (L.badge ? 2 * r + gap : 0);                  // maxWidth holds the badge and the text
      if (tx.getComputedTextLength() > room) lines = splitTwo(L.text, s => { tx.textContent = s; return tx.getComputedTextLength(); }) ?? lines;
      tx.textContent = '';
      const step = LINE_STEP * L.size, base = 0.36 * L.size;                // baseline that centres a line on y
      const shift = (lines.length - 1) * step / 2 * (L.grow === 'up' ? -1 : L.grow === 'down' ? 1 : 0);
      const spans = lines.map((s, i) => { const t = el('tspan', { y: base + shift + (i - (lines.length - 1) / 2) * step }, tx); t.textContent = s; return t; });
      const widths = spans.map(s => s.getComputedTextLength()), tw = Math.max(...widths);
      const bw = L.badge ? 2 * r + gap : 0, total = bw + tw;
      const x0 = L.side === 'left' ? L.x - total : L.side === 'right' ? L.x : L.x - total / 2;
      L.g.setAttribute('transform', `translate(${num(x0)} ${num(L.y)})`);
      if (L.badge) { L.g.querySelector('circle').setAttribute('cx', num(r)); const b = L.g.querySelector('.bd'); b.setAttribute('x', num(r)); b.setAttribute('y', num(0.36 * TYPE.badge[0] * k)); }
      spans.forEach((s, i) => s.setAttribute('x', num(L.side === 'left' && !L.badge ? total - widths[i] : bw)));
      const bb = L.g.getBBox();
      L.lines = lines.length; L.widths = widths; L.overflow = total > L.maxWidth + 0.5;
      L.box = { x: x0 + bb.x, y: L.y + bb.y, w: bb.width, h: bb.height };
    }
  }

  // A marching arrow along points, with a 45° open chevron at the end.
  arrow(id, points, { short = false, kind = 'normal', owner, labelId } = {}) {
    if (!KIND[kind]) throw new Error(`arrow ${id}: unknown kind "${kind}"`);
    const [token, forceShort, marches] = KIND[kind], k = this.k, sw = (this.theme.lineWeight ?? 2.6) * k;
    const col = this.T[token], isShort = short || forceShort;
    const { d, L } = roundedPath(points, CORNER_R * k);
    const g = el('g', { 'data-arrow': id }, this.layers.arrows);
    const path = el('path', { id, d, fill: 'none', stroke: col, 'stroke-width': sw }, g);
    if (marches) {
      const P = (isShort ? PS : PL) * k, D = (isShort ? DS : DL) * k;
      const off0 = -((L - D) % P);                                             // a dash ends exactly at the head at f0
      path.setAttribute('stroke-dasharray', `${num(D)} ${num(P - D)}`);
      path.setAttribute('stroke-dashoffset', num(off0));
      this.marching.push({ el: path, off0, L, P, D });
    }
    const [xa, ya] = points[points.length - 2], [x1, y1] = points[points.length - 1];
    const len = Math.hypot(x1 - xa, y1 - ya), ux = (x1 - xa) / len, uy = (y1 - ya) / len, px = -uy, py = ux, a = ARM * k;
    el('polyline', { points: `${num(x1 - ux * a + px * a)},${num(y1 - uy * a + py * a)} ${num(x1)},${num(y1)} ${num(x1 - ux * a - px * a)},${num(y1 - uy * a - py * a)}`,
      fill: 'none', stroke: col, 'stroke-width': sw, 'stroke-linejoin': 'miter' }, g);
    this.arrows.push({ id, points, kind, short: isShort, L, owner, labelId });
    return path;
  }

  // A library icon at (cx, cy). Copies of one icon share their loop, so they move in unison.
  icon(name, id, cx, cy, scale) {
    const mod = this.icons[name];
    if (!mod) throw new Error(`icon "${name}" is not in the library`);
    const g = el('g', { transform: `translate(${num(cx)} ${num(cy)}) scale(${num(scale)})`, 'data-icon': name }, this.layers.nodes);
    g.innerHTML = mod.draw(id, this.T);
    applyStyle(g, this.style, this.T);
    this.placed.push({ mod, id, g, name, cx, cy, scale });
    return g;
  }

  seek(f) {
    const v = V * this.k;
    for (const m of this.marching) m.el.setAttribute('stroke-dashoffset', num(m.off0 - v * f));
    for (const p of this.placed) p.mod.loop(p.id, f, this.T);
  }
}
