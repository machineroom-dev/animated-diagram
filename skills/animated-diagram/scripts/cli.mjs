#!/usr/bin/env node
// cli.mjs — the skill's one command.
//   theme (--preset <name> | --brand "#hex[,#hex]" --mode light|dark | --from-image <file> --mode light|dark | --check <file>) [--out diagram-theme.json] [--name <name>]
//   icons                                   list the icon library
//   icon-sheet <name...> [--theme <preset|file>] [--out sheet.png]   the 2× review sheet
//   render <diagram.json> [--theme <preset|file>] [--out out/] [--style filled|line|duotone] [--keep-frames]
//                                           → <name>.gif/.mp4/.png/.check.json; exit 0 ok, 2 check failed, 3 no theme, 1 error
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadTheme, checkTheme, TOKENS, TEXT_PAIRS, contrast, ThemeError } from './theme.mjs';
import { themeFromBrand, brandFromImage } from './palette.mjs';
import { iconSheet } from './icon-sheet.mjs';
import { render, RenderError } from './render.mjs';
import { SetupError } from './errors.mjs';
import { ICONS } from '../engine/icons/index.js';

const USAGE = `usage:
  cli.mjs theme (--preset <name> | --brand "#hex[,#hex]" --mode light|dark | --from-image <file> --mode light|dark | --check <file>)
                [--out diagram-theme.json] [--name <name>]
  cli.mjs icons
  cli.mjs icon-sheet <name...> [--theme <preset|file>] [--out sheet.png]
  cli.mjs render <diagram.json> [--theme <preset|file>] [--out out/] [--style filled|line|duotone] [--keep-frames]`;

function fail(msg, code = 1) { console.error(msg); process.exit(code); }

function colourTable(t) {
  const lines = TOKENS.map(tok => `  ${tok.padEnd(12)} ${t.colors[tok]}`);
  lines.push('', '  text pairs (≥ 4.5:1):', ...TEXT_PAIRS.map(([fg, bg]) => `  ${`${fg} on ${bg}`.padEnd(24)} ${contrast(t.colors[fg], t.colors[bg]).toFixed(2)}:1`));
  return lines.join('\n');
}

function reportFailures(where, failures) {
  return `${where} fails the theme check:\n` + failures.map(f => `  ${f.code}${f.pair ? ` [${f.pair.join(', ')}]` : ''}: ${f.detail}`).join('\n');
}

async function theme(argv) {
  const { values: o } = parseArgs({ args: argv, options: {
    preset: { type: 'string' }, brand: { type: 'string' }, 'from-image': { type: 'string' }, check: { type: 'string' },
    mode: { type: 'string' }, out: { type: 'string', default: 'diagram-theme.json' }, name: { type: 'string' },
  } });
  const sources = ['preset', 'brand', 'from-image', 'check'].filter(k => o[k] !== undefined);
  if (sources.length !== 1) fail(`theme: give exactly one of --preset, --brand, --from-image, --check\n${USAGE}`);
  if ((o.brand || o['from-image']) && !['light', 'dark'].includes(o.mode)) fail('theme: --brand and --from-image need --mode light|dark');

  let t;
  if (o.check) {
    t = loadTheme(o.check);
    const r = checkTheme(t);
    if (!r.ok) fail(reportFailures(o.check, r.failures));
    console.log(`${o.check} passes the theme check\n${colourTable(t)}`);
    return;
  }
  if (o.preset) t = loadTheme(o.preset);
  else if (o.brand) {
    const [primary, accent] = o.brand.split(',').map(s => s.trim());
    for (const c of [primary, accent].filter(Boolean)) if (!/^#[0-9A-Fa-f]{6}$/.test(c)) fail(`theme: "${c}" is not a #RRGGBB colour`);
    t = themeFromBrand({ primary, accent, mode: o.mode, name: o.name ?? `brand-${o.mode}` });
  } else {
    const { primary, accent } = await brandFromImage(o['from-image']);
    t = themeFromBrand({ primary, accent, mode: o.mode, name: o.name ?? `${path.basename(o['from-image']).replace(/\.\w+$/, '')}-${o.mode}` });
  }
  if (o.name && o.preset) t.name = o.name;
  const r = checkTheme(t);
  if (!r.ok) fail(reportFailures(t.name, r.failures));
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(t, null, 2) + '\n');
  console.log(`wrote ${o.out} (${t.name}, ${t.mode})\n${colourTable(t)}`);
}

async function icons() {
  for (const [name, m] of Object.entries(ICONS)) console.log(`${name.padEnd(16)} box ${m.box.join('×')}`);
}

async function sheet(argv) {
  const { values: o, positionals: names } = parseArgs({ args: argv, allowPositionals: true, options: {
    theme: { type: 'string', default: 'machine-room-dark' }, out: { type: 'string', default: 'sheet.png' } } });
  if (!names.length) fail(`icon-sheet: name at least one icon\n${USAGE}`);
  const file = await iconSheet(names, { theme: o.theme, out: o.out, known: Object.keys(ICONS) });
  console.log(`wrote ${file}`);
}

async function renderCmd(argv) {
  const { values: o, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    theme: { type: 'string' }, out: { type: 'string', default: 'out' }, style: { type: 'string' }, 'keep-frames': { type: 'boolean', default: false } } });
  if (positionals.length !== 1) fail(`render: name one diagram JSON\n${USAGE}`);
  const [diagramPath] = positionals;
  let themePath = o.theme;
  if (!themePath) {
    themePath = [path.join(path.dirname(path.resolve(diagramPath)), 'diagram-theme.json'), path.resolve('diagram-theme.json')].find(f => fs.existsSync(f));
    if (!themePath) fail(`no theme yet: run "cli.mjs theme" first (it writes diagram-theme.json next to the diagram), or pass --theme <preset|file>`, 3);
  }
  const r = await render({ diagramPath, themePath, outDir: o.out, style: o.style, keepFrames: o['keep-frames'] });
  const kb = f => fs.existsSync(f) ? ` (${Math.round(fs.statSync(f).size / 1024)} KB)` : '';
  console.log(`wrote ${Object.values(r.files).map(f => `${f}${kb(f)}`).join('\n      ')}`);
  console.log(r.ok ? `check: ok${r.warnings.length ? `, ${r.warnings.length} warning(s)` : ''}` : `check: ${r.failures.length} failure(s) — fix the diagram JSON and render again`);
  for (const f of r.failures) console.log(`  ${f.code}${f.ids?.length ? ` [${f.ids.join(', ')}]` : ''}: ${f.detail}`);
  for (const w of r.warnings) console.log(`  warning ${w.code}: ${w.detail}`);
  process.exit(r.ok ? 0 : 2);
}

const [cmd, ...rest] = process.argv.slice(2);
const COMMANDS = { theme, icons, 'icon-sheet': sheet, render: renderCmd };
if (!COMMANDS[cmd]) fail(USAGE);
try { await COMMANDS[cmd](rest); } catch (e) { fail(e instanceof ThemeError || e instanceof RenderError || e instanceof SetupError || e.code?.startsWith?.('ERR_PARSE_ARGS') ? e.message : e.stack); }
