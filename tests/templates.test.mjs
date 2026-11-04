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
  const box = e => { if (!e) return null; const b = e.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height, text: e.textContent, baseline: +e.getAttribute('y'), fill: e.getAttribute('fill'), size: +e.getAttribute('font-size') }; };
  const runs = [...(c.header.title?.querySelectorAll('tspan') ?? [])].map(s => ({ text: s.textContent, fill: s.getAttribute('fill') }));
  const backRects = [...document.querySelectorAll('[data-layer=back] rect')].length;
  return { res, header: { title: box(c.header.title), subtitle: box(c.header.subtitle), brand: box(c.header.brand), dot: !!c.header.dot, runs }, backRects, panelRects, colors: t.colors,
    texts: window.scene.texts.map(x => ({ role: x.role, text: x.el.textContent, fill: x.el.getAttribute('fill'), y: x.el.getBBox().y })),
    panels: c.panels.map(p => ({ frame: p.frame, bands: p.bands, nodes: p.layout.nodes.map(n => ({ id: n.id, cx: n.cx, cy: n.cy, cell: n.cell, box: n.box })), arrows: p.layout.arrows })) };
}, [diagram, theme(th)]);

test('rag composes', async () => {
  const r = await boot(fixture('rag'));
  assert.deepEqual(r.res.failures, []);
  const [A, B] = r.panels.map(p => p.frame);
  assert.ok(Math.abs(A.w - B.w) < 0.5, `widths ${A.w} ${B.w}`);
  assert.ok(Math.abs(B.x - (A.x + A.w) - 20) < 0.5, 'a 20k gap');
  assert.ok(Math.abs(A.x - 36) < 0.5 && Math.abs(1080 - (B.x + B.w) - 36) < 0.5, '36k outer margins');
  assert.equal(r.panels[1].arrows.find(a => a.kind === 'retry').points.length, 4);
});

test('the headline is plain type at the panel edge, with no shape behind it', async () => {
  const r = await boot(fixture('cdn')), f = r.panels[0].frame;
  assert.equal(r.backRects, 2, 'only the card and the panel: no pill, no accent bar');
  assert.equal(r.header.title.text, 'How a CDN serves a request');
  assert.ok(Math.abs(r.header.title.x - f.x) <= 4, `title x ${r.header.title.x} against the panel's ${f.x}`);
  assert.ok(r.header.title.size >= 50, `title size ${r.header.title.size}`);
  assert.equal(r.header.title.fill, r.colors.ink);
  assert.ok(r.header.title.y + r.header.title.h <= f.y, 'the title is above the panel');
});

test('the brand sits at the right of the subtitle row and nothing sits under the panel', async () => {
  const d = fixture('cdn');
  d.subtitle = 'From the browser to the edge, and back';
  const r = await boot(d), f = r.panels[0].frame;
  assert.equal(r.header.subtitle.text, d.subtitle);
  assert.equal(r.header.brand.text, 'Machine Room');
  assert.equal(r.header.brand.baseline, r.header.subtitle.baseline, 'one row');
  assert.ok(Math.abs(r.header.brand.x + r.header.brand.w - (f.x + f.w)) <= 2, 'the brand ends at the panel edge');
  assert.ok(r.header.dot, 'the accent dot');
  assert.ok(Math.abs(f.y + f.h - (1350 - 36)) < 0.5, 'the panel runs to a 36k margin');
  assert.deepEqual(r.texts.filter(t => t.y > f.y + f.h), [], 'no footer');
});

test('the subtitle is optional and the brand keeps its row without it', async () => {
  const r = await boot(fixture('cdn'));
  assert.equal(r.header.subtitle, null);
  assert.ok(r.header.brand.baseline > r.header.title.baseline, 'the brand stays on the second row');
  assert.deepEqual(r.res.failures, []);
});

test('a diagram\'s footer field still overrides the theme\'s brand text', async () => {
  const d = fixture('cdn');
  d.footer = 'Acme Corp';
  assert.equal((await boot(d)).header.brand.text, 'Acme Corp');
});

test('a comparison\'s headline names both sides in their colours, and each panel carries a caption', async () => {
  const r = await boot(fixture('rag')), C = r.colors;
  assert.equal(r.header.title.text, 'RAG vs Agentic RAG');
  assert.deepEqual(r.header.runs.map(x => x.text), ['RAG', ' vs ', 'Agentic RAG']);
  const [a, vs, b] = r.header.runs.map(x => x.fill);
  assert.notEqual(a, b);
  assert.notEqual(vs, C.ink);
  const { contrast } = await import('../skills/animated-diagram/scripts/colour.mjs');
  for (const fg of [a, vs, b]) assert.ok(contrast(fg, C.bg) >= 4.5, `${fg} on ${C.bg}`);
  const caps = r.texts.filter(t => t.role === 'caption-side').map(t => t.text);
  assert.deepEqual(caps, ['RAG', 'AGENTIC RAG']);
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
