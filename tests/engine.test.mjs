import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

let page, done;
before(async () => { ({ page, done } = await openPage('engine/test-page.html', { viewport: { width: 1080, height: 600 } })); });
after(async () => { await done?.(); });

// A fresh Scene on the test page's <svg>, light theme, k = 1. `fn` runs in the page with (E, scene, T).
const inScene = (fn, arg) => page.evaluate(async ([src, arg]) => {
  const theme = await (await fetch('/themes/light.json')).json();
  const svg = document.getElementById('card');
  svg.innerHTML = '';
  const scene = new window.E.Scene(svg, theme, 1, { style: 'filled', localIcons: {} });
  return new Function('E', 'scene', 'T', 'arg', `return (${src})(E, scene, T, arg)`)(window.E, scene, theme.colors, arg);
}, [fn.toString(), arg]);

test('constants', async () => {
  const c = await page.evaluate(() => { const { FRAMES, PL, PS, DL, DS, V, ARM, CORNER_R, BADGE_R } = window.E; return { FRAMES, PL, PS, DL, DS, V, ARM, CORNER_R, BADGE_R }; });
  assert.deepEqual(c, { FRAMES: 90, PL: 30.70, PS: 15.35, DL: 15, DS: 7.1, V: 8 * 30.70 / 90, ARM: 10, CORNER_R: 11.5, BADGE_R: 15.5 });
});

test('dash march is seamless', async () => {
  const [o0, o90, PL] = await inScene((E, scene) => {
    scene.arrow('a', [[100, 100], [400, 100]]);
    const el = document.getElementById('a');
    scene.seek(0); const o0 = +el.getAttribute('stroke-dashoffset');
    scene.seek(90); const o90 = +el.getAttribute('stroke-dashoffset');
    return [o0, o90, E.PL];
  });
  assert.ok(Math.abs(o0 - o90 - 8 * PL) < 1e-6, `${o0} - ${o90}`);
});

test('a dash meets the head at f0', async () => {
  for (const pts of [[[100, 100], [400, 100]], [[100, 100], [100, 300], [500, 300]], [[50, 50], [50, 200], [300, 200], [300, 90]]]) {
    const r = await inScene((E, scene, T, pts) => {
      scene.arrow('a', pts);
      scene.seek(0);
      const el = document.getElementById('a');
      return { off0: +el.getAttribute('stroke-dashoffset'), L: scene.marching[0].L, total: el.getTotalLength(), PL: E.PL, DL: E.DL };
    }, pts);
    const m = ((r.off0 + r.L - r.DL) % r.PL + r.PL) % r.PL;
    assert.ok(Math.min(m, r.PL - m) < 1e-3, `remainder ${m}`);
    assert.ok(Math.abs(r.L - r.total) < 0.5, `analytic length ${r.L} vs the browser's ${r.total}`);
  }
});

test('bends are rounded', async () => {
  const d = await inScene((E, scene) => { scene.arrow('a', [[100, 100], [100, 300], [500, 300]]); return document.getElementById('a').getAttribute('d'); });
  assert.match(d, /A11\.5[ ,]11\.5/);
});

test('label sides', async () => {
  const r = await inScene(async (E, scene) => {
    const l = scene.label({ n: 3, text: 'GET /logo.png', x: 400, y: 200, side: 'left', maxWidth: 400 });
    const rr = scene.label({ n: 7, text: 'logo.png', x: 600, y: 200, side: 'right', maxWidth: 400 });
    const c = scene.label({ text: 'check cache', x: 500, y: 300, side: 'center', maxWidth: 400 });
    await scene.layoutLabels();
    const box = id => document.getElementById(id).getBoundingClientRect();
    const svgBox = document.getElementById('card').getBoundingClientRect();
    const tx = id => document.querySelector(`#${id} text.tx`).getBoundingClientRect();
    const bd = id => document.querySelector(`#${id} circle`).getBoundingClientRect();
    return { leftTextRight: tx(l).right - svgBox.left, rightBadgeLeft: bd(rr).left - svgBox.left,
      centre: (box(c).left + box(c).right) / 2 - svgBox.left, boxes: scene.labels.map(L => L.box) };
  });
  assert.ok(Math.abs(r.leftTextRight - 400) <= 0.5, `left: ${r.leftTextRight}`);
  assert.ok(Math.abs(r.rightBadgeLeft - 600) <= 0.5, `right: ${r.rightBadgeLeft}`);
  assert.ok(Math.abs(r.centre - 500) <= 0.5, `center: ${r.centre}`);
  for (const b of r.boxes) assert.ok(b.w > 0 && b.h > 0);
});

