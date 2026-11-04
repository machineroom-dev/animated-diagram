import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkGif, parseGif } from '../skills/animated-diagram/scripts/check-pixels.mjs';
import { encodeGif } from '../skills/animated-diagram/scripts/encode.mjs';
import { tmpDir } from './helpers/run.mjs';

const ff = args => { const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };

test('seam', async () => {
  const dir = tmpDir('ad-seam-');
  ff(['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=200x150:r=1', '-frames:v', '89', '-start_number', '0', path.join(dir, 'f%02d.png')]);
  ff(['-f', 'lavfi', '-i', 'color=c=0xcc6633:s=200x150', '-frames:v', '1', path.join(dir, 'f89.png')]);
  const gif = path.join(dir, 'seam.gif');
  encodeGif(dir, gif, path.join(dir, 'palette.png'));
  const h = parseGif(fs.readFileSync(gif));
  assert.equal(h.frames, 90);
  const r = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000 });
  assert.ok(r.failures.some(f => f.code === 'SEAM'), JSON.stringify(r));
  assert.ok(!r.failures.some(f => f.code === 'FLICKER'), JSON.stringify(r));
});

test('a change too small to see at the loop point is no SEAM', async () => {
  const dir = tmpDir('ad-tinyseam-');
  for (let i = 0; i < 89; i++) ff(['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=200x150', '-frames:v', '1', path.join(dir, `f${String(i).padStart(2, '0')}.png`)]);
  ff(['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=200x150,drawbox=x=10:y=10:w=2:h=2:color=0xffffff:t=fill', '-frames:v', '1', path.join(dir, 'f89.png')]);
  const gif = path.join(dir, 'tiny.gif');
  encodeGif(dir, gif, path.join(dir, 'palette.png'));
  const r = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000 });
  assert.ok(!r.failures.some(f => f.code === 'SEAM'), JSON.stringify(r));
});

test('flicker', async () => {
  const dir = tmpDir('ad-flicker-'), gif = path.join(dir, 'flicker.gif');
  // A static gradient with a box sliding across it: error diffusion re-dithers the gradient differently every frame.
  ff(['-f', 'lavfi', '-i', "nullsrc=s=320x240:r=100/3,geq=r='X*255/W':g='Y*255/H':b='128'", '-f', 'lavfi', '-i', 'color=c=white:s=24x24:r=100/3',
    '-filter_complex', "[0][1]overlay=x='mod(n*3,280)':y=20:shortest=1", '-frames:v', '90', '-start_number', '0', path.join(dir, 'f%02d.png')]);
  ff(['-framerate', '100/3', '-i', path.join(dir, 'f%02d.png'), '-vf', 'palettegen=max_colors=64:stats_mode=full', path.join(dir, 'p.png')]);
  ff(['-framerate', '100/3', '-i', path.join(dir, 'f%02d.png'), '-i', path.join(dir, 'p.png'), '-lavfi', 'paletteuse=dither=sierra2_4a', '-loop', '0', gif]);
  const r = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000 });
  assert.ok(r.failures.some(f => f.code === 'FLICKER'), JSON.stringify(r));
  // Shimmer inside a region declared as moving (icons, arrows) is motion, not flicker.
  const r3 = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, moving: [{ x: 0, y: 0, w: 320, h: 240 }] });
  assert.ok(!r3.failures.some(f => f.code === 'FLICKER'), JSON.stringify(r3));
  // The same frames through our encode (ordered dither, changed rectangle only) hold still.
  const ours = encodeGif(dir, path.join(dir, 'bayer.gif'), path.join(dir, 'p2.png'));
  const r2 = await checkGif(ours, { frames: 90, delayCs: 3, maxBytes: 5_000_000 });
  assert.ok(!r2.failures.some(f => f.code === 'FLICKER'), JSON.stringify(r2));
});

