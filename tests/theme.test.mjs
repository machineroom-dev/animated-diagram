import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TOKENS, TEXT_PAIRS, loadTheme, checkTheme, contrast, relLum, nearestPassing, ThemeError } from '../skills/animated-diagram/scripts/theme.mjs';

const PRESETS = ['light', 'dark', 'machine-room-dark'];
const tmpTheme = obj => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ad-theme-')), 't.json'); fs.writeFileSync(p, JSON.stringify(obj)); return p; };

test('every preset loads and passes checkTheme', () => {
  for (const name of PRESETS) {
    const t = loadTheme(name);
    assert.equal(t.name, name);
    for (const tok of TOKENS) assert.match(t.colors[tok], /^#[0-9A-F]{6}$/i, `${name}.${tok}`);
    const r = checkTheme(t);
    assert.deepEqual(r.failures, [], `${name}: ${JSON.stringify(r.failures)}`);
    assert.equal(r.ok, true);
  }
});

test('the pairs and tokens are the agreed sets', () => {
  assert.equal(TOKENS.length, 31);   // the spike's 24 + groupText and the six side tokens
  assert.equal(TEXT_PAIRS.length, 21);
  for (const [fg, bg] of TEXT_PAIRS) assert.ok(TOKENS.includes(fg) && TOKENS.includes(bg));
});

test('every text colour is checked on each ground it is drawn on', () => {
  const pairs = TEXT_PAIRS.map(p => p.join('/'));
  for (const p of ['groupText/panel', 'muted/sideATint', 'muted/sideBTint', 'hitText/sideATint', 'hitText/sideBTint', 'missText/sideATint', 'missText/sideBTint']) assert.ok(pairs.includes(p), p);
});

test('text-box names are checked on their tints', () => {
  for (const tok of ['tint', 'sideATint', 'sideBTint']) {
    const t = loadTheme('light');
    t.colors[tok] = t.colors.ink;
    const r = checkTheme(t);
    assert.ok(r.failures.some(f => f.code === 'CONTRAST' && f.pair.join() === `ink,${tok}`), tok);
  }
});

test('contrast: white on black is 21, the spike group title fails', () => {
  assert.ok(Math.abs(contrast('#FFFFFF', '#000000') - 21) < 1e-9);
  assert.ok(contrast('#4169E1', '#0B1012') < 4.5);
  assert.equal(relLum('#000000'), 0);
});

test('a missing token throws and names it', () => {
  const t = JSON.parse(fs.readFileSync(path.resolve('skills/animated-diagram/themes/light.json'), 'utf8'));
  delete t.colors.groupText;
  t.colors.ink = 'blue';
  assert.throws(() => loadTheme(tmpTheme(t)), e => e instanceof ThemeError && /colors\.groupText/.test(e.message) && /colors\.ink/.test(e.message));
});

test('dark rule: a black outline on the dark ground fails', () => {
  const t = loadTheme('machine-room-dark');
  t.colors.outline = '#0B1012';
  const r = checkTheme(t);
  assert.equal(r.ok, false);
  assert.ok(r.failures.some(f => f.code === 'DARK_RULE' && /outline/.test(f.detail)));
});

test('nearestPassing lifts the group title to ≥ 4.5', () => {
  const c = nearestPassing('#4169E1', '#0B1012');
  assert.ok(contrast(c, '#0B1012') >= 4.5, c);
});

test('nearestPassing turns the other way when away from the ground cannot pass', () => {
  const c = nearestPassing('#FFFFFF', '#FFE600');      // white on yellow: no lighter colour exists
  assert.ok(contrast(c, '#FFE600') >= 4.5, c);
});
