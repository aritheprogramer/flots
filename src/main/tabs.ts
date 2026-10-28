import { randomUUID } from 'node:crypto';
import type { Destination, Profile } from '../shared/model';
import { webURL } from '../shared/navigation';
export function destination(url = '', kind: Destination['kind'] = 'tab'): Destination {
  if (url && !webURL(url)) throw new Error('Invalid destination');
  return { id: randomUUID(), kind, url, title: url ? new URL(url).hostname : 'New tab', lifecycle: 'unloaded', lastActive: Date.now(), audible: false, dirty: false, protected: false, canGoBack: false, canGoForward: false };
}
export class Tabs {
  constructor(public state: Profile) {}
  all() { return [...this.state.tabs, ...this.state.favorites]; }
  get(id = this.state.activeId) { return this.all().find(t => t.id === id); }
  add(url = '', background = false) { const t = destination(url); this.state.tabs.push(t); if (!background) this.activate(t.id); return t; }
  activate(id: string) { const t = this.get(id); if (!t) throw new Error('Destination no longer exists'); this.state.activeId = id; t.lastActive = Date.now(); return t; }
  close(id: string) {
    const t = this.get(id); if (!t || t.kind !== 'tab') return;
    const index = this.state.tabs.indexOf(t); this.state.tabs.splice(index, 1);
    this.state.closed.unshift({ ...t }); this.state.closed = this.state.closed.slice(0, 25);
    if (this.state.activeId === id) this.state.activeId = this.state.tabs[Math.min(index, this.state.tabs.length - 1)]?.id ?? this.state.favorites[0]?.id ?? '';
  }
  restore() { const old = this.state.closed.shift(); if (!old) return; const t = this.add(old.url); t.title = old.title; t.favicon = old.favicon; return t; }
  addFavorite() {
    const active = this.get(); if (!active?.url) throw new Error('Open a website to save a favorite.');
    const existing = this.state.favorites.find(t => (t.homeUrl ?? t.url) === active.url); if (existing) return existing;
    if (this.state.favorites.length >= 9) throw new Error('All 9 favorite positions are filled.');
    const t = destination(active.url, 'favorite'); t.title = active.title; t.name = active.title; t.homeUrl = active.url; t.favicon = active.favicon; this.state.favorites.push(t); return t;
  }
  removeFavorite(id: string) { this.state.favorites = this.state.favorites.filter(t => t.id !== id); if (this.state.activeId === id) this.state.activeId = this.state.tabs[0]?.id ?? this.state.favorites[0]?.id ?? ''; }
  reorder(kind: 'tab' | 'favorite', ids: string[]) {
    const list = kind === 'tab' ? this.state.tabs : this.state.favorites;
    if (ids.length !== list.length || new Set(ids).size !== list.length || ids.some(id => !list.some(t => t.id === id))) throw new Error('Invalid ordering');
    const next = ids.map(id => list.find(t => t.id === id)!);
    if (kind === 'tab') this.state.tabs = next; else this.state.favorites = next;
  }
}
export function mayDiscard(t: Destination, activeId: string, downloading: boolean, automatic: boolean, delay: number, now = Date.now()): boolean {
  return t.id !== activeId && t.lifecycle === 'loaded' && !t.audible && !t.dirty && !t.protected && !downloading && (!automatic || (t.kind === 'favorite' && delay > 0 && now - t.lastActive >= delay * 60000));
}
