// The pure colour module: its maths moved out of theme.mjs, and the zone palette derived from a theme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, relLum, toHsl, ZONE_NAMES, zoneStyles, zoneOrder, sideStyles } from '../skills/animated-diagram/scripts/colour.mjs';
import { loadTheme, contrast as themeContrast, nearestPassing as themeNearest } from '../skills/animated-diagram/scripts/theme.mjs';
import { themeFromBrand } from '../skills/animated-diagram/scripts/palette.mjs';

const PRESETS = ['light', 'dark', 'machine-room-dark'];
const HEX = /^#[0-9A-F]{6}$/;

test('theme.mjs still exports the colour maths, the same functions', () => {
  assert.equal(themeContrast, contrast);
  assert.equal(typeof themeNearest, 'function');
  assert.equal(contrast('#FFFFFF', '#000000'), 21);
});

test('every zone in every preset has every style, and its text passes on its fill', () => {
  for (const name of PRESETS) {
    const t = loadTheme(name), z = zoneStyles(t);
    assert.deepEqual(Object.keys(z), ZONE_NAMES, name);
    for (const zone of ZONE_NAMES) {
      const s = z[zone], at = `${name}.${zone}`;
      for (const key of ['hue', 'fill', 'stroke', 'text', 'ink', 'muted', 'hitText', 'missText']) assert.match(s[key], HEX, `${at}.${key}`);
      for (const key of ['text', 'ink', 'muted', 'hitText', 'missText']) assert.ok(contrast(s[key], s.fill) >= 4.5, `${at}.${key} ${s[key]} on ${s.fill}: ${contrast(s[key], s.fill).toFixed(2)}`);
    }
  }
});

test('a zone is visibly tinted and its border stands off its fill', () => {
  for (const name of PRESETS) {
    const t = loadTheme(name), z = zoneStyles(t);
    for (const zone of ZONE_NAMES) {
      assert.notEqual(z[zone].fill, t.colors.panel, `${name}.${zone} fill is the bare panel`);
      assert.ok(contrast(z[zone].stroke, z[zone].fill) >= 1.8, `${name}.${zone} stroke ${z[zone].stroke} on ${z[zone].fill}`);
    }
  }
});

test('an icon drawn in a zone gets its colour tokens from that zone', () => {
  for (const name of PRESETS) {
    const t = loadTheme(name), z = zoneStyles(t);
    for (const zone of ZONE_NAMES) {
      const tok = z[zone].tokens;
      assert.equal(tok.primary, z[zone].hue);
      assert.equal(tok.panel, z[zone].fill, 'line style knocks fills back to the zone, not the panel');
      assert.equal(tok.muted, z[zone].muted);
      for (const key of ['primaryDark', 'tint', 'neutral']) assert.match(tok[key], HEX, `${name}.${zone}.${key}`);
      // Duotone drops the outline, so an icon's tint body has to show on the zone's fill by itself.
      assert.ok(contrast(tok.tint, z[zone].fill) >= 1.25, `${name}.${zone} tint ${tok.tint} on ${z[zone].fill}: ${contrast(tok.tint, z[zone].fill).toFixed(2)}`);
    }
  }
});

test('the primary zone follows the theme primary; other hues follow theme.zones, else the mode default', () => {
  const t = loadTheme('light');
  assert.equal(zoneStyles(t).primary.hue, t.colors.primary);
  const over = { ...t, zones: { teal: '#112233' } };
  assert.equal(zoneStyles(over).teal.hue, '#112233');
  assert.equal(zoneStyles(over).violet.hue, zoneStyles(t).violet.hue);
});

test('a theme file without a zones field is not changed by deriving', () => {
  const t = loadTheme('dark'), copy = JSON.parse(JSON.stringify(t));
  zoneStyles(t);
  assert.deepEqual(t, copy);
  assert.equal('zones' in t, false);
});

test('zoneOrder starts at primary, holds enough for six zones and skips a hue that duplicates primary', () => {
  for (const name of PRESETS) {
    const t = loadTheme(name), order = zoneOrder(t), [h] = toHsl(t.colors.primary);
    assert.equal(order[0], 'primary');
    assert.ok(order.length >= 6, `${name}: ${order}`);
    assert.equal(new Set(order).size, order.length);
    const z = zoneStyles(t);
    for (const zone of order.slice(1)) {
      const d = Math.abs(toHsl(z[zone].hue)[0] - h), gap = Math.min(d, 360 - d);
      assert.ok(gap > 25, `${name}: ${zone} is ${gap.toFixed(0)}° from primary`);
    }
  }
  assert.ok(!zoneOrder(loadTheme('dark')).includes('violet'), 'the dark preset\'s primary is already violet');
  assert.ok(zoneOrder(loadTheme('dark')).includes('blue'));
});

test('zoneOrder always holds six different zones, whatever the primary', () => {
  for (const mode of ['dark', 'light']) for (const primary of ['#0E7490', '#0891B2', '#E4572E', '#FF3366', '#7C4DEB', '#14955F', '#D98A0B', '#2F6FDB']) {
    const t = themeFromBrand({ primary, mode, name: 'b' }), order = zoneOrder(t);
    assert.ok(order.length >= 6, `${primary} ${mode}: ${order}`);
    assert.equal(new Set(order).size, order.length);
    assert.equal(order[0], 'primary');
  }
});

test('relLum stays what theme.mjs always computed', () => {
  assert.equal(relLum('#000000'), 0);
  assert.equal(relLum('#FFFFFF'), 1);
});

test('text in a text box on a zone\'s tint passes', () => {
  for (const name of PRESETS) {
    const z = zoneStyles(loadTheme(name));
    for (const zone of ZONE_NAMES) assert.ok(contrast(z[zone].boxInk, z[zone].tokens.tint) >= 4.5, `${name}.${zone} ${z[zone].boxInk} on ${z[zone].tokens.tint}`);
  }
});

test('the two sides of a comparison get styles on their own tints', () => {
  for (const name of PRESETS) {
    const t = loadTheme(name), s = sideStyles(t);
    assert.deepEqual(Object.keys(s), ['A', 'B']);
    for (const side of ['A', 'B']) {
      const ground = t.colors[`side${side}Tint`];
      assert.equal(s[side].hue, t.colors[`side${side}`].toUpperCase());
      assert.equal(s[side].tokens.panel, ground, 'line style knocks fills back to the panel it sits on');
      for (const key of ['ink', 'muted', 'hitText', 'missText']) assert.ok(contrast(s[side][key], ground) >= 4.5, `${name}.${side}.${key}`);
    }
  }
});

test('presets tint their comparison panels', () => {
  for (const name of ['dark', 'machine-room-dark']) {
    const C = loadTheme(name).colors;
    assert.notEqual(C.sideATint, C.panel, name);
    assert.notEqual(C.sideBTint, C.panel, name);
  }
});
