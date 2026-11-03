// nodes.js — the three node types. icon: a library icon with a name and a sub-label; text: a rounded box holding a
// name; tray: a titled box of small captioned icons. measureNode() sizes a node before placement, drawNode() draws it.
//   (cx, cy) is the node's anchor: the icon centre for an icon node, the box centre for a text box or tray.
//   measureNode().ay is the anchor's distance below the block's top, so a layout can centre the whole block.
//   ctx = { scene, theme, k, cellW, cellH, side?: 'A' | 'B', prefix?: string (makes element ids unique per panel) }
import { TYPE, LINE_STEP, splitTwo } from './engine.js';

export const ICON_SCALE = 1.15, TRAY_SCALE = 0.42;
const NOMINAL = 100;                              // names hang from a nominal 100 px frame, so a row's names line up
const NAME = { gap: 30, sub: 24, pad: 24 };       // baseline below the frame; sub baseline below the name; cell − 24
const BOX = { pad: 48, min: 150, margin: 40, h1: 64, h2: 88, sw: 2.2, inset: 16 };
const TRAY = { pitch: 74, capPad: 10, pad: 16, title: 30, head: 44, row: 74, icon: 26, cap: 62, foot: 8, sw: 2.1 };
const NS = 'http://www.w3.org/2000/svg';
const num = v => +(+v).toFixed(3);

// A hidden <text> for measuring with the real font: width(str) and the font's ascent/descent at this size.
function probe(scene, [size, weight], k) {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('font-size', size * k); t.setAttribute('font-weight', weight); t.setAttribute('visibility', 'hidden');
  scene.svg.appendChild(t);
  t.textContent = 'Hg';
  const bb = t.getBBox(), asc = -bb.y, desc = bb.y + bb.height;
  const width = s => { t.textContent = s; return t.getComputedTextLength(); };
  return { width, asc, desc, done: () => t.remove() };
}

// One or two lines that fit maxW if they can; `over` when even two lines don't.
function fit(text, p, maxW) {
  let lines = [text];
  if (p.width(text) > maxW) lines = splitTwo(text, p.width) ?? lines;
  const widths = lines.map(p.width), w = Math.max(...widths);
  return { lines, widths, w, over: w > maxW + 0.5 };
}

const sideColours = (T, side) => side ? { tint: T[`side${side}Tint`], stroke: T[`side${side}`] } : { tint: T.tint, stroke: T.primary };

