import { app, nativeTheme, type BrowserWindow } from 'electron';
import path from 'node:path';
import type { Settings } from '../shared/model';
type Bridge = { update(handle: Buffer, top: number, left: number, enabled: boolean): boolean };
export class NativeGlass {
  private bridge?: Bridge;
  active = false;
  constructor(private window: BrowserWindow, private settings: () => Settings) {
    if (process.platform === 'darwin') {
      try { this.bridge = require(path.join(app.getAppPath(), 'dist/native/glass.node')) as Bridge; }
      catch (error) { console.warn('Native glass unavailable; using opaque chrome:', String(error)); }
    }
  }
  update() {
    if (!this.bridge || this.window.isDestroyed()) return;
    const s = this.settings();
    this.active = this.bridge.update(this.window.getNativeWindowHandle(), s.layout === 'horizontal' ? 93 : 56, s.layout === 'sidebar' && s.sidebarVisible ? s.sidebarWidth : 0, !nativeTheme.prefersReducedTransparency && !nativeTheme.shouldUseHighContrastColors);
  }
  dispose() { if (this.bridge && !this.window.isDestroyed()) this.bridge.update(this.window.getNativeWindowHandle(), 0, 0, false); this.active = false; }
}
