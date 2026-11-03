// api: a cloud lettered API with three sockets below; the plugs push in one by one, then pull out in reverse, and
// each socket's light shows while it is plugged.
import { setA, ease, R } from '../icon-kit.js';

// three lobes (r 14, 19, 14) on a flat base; the arcs meet where the lobes cross
const CLOUD = 'M-22,12 A14,14 0 1 1 -18.82,-15.64 A19,19 0 0 1 18.82,-15.64 A14,14 0 1 1 22,12 Z';
const XS = [-18, 0, 18], TRAVEL = 8;
const plugIn = k => 6 + 10 * k, plugOut = k => 50 + 10 * (2 - k);      // in left → right, out right → left

export default {
  name: 'api',
  box: [78, 92],
  draw: (id, T) => `<g id="${id}"><g transform="translate(0 -11)">
    ${XS.map((x, k) => `<g id="${id}-p${k}">
      <rect x="${x - 4}" y="23" width="2.4" height="7" rx="1" fill="${T.outline}" ${R('accent', 'none')}/>
      <rect x="${x + 1.6}" y="23" width="2.4" height="7" rx="1" fill="${T.outline}" ${R('accent', 'none')}/>
      <line x1="${x}" y1="38" x2="${x}" y2="46" stroke="${T.outline}" stroke-width="2.4" stroke-linecap="round" ${R('none', 'detail')}/>
      <rect x="${x - 6}" y="29" width="12" height="9" rx="2" fill="${T.primary}" stroke="${T.outline}" stroke-width="2.4" ${R('fill2', 'outline')}/></g>`).join('')}
    ${XS.map(x => `<line x1="${x}" y1="12" x2="${x}" y2="19" stroke="${T.outline}" stroke-width="2.4" ${R('none', 'detail')}/>`).join('')}
    ${XS.map((x, k) => `
      <rect x="${x - 7}" y="19" width="14" height="10" rx="2.5" fill="${T.paper}" stroke="${T.outline}" stroke-width="2.4" ${R('paper', 'outline')}/>
      <circle cx="${x}" cy="24" r="2.2" fill="${T.neutral}" ${R('fill', 'none')}/>
      <circle id="${id}-l${k}" cx="${x}" cy="24" r="2.2" fill="${T.hit}" opacity="0" ${R('accent', 'none')}/>`).join('')}
    <path d="${CLOUD}" fill="${T.tint}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill', 'outline')}/>
    <text y="3" text-anchor="middle" font-size="16" font-weight="800" letter-spacing="0.6" fill="${T.outline}">API</text></g></g>`,
  loop: (id, f) => {
    for (let k = 0; k < 3; k++) {
      const a = plugIn(k), b = plugOut(k);
      const dy = f < a ? TRAVEL : f < a + 8 ? TRAVEL * (1 - ease((f - a) / 8)) : f < b ? 0 : f < b + 8 ? TRAVEL * ease((f - b) / 8) : TRAVEL;
      setA(`${id}-p${k}`, { transform: `translate(0 ${dy.toFixed(3)})` });
      setA(`${id}-l${k}`, { opacity: dy < 0.5 ? 1 : 0 });
    }
  },
};
