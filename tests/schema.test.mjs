import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateDiagram, CANVAS } from '../skills/animated-diagram/scripts/schema.mjs';
import { ICONS } from '../skills/animated-diagram/engine/icons/index.js';

const icons = new Set(Object.keys(ICONS));
const fixture = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
// A fixture with one change applied; validation must fail with an error containing `want`.
function failsWith(name, change, want) {
  const d = fixture(name);
  change(d);
  const r = validateDiagram(d, { icons });
  assert.equal(r.ok, false, `expected a failure containing "${want}"`);
  assert.ok(r.errors.some(e => e.includes(want)), `no error contains "${want}":\n  ${r.errors.join('\n  ')}`);
  return r.errors;
}

test('canvas presets', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CANVAS).map(([n, c]) => [n, [c.w, c.h]])),
    { 'linkedin-portrait': [1080, 1350], square: [1080, 1080], landscape: [1200, 675], poster: [1280, 800] });
  assert.equal(CANVAS.poster.k, 0.8, 'more room per unit than k = w / 1080 would give');
  assert.equal(CANVAS.poster.minText, 12);
  assert.equal(CANVAS.poster.budgetBytes, 3_000_000);
  assert.ok(CANVAS.poster.w <= 1280 && CANVAS.poster.h <= 1080, "inside X's GIF limit");
  for (const c of Object.values(CANVAS)) assert.ok(Number.isInteger(c.maxGifBytes) && c.maxGifBytes >= 1_000_000);
});

test('the three fixtures validate', () => {
  for (const name of ['cdn', 'rag', 'stack']) {
    const r = validateDiagram(fixture(name), { icons });
    assert.deepEqual(r, { ok: true, errors: [] }, name);
  }
});

test('the canvas defaults to linkedin-portrait', () => {
  const d = fixture('cdn');
  delete d.canvas;
  assert.equal(validateDiagram(d, { icons }).ok, true);
});

test('required fields and enums', () => {
  failsWith('cdn', d => { delete d.template; }, 'template: required');
  failsWith('cdn', d => { d.template = 'tree'; }, 'template: "tree" is not one of flow-grid, comparison, stack, map');
  failsWith('cdn', d => { d.canvas = 'portrait'; }, 'canvas: "portrait" is not one of linkedin-portrait, square, landscape, poster');
  failsWith('cdn', d => { delete d.title; }, 'title: required');
  failsWith('cdn', d => { d.still = 90; }, 'still: must be an integer from 0 to 89');
  failsWith('cdn', d => { d.panels[0].grid.cols = 5; }, 'panels[0].grid.cols: must be an integer from 1 to 4');
  failsWith('cdn', d => { d.panels[0].grid.rows = 0; }, 'panels[0].grid.rows: must be an integer from 1 to 6');
  failsWith('cdn', d => { delete d.panels[0].nodes[1].name; }, 'panels[0].nodes[1].name: required');
  failsWith('cdn', d => { d.panels[0].nodes[1].type = 'box'; }, 'panels[0].nodes[1].type: "box" is not one of icon, text, tray');
  failsWith('cdn', d => { d.panels[0].steps[0].kind = 'fail'; }, 'panels[0].steps[0].kind: "fail" is not one of normal, hit, miss, retry, solid');
  failsWith('cdn', d => { d.panels[0].steps[0].reply = 'yes'; }, 'panels[0].steps[0].reply: must be true or false');
  failsWith('cdn', d => { d.panels[0].nodes[0].offset = [4]; }, 'panels[0].nodes[0].offset: must be [dx, dy]');
  failsWith('cdn', d => { d.grid = d.panels[0].grid; }, 'grid: unknown field');
});

test('subtitle is an optional non-empty string', () => {
  const d = fixture('cdn');
  d.subtitle = 'From the browser to the edge, and back';
  assert.deepEqual(validateDiagram(d, { icons }), { ok: true, errors: [] });
  failsWith('cdn', x => { x.subtitle = ''; }, 'subtitle: must be a non-empty string');
  failsWith('cdn', x => { x.subtitle = 3; }, 'subtitle: must be a non-empty string');
});

