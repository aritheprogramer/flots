import test from 'node:test';
import assert from 'node:assert/strict';
import { accents, accentTokens, contrast } from '../src/shared/appearance';
import { settingsPatch } from '../src/shared/validation';
import { emptyProfile } from '../src/shared/model';
import { restoreProfile } from '../src/main/persistence';
import { iconPNG } from '../src/main/dock';
import { inflateSync } from 'node:zlib';
test('accent foreground and focus remain legible for presets and extreme custom colors', () => {
  for (const color of [...Object.values(accents), '#ffffff', '#000000', '#ffff00', '#00ffff', '#ff00ff']) for (const dark of [false, true]) {
    const t = accentTokens(color, dark);
    assert.ok(contrast(t.action, dark ? '#171a20' : '#ffffff') >= 4.5);
    assert.ok(contrast(t.selectedText, t.selected) >= 4.5);
    assert.ok(contrast(t.focus, dark ? '#30343d' : '#e9edf3') >= 3);
  }
});
test('V3 settings persist and reject arbitrary color/style values', () => {
  const p = emptyProfile(); assert.equal(p.settings.layout, 'horizontal');
  Object.assign(p.settings, settingsPatch({ accent: 'custom', customAccent: '#AABBCC', sidebarWidth: 310 }));
  const r = restoreProfile(p); assert.equal(r.settings.customAccent, '#aabbcc'); assert.equal(r.settings.sidebarWidth, 310);
  for (const patch of [{ customAccent: 'url(https://bad)' }, { accent: 'green' }, { sidebarWidth: 500 }, { sidebarWidth: 230.4 }, { layout: { toString: () => 'sidebar' } }]) assert.throws(() => settingsPatch(patch));
});
test('Dock PNG has valid dimensions, stable geometry and changes its actual pixels with accent', () => {
  const a = iconPNG('#6688bb'), b = iconPNG('#ce8199'); assert.notDeepEqual(a, b);
  assert.equal(a.readUInt32BE(16), 128); assert.equal(a.readUInt32BE(20), 128);
  const pixels = (png: Buffer) => { let pos = 8; while (pos < png.length) { const n = png.readUInt32BE(pos); if (png.toString('ascii', pos + 4, pos + 8) === 'IDAT') return inflateSync(png.subarray(pos + 8, pos + 8 + n)); pos += n + 12; } throw new Error('No pixels'); };
  const x = pixels(a), y = pixels(b); assert.equal(x.length, 128 * 513);
  for (let row = 0; row < 128; row++) for (let col = 0; col < 128; col++) { const i = row * 513 + 1 + col * 4; assert.equal(x[i + 3], y[i + 3]); }
  assert.throws(() => iconPNG('invalid')); assert.throws(() => iconPNG('#6688bb', 4096));
});
