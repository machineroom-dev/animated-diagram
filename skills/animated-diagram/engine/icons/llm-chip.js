// llm chip: a square chip with four pins a side and an LLM core; a light runs around the pins clockwise, one lap per
// loop, and a ring round the core glows twice.
import { setA, R } from '../icon-kit.js';

const OFFS = [-15, -5, 5, 15];
// pins in clockwise order from the top-left: [x, y, w, h]
const PINS = [
  ...OFFS.map(o => [o - 2.5, -36, 5, 10]), ...OFFS.map(o => [26, o - 2.5, 10, 5]),
  ...OFFS.slice().reverse().map(o => [o - 2.5, 26, 5, 10]), ...OFFS.slice().reverse().map(o => [-36, o - 2.5, 10, 5]),
];

export default {
  name: 'llm-chip',
  box: [78, 78],
  draw: (id, T) => `<g id="${id}">
    ${PINS.map(([x, y, w, h], j) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${T.neutral}" stroke="${T.outline}" stroke-width="2" ${R('fill', 'detail')}/>
      <rect id="${id}-p${j}" x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="1" fill="${T.amber}" opacity="0" ${R('accent', 'none')}/>`).join('')}
    <rect x="-26" y="-26" width="52" height="52" rx="6" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
    <rect x="-15" y="-15" width="30" height="30" rx="4" fill="${T.tint}" ${R('fill', 'none')}/>
    <rect x="-15" y="-15" width="30" height="30" rx="4" fill="none" stroke="${T.outline}" stroke-width="2.2" ${R('none', 'detail')}/>
    <rect id="${id}-glow" x="-19.5" y="-19.5" width="39" height="39" rx="6" fill="none" stroke="${T.accent}" stroke-width="2.6" opacity="0" ${R('none', 'accent')}/>
    <text y="4" text-anchor="middle" font-size="11" font-weight="800" letter-spacing="0.3" fill="${T.outline}">LLM</text></g>`,
  loop: (id, f) => {
    const head = 16 * f / 90;                                   // the pulse's position along the 16 pins
    for (let j = 0; j < 16; j++) {
      const d = (head - j + 16) % 16;                            // how far the light has passed pin j
      setA(`${id}-p${j}`, { opacity: d < 2 ? 1 : 0 });            // crisp: the lit pin and the one behind it
    }
    setA(`${id}-glow`, { opacity: +(0.5 - 0.5 * Math.cos(2 * Math.PI * f / 45)).toFixed(3) });
  },
};
