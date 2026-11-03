// user: head and shoulders in a ring; the head tilts −8° → +8° and back, the shoulders bob 3 px.
import { setA, R } from '../icon-kit.js';

export default {
  name: 'user',
  box: [96, 96],
  draw: (id, T) => `<g id="${id}">
    <clipPath id="${id}-ring"><circle r="42.6" ${R('none', 'none')}/></clipPath>
    <circle r="44" fill="${T.tint}" ${R('fill', 'none')}/>
    <g clip-path="url(#${id}-ring)"><g id="${id}-body">
      <path d="M-31,50 C-31,25 -18,15 0,15 C18,15 31,25 31,50 Z" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill2', 'outline')}/>
      <path d="M-7,18 L0,25.5 L7,18" fill="none" stroke="${T.outline}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${R('none', 'detail')}/>
      <g id="${id}-head">
        <clipPath id="${id}-face"><circle cy="-9" r="16" ${R('none', 'none')}/></clipPath>
        <circle cy="-9" r="16" fill="${T.paper}" ${R('fill2', 'none')}/>
        <path clip-path="url(#${id}-face)" d="M-19,-5 Q-7,-21 6,-15 Q12,-12.5 19,-15 V-30 H-19 Z" fill="${T.dark}" stroke="${T.outline}" stroke-width="2.4" stroke-linejoin="round" ${R('accent', 'detail')}/>
        <circle cy="-9" r="16" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'outline')}/>
      </g></g></g>
    <circle r="44" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'outline')}/></g>`,
  loop: (id, f) => {
    const bob = 1.5 * (1 - Math.cos(4 * Math.PI * f / 90));             // 0 → 3 px, twice a loop
    setA(`${id}-body`, { transform: `translate(0 ${bob.toFixed(3)})` });
    setA(`${id}-head`, { transform: `rotate(${(8 * Math.sin(2 * Math.PI * f / 90)).toFixed(3)} 0 8)` });
  },
};
