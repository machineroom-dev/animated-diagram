// stopwatch (TTL): the hand sweeps one full turn per loop.
import { setA, R } from '../icon-kit.js';

export default {
  name: 'stopwatch',
  box: [84, 84],
  draw: (id, T) => `<g id="${id}">
    <g transform="translate(0 6) rotate(45)"><rect x="-4.5" y="-41" width="9" height="8" rx="2" fill="${T.neutral}" stroke="${T.outline}" stroke-width="2.2" ${R('fill', 'detail')}/></g>
    <rect x="-3.5" y="-31" width="7" height="6" fill="${T.outline}" ${R('accent', 'none')}/>
    <rect x="-8" y="-38" width="16" height="9" rx="2.5" fill="${T.neutral}" stroke="${T.outline}" stroke-width="2.4" ${R('fill', 'outline')}/>
    <circle cy="6" r="32" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
    ${[...Array(12).keys()].map(i => { const a = i * Math.PI / 6, r1 = i % 3 ? 24 : 20.5, r2 = 27.5;
      return `<line x1="${(r1 * Math.sin(a)).toFixed(2)}" y1="${(6 - r1 * Math.cos(a)).toFixed(2)}" x2="${(r2 * Math.sin(a)).toFixed(2)}" y2="${(6 - r2 * Math.cos(a)).toFixed(2)}" stroke="${T.outline}" stroke-width="${i % 3 ? 1.8 : 2.8}" stroke-linecap="round" ${R('none', 'detail')}/>`; }).join('')}
    <line id="${id}-hand" x1="0" y1="10" x2="0" y2="-16" stroke="${T.miss}" stroke-width="3.4" stroke-linecap="round" ${R('none', 'accent')}/>
    <circle cy="6" r="4" fill="${T.outline}" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => setA(`${id}-hand`, { transform: `rotate(${(360 * f / 90).toFixed(3)} 0 6)` }),
};
