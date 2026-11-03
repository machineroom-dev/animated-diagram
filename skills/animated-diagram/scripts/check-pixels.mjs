// check-pixels.mjs — the checks on the encoded GIF.
//   parseGif(buf) -> { width, height, frames, delays (cs), loop (0 = forever, null = plays once) }   headers only, no LZW
//   checkGif(file, { frames, delayCs, maxBytes, budgetBytes, moving }) -> Promise<{ failures, warnings, bytes }>
// The pixels come from ffmpeg (rgb24). A pixel "changes" between two frames when a channel moves by more than 24.
//   SEAM: the f89 → f0 change is more than 1.5× the median frame-to-frame change.
//   FLICKER: pixels whose largest change over the loop is in (0, 24] — dither crawling on what should be still — are
//   more than 0.05 % of the card. Pixels inside `moving` boxes (icons, arrows) are left out: an icon's slow turn or
//   fade legitimately changes its anti-aliased edges by a few levels.
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const STEP = 24, SEAM_RATIO = 1.5, FLICKER_SHARE = 0.0005;

export function parseGif(buf) {
  if (buf.toString('latin1', 0, 3) !== 'GIF') throw new Error('not a GIF file');
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8), packed = buf[10];
  let i = 13 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0), frames = 0, loop = null;
  const delays = [];
  const skipBlocks = () => { while (buf[i] !== 0) i += buf[i] + 1; i++; };
  while (i < buf.length) {
    const b = buf[i++];
    if (b === 0x3B) break;                                       // trailer
    if (b === 0x21) {                                            // extension
      const label = buf[i++];
      if (label === 0xF9) { delays.push(buf.readUInt16LE(i + 2)); i += buf[i] + 1; skipBlocks(); }
      else if (label === 0xFF && buf.toString('latin1', i + 1, i + 12) === 'NETSCAPE2.0') {
        i += buf[i] + 1;
        if (buf[i] >= 3 && buf[i + 1] === 1) loop = buf.readUInt16LE(i + 2);
        skipBlocks();
      } else { i += buf[i] + 1; skipBlocks(); }
    } else if (b === 0x2C) {                                     // image
      frames++;
      const p = buf[i + 8];
      i += 9 + (p & 0x80 ? 3 * 2 ** ((p & 7) + 1) : 0);
      i++;                                                       // LZW minimum code size
      skipBlocks();
    } else throw new Error(`GIF: unexpected block 0x${b.toString(16)} at byte ${i - 1}`);
  }
  return { width, height, frames, delays, loop };
}

// Streams the decoded frames through fn(frame, index), one rgb24 buffer at a time.
function eachFrame(file, size, fn) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    let cur = Buffer.alloc(size), fill = 0, n = 0, err = '';
    p.stdout.on('data', chunk => {
      let off = 0;
      while (off < chunk.length) {
        const take = Math.min(size - fill, chunk.length - off);
        chunk.copy(cur, fill, off, off + take); fill += take; off += take;
        if (fill === size) { fn(cur, n++); cur = Buffer.alloc(size); fill = 0; }
      }
    });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => reject(new Error(`ffmpeg could not run (${e.message})`)));
    p.on('close', code => code === 0 ? resolve(n) : reject(new Error(`ffmpeg could not decode ${file}: ${err.trim()}`)));
  });
}

export async function checkGif(file, { frames = 90, delayCs = 3, maxBytes, budgetBytes = 1_000_000, moving = [] } = {}) {
  const failures = [], warnings = [], buf = fs.readFileSync(file), bytes = buf.length, h = parseGif(buf);
  const fail = (code, detail) => failures.push({ code, ids: [], detail });
  if (h.frames !== frames) fail('FRAME_COUNT', `${h.frames} frames, expected ${frames}`);
  const bad = h.delays.filter(d => d !== delayCs);
  if (bad.length || h.delays.length !== h.frames) fail('DELAY', `frame delays must all be ${delayCs} cs; found ${[...new Set(h.delays)].join(', ') || 'none'}`);
  if (h.loop !== 0) fail('LOOP', h.loop === null ? 'no loop flag: the GIF plays once' : `loop count ${h.loop}, expected 0 (forever)`);
  if (maxBytes && bytes > maxBytes) fail('FILE_SIZE', `${(bytes / 1e6).toFixed(2)} MB is over the platform cap of ${(maxBytes / 1e6).toFixed(1)} MB`);
  if (bytes > budgetBytes) warnings.push({ code: 'BUDGET', detail: `${(bytes / 1e6).toFixed(2)} MB is over the ${(budgetBytes / 1e6).toFixed(1)} MB budget` });

  const px = h.width * h.height, size = px * 3, maxDelta = new Uint8Array(px), steps = [];
  let first = null, prev = null, last = null;
  const delta = (a, b, out) => {
    let changed = 0;
    for (let p = 0, o = 0; p < px; p++, o += 3) {
      const d = Math.max(Math.abs(a[o] - b[o]), Math.abs(a[o + 1] - b[o + 1]), Math.abs(a[o + 2] - b[o + 2]));
      if (d > STEP) changed++;
      if (d > out[p]) out[p] = d;
    }
    return changed;
  };
  const n = await eachFrame(file, size, (f, i) => {
    if (i === 0) first = f; else steps.push(delta(prev, f, maxDelta));
    prev = f; last = f;
  });
  if (n > 1) {
    const seam = delta(last, first, maxDelta), sorted = [...steps].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
    if (seam > SEAM_RATIO * median) fail('SEAM', `${seam} px change from the last frame to the first, against a median of ${median} between frames — the loop jumps`);
    const still = new Uint8Array(px).fill(1);
    for (const b of moving) {
      const x0 = Math.max(0, Math.floor(b.x)), x1 = Math.min(h.width, Math.ceil(b.x + b.w)), y0 = Math.max(0, Math.floor(b.y)), y1 = Math.min(h.height, Math.ceil(b.y + b.h));
      for (let y = y0; y < y1; y++) still.fill(0, y * h.width + x0, y * h.width + Math.max(x0, x1));
    }
    let crawl = 0;
    for (let p = 0; p < px; p++) if (still[p] && maxDelta[p] > 0 && maxDelta[p] <= STEP) crawl++;
    if (crawl > FLICKER_SHARE * px) fail('FLICKER', `${crawl} px (${(100 * crawl / px).toFixed(2)} %) shimmer by ≤ ${STEP} levels across the loop; still pixels must stay still`);
  }
  return { failures, warnings, bytes };
}
