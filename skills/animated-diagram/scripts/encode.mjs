// encode.mjs — frames (fNN.png) to GIF, MP4 and the still PNG, with ffmpeg.
//   GIF: one global palette (stats_mode=full), Bayer dither re-applied only to the changed rectangle, loop forever.
//   MP4: H.264 crf 16, the loop repeated (4× ≈ 10.8 s, past the platforms' minimum video length), padded to even sides.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SetupError } from './errors.mjs';

export const FPS = '100/3';               // a 3 cs GIF delay

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8' });
  if (r.error) throw new SetupError(`ffmpeg could not run (${r.error.message}); install ffmpeg and put it on PATH`);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.trim()}`);
}
const frames = dir => path.join(dir, 'f%02d.png');

export function encodeGif(framesDir, outPath, palettePath) {
  ffmpeg(['-framerate', FPS, '-i', frames(framesDir), '-vf', 'palettegen=max_colors=256:stats_mode=full:reserve_transparent=0', palettePath]);
  ffmpeg(['-framerate', FPS, '-i', frames(framesDir), '-i', palettePath, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', outPath]);
  return outPath;
}

export function encodeMp4(framesDir, outPath, { loops = 4, padColor = '#000000', frames: n = 90 } = {}) {
  const pad = `pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=0x${padColor.replace('#', '')}`;
  ffmpeg(['-framerate', FPS, '-i', frames(framesDir), '-vf', `loop=loop=${loops - 1}:size=${n}:start=0,${pad}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath]);
  return outPath;
}

export function stillPng(framesDir, f, outPath) {
  fs.copyFileSync(path.join(framesDir, `f${String(f).padStart(2, '0')}.png`), outPath);
  return outPath;
}
