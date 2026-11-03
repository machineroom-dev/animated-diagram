import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

const fixture = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
const theme = name => JSON.parse(fs.readFileSync(`skills/animated-diagram/themes/${name}.json`, 'utf8'));

let page, done;
before(async () => { ({ page, done } = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 } })); });
after(async () => { await done?.(); });

// Boots the render page on a diagram and returns what the test needs from window.composition.
const boot = (diagram, th = 'machine-room-dark') => page.evaluate(async ([d, t]) => {
  await window.boot(d, t, { style: 'filled', localIcons: [] });
  const c = window.composition, L = c.panels[0].layout;
  return { frame: c.panels[0].frame, nodes: L.nodes, arrows: L.arrows, groups: L.groups, cellH: L.cellH,
    labels: window.scene.labels.map(l => ({ id: l.id, lines: l.lines, box: l.box, overflow: l.overflow, text: l.text })) };
}, [diagram, theme(th)]);

test('cdn lays out like the spike', async () => {
  const r = await boot(fixture('cdn'));
  const want = [[300, 262], [780, 262], [300, 672], [780, 672], [300, 1082], [780, 1082]];
  assert.equal(r.nodes.length, 6);
  r.nodes.forEach((n, i) => assert.ok(Math.hypot(n.cx - want[i][0], n.cy - want[i][1]) <= 40, `${n.id} at (${n.cx.toFixed(1)}, ${n.cy.toFixed(1)}), spike (${want[i]})`));
});

test('pairs', async () => {
  const r = await boot(fixture('cdn'));
  const req = r.arrows.find(a => a.step === 2), rep = r.arrows.find(a => a.step === 7);     // steps n = 3 and n = 7
  for (const a of [req, rep]) assert.ok(a.points.every(p => Math.abs(p[0] - a.points[0][0]) < 1e-6), `${a.id} is vertical`);
  assert.ok(Math.abs(Math.abs(rep.points[0][0] - req.points[0][0]) - 40) < 1e-6, `40 apart: ${req.points[0][0]} ${rep.points[0][0]}`);
  assert.equal(req.short, false);
  assert.equal(rep.short, true);
  assert.ok(req.points[0][1] < req.points.at(-1)[1], 'the request runs down, user → edge');
});

test('no empty band', async () => {
  const r = await boot(fixture('cdn'));
  const blocks = r.nodes.map(n => n.box).sort((a, b) => a.y - b.y);
  for (let i = 1; i < blocks.length; i++) {
    const above = Math.max(...blocks.slice(0, i).map(b => b.y + b.h)), gap = blocks[i].y - above;
    assert.ok(gap <= r.cellH, `gap ${gap.toFixed(1)} > cell ${r.cellH.toFixed(1)}`);
  }
});

test('long label wraps', async () => {
  const d = fixture('cdn'), text = 'MISS: fetch the file from origin servers';
  assert.equal(text.length, 40);
  d.panels[0].steps[5].label = text;
  const r = await boot(d);
  const L = r.labels.find(l => l.text === text), f = r.frame;
  assert.equal(L.lines, 2);
  assert.equal(L.overflow, false);
  assert.ok(L.box.x >= f.x && L.box.y >= f.y && L.box.x + L.box.w <= f.x + f.w && L.box.y + L.box.h <= f.y + f.h, JSON.stringify(L.box));
});

test('group title sits in its band, clear of the arrows', async () => {
  const r = await boot(fixture('cdn'));
  const [g] = r.groups;
  assert.equal(g.label, 'EDGE PoP · CLOSE TO THE USER');
  const members = r.nodes.filter(n => ['edge', 'cache'].includes(n.id)).map(n => n.box);
  for (const b of members) assert.ok(b.x >= g.x && b.y >= g.y && b.x + b.w <= g.x + g.w && b.y + b.h <= g.y + g.h, 'members inside the group');
  assert.ok(g.title.y + g.title.h <= Math.min(...members.map(b => b.y)), 'the title is above the members');
});

test('boot reports the canvas and seeks', async () => {
  const r = await page.evaluate(async ([d, t]) => {
    const out = await window.boot(d, t, { style: 'filled', localIcons: [] });
    const a = document.querySelector('[data-layer=arrows] path[stroke-dasharray]');
    window.seek(0); const o0 = a.getAttribute('stroke-dashoffset'); window.seek(30);
    return { out, o0, o30: a.getAttribute('stroke-dashoffset'), svg: [document.getElementById('card').getAttribute('width'), document.getElementById('card').getAttribute('height')] };
  }, [fixture('cdn'), theme('light')]);
  assert.deepEqual({ size: r.out.size, failures: r.out.failures }, { size: { w: 1080, h: 1350 }, failures: [] });
  assert.ok(r.out.moving.length >= 6 + 9, 'every icon and arrow is reported as moving');
  assert.deepEqual(r.svg, ['1080', '1350']);
  assert.notEqual(r.o0, r.o30);
});
