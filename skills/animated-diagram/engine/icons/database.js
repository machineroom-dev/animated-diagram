// database: a stack of three disks; the disks light up top → bottom in turn, like a read scan.
import { setA, R } from '../icon-kit.js';

const TOPS = [-30, -8, 14];                     // each disk: a 16 px side band under a 36 × 9 ellipse
const side = y => `M-36,${y} V${y + 16} A36,9 0 0 0 36,${y + 16} V${y}`;

export default {
  name: 'database',
  box: [78, 84],
  draw: (id, T) => `<g id="${id}">
    ${[2, 1, 0].map(i => { const y = TOPS[i]; return `
      <ellipse cy="${y}" rx="36" ry="9" fill="${i ? T.tint : T.primary}" stroke="${T.outline}" stroke-width="3" ${R(i ? 'fill' : 'fill2', 'outline')}/>
      <path d="${side(y)}" fill="${T.tint}" ${R('fill', 'none')}/>
      <path id="${id}-d${i}" d="${side(y)}" fill="${T.hit}" opacity="0" ${R('accent', 'none')}/>
      <path d="${side(y)}" fill="none" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('none', 'outline')}/>
      ${i < 2 ? `<path d="M-36,${y + 16} A36,9 0 0 0 36,${y + 16}" fill="none" stroke="${T.outline}" stroke-width="2.4" ${R('none', 'detail')}/>` : ''}
      ${i ? '' : `<ellipse cy="${y}" rx="36" ry="9" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
      <ellipse cy="${y}" rx="23" ry="4.6" fill="${T.primaryDark}" ${R('fill', 'none')}/>`}`; }).join('')}</g>`,
  loop: (id, f) => {
    for (let i = 0; i < 3; i++) setA(`${id}-d${i}`, { opacity: f >= 6 + 18 * i && f < 24 + 18 * i ? 1 : 0 });
  },
};
