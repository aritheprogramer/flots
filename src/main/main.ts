import { app } from 'electron';
import path from 'node:path';
import { Browser } from './browser';
import { ProfileStore } from './persistence';
import { externalWebURL } from './external-links';
app.setName('flots');
if (process.env.FLOTS_PROFILE && (!app.isPackaged || process.env.FLOTS_PACKAGED_SMOKE === '1')) app.setPath('userData', path.resolve(process.env.FLOTS_PROFILE));
app.enableSandbox();
let browser: Browser | undefined;
let quitting = false;
let creating: Promise<Browser> | undefined;
const pendingLinks: string[] = [];
let openPending: (() => Promise<void>) | undefined;
app.on('open-url', (event, input) => {
  event.preventDefault(); const url = externalWebURL(input);
  if (!url || pendingLinks.length >= 100) return;
  pendingLinks.push(url);
  if (app.isReady()) void openPending?.();
});
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', () => { browser?.window.show(); browser?.window.focus(); });
  const create = (): Promise<Browser> => {
    if (creating) return creating;
    if (browser && !browser.window.isDestroyed()) return Promise.resolve(browser);
    creating = (async () => {
      browser = new Browser(await ProfileStore.load(path.join(app.getPath('userData'), 'session.json')));
      if (process.env.FLOTS_TEST === '1' && !app.isPackaged) (globalThis as any).__flots = browser;
      await browser.ready;
      return browser;
    })().finally(() => { creating = undefined; });
    return creating;
  };
  openPending = async () => {
    const target = await create();
    const openingLink = pendingLinks.length > 0;
    while (pendingLinks.length) {
      const url = pendingLinks.shift()!;
      const placeholder = target.state.tabs.length === 1 && !target.state.tabs[0].url ? target.state.tabs[0].id : undefined;
      await target.action({ type: 'new', url });
      if (placeholder) await target.action({ type: 'close', id: placeholder });
    }
    if (openingLink) target.command('dismiss-overlays');
    target.window.show(); target.window.focus();
  };
  void app.whenReady().then(openPending);
  app.on('activate', () => { void openPending?.(); });
  app.on('before-quit', e => { if (!quitting && browser && !browser.window.isDestroyed()) { e.preventDefault(); browser.window.once('closed', () => { quitting = true; app.quit(); }); browser.window.close(); } });
  app.on('window-all-closed', () => { if (process.env.FLOTS_TEST === '1') app.quit(); });
}
