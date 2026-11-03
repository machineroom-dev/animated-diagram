// origin server: a tower; the fan turns (2 blade-steps per loop), the drive LEDs blink.
import { setA, R } from '../icon-kit.js';

export default {
  name: 'tower',
  box: [72, 104],
  draw: (id, T) => `<g id="${id}">
    <rect x="-28" y="44" width="12" height="6" rx="2" fill="${T.outline}" ${R('accent', 'none')}/><rect x="16" y="44" width="12" height="6" rx="2" fill="${T.outline}" ${R('accent', 'none')}/>
    <rect x="-34" y="-46" width="68" height="92" rx="8" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
    ${[0, 1, 2].map(k => `<rect x="-24" y="${-36 + k * 12}" width="34" height="7" rx="2" fill="${T.tint}" stroke="${T.outline}" stroke-width="2" ${R('fill', 'detail')}/>
      <circle cx="21" cy="${-32.5 + k * 12}" r="3.3" fill="${T.neutral}" stroke="${T.outline}" stroke-width="1.6" ${R('fill', 'detail')}/>
      <circle id="${id}-l${k}" cx="21" cy="${-32.5 + k * 12}" r="2.5" fill="${T.amber}" opacity="0" ${R('accent', 'none')}/>`).join('')}
    <g transform="translate(0 21)"><circle r="16" fill="${T.primaryDark}" stroke="${T.outline}" stroke-width="2.6" ${R('fill2', 'outline')}/>
      <g id="${id}-fan">${[0, 120, 240].map(a => `<path transform="rotate(${a})" d="M0,0 Q8,-4 5,-13 Q-2,-12.5 0,0 Z" fill="${T.paper}" stroke="${T.outline}" stroke-width="1.6" stroke-linejoin="round" ${R('paper', 'detail')}/>`).join('')}</g>
      <circle r="3.2" fill="${T.outline}" ${R('accent', 'none')}/></g></g>`,
  loop: (id, f) => {
    setA(`${id}-fan`, { transform: `rotate(${(240 * f / 90).toFixed(3)})` });
    for (let k = 0; k < 3; k++) setA(`${id}-l${k}`, { opacity: ((f + k * 11) % 30) < 12 ? 1 : 0 });
  },
};
