// theme.mjs — theme tokens, presets and the checks every theme must pass (WCAG text contrast, the dark rule).
// A theme is JSON: { name, mode, style, radius, lineWeight, font: { family, file }, brand: { footer?, logo? }, colors }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// One token per role. Icons and layout read these names only; no hex value lives anywhere else.
export const TOKENS = [
  'bg', 'panel', 'panelStroke', 'ink', 'muted', 'line', 'outline', 'paper', 'neutral', 'dark', 'primary', 'primaryDark',
  'tint', 'amber', 'hit', 'hitText', 'miss', 'missText', 'badge', 'badgeText', 'accent', 'head', 'headText', 'brand',
  'groupText', 'sideA', 'sideAText', 'sideATint', 'sideB', 'sideBText', 'sideBTint',
];
// Every text colour against the ground it is drawn on; each pair must reach 4.5:1.
export const TEXT_PAIRS = [
  ['ink', 'panel'], ['ink', 'bg'], ['muted', 'panel'], ['headText', 'head'], ['badgeText', 'badge'], ['hitText', 'panel'],
  ['missText', 'panel'], ['groupText', 'bg'], ['brand', 'bg'], ['sideAText', 'sideA'], ['sideBText', 'sideB'],
  ['ink', 'tint'], ['ink', 'sideATint'], ['ink', 'sideBTint'],                     // text-box names on their fills
  ['groupText', 'panel'],                                                          // stack layer titles
  ['muted', 'sideATint'], ['muted', 'sideBTint'], ['hitText', 'sideATint'], ['hitText', 'sideBTint'],   // comparison panels
  ['missText', 'sideATint'], ['missText', 'sideBTint'],
];
export const MODES = ['light', 'dark'];
export const STYLES = ['filled', 'line', 'duotone'];

export class ThemeError extends Error {
  constructor(where, problems) { super(`${where}: invalid theme — ${problems.join('; ')}`); this.name = 'ThemeError'; this.problems = problems; }
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

// ---------- colour maths ----------
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export function relLum(hex) {
  const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export function toHsl(hex) {
  const [r, g, b] = rgb(hex).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function fromHsl([h, s, l]) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return toHex([0, 8, 4].map(n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
}
export const mix = (a, b, t) => { const [x, y] = [rgb(a), rgb(b)]; return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

// The nearest colour to fg (same hue and saturation, HSL lightness moved in 1 % steps) that reaches min against bg.
// Away from the ground first; if that runs out of room, the other way (white text on yellow has nowhere lighter to go).
export function nearestPassing(fg, bg, min = 4.5) {
  if (contrast(fg, bg) >= min) return fg.toUpperCase();
  const [h, s, l] = toHsl(fg), away = relLum(fg) >= relLum(bg) ? 1 : -1;
  for (let step = 1; step <= 100; step++) {
    for (const dir of [away, -away]) {
      const l2 = l + dir * step / 100;
      if (l2 < 0 || l2 > 1) continue;
      const c = fromHsl([h, s, l2]);
      if (contrast(c, bg) >= min) return c;
    }
  }
  return relLum(bg) > 0.18 ? '#000000' : '#FFFFFF';
}

// ---------- load + check ----------
function validate(t) {
  const p = [];
  if (!t || typeof t !== 'object') return ['the file is not a JSON object'];
  if (typeof t.name !== 'string' || !t.name) p.push('name: missing');
  if (!MODES.includes(t.mode)) p.push(`mode: must be one of ${MODES.join(', ')}`);
  if (!STYLES.includes(t.style)) p.push(`style: must be one of ${STYLES.join(', ')}`);
  if (!(t.radius >= 0)) p.push('radius: must be a number ≥ 0');
  if (!(t.lineWeight > 0)) p.push('lineWeight: must be a number > 0');
  if (!t.font || typeof t.font.family !== 'string' || typeof t.font.file !== 'string') p.push('font: needs family and file');
  if (t.brand !== undefined && (typeof t.brand !== 'object' || t.brand === null)) p.push('brand: must be an object');
  const c = t.colors ?? {};
  if (!t.colors) p.push('colors: missing');
  for (const tok of TOKENS) {
    if (c[tok] === undefined) p.push(`colors.${tok}: missing`);
    else if (!HEX.test(c[tok])) p.push(`colors.${tok}: "${c[tok]}" is not #RRGGBB`);
  }
  return p;
}

export function resolveThemePath(nameOrPath) {
  return /[\\/]|\.json$/.test(nameOrPath) ? path.resolve(nameOrPath) : path.join(SKILL, 'themes', `${nameOrPath}.json`);
}

export function loadTheme(nameOrPath) {
  const file = resolveThemePath(nameOrPath);
  if (!fs.existsSync(file)) {
    const presets = fs.readdirSync(path.join(SKILL, 'themes')).map(f => f.replace(/\.json$/, ''));
    throw new ThemeError(nameOrPath, [`no such theme file or preset (presets: ${presets.join(', ')})`]);
  }
  let t;
  try { t = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new ThemeError(file, [`not valid JSON: ${e.message}`]); }
  const problems = validate(t);
  if (problems.length) throw new ThemeError(file, problems);
  t.brand ??= {};
  return t;
}

export function checkTheme(t) {
  const C = t.colors, failures = [];
  for (const [fg, bg] of TEXT_PAIRS) {
    const ratio = contrast(C[fg], C[bg]);
    if (ratio < 4.5) failures.push({ code: 'CONTRAST', pair: [fg, bg], ratio: +ratio.toFixed(2),
      detail: `${fg} ${C[fg]} on ${bg} ${C[bg]} is ${ratio.toFixed(2)}:1, needs 4.5:1 — nearest passing ${fg}: ${nearestPassing(C[fg], C[bg])}` });
  }
  // On a dark ground the icon outline must be light and the paper fills dark, or the icons lose their edges.
  if (relLum(C.bg) < 0.2) {
    if (relLum(C.outline) <= 0.5) failures.push({ code: 'DARK_RULE', pair: ['outline', 'bg'],
      detail: `dark ground (${C.bg}) needs a light outline: outline ${C.outline} has luminance ${relLum(C.outline).toFixed(2)}, needs > 0.5` });
    if (relLum(C.paper) >= 0.3) failures.push({ code: 'DARK_RULE', pair: ['paper', 'bg'],
      detail: `dark ground (${C.bg}) needs dark icon fills: paper ${C.paper} has luminance ${relLum(C.paper).toFixed(2)}, needs < 0.3` });
  }
  return { ok: failures.length === 0, failures };
}
