import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
export async function profile(prefix) { await mkdir('.test-profiles', { recursive: true }); return mkdtemp(path.resolve(`.test-profiles/${prefix}-`)); }
export async function launch(dir) {
  const application = await electron.launch({ args: ['.'], env: { ...process.env, FLOTS_PROFILE: dir, FLOTS_TEST: '1' }, timeout: 60000 });
  application.process().stderr.on('data', data => { const s = data.toString(); if (/Error|error|Warning/.test(s) && !/Bluetooth|DevTools listening|CoreText|google_apis/.test(s)) process.stderr.write(s); });
  const ui = await application.firstWindow();
  await ui.waitForFunction(() => !!window.flots, { timeout: 30000 });
  await application.evaluate(() => new Promise(resolve => { const poll = () => globalThis.__flots?.tabs.get() ? resolve(true) : setTimeout(poll, 50); poll(); }));
  return { application, ui };
}
export async function action(application, a) { await application.evaluate(async (_e, action) => { await globalThis.__flots.action(action); }, a); }
export async function snapshot(application) { return application.evaluate(() => JSON.parse(JSON.stringify(globalThis.__flots.snapshot()))); }
export async function loaded(application, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const s = await snapshot(application); const t = [...s.tabs, ...s.favorites].find(t => t.id === s.activeId);
    if (t?.error) throw new Error(t.error);
    if (t?.lifecycle === 'loaded') return t;
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Navigation timed out');
}
export async function finish(application) {
  await application.evaluate(async () => { const b = globalThis.__flots; await b.store.flush(); b.profileSession.flushStorageData(); for (const t of b.tabs.all()) { t.dirty = false; t.protected = false; } });
  await application.close();
}
export const pause = ms => new Promise(r => setTimeout(r, ms));
