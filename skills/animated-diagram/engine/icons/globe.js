// globe with a DNS tag: the meridians turn (60° per loop, so it tiles), the tag rocks.
import { setA, R } from '../icon-kit.js';

export default {
  name: 'globe',
  box: [114, 86],
  draw: (id, T) => `<g id="${id}">
    <clipPath id="${id}-c"><circle r="37" ${R('none', 'none')}/></clipPath>
    <circle r="38" fill="${T.tint}" ${R('fill', 'none')}/>
    <g clip-path="url(#${id}-c)">
      ${[-19, 0, 19].map(y => `<path d="M-40,${y} H40" fill="none" stroke="${T.primary}" stroke-width="2.4" ${R('none', 'detail')}/>`).join('')}
      ${[0, 1, 2, 3].map(k => `<path id="${id}-m${k}" d="" fill="none" stroke="${T.primary}" stroke-width="2.4" ${R('none', 'detail')}/>`).join('')}</g>
    <circle r="38" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'outline')}/>
    <g id="${id}-tag"><rect x="6" y="14" width="46" height="24" rx="6" fill="${T.amber}" stroke="${T.outline}" stroke-width="2.6" ${R('accent', 'outline')}/>
      <text x="29" y="31" text-anchor="middle" font-size="13.5" font-weight="800" letter-spacing="0.4" fill="${T.dark}">DNS</text></g></g>`,
  loop: (id, f) => {
    // meridians every 60° of longitude; the globe turns 60° per loop, so the picture tiles. A meridian at longitude
    // λ projects to a half-ellipse of rx = R·|sin λ| on the side of sin λ; |λ| > 90° is the far side (hidden).
    const th = (f / 90) * Math.PI / 3;
    for (let k = 0; k < 4; k++) {
      const lam = th + (k - 1.5) * Math.PI / 3, s = Math.sin(lam), rx = Math.max(0.8, 38 * Math.abs(s));
      setA(`${id}-m${k}`, { d: Math.abs(lam) < Math.PI / 2 ? `M0,-38 A${rx.toFixed(3)},38 0 0 ${s >= 0 ? 1 : 0} 0,38` : '' });
    }
    setA(`${id}-tag`, { transform: `rotate(${(5 * Math.sin(2 * Math.PI * f / 90)).toFixed(3)} 29 26)` });
  },
};
