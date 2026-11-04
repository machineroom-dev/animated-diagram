// Colour-coded zones: a group or a stack band is a tinted area in its own hue, and what sits in it takes that hue.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';
import { zoneStyles, zoneOrder, sideStyles, contrast } from '../skills/animated-diagram/scripts/colour.mjs';

const fixture = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
const theme = (name = 'machine-room-dark') => JSON.parse(fs.readFileSync(`skills/animated-diagram/themes/${name}.json`, 'utf8'));

let page, done;
before(async () => { ({ page, done } = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 } })); });
after(async () => { await done?.(); });

// Boots and reports the zone rects, the texts, and what colours each icon was drawn with.
const boot = (d, t = theme()) => page.evaluate(async ([d, t]) => {
  const res = await window.boot(d, t, { style: 'filled', localIcons: [] });
  const groupRects = [...document.querySelectorAll('[data-layer=groups] rect')].map(r => ({ fill: r.getAttribute('fill'), stroke: r.getAttribute('stroke') }));
  const texts = window.scene.texts.map(x => ({ role: x.role, owner: x.owner, text: x.el.textContent, fill: x.el.getAttribute('fill') }));
  const icons = window.scene.placed.map(p => ({ id: p.id, name: p.name, colours: [...new Set([...p.g.querySelectorAll('[fill]')].map(e => e.getAttribute('fill')))] }));
  const labels = window.scene.labels.map(l => ({ text: l.text, fill: l.g.querySelector('.tx').getAttribute('fill') }));
  return { failures: res.failures, groupRects, texts, icons, labels };
}, [d, t]);

const textOf = (r, owner, role) => r.texts.find(t => t.owner === owner && t.role === role);

test('a group is drawn in its zone: tinted fill, coloured border and title', async () => {
  const d = fixture('cdn');
  d.panels[0].groups[0].color = 'teal';
  const r = await boot(d), z = zoneStyles(theme()).teal;
  assert.deepEqual(r.groupRects, [{ fill: z.fill, stroke: z.stroke }]);
  assert.equal(r.texts.find(t => t.role === 'group').fill, z.text);
  assert.deepEqual(r.failures, []);
});

test('a group without a colour takes the next one in the theme\'s order', async () => {
  const d = fixture('cdn');
  d.panels[0].groups = [{ label: 'ONE', nodes: ['user', 'dns'] }, { label: 'TWO', nodes: ['edge', 'cache'] }, { label: 'THREE', nodes: ['origin', 'ttl'] }];
  const r = await boot(d), Z = zoneStyles(theme()), order = zoneOrder(theme());
  assert.deepEqual(r.groupRects.map(g => g.fill), [Z[order[0]].fill, Z[order[1]].fill, Z[order[2]].fill]);
});

test('an explicit colour is not handed out again', async () => {
  const d = fixture('cdn'), order = zoneOrder(theme());
  d.panels[0].groups = [{ label: 'ONE', nodes: ['user', 'dns'], color: order[0] }, { label: 'TWO', nodes: ['edge', 'cache'] }];
  d.panels[0].groups[1].color = undefined;
  const r = await boot(d), Z = zoneStyles(theme());
  assert.notEqual(r.groupRects[1].fill, Z[order[0]].fill);
  const e = fixture('cdn');
  e.panels[0].groups = [{ label: 'ONE', nodes: ['user', 'dns'] }, { label: 'TWO', nodes: ['edge', 'cache'], color: order[0] }];
  const s = await boot(e);
  assert.notEqual(s.groupRects[0].fill, s.groupRects[1].fill, 'a later explicit colour is reserved up front');
});

test('an icon in a zone is drawn in that zone\'s hue; one outside keeps the theme\'s', async () => {
  const d = fixture('cdn');
  d.panels[0].groups[0].color = 'teal';
  const t = theme(), r = await boot(d, t), z = zoneStyles(t).teal;
  const inZone = r.icons.find(i => i.id === 'cache-ic'), outside = r.icons.find(i => i.id === 'origin-ic');
  assert.ok(inZone.colours.includes(z.hue), `cache: ${inZone.colours}`);
  assert.ok(!inZone.colours.includes(t.colors.primary), `cache still has the theme primary: ${inZone.colours}`);
  assert.ok(outside.colours.includes(t.colors.primary), `origin: ${outside.colours}`);
  assert.ok(!outside.colours.includes(z.hue));
});

