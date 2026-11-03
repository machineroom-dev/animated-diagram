import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

const fixture = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
const theme = JSON.parse(fs.readFileSync('skills/animated-diagram/themes/machine-room-dark.json', 'utf8'));

let page, done;
before(async () => { ({ page, done } = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 } })); });
after(async () => { await done?.(); });

const failures = d => page.evaluate(async ([d, t]) => (await window.boot(d, t, { style: 'filled', localIcons: [] })).failures, [d, theme]);
const codes = fs_ => fs_.map(f => f.code);
const find = (fs_, code) => fs_.find(f => f.code === code);

test('the three fixtures pass', async () => {
  for (const name of ['cdn', 'rag', 'stack']) assert.deepEqual(await failures(fixture(name)), [], name);
});

test('a node pushed onto a label gives LABEL_ON_ICON', async () => {
  const d = fixture('cdn');
  d.panels[0].nodes[5].offset = [-344, -158];          // the TTL node onto the start of step 6's label
  const f = await failures(d), hit = fs => fs.code === 'LABEL_ON_ICON' && fs.ids.includes('ttl') && fs.ids.includes('s6');
  assert.ok(f.some(hit), JSON.stringify(f, null, 1));
  assert.match(f.find(hit).detail, /logo\.png \+ Cache-Control/);
});

test('a 120-character label gives TEXT_OUT_OF_PANEL', async () => {
  const d = fixture('cdn');
  d.panels[0].steps[5].label = 'MISS: the edge has no copy, so it opens a connection to the origin server and then fetches the file over a long haul now';
  assert.equal(d.panels[0].steps[5].label.length, 120);
  const f = await failures(d);
  assert.ok(f.some(x => x.code === 'TEXT_OUT_OF_PANEL' && x.ids.includes('s5')), JSON.stringify(f, null, 1));
});

test('a node pushed into a pair is refused, never crossed', async () => {
  const d = fixture('cdn');
  d.panels[0].nodes[5].offset = [-448, -166];          // the TTL node into the edge ⇄ origin pair
  const f = await failures(d);
  assert.ok(f.some(x => x.code === 'UNROUTABLE' && x.ids.includes('ttl')), JSON.stringify(f, null, 1));
});

test('an arrow through a node gives ARROW_THROUGH_NODE', async () => {
  const f = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const L = window.composition.panels[0].layout, edge = L.nodes.find(n => n.id === 'edge'), a = L.arrows[0];
    a.points = [[edge.cx, edge.box.y - 40], [edge.cx, edge.box.y + edge.box.h + 40]];   // s0 forced through the edge server
    return window.checkGeometry();
  }, [fixture('cdn'), theme]);
  assert.ok(f.some(x => x.code === 'ARROW_THROUGH_NODE' && x.ids.includes('s0') && x.ids.includes('edge')), JSON.stringify(f));
});

test('one row of a three-row grid gives EMPTY_BAND', async () => {
  const d = fixture('cdn'), p = d.panels[0];
  p.nodes = p.nodes.slice(0, 2); p.groups = []; p.steps = p.steps.slice(0, 2);
  const f = await failures(d);
  assert.ok(find(f, 'EMPTY_BAND'), JSON.stringify(f, null, 1));
  assert.match(find(f, 'EMPTY_BAND').detail, /taller than a row/);
});

test('small text gives TEXT_TOO_SMALL', async () => {
  const f = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    window.scene.at('nodes', () => window.scene.text(540, 1000, 'tiny', { size: 12, weight: 400, role: 'name', owner: 'user' }));
    return window.checkGeometry();
  }, [fixture('cdn'), theme]);
  assert.ok(f.some(x => x.code === 'TEXT_TOO_SMALL' && x.ids.includes('user')), JSON.stringify(f));
});

test('a label overlapping another gives LABEL_OVERLAP, and text off the card TEXT_OUT_OF_CANVAS', async () => {
  const f = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const s = window.scene, L = s.labels[0];
    s.at('labels', () => s.text(L.box.x + 10, L.box.y + L.box.h - 4, 'on top', { size: 17.5, weight: 520, role: 'name', owner: 'dns' }));
    s.at('labels', () => s.text(-30, 600, 'off the edge', { size: 17.5, weight: 520, anchor: 'start', role: 'name', owner: 'user' }));
    return window.checkGeometry();
  }, [fixture('cdn'), theme]);
  assert.ok(f.some(x => x.code === 'LABEL_OVERLAP' && x.ids.includes('s0') && x.ids.includes('dns')), JSON.stringify(f));
  assert.ok(f.some(x => x.code === 'TEXT_OUT_OF_CANVAS' && x.ids.includes('user')), JSON.stringify(f));
});

test('a title wider than its pill gives TEXT_OUT_OF_PILL', async () => {
  const rag = fixture('rag');
  rag.panels[1].title = 'Write-behind caching';
  const f = await failures(rag);
  assert.ok(f.some(x => x.code === 'TEXT_OUT_OF_PILL' && x.ids.includes('pillB')), JSON.stringify(f, null, 1));
  const cdn = fixture('cdn');
  cdn.title = 'How a content delivery network serves every request it gets';
  const g = await failures(cdn);
  assert.ok(g.some(x => x.code === 'TEXT_OUT_OF_PILL' && x.ids.includes('band')), JSON.stringify(g, null, 1));
  assert.deepEqual(await failures(fixture('rag')), [], 'the fixture\'s own pills fit');
});

test('a hub with bent request and reply pairs passes', async () => {
  assert.deepEqual(await failures(fixture('hub-bent')), []);
});

test('two arrows on one line give ARROW_OVERLAP', async () => {
  const f = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const [a, b] = window.composition.panels[0].layout.arrows;
    b.points = [[...a.points[1]], [...a.points[0]]];     // s1 forced back along s0's line
    return window.checkGeometry();
  }, [fixture('cdn'), theme]);
  assert.ok(f.some(x => x.code === 'ARROW_OVERLAP' && x.ids.includes('s0') && x.ids.includes('s1')), JSON.stringify(f));
});

test('a pair side by side is no ARROW_OVERLAP', async () => {
  const f = await failures(fixture('cdn'));
  assert.ok(!f.some(x => x.code === 'ARROW_OVERLAP'), JSON.stringify(f));
});
