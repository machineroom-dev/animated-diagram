// templates.js — whole cards: background, header (headline, subtitle, brand), panel frame(s).
//   compose<Template>(diagram, canvas, ctx) -> { header, panels: [{ frame, layout }] }
//   ctx = { scene, theme, k, logo?: { href, w, h } }
import { layoutPanel } from './layout.js';
import { layoutMap } from './map.js';
import { TYPE } from './engine.js';
import { nearestPassing } from '../scripts/colour.mjs';

const NS = 'http://www.w3.org/2000/svg';
const MARGIN = 36, TOP = 140, BOTTOM = 36, GAP = 20;
const HEAD = { title: 80, sub: 118, track: -0.02, dot: 6, dotGap: 12, logo: 28, logoGap: 10 };
const CAPTION = { x: 24, y: 34, ls: 1.4 };

function background(scene, W, H) { scene.at('back', () => scene.rect(0, 0, W, H, 0, scene.T.bg)); }

// The header: a big plain headline in one or more coloured runs, a muted subtitle under it, and the brand at the right of
// the subtitle's row. No shape behind any of it. Text on the card's own ground is pulled to a passing colour here, so a
// theme that passes its pairs can never be refused for a subtitle.
function header(scene, runs, subtitle, brandText, logo, W, k) {
  const T = scene.T, x = MARGIN * k, right = W - MARGIN * k;
  return scene.at('back', () => {
    const [size, weight] = TYPE.title;
    const title = scene.text(x, HEAD.title * k, runs.map(r => r.text).join(''), { size: size * k, weight, fill: T.ink, anchor: 'start', ls: HEAD.track * size * k, role: 'title', owner: 'header' });
    if (runs.length > 1) {
      title.textContent = '';
      for (const r of runs) { const s = document.createElementNS(NS, 'tspan'); s.setAttribute('fill', r.fill); s.textContent = r.text; title.appendChild(s); }
    }
    let sub = null;
    if (subtitle) { const [ss, sw] = TYPE.subtitle; sub = scene.text(x, HEAD.sub * k, subtitle, { size: ss * k, weight: sw, fill: nearestPassing(T.muted, T.bg), anchor: 'start', role: 'subtitle', owner: 'subtitle' }); }
    const out = { title, subtitle: sub, brand: null, dot: null, logo: null, right };
    if (!brandText && !logo) return out;
    const [bs, bw] = TYPE.brand, y = HEAD.sub * k;
    if (brandText) out.brand = scene.text(right, y, brandText, { size: bs * k, weight: bw, fill: T.brand, anchor: 'end', role: 'brand', owner: 'brand' });
    const tw = out.brand ? out.brand.getComputedTextLength() : 0, midY = y - 0.36 * bs * k;
    if (logo) {
      const lh = HEAD.logo * k, lw = lh * logo.w / logo.h, img = document.createElementNS(NS, 'image');
      for (const [a, v] of Object.entries({ href: logo.href, x: right - tw - (tw ? HEAD.logoGap * k : 0) - lw, y: midY - lh / 2, width: lw, height: lh })) img.setAttribute(a, typeof v === 'number' ? +v.toFixed(3) : v);
      scene.layers.back.appendChild(img);
      out.logo = img;
    } else if (out.brand) {
      out.dot = document.createElementNS(NS, 'circle');
      for (const [a, v] of Object.entries({ cx: right - tw - (HEAD.dotGap + HEAD.dot) * k, cy: midY, r: HEAD.dot * k, fill: T.accent })) out.dot.setAttribute(a, typeof v === 'number' ? +v.toFixed(3) : v);
      scene.layers.back.appendChild(out.dot);
    }
    return out;
  });
}

const plainRuns = (scene, title) => [{ text: title, fill: scene.T.ink }];
const brandOf = (diagram, theme) => diagram.footer ?? theme.brand?.footer;
const panelRect = (scene, f, fill, stroke, k, name) => scene.at('back', () => scene.rect(f.x, f.y, f.w, f.h, 24 * k, fill, stroke, 2.4 * k)).setAttribute('data-panel', name);

// One panel filling the card under the header, laid out by `layout`.
const onePanel = layout => (diagram, canvas, ctx) => {
  const { scene, k, theme } = ctx, T = scene.T, W = canvas.w, H = canvas.h;
  background(scene, W, H);
  const head = header(scene, plainRuns(scene, diagram.title), diagram.subtitle, brandOf(diagram, theme), ctx.logo, W, k);
  const frame = { x: MARGIN * k, y: TOP * k, w: W - 2 * MARGIN * k, h: H - (TOP + BOTTOM) * k };
  panelRect(scene, frame, T.panel, T.panelStroke, k, 'main');
  return { header: head, panels: [{ frame, layout: layout(diagram.panels[0], frame, { ...ctx, prefix: '' }), fill: T.panel }] };
};
export const composeFlowGrid = onePanel(layoutPanel);
export const composeMap = onePanel(layoutMap);

// Two panels side by side, each in its side's colours, under one headline naming both sides in those colours. The
// panel titles are the headline; diagram.title is not drawn. A small caption in each panel means colour isn't the only cue.
export function composeComparison(diagram, canvas, ctx) {
  const { scene, k, theme } = ctx, T = scene.T, W = canvas.w, H = canvas.h;
  background(scene, W, H);
  const pw = (W - 2 * MARGIN * k - GAP * k) / 2, h = H - (TOP + BOTTOM) * k;
  const frames = [{ x: MARGIN * k, y: TOP * k, w: pw, h }, { x: MARGIN * k + pw + GAP * k, y: TOP * k, w: pw, h }];
  const runs = [
    { text: diagram.panels[0].title, fill: nearestPassing(T.sideA, T.bg) },
    { text: ' vs ', fill: nearestPassing(T.muted, T.bg) },
    { text: diagram.panels[1].title, fill: nearestPassing(T.sideB, T.bg) },
  ];
  const head = header(scene, runs, diagram.subtitle, brandOf(diagram, theme), ctx.logo, W, k);
  const panels = ['A', 'B'].map((side, i) => {
    const f = frames[i], [size, weight] = TYPE.group;
    panelRect(scene, f, T[`side${side}Tint`], T[`side${side}`], k, side);
    scene.at('back', () => scene.text(f.x + CAPTION.x * k, f.y + CAPTION.y * k, diagram.panels[i].title.toUpperCase(), { size: size * k, weight, fill: nearestPassing(T[`side${side}`], T[`side${side}Tint`]), anchor: 'start', ls: CAPTION.ls * k, role: 'caption-side', owner: `${side}-caption` }));
    return { frame: f, fill: T[`side${side}Tint`], layout: layoutPanel(diagram.panels[i], f, { ...ctx, side, prefix: `${side}-` }) };
  });
  return { header: head, panels };
}

// Layers top to bottom: each grid row is a band across the card with its group label, arrows between the bands.
export function composeStack(diagram, canvas, ctx) {
  const { scene, k, theme } = ctx, W = canvas.w, H = canvas.h;
  background(scene, W, H);
  const head = header(scene, plainRuns(scene, diagram.title), diagram.subtitle, brandOf(diagram, theme), ctx.logo, W, k);
  const frame = { x: MARGIN * k, y: TOP * k, w: W - 2 * MARGIN * k, h: H - (TOP + BOTTOM) * k };
  const layout = layoutPanel(diagram.panels[0], frame, { ...ctx, prefix: '', stack: true });
  return { header: head, panels: [{ frame, layout, bands: layout.bands }] };
}

export const TEMPLATES = { 'flow-grid': composeFlowGrid, comparison: composeComparison, stack: composeStack, map: composeMap };
