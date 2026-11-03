import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateDiagram } from '../skills/animated-diagram/scripts/schema.mjs';
import { ICONS } from '../skills/animated-diagram/engine/icons/index.js';
import { cli, tmpDir } from './helpers/run.mjs';

const S = 'skills/animated-diagram';
const EXAMPLES = ['cdn', 'cache-strategies', 'web-stack'];

test('the three examples validate', () => {
  const templates = {};
  for (const name of EXAMPLES) {
    const d = JSON.parse(fs.readFileSync(`${S}/examples/${name}.json`, 'utf8'));
    assert.deepEqual(validateDiagram(d, { icons: new Set(Object.keys(ICONS)) }), { ok: true, errors: [] }, name);
    templates[name] = d.template;
  }
  assert.deepEqual(templates, { cdn: 'flow-grid', 'cache-strategies': 'comparison', 'web-stack': 'stack' });
});

test('SKILL.md frontmatter has name and description', () => {
  const md = fs.readFileSync(`${S}/SKILL.md`, 'utf8');
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'frontmatter');
  assert.match(fm[1], /^name: animated-diagram$/m);
  const desc = fm[1].match(/^description: (.+)$/m)?.[1] ?? '';
  for (const phrase of ['animated diagram', 'system design GIF', 'diagram post', 'as a diagram']) assert.ok(desc.includes(phrase), phrase);
  assert.ok(desc.length <= 1024, 'description within the Agent Skills limit');
});

test('every reference SKILL.md points at exists', () => {
  const md = fs.readFileSync(`${S}/SKILL.md`, 'utf8');
  const refs = [...new Set(md.match(/(?:reference|examples|themes)\/[\w.-]+\.(?:md|json)/g))];
  assert.ok(refs.length >= 5, refs.join());
  for (const r of refs) assert.ok(fs.existsSync(path.join(S, r)), r);
  assert.ok(!/\/Users\/|\/home\//.test(md), 'no machine paths in the skill');
});

test('examples/cdn.json renders with light', { timeout: 300_000 }, () => {
  const out = tmpDir('ad-skill-');
  const r = cli(['render', `${S}/examples/cdn.json`, '--theme', 'light', '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  for (const ext of ['gif', 'mp4', 'png', 'check.json']) assert.ok(fs.existsSync(path.join(out, `cdn.${ext}`)), ext);
});
