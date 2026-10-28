import type { Accent } from './appearance';
export type Lifecycle = 'unloaded' | 'loading' | 'loaded' | 'discarded' | 'crashed';
export interface Destination {
  id: string; kind: 'tab' | 'favorite'; url: string; title: string; favicon?: string; homeUrl?: string; name?: string;
  lifecycle: Lifecycle; lastActive: number; audible: boolean; dirty: boolean; protected: boolean;
  canGoBack: boolean; canGoForward: boolean; error?: string;
}
export interface Settings {
  layout: 'sidebar' | 'horizontal'; theme: 'system' | 'light' | 'dark'; sidebarVisible: boolean;
  accent: Accent; customAccent: string; sidebarWidth: number;
  discardMinutes: number; blocker: boolean; siteExceptions: string[]; downloadPath: string;
  restoreSession: boolean; showMemory: boolean; searchEngine: 'google';
}
export interface Visit { url: string; title: string; at: number }
export interface Download { id: string; filename: string; path: string; received: number; total: number; state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'; owner: string }
export interface Profile {
  version: 1; tabs: Destination[]; favorites: Destination[]; activeId: string;
  closed: Destination[]; history: Visit[]; settings: Settings; downloads: Download[];
}
export interface MemorySnapshot { at: number; residentMB: number; processes: { pid: number; type: string; label?: string; residentMB: number; cpu: number }[] }
export interface Snapshot extends Profile { memory?: MemorySnapshot; versions: { app: string; electron: string; chrome: string }; dark: boolean; accentColor: string; nativeGlass: boolean; highContrast: boolean; reducedTransparency: boolean; blocked: number }
export type Action =
  | { type: 'new'; url?: string; background?: boolean }
  | { type: 'navigate'; input: string }
  | { type: 'activate' | 'close' | 'discard' | 'favorite-remove' | 'context'; id: string }
  | { type: 'back' | 'forward' | 'reload' | 'stop' | 'restore' | 'favorite-add' | 'choose-downloads' | 'toggle-sidebar' | 'site-blocker' | 'clear-history' }
  | { type: 'reorder'; kind: 'tab' | 'favorite'; ids: string[] }
  | { type: 'favorite-edit'; id: string; title: string; url: string }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'overlay'; open: boolean }
  | { type: 'find'; text: string; forward: boolean }
  | { type: 'find-stop' | 'focus-page' | 'memory-refresh' | 'tab-menu' | 'browser-menu' | 'default-browser' | 'print' | 'save-page' }
  | { type: 'download'; id: string; operation: 'cancel' | 'open' | 'show' };
export const defaults: Settings = { layout: 'horizontal', accent: 'system', customAccent: '#6688bb', sidebarWidth: 250, theme: 'system', sidebarVisible: true, discardMinutes: 5, blocker: true, siteExceptions: [], downloadPath: '', restoreSession: true, showMemory: true, searchEngine: 'google' };
export const emptyProfile = (): Profile => ({ version: 1, tabs: [], favorites: [], activeId: '', closed: [], history: [], downloads: [], settings: { ...defaults, siteExceptions: [] } });
