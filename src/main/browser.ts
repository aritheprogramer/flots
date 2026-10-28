import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, session, systemPreferences } from 'electron';
import path from 'node:path';
import { accents } from '../shared/appearance';
import { NativeGlass } from './glass';
import { DockIcon } from './dock';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import type { Action, Profile, Snapshot } from '../shared/model';
import { navigateInput, hostname, webURL } from '../shared/navigation';
import { validateAction } from '../shared/validation';
import { Tabs } from './tabs';
import { Views } from './views';
import { ProfileStore } from './persistence';
import { Blocker } from './blocker';
import { Downloads } from './downloads';
import { measureMemory } from './memory';
import { configurePermissions, trustedSender } from './security';
import { configureWebAuthnAccounts } from './webauthn';
export class Browser {
  readonly window: BrowserWindow;
  readonly ready: Promise<void>;
  readonly tabs: Tabs;
  readonly views: Views;
  readonly store: ProfileStore;
  readonly downloads: Downloads;
  readonly blocker: Blocker;
  readonly glass: NativeGlass;
  readonly dock = new DockIcon();
  private memory = measureMemory();
  private publishTimer?: NodeJS.Timeout;
  private timers: NodeJS.Timeout[] = [];
  private closing = false;
  private sweeping = false;
  private uiURL: string;
  readonly profileSession = session.fromPartition('persist:flots');
  constructor(readonly state: Profile) {
    if (!state.settings.downloadPath) state.settings.downloadPath = app.getPath('downloads');
    this.tabs = new Tabs(state);
    this.store = new ProfileStore(path.join(app.getPath('userData'), 'session.json'), () => this.state);
    nativeTheme.themeSource = state.settings.theme;
    this.window = new BrowserWindow({ width: 1240, height: 820, minWidth: 720, minHeight: 480, title: 'flots', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 17, y: 16 }, vibrancy: 'sidebar', visualEffectState: 'followWindow', backgroundColor: '#00000000', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true, spellcheck: false } });
    this.glass = new NativeGlass(this.window, () => this.state.settings);
    this.views = new Views(this.window, this.tabs, this.profileSession, () => this.changed(), (url, background) => { const t = this.tabs.add(url, true); if (!background) this.views.activate(t.id); this.changed(); }, id => this.downloads?.active(id) ?? false);
    this.downloads = new Downloads(this.profileSession, this.window, state, wc => this.views.owner(wc), () => this.changed());
    this.blocker = new Blocker(readFileSync(path.join(app.getAppPath(), 'assets/network-filters.txt'), 'utf8'), this.profileSession, () => state.settings, id => this.tabs.get(this.views.owner(id))?.url ?? '');
    configurePermissions(this.profileSession, this.window, () => this.views.active(), id => { const t = this.tabs.get(this.views.owner(id)); if (t) { t.protected = true; this.changed(); } });
    const disposeWebAuthn = configureWebAuthnAccounts(this.profileSession, this.window, () => this.views.active());
    const ui = this.window.webContents;
    ui.session.setPermissionRequestHandler((_w, _p, callback) => callback(false));
    ui.session.setPermissionCheckHandler(() => false);
    ui.on('will-navigate', e => e.preventDefault()); ui.on('will-attach-webview', e => e.preventDefault()); ui.setWindowOpenHandler(() => ({ action: 'deny' }));
    const filename = path.join(__dirname, '../renderer/index.html'); this.uiURL = pathToFileURL(filename).href;
    ipcMain.removeHandler('flots:state'); ipcMain.removeHandler('flots:action');
    ipcMain.handle('flots:state', e => { if (!trustedSender(e, ui, this.uiURL)) throw new Error('Untrusted sender'); return this.snapshot(); });
    ipcMain.handle('flots:action', async (e, raw) => {
      if (!trustedSender(e, ui, this.uiURL)) throw new Error('Untrusted sender');
      try { await this.action(validateAction(raw)); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Action failed' }; }
    });
    this.menu();
    this.window.on('resize', () => { this.views.layout(); this.glass.update(); }); this.window.on('enter-full-screen', () => { this.views.layout(); this.glass.update(); }); this.window.on('leave-full-screen', () => { this.views.layout(); this.glass.update(); });
    const appearance = () => { this.appearance(); this.publish(); }; nativeTheme.on('updated', appearance);
    const colorSubscription = process.platform === 'darwin' ? systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification', appearance) : undefined;
    this.window.on('focus', appearance); this.appearance();
    this.window.on('close', e => {
      if (this.closing) return; e.preventDefault();
      if (this.downloads.active() || this.tabs.all().some(t => t.dirty || t.protected)) {
        const response = dialog.showMessageBoxSync(this.window, { message: 'Close flots?', detail: 'Active downloads will stop. Unsaved page data and capture sessions will be lost.', buttons: ['Keep Open', 'Close'], defaultId: 0, cancelId: 0 }); if (response !== 1) return;
      }
      this.closing = true;
      this.profileSession.flushStorageData();
      // DOMStorage flushing does not flush the cookie database. Wait for both
      // stores before destroying the views, including immediately after login.
      void Promise.all([this.store.flush(), this.profileSession.cookies.flushStore()]).then(() => { this.views.disposeAll(); this.glass.dispose(); this.window.destroy(); }).catch(() => { this.closing = false; dialog.showErrorBox('Session could not be saved', 'Flots stayed open because your data could not be saved. Check available disk space, then try quitting again.'); });
    });
    this.window.on('closed', () => { disposeWebAuthn(); clearTimeout(this.publishTimer); this.timers.forEach(clearInterval); nativeTheme.removeListener('updated', appearance); if (colorSubscription !== undefined) systemPreferences.unsubscribeNotification(colorSubscription); this.profileSession.webRequest.onBeforeRequest(null); this.profileSession.removeAllListeners('will-download'); ipcMain.removeHandler('flots:state'); ipcMain.removeHandler('flots:action'); });
    this.timers.push(setInterval(() => { if (this.window.isVisible() && !this.window.isMinimized() && this.state.settings.showMemory) { this.memory = measureMemory(); this.publish(); } }, 15000));
    this.timers.push(setInterval(async () => {
      if (this.sweeping) return; this.sweeping = true;
      try { for (const t of this.state.favorites) await this.views.discard(t.id, true); } finally { this.sweeping = false; }
    }, 30000));
    this.ready = this.window.loadFile(filename).then(() => {
      if (!this.tabs.get()) this.tabs.add();
      this.views.activate(state.activeId); this.window.show(); this.publish();
    });
  }
  snapshot(): Snapshot { return { ...this.state, memory: { ...this.memory, processes: this.memory.processes.map(p => ({ ...p, label: this.memoryLabel(p.pid, p.type) })) }, versions: { app: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome }, dark: nativeTheme.shouldUseDarkColors, accentColor: this.accentColor(), nativeGlass: this.glass.active, highContrast: nativeTheme.shouldUseHighContrastColors, reducedTransparency: nativeTheme.prefersReducedTransparency, blocked: this.blocker?.count ?? 0 }; }
  private memoryLabel(pid: number, type: string) { if (pid === this.window.webContents.getOSProcessId()) return 'Browser interface'; const titles = [...this.views.live].filter(([, v]) => !v.webContents.isDestroyed() && v.webContents.getOSProcessId() === pid).map(([id]) => this.tabs.get(id)?.title || 'Loading page…'); return titles.length ? [...new Set(titles)].join(' · ') : type === 'Browser' ? 'Flots' : type === 'GPU' ? 'Graphics' : type === 'Utility' ? 'Network & services' : type === 'Renderer' ? 'Page process' : type; }
  private accentColor() { const s = this.state.settings; return s.accent === 'custom' ? s.customAccent : s.accent === 'system' ? '#' + systemPreferences.getAccentColor().slice(0, 6) : accents[s.accent]; }
  private appearance() { this.dock.update(this.accentColor()); this.window.setVibrancy(null); this.glass.update(); }
  private publish() { clearTimeout(this.publishTimer); this.publishTimer = undefined; if (!this.window.isDestroyed()) this.window.webContents.send('flots:update', this.snapshot()); }
  changed() { if (!this.window.isDestroyed()) this.window.setTitle(this.tabs.get()?.title || 'New tab'); this.store.schedule(); if (!this.publishTimer) this.publishTimer = setTimeout(() => { this.publishTimer = undefined; this.publish(); }, 16); }
  command(command: string, id?: string) { if (command === 'address') this.publish(); this.window.webContents.focus(); this.window.webContents.send('flots:command', command, id); }
  private async close(id: string, favorite = false) {
    const t = this.tabs.get(id); if (!t) return;
    if (this.downloads.active(id)) throw new Error('Wait for this page’s download to finish, or cancel it in Downloads.');
    if (t.dirty || t.protected) {
      const response = await dialog.showMessageBox(this.window, { message: 'Close this page?', detail: 'Unsaved changes or an active capture session may be lost.', buttons: ['Keep Open', 'Close'], defaultId: 0, cancelId: 0 }); if (response.response !== 1) return;
    }
    this.views.dispose(id); if (favorite) this.tabs.removeFavorite(id); else this.tabs.close(id);
    if (!this.tabs.get()) this.tabs.add(); this.views.activate(this.state.activeId);
  }
  async action(a: Action) {
    const wc = this.views.active();
    switch (a.type) {
      case 'new': { const url = a.url ? navigateInput(a.url) : ''; const t = this.tabs.add(url, true); if (!a.background) { this.views.activate(t.id); if (!url) this.command('address'); } break; }
      case 'navigate': { const url = navigateInput(a.input); if (!url) break; let t = this.tabs.get(); if (!t) t = this.tabs.add(); t.error = undefined; if (wc && t.lifecycle !== 'crashed') void wc.loadURL(url).catch(() => {}); else { t.url = url; this.views.dispose(t.id); this.views.ensure(t, false); } this.views.layout(); break; }
      case 'activate': this.views.activate(a.id, false); break;
      case 'close': await this.close(a.id); break;
      case 'favorite-remove': await this.close(a.id, true); break;
      case 'discard': if (!(await this.views.discard(a.id))) throw new Error('This page is active, busy, has possible unsaved input, or is already sleeping.'); break;
      case 'back': if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
      case 'forward': if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
      case 'reload': { const t = this.tabs.get(); if (t?.lifecycle === 'crashed') { this.views.dispose(t.id); this.views.ensure(t, false); this.views.layout(); } else wc?.reload(); break; }
      case 'stop': wc?.stop(); break;
      case 'restore': { const t = this.tabs.restore(); if (t) this.views.activate(t.id); break; }
      case 'favorite-add': this.tabs.addFavorite(); break;
      case 'favorite-edit': { const t = this.state.favorites.find(t => t.id === a.id); const url = webURL(a.url); if (!t || !url) throw new Error('Enter an HTTP or HTTPS URL.'); if (this.state.favorites.some(x => x.id !== t.id && (x.homeUrl ?? x.url) === url)) throw new Error('That favorite already exists.'); if (url === (t.homeUrl ?? t.url)) { t.name = a.title.trim() || hostname(url); break; } if (this.views.live.has(t.id) && (t.dirty || t.protected || this.downloads.active(t.id))) throw new Error('This favorite has unsaved input or ongoing activity.'); this.views.dispose(t.id); t.url = url; t.homeUrl = url; t.title = a.title.trim() || hostname(url); t.name = t.title; t.lifecycle = 'unloaded'; t.favicon = undefined; if (t.id === this.state.activeId) this.views.activate(t.id); break; }
      case 'reorder': this.tabs.reorder(a.kind, a.ids); break;
      case 'settings': Object.assign(this.state.settings, a.patch); nativeTheme.themeSource = this.state.settings.theme; this.appearance(); this.views.layout(); break;
      case 'toggle-sidebar': if (this.state.settings.layout === 'sidebar') this.state.settings.sidebarVisible = !this.state.settings.sidebarVisible; else { this.state.settings.layout = 'sidebar'; this.state.settings.sidebarVisible = true; } this.appearance(); this.views.layout(); break;
      case 'site-blocker': { const host = hostname(this.tabs.get()?.url ?? ''); if (!host) break; const list = this.state.settings.siteExceptions; this.state.settings.siteExceptions = list.includes(host) ? list.filter(h => h !== host) : [...list, host]; wc?.reload(); break; }
      case 'choose-downloads': { const result = await dialog.showOpenDialog(this.window, { properties: ['openDirectory', 'createDirectory'], defaultPath: this.state.settings.downloadPath }); if (!result.canceled) this.state.settings.downloadPath = result.filePaths[0]; break; }
      case 'clear-history': this.state.history = []; break;
      case 'overlay': this.views.overlay = a.open; this.views.layout(); break;
      case 'find': if (a.text) wc?.findInPage(a.text, { forward: a.forward, findNext: true }); else wc?.stopFindInPage('clearSelection'); break;
      case 'find-stop': wc?.stopFindInPage('clearSelection'); break;
      case 'download': await this.downloads.action(a.id, a.operation); break;
      case 'memory-refresh': this.memory = measureMemory(); break;
      case 'print': if (wc) wc.print({}); break;
      case 'save-page': {
        if (!wc || !webURL(wc.getURL())) break;
        const page = wc; const url = wc.getURL();
        const selected = await dialog.showSaveDialog(this.window, { title: 'Save Webpage', defaultPath: 'Saved page.html', filters: [{ name: 'Webpage', extensions: ['html'] }] });
        if (!selected.canceled && selected.filePath && !page.isDestroyed() && page.getURL() === url) await page.savePage(selected.filePath, 'HTMLComplete');
        break;
      }
      case 'default-browser': {
        if (!app.isPackaged) throw new Error('Install the packaged Flots application before choosing it as your default browser.');
        const http = app.setAsDefaultProtocolClient('http');
        const https = app.setAsDefaultProtocolClient('https');
        if (!http || !https) throw new Error('Choose Flots in macOS System Settings → Desktop & Dock → Default web browser.');
        break;
      }
      case 'focus-page': this.views.active()?.focus(); break;
      case 'tab-menu': Menu.buildFromTemplate(this.state.tabs.map(t => ({ label: t.title.slice(0, 80), type: 'checkbox' as const, checked: t.id === this.state.activeId, click: () => this.views.activate(t.id) }))).popup({ window: this.window }); break;
      case 'browser-menu': Menu.buildFromTemplate(['settings', 'history', 'downloads'].map(name => ({ label: name[0].toUpperCase() + name.slice(1), click: () => this.command(name) })).concat([{ label: 'Site Information', click: () => this.command('site') }])).popup({ window: this.window }); break;
      case 'context': this.context(a.id); break;
    }
    // Transient UI actions must not serialize browser history to disk.
    if (!['overlay', 'find', 'find-stop', 'focus-page', 'memory-refresh', 'context', 'tab-menu', 'browser-menu', 'default-browser', 'print', 'save-page'].includes(a.type)) this.changed();
    this.publish();
  }
  private context(id: string) {
    const t = this.tabs.get(id); if (!t) return;
    const run = (a: Action) => { void this.action(a).catch(e => this.command(`error:${e.message}`)); };
    const items: Electron.MenuItemConstructorOptions[] = [{ label: 'Open', click: () => run({ type: 'activate', id }) }, { label: 'Discard Page', enabled: id !== this.state.activeId && t.lifecycle === 'loaded', click: () => run({ type: 'discard', id }) }];
    const list = t.kind === 'favorite' ? this.state.favorites : this.state.tabs; const index = list.indexOf(t);
    for (const [label, delta] of [['Move Earlier', -1], ['Move Later', 1]] as const) items.push({ label, enabled: index + delta >= 0 && index + delta < list.length, click: () => { const ids = list.map(x => x.id); [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]; run({ type: 'reorder', kind: t.kind, ids }); } });
    if (t.kind === 'favorite') items.push({ label: 'Edit Favorite…', click: () => this.command('edit-favorite', id) }, { label: 'Remove Favorite', click: () => run({ type: 'favorite-remove', id }) });
    else items.push({ label: 'Close Tab', click: () => run({ type: 'close', id }) });
    Menu.buildFromTemplate(items).popup({ window: this.window });
  }
  private cycle(delta: number) { const list = this.tabs.all(); const i = list.findIndex(t => t.id === this.state.activeId); if (list.length) this.views.activate(list[(i + delta + list.length) % list.length].id); }
  private menu() {
    const act = (a: Action) => () => { void this.action(a).catch(e => this.command(`error:${e.message}`)); };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'flots', submenu: [{ label: 'About flots', click: () => this.command('about') }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => this.command('settings') }, { type: 'separator' }, { role: 'services' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
      { label: 'File', submenu: [{ label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: act({ type: 'new' }) }, { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => { if (this.tabs.get()?.kind === 'favorite') this.command('error:Favorites remain available. Right-click to remove one.'); else act({ type: 'close', id: this.state.activeId })(); } }, { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: act({ type: 'restore' }) }, { label: 'Save to Favorites', accelerator: 'CmdOrCtrl+D', click: act({ type: 'favorite-add' }) }, { label: 'Save Page As…', accelerator: 'CmdOrCtrl+S', click: act({ type: 'save-page' }) }, { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: act({ type: 'print' }) }, { label: 'Downloads', accelerator: 'CmdOrCtrl+Shift+J', click: () => this.command('downloads') }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' }, { label: 'Find in Page', accelerator: 'CmdOrCtrl+F', click: () => this.command('find') }] },
      { label: 'View', submenu: [{ label: 'Focus Address Bar', accelerator: 'CmdOrCtrl+L', click: () => this.command('address') }, { label: 'Search or Go…', accelerator: 'CmdOrCtrl+K', click: () => this.command('command') }, { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: act({ type: 'reload' }) }, { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+Shift+B', click: act({ type: 'toggle-sidebar' }) }, { type: 'separator' }, { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => this.views.active()?.setZoomLevel(0) }, { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => { const w = this.views.active(); if (w) w.setZoomLevel(Math.min(5, w.getZoomLevel() + .5)); } }, { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => { const w = this.views.active(); if (w) w.setZoomLevel(Math.max(-3, w.getZoomLevel() - .5)); } }, { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => this.cycle(1) }, { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => this.cycle(-1) }, { role: 'togglefullscreen' }] },
      { label: 'History', submenu: [{ label: 'Back', accelerator: 'CmdOrCtrl+[', click: act({ type: 'back' }) }, { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: act({ type: 'forward' }) }, { label: 'Show History', accelerator: 'CmdOrCtrl+Y', click: () => this.command('history') }] },
      { label: 'Favorites', submenu: Array.from({ length: 9 }, (_, i) => ({ label: `Favorite ${i + 1}`, accelerator: `CmdOrCtrl+${i + 1}`, click: () => { const t = this.state.favorites[i]; if (t) this.views.activate(t.id); } })) },
      { role: 'windowMenu' }
    ]));
  }
}
