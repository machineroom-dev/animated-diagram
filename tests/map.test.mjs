// The map template: zones, routed arrows, numbered badges on the lines and the steps in a legend.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';
import { zoneStyles } from '../skills/animated-diagram/scripts/colour.mjs';

const fixture = (name = 'map') => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
const theme = (name = 'machine-room-dark') => JSON.parse(fs.readFileSync(`skills/animated-diagram/themes/${name}.json`, 'utf8'));

let page, done;
before(async () => { ({ page, done } = await openPage('engine/page.html', { viewport: { width: 1280, height: 800 } })); });
after(async () => { await done?.(); });

const boot = (d, t = theme()) => page.evaluate(async ([d, t]) => {
  const res = await window.boot(d, t, { style: 'filled', localIcons: [] });
  const c = window.composition, s = window.scene;
  if (!c) return { res, labels: [], arrows: [] };
  const P = c.panels[0], L = P.layout;
  return { res, frame: P.frame, inner: L.inner, legend: L.legend,
    groups: L.groups.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h, label: g.label, nodes: g.nodes, title: g.title, zone: g.zone.name })),
    nodes: L.nodes.map(n => ({ id: n.id, cx: n.cx, cy: n.cy, box: n.box, iconBox: n.iconBox })),
    arrows: L.arrows.map(a => ({ id: a.id, points: a.points, from: a.from, to: a.to, kind: a.kind, short: a.short })),
    strokes: Object.fromEntries(s.arrows.map(a => [a.id, document.getElementById(a.id).getAttribute('stroke')])),
    labels: s.labels.map(l => ({ n: l.n, text: l.text, owner: l.owner, box: l.box, x: l.x, y: l.y, badgeOnly: !!l.badgeOnly, lines: l.lines })),
    texts: s.texts.map(t => ({ role: t.role, text: t.el.textContent, size: t.size })) };
}, [d, t]);

test('a map composes on the poster with nothing failing', async () => {
  const r = await boot(fixture());
  assert.deepEqual(r.res.failures, []);
  assert.deepEqual(r.res.size, { w: 1280, h: 800 });
  assert.equal(r.arrows.length, 9);
  assert.equal(r.groups.length, 3);
});

test('a zone is the rectangle of its members\' cells, and holds them', async () => {
  const r = await boot(fixture());
  for (const g of r.groups) for (const id of g.nodes) {
    const b = r.nodes.find(n => n.id === id).box;
    assert.ok(b.x >= g.x && b.y >= g.y && b.x + b.w <= g.x + g.w && b.y + b.h <= g.y + g.h, `${id} in ${g.label}`);
  }
  assert.equal(r.groups.find(g => g.label === 'DATA').zone, 'violet');
  for (let i = 0; i < r.groups.length; i++) for (let j = i + 1; j < r.groups.length; j++) {
    const [a, b] = [r.groups[i], r.groups[j]];
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.label} and ${b.label} overlap`);
  }
});

test('nodes and zones keep out of the legend rail, which sits at the right of a poster', async () => {
  const r = await boot(fixture());
  const railX = Math.min(...r.labels.filter(l => !l.badgeOnly).map(l => l.box.x));
  assert.ok(railX > r.frame.x + r.frame.w * 0.6, `rail at ${railX}`);
  for (const n of r.nodes) assert.ok(n.box.x + n.box.w < railX, n.id);
  for (const g of r.groups) assert.ok(g.x + g.w < railX, g.label);
  for (const a of r.arrows) for (const [x] of a.points) assert.ok(x < railX, `${a.id} reaches into the rail`);
});

test('every numbered step has a legend row, in order, and a badge on its arrow', async () => {
  const d = fixture(), r = await boot(d), numbered = d.panels[0].steps.filter(s => s.n !== undefined);
  const rows = r.labels.filter(l => !l.badgeOnly), badges = r.labels.filter(l => l.badgeOnly);
  assert.deepEqual(rows.map(l => l.n), numbered.map(s => s.n).sort((a, b) => a - b));
  assert.deepEqual(rows.map(l => l.text), [...numbered].sort((a, b) => a.n - b.n).map(s => s.label));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].box.y >= rows[i - 1].box.y + rows[i - 1].box.h, `row ${i} is under row ${i - 1}`);
  assert.deepEqual(badges.map(b => b.n).sort((a, b) => a - b), numbered.map(s => s.n).sort((a, b) => a - b));
  const stepIndex = d.panels[0].steps.findIndex(s => s.n === 3), a = r.arrows.find(x => x.id === `s${stepIndex}`), b = badges.find(x => x.n === 3);
  const cx = b.box.x + b.box.w / 2, cy = b.box.y + b.box.h / 2;
  const dist = Math.min(...a.points.slice(1).map((q, i) => { const p = a.points[i]; return Math.hypot(cx - Math.max(Math.min(p[0], q[0]), Math.min(cx, Math.max(p[0], q[0]))), cy - Math.max(Math.min(p[1], q[1]), Math.min(cy, Math.max(p[1], q[1])))); }));
  assert.ok(dist <= 26, `the badge is ${dist} from its arrow`);
});

test('a badge stays off a zone\'s border when its line has a clear stretch', async () => {
  // A long line down the side of a zone, its middle beside the border, its lower part clear of it.
  const d = JSON.parse(fs.readFileSync('skills/animated-diagram/examples/anatomy-of-an-ai-app.json', 'utf8'));
  const r = await boot(d);
  assert.deepEqual(r.res.failures, []);
  const touches = (b, z) => b.x < z.x + z.w && z.x < b.x + b.w && b.y < z.y + z.h && z.y < b.y + b.h, inside = (b, z) => b.x >= z.x && b.y >= z.y && b.x + b.w <= z.x + z.w && b.y + b.h <= z.y + z.h;
  const b8 = r.labels.find(l => l.badgeOnly && l.n === 8).box;
  for (const z of r.groups) assert.ok(!touches(b8, z) || inside(b8, z), `step 8's badge straddles ${z.label}`);
});

