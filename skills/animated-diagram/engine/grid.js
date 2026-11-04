// grid.js — what the grid layouts share: placing rows, handing out zones, and how a step's label and arrow are styled.
import { TYPE } from './engine.js';

const EDGE = 0.25;          // a panel edge gets this share of a gap between rows (0 = rows touch the edges)
const LABEL_STYLE = { hit: ['hitText', 640], miss: ['missText', 640], retry: ['missText', 640] };

// Rows: each row's anchor sits below its tallest top part; the free height is shared by the gaps between rows, with a
// quarter-gap at each panel edge (the spike's spread), so no band outgrows a row.
//   nodes: [{ id, cell }]; measured: id -> { h, ay }; extraTop, extraBottom: id -> px a group or band adds around a node.
export function rowTracks(nodes, rows, measured, extraTop, extraBottom, inner) {
  const up = Array(rows).fill(0), down = Array(rows).fill(0), used = Array(rows).fill(false);
  for (const n of nodes) {
    const r = n.cell[1], mm = measured.get(n.id);
    used[r] = true;
    up[r] = Math.max(up[r], mm.ay + (extraTop.get(n.id) ?? 0));
    down[r] = Math.max(down[r], mm.h - mm.ay + (extraBottom.get(n.id) ?? 0));
  }
  const content = up.reduce((s, v, i) => s + v + down[i], 0), spare = inner.h - content;
  const gaps = rows - 1 + 2 * EDGE, gap = rows > 1 ? spare / gaps : 0;
  const rowY = [];
  let y = rows > 1 ? inner.y + EDGE * gap : inner.y + spare / 2;
  for (let r = 0; r < rows; r++) { rowY.push(y + up[r]); y += up[r] + down[r] + gap; }
  return { up, down, used, spare, gap, rowY };
}

// Hands each group (or stack band) its zone: its own colour, else the next in the theme's order that nothing has claimed.
export function assignZones(scene, groups) {
  const taken = new Set(groups.map(g => g.color).filter(Boolean)), free = scene.zoneOrder.filter(z => !taken.has(z));
  let next = 0;
  return groups.map(g => scene.zones[g.color ?? free[next++ % free.length]]);
}

// A step's label: the theme token for its colour, and its weight.
export const labelStyle = step => LABEL_STYLE[step.kind ?? 'normal'] ?? (step.n === undefined ? ['muted', 480] : ['ink', TYPE.step[1]]);

// Which steps pair up: a step whose from/to swap an earlier unpaired step's. The reply is the one marked reply: true,
// else the later one. Returns, per step index, { role: 'single' | 'request' | 'reply', partner }.
export function pairSteps(steps) {
  const out = steps.map(() => ({ role: 'single', partner: null }));
  steps.forEach((s, i) => {
    const j = steps.findIndex((t, jj) => jj < i && out[jj].role === 'single' && t.from === s.to && t.to === s.from);
    if (j < 0) return;
    const [req, rep] = steps[j].reply && !s.reply ? [i, j] : [j, i];
    out[req] = { role: 'request', partner: rep }; out[rep] = { role: 'reply', partner: req };
  });
  return out;
}

// Short dashes: the reply half of a pair, a lone step marked reply, or a retry.
export const isShort = (step, role) => role === 'reply' || (role === 'single' && step.reply === true) || step.kind === 'retry';