test('two-line wrap', async () => {
  // Plan said maxWidth 150, but no split of this text fits 150 at 17.5 px (the best has a 156 px line): see ledger.
  const r = await inScene(async (E, scene) => {
    const id = scene.label({ text: 'keeps the copy for max-age of the file', x: 300, y: 200, side: 'right', maxWidth: 160 });
    await scene.layoutLabels();
    return { widths: [...document.querySelectorAll(`#${id} tspan`)].map(s => s.getComputedTextLength()), overflow: scene.labels[0].overflow };
  });
  assert.equal(r.widths.length, 2);
  for (const w of r.widths) assert.ok(w <= 160, `line ${w}`);
  assert.equal(r.overflow, false);
});

test('a label that two lines cannot fit is flagged, never silently squeezed', async () => {
  const r = await inScene(async (E, scene) => {
    scene.label({ text: 'keeps the copy for max-age of the file', x: 300, y: 200, side: 'right', maxWidth: 100 });
    await scene.layoutLabels();
    return { lines: scene.labels[0].lines, overflow: scene.labels[0].overflow };
  });
  assert.equal(r.lines, 2);
  assert.equal(r.overflow, true);
});

test('maxWidth counts the badge', async () => {
  const r = await inScene(async (E, scene) => {
    const probe = scene.label({ text: 'not grounded: retry', x: 300, y: 100, side: 'right' });
    await scene.layoutLabels();
    const textW = scene.labels[0].widths[0];
    scene.labels.length = 0;
    scene.label({ n: 5, text: 'not grounded: retry', x: 300, y: 200, side: 'right', maxWidth: textW + 10 });
    await scene.layoutLabels();
    return { lines: scene.labels[0].lines, w: scene.labels[0].box.w, max: textW + 10 };
  });
  assert.equal(r.lines, 2, 'text + badge is wider than maxWidth, so it wraps');
  assert.ok(r.w <= r.max, `${r.w} > ${r.max}`);
});

test('special characters', async () => {
  const input = 'a & b < c "d" → e 🙂';
  const r = await inScene(async (E, scene, T, input) => {
    const id = scene.label({ n: 1, text: input, x: 300, y: 200, side: 'right', maxWidth: 800 });
    const t = scene.text(100, 100, input, { size: 20, weight: 500, fill: T.ink });
    await scene.layoutLabels();
    return { label: document.querySelector(`#${id} text.tx`).textContent, text: t.textContent, w: document.querySelector(`#${id} text.tx`).getComputedTextLength() };
  }, input);
  assert.equal(r.label, input);
  assert.equal(r.text, input);
  assert.ok(r.w > 100);
});

test('solid arrows don\'t march', async () => {
  const r = await inScene((E, scene) => {
    scene.arrow('s', [[100, 100], [400, 100]], { kind: 'solid' });
    const el = document.getElementById('s');
    scene.seek(0); const a = el.outerHTML; scene.seek(45);
    return { dash: el.getAttribute('stroke-dasharray'), same: a === el.outerHTML };
  });
  assert.equal(r.dash, null);
  assert.equal(r.same, true);
});

test('kinds pick colour and dash', async () => {
  const r = await inScene((E, scene, T) => {
    const out = {};
    for (const kind of ['normal', 'hit', 'miss', 'retry']) {
      scene.arrow(kind, [[100, 100], [400, 100]], { kind });
      const el = document.getElementById(kind);
      out[kind] = [el.getAttribute('stroke'), el.getAttribute('stroke-dasharray')];
    }
    return { out, T };
  });
  assert.deepEqual(r.out.normal, [r.T.line, '15 15.7']);
  assert.equal(r.out.hit[0], r.T.hit);
  assert.equal(r.out.miss[0], r.T.miss);
  assert.deepEqual(r.out.retry, [r.T.miss, '7.1 8.25']);
});

test('boot loads the theme font from the skill root', async () => {
  await done(); done = null;
  const p = await openPage('engine/page.html', { viewport: { width: 400, height: 300 } });
  try {
    const r = await p.page.evaluate(async () => {
      const theme = await (await fetch('/themes/machine-room-dark.json')).json();
      const d = { canvas: 'square', template: 'flow-grid', title: 'Font', panels: [{ grid: { cols: 1, rows: 1 }, nodes: [{ id: 'a', icon: 'lock', name: 'A', cell: [0, 0] }], steps: [] }] };
      const res = await window.boot(d, theme, { style: 'filled', localIcons: [] });
      return { ok: document.fonts.check(`600 20px ${theme.font.family}`), status: [...document.fonts].find(f => f.family.replace(/"/g, '') === theme.font.family)?.status, res };
    });
    assert.equal(r.status, 'loaded');
    assert.ok(Array.isArray(r.res.failures));
  } finally { await p.done(); }
});
