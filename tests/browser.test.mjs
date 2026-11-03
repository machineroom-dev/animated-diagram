import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openPage } from '../skills/animated-diagram/scripts/browser.mjs';

const VIEW = { viewport: { width: 400, height: 300 } };

test('opens the engine page', async () => {
  const { page, done } = await openPage('engine/page.html', VIEW);
  try { assert.equal(await page.evaluate(() => window.ENGINE_LOADED), true); } finally { await done(); }
});

test('serves a mount', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-mount-'));
  fs.writeFileSync(path.join(dir, 'x.txt'), 'hi');
  const { page, done } = await openPage('engine/page.html', { ...VIEW, mounts: { '/m/': dir } });
  try { assert.equal(await page.evaluate(() => fetch('/m/x.txt').then(r => r.text())), 'hi'); } finally { await done(); }
});

test('takes and releases the lock', async () => {
  // Use the lab lock when it is exported (the one-Chrome rule holds during tests too); else a temp one.
  const saved = process.env.ANIMATED_DIAGRAM_RENDER_LOCK;
  const lock = saved || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ad-lock-')), '.renderlock');
  process.env.ANIMATED_DIAGRAM_RENDER_LOCK = lock;
  try {
    const { done } = await openPage('engine/page.html', VIEW);
    try {
      assert.ok(fs.existsSync(lock), 'lock dir exists while the page is open');
      assert.equal(fs.readFileSync(path.join(lock, 'pid'), 'utf8'), String(process.pid));
    } finally { await done(); }
    assert.equal(fs.existsSync(lock), false, 'lock dir is gone after done()');
  } finally {
    if (saved === undefined) delete process.env.ANIMATED_DIAGRAM_RENDER_LOCK; else process.env.ANIMATED_DIAGRAM_RENDER_LOCK = saved;
  }
});

test('bad CHROME_PATH fails clearly', async () => {
  const saved = process.env.CHROME_PATH;
  process.env.CHROME_PATH = '/nonexistent/chrome-binary';
  try {
    await assert.rejects(openPage('engine/page.html', VIEW), /CHROME_PATH/);
  } finally {
    if (saved === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = saved;
  }
  const lock = process.env.ANIMATED_DIAGRAM_RENDER_LOCK;
  if (lock) assert.equal(fs.existsSync(lock), false, 'a failed launch releases the lock');
});
