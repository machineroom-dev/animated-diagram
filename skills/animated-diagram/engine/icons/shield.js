// shield: a shield with a keyhole emblem; a highlight band sweeps across it diagonally once, and the emblem pulses
// twice a loop.
import { setA, clamp, ease, R } from '../icon-kit.js';

const SHIELD = 'M0,-42 L34,-30 V-4 C34,20 18,34 0,42 C-18,34 -34,20 -34,-4 V-30 Z';
const INNER = 'M0,-32.5 L25.5,-23.5 V-3 C25.5,15 13.5,25.5 0,31.5 C-13.5,25.5 -25.5,15 -25.5,-3 V-23.5 Z';
const KEYHOLE = 'M-3.6,4 A8,8 0 1 1 3.6,4 L5,17 H-5 Z';

export default {
  name: 'shield',
  box: [72, 88],
  draw: (id, T) => `<g id="${id}">
    <clipPath id="${id}-c"><path d="${SHIELD}" ${R('none', 'none')}/></clipPath>
    <path d="${SHIELD}" fill="${T.primary}" ${R('fill2', 'none')}/>
    <path d="${INNER}" fill="${T.tint}" ${R('fill', 'none')}/>
    <g clip-path="url(#${id}-c)"><rect id="${id}-band" x="-8" y="-80" width="14" height="160" fill="${T.accent}" opacity="0" ${R('accent', 'none')}/></g>
    <path d="${INNER}" fill="none" stroke="${T.outline}" stroke-width="2" ${R('none', 'detail')}/>
    <path d="${SHIELD}" fill="none" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('none', 'outline')}/>
    <g transform="translate(0 -3)"><path id="${id}-em" d="${KEYHOLE}" fill="${T.paper}" stroke="${T.outline}" stroke-width="2.4" stroke-linejoin="round" ${R('paper', 'detail')}/></g></g>`,
  loop: (id, f) => {
    const t = clamp((f - 8) / 26), on = f >= 8 && f < 34;               // one diagonal sweep, left to right
    setA(`${id}-band`, { opacity: on ? 0.55 : 0, transform: `translate(${(-60 + 120 * ease(t)).toFixed(3)} 0) rotate(30)` });
    setA(`${id}-em`, { transform: `scale(${(1 + 0.16 * (0.5 - 0.5 * Math.cos(2 * Math.PI * f / 45))).toFixed(4)})` });
  },
};
