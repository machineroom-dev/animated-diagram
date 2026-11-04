// vector: text turned into a point in space. Axes with a scatter of points; an arrow from the origin swings to one point and
// back on a 45-frame cycle, and the point it reaches lights up.
import { setA, kf, R } from '../icon-kit.js';

const POINTS = [[-8, -20], [8, -28], [18, -8], [-14, 2], [24, 10]];
const ORIGIN = [-27, 27];
const TARGET = 2;                                  // the point the arrow reaches

export default {
  name: 'vector',
  box: [84, 84],
  draw: (id, T) => `<g id="${id}">
    <rect x="-40" y="-40" width="80" height="80" rx="9" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
    <path d="M${ORIGIN[0]},-31 V${ORIGIN[1]} H31" fill="none" stroke="${T.outline}" stroke-width="2.4" stroke-linecap="round" ${R('none', 'detail')}/>
    ${POINTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${T.primary}" stroke="${T.outline}" stroke-width="1.6" ${R('fill2', 'detail')}/>`).join('')}
    <circle id="${id}-lit" cx="${POINTS[TARGET][0]}" cy="${POINTS[TARGET][1]}" r="5.5" fill="${T.hit}" stroke="${T.outline}" stroke-width="1.8" opacity="0" ${R('accent', 'detail')}/>
    <g transform="translate(${ORIGIN[0]} ${ORIGIN[1]})"><g id="${id}-arrow">
      <path d="M0,0 H42" fill="none" stroke="${T.amber}" stroke-width="3.4" stroke-linecap="round" ${R('none', 'accent')}/>
      <path d="M38,-5 L46,0 L38,5 Z" fill="${T.amber}" stroke="${T.amber}" stroke-width="1.6" stroke-linejoin="round" ${R('accent', 'accent')}/></g></g></g>`,
  loop: (id, f) => {
    const t = ((f % 45) + 45) % 45, a = kf(t, [[0, -12], [18, -46], [27, -46], [45, -12]]);
    setA(`${id}-arrow`, { transform: `rotate(${a.toFixed(3)})` });
    setA(`${id}-lit`, { opacity: t >= 16 && t < 30 ? 1 : 0 });
  },
};
