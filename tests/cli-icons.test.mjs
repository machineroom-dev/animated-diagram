// The icon CLI, in its own file: it launches Chrome in a child process, so no page may hold the lock meanwhile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ICONS } from '../skills/animated-diagram/engine/icons/index.js';
import { cli, tmpDir } from './helpers/run.mjs';

const TILE = 240, NAMES = Object.keys(ICONS);

test('cli icons lists the library; icon-sheet writes a 2× PNG', () => {
  const r = cli(['icons']);
  assert.equal(r.code, 0, r.err);
  for (const n of NAMES) assert.match(r.out, new RegExp(`\\b${n}\\b`));
  const out = path.join(tmpDir(), 'sheet.png');
  const s = cli(['icon-sheet', 'laptop', 'rack', '--theme', 'machine-room-dark', '--out', out], { env: process.env, timeout: 120_000 });
  assert.equal(s.code, 0, s.err);
  const buf = fs.readFileSync(out);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert.ok(w >= 9 * TILE * 2 && h >= 2 * TILE * 2, `${w}×${h}`);
});
