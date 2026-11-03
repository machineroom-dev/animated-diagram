// queue: a pipe holding four message blocks; every 22.5 frames they step one slot right, the rightmost leaves and
// a new one enters on the left (4 steps a loop, so the picture tiles).
import { setA, clamp, ease, R } from '../icon-kit.js';

const BLOCKS = [['primary', 'fill2'], ['amber', 'accent'], ['primary', 'fill2'], ['hit', 'accent']];
const PITCH = 20;

const block = (T, [c, role]) => `
  <rect x="-7" y="-11" width="14" height="22" rx="3" fill="${T[c]}" stroke="${T.outline}" stroke-width="2.2" ${R(role, 'detail')}/>
  <rect x="-4" y="-5.5" width="8" height="2.4" rx="1.2" fill="${T.paper}" ${R('paper', 'none')}/>
  <rect x="-4" y="-0.5" width="5" height="2.4" rx="1.2" fill="${T.paper}" ${R('paper', 'none')}/>`;

export default {
  name: 'queue',
  box: [112, 48],
  draw: (id, T) => `<g id="${id}">
    <rect x="-42" y="-18" width="84" height="36" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
    <clipPath id="${id}-in"><rect x="-40" y="-16.5" width="80" height="33" ${R('none', 'none')}/></clipPath>
    <g clip-path="url(#${id}-in)">
      ${BLOCKS.map((b, j) => `<g id="${id}-b${j}"><g>${block(T, b)}</g><g transform="translate(${-4 * PITCH} 0)">${block(T, b)}</g></g>`).join('')}</g>
    ${[-54, 40].map(x => `<rect x="${x}" y="-22" width="14" height="44" rx="4" fill="${T.neutral}" stroke="${T.outline}" stroke-width="3" ${R('fill', 'outline')}/>`).join('')}</g>`,
  loop: (id, f) => {
    const step = Math.floor(f / 22.5), s = step + ease(clamp((f - 22.5 * step) / 10));
    // block j sits in slot (j + s) mod 4; its twin, 4 slots to the left, enters while it leaves on the right
    for (let j = 0; j < 4; j++) setA(`${id}-b${j}`, { transform: `translate(${(-30 + PITCH * ((j + s) % 4)).toFixed(3)} 0)` });
  },
};
