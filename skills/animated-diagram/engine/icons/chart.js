// chart: a dashboard panel whose bars rise and fall in a wave on a 45-frame cycle.
import { setA, R } from '../icon-kit.js';

const BARS = [[-27, 'primary', 'fill2', 0], [-11, 'amber', 'accent', 0.25], [5, 'primary', 'fill2', 0.5], [21, 'hit', 'accent', 0.75]];
const FLOOR = 26, WIDTH = 11;
const heightAt = (f, phase) => 26 + 13 * Math.sin(2 * Math.PI * (f / 45 + phase));

export default {
  name: 'chart',
  box: [88, 76],
  draw: (id, T) => `<g id="${id}">
    <rect x="-42" y="-36" width="84" height="72" rx="9" fill="${T.paper}" stroke="${T.outline}" stroke-width="3" ${R('paper', 'outline')}/>
    <path d="M-33,${FLOOR + 1} H33" fill="none" stroke="${T.outline}" stroke-width="2.4" stroke-linecap="round" ${R('none', 'detail')}/>
    ${BARS.map(([x, c, role], i) => `<rect id="${id}-b${i}" x="${x}" width="${WIDTH}" rx="2" fill="${T[c]}" stroke="${T.outline}" stroke-width="1.8" ${R(role, 'detail')}/>`).join('')}</g>`,
  loop: (id, f) => {
    BARS.forEach(([, , , phase], i) => { const h = heightAt(f, phase); setA(`${id}-b${i}`, { y: FLOOR - h, height: h }); });
  },
};