test('a zone whose tint the palette changed gives FILL_DRIFT', async () => {
  const dir = tmpDir('ad-drift-'), gif = path.join(dir, 'x.gif');
  ff(['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=200x150,drawbox=x=20:y=20:w=100:h=80:color=0x1c2a3a:t=fill', '-frames:v', '90', '-start_number', '0', path.join(dir, 'f%02d.png')]);
  encodeGif(dir, gif, path.join(dir, 'p.png'));
  const zone = { id: 'z', x: 20, y: 20, w: 100, h: 80 };
  const ok = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, fills: [{ ...zone, colour: '#1C2A3A' }] });
  assert.ok(!ok.failures.some(f => f.code === 'FILL_DRIFT'), JSON.stringify(ok));
  const bad = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, fills: [{ ...zone, colour: '#2A3A1C' }] });
  const f = bad.failures.find(x => x.code === 'FILL_DRIFT');
  assert.ok(f, JSON.stringify(bad));
  assert.deepEqual(f.ids, ['z']);
  assert.match(f.detail, /#2A3A1C/);
});

test('a panel mostly covered by a zone is judged by what shows of it', async () => {
  const dir = tmpDir('ad-drift3-'), gif = path.join(dir, 'x.gif');
  ff(['-f', 'lavfi', '-i', 'color=c=0x1a1d24:s=200x150,drawbox=x=10:y=10:w=180:h=130:color=0x29253f:t=fill', '-frames:v', '90', '-start_number', '0', path.join(dir, 'f%02d.png')]);
  encodeGif(dir, gif, path.join(dir, 'p.png'));
  const panel = { id: 'panel:main', x: 0, y: 0, w: 200, h: 150, colour: '#1A1D24' }, zone = { x: 10, y: 10, w: 180, h: 130 };
  const fine = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, fills: [{ ...panel, holes: [zone] }] });
  assert.ok(!fine.failures.some(f => f.code === 'FILL_DRIFT'), JSON.stringify(fine));
  const wrong = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, fills: [{ ...panel, colour: '#2A3A1C', holes: [zone] }] });
  assert.ok(wrong.failures.some(f => f.code === 'FILL_DRIFT'), 'it still catches a real drift');
  const covered = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, fills: [{ ...panel, colour: '#2A3A1C', holes: [{ x: 0, y: 0, w: 200, h: 150 }] }] });
  assert.ok(!covered.failures.some(f => f.code === 'FILL_DRIFT'), 'nothing shows, so nothing to judge');
});

test('a zone off the edge of the card is clipped, not an error', async () => {
  const dir = tmpDir('ad-drift2-'), gif = path.join(dir, 'x.gif');
  ff(['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=64x48', '-frames:v', '90', '-start_number', '0', path.join(dir, 'f%02d.png')]);
  encodeGif(dir, gif, path.join(dir, 'p.png'));
  const r = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 5_000_000, fills: [{ id: 'z', x: -10, y: -10, w: 500, h: 500, colour: '#3366CC' }] });
  assert.ok(!r.failures.some(f => f.code === 'FILL_DRIFT'), JSON.stringify(r));
});

test('headers: frame count, delays, loop flag and size', async () => {
  const dir = tmpDir('ad-hdr-'), gif = path.join(dir, 'x.gif');
  ff(['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=64x48:r=10', '-frames:v', '12', '-loop', '-1', gif]);   // 12 frames, 10 cs, no loop
  const h = parseGif(fs.readFileSync(gif));
  assert.equal(h.frames, 12);
  assert.ok(h.delays.every(d => d === 10), h.delays.join());
  const r = await checkGif(gif, { frames: 90, delayCs: 3, maxBytes: 100, budgetBytes: 50 });
  for (const code of ['FRAME_COUNT', 'DELAY', 'LOOP', 'FILE_SIZE']) assert.ok(r.failures.some(f => f.code === code), `${code}: ${JSON.stringify(r)}`);
  assert.ok(r.warnings.some(w => w.code === 'BUDGET'));
});
