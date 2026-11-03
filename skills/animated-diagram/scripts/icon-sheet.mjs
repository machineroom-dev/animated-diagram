// icon-sheet.mjs — the 2× review sheet: one row per icon, columns f0 / f30 / f60 in filled, line and duotone.
import path from 'node:path';
import fs from 'node:fs';
import { openPage } from './browser.mjs';
import { loadTheme } from './theme.mjs';

const STYLES = ['filled', 'line', 'duotone'], FRAMES = [0, 30, 60], TILE = 240;

export async function iconSheet(names, { theme = 'machine-room-dark', out = 'sheet.png', known }) {
  const t = loadTheme(theme);
  const unknown = known ? names.filter(n => !known.includes(n)) : [];
  if (unknown.length) throw new Error(`unknown icon(s): ${unknown.join(', ')} — "cli.mjs icons" lists the library`);
  const cols = STYLES.length * FRAMES.length;
  const viewport = { width: 170 + cols * TILE, height: 56 + names.length * TILE };
  const { page, done } = await openPage('engine/icon-test.html', { viewport, dsf: 2 });
  try {
    const cells = names.flatMap(icon => STYLES.flatMap(style => FRAMES.map(f => ({ icon, style, f }))));
    const colLabels = STYLES.flatMap(s => FRAMES.map(f => `${s} · f${f}`));
    await page.evaluate(([cells, theme, cols, rowLabels, colLabels]) => window.grid(cells, { theme, cols, rowLabels, colLabels }).then(() => 0),
      [cells, t, cols, names, colLabels]);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await page.screenshot({ path: out, clip: { x: 0, y: 0, ...viewport } });
  } finally { await done(); }
  return path.resolve(out);
}
