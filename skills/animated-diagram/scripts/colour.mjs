// colour.mjs — colour maths and the zone palette. Pure: no Node or browser APIs, so the page and the CLI share it.
//   zoneStyles(theme) -> { <zone>: { hue, fill, stroke, text, ink, muted, hitText, missText, tokens } }
//   zoneOrder(theme) -> zone names in the order zones are handed out when a diagram doesn't pick one.
// Zones are derived, never stored: a theme may override a hue with theme.zones, and a theme without that field still works.
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

// ---------- zones ----------
export const ZONE_NAMES = ['primary', 'teal', 'violet', 'amber', 'pink', 'green', 'blue'];
const HUES = {
  dark: { teal: '#2CCFB8', violet: '#A78BFA', amber: '#F2B544', pink: '#F2789F', green: '#8BD450', blue: '#5B9DF5' },
  light: { teal: '#0F9D8A', violet: '#7C4DEB', amber: '#D98A0B', pink: '#D6336C', green: '#3C9A2E', blue: '#2F6FDB' },
};
const hueGap = (a, b) => { const d = Math.abs(toHsl(a)[0] - toHsl(b)[0]); return Math.min(d, 360 - d); };
const hueOf = (theme, zone) => zone === 'primary' ? theme.colors.primary : (theme.zones?.[zone] ?? HUES[theme.mode === 'dark' ? 'dark' : 'light'][zone]).toUpperCase();

// One hue on one ground: the colours for text on `fill`, and the tokens an icon drawn there uses instead of the theme's.
function styleOn(theme, hue, fill, stroke, ground) {
  const C = theme.colors, dark = theme.mode === 'dark';
  const muted = nearestPassing(C.muted, fill), tint = mix(ground, hue, dark ? 0.34 : 0.38);
  return {
    hue, fill, stroke, muted,
    text: nearestPassing(dark ? mix(hue, '#FFFFFF', 0.35) : mix(hue, '#000000', 0.25), fill),
    ink: nearestPassing(C.ink, fill), hitText: nearestPassing(C.hitText, fill), missText: nearestPassing(C.missText, fill),
    boxInk: nearestPassing(C.ink, tint),
    tokens: { primary: hue, primaryDark: dark ? mix(hue, ground, 0.35) : mix(hue, '#000000', 0.25), tint, neutral: mix(C.neutral, hue, 0.22), panel: fill, muted },
  };
}

export function zoneStyles(theme) {
  const C = theme.colors, dark = theme.mode === 'dark', out = {};
  // A dark zone is the panel lifted toward its hue; a light zone is a pale wash of its hue on the card's own background.
  const ground = dark ? C.panel : C.bg;
  for (const zone of ZONE_NAMES) {
    const hue = hueOf(theme, zone);
    out[zone] = styleOn(theme, hue, mix(ground, hue, dark ? 0.13 : 0.10), mix(ground, hue, dark ? 0.75 : 0.85), ground);
  }
  return out;
}

// The two panels of a comparison: the same treatment, on the tints the theme already gives them.
export function sideStyles(theme) {
  const C = theme.colors, out = {};
  for (const side of ['A', 'B']) {
    const ground = C[`side${side}Tint`], hue = C[`side${side}`].toUpperCase(), s = styleOn(theme, hue, ground, hue, ground);
    out[side] = { ...s, boxInk: s.ink };                 // a text box on a side keeps the side's own tint
  }
  return out;
}

// primary first, then the other hues in their listed order, without any that would read as primary again.
export function zoneOrder(theme) {
  return ['primary', ...ZONE_NAMES.slice(1).filter(z => hueGap(hueOf(theme, z), theme.colors.primary) > 25)];
}