test('a badge is a centred circle with no text beside it', async () => {
  const r = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const L = window.scene.labels.find(l => l.badgeOnly), c = L.g.querySelector('circle').getBoundingClientRect(), n = L.g.querySelector('.bd').getBoundingClientRect();
    return { box: L.box, x: L.x, y: L.y, hasText: !!L.g.querySelector('.tx'), cMid: [c.left + c.width / 2, c.top + c.height / 2], nMid: n.left + n.width / 2 };
  }, [fixture(), theme()]);
  assert.equal(r.hasText, false);
  assert.ok(Math.abs(r.cMid[0] - r.x) < 0.5 && Math.abs(r.cMid[1] - r.y) < 0.5, 'the circle is on the point asked for');
  assert.ok(Math.abs(r.nMid - r.x) < 1, 'the number is centred in it');
});

test('an arrow takes the colour of the zone it leaves; hit and miss keep their meaning', async () => {
  const d = fixture(), r = await boot(d), Z = zoneStyles(theme()), T = theme().colors;
  const idx = s => `s${d.panels[0].steps.findIndex(x => x.n === s)}`;
  const access = r.groups.find(g => g.label === 'ACCESS').zone;
  assert.equal(r.strokes[idx(3)], Z[access].text, 'from a zone');
  assert.equal(r.strokes[idx(1)], T.line, 'from outside any zone');
  assert.equal(r.strokes[idx(6)], T.miss, 'a miss');
});

test('an arrow to a zone stops at its edge', async () => {
  const d = fixture(), r = await boot(d), g = r.groups.find(x => x.label === 'TOOLS');
  const a = r.arrows.find(x => x.to === 'zone:tools'), [x, y] = a.points.at(-1);
  assert.ok(!(x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h), 'outside');
  assert.ok(r.arrows.find(x => x.from === 'zone:tools').short, 'its reply has short dashes');
});

test('text stays at or over the poster\'s floor', async () => {
  const r = await boot(fixture());
  for (const t of r.texts) assert.ok(t.size >= 12 - 1e-6, `${t.role} "${t.text}" at ${t.size}`);
});

test('routes are the same on every boot', async () => {
  const [a, b] = [await boot(fixture()), await boot(fixture())];
  assert.deepEqual(a.arrows, b.arrows);
});

test('a map fits on linkedin-portrait, with the legend under it', async () => {
  const d = fixture();
  d.canvas = 'linkedin-portrait';
  d.panels[0].grid = { cols: 4, rows: 3 };
  const at = { user: [0, 0], app: [0, 1], gw: [1, 0], auth: [2, 0], svc: [2, 1], cache: [3, 1], db: [3, 2], a: [1, 2], b: [2, 2] };
  for (const n of d.panels[0].nodes) n.cell = at[n.id];
  await page.setViewportSize({ width: 1080, height: 1350 });
  const r = await boot(d);
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.deepEqual(r.res.failures, []);
  const rows = r.labels.filter(l => !l.badgeOnly), top = Math.min(...rows.map(l => l.box.y));
  for (const n of r.nodes) assert.ok(n.box.y + n.box.h < top, `${n.id} is above the legend`);
  assert.ok(new Set(rows.map(l => Math.round(l.box.x))).size === 2, 'two columns');
});

