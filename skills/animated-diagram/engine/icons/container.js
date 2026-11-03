// container: a shipping container seen end on; the right door swings open on its side hinge, a parcel slides in
// from the front, and the door closes over it.
import { setA, clamp, ease, R } from '../icon-kit.js';

const OPEN = [8, 20], SHOW = [18, 22], SLIDE = [22, 38], CLOSE = [46, 58];
const FROM = [13, 34, 1.15], TO = [13, 2, 0.8];             // parcel [x, y, scale] in front of the door → inside

export default {
  name: 'container',
  box: [88, 84],
  draw: (id, T) => `<g id="${id}"><g transform="translate(0 -6)">
    <rect x="-42" y="-32" width="84" height="64" rx="4" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
    <rect x="0" y="-25" width="36" height="50" fill="${T.dark}" ${R('accent', 'none')}/>
    <rect x="-36" y="-25" width="36" height="50" fill="${T.tint}" stroke="${T.outline}" stroke-width="2.4" ${R('fill', 'detail')}/>
    ${[-27, -9].map(x => `<path d="M${x},-21 V21" stroke="${T.outline}" stroke-width="2.2" stroke-linecap="round" ${R('none', 'detail')}/>
      <rect x="${x - 2.5}" y="-3" width="5" height="8" rx="1.5" fill="${T.outline}" ${R('accent', 'none')}/>`).join('')}
    <g id="${id}-box"><g transform="translate(-11 -9)">
      <rect width="22" height="18" rx="2" fill="${T.amber}" stroke="${T.outline}" stroke-width="2.2" ${R('paper', 'detail')}/>
      <path d="M0,6 H22 M11,0 V6" fill="none" stroke="${T.outline}" stroke-width="1.8" ${R('none', 'detail')}/></g></g>
    <g id="${id}-door"><rect x="0" y="-25" width="36" height="50" fill="${T.tint}" stroke="${T.outline}" stroke-width="2.4" ${R('fill', 'detail')}/>
      ${[9, 27].map(x => `<path d="M${x},-21 V21" stroke="${T.outline}" stroke-width="2.2" stroke-linecap="round" ${R('none', 'detail')}/>
        <rect x="${x - 2.5}" y="-3" width="5" height="8" rx="1.5" fill="${T.outline}" ${R('accent', 'none')}/>`).join('')}</g>
    ${[-32, 25].map(y => `<rect x="-42" y="${y}" width="84" height="7" fill="${T.primaryDark}" stroke="${T.outline}" stroke-width="2.2" ${R('fill2', 'detail')}/>`).join('')}
    ${[[-42, -32], [35, -32], [-42, 27], [35, 27]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="5" rx="1" fill="${T.dark}" ${R('accent', 'none')}/>`).join('')}
    <rect x="-42" y="-32" width="84" height="64" rx="4" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'outline')}/></g></g>`,
  loop: (id, f) => {
    // seen face on, a door swung open on its right-hand hinge is a narrower door
    const open = f < OPEN[0] ? 0 : f < OPEN[1] ? ease((f - OPEN[0]) / (OPEN[1] - OPEN[0])) : f < CLOSE[0] ? 1 : 1 - ease(clamp((f - CLOSE[0]) / (CLOSE[1] - CLOSE[0])));
    setA(`${id}-door`, { transform: `translate(36 0) scale(${(1 - 0.72 * open).toFixed(4)} 1) translate(-36 0)` });
    const t = ease(clamp((f - SLIDE[0]) / (SLIDE[1] - SLIDE[0]))), [x, y, s] = FROM.map((a, i) => a + (TO[i] - a) * t);
    const seen = f >= SHOW[0] && f < CLOSE[1] ? clamp((f - SHOW[0]) / (SHOW[1] - SHOW[0])) : 0;
    setA(`${id}-box`, { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${s.toFixed(4)})`, opacity: +seen.toFixed(3) });
  },
};
