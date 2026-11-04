import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateDiagram } from '../skills/animated-diagram/scripts/schema.mjs';
import { ICONS } from '../skills/animated-diagram/engine/icons/index.js';
import { cli, tmpDir } from './helpers/run.mjs';

const S = 'skills/animated-diagram';
const EXAMPLES = ['cdn', 'cache-strategies', 'web-stack', 'anatomy-of-an-ai-app'];

test('the four examples validate', () => {
  const templates = {};
  for (const name of EXAMPLES) {
    const d = JSON.parse(fs.readFileSync(`${S}/examples/${name}.json`, 'utf8'));
    assert.deepEqual(validateDiagram(d, { icons: new Set(Object.keys(ICONS)) }), { ok: true, errors: [] }, name);
    templates[name] = d.template;
  }
  assert.deepEqual(templates, { cdn: 'flow-grid', 'cache-strategies': 'comparison', 'web-stack': 'stack', 'anatomy-of-an-ai-app': 'map' });
});

test('SKILL.md frontmatter has name and description', () => {
  const md = fs.readFileSync(`${S}/SKILL.md`, 'utf8');
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'frontmatter');
  assert.match(fm[1], /^name: animated-diagram$/m);
  const desc = fm[1].match(/^description: (.+)$/m)?.[1] ?? '';
  for (const phrase of ['animated diagram', 'system design GIF', 'diagram post', 'as a diagram', 'system map']) assert.ok(desc.includes(phrase), phrase);
  assert.ok(desc.length <= 1024, 'description within the Agent Skills limit');
});

test('every reference SKILL.md points at exists', () => {
  const md = fs.readFileSync(`${S}/SKILL.md`, 'utf8');
  const refs = [...new Set(md.match(/(?:reference|examples|themes)\/[\w.-]+\.(?:md|json)/g))];
  assert.ok(refs.length >= 5, refs.join());
  for (const r of refs) assert.ok(fs.existsSync(path.join(S, r)), r);
  assert.ok(!/\/Users\/|\/home\//.test(md), 'no machine paths in the skill');
});

test('SKILL.md and the template guide teach the map, and every check code is documented', () => {
  const md = fs.readFileSync(`${S}/SKILL.md`, 'utf8'), guide = fs.readFileSync(`${S}/reference/templates.md`, 'utf8'), format = fs.readFileSync(`${S}/reference/diagram-format.md`, 'utf8');
  assert.match(md, /examples\/anatomy-of-an-ai-app\.json/);
  assert.match(md, /flow-grid, comparison, stack or map/);
  assert.match(guide, /^- \*\*map\*\*/m);
  assert.match(format, /zone:<id>/);
  assert.match(format, /`poster`/);
  const engine = ['engine/check-geom.js', 'engine/orth.js', 'scripts/check-pixels.mjs'].map(f => fs.readFileSync(`${S}/${f}`, 'utf8')).join('\n');
  const codes = new Set([...engine.matchAll(/(?:fail|code:)\s*\(?'([A-Z_]+)'/g)].map(m => m[1]));
  for (const code of ['LEGEND_OVERFLOW', 'ARROW_TANGLE', 'TITLE_TOO_WIDE', 'ROWS_TOO_TALL', 'FILL_DRIFT', 'UNROUTABLE']) assert.ok(codes.has(code), `${code} is raised`);
  for (const code of codes) assert.ok(guide.includes(`\`${code}\``), `${code} is documented`);
});

test('the map example renders with light, as CI does', { timeout: 300_000 }, () => {
  const out = tmpDir('ad-skill-map-');
  const r = cli(['render', `${S}/examples/anatomy-of-an-ai-app.json`, '--theme', 'light', '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'anatomy-of-an-ai-app.check.json'), 'utf8')).ok, true);
});

test('examples/cdn.json renders with light', { timeout: 300_000 }, () => {
  const out = tmpDir('ad-skill-');
  const r = cli(['render', `${S}/examples/cdn.json`, '--theme', 'light', '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  for (const ext of ['gif', 'mp4', 'png', 'check.json']) assert.ok(fs.existsSync(path.join(out, `cdn.${ext}`)), ext);
});
