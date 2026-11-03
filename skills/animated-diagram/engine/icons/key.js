// key: a key hanging from a ring on a hook; it swings ±12° about the ring.
import { setA, R } from '../icon-kit.js';

const BOW = 'M0,-31 A15,15 0 1 1 0,-1 A15,15 0 1 1 0,-31 Z M0,-26 A5,5 0 1 0 0,-16 A5,5 0 1 0 0,-26 Z';
const BLADE = 'M-5,-3 V37 H14 V30 H8 V27 H13 V20 H5 V-3 Z';

export default {
  name: 'key',
  box: [64, 90],
  draw: (id, T) => `<g id="${id}"><g transform="translate(0 4)">
    <circle cy="-45" r="2.8" fill="${T.outline}" ${R('accent', 'none')}/>
    <circle cy="-34" r="8.5" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'detail')}/>
    <g id="${id}-k">
      <path d="${BLADE}" fill="${T.amber}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill2', 'outline')}/>
      <path d="${BOW}" fill="${T.amber}" fill-rule="evenodd" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
      <path d="M0,4 V30" stroke="${T.dark}" stroke-width="2" stroke-linecap="round" opacity="0.55" ${R('none', 'detail')}/></g></g></g>`,
  loop: (id, f) => setA(`${id}-k`, { transform: `rotate(${(12 * Math.sin(2 * Math.PI * f / 90)).toFixed(3)} 0 -26)` }),
};
