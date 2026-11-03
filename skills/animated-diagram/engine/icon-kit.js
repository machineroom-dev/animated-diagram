// icon-kit.js — helpers shared by every icon. An icon is { name, box, draw(id, T), loop(id, f, T) }: draw returns SVG
// in its own frame (centred on 0,0, about 100 px across) using theme tokens only; loop sets frame f of a seamless
// 90-frame idle loop. Every shape carries R(fillRole, strokeRole) so the styles (styles.js) can restyle it.
export const $ = id => document.getElementById(id);
export const setA = (id, o) => { const e = $(id); if (e) for (const [k, v] of Object.entries(o)) e.setAttribute(k, typeof v === 'number' ? +v.toFixed(3) : v); };
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeBack = t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const kf = (f, keys) => {            // keys [[frame, value], …] eased between keys, held outside
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) {
    const [f0, v0] = keys[i - 1], [f1, v1] = keys[i]; return v0 + (v1 - v0) * ease((f - f0) / (f1 - f0));
  }
  return keys[keys.length - 1][1];
};
export const bump = (f, at, len) => { const t = (f - at) / len; return t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0; };
// Role attributes. Fill roles: fill | fill2 | paper | accent | none. Stroke roles: outline | detail | accent | none.
export const R = (fill, stroke) => `data-fill="${fill}" data-stroke="${stroke}"`;
export const imageGlyph = (T, x, y, w, h) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${T.tint}" stroke="${T.outline}" stroke-width="2.2" ${R('fill', 'detail')}/>
  <circle cx="${x + w * 0.3}" cy="${y + h * 0.32}" r="${h * 0.14}" fill="${T.amber}" ${R('accent', 'none')}/>
  <path d="M${x + 3},${y + h - 3} L${x + w * 0.38},${y + h * 0.5} L${x + w * 0.56},${y + h * 0.72} L${x + w * 0.72},${y + h * 0.55} L${x + w - 3},${y + h - 3} Z" fill="${T.primary}" ${R('fill2', 'none')}/>`;
