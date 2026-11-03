// edge server: a 3-unit rack, the status LEDs chase, the lightning badge pulses twice.
import { setA, bump, R } from '../icon-kit.js';

export default {
  name: 'rack',
  box: [132, 128],
  draw: (id, T) => `<g id="${id}">
    ${[-38, -12, 14].map((y, u) => `<rect x="-44" y="${y}" width="88" height="24" rx="5" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
      <path d="M-34,${y + 9} H-10 M-34,${y + 15} H-10" fill="none" stroke="${T.outline}" stroke-width="2.4" stroke-linecap="round" ${R('none', 'detail')}/>
      ${[0, 1].map(j => `<circle cx="${20 + j * 11}" cy="${y + 12}" r="3.4" fill="${T.neutral}" stroke="${T.outline}" stroke-width="1.6" ${R('fill', 'detail')}/>
        <circle id="${id}-l${u * 2 + j}" cx="${20 + j * 11}" cy="${y + 12}" r="2.6" fill="${T.hit}" opacity="0" ${R('accent', 'none')}/>`).join('')}`).join('')}
    <g transform="translate(47 -45)"><g id="${id}-bolt"><circle r="15" fill="${T.amber}" stroke="${T.outline}" stroke-width="2.6" ${R('accent', 'outline')}/>
      <path d="M3,-9.5 L-6.5,2 H-0.5 L-3,10 L7,-2.5 H1 Z" fill="${T.dark}" stroke="${T.dark}" stroke-width="1" stroke-linejoin="round" ${R('fill', 'detail')}/></g></g></g>`,
  loop: (id, f) => {
    for (let i = 0; i < 6; i++) { const p = ((f / 30 + i / 6) % 1 + 1) % 1; setA(`${id}-l${i}`, { opacity: p < 0.34 ? 1 : 0 }); }
    setA(`${id}-bolt`, { transform: `scale(${(1 + 0.16 * bump(f, 6, 12) + 0.16 * bump(f, 51, 12)).toFixed(4)})` });
  },
};