test('a node\'s text in a zone uses that zone\'s passing colours', async () => {
  const d = fixture('cdn');
  d.panels[0].groups[0].color = 'amber';
  const r = await boot(d), z = zoneStyles(theme()).amber;
  assert.equal(textOf(r, 'edge', 'name').fill, z.ink);
  assert.equal(textOf(r, 'edge', 'sub').fill, z.muted);
  assert.equal(textOf(r, 'origin', 'sub').fill, theme().colors.muted);
});

test('a label lying in a zone uses that zone\'s passing colours', async () => {
  const d = fixture('cdn');
  d.panels[0].groups[0].color = 'amber';
  const r = await boot(d), z = zoneStyles(theme()).amber;
  assert.equal(r.labels.find(l => l.text.startsWith('HIT')).fill, z.hitText);
  assert.equal(r.labels.find(l => l.text === 'check cache').fill, z.ink);
  assert.equal(r.labels.find(l => l.text.startsWith('MISS')).fill, theme().colors.missText, 'outside the zone');
});

test('a text box and a tray in a zone stay legible', async () => {
  for (const zone of ['amber', 'pink', 'green']) {
    const d = { canvas: 'linkedin-portrait', template: 'flow-grid', title: 'Boxes', panels: [{ grid: { cols: 1, rows: 2 }, nodes: [
      { id: 'b', type: 'text', name: 'Prompt builder', cell: [0, 0] },
      { id: 't', type: 'tray', name: 'Tools', cell: [0, 1], items: [{ icon: 'globe', caption: 'web' }, { icon: 'database', caption: 'data' }] },
    ], groups: [{ label: 'ZONE', nodes: ['b', 't'], color: zone }], steps: [] }] };
    const r = await boot(d), z = zoneStyles(theme())[zone];
    assert.deepEqual(r.failures, [], zone);
    assert.ok(contrast(textOf(r, 'b', 'box').fill, z.tokens.tint) >= 4.5, `${zone} box text on its tint`);
    assert.equal(textOf(r, 't', 'trayTitle').fill, z.ink);
    assert.ok(r.icons.find(i => i.id === 't-i1').colours.includes(z.hue), 'tray icons take the hue (the database has a primary-filled top)');
  }
});

test('each stack band gets its own colour, its nodes follow it, and a band may pick one', async () => {
  const d = fixture('stack');
  d.panels[0].groups[4].color = 'pink';
  const r = await boot(d), t = theme(), Z = zoneStyles(t), order = zoneOrder(t);
  assert.equal(r.groupRects.length, 5);
  assert.deepEqual(r.groupRects.slice(0, 4).map(g => g.fill), order.filter(z => z !== 'pink').slice(0, 4).map(z => Z[z].fill));
  assert.equal(r.groupRects[4].fill, Z.pink.fill);
  assert.equal(new Set(r.groupRects.map(g => g.fill)).size, 5);
  assert.ok(r.icons.find(i => i.id === 'db-ic').colours.includes(Z.pink.hue));
  assert.deepEqual(r.failures, []);
});

test('the two sides of a comparison colour their icons and stay legible', async () => {
  const t = theme(), S = sideStyles(t), r = await boot(fixture('rag'), t);
  assert.deepEqual(r.failures, []);
  for (const [side, s] of Object.entries(S)) {
    for (const key of ['ink', 'muted']) assert.ok(contrast(s[key], t.colors[`side${side}Tint`]) >= 4.5, `${side}.${key}`);
    const icons = r.icons.filter(i => i.id.startsWith(`${side}-`));
    assert.ok(icons.length, side);
    assert.ok(icons.some(i => i.colours.includes(s.hue)), `${side}: ${JSON.stringify(icons)}`);
  }
});

