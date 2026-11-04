// palette.mjs — theme colours from an image (ffmpeg + k-means++) or from brand hex values.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadTheme, TEXT_PAIRS, nearestPassing, toHsl, fromHsl, mix, checkTheme } from './theme.mjs';

const run = promisify(execFile);
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// mulberry32: a small fixed-seed PRNG, so the same image always gives the same palette.
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The image's dominant colours, most populous first, near-white and near-black clusters dropped.
export async function paletteFromImage(file, k = 6) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', 'scale=64:64:flags=area',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer', maxBuffer: 1 << 24 });
  const px = [];
  for (let i = 0; i + 2 < stdout.length; i += 3) px.push([stdout[i], stdout[i + 1], stdout[i + 2]]);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // k-means++ seeding; stops early when every pixel already sits on a centre (an image with fewer than k colours)
  const rand = rng(1234), centres = [px[Math.floor(rand() * px.length)]];
  while (centres.length < k) {
    const dist = px.map(p => Math.min(...centres.map(c => d2(p, c)))), sum = dist.reduce((a, b) => a + b, 0);
    if (sum === 0) break;
    let r = rand() * sum, i = 0;
    while ((r -= dist[i]) > 0) i++;
    centres.push(px[i]);
  }
  let assign = new Array(px.length).fill(0);
  for (let iter = 0; iter < 30; iter++) {
    const next = px.map(p => { let best = 0; for (let c = 1; c < centres.length; c++) if (d2(p, centres[c]) < d2(p, centres[best])) best = c; return best; });
    const moved = next.some((a, i) => a !== assign[i]);
    assign = next;
    for (let c = 0; c < centres.length; c++) {
      const mine = px.filter((_, i) => assign[i] === c);
      if (mine.length) centres[c] = [0, 1, 2].map(j => mine.reduce((s, p) => s + p[j], 0) / mine.length);
    }
    if (!moved && iter > 0) break;
  }
  const counts = centres.map((_, c) => assign.filter(a => a === c).length);
  return centres.map((c, i) => ({ hex: hex(c), n: counts[i] }))
    .filter(({ hex: h, n }) => n > 0 && toHsl(h)[2] <= 0.94 && toHsl(h)[2] >= 0.06)
    .sort((a, b) => b.n - a.n).map(c => c.hex);
}

// A theme from one or two brand colours: start from the light or dark preset, recolour the brand roles, derive the
// shades, then pull every text colour to the nearest one that passes 4.5:1 on its ground.
export function themeFromBrand({ primary, accent, mode, name }) {
  const t = loadTheme(mode === 'dark' ? 'dark' : 'light'), C = t.colors;
  primary = primary.toUpperCase();
  t.name = name;
  Object.assign(C, { primary, sideA: primary, accent: (accent ?? primary).toUpperCase(), groupText: primary });
  const [h, s, l] = toHsl(primary);
  C.primaryDark = fromHsl([h, s, Math.max(0, l - 0.18)]);
  C.tint = mode === 'dark' ? mix(C.panel, primary, 0.22) : mix('#FFFFFF', primary, 0.12);
  for (let pass = 0; pass < 3; pass++) for (const [fg, bg] of TEXT_PAIRS) C[fg] = nearestPassing(C[fg], C[bg]);   // a colour on two grounds may need a second look
  const r = checkTheme(t);
  if (!r.ok) throw new Error(`could not build a passing theme from ${primary}: ${r.failures.map(f => f.detail).join('; ')}`);
  return t;
}

// The brand pair from an image: the two most populous colours that are clearly coloured (saturation > 0.25).
export async function brandFromImage(file) {
  const strong = (await paletteFromImage(file)).filter(c => toHsl(c)[1] > 0.25);
  if (!strong.length) throw new Error(`${file}: no clearly coloured area found (every cluster is grey, white or black); pass --brand instead`);
  return { primary: strong[0], accent: strong[1] };
}