test('too many steps for the rail give LEGEND_OVERFLOW', async () => {
  const snake = Array.from({ length: 18 }, (_, i) => { const r = Math.floor(i / 6), c = r % 2 ? 5 - i % 6 : i % 6; return { id: `n${i}`, icon: 'lock', name: `N${i}`, cell: [c, r] }; });
  const d = { canvas: 'poster', template: 'map', title: 'A long legend', panels: [{ grid: { cols: 6, rows: 3 }, nodes: snake,
    steps: snake.slice(1).map((n, i) => ({ n: i + 1, from: `n${i}`, to: n.id, label: 'a step whose words take up two lines of the rail' })) }] };
  const f = (await boot(d)).res.failures.find(x => x.code === 'LEGEND_OVERFLOW');
  assert.ok(f, 'no LEGEND_OVERFLOW');
  assert.deepEqual(f.ids, ['main']);
});

test('a long legend doesn\'t hide empty rows in the map beside it', async () => {
  // Two rows of nodes out of five, and a legend running down the whole rail next to the empty space below them.
  const snake = Array.from({ length: 12 }, (_, i) => { const r = Math.floor(i / 6), c = r % 2 ? 5 - i % 6 : i % 6; return { id: `n${i}`, icon: 'lock', name: `N${i}`, cell: [c, r] }; });
  const d = { canvas: 'poster', template: 'map', title: 'Empty rows', panels: [{ grid: { cols: 6, rows: 5 }, nodes: snake,
    steps: snake.slice(1).map((n, i) => ({ n: i + 1, from: `n${i}`, to: n.id, label: 'a step whose words take up two lines of the rail' })) }] };
  const f = (await boot(d)).res.failures;
  assert.ok(f.some(x => x.code === 'EMPTY_BAND' && x.ids.includes('main')), JSON.stringify(f.map(x => x.code)));
});

test('spaghetti gives ARROW_TANGLE, on maps only', async () => {
  const r = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const a = window.composition.panels[0].layout.arrows[0], [x, y] = a.points[0];
    a.points = [[x, y], [x + 60, y], [x + 60, y + 60], [x + 120, y + 60], [x + 120, y + 120], [x + 180, y + 120], [x + 180, y + 180]];
    return window.checkGeometry();
  }, [fixture(), theme()]);
  assert.ok(r.some(f => f.code === 'ARROW_TANGLE' && f.ids.includes('s0')), JSON.stringify(r.map(f => f.code)));
  const flow = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const a = window.composition.panels[0].layout.arrows[0], [x, y] = a.points[0];
    a.points = [[x, y], [x + 60, y], [x + 60, y + 60], [x + 120, y + 60], [x + 120, y + 120], [x + 180, y + 120], [x + 180, y + 180]];
    return window.checkGeometry();
  }, [fixture('cdn'), theme()]);
  assert.ok(!flow.some(f => f.code === 'ARROW_TANGLE'));
});

test('a step with nowhere to go is reported, not thrown', async () => {
  const d = fixture();
  d.panels[0].grid = { cols: 3, rows: 1 };
  d.panels[0].nodes = [{ id: 'a', icon: 'lock', name: 'A', cell: [0, 0] }, { id: 'b', icon: 'key', name: 'B', cell: [1, 0] }, { id: 'c', icon: 'user', name: 'C', cell: [2, 0] }];
  d.panels[0].groups = [];
  d.panels[0].steps = Array.from({ length: 34 }, (_, i) => ({ from: i % 2 ? 'a' : 'c', to: i % 2 ? 'c' : 'a', label: '' }));
  const r = await boot(d);
  assert.ok(r.res.failures.some(f => f.code === 'UNROUTABLE'), JSON.stringify(r.res.failures.map(f => f.code)));
});

test('icons in a zone take its hue', async () => {
  const r = await page.evaluate(async ([d, t]) => {
    await window.boot(d, t, { style: 'filled', localIcons: [] });
    const cache = window.scene.placed.find(p => p.id === 'cache-ic');
    return [...new Set([...cache.g.querySelectorAll('[fill]')].map(e => e.getAttribute('fill')))];
  }, [fixture(), theme()]);
  assert.ok(r.includes(zoneStyles(theme()).violet.hue), r.join());
});

test('a map renders on the light and dark presets too', async () => {
  for (const name of ['light', 'dark']) assert.deepEqual((await boot(fixture(), theme(name))).res.failures, [], name);
});
