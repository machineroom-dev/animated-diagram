// phone: a handset with an app screen; a notification card slides down from the top edge, holds, slides back.
import { setA, ease, easeBack, R } from '../icon-kit.js';

const APPS = ['primary', 'amber', 'hit', 'miss', 'primary', 'amber'];   // accent: the tiles keep their colour in line style

export default {
  name: 'phone',
  box: [62, 100],
  draw: (id, T) => `<g id="${id}">
    <rect x="-28" y="-46" width="56" height="92" rx="10" fill="${T.neutral}" stroke="${T.outline}" stroke-width="3" ${R('fill', 'outline')}/>
    <clipPath id="${id}-scr"><rect x="-21" y="-37" width="42" height="72" rx="4" ${R('none', 'none')}/></clipPath>
    <rect x="-21" y="-37" width="42" height="72" rx="4" fill="${T.paper}" ${R('paper', 'none')}/>
    <g clip-path="url(#${id}-scr)">
      <rect x="-15" y="-31" width="16" height="3" rx="1.5" fill="${T.neutral}" ${R('fill', 'none')}/>
      ${APPS.map((c, i) => `<rect x="${-15 + (i % 3) * 11}" y="${-6 + Math.floor(i / 3) * 12}" width="8.5" height="8.5" rx="2.5" fill="${T[c]}" ${R('accent', 'none')}/>`).join('')}
      <g id="${id}-note">
        <rect x="-18" y="-34" width="36" height="17" rx="4" fill="${T.paper}" stroke="${T.outline}" stroke-width="2.2" ${R('paper', 'detail')}/>
        <circle cx="-11" cy="-25.5" r="3.6" fill="${T.primary}" ${R('accent', 'none')}/>
        <rect x="-5" y="-29" width="17" height="2.6" rx="1.3" fill="${T.outline}" ${R('accent', 'none')}/>
        <rect x="-5" y="-23.6" width="11" height="2.6" rx="1.3" fill="${T.neutral}" ${R('fill', 'none')}/>
      </g></g>
    <rect x="-21" y="-37" width="42" height="72" rx="4" fill="none" stroke="${T.outline}" stroke-width="2.2" ${R('none', 'detail')}/>
    <rect x="-7" y="-42.6" width="14" height="2.6" rx="1.3" fill="${T.dark}" ${R('accent', 'none')}/>
    <rect x="-8" y="39.4" width="16" height="2.6" rx="1.3" fill="${T.dark}" ${R('accent', 'none')}/></g>`,
  loop: (id, f) => {
    // hidden 20 px above the screen at f0; drops in with a small overshoot, holds, slides back up
    const dy = f < 8 ? -20 : f < 22 ? -20 + 20 * easeBack((f - 8) / 14) : f < 62 ? 0 : f < 74 ? -20 * ease((f - 62) / 12) : -20;
    setA(`${id}-note`, { transform: `translate(0 ${dy.toFixed(3)})` });
  },
};
