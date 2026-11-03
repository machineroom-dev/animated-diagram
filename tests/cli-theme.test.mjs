import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkTheme, loadTheme } from '../skills/animated-diagram/scripts/theme.mjs';
import { cli, tmpDir } from './helpers/run.mjs';

test('cli theme --preset machine-room-dark writes the preset', () => {
  const out = path.join(tmpDir(), 'diagram-theme.json');
  const r = cli(['theme', '--preset', 'machine-room-dark', '--out', out]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), JSON.parse(fs.readFileSync('skills/animated-diagram/themes/machine-room-dark.json', 'utf8')));
  assert.match(r.out, /primary\s+#4169E1/);
});

test('cli theme --brand "#FFE600" --mode light writes a passing theme', () => {
  const out = path.join(tmpDir(), 'diagram-theme.json');
  const r = cli(['theme', '--brand', '#FFE600', '--mode', 'light', '--out', out]);
  assert.equal(r.code, 0, r.err);
  const t = loadTheme(out);
  assert.equal(t.colors.primary, '#FFE600');
  assert.deepEqual(checkTheme(t).failures, []);
});

test('cli theme --from-image takes the two strongest colours', () => {
  const dir = tmpDir();
  const png = path.join(dir, 'logo.png');
  // 3/4 blue, 1/4 green, on a white strip that must be ignored
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x4169E1:s=48x48', '-f', 'lavfi', '-i', 'color=c=0x0F9F6E:s=16x48',
    '-f', 'lavfi', '-i', 'color=c=white:s=64x16', '-filter_complex', '[0][1]hstack[t];[t][2]vstack', '-frames:v', '1', png]);
  const out = path.join(dir, 'diagram-theme.json');
  const r = cli(['theme', '--from-image', png, '--mode', 'dark', '--out', out]);
  assert.equal(r.code, 0, r.err);
  const t = loadTheme(out);
  const near = (a, b) => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 6);
  assert.ok(near(t.colors.primary, '#4169E1'), t.colors.primary);
  assert.ok(near(t.colors.accent, '#0F9F6E'), t.colors.accent);
  assert.deepEqual(checkTheme(t).failures, []);
});

test('a hand-edited failing theme reports CONTRAST [ink, panel]', () => {
  const t = loadTheme('light');
  t.colors.ink = '#DDDDDD';
  const f = path.join(tmpDir(), 'bad.json');
  fs.writeFileSync(f, JSON.stringify(t));
  const r = checkTheme(loadTheme(f));
  assert.ok(r.failures.some(x => x.code === 'CONTRAST' && x.pair.join() === 'ink,panel'));
  const c = cli(['theme', '--check', f]);
  assert.equal(c.code, 1);
  assert.match(c.err, /CONTRAST \[ink, panel\]/);
  assert.match(c.err, /nearest passing ink: #/);
});
