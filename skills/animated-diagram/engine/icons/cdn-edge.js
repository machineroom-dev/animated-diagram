// cdn edge: a globe with three location pins; each pin drops in with a small bounce, staggered, then lifts out.
import { setA, clamp, ease, easeBack, R } from '../icon-kit.js';

const PINS = [[-15, -3], [13, -13], [6, 19]];   // pin tips on the globe
const PIN = 'M0,0 C-2.5,-4.5 -7,-8 -7,-13 A7,7 0 1 1 7,-13 C7,-8 2.5,-4.5 0,0 Z';
const LIFT = 10;

export default {
  name: 'cdn-edge',
  box: [78, 96],
  draw: (id, T) => `<g id="${id}">
    <clipPath id="${id}-c"><circle r="35" ${R('none', 'none')}/></clipPath>
    <circle r="36" fill="${T.tint}" ${R('fill', 'none')}/>
    <g clip-path="url(#${id}-c)">
      ${[-15, 0, 15].map(y => `<path d="M-40,${y} H40" fill="none" stroke="${T.primary}" stroke-width="2.2" ${R('none', 'detail')}/>`).join('')}
      <ellipse rx="15" ry="36" fill="none" stroke="${T.primary}" stroke-width="2.2" ${R('none', 'detail')}/>
      <path d="M0,-40 V40" fill="none" stroke="${T.primary}" stroke-width="2.2" ${R('none', 'detail')}/></g>
    <circle r="36" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'outline')}/>
    ${PINS.map(([x, y], k) => `<g transform="translate(${x} ${y})"><g id="${id}-p${k}" opacity="0">
      <path d="${PIN}" fill="${T.miss}" stroke="${T.outline}" stroke-width="2.4" stroke-linejoin="round" ${R('accent', 'outline')}/>
      <circle cy="-13" r="2.8" fill="${T.paper}" ${R('paper', 'none')}/></g></g>`).join('')}</g>`,
  loop: (id, f) => {
    for (let k = 0; k < 3; k++) {
      const d = 4 + 8 * k, l = 56 + 8 * k;
      let y = -LIFT, o = 0;
      if (f >= d && f < l) { y = -LIFT + LIFT * easeBack((f - d) / 10); o = clamp((f - d) / 3); }
      else if (f >= l) { const t = ease(clamp((f - l) / 8)); y = -LIFT * t; o = 1 - t; }
      setA(`${id}-p${k}`, { transform: `translate(0 ${y.toFixed(3)})`, opacity: +o.toFixed(3) });
    }
  },
};
