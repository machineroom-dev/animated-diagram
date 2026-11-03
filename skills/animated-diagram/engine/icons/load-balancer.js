// load balancer: a hub with three outgoing spokes. Round robin: the hub's needle swings to the next spoke, a request
// dot travels down it, and the server it reaches lights.
import { setA, ease, clamp, R } from '../icon-kit.js';

const PORTS = [-10, 0, 10], TARGETS = [-34, 0, 34], PY = -11, TY = 21, DIAL = -24;
const AIM = [40, 0, -40];                        // needle angle per spoke (0 = straight down, clockwise positive)

export default {
  name: 'load-balancer',
  box: [96, 80],
  draw: (id, T) => `<g id="${id}">
    ${PORTS.map((p, k) => `<line x1="${p}" y1="${PY}" x2="${TARGETS[k]}" y2="${TY}" stroke="${T.outline}" stroke-width="2.6" stroke-linecap="round" ${R('none', 'detail')}/>`).join('')}
    ${TARGETS.map((x, k) => `
      <rect x="${x - 11}" y="${TY}" width="22" height="16" rx="4" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
      <rect id="${id}-t${k}" x="${x - 8.5}" y="${TY + 2.5}" width="17" height="11" rx="2" fill="${T.hit}" opacity="0" ${R('accent', 'none')}/>
      <path d="M${x - 6},${TY + 6} H${x + 2} M${x - 6},${TY + 10} H${x + 5}" stroke="${T.outline}" stroke-width="2" stroke-linecap="round" ${R('none', 'detail')}/>`).join('')}
    ${PORTS.map((p, k) => `<circle id="${id}-p${k}" cx="${p}" cy="${PY + 2}" r="5" fill="${T.amber}" stroke="${T.outline}" stroke-width="2" opacity="0" ${R('accent', 'detail')}/>`).join('')}
    <rect x="-22" y="-37" width="44" height="26" rx="7" fill="${T.primary}" stroke="${T.outline}" stroke-width="3" ${R('fill2', 'outline')}/>
    <circle cy="${DIAL}" r="9" fill="${T.paper}" stroke="${T.outline}" stroke-width="2" ${R('paper', 'detail')}/>
    <line id="${id}-needle" x1="0" y1="${DIAL - 2}" x2="0" y2="${DIAL + 6.5}" stroke="${T.miss}" stroke-width="3" stroke-linecap="round" ${R('none', 'accent')}/>
    <circle cy="${DIAL}" r="2.4" fill="${T.outline}" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => {
    const k = Math.floor(f / 30) % 3, t = f - 30 * Math.floor(f / 30), prev = (k + 2) % 3;
    setA(`${id}-needle`, { transform: `rotate(${(AIM[prev] + (AIM[k] - AIM[prev]) * ease(clamp(t / 6))).toFixed(3)} 0 ${DIAL})` });
    for (let i = 0; i < 3; i++) {
      const on = i === k && t >= 6 && t < 24, u = ease(clamp((t - 6) / 16));
      setA(`${id}-p${i}`, { opacity: on ? 1 : 0, transform: `translate(${on ? ((TARGETS[i] - PORTS[i]) * u).toFixed(3) : 0} ${on ? ((TY - PY - 2) * u).toFixed(3) : 0})` });
      setA(`${id}-t${i}`, { opacity: i === k && t >= 22 ? 1 : 0 });
    }
  },
};
