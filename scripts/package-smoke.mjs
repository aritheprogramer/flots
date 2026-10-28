import { _electron as electron } from 'playwright';
import path from 'node:path';
import { bundlePath } from './release-paths.mjs';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, mkdir } from 'node:fs/promises';
await mkdir('.test-profiles', { recursive: true });
const smokeProfile = await mkdtemp(path.resolve('.test-profiles/packaged-v3-'));
const application = await electron.launch({ executablePath: path.join(process.env.FLOTS_SMOKE_BUNDLE ?? bundlePath, 'Contents/MacOS/flots'), args: [], env: { ...process.env, FLOTS_PROFILE: smokeProfile, FLOTS_PACKAGED_SMOKE: '1' }, timeout: 60000 });
try {
  const ui = await application.firstWindow(); await ui.waitForFunction(() => !!window.flots);
  await ui.waitForFunction(async () => (await window.flots.getState()).tabs.length > 0);
  const before = await ui.evaluate(() => window.flots.getState());
  // Do not overwrite existing browsing metadata: create a dedicated temporary tab.
  const result = await ui.evaluate(() => window.flots.act({ type: 'new', url: 'https://example.com/' })); assert.ok(result.ok);
  await ui.waitForFunction(async () => { const s = await window.flots.getState(); const t = s.tabs.find(t => t.id === s.activeId); return t?.title === 'Example Domain' && t.lifecycle === 'loaded'; }, undefined, { timeout: 45000 });
  const current = await ui.evaluate(() => window.flots.getState());
  assert.equal(current.nativeGlass, true);
  await ui.evaluate(id => window.flots.act({ type: 'close', id }), current.activeId);
  if (before.activeId) await ui.evaluate(id => window.flots.act({ type: 'activate', id }), before.activeId);
  const resultRecord = { date: new Date().toISOString(), packaged: await application.evaluate(({ app }) => app.isPackaged), appVersion: await application.evaluate(({ app }) => app.getVersion()), nativeGlass: current.nativeGlass, versions: current.versions, navigation: 'https://example.com/', title: 'Example Domain', result: 'passed' };
  assert.ok(resultRecord.packaged); assert.equal(await application.evaluate(() => typeof globalThis.__flots), 'undefined'); await writeFile('docs/package-results.json', JSON.stringify(resultRecord, null, 2)); console.log(resultRecord);
} finally { await application.close(); }
