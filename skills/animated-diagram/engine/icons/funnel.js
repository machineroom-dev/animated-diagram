// funnel: candidates drop in at the top and the best one comes out of the spout. Three dots fall on a 45-frame cycle,
// one drops out below on a 30-frame cycle, so the picture repeats after 90.
import { setA, R } from '../icon-kit.js';

const IN = [[-16, 'amber'], [2, 'hit'], [17, 'miss']];

export default {
  name: 'funnel',
  box: [84, 108],
  draw: (id, T) => `<g id="${id}">
    ${IN.map(([x, c], i) => `<circle id="${id}-d${i}" cx="${x}" cy="0" r="6" fill="${T[c]}" stroke="${T.outline}" stroke-width="1.8" ${R('accent', 'detail')}/>`).join('')}
    <circle id="${id}-out" cx="0" cy="0" r="6" fill="${T.hit}" stroke="${T.outline}" stroke-width="1.8" ${R('accent', 'detail')}/>
    <path d="M-38,-26 H38 L9,8 V26 L-9,32 V8 Z" fill="${T.tint}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill', 'outline')}/>
    <path d="M-38,-26 H38 L31.5,-18 H-31.5 Z" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill2', 'outline')}/></g>`,
  loop: (id, f) => {
    IN.forEach((_, i) => {
      const t = ((f / 45 + i / 3) % 1 + 1) % 1;
      setA(`${id}-d${i}`, { transform: `translate(0 ${(-46 + 30 * t).toFixed(3)})` });       // ends hidden behind the rim
    });
    const t = ((f / 30) % 1 + 1) % 1;
    setA(`${id}-out`, { transform: `translate(0 ${(22 + 24 * t).toFixed(3)})`, opacity: t < 0.92 ? 1 : 0 });
  },
};
