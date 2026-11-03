// code window: an editor window; a cursor types "{ }" on line 2, and a line highlight steps down the lines.
import { setA, clamp, R } from '../icon-kit.js';

const LINES = [[-10, 26], [0, 0], [10, 34], [20, 20]];      // [y, width of the static code bar] from x = -26
const TYPE = [10, 34];                                     // frames over which "{ }" appears, one character per third

export default {
  name: 'code-window',
  box: [112, 84],
  draw: (id, T) => `<g id="${id}">
    <rect x="-52" y="-38" width="104" height="76" rx="8" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
    <clipPath id="${id}-c"><rect x="-50.5" y="-36.5" width="101" height="73" rx="6.5" ${R('none', 'none')}/></clipPath>
    <g clip-path="url(#${id}-c)">
      <rect x="-52" y="-38" width="104" height="16" fill="${T.primary}" ${R('fill2', 'none')}/>
      <rect id="${id}-hl" x="-50" y="-15" width="100" height="10" fill="${T.tint}" ${R('fill', 'none')}/></g>
    <path d="M-52,-22 H52" stroke="${T.outline}" stroke-width="2.4" ${R('none', 'detail')}/>
    ${[-42, -34, -26].map(x => `<circle cx="${x}" cy="-30" r="2.6" fill="${T.paper}" ${R('paper', 'none')}/>`).join('')}
    ${LINES.map(([y], i) => `<text x="-40" y="${y + 3.6}" text-anchor="middle" font-size="9" font-weight="700" fill="${T.outline}" opacity="0.45">${i + 1}</text>`).join('')}
    ${LINES.filter(([, w]) => w).map(([y, w], i) => `<rect x="-26" y="${y - 2}" width="${w}" height="4" rx="2" fill="${[T.primary, T.amber, T.hit][i]}" ${R('accent', 'none')}/>`).join('')}
    <text id="${id}-t" x="-26" y="3.8" font-size="12" font-weight="800" fill="${T.miss}"></text>
    <rect id="${id}-cur" x="-26" y="-5.5" width="2.2" height="11" rx="1" fill="${T.outline}" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => {
    const typed = '{ }'.slice(0, Math.floor(3 * clamp((f - TYPE[0]) / (TYPE[1] - TYPE[0]))));
    const shown = f < 70 ? typed : '';
    const el = document.getElementById(`${id}-t`);
    if (el && el.textContent !== shown) el.textContent = shown;
    setA(`${id}-cur`, { x: -26 + 7.4 * shown.length });
    // the highlight steps down one line every 22.5 frames: line 1, 2, 3, 4, then wraps
    setA(`${id}-hl`, { y: LINES[Math.floor(f / 22.5) % 4][0] - 5 });
  },
};