test('zones work on the light and dark presets too', async () => {
  for (const name of ['light', 'dark']) {
    const d = fixture('cdn');
    d.panels[0].groups = [{ label: 'ONE', nodes: ['user', 'dns'] }, { label: 'TWO', nodes: ['edge', 'cache'] }, { label: 'THREE', nodes: ['origin', 'ttl'] }];
    const r = await boot(d, theme(name));
    assert.deepEqual(r.failures, [], name);
    assert.equal(new Set(r.groupRects.map(g => g.fill)).size, 3, name);
  }
});

test('group titles have their own owners, so two that collide are caught', async () => {
  const d = fixture('cdn');
  d.panels[0].groups = [{ label: 'ONE', nodes: ['user', 'dns'] }, { label: 'TWO', nodes: ['edge', 'cache'] }];
  const r = await boot(d), owners = r.texts.filter(t => t.role === 'group').map(t => t.owner);
  assert.equal(new Set(owners).size, 2, owners.join());
});

test('boot reports each zone and panel with the colour it should come out in', async () => {
  const d = fixture('cdn');
  d.panels[0].groups[0].color = 'teal';
  const t = theme(), fills = await page.evaluate(async ([d, t]) => (await window.boot(d, t, { style: 'filled', localIcons: [] })).fills, [d, t]);
  const z = zoneStyles(t).teal, zone = fills.find(f => f.id === 'zone:teal');
  assert.equal(zone.colour, z.fill);
  assert.ok(zone.w > 100 && zone.h > 100);
  assert.equal(fills.find(f => f.id === 'panel:main').colour, t.colors.panel);
  const stack = await page.evaluate(async ([d, t]) => (await window.boot(d, t, { style: 'filled', localIcons: [] })).fills, [fixture('stack'), t]);
  assert.equal(stack.filter(f => f.id.startsWith('zone:')).length, 5);
});

test('a canvas may set its own k and text floor', async () => {
  const d = { canvas: 'poster', template: 'flow-grid', title: 'Poster', panels: [{ grid: { cols: 2, rows: 1 }, nodes: [{ id: 'a', icon: 'lock', name: 'A', sub: 'a sub-label', cell: [0, 0] }, { id: 'b', type: 'tray', name: 'B', cell: [1, 0], items: [{ icon: 'key', caption: 'tiny' }, { icon: 'lock', caption: 'text' }] }], steps: [] }] };
  await page.setViewportSize({ width: 1280, height: 800 });
  const r = await page.evaluate(async ([d, t]) => { const res = await window.boot(d, t, { style: 'filled', localIcons: [] }); return { failures: res.failures, size: res.size, k: window.scene.k, title: +window.composition.header.title.getAttribute('font-size') }; }, [d, theme()]);
  await page.setViewportSize({ width: 1080, height: 1350 });
  assert.deepEqual(r.size, { w: 1280, h: 800 });
  assert.equal(r.k, 0.8);
  assert.ok(Math.abs(r.title - 54 * 0.8) < 1e-6);
  assert.ok(r.failures.some(f => f.code === 'TEXT_TOO_SMALL' && f.detail.includes('at least 12px')), JSON.stringify(r.failures));
});

test('rows too tall for the panel give ROWS_TOO_TALL', async () => {
  const d = { canvas: 'landscape', template: 'flow-grid', title: 'Too many rows', panels: [{ grid: { cols: 1, rows: 6 }, nodes: [0, 1, 2, 3, 4, 5].map(i => ({ id: `n${i}`, icon: 'lock', name: `Node ${i}`, sub: 'with a sub-label', cell: [0, i] })), steps: [] }] };
  await page.setViewportSize({ width: 1200, height: 675 });
  const r = await boot(d);
  await page.setViewportSize({ width: 1080, height: 1350 });
  assert.ok(r.failures.some(f => f.code === 'ROWS_TOO_TALL' && f.ids.includes('main')), JSON.stringify(r.failures.map(f => f.code)));
});
