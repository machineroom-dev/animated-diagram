// laptop (the user's browser): the page bar loads, an image pops in, holds, clears.
import { setA, clamp, ease, easeBack, imageGlyph, R } from '../icon-kit.js';

export default {
  name: 'laptop',
  box: [124, 88],
  draw: (id, T) => `<g id="${id}">
    <clipPath id="${id}-scr"><rect x="-50" y="-42" width="100" height="64" rx="7" ${R('none', 'none')}/></clipPath>
    <rect x="-50" y="-42" width="100" height="64" rx="7" fill="${T.paper}" ${R('paper', 'none')}/>
    <g clip-path="url(#${id}-scr)"><rect x="-50" y="-42" width="100" height="13" fill="${T.primary}" ${R('fill2', 'none')}/></g>
    <line x1="-50" y1="-29" x2="50" y2="-29" stroke="${T.outline}" stroke-width="2.4" ${R('none', 'detail')}/>
    ${[-41, -34, -27].map(x => `<circle cx="${x}" cy="-35.5" r="2.3" fill="${T.paper}" ${R('paper', 'none')}/>`).join('')}
    <rect x="-17" y="-38.6" width="58" height="6.2" rx="3.1" fill="${T.paper}" opacity="0.9" ${R('paper', 'none')}/>
    <rect id="${id}-ph" x="-15" y="-23" width="30" height="22" rx="3" fill="none" stroke="${T.neutral}" stroke-width="1.8" stroke-dasharray="3.5 3" ${R('none', 'detail')}/>
    <g id="${id}-img">${imageGlyph(T, -15, -23, 30, 22)}</g>
    <rect x="-30" y="6" width="60" height="6.5" rx="3.25" fill="${T.tint}" ${R('fill', 'none')}/>
    <rect id="${id}-bar" x="-30" y="6" width="0" height="6.5" rx="3.25" fill="${T.primary}" ${R('accent', 'none')}/>
    <rect x="-50" y="-42" width="100" height="64" rx="7" fill="none" stroke="${T.outline}" stroke-width="3" ${R('none', 'outline')}/>
    <path d="M-60,22 H60 L54,31 Q53,33.5 50,33.5 H-50 Q-53,33.5 -54,31 Z" fill="${T.neutral}" stroke="${T.outline}" stroke-width="3" stroke-linejoin="round" ${R('fill', 'outline')}/>
    <path d="M-11,22.5 H11 Q11,26 8,26 H-8 Q-11,26 -11,22.5 Z" fill="${T.dark}" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => {
    const w = f < 8 ? 0 : f < 38 ? 60 * ease((f - 8) / 30) : f < 88 ? 60 : 0;
    const out = f < 80 ? 1 : 1 - ease((f - 80) / 7);
    const s = f < 38 ? 0 : f < 46 ? easeBack((f - 38) / 8) : out;
    setA(`${id}-bar`, { width: w, opacity: out });
    setA(`${id}-img`, { transform: `translate(0 -12) scale(${Math.max(0.001, s).toFixed(4)}) translate(0 12)`, opacity: clamp(s * 1.6) });
    setA(`${id}-ph`, { opacity: 1 - clamp(s * 1.6) });
  },
};
