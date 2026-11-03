// cache: a cylinder; a file card drops in through the top, the bands light, it rises out.
import { setA, kf, easeBack, imageGlyph, R } from '../icon-kit.js';

export default {
  name: 'cache',
  box: [80, 148],
  draw: (id, T) => `<g id="${id}">
    <path d="M-38,-24 V30 A38,11 0 0 0 38,30 V-24" fill="${T.tint}" stroke="${T.outline}" stroke-width="3" ${R('fill', 'outline')}/>
    <path d="M-38,-5 A38,11 0 0 0 38,-5" fill="none" stroke="${T.outline}" stroke-width="2.4" ${R('none', 'detail')}/>
    <path d="M-38,13 A38,11 0 0 0 38,13" fill="none" stroke="${T.outline}" stroke-width="2.4" ${R('none', 'detail')}/>
    <path id="${id}-b0" d="M-38,-5 A38,11 0 0 0 38,-5" fill="none" stroke="${T.hit}" stroke-width="3.4" opacity="0" ${R('none', 'accent')}/>
    <path id="${id}-b1" d="M-38,13 A38,11 0 0 0 38,13" fill="none" stroke="${T.hit}" stroke-width="3.4" opacity="0" ${R('none', 'accent')}/>
    <ellipse cy="-24" rx="38" ry="11" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
    <ellipse cy="-24" rx="27" ry="6.2" fill="${T.primaryDark}" ${R('fill', 'none')}/>
    <clipPath id="${id}-c"><rect x="-40" y="-130" width="80" height="106" ${R('none', 'none')}/></clipPath>
    <g clip-path="url(#${id}-c)"><g id="${id}-card">
      <path d="M-14,-34 V-2 H14 V-27 L7,-34 Z" fill="${T.paper}" stroke="${T.outline}" stroke-width="2.4" stroke-linejoin="round" ${R('paper', 'detail')}/>
      <path d="M7,-34 V-27 H14" fill="none" stroke="${T.outline}" stroke-width="2" ${R('none', 'detail')}/>
      ${imageGlyph(T, -9, -24, 18, 14)}</g></g></g>`,
  loop: (id, f) => {
    const bob = 2 * Math.sin(2 * Math.PI * f / 90);
    const dy = kf(f, [[16, -28], [32, 40], [56, 40]]) + (f > 56 ? -68 * easeBack((f - 56) / 16) : 0);
    setA(`${id}-card`, { transform: `translate(0 ${(dy + bob).toFixed(3)})` });
    setA(`${id}-b0`, { opacity: f >= 33 && f < 49 ? 1 : 0 });
    setA(`${id}-b1`, { opacity: f >= 37 && f < 53 ? 1 : 0 });
  },
};
