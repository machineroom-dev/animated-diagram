import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { paletteFromImage, themeFromBrand } from '../skills/animated-diagram/scripts/palette.mjs';
import { checkTheme, loadTheme, toHsl } from '../skills/animated-diagram/scripts/theme.mjs';
import { tmpDir } from './helpers/run.mjs';

const near = (a, b, tol) => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= tol);

test('palette finds both block colours', async () => {
  const png = path.join(tmpDir(), 'blocks.png');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x4169E1:s=32x64', '-f', 'lavfi', '-i', 'color=c=0xC6F73F:s=32x64',
    '-filter_complex', 'hstack', '-frames:v', '1', png]);
  const pal = await paletteFromImage(png);
  assert.ok(pal.some(c => near(c, '#4169E1', 6)), pal.join(' '));
  assert.ok(pal.some(c => near(c, '#C6F73F', 6)), pal.join(' '));
});

test('palette is deterministic', async () => {
  const png = path.join(tmpDir(), 'noise.png');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'mandelbrot=s=96x96', '-frames:v', '1', png]);
  assert.deepEqual(await paletteFromImage(png), await paletteFromImage(png));
});

test('themeFromBrand dark passes checkTheme', () => {
  const t = themeFromBrand({ primary: '#FF3366', mode: 'dark', name: 'brand-dark' });
  assert.equal(t.colors.primary, '#FF3366');
  assert.equal(t.colors.sideA, '#FF3366');
  assert.deepEqual(checkTheme(t).failures, []);
});

test('a brand theme tints side A from its own colour, not the preset\'s', () => {
  for (const mode of ['dark', 'light']) {
    const t = themeFromBrand({ primary: '#0E7490', mode, name: 'b' }), preset = loadTheme(mode).colors, [hue] = toHsl('#0E7490');
    assert.notEqual(t.colors.sideATint, preset.sideATint, mode);
    const d = Math.abs(toHsl(t.colors.sideATint)[0] - hue);
    assert.ok(Math.min(d, 360 - d) < 25, `${mode}: ${t.colors.sideATint} isn't a tint of the brand colour`);
    assert.deepEqual(checkTheme(t).failures, []);
  }
});

test('themeFromBrand light derives the dark and tint shades', () => {
  const t = themeFromBrand({ primary: '#4169E1', accent: '#C6F73F', mode: 'light', name: 'b' });
  assert.equal(t.colors.accent, '#C6F73F');
  assert.notEqual(t.colors.primaryDark, '#4169E1');
  assert.deepEqual(checkTheme(t).failures, []);
  assert.equal(loadTheme('light').mode, 'light');
});