test('a group may pick a zone colour by name', () => {
  const d = fixture('cdn');
  d.panels[0].groups[0].color = 'teal';
  assert.deepEqual(validateDiagram(d, { icons }), { ok: true, errors: [] });
  failsWith('cdn', x => { x.panels[0].groups[0].color = 'mauve'; }, 'panels[0].groups[0].color: "mauve" is not one of primary, teal, violet, amber, pink, green, blue');
  failsWith('cdn', x => { x.panels[0].groups = [{ label: 'A', nodes: ['user'], color: 'teal' }, { label: 'B', nodes: ['dns'], color: 'teal' }]; }, 'panels[0].groups[1].color: "teal" is already used by another group');
});

test('a map validates, on poster and on linkedin-portrait', () => {
  assert.deepEqual(validateDiagram(fixture('map'), { icons }), { ok: true, errors: [] });
  const d = fixture('map');
  d.canvas = 'linkedin-portrait';
  d.panels[0].grid.cols = 5;
  assert.ok(validateDiagram(d, { icons }).errors.some(e => e.includes('panels[0].grid.cols: must be an integer from 1 to 4 on linkedin-portrait')));
  failsWith('map', x => { x.canvas = 'square'; }, 'canvas: a map needs poster or linkedin-portrait, not square');
});

test('a map\'s grid has its own limits; other templates keep theirs, even on a poster', () => {
  failsWith('map', x => { x.panels[0].grid.cols = 8; }, 'panels[0].grid.cols: must be an integer from 1 to 7 on poster');
  failsWith('map', x => { x.panels[0].grid.rows = 6; }, 'panels[0].grid.rows: must be an integer from 1 to 5 on poster');
  failsWith('cdn', x => { x.canvas = 'poster'; x.panels[0].grid.cols = 5; }, 'panels[0].grid.cols: must be an integer from 1 to 4');
});

test('a map\'s steps: labelled means numbered, numbered means labelled', () => {
  failsWith('map', x => { delete x.panels[0].steps[0].n; }, 'panels[0].steps[0]: a labelled step in a map needs a number, for the legend');
  failsWith('map', x => { x.panels[0].steps[0].label = ''; }, 'panels[0].steps[0]: a numbered step in a map needs a label, for the legend');
  const d = fixture('map');
  d.panels[0].steps[0] = { from: 'user', to: 'app', label: '' };
  assert.deepEqual(validateDiagram(d, { icons }).errors, []);
});

test('a map has no trays', () => {
  failsWith('map', x => { x.panels[0].nodes[0] = { id: 'user', type: 'tray', name: 'Tray', cell: [0, 0], items: [{ icon: 'lock', caption: 'a' }, { icon: 'key', caption: 'b' }] }; }, 'panels[0].nodes[0].type: a tray doesn\'t fit a map cell');
});

test('a map\'s zones are clean rectangles', () => {
  failsWith('map', x => { x.panels[0].groups[0].nodes = ['gw', 'svc']; }, 'panels[0].groups[0].nodes: "auth" sits inside this zone but isn\'t a member');
  failsWith('map', x => { x.panels[0].groups[1].nodes = ['cache', 'db', 'a', 'b']; }, 'panels[0].groups[2].nodes: this zone overlaps "DATA"');
  failsWith('map', x => {
    x.panels[0].grid = { cols: 7, rows: 5 };
    x.panels[0].nodes = Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, icon: 'lock', name: `N${i}`, cell: [i, 0] }));
    x.panels[0].groups = x.panels[0].nodes.map((n, i) => ({ label: `Z${i}`, nodes: [n.id] }));
    x.panels[0].steps = [];
  }, 'panels[0].groups: a map holds at most 6 zones, this one has 7');
});

test('an arrow may end at a zone, in a map only', () => {
  failsWith('map', x => { x.panels[0].steps[6].to = 'zone:nope'; }, 'panels[0].steps[6].to: no zone with the id "nope"');
  failsWith('map', x => { x.panels[0].steps[6].from = 'a'; }, 'panels[0].steps[6]: "a" is already in zone "tools"');
  failsWith('map', x => { x.panels[0].groups[2].id = 'data'; x.panels[0].groups[1].id = 'data'; }, 'panels[0].groups[2].id: "data" is used twice');
  failsWith('cdn', x => { x.panels[0].groups[0].id = 'edge'; x.panels[0].steps[0].to = 'zone:edge'; }, 'panels[0].steps[0].to: no node "zone:edge" in this panel');
});

