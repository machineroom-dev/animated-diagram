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
    { 'linkedin-portrait': [1080, 1350], square: [1080, 1080], landscape: [1200, 675] });
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
  failsWith('cdn', d => { d.template = 'tree'; }, 'template: "tree" is not one of flow-grid, comparison, stack');
  failsWith('cdn', d => { d.canvas = 'portrait'; }, 'canvas: "portrait" is not one of linkedin-portrait, square, landscape');
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
