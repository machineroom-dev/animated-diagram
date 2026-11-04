// A theme's logo moved from the old footer to the header: it replaces the accent dot, left of the brand text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';
import { tmpDir } from './helpers/run.mjs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const theme = JSON.parse(fs.readFileSync('skills/animated-diagram/themes/machine-room-dark.json', 'utf8'));
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/cdn.json', 'utf8'));

let page, done;
before(async () => {
  const dir = tmpDir('ad-logo-');
  fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from(PNG, 'base64'));
  ({ page, done } = await openPage('engine/page.html', { viewport: { width: 1080, height: 1350 }, mounts: { '/brand/': dir } }));
});
after(async () => { await done?.(); });

test('a theme logo sits in the header, left of the brand text, in place of the dot', async () => {
  const r = await page.evaluate(async ([d, t]) => {
    const res = await window.boot(d, t, { style: 'filled', localIcons: [] }), h = window.composition.header, b = h.brand.getBBox(), l = h.logo.getBBox();
    return { failures: res.failures, dot: !!h.dot, logo: { x: l.x, y: l.y, w: l.width, h: l.height }, brand: { x: b.x, y: b.y, h: b.height }, top: window.composition.panels[0].frame.y };
  }, [fixture, { ...theme, brand: { footer: 'Machine Room', logo: 'logo.png' } }]);
  assert.deepEqual(r.failures, []);
  assert.equal(r.dot, false);
  assert.ok(r.logo.x + r.logo.w <= r.brand.x, 'left of the text');
  assert.ok(r.logo.y + r.logo.h <= r.top, 'above the panel');
  assert.ok(Math.abs((r.logo.y + r.logo.h / 2) - (r.brand.y + r.brand.h / 2)) <= 3, 'centred on the brand text');
});