test('cells sit inside the grid and are unique', () => {
  failsWith('cdn', d => { d.panels[0].nodes[1].cell = [2, 0]; }, 'panels[0].nodes[1].cell: [2, 0] is outside the 2×3 grid');
  failsWith('cdn', d => { d.panels[0].nodes[1].cell = [0, 0]; }, 'panels[0].nodes[1].cell: [0, 0] is already taken by "user"');
  failsWith('cdn', d => { d.panels[0].nodes[1].id = 'user'; }, 'panels[0].nodes[1].id: "user" is used twice');
});

test('steps name existing nodes and unique numbers', () => {
  failsWith('cdn', d => { d.panels[0].steps[0].from = 'ghost'; }, 'panels[0].steps[0].from: no node "ghost" in this panel');
  failsWith('cdn', d => { d.panels[0].steps[0].to = 'user'; }, 'panels[0].steps[0]: from and to are the same node');
  failsWith('cdn', d => { d.panels[0].steps[3].n = 3; }, 'panels[0].steps[3].n: step 3 is numbered twice');
  failsWith('cdn', d => { d.panels[0].groups[0].nodes.push('nobody'); }, 'panels[0].groups[0].nodes: no node "nobody" in this panel');
});

test('unknown icon names the icon, the closest names and the rulebook', () => {
  const errors = failsWith('cdn', d => { d.panels[0].nodes[3].icon = 'kafka'; }, 'panels[0].nodes[3].icon: unknown icon "kafka" — closest: queue');
  assert.ok(errors.some(e => e.endsWith('to add one, see reference/icon-rulebook.md')), errors.join('\n'));
  failsWith('cdn', d => { d.panels[0].nodes[0].icon = 'labtop'; }, 'unknown icon "labtop" — closest: laptop');
  failsWith('cdn', d => { delete d.panels[0].nodes[0].icon; }, 'panels[0].nodes[0].icon: required for an icon node');
});

test('tray items are library icons, 2 to 6 of them', () => {
  failsWith('rag', d => { d.panels[1].nodes[0].items[1].icon = 'pdf'; }, 'panels[1].nodes[0].items[1].icon: unknown icon "pdf" — closest: document');
  failsWith('rag', d => { d.panels[1].nodes[0].items.length = 1; }, 'panels[1].nodes[0].items: a tray holds 2 to 6 items, this one has 1');
  failsWith('rag', d => { const it = d.panels[1].nodes[0].items; it.push(...it, ...it); }, 'a tray holds 2 to 6 items, this one has 12');
  failsWith('rag', d => { delete d.panels[1].nodes[0].items[0].caption; }, 'panels[1].nodes[0].items[0].caption: required');
  failsWith('rag', d => { d.panels[0].nodes[2].icon = 'user'; }, 'panels[0].nodes[2].icon: only icon nodes take an icon');
  failsWith('cdn', d => { d.panels[0].nodes[0].items = []; }, 'panels[0].nodes[0].items: only tray nodes take items');
});

test('a comparison has exactly 2 titled panels', () => {
  failsWith('rag', d => { d.panels.pop(); }, 'panels: a comparison has exactly 2 panels, this one has 1');
  failsWith('rag', d => { delete d.panels[1].title; }, 'panels[1].title: required in a comparison');
  failsWith('cdn', d => { d.panels.push(d.panels[0]); }, 'panels: a flow-grid has exactly 1 panel, this one has 2');
});

test('a stack connects adjacent rows only', () => {
  failsWith('stack', d => { d.panels[0].steps.push({ from: 'client', to: 'app', label: 'skip' }); }, 'panels[0].steps[5]: a stack step joins adjacent rows, this one joins rows 0 and 3');
  failsWith('stack', d => { d.panels[0].groups[4].nodes.push('app'); }, 'panels[0].groups[4].nodes: a stack group is one row, this one spans rows 3 and 4');
});

test('errors are full sentences with a path', () => {
  const d = fixture('cdn');
  d.panels[0].nodes[1].cell = [9, 9];
  d.panels[0].steps[1].to = 'ghost';
  const r = validateDiagram(d, { icons });
  assert.equal(r.errors.length, 2, r.errors.join('\n'));
  for (const e of r.errors) assert.match(e, /^[\w.[\]]+: .+/);
});

test('not an object', () => {
  assert.deepEqual(validateDiagram(null, { icons }), { ok: false, errors: ['diagram: must be a JSON object'] });
  assert.equal(validateDiagram({ template: 'flow-grid', title: 'x', panels: 'no' }, { icons }).errors[0], 'panels: must be a list of panels');
});
