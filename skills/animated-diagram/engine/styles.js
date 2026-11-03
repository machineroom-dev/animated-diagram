// styles.js — one drawing, three looks. A style restyles an icon by its role attributes, never by its colours.
//   filled (default): as drawn.  line: outline and detail only, fills knocked back to the panel, thinner round strokes.
//   duotone: no outline, a tint fill plus one strong colour (primary).
const KNOCKED = ['fill', 'fill2', 'paper'];

export function applyStyle(root, style, T) {
  if (!style || style === 'filled') return;
  if (style !== 'line' && style !== 'duotone') throw new Error(`unknown icon style "${style}" (filled, line, duotone)`);
  for (const e of root.querySelectorAll('[data-fill], [data-stroke]')) {
    const f = e.dataset.fill, s = e.dataset.stroke;
    if (style === 'line') {
      if (KNOCKED.includes(f)) e.setAttribute('fill', T.panel);
      if (s === 'outline' || s === 'detail') {
        e.setAttribute('stroke-width', +((+(e.getAttribute('stroke-width') ?? 1)) * 0.8).toFixed(3));
        e.setAttribute('stroke-linecap', 'round');
        e.setAttribute('stroke-linejoin', 'round');
      }
    } else {
      if (s === 'outline') e.setAttribute('stroke', 'none');
      if (s === 'detail') e.setAttribute('stroke', T.primary);
      if (f === 'fill' || f === 'paper') e.setAttribute('fill', T.tint);
      if (f === 'fill2' || f === 'accent') e.setAttribute('fill', T.primary);
    }
  }
}
