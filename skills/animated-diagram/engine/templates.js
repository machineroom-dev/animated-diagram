// templates.js — whole cards: background, headline band, panel frame(s), footer.
//   compose<Template>(diagram, canvas, ctx) -> { band, panels: [{ frame, layout }], footer }
//   ctx = { scene, theme, k, logo?: { href, w, h } }
import { layoutPanel } from './layout.js';
import { TYPE } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const MARGIN = 36, TOP = 140, BOTTOM = 64;

function background(scene, W, H) { scene.at('back', () => scene.rect(0, 0, W, H, 0, scene.T.bg)); }

const PILL_Y = 36, PILL_H = 74, GAP = 20, PILL_SHARE = 0.74;

// A pill with its text centred.
function pill(scene, box, text, fill, ink, k, owner) {
  const [size, weight] = TYPE.title;
  scene.rect(box.x, box.y, box.w, box.h, 13 * k, fill);
  return text ? scene.text(box.x + box.w / 2, box.y + box.h / 2 + 0.36 * size * k, text, { size: size * k, weight, fill: ink, role: 'title', owner }) : null;
}
const accentBar = (scene, k) => scene.rect(40 * k, 44 * k, 9 * k, 58 * k, 4.5 * k, scene.T.accent);

// The accent bar and the headline pill, the title centred in it.
function band(scene, title, W, k) {
  const T = scene.T, box = { x: 68 * k, y: PILL_Y * k, w: W - 104 * k, h: PILL_H * k };
  return scene.at('back', () => { accentBar(scene, k); return { pill: box, title: pill(scene, box, title, T.head, T.headText, k, 'band') }; });
}

const panelRect = (scene, f, fill, stroke, k, name) => scene.at('back', () => scene.rect(f.x, f.y, f.w, f.h, 24 * k, fill, stroke, 2.4 * k)).setAttribute('data-panel', name);

// The footer text centred at H − 24k, with the brand logo (28k high) to its left when the theme has one.
function footer(scene, text, logo, W, H, k) {
  if (!text && !logo) return null;
  const T = scene.T, [size, weight] = TYPE.footer, y = H - 24 * k;
  return scene.at('back', () => {
    const t = text ? scene.text(W / 2, y, text, { size: size * k, weight, fill: T.brand, role: 'footer', owner: 'footer' }) : null;
    const tw = t ? t.getComputedTextLength() : 0;
    if (!logo) return { text: t };
    const lh = 28 * k, lw = lh * logo.w / logo.h, gap = text ? 10 * k : 0, x0 = W / 2 - (lw + gap + tw) / 2;
    const img = document.createElementNS(NS, 'image');
    for (const [a, v] of Object.entries({ href: logo.href, x: x0, y: y - 0.36 * size * k - lh / 2, width: lw, height: lh })) img.setAttribute(a, typeof v === 'number' ? +v.toFixed(3) : v);
    scene.layers.back.appendChild(img);
    if (t) { t.setAttribute('text-anchor', 'start'); t.setAttribute('x', +(x0 + lw + gap).toFixed(3)); }
    return { text: t, logo: img };
  });
}

export function composeFlowGrid(diagram, canvas, ctx) {
  const { scene, k, theme } = ctx, T = scene.T, W = canvas.w, H = canvas.h;
  background(scene, W, H);
  const b = band(scene, diagram.title, W, k);
  const frame = { x: MARGIN * k, y: TOP * k, w: W - 2 * MARGIN * k, h: H - (TOP + BOTTOM) * k };
  panelRect(scene, frame, T.panel, T.panelStroke, k, 'main');
  const layout = layoutPanel(diagram.panels[0], frame, { ...ctx, prefix: '' });
  const f = footer(scene, diagram.footer ?? theme.brand?.footer, ctx.logo, W, H, k);
  return { band: b, panels: [{ frame, layout }], footer: f };
}

// Two panels side by side, each in its side's colours, under a band of two pills and a "vs". The pills are the
// headline; diagram.title is not drawn.
export function composeComparison(diagram, canvas, ctx) {
  const { scene, k, theme } = ctx, T = scene.T, W = canvas.w, H = canvas.h;
  background(scene, W, H);
  const pw = (W - 2 * MARGIN * k - GAP * k) / 2, h = H - (TOP + BOTTOM) * k;
  const frames = [{ x: MARGIN * k, y: TOP * k, w: pw, h }, { x: MARGIN * k + pw + GAP * k, y: TOP * k, w: pw, h }];
  const pills = frames.map(f => ({ x: f.x + f.w * (1 - PILL_SHARE) / 2, y: PILL_Y * k, w: f.w * PILL_SHARE, h: PILL_H * k }));
  const b = scene.at('back', () => {
    accentBar(scene, k);
    const titles = ['A', 'B'].map((side, i) => pill(scene, pills[i], diagram.panels[i].title, T[`side${side}`], T[`side${side}Text`], k, `pill${side}`));
    const [size, weight] = TYPE.vs;
    const vs = scene.text(W / 2, PILL_Y * k + PILL_H * k / 2 + 0.36 * size * k, 'vs', { size: size * k, weight, fill: T.ink, role: 'title', owner: 'band' });
    return { pills, titles, vs };
  });
  const panels = ['A', 'B'].map((side, i) => {
    panelRect(scene, frames[i], T[`side${side}Tint`], T[`side${side}`], k, side);
    return { frame: frames[i], layout: layoutPanel(diagram.panels[i], frames[i], { ...ctx, side, prefix: `${side}-` }) };
  });
  const f = footer(scene, diagram.footer ?? theme.brand?.footer, ctx.logo, W, H, k);
  return { band: b, panels, footer: f };
}

// Layers top to bottom: each grid row is a band across the card with its group label, arrows between the bands.
export function composeStack(diagram, canvas, ctx) {
  const { scene, k, theme } = ctx, W = canvas.w, H = canvas.h;
  background(scene, W, H);
  const b = band(scene, diagram.title, W, k);
  const frame = { x: MARGIN * k, y: TOP * k, w: W - 2 * MARGIN * k, h: H - (TOP + BOTTOM) * k };
  const layout = layoutPanel(diagram.panels[0], frame, { ...ctx, prefix: '', stack: true });
  const f = footer(scene, diagram.footer ?? theme.brand?.footer, ctx.logo, W, H, k);
  return { band: b, panels: [{ frame, layout, bands: layout.bands }], footer: f };
}

export const TEMPLATES = { 'flow-grid': composeFlowGrid, comparison: composeComparison, stack: composeStack };
