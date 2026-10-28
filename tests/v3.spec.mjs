import { test, expect } from 'playwright/test';
import http from 'node:http';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { profile, launch, action, snapshot, loaded, finish, pause } from '../scripts/test-support.mjs';
test('V3 browser controls, personalization, lifecycle and visual regressions', async () => {
  const server = http.createServer((req, res) => { if (req.url === '/slow-download') { const chunk = Buffer.alloc(65536, 65); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename=progress-test.bin', 'Content-Length': chunk.length * 20 }); let count = 0; const timer = setInterval(() => { res.write(chunk); if (++count === 20) { clearInterval(timer); res.end(); } }, 150); res.on('close', () => clearInterval(timer)); return; } res.setHeader('Content-Type', 'text/html'); res.end(`<title>Reference ${req.url}</title><h1>Live Chromium page</h1><p>${req.url}</p>`); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const dir = await profile('v3'); let app;
  const key = path.join(dir, 'test-key.pem'), cert = path.join(dir, 'test-cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', key, '-out', cert, '-days', '1', '-nodes', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const tls = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (_req, res) => res.end('untrusted TLS'));
  await new Promise(r => tls.listen(0, '127.0.0.1', r));
  try {
    let run = await launch(dir); app = run.application; let ui = run.ui;
    const errors = []; ui.on('pageerror', e => errors.push(e.message)); ui.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FILE_NOT_FOUND')) errors.push(m.text()); });
    expect((await snapshot(app)).settings.layout).toBe('horizontal');
    expect((await snapshot(app)).nativeGlass).toBe(true);
    await app.evaluate(() => globalThis.__flots.glass.dispose()); expect((await snapshot(app)).nativeGlass).toBe(false); await app.evaluate(() => globalThis.__flots.glass.update()); expect((await snapshot(app)).nativeGlass).toBe(true);
    await expect(ui.locator('#horizontal-strip')).toBeVisible();
    expect(await ui.locator('#horizontal-strip').evaluate(el => el.getBoundingClientRect().height)).toBe(45);
    expect(await ui.locator('#toolbar').evaluate(el => el.getBoundingClientRect().top)).toBe(45);
    expect(await ui.locator('#toolbar').evaluate(el => el.getBoundingClientRect().bottom)).toBe(93);
    await ui.locator('#address').fill(base); await expect(ui.locator('#address')).toHaveAttribute('aria-expanded', 'true'); await ui.locator('#address').press('Enter'); await loaded(app);
    await app.evaluate(({ app }) => { const original = app.dock.setIcon.bind(app.dock); globalThis.__dockCalls = []; app.dock.setIcon = image => { globalThis.__dockCalls.push(image.toPNG().toString('base64')); original(image); }; });
    const originalId = (await snapshot(app)).activeId;
    for (let i = 0; i < 9; i++) { await action(app, { type: 'navigate', input: `${base}/favorite-${i}` }); await loaded(app); await ui.locator('#favorite-add').click(); await expect.poll(async () => (await snapshot(app)).favorites.length).toBe(i + 1); }
    await action(app, { type: 'navigate', input: `${base}/tenth` }); await loaded(app); await expect(ui.locator('#favorite-add')).toBeDisabled();
    expect(await ui.evaluate(() => window.flots.act({ type: 'favorite-add' }))).toMatchObject({ ok: false });
    await expect(ui.locator('#horizontal-favorites .favorite')).toHaveCount(9);
    const favorites = (await snapshot(app)).favorites;
    await app.evaluate((_e, id) => globalThis.__flots.command('edit-favorite', id), favorites[0].id);
    await ui.locator('#favorite-name').fill('Documentation'); await ui.locator('#favorite-url').fill(`${base}/docs`); await ui.locator('#favorite-form button').click();
    await expect.poll(async () => (await snapshot(app)).favorites[0].name).toBe('Documentation');
    await ui.locator('#horizontal-favorites .favorite').first().dragTo(ui.locator('#horizontal-favorites .favorite').nth(2));
    await expect.poll(async () => (await snapshot(app)).favorites[2].id).toBe(favorites[0].id);
    await expect(ui.locator('#horizontal-favorites .favorite').nth(2)).toHaveAttribute('data-id', favorites[0].id);
    await ui.locator('#horizontal-favorites .favorite').nth(2).focus(); await ui.keyboard.press('Alt+ArrowLeft');
    await expect.poll(async () => (await snapshot(app)).favorites[1].id).toBe(favorites[0].id);
    await ui.locator('#horizontal-new').click(); await expect.poll(async () => (await snapshot(app)).tabs.length).toBe(2);
    await expect(ui.locator('#address')).toBeFocused();
    await ui.locator('#address').fill(`${base}/second`); await ui.locator('#address').press('Enter'); await loaded(app);
    const second = (await snapshot(app)).activeId;
    await ui.locator('#horizontal-tabs .tab-select').first().click(); await expect.poll(async () => (await snapshot(app)).activeId).toBe(originalId);
    await ui.locator('#horizontal-tabs .tab-select').first().focus();
    await app.evaluate(() => globalThis.__flots.changed()); await pause(200); await expect(ui.locator('#horizontal-tabs .tab-select').first()).toBeFocused();
    await ui.keyboard.press('ArrowRight'); await expect.poll(async () => (await snapshot(app)).activeId).toBe(second);
    await ui.locator('#horizontal-tabs .tab-select').nth(1).focus(); await ui.keyboard.press('Alt+ArrowLeft');
    await expect.poll(async () => (await snapshot(app)).tabs[0].id).toBe(second);
    await app.evaluate(async () => { const b = globalThis.__flots; await b.views.active().executeJavaScript('window.flotsV3Sentinel = 734'); });
    await ui.locator('#site-info').click(); await expect(ui.locator('.modal')).toContainText('Website information'); await ui.locator('.dismiss').click(); await expect(ui.locator('#modal-root')).toBeHidden();
    expect(await app.evaluate(() => globalThis.__flots.views.active().executeJavaScript('window.flotsV3Sentinel'))).toBe(734);
    await expect(ui.locator('#horizontal-new')).toBeVisible();
    const plusDistance = await ui.evaluate(() => { const tabs = [...document.querySelectorAll('#horizontal-tabs .tab')]; return document.querySelector('#horizontal-new').getBoundingClientRect().left - tabs.at(-1).getBoundingClientRect().right; }); expect(plusDistance).toBeLessThan(12);
    const wcId = await app.evaluate(() => globalThis.__flots.views.active().id);
    // Activation is fail-closed unless the material is a sibling behind the
    // entire Chromium content root, including after a real page is attached.
    await app.evaluate(() => globalThis.__flots.glass.update()); expect((await snapshot(app)).nativeGlass).toBe(true);
    await app.evaluate(() => globalThis.__flots.command('settings'));
    await ui.locator('[data-setting=layout]').selectOption('sidebar'); await ui.locator('[data-setting=theme]').selectOption('dark');
    await ui.locator('[data-accent=purple]').click(); await expect.poll(async () => (await snapshot(app)).settings.accent).toBe('purple');
    await expect.poll(() => app.evaluate(() => globalThis.__flots.dock.color)).toBe('#9f83c6');
    await ui.locator('#custom-accent').fill('#cc4455'); await ui.locator('#custom-accent-form button').click();
    await expect.poll(() => app.evaluate(() => globalThis.__flots.dock.color)).toBe('#cc4455');
    const calls = await app.evaluate(() => globalThis.__dockCalls.length); await action(app, { type: 'settings', patch: { accent: 'custom' } });
    expect(await app.evaluate(() => globalThis.__dockCalls.length)).toBe(calls);
    expect(await app.evaluate(() => new Set(globalThis.__dockCalls).size)).toBeGreaterThanOrEqual(2);
    await ui.locator('#accent-picker').fill('#557799'); await expect.poll(() => app.evaluate(() => globalThis.__flots.dock.color)).toBe('#557799');
    await mkdir('docs/screenshots/v3', { recursive: true }); await writeFile('docs/screenshots/v3/dock-accent.png', Buffer.from(await app.evaluate(() => globalThis.__dockCalls.at(-1)), 'base64'));
    await expect(ui.locator('.modal')).toHaveScreenshot('appearance-dark.png');
    await ui.locator('[data-panel=browsing]').click(); await ui.locator('[data-setting=showMemory]').uncheck(); await expect.poll(async () => (await snapshot(app)).settings.showMemory).toBe(false); await ui.locator('[data-setting=showMemory]').check();
    await ui.locator('.dismiss').click(); await expect(ui.locator('#modal-root')).toBeHidden();
    expect(await app.evaluate(() => globalThis.__flots.views.active().id)).toBe(wcId);
    expect(await app.evaluate(() => globalThis.__flots.views.active().executeJavaScript('window.flotsV3Sentinel'))).toBe(734);
    expect(await app.evaluate(() => globalThis.__flots.views.live.get(globalThis.__flots.state.activeId).getBounds().x)).toBe(250);
    await ui.locator('#sidebar-resize').focus(); await ui.keyboard.press('ArrowRight'); await expect.poll(async () => (await snapshot(app)).settings.sidebarWidth).toBe(260);
    await ui.locator('#side-collapse').click(); await expect(ui.locator('#sidebar')).toBeHidden();
    expect(await app.evaluate(() => globalThis.__flots.views.live.get(globalThis.__flots.state.activeId).getBounds().x)).toBe(0);
    await ui.locator('#sidebar-button').click(); await expect(ui.locator('#sidebar')).toBeVisible();
    for (const layout of ['horizontal', 'sidebar']) {
      await action(app, { type: 'settings', patch: { layout, sidebarWidth: 250 } });
      for (const width of [720, 980, 1420]) {
        await app.evaluate((_e, width) => globalThis.__flots.window.setSize(width, 866), width); await pause(150);
        const bounds = await app.evaluate(() => { const b = globalThis.__flots; return { native: b.views.live.get(b.state.activeId).getBounds(), size: b.window.getContentSize() }; });
        expect(bounds.native.y).toBe(layout === 'horizontal' ? 93 : 56); expect(bounds.native.width + bounds.native.x).toBe(bounds.size[0]);
        expect(await ui.locator('#address').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(65);
        expect(await ui.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      // Stable browser chrome snapshots; live website is a separate native WebContentsView.
      for (const theme of ['light', 'dark']) for (const accent of ['blue', 'rose']) {
        await action(app, { type: 'settings', patch: { theme, accent, showMemory: false } }); await pause(200); await ui.locator('#address').blur();
        if (layout === 'horizontal') await expect(ui).toHaveScreenshot(`${layout}-${theme}-${accent}.png`, { clip: { x: 0, y: 0, width: 1420, height: 93 }, mask: [ui.locator('#address')] });
        else { await expect(ui.locator('#sidebar')).toHaveScreenshot(`${layout}-${theme}-${accent}.png`); await expect(ui.locator('#toolbar')).toHaveScreenshot(`sidebar-toolbar-${theme}-${accent}.png`, { mask: [ui.locator('#address')] }); }
      }
    }
    await app.evaluate(() => globalThis.__flots.command('settings')); await ui.locator('[data-setting=theme]').selectOption('light'); await ui.locator('[data-accent=system]').click();
    await expect(ui.locator('.modal')).toHaveScreenshot('appearance-light.png'); await ui.locator('.dismiss').click(); await expect(ui.locator('#modal-root')).toBeHidden();
    await action(app, { type: 'settings', patch: { showMemory: true } }); await ui.locator('#memory').click();
    await expect(ui.locator('.memory-summary')).toContainText('MiB in use'); await expect(ui.locator('.memory-row')).not.toHaveCount(0); await expect(ui.locator('table')).toHaveCount(0);
    await expect(ui.locator('#memory-content')).toContainText('Reference /second'); await ui.locator('.modal').screenshot({ path: 'docs/screenshots/v3/memory.png' }); await expect(ui.locator('.modal')).toHaveScreenshot('memory-jauges.png', { mask: [ui.locator('.memory-summary'), ui.locator('.memory-distribution'), ui.locator('.memory-row')] }); await ui.locator('.dismiss').click(); await expect(ui.locator('#modal-root')).toBeHidden();
    await app.evaluate((_e, data) => { const b = globalThis.__flots; b.profileSession.once('will-download', (_event, item) => item.setSavePath(data.file)); b.views.active().downloadURL(data.url); }, { file: path.join(dir, 'progress-test.bin'), url: `${base}/slow-download` });
    await expect(ui.locator('#download-badge')).toHaveText('1'); await expect(ui.locator('#download-progress')).toBeVisible(); await ui.locator('#downloads-button').click(); await expect(ui.locator('#download-list')).toContainText('Downloading'); await ui.locator('.modal').screenshot({ path: 'docs/screenshots/v3/download-progress.png' });
    await expect.poll(async () => (await snapshot(app)).downloads[0]?.state).toBe('completed'); await expect(ui.locator('#download-list')).toContainText('Downloaded'); await ui.locator('.dismiss').click(); await expect(ui.locator('#modal-root')).toBeHidden();
    await ui.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' });
    expect(await ui.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const ax = await ui.locator('#toolbar').ariaSnapshot(); expect(ax).toContain('Address or Google search'); expect(ax).toContain('Downloads');
    await app.evaluate(() => globalThis.__flots.window.setFullScreen(true)); await expect.poll(() => app.evaluate(() => globalThis.__flots.window.isFullScreen())).toBe(true);
    await pause(1000); await app.evaluate(() => globalThis.__flots.window.setFullScreen(false)); await expect.poll(() => app.evaluate(() => globalThis.__flots.window.isFullScreen())).toBe(false); await pause(1000);
    expect((await snapshot(app)).nativeGlass).toBe(true);
    await action(app, { type: 'settings', patch: { layout: 'horizontal', accent: 'sage', theme: 'dark' } });
    await action(app, { type: 'close', id: originalId }); await action(app, { type: 'restore' }); await loaded(app);
    await action(app, { type: 'favorite-remove', id: favorites[8].id }); expect((await snapshot(app)).favorites.length).toBe(8);
    await app.evaluate(() => globalThis.__flots.views.active().forcefullyCrashRenderer()); await expect.poll(async () => { const s = await snapshot(app); return s.tabs.find(t => t.id === s.activeId)?.lifecycle; }).toBe('crashed');
    await action(app, { type: 'reload' }); await loaded(app);
    await action(app, { type: 'navigate', input: `https://127.0.0.1:${tls.address().port}/` });
    await expect.poll(async () => { const s = await snapshot(app); return s.tabs.find(t => t.id === s.activeId)?.error; }).toContain('ERR_CERT_');
    await action(app, { type: 'navigate', input: base }); await loaded(app);
    expect(errors).toEqual([]);
    const before = await snapshot(app); await finish(app); app = undefined;
    run = await launch(dir); app = run.application; ui = run.ui; await loaded(app);
    const after = await snapshot(app); expect(after.settings).toEqual(before.settings); expect(after.favorites.map(f => [f.id, f.name, f.homeUrl])).toEqual(before.favorites.map(f => [f.id, f.name, f.homeUrl]));
    expect(await app.evaluate(() => globalThis.__flots.dock.color)).toBe('#7fa58f'); expect(await app.evaluate(() => globalThis.__flots.views.live.size)).toBe(1);
    await mkdir('docs/screenshots/v3', { recursive: true });
    await writeFile('docs/v3-observations.json', JSON.stringify({ date: new Date().toISOString(), settings: after.settings, versions: after.versions, memoryAfterRestart: after.memory, consoleErrors: errors, ariaSnapshot: ax, note: 'Playwright screenshots capture UI renderer, not native titlebar buttons or remote WebContentsView. Native checks performed separately.' }, null, 2));
  } finally { if (app) await finish(app).catch(() => app.process().kill()); server.close(); tls.close(); }
});
