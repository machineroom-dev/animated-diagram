// Shared test helpers: run the CLI, make temp dirs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CLI = path.resolve('skills/animated-diagram/scripts/cli.mjs');
export const tmpDir = (tag = 'ad-') => fs.mkdtempSync(path.join(os.tmpdir(), tag));
export function cli(args, opts = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', ...opts });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
