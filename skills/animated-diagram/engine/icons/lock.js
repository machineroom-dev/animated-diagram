// lock: a padlock; the shackle lifts 8 px and drops back with a small bounce, then the keyhole glints.
import { setA, ease, easeBack, R } from '../icon-kit.js';

const SHACKLE = 'M-19,1 V-17 A19,19 0 0 1 19,-17 V1 H12 V-17 A12,12 0 0 0 -12,-17 V1 Z';
const KEYHOLE = 'M-2.6,19.6 A5.5,5.5 0 1 1 2.6,19.6 L3.4,29 H-3.4 Z';

export default {
  name: 'lock',
  box: [62, 94],
  draw: (id, T) => `<g id="${id}">
    <path id="${id}-sh" d="${SHACKLE}" fill="${T.neutral}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill2', 'outline')}/>
    <rect x="-28" y="-1" width="56" height="44" rx="7" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
    <path d="M-20,6 H20" stroke="${T.primaryDark}" stroke-width="2.4" stroke-linecap="round" ${R('none', 'detail')}/>
    <path d="${KEYHOLE}" fill="${T.paper}" stroke="${T.outline}" stroke-width="2" stroke-linejoin="round" ${R('paper', 'detail')}/>
    <circle id="${id}-glint" cx="-8" cy="12" r="2.4" fill="${T.accent}" opacity="0" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => {
    // up over 10 frames, hold, drop with a bounce; rest from frame 50
    const lift = f < 10 ? 0 : f < 20 ? 8 * ease((f - 10) / 10) : f < 40 ? 8 : f < 50 ? 8 * (1 - easeBack((f - 40) / 10)) : 0;
    setA(`${id}-sh`, { transform: `translate(0 ${(-lift).toFixed(3)})` });
    setA(`${id}-glint`, { opacity: f >= 54 && f < 60 ? 1 : 0 });
  },
};
