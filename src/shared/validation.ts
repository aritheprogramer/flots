import { accents, validHex } from './appearance';
import { defaults, type Action, type Settings } from './model';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 8192): v is string => typeof v === 'string' && v.length <= max;
export function settingsPatch(v: unknown): Partial<Settings> {
  if (!object(v)) throw new Error('Invalid settings');
  const p: Partial<Settings> = {};
  for (const [k, value] of Object.entries(v)) {
    if (['sidebarVisible', 'blocker', 'restoreSession', 'showMemory'].includes(k) && typeof value === 'boolean') Object.assign(p, { [k]: value });
    else if (k === 'layout' && typeof value === 'string' && ['sidebar', 'horizontal'].includes(value)) p.layout = value as Settings['layout'];
    else if (k === 'theme' && typeof value === 'string' && ['system', 'light', 'dark'].includes(value)) p.theme = value as Settings['theme'];
    else if (k === 'accent' && typeof value === 'string' && ['system', 'custom', ...Object.keys(accents)].includes(value)) p.accent = value as Settings['accent'];
    else if (k === 'customAccent' && validHex(value)) p.customAccent = value.toLowerCase();
    else if (k === 'sidebarWidth' && typeof value === 'number' && Number.isInteger(value) && value >= 200 && value <= 360) p.sidebarWidth = value;
    else if (k === 'discardMinutes' && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440) p.discardMinutes = value;
    else if (k === 'searchEngine' && value === 'google') p.searchEngine = value;
    else throw new Error(`Unsupported setting: ${k}`);
  }
  return p;
}
export function validSettings(v: unknown): Settings {
  const s = { ...defaults, siteExceptions: [] as string[] };
  if (!object(v)) return s;
  for (const key of Object.keys(defaults)) {
    try { Object.assign(s, settingsPatch({ [key]: v[key] })); } catch { /* recover field by field */ }
  }
  if (str(v.downloadPath, 4096)) s.downloadPath = v.downloadPath;
  if (Array.isArray(v.siteExceptions)) s.siteExceptions = v.siteExceptions.filter((h): h is string => str(h, 253) && /^[a-z\d.:-]+$/i.test(h)).slice(0, 1000);
  return s;
}
export function validateAction(v: unknown): Action {
  if (!object(v) || !str(v.type, 40)) throw new Error('Invalid action');
  const allow = (keys: string[]) => { if (Object.keys(v as Record<string, unknown>).some(k => k !== 'type' && !keys.includes(k))) throw new Error('Unexpected field'); };
  switch (v.type) {
    case 'new': allow(['url', 'background']); if ((v.url !== undefined && !str(v.url)) || (v.background !== undefined && typeof v.background !== 'boolean')) throw new Error('Invalid tab'); break;
    case 'navigate': allow(['input']); if (!str(v.input)) throw new Error('Invalid address'); break;
    case 'activate': case 'close': case 'discard': case 'favorite-remove': case 'context': allow(['id']); if (!str(v.id, 100)) throw new Error('Invalid id'); break;
    case 'favorite-edit': allow(['id', 'url', 'title']); if (!str(v.id, 100) || !str(v.url) || !str(v.title, 200)) throw new Error('Invalid favorite'); break;
    case 'reorder': allow(['kind', 'ids']); if (typeof v.kind !== 'string' || !['tab', 'favorite'].includes(v.kind) || !Array.isArray(v.ids) || !v.ids.every(id => str(id, 100))) throw new Error('Invalid order'); break;
    case 'settings': allow(['patch']); v = { ...v, patch: settingsPatch(v.patch) }; break;
    case 'overlay': allow(['open']); if (typeof v.open !== 'boolean') throw new Error('Invalid overlay'); break;
    case 'find': allow(['text', 'forward']); if (!str(v.text, 500) || typeof v.forward !== 'boolean') throw new Error('Invalid find'); break;
    case 'download': allow(['id', 'operation']); if (!str(v.id, 100) || typeof v.operation !== 'string' || !['open', 'show', 'cancel'].includes(v.operation)) throw new Error('Invalid download'); break;
    case 'back': case 'forward': case 'reload': case 'stop': case 'restore': case 'favorite-add': case 'choose-downloads': case 'toggle-sidebar': case 'site-blocker': case 'clear-history': case 'find-stop': case 'focus-page': case 'memory-refresh': case 'tab-menu': case 'browser-menu': case 'default-browser': case 'print': case 'save-page': allow([]); break;
    default: throw new Error('Unknown action');
  }
  return v as Action;
}
