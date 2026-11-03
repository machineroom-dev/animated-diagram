import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

const fixture = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
const theme = name => JSON.parse(fs.readFileSync(`skills/animated-diagram/themes/${name}.json`, 'utf8'));

let page, done;
before(async () => { ({ page, done } = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 } })); });
after(async () => { await done?.(); });

const boot = (diagram, th = 'machine-room-dark') => page.evaluate(async ([d, t]) => {
  const res = await window.boot(d, t, { style: 'filled', localIcons: [] });
  const c = window.composition;
  const panelRects = [...document.querySelectorAll('[data-layer=back] rect[data-panel]')].map(r => ({ fill: r.getAttribute('fill'), stroke: r.getAttribute('stroke') }));
  return { res, band: { pills: c.band.pills, vs: c.band.vs }, panelRects, colors: t.colors,
    panels: c.panels.map(p => ({ frame: p.frame, bands: p.bands, nodes: p.layout.nodes.map(n => ({ id: n.id, cx: n.cx, cy: n.cy, cell: n.cell, box: n.box })), arrows: p.layout.arrows })) };
}, [diagram, theme(th)]);

test('rag composes', async () => {
  const r = await boot(fixture('rag'));
  assert.deepEqual(r.res.failures, []);
  const [A, B] = r.panels.map(p => p.frame);
  assert.ok(Math.abs(A.w - B.w) < 0.5, `widths ${A.w} ${B.w}`);
  assert.ok(Math.abs(B.x - (A.x + A.w) - 20) < 0.5, 'a 20k gap');
  assert.ok(Math.abs(A.x - 36) < 0.5 && Math.abs(1080 - (B.x + B.w) - 36) < 0.5, '36k outer margins');
  assert.equal(r.band.pills.length, 2);
  r.band.pills.forEach((pill, i) => {
    const f = r.panels[i].frame;
    assert.ok(Math.abs(pill.x + pill.w / 2 - (f.x + f.w / 2)) <= 2, `pill ${i} centred`);
    assert.ok(Math.abs(pill.w - 0.74 * f.w) < 0.5, `pill ${i} is 0.74 of its panel`);
  });
  assert.ok(r.band.vs, 'a "vs" between the pills');
  assert.equal(r.panels[1].arrows.find(a => a.kind === 'retry').points.length, 4);
});

test('comparison panels take the side colours', async () => {
  const r = await boot(fixture('rag'));
  const C = r.colors;
  assert.deepEqual(r.panelRects, [{ fill: C.sideATint, stroke: C.sideA }, { fill: C.sideBTint, stroke: C.sideB }]);
});

test('stack composes', async () => {
  const r = await boot(fixture('stack'));
  assert.deepEqual(r.res.failures, []);
  const [p] = r.panels;
  assert.equal(p.bands.length, 5);
  p.bands.forEach((band, row) => {
    const inRow = p.nodes.filter(n => n.cell[1] === row).sort((a, b) => a.cx - b.cx);
    assert.ok(inRow.length > 0);
    const slot = band.w / inRow.length;
    inRow.forEach((n, i) => assert.ok(Math.abs(n.cx - (band.x + (i + 0.5) * slot)) <= 2, `${n.id} evenly spread`));
    for (const n of inRow) assert.ok(n.box.y >= band.y && n.box.y + n.box.h <= band.y + band.h, `${n.id} inside its band`);
  });
  for (let i = 1; i < p.bands.length; i++) assert.ok(p.bands[i].y >= p.bands[i - 1].y + p.bands[i - 1].h, 'bands don\'t overlap');
  assert.deepEqual(p.bands.map(b => b.label), ['CLIENT', 'EDGE', 'TRAFFIC', 'SERVICE', 'DATA']);
  assert.equal(p.arrows.length, 5);
});

test('stack forks with horizontal-first bends', async () => {
  const r = await boot(fixture('stack'));
  for (const a of r.panels[0].arrows.filter(a => a.to === 'db' || a.to === 'cache')) {
    assert.equal(a.points.length, 3, `${a.to}: one corner`);
    assert.ok(Math.abs(a.points[0][1] - a.points[1][1]) < 1e-6, `${a.to}: out of the side first`);
  }
});
