// main.js — the render page's entry point.
//   window.boot(diagram, theme, { style, localIcons: string[] }) -> Promise<{ size: { w, h }, failures, moving }>
//   window.seek(f); window.checkGeometry() re-runs the layout check (tests)
// The diagram arrives validated (scripts/schema.mjs). localIcons are module URLs; a local icon overrides a bundled
// one of the same name. A theme logo is served from the mount /brand/.
import { Scene } from './engine.js';
import { TEMPLATES } from './templates.js';
import { LayoutError } from './route.js';
import { checkGeometry } from './check-geom.js';
import { CANVAS, DEFAULTS } from '../scripts/schema.mjs';

const fontUrl = file => (/^(https?:|data:|\/)/.test(file) ? file : '/' + file);   // theme font paths are relative to the skill root

async function loadLogo(file) {
  const href = `/brand/${String(file).split(/[\\/]/).pop()}`, img = new Image();
  img.src = href;
  await img.decode();
  return { href, w: img.naturalWidth, h: img.naturalHeight };
}

// What is meant to move: every icon's box (all it draws at any frame) and every arrow with its head, padded for
// anti-aliasing. The GIF's flicker check leaves these out.
function movingBoxes(scene, k) {
  const pad = 4 * k, reach = ((scene.theme.lineWeight ?? 2.6) / 2 + 10) * k + pad;
  const icons = scene.placed.map(p => { const [w, h] = p.mod.box; return { x: p.cx - w * p.scale / 2 - pad, y: p.cy - h * p.scale / 2 - pad, w: w * p.scale + 2 * pad, h: h * p.scale + 2 * pad }; });
  const arrows = scene.arrows.flatMap(a => a.points.slice(1).map((q, i) => { const p = a.points[i]; return { x: Math.min(p[0], q[0]) - reach, y: Math.min(p[1], q[1]) - reach, w: Math.abs(q[0] - p[0]) + 2 * reach, h: Math.abs(q[1] - p[1]) + 2 * reach }; }));
  return [...icons, ...arrows];
}

window.boot = async (diagram, theme, opts = {}) => {
  const face = new FontFace(theme.font.family, `url(${fontUrl(theme.font.file)})`, { weight: '100 900' });
  document.fonts.add(await face.load());
  const localIcons = {};
  for (const url of opts.localIcons ?? []) {                     // known by file name, as validation knows them
    const name = url.split('/').pop().replace(/\.js$/, '');
    localIcons[name] = { ...(await import(url)).default, name };
  }

  const canvas = CANVAS[diagram.canvas ?? DEFAULTS.canvas], k = canvas.w / 1080;
  const svg = document.getElementById('card');
  svg.innerHTML = '';
  for (const [a, v] of [['width', canvas.w], ['height', canvas.h], ['viewBox', `0 0 ${canvas.w} ${canvas.h}`]]) svg.setAttribute(a, v);
  document.body.style.background = theme.colors.bg;

  const scene = new Scene(svg, theme, k, { style: opts.style ?? theme.style, localIcons });
  const logo = theme.brand?.logo ? await loadLogo(theme.brand.logo) : null;
  await document.fonts.ready;
  const compose = TEMPLATES[diagram.template];
  if (!compose) throw new Error(`template "${diagram.template}" is not built yet`);
  const failures = [];
  let composition = null;
  try { composition = compose(diagram, canvas, { scene, theme, k, logo }); }
  catch (e) {
    if (!(e instanceof LayoutError)) throw e;
    failures.push({ code: e.code, ids: [e.stepId, e.blocking].filter(Boolean), detail: e.detail });     // the still shows how far it got
  }
  await scene.layoutLabels();
  scene.seek(0);
  window.scene = scene; window.composition = composition; window.canvas = canvas;
  window.checkGeometry = () => composition ? checkGeometry(composition, canvas, k, scene) : [];
  failures.push(...window.checkGeometry());
  return { size: { w: canvas.w, h: canvas.h }, failures, moving: movingBoxes(scene, k) };
};

window.seek = f => window.scene.seek(f);
window.ENGINE_LOADED = true;
