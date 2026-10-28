import { promises as fs } from 'node:fs';
import path from 'node:path';
import { emptyProfile, type Profile, type Destination } from '../shared/model';
import { validSettings } from '../shared/validation';
import { destination } from './tabs';
import { faviconURL, webURL } from '../shared/navigation';
export function restoreProfile(raw: unknown): Profile {
  const p = emptyProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Partial<Profile>; p.settings = validSettings(r.settings);
  const seen = new Set<string>();
  const clean = (items: unknown, kind: Destination['kind']): Destination[] => !Array.isArray(items) ? [] : items.flatMap(t => {
    if (!t || typeof t !== 'object' || typeof t.url !== 'string' || (t.url && !webURL(t.url))) return [];
    const d = destination(t.url, kind);
    if (typeof t.id === 'string' && /^[\w-]{1,100}$/.test(t.id) && !seen.has(t.id)) d.id = t.id;
    if (kind === 'favorite') { d.homeUrl = typeof t.homeUrl === 'string' && webURL(t.homeUrl) ? t.homeUrl : t.url; d.url = d.homeUrl!; d.name = typeof t.name === 'string' ? t.name.slice(0, 200) : typeof t.title === 'string' ? t.title.slice(0, 200) : d.title; }
    seen.add(d.id); d.title = typeof t.title === 'string' ? t.title.slice(0, 200) : d.title; d.favicon = faviconURL(t.favicon); return [d];
  });
  p.favorites = clean(r.favorites, 'favorite').filter((t, i, a) => a.findIndex(x => x.url === t.url) === i).slice(0, 9);
  p.tabs = p.settings.restoreSession ? clean(r.tabs, 'tab') : [];
  p.closed = clean(r.closed, 'tab').slice(0, 25);
  p.activeId = !p.settings.restoreSession ? '' : [...p.tabs, ...p.favorites].some(t => t.id === r.activeId) ? r.activeId! : p.tabs[0]?.id ?? p.favorites[0]?.id ?? '';
  p.history = Array.isArray(r.history) ? r.history.filter(v => v && typeof v.url === 'string' && webURL(v.url) && typeof v.title === 'string' && Number.isFinite(v.at)).slice(0, 500) : [];
  p.downloads = Array.isArray(r.downloads) ? r.downloads.filter(d => d && typeof d.id === 'string' && /^[\w-]{1,100}$/.test(d.id) && typeof d.path === 'string' && d.path.length <= 4096 && path.isAbsolute(d.path) && typeof d.filename === 'string').slice(0, 100).map(d => ({ id: d.id, path: d.path, filename: d.filename.slice(0, 255), owner: typeof d.owner === 'string' ? d.owner.slice(0, 100) : '', received: Number.isFinite(d.received) ? Math.max(0, d.received) : 0, total: Number.isFinite(d.total) ? Math.max(0, d.total) : 0, state: d.state === 'completed' || d.state === 'cancelled' ? d.state : 'interrupted' })) : [];
  return p;
}
export class ProfileStore {
  private timer?: NodeJS.Timeout;
  private queue = Promise.resolve();
  error?: string;
  constructor(public filename: string, private state: () => Profile) {}
  static async load(filename: string) {
    try { const stat = await fs.stat(filename); if (stat.size > 16 * 1024 * 1024) throw new Error('Profile too large'); return restoreProfile(JSON.parse(await fs.readFile(filename, 'utf8'))); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') await fs.copyFile(filename, `${filename}.corrupt-${Date.now()}`).catch(() => {}); return emptyProfile(); }
  }
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => void this.flush().catch(() => {}), 500); }
  flush() {
    clearTimeout(this.timer); const json = JSON.stringify(this.state());
    this.queue = this.queue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
      await fs.writeFile(`${this.filename}.tmp`, json, { mode: 0o600 });
      await fs.rename(`${this.filename}.tmp`, this.filename); this.error = undefined;
    }).catch(e => { this.error = String(e); console.error('Session save failed:', e); throw e; });
    return this.queue;
  }
}
