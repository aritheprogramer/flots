import { dialog, shell, type BrowserWindow, type DownloadItem, type Session } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Download, Profile } from '../shared/model';
export function downloadState(state: string): Download['state'] { return state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : state === 'progressing' ? 'progressing' : 'interrupted'; }
export class Downloads {
  private items = new Map<string, DownloadItem>();
  constructor(session: Session, private win: BrowserWindow, private state: Profile, owner: (wc: number) => string, private changed: () => void) {
    session.on('will-download', (_event, item, contents) => {
      const filename = path.basename(item.getFilename()).replace(/[\x00-\x1f]/g, '_') || 'download';
      // Chromium's native Save dialog resolves collisions and requires an explicit destination.
      item.setSaveDialogOptions({ title: 'Save download', defaultPath: path.join(state.settings.downloadPath, filename) });
      const d: Download = { id: randomUUID(), filename, path: '', received: 0, total: item.getTotalBytes(), state: 'progressing', owner: owner(contents.id) };
      state.downloads.unshift(d); state.downloads = state.downloads.filter((d, i) => i < 100 || d.state === 'progressing' || this.items.has(d.id)); this.items.set(d.id, item); this.changed();
      item.on('updated', (_e, status) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.path = item.getSavePath(); d.state = downloadState(status); this.changed(); });
      item.once('done', (_e, status) => { d.path = item.getSavePath(); d.received = item.getReceivedBytes(); d.state = downloadState(status); this.items.delete(d.id); item.removeAllListeners('updated'); this.changed(); });
    });
  }
  active(owner?: string) { return [...this.items.keys()].some(id => !owner || this.state.downloads.find(d => d.id === id)?.owner === owner); }
  async action(id: string, operation: 'cancel' | 'open' | 'show') {
    const d = this.state.downloads.find(d => d.id === id); if (!d) throw new Error('Unknown download');
    if (operation === 'cancel') { this.items.get(id)?.cancel(); return; }
    if (!d.path || d.state !== 'completed') throw new Error('Download is not complete');
    if (operation === 'show') { shell.showItemInFolder(d.path); return; }
    const result = await dialog.showMessageBox(this.win, { type: 'question', message: `Open “${d.filename}”?`, detail: 'Downloaded files may run applications or contain active content. Open only files you trust.', buttons: ['Cancel', 'Open'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) { const error = await shell.openPath(d.path); if (error) throw new Error(error); }
  }
}