// The whole node relative to its anchor: the frame or icon, every text line, tray items, and the block's extent.
function plan(node, ctx) {
  const { scene, k, cellW } = ctx, type = node.type ?? 'icon', texts = [];
  let top, bottom, w, frame = null, icon = null, items = [], nameLines = 1, overflow = false;

  if (type === 'icon') {
    const mod = scene.icons[node.icon];
    if (!mod) throw new Error(`icon "${node.icon}" is not in the library`);
    const s = ICON_SCALE * k, [bw, bh] = mod.box, maxW = cellW - NAME.pad * k;
    icon = { x: -bw * s / 2, y: -bh * s / 2, w: bw * s, h: bh * s, scale: s };
    const pn = probe(scene, TYPE.name, k), name = fit(node.name, pn, maxW), step = LINE_STEP * TYPE.name[0] * k;
    const base = NOMINAL / 2 * ICON_SCALE * k + NAME.gap * k, ys = name.lines.map((_, i) => base + i * step);
    texts.push({ role: 'name', lines: name.lines, ys, font: TYPE.name, fill: 'ink' });
    nameLines = name.lines.length; overflow = name.over;
    top = Math.min(icon.y, base - pn.asc); bottom = Math.max(icon.y + icon.h, ys.at(-1) + pn.desc); w = Math.max(icon.w, name.w);
    pn.done();
    if (node.sub) {
      const ps = probe(scene, TYPE.sub, k), sw = ps.width(node.sub), y = ys.at(-1) + NAME.sub * k;
      texts.push({ role: 'sub', lines: [node.sub], ys: [y], font: TYPE.sub, fill: 'muted' });
      bottom = Math.max(bottom, y + ps.desc); w = Math.max(w, sw); overflow ||= sw > maxW + 0.5;
      ps.done();
    }
  } else if (type === 'text') {
    const p = probe(scene, TYPE.box, k), maxW = cellW - BOX.margin * k;
    let t = { lines: [node.name], widths: [p.width(node.name)] };
    t.w = t.widths[0];
    if (t.w + BOX.pad * k > maxW) t = fit(node.name, p, maxW - BOX.pad * k);
    w = Math.min(Math.max(t.w + BOX.pad * k, BOX.min * k), maxW);
    const h = (t.lines.length > 1 ? BOX.h2 : BOX.h1) * k, step = LINE_STEP * TYPE.box[0] * k, base = 0.36 * TYPE.box[0] * k;
    texts.push({ role: 'box', lines: t.lines, ys: t.lines.map((_, i) => base + (i - (t.lines.length - 1) / 2) * step), font: TYPE.box, fill: 'ink' });
    nameLines = t.lines.length; overflow = t.w > w - BOX.inset * k;
    top = -h / 2; bottom = h / 2;
    frame = { x: -w / 2, y: top, w, h, fill: 'tint', sw: BOX.sw * k };
    p.done();
  } else if (type === 'tray') {
    const n = node.items.length, rows = Math.ceil(n / 3), perRow = Math.ceil(n / rows);
    const pc = probe(scene, TYPE.caption, k), caps = node.items.map(it => pc.width(it.caption));
    const pitch = Math.max(TRAY.pitch * k, Math.max(...caps) + TRAY.capPad * k), itemsW = perRow * pitch, pad = TRAY.pad * k;
    const pt = probe(scene, TYPE.trayTitle, k), maxW = Math.max(itemsW + 2 * pad, cellW - BOX.margin * k);
    const title = fit(node.name, pt, maxW - 2 * pad), step = LINE_STEP * TYPE.trayTitle[0] * k;
    w = Math.max(itemsW, title.w) + 2 * pad;
    const head = TRAY.head * k + (title.lines.length - 1) * step, h = head + rows * TRAY.row * k + TRAY.foot * k;
    top = -h / 2; bottom = h / 2;
    texts.push({ role: 'trayTitle', lines: title.lines, ys: title.lines.map((_, i) => top + TRAY.title * k + i * step), font: TYPE.trayTitle, fill: 'ink' });
    node.items.forEach((it, i) => {
      const r = Math.floor(i / perRow), inRow = Math.min(perRow, n - r * perRow), c = i - r * perRow;
      const x = (c - (inRow - 1) / 2) * pitch, rowTop = top + head + r * TRAY.row * k;
      items.push({ icon: it.icon, x, y: rowTop + TRAY.icon * k });
      texts.push({ role: 'caption', lines: [it.caption], ys: [rowTop + TRAY.cap * k], x, font: TYPE.caption, fill: 'ink' });
    });
    nameLines = title.lines.length; overflow = title.over;
    frame = { x: -w / 2, y: top, w, h, fill: 'bg', sw: TRAY.sw * k };
    pc.done(); pt.done();
  } else throw new Error(`node ${node.id}: unknown type "${type}"`);

  return { type, top, bottom, w, frame, icon, items, texts, nameLines, overflow };
}

export function measureNode(node, ctx) {
  const p = plan(node, ctx);
  return { w: p.w, h: p.bottom - p.top, nameLines: p.nameLines, ay: -p.top, overflow: p.overflow };
}

export function drawNode(scene, node, cx, cy, ctx) {
  const p = plan(node, ctx), T = scene.T, k = ctx.k, pid = `${ctx.prefix ?? ''}${node.id}`, col = sideColours(T, ctx.side);
  const bbox = e => { const b = e.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  return scene.at('nodes', () => {
    if (p.frame) {
      const f = p.frame;
      scene.rect(cx + f.x, cy + f.y, f.w, f.h, (scene.theme.radius ?? 13) * k, f.fill === 'tint' ? col.tint : T.bg, col.stroke, f.sw);
    }
    if (p.icon) scene.icon(node.icon, `${pid}-ic`, cx, cy, p.icon.scale);
    p.items.forEach((it, i) => scene.icon(it.icon, `${pid}-i${i}`, cx + it.x, cy + it.y, TRAY_SCALE * k));
    const labelBoxes = p.texts.map((t, i) => {
      const x = cx + (t.x ?? 0), [size, weight] = t.font;
      const e = scene.text(x, cy + t.ys[0], t.lines[0], { size: size * k, weight, fill: T[t.fill], id: `${pid}-t${i}`, role: t.role, owner: pid });
      if (t.lines.length > 1) {
        e.textContent = '';
        t.lines.forEach((line, j) => { const s = document.createElementNS(NS, 'tspan'); s.setAttribute('x', num(x)); s.setAttribute('y', num(cy + t.ys[j])); s.textContent = line; e.appendChild(s); });
      }
      return bbox(e);
    });
    const box = { x: cx - p.w / 2, y: cy + p.top, w: p.w, h: p.bottom - p.top };
    const iconBox = p.icon ? { x: cx + p.icon.x, y: cy + p.icon.y, w: p.icon.w, h: p.icon.h } : { x: cx + p.frame.x, y: cy + p.frame.y, w: p.frame.w, h: p.frame.h };
    return { box, labelBoxes, iconBox, overflow: p.overflow };
  });
}
