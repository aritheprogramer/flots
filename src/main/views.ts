import { WebContentsView, Menu, clipboard, dialog, shell, type BrowserWindow, type Session } from 'electron';
import type { Destination } from '../shared/model';
import { faviconURL, webURL, hostname } from '../shared/navigation';
import { Tabs, mayDiscard } from './tabs';
export class Views {
  readonly live = new Map<string, WebContentsView>();
  private attached?: WebContentsView;
  overlay = false;
  webFullscreen = false;
  constructor(private win: BrowserWindow, readonly tabs: Tabs, private session: Session, private changed: () => void, private newTab: (url: string, background: boolean) => void, private downloading: (id: string) => boolean) {}
  active() { return this.live.get(this.tabs.state.activeId)?.webContents; }
  owner(wc: number) { return [...this.live].find(([, v]) => v.webContents.id === wc)?.[0] ?? ''; }
  async external(url: string) {
    let u: URL; try { u = new URL(url); } catch { return; }
    if (!['mailto:', 'tel:'].includes(u.protocol) || url.length > 4096 || /[\r\n\x00]/.test(url)) return;
    const result = await dialog.showMessageBox(this.win, { message: 'Open an external application?', detail: url, buttons: ['Cancel', 'Open'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) await shell.openExternal(url);
  }
  ensure(t: Destination, restoreFavorite = true) {
    if (!t.url || this.live.has(t.id)) return this.live.get(t.id);
    if (restoreFavorite && t.kind === 'favorite' && t.homeUrl) t.url = t.homeUrl;
    const view = new WebContentsView({ webPreferences: { session: this.session, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, navigateOnDragDrop: false, spellcheck: true, backgroundThrottling: true } });
    this.live.set(t.id, view); const wc = view.webContents;
    // UI identity is never exposed to a website, including its iframes and popups.
    wc.setWindowOpenHandler(details => { if (webURL(details.url)) this.newTab(details.url, details.disposition === 'background-tab'); else void this.external(details.url); return { action: 'deny' }; });
    const navigation = (event: Electron.Event, url: string) => { if (!webURL(url)) { event.preventDefault(); void this.external(url); } };
    wc.on('will-navigate', navigation); wc.on('will-redirect', navigation);
    wc.on('will-frame-navigate', event => { if (!webURL(event.url) && !['about:blank', 'about:srcdoc'].includes(event.url)) event.preventDefault(); });
    wc.on('will-attach-webview', event => event.preventDefault());
    wc.on('did-start-loading', () => { t.lifecycle = 'loading'; t.error = undefined; this.changed(); });
    const history = () => { t.canGoBack = wc.navigationHistory.canGoBack(); t.canGoForward = wc.navigationHistory.canGoForward(); };
    wc.on('did-stop-loading', () => { t.lifecycle = 'loaded'; history(); this.changed(); });
    wc.on('did-navigate', (_e, url) => { t.url = url; t.dirty = false; history(); this.visit(t); this.changed(); });
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) { t.url = url; history(); this.changed(); } });
    wc.on('page-title-updated', (_e, title) => { t.title = title.slice(0, 200); this.visit(t); this.changed(); });
    wc.on('page-favicon-updated', (_e, icons) => { if (t.kind === 'tab' || hostname(t.url) === hostname(t.homeUrl ?? t.url)) t.favicon = faviconURL(icons[0]); this.changed(); });
    wc.on('audio-state-changed', event => { t.audible = event.audible; this.changed(); });
    wc.on('before-input-event', (_e, input) => { if (input.type === 'keyDown' && !input.meta && !input.control && !['Escape', 'Tab', 'Shift', 'Alt', 'Control', 'Meta', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(input.key)) t.dirty = true; });
    wc.on('will-prevent-unload', async event => {
      // Electron closes only if this event is prevented. Keep the page by default.
      const result = dialog.showMessageBoxSync(this.win, { message: 'Leave this page?', detail: 'Changes you made may not be saved.', buttons: ['Stay', 'Leave'], defaultId: 0, cancelId: 0 });
      if (result === 1) event.preventDefault();
    });
    wc.on('did-fail-load', (_e, code, description, _url, mainFrame) => { if (mainFrame && code !== -3) { if (webURL(_url)) t.url = _url; t.error = `${description} (${code})`; t.lifecycle = 'loaded'; this.changed(); } });
    wc.on('render-process-gone', (_e, details) => { t.lifecycle = 'crashed'; t.error = `The page process stopped (${details.reason}). Reload to recover.`; this.changed(); });
    wc.on('enter-html-full-screen', () => { this.webFullscreen = true; this.layout(); });
    wc.on('leave-html-full-screen', () => { this.webFullscreen = false; this.layout(); });
    wc.on('context-menu', (_e, p) => {
      const items: Electron.MenuItemConstructorOptions[] = [];
      if (webURL(p.linkURL)) items.push({ label: 'Open Link in New Tab', click: () => this.newTab(p.linkURL, true) }, { label: 'Copy Link Address', click: () => clipboard.writeText(p.linkURL) }, { label: 'Download Linked File', click: () => wc.downloadURL(p.linkURL) }, { type: 'separator' });
      if (p.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { label: 'Paste', click: () => { t.dirty = true; wc.paste(); } }, { role: 'selectAll' });
      else if (p.selectionText) items.push({ role: 'copy' });
      items.push({ label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'Reload', click: () => wc.reload() });
      Menu.buildFromTemplate(items).popup({ window: this.win });
    });
    t.lifecycle = 'loading'; void wc.loadURL(t.url).catch(() => {}); return view;
  }
  private visit(t: Destination) {
    if (!webURL(t.url)) return;
    const history = this.tabs.state.history;
    this.tabs.state.history = [{ url: t.url, title: t.title, at: Date.now() }, ...history.filter(v => v.url !== t.url)].slice(0, 500);
  }
  activate(id: string, focus = true) {
    const old = this.tabs.get(); if (old) old.lastActive = Date.now();
    const t = this.tabs.activate(id); this.ensure(t); this.layout(); if (!this.overlay && focus) this.active()?.focus(); this.changed();
  }
  layout() {
    if (this.win.isDestroyed()) return;
    const view = this.live.get(this.tabs.state.activeId);
    if (this.attached && (this.attached !== view || this.overlay)) { this.win.contentView.removeChildView(this.attached); this.attached = undefined; }
    if (!view || this.overlay) return;
    if (view !== this.attached) { this.win.contentView.addChildView(view); this.attached = view; }
    const [width, height] = this.win.getContentSize(); const settings = this.tabs.state.settings;
    const left = !this.webFullscreen && settings.layout === 'sidebar' && settings.sidebarVisible ? settings.sidebarWidth : 0;
    const top = this.webFullscreen ? 0 : settings.layout === 'horizontal' ? 93 : 56;
    view.setBounds({ x: left, y: top, width: Math.max(1, width - left), height: Math.max(1, height - top) });
  }
  async discard(id: string, automatic = false) {
    const t = this.tabs.get(id); const view = this.live.get(id); if (!t || !view) return false;
    if (!mayDiscard(t, this.tabs.state.activeId, this.downloading(id), automatic, this.tabs.state.settings.discardMinutes)) return false;
    if (automatic) {
      // Fail closed: any form/editor or unreadable frame protects the whole destination.
      try {
        const unsafe = await Promise.all(view.webContents.mainFrame.framesInSubtree.map(f => f.executeJavaScript("Boolean(document.querySelector('input,textarea,select,[contenteditable],form'))")));
        if (unsafe.some(Boolean)) return false;
      } catch { return false; }
      if (this.live.get(id) !== view || !mayDiscard(t, this.tabs.state.activeId, this.downloading(id), true, this.tabs.state.settings.discardMinutes)) return false;
    }
    this.dispose(id); t.lifecycle = 'discarded'; t.canGoBack = false; t.canGoForward = false; this.changed(); return true;
  }
  dispose(id: string) {
    const view = this.live.get(id); if (!view) return;
    if (this.attached === view) { this.win.contentView.removeChildView(view); this.attached = undefined; }
    this.live.delete(id);
    const wc = view.webContents;
    if (!wc.isDestroyed()) { wc.removeAllListeners(); wc.close({ waitForBeforeUnload: false }); }
  }
  disposeAll() { for (const id of [...this.live.keys()]) this.dispose(id); }
}
