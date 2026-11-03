// document: a page with a folded corner; its text lines type in one by one, left to right, hold, then clear.
import { setA, clamp, ease, R } from '../icon-kit.js';

const LINES = [[-12, 36], [-2, 30], [8, 36], [18, 22], [28, 31]];   // [y, full width] from x = -18
const typeStart = i => 6 + 8 * i, TYPE = 8, CLEAR = 70;

export default {
  name: 'document',
  box: [64, 84],
  draw: (id, T) => `<g id="${id}">
    <path d="M-28,-40 H14 L30,-24 V40 H-28 Z" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('paper', 'outline')}/>
    <path d="M14,-40 V-24 H30 Z" fill="${T.tint}" stroke="${T.outline}" stroke-width="2.4" stroke-linejoin="round" ${R('fill', 'detail')}/>
    <rect x="-18" y="-29" width="22" height="5.5" rx="2.75" fill="${T.primary}" ${R('accent', 'none')}/>
    <g id="${id}-txt">${LINES.map(([y], i) => `<rect id="${id}-l${i}" x="-18" y="${y - 1.8}" width="0" height="3.6" rx="1.8" fill="${T.outline}" opacity="0.75" ${R('accent', 'none')}/>`).join('')}</g>
    <rect id="${id}-cur" x="-18" y="-15.5" width="2.2" height="7" rx="1" fill="${T.primary}" opacity="0" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => {
    let cur = null;
    LINES.forEach(([y, w], i) => {
      const t = clamp((f - typeStart(i)) / TYPE), width = f < CLEAR ? w * t : 0;
      setA(`${id}-l${i}`, { width });
      if (t > 0 && t < 1 && f < CLEAR) cur = [-18 + width + 1.5, y];
    });
    setA(`${id}-txt`, { opacity: f < CLEAR - 8 ? 1 : f < CLEAR ? 1 - ease((f - CLEAR + 8) / 8) : 1 });
    setA(`${id}-cur`, cur ? { opacity: 1, x: cur[0], y: cur[1] - 3.5 } : { opacity: 0 });
  },
};
