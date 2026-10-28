import './style.css';
import { accents, accentTokens, validHex } from '../shared/appearance';
import { icon } from './icons';
import type { Action, Destination, Snapshot } from '../shared/model';
import { hostname } from '../shared/navigation';
declare global { interface Window { flots: { getState(): Promise<Snapshot>; act(action: Action): Promise<{ ok: boolean; error?: string }>; subscribe(cb: (s: Snapshot) => void): () => void; onCommand(cb: (command: string, id?: string) => void): () => void } } }
const $ = <T extends HTMLElement = HTMLInputElement>(selector: string) => document.querySelector<T>(selector)!;
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const button = (id: string, name: string, title: string) => `<button type="button" id="${id}" class="icon-button" title="${title}" aria-label="${title}">${icon(name)}</button>`;
$('#app').innerHTML = `
  <button id="skip-page" class="skip-link">Focus website</button>
  <aside id="sidebar" aria-label="Browser sidebar"><div class="sidebar-head">${button('side-collapse', 'sidebar', 'Hide sidebar · ⌘⇧B')}</div><div class="side-content"><div id="favorites" class="favorites" aria-label="Favorites"></div><div id="side-tabs" class="tabs" role="tablist" aria-orientation="vertical" aria-label="Open tabs"></div><button id="side-new" class="new-tab">${icon('plus')}<span>New tab</span><kbd>⌘T</kbd></button></div><div id="sidebar-resize" role="separator" tabindex="0" aria-label="Sidebar width" aria-orientation="vertical" aria-valuemin="200" aria-valuemax="360"></div></aside>
  <div id="horizontal-strip"><div class="traffic-space" aria-hidden="true"></div><div id="horizontal-favorites" class="favorites" aria-label="Favorites"></div><div id="horizontal-tabs" class="tabs" role="tablist" aria-label="Open tabs"></div>${button('horizontal-new', 'plus', 'New tab · ⌘T')}${button('tab-overflow', 'chevron', 'Show all tabs')}</div>
  <header id="toolbar" aria-label="Browser controls"><div class="navigation">${button('back', 'back', 'Back · ⌘[')}${button('forward', 'forward', 'Forward · ⌘]')}${button('reload', 'reload', 'Reload · ⌘R')}</div><form id="address-form">${button('site-info', 'globe', 'Website connection and permissions')}<input id="address" name="address" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="address-suggestions" aria-label="Address or Google search" placeholder="Search or enter a URL…" autocomplete="off" spellcheck="false"><button type="button" id="page-error" title="Page load details" aria-label="Page load details" hidden>!</button><button type="button" id="favorite-add" class="icon-button" aria-label="Save current page to favorites" title="Save to favorites · ⌘D">${icon('star')}</button></form><div class="toolbar-tools"><button id="downloads-button" class="icon-button" aria-label="Downloads · ⌘⇧J" title="Downloads · ⌘⇧J">${icon('download')}<span id="download-badge" hidden></span><span id="download-progress" hidden><span></span></span></button>${button('sidebar-button', 'sidebar', 'Toggle sidebar · ⌘⇧B')}${button('toolbar-settings', 'more', 'Browser menu')}<button id="memory" title="Sum of process resident working sets. Shared memory may be counted more than once."></button></div><form id="find-form" hidden><input id="find-text" name="find" aria-label="Find in page" placeholder="Find in page…" autocomplete="off"><button type="button" id="find-prev" aria-label="Previous match">↑</button><button aria-label="Next match">↓</button><button type="button" id="find-close" aria-label="Close find">×</button></form></header>
  <div id="page-backdrop" aria-hidden="true"></div><main id="empty"><div class="welcome"><h1>New tab</h1><button id="welcome-search">${icon('search')}<span>Search or enter a URL…</span><kbd>⌘L</kbd></button></div></main>
  <div id="omnibox" hidden><div id="address-suggestions" role="listbox" aria-label="Local suggestions"></div></div>
  <div id="modal-root" hidden></div><div id="toast" role="status" aria-live="polite" hidden></div>`;
let state: Snapshot;
let addressOpen = false;
let returnFocus: HTMLElement | null = null;
let modal = '';
let modalEpoch = 0;
let appearanceKey = '';
const listMarkup = new WeakMap<HTMLElement, string>();
let drag: { kind: 'tab' | 'favorite'; id: string } | undefined;
const failedFavicons = new Set<string>();
let selectedSuggestion = 0;
let suggestionActions: Action[] = [];
let toastTimer: ReturnType<typeof setTimeout>;
const active = () => [...state.tabs, ...state.favorites].find(t => t.id === state.activeId);
function toast(message: string) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 5000); }
async function act(action: Action) { const result = await window.flots.act(action); if (!result.ok) toast(result.error ?? 'Something went wrong'); return result.ok; }
function favicon(t: Destination) { return t.favicon && !failedFavicons.has(t.favicon) ? `<img class="favicon" width="16" height="16" src="${esc(t.favicon)}" referrerpolicy="no-referrer" alt=""><span class="favicon-fallback" hidden>${esc((hostname(t.url) || 'f')[0].toUpperCase())}</span>` : `<span class="favicon-fallback">${t.url ? esc(hostname(t.url)[0]?.toUpperCase() || 'f') : icon('globe')}</span>`; }
function tabMarkup(t: Destination) { return `<div class="tab ${t.id === state.activeId ? 'active' : ''} ${['discarded', 'unloaded'].includes(t.lifecycle) ? 'sleeping' : ''}" data-id="${t.id}" data-kind="tab" draggable="true"><button class="tab-select" role="tab" tabindex="${t.id === state.activeId || !state.tabs.some(x => x.id === state.activeId) && t === state.tabs[0] ? 0 : -1}" aria-selected="${t.id === state.activeId}" title="${esc(t.title)} — ${esc(t.url || 'New tab')} · ${t.lifecycle}"><span class="tab-icon ${t.lifecycle === 'loading' ? 'loading' : ''}">${favicon(t)}</span><span class="tab-title">${esc(t.title)}</span>${t.audible ? `<span title="Playing audio" aria-label="Playing audio">${icon('audio')}</span>` : ''}</button><button data-close="${t.id}" class="tab-close" aria-label="Close ${esc(t.title)}">${icon('close')}</button></div>`; }
function favoritesMarkup() { return state.favorites.map((t, i) => `<button class="favorite ${t.id === state.activeId ? 'active' : ''}" data-id="${t.id}" data-kind="favorite" draggable="true" title="${esc(t.name ?? t.title)} · ⌘${i + 1}" aria-label="${esc(t.name ?? t.title)} · Favorite ${i + 1}" aria-pressed="${t.id === state.activeId}">${favicon(t)}</button>`).join(''); }
// Reconcile the small chrome lists by destination ID. Unchanged tabs and their
// favicon/animation nodes survive unrelated progress and memory updates.
function patchNode(current: Node, next: Node) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { current.parentNode!.replaceChild(next.cloneNode(true), current); return; }
  if (current instanceof Element && next instanceof Element) {
    for (const a of [...current.attributes]) if (!next.hasAttribute(a.name)) current.removeAttribute(a.name);
    for (const a of [...next.attributes]) if (current.getAttribute(a.name) !== a.value) current.setAttribute(a.name, a.value);
    const children = [...next.childNodes];
    children.forEach((child, i) => current.childNodes[i] ? patchNode(current.childNodes[i], child) : current.appendChild(child.cloneNode(true)));
    while (current.childNodes.length > children.length) current.lastChild!.remove();
  } else if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
}
function updateList(selector: string, markup: string) {
  const root = $(selector); if (listMarkup.get(root) === markup || drag) return;
  const template = document.createElement('template'); template.innerHTML = markup;
  const existing = new Map([...root.children].map(el => [(el as HTMLElement).dataset.id, el]));
  const wanted = [...template.content.children];
  wanted.forEach((next, i) => {
    const id = (next as HTMLElement).dataset.id; const current = existing.get(id);
    if (current) { patchNode(current, next); if (root.children[i] !== current) root.insertBefore(current, root.children[i] ?? null); existing.delete(id); }
    else root.insertBefore(next, root.children[i] ?? null);
  });
  for (const el of existing.values()) el.remove();
  listMarkup.set(root, markup);
}
function setIcon(selector: string, name: Parameters<typeof icon>[0]) { const el = $(selector); if (el.dataset.icon !== name) { el.innerHTML = icon(name); el.dataset.icon = name; } }
function render() {
  document.documentElement.dataset.theme = state.dark ? 'dark' : 'light';
  document.body.dataset.layout = state.settings.layout;
  document.body.classList.toggle('sidebar-hidden', !state.settings.sidebarVisible);
  const t = active();
  const nextAppearance = `${state.accentColor}:${state.dark}`;
  if (appearanceKey !== nextAppearance) {
    appearanceKey = nextAppearance;
    for (const [key, value] of Object.entries(accentTokens(state.accentColor, state.dark))) document.documentElement.style.setProperty(`--accent-${key}`, value);
  }
  document.body.classList.toggle('native-glass', state.nativeGlass); document.body.classList.toggle('high-contrast', state.highContrast); document.body.classList.toggle('reduced-transparency', state.reducedTransparency);
  document.documentElement.style.setProperty('--sidebar-width', `${state.settings.sidebarWidth}px`);
  $('#sidebar-resize').setAttribute('aria-valuenow', String(state.settings.sidebarWidth));
  $('#empty').hidden = !!t?.url;
  $('#sidebar-button').setAttribute('aria-pressed', String(state.settings.layout === 'sidebar' && state.settings.sidebarVisible));
  setIcon('#site-info', t?.url.startsWith('https:') ? 'lock' : 'globe');
  $('#site-info').title = t?.url ? t.url.startsWith('https:') ? 'HTTPS connection' : 'Not secure: HTTP connection' : 'Website information';
  if (document.activeElement !== $('#address')) $('#address').value = t?.url ?? '';
  ($('#back') as HTMLButtonElement).disabled = !t?.canGoBack; ($('#forward') as HTMLButtonElement).disabled = !t?.canGoForward;
  setIcon('#reload', t?.lifecycle === 'loading' ? 'close' : 'reload');
  $('#reload').setAttribute('aria-label', t?.lifecycle === 'loading' ? 'Stop loading' : 'Reload');
  $('#address-form').classList.toggle('is-loading', t?.lifecycle === 'loading');
  updateList('#side-tabs', state.tabs.map(tabMarkup).join('')); updateList('#horizontal-tabs', state.tabs.map(tabMarkup).join(''));
  updateList('#favorites', favoritesMarkup()); updateList('#horizontal-favorites', favoritesMarkup());
  const saved = state.favorites.some(f => (f.homeUrl ?? f.url) === t?.url);
  ($('#favorite-add') as HTMLButtonElement).disabled = !t?.url || state.favorites.length >= 9 && !saved;
  $('#favorite-add').setAttribute('aria-pressed', String(saved)); $('#favorite-add').title = saved ? 'Remove favorite' : 'Save to favorites · ⌘D';
  $('#page-error').hidden = !t?.error;
  const memory = state.memory ? `${Math.round(state.memory.residentMB)} MiB` : '…';
  $('#memory').textContent = memory; $('#memory').hidden = !state.settings.showMemory;
  const swatch = document.querySelector<HTMLElement>('#dock-preview'); if (swatch) swatch.style.backgroundColor = state.accentColor;
  document.querySelectorAll<HTMLElement>('[data-accent]').forEach(el => { el.setAttribute('aria-pressed', String(el.dataset.accent === state.settings.accent)); if (el.dataset.accent !== 'system') el.style.setProperty('--swatch', accents[el.dataset.accent as keyof typeof accents]); });
  renderDownloadIndicator();
  if (modal === 'memory') renderMemory();
  if (modal === 'downloads') renderDownloads();
  if (modal === 'command') suggestions($('#command-input').value);
  document.querySelectorAll<HTMLImageElement>('.favicon').forEach(img => { img.onerror = () => { if (failedFavicons.size >= 256) failedFavicons.delete(failedFavicons.values().next().value!); failedFavicons.add(img.src); img.hidden = true; (img.nextElementSibling as HTMLElement).hidden = false; }; });
}
async function openModal(kind: string, id?: string) {
  const epoch = ++modalEpoch;
  returnFocus = document.activeElement as HTMLElement; if (addressOpen) await closeAddress();
  modal = kind; await act({ type: 'overlay', open: true });
  if (epoch !== modalEpoch) return;
  const root = $('#modal-root'); root.hidden = false;
  root.innerHTML = `<div class="scrim"></div><section class="modal ${kind === 'command' ? 'command-modal' : kind === 'settings' || kind === 'about' ? 'settings-modal' : ''}" role="dialog" aria-modal="true" aria-label="${kind}"><div id="modal-body"></div></section>`;
  for (const id of ['toolbar', 'sidebar', 'horizontal-strip', 'empty']) $(`#${id}`).inert = true;
  $('.scrim').onclick = () => void closeModal();
  const body = $('#modal-body');
  if (kind === 'command') {
    body.innerHTML = `<div class="command-input-wrap">${icon('search')}<input id="command-input" name="command" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="suggestions" aria-label="Search tabs, favorites, history, or the web" placeholder="Where would you like to go?" autocomplete="off" spellcheck="false"><kbd>esc</kbd></div><div id="suggestions" role="listbox" aria-label="Local suggestions"></div><div class="command-footer"><span>↑ ↓ to explore <span>↵ to open</span></span><span>flots</span></div>`;
    const input = $('#command-input') as HTMLInputElement; input.oninput = () => { selectedSuggestion = 0; suggestions(input.value); }; input.onkeydown = async e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selectedSuggestion = (selectedSuggestion + (e.key === 'ArrowDown' ? 1 : -1) + suggestionActions.length) % suggestionActions.length; suggestions(input.value); }
      if (e.key === 'Enter') { e.preventDefault(); const a = suggestionActions[selectedSuggestion]; if (a && await act(a)) await closeModal(); }
    }; suggestions(''); input.focus();
  } else if (kind === 'settings' || kind === 'about') {
    body.innerHTML = `<div class="modal-title"><div><h2>${kind === 'about' ? 'About flots' : 'Settings'}</h2></div><button class="dismiss" aria-label="Close">${icon('close')}</button></div><div class="settings-shell"><nav class="settings-nav" aria-label="Settings categories"><div class="settings-brand">${icon('wave')}<span>Flots</span></div><button data-panel="appearance">${icon('settings')}Appearance</button><button data-panel="browsing">${icon('globe')}Browsing</button><button data-panel="about">${icon('shield')}About</button></nav><div class="settings-content"><section data-settings-panel="appearance"><h3>Appearance</h3>
    <label class="setting"><span>Tab layout<small>Switch without reloading your pages.</small></span><select data-setting="layout"><option value="sidebar">Sidebar</option><option value="horizontal">Compact Top</option></select></label>
    <label class="setting"><span>Appearance</span><select data-setting="theme"><option value="system">Follow macOS</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <section class="appearance-section" aria-label="Accent color"><h3>Accent color</h3><p class="quiet">A subtle accent for selected controls and your Dock icon.</p><div class="accent-options"><button data-accent="system" class="accent-system">Follow macOS</button>${Object.entries(accents).map(([key, value]) => `<button class="accent-swatch" data-accent="${key}"  title="${key === 'blue' ? 'Slate blue' : key}" aria-label="${key === 'blue' ? 'Slate blue' : key}"><span></span></button>`).join('')}</div><form id="custom-accent-form"><label for="custom-accent">Custom hex</label><input id="custom-accent" name="custom-accent" value="${state.settings.customAccent}" pattern="#[0-9a-fA-F]{6}" maxlength="7" spellcheck="false" autocomplete="off" aria-describedby="accent-error"><input id="accent-picker" type="color" aria-label="Choose accent color" value="${state.settings.customAccent}"><button class="secondary">Apply</button><small id="accent-error" role="status"></small></form><div class="dock-setting"><span id="dock-preview" aria-hidden="true">${icon('wave')}</span><span>Dock icon<small>Matches your accent while Flots is running.</small></span></div></section>
    </section><section data-settings-panel="browsing" hidden><h3>Browsing</h3><div class="setting"><span>Default browser<small>Open links from Mail and other apps in Flots.</small></span><button id="default-browser" class="secondary">Make default…</button></div><label class="setting"><span>Search engine</span><select disabled aria-label="Search engine"><option>Google</option></select></label>
    <label class="setting"><span>Let inactive favorites rest<small>Minutes before safe pages are discarded. 0 = never.<br>Regular tabs are never discarded automatically.</small></span><input type="number" min="0" max="1440" step="1" data-setting="discardMinutes" aria-label="Favorite discard delay"></label>
    <label class="setting"><span>Block common ads & trackers<small>Lightweight network filtering · ${state.blocked} blocked this session.</small></span><input type="checkbox" data-setting="blocker"></label>
    <label class="setting"><span>Restore previous session</span><input type="checkbox" data-setting="restoreSession"></label>
    <label class="setting"><span>Show memory usage<small>Sum of resident process working sets, including shared pages.</small></span><input type="checkbox" data-setting="showMemory"></label>
    <div class="setting"><span>Download folder<small id="download-path">${esc(state.settings.downloadPath)}<br>Confirm each file in the native Save dialog.</small></span><button id="choose-folder" class="secondary">Choose…</button></div>
    </section><section data-settings-panel="about" hidden><div class="about"><div class="about-brand">${icon('wave')} flots <span>${esc(state.versions.app)} · Development preview</span></div><p>Chromium ${state.versions.chrome} · Electron ${state.versions.electron}</p><p>One profile. No telemetry. No cloud account.</p><p>Persistent website sessions are supported. Password autofill, extensions and DRM playback are not included.</p><p>iCloud passkeys (including Google sign-in) are unavailable in this local build. Browser access requires Apple approval and a signed integration. Use another sign-in method offered by the website.</p><button id="licenses" class="text-button">Licenses & acknowledgments</button></div></section></div></div>`;
    const showPanel = (name: string) => { body.querySelectorAll<HTMLElement>('[data-settings-panel]').forEach(el => el.hidden = el.dataset.settingsPanel !== name); body.querySelectorAll<HTMLElement>('[data-panel]').forEach(el => el.setAttribute('aria-current', String(el.dataset.panel === name))); };
    body.querySelectorAll<HTMLElement>('[data-panel]').forEach(el => el.onclick = () => showPanel(el.dataset.panel!)); showPanel(kind === 'about' ? 'about' : 'appearance');
    body.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]').forEach(el => {
      const key = el.dataset.setting! as keyof Snapshot['settings']; el.name = key; if (el instanceof HTMLInputElement) el.autocomplete = 'off';
      if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(state.settings[key]); else el.value = String(state.settings[key]);
      el.onchange = () => { const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : key === 'discardMinutes' ? Number(el.value) : el.value; void act({ type: 'settings', patch: { [key]: value } }); };
    });
    body.querySelectorAll<HTMLElement>('[data-accent]').forEach(el => el.onclick = () => void act({ type: 'settings', patch: { accent: el.dataset.accent as Snapshot['settings']['accent'] } }));
    $('#custom-accent-form').onsubmit = async e => { e.preventDefault(); const value = $('#custom-accent').value; if (!validHex(value)) { $('#accent-error').textContent = 'Use a six-digit hex color, such as #6688bb.'; $('#custom-accent').focus(); return; } if (await act({ type: 'settings', patch: { accent: 'custom', customAccent: value } })) $('#accent-error').textContent = 'Accent updated.'; };
    $('#accent-picker').onchange = () => { $('#custom-accent').value = $('#accent-picker').value; $('#custom-accent-form').dispatchEvent(new Event('submit', { cancelable: true })); };
    render();
    $('#choose-folder').onclick = async () => { await act({ type: 'choose-downloads' }); setTimeout(() => $('#download-path').textContent = state.settings.downloadPath, 150); };
    $('#default-browser').onclick = async () => { if (await act({ type: 'default-browser' })) toast('Confirm your choice in the macOS prompt.'); };
    $('#licenses').onclick = () => void openModal('licenses');
  } else if (kind === 'memory') { body.innerHTML = `<div class="modal-title"><h2>Memory use</h2><button class="dismiss" aria-label="Close">${icon('close')}</button></div><div id="memory-content"></div>`; renderMemory();
  } else if (kind === 'site') { const t = active(); const secure = t?.url.startsWith('https:'); body.innerHTML = `<div class="modal-title"><h2>Website information</h2><button class="dismiss" aria-label="Close">${icon('close')}</button></div><p>${esc(hostname(t?.url ?? '') || 'No website open')}</p><p>${secure ? 'HTTPS encrypts the connection. It does not establish that a website is trustworthy.' : 'This connection is not encrypted.'}</p><p class="quiet">Camera, microphone and other sensitive capabilities require permission. Certificate errors are never bypassed.</p><button id="site-blocker" class="secondary">${state.settings.siteExceptions.includes(hostname(t?.url ?? '')) ? 'Enable' : 'Disable'} blocking for this website</button>`; $('#site-blocker').onclick = async () => { await act({ type: 'site-blocker' }); await closeModal(); };
  } else if (kind === 'downloads') { body.innerHTML = `<div class="modal-title"><h2>Downloads</h2><button class="dismiss" aria-label="Close">${icon('close')}</button></div><div id="download-list"></div>`; renderDownloads(); }
  else if (kind === 'history') {
    body.innerHTML = `<div class="modal-title"><h2>History</h2><button class="dismiss" aria-label="Close">${icon('close')}</button></div><div class="history-list">${state.history.length ? state.history.map((h, i) => `<button data-visit="${i}" class="history-item"><span>${esc(h.title)}<small>${esc(h.url)}</small></span><small>${new Date(h.at).toLocaleDateString()}</small></button>`).join('') : '<p class="quiet">Your browsing history will appear here.</p>'}</div><button id="clear-history" class="secondary">Clear browsing history</button>`;
    body.querySelectorAll<HTMLElement>('[data-visit]').forEach(el => el.onclick = async () => { await act({ type: 'navigate', input: state.history[Number(el.dataset.visit)].url }); await closeModal(); });
    $('#clear-history').onclick = async () => { await act({ type: 'clear-history' }); await closeModal(); };
  } else if (kind === 'edit-favorite') {
    const t = state.favorites.find(f => f.id === id); if (!t) { await closeModal(); return; }
    body.innerHTML = `<div class="modal-title"><h2>Edit favorite</h2><button class="dismiss" aria-label="Close">${icon('close')}</button></div><form id="favorite-form" class="edit-form"><label>Name<input id="favorite-name" name="favorite-name" autocomplete="off" value="${esc(t.name ?? t.title)}" maxlength="200" required></label><label>Address<input id="favorite-url" name="favorite-url" autocomplete="off" spellcheck="false" value="${esc(t.homeUrl ?? t.url)}" type="url" required></label><button class="primary">Save changes</button></form>`;
    $('#favorite-form').onsubmit = async e => { e.preventDefault(); if (await act({ type: 'favorite-edit', id: t.id, title: $('#favorite-name').value, url: $('#favorite-url').value })) await closeModal(); };
  } else if (kind === 'licenses') {
    body.innerHTML = `<div class="modal-title"><h2>Acknowledgments</h2><button class="dismiss" aria-label="Close">${icon('close')}</button></div><div class="license-copy"><p>flots source and starter network rules: MIT.</p><p>Electron: MIT. Chromium: BSD and third-party licenses included with the application bundle.</p><p>Ghostery adblocker: MPL-2.0. Its license and source obligations apply to that library; the engine is used unmodified. No external filter subscription is bundled.</p><p>Vite, esbuild, TypeScript and other build tools retain their respective licenses. See THIRD_PARTY_NOTICES.md and the dependencies' LICENSE files.</p></div>`;
  }
  document.querySelector<HTMLButtonElement>('.dismiss')?.addEventListener('click', () => void closeModal());
  if (kind !== 'command') root.querySelector<HTMLElement>('button, input, select')?.focus();
}
async function closeModal() {
  if (!modal) return;
  const epoch = ++modalEpoch; const root = $('#modal-root');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const panel = root.querySelector('.modal');
    if (panel) await panel.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(4px)' }], { duration: 110, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
  }
  if (epoch !== modalEpoch) return;
  modal = ''; root.hidden = true; root.innerHTML = '';
  for (const id of ['toolbar', 'sidebar', 'horizontal-strip', 'empty']) $(`#${id}`).inert = false;
  await act({ type: 'overlay', open: false });
  if (epoch === modalEpoch && returnFocus?.isConnected) returnFocus.focus();
}
function suggestions(query: string) {
  const root = $(addressOpen ? '#address-suggestions' : '#suggestions'); if (!root) return;
  const q = query.trim().toLowerCase();
  const results: { label: string; detail: string; action: Action; icon: string }[] = [];
  if (q) results.push({ label: query, detail: 'Go to address or search Google', action: { type: 'navigate', input: query }, icon: 'search' });
  for (const t of [...state.favorites, ...state.tabs]) if (t.url && (!q || `${t.title} ${t.url}`.toLowerCase().includes(q))) results.push({ label: t.name ?? t.title, detail: `${t.kind === 'favorite' ? 'Favorite' : 'Switch to tab'} · ${hostname(t.url)}`, action: { type: 'activate', id: t.id }, icon: t.kind === 'favorite' ? 'star' : 'globe' });
  for (const h of state.history) if (q && `${h.title} ${h.url}`.toLowerCase().includes(q)) results.push({ label: h.title, detail: `History · ${hostname(h.url)}`, action: { type: 'navigate', input: h.url }, icon: 'history' });
  const list = results.slice(0, 8); suggestionActions = list.map(x => x.action); selectedSuggestion = Math.min(selectedSuggestion, Math.max(0, list.length - 1));
  root.innerHTML = list.length ? list.map((r, i) => `<button class="suggestion ${i === selectedSuggestion ? 'selected' : ''}" id="suggestion-${i}" tabindex="-1" data-suggestion="${i}" role="option" aria-selected="${i === selectedSuggestion}">${icon(r.icon)}<span>${esc(r.label)}<small>${esc(r.detail)}</small></span><span class="enter-symbol">↵</span></button>`).join('') : '<div class="command-empty">Search Google or enter a website address.<small>Suggestions stay on this Mac.</small></div>';
  const input = $(addressOpen ? '#address' : '#command-input'); input.setAttribute('aria-activedescendant', list.length ? `suggestion-${selectedSuggestion}` : '');
  root.querySelectorAll<HTMLElement>('[data-suggestion]').forEach(el => { el.onmousedown = e => e.preventDefault(); el.onclick = async () => { if (await act(suggestionActions[Number(el.dataset.suggestion)])) { if (addressOpen) await closeAddress(); else await closeModal(); } }; });
}
function renderDownloadIndicator() {
  const running = state.downloads.filter(d => d.state === 'progressing');
  const total = running.reduce((n, d) => n + d.total, 0), received = running.reduce((n, d) => n + d.received, 0);
  const known = running.every(d => d.total > 0); const percentage = total > 0 ? Math.min(100, Math.round(received / total * 100)) : 0;
  $('#download-badge').hidden = !running.length; $('#download-badge').textContent = String(running.length);
  $('#download-progress').hidden = !running.length; $('#download-progress').classList.toggle('indeterminate', !known);
  $('#download-progress').style.setProperty('--download-progress', String(percentage / 100));
  const title = running.length ? `${running.length} download${running.length > 1 ? 's' : ''} in progress${known ? ` · ${percentage}%` : ''}` : state.downloads[0]?.state === 'completed' ? `Downloaded ${state.downloads[0].filename}` : 'Downloads · ⌘⇧J';
  $('#downloads-button').title = title; $('#downloads-button').setAttribute('aria-label', title.startsWith('Downloads') ? title : `Downloads · ${title}`);
  $('#downloads-button').classList.toggle('downloading', running.length > 0);
}
function renderMemory() {
  const root = $('#memory-content'); if (!root || !state.memory) return;
  const expanded = root.querySelector<HTMLDetailsElement>('.memory-note')?.open ?? false;
  const summaryFocused = root.querySelector('summary') === document.activeElement;
  const memory = state.memory; const total = Math.max(1, memory.residentMB);
  const rows = [...memory.processes].sort((a, b) => b.residentMB - a.residentMB);
  root.innerHTML = `<div class="memory-summary"><strong>${Math.round(memory.residentMB)}</strong><span>MiB in use</span></div><p class="quiet">Across Flots and your open pages.</p><div class="memory-distribution" aria-hidden="true">${rows.map((_, i) => `<span data-memory-segment="${i}"></span>`).join('')}</div>${rows.map((p, i) => `<div class="memory-row"><header><strong>${esc(p.label ?? p.type)}</strong><span>${Math.round(p.residentMB)} MiB</span></header><div class="memory-bar" role="meter" aria-label="${esc(p.label ?? p.type)} memory share" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.residentMB / total * 100)}" data-memory-row="${i}"><span></span></div></div>`).join('')}<details class="memory-note"><summary>How this is measured</summary>Resident working sets of Electron and Chromium processes, updated every 15 seconds. Shared pages can be counted more than once. This is not unique physical RAM or JavaScript heap. Discarding an inactive page releases its live state; unsaved forms and scripts are not retained.</details>`;
  const colors = [state.accentColor, ...Object.values(accents)];
  root.querySelector<HTMLDetailsElement>('.memory-note')!.open = expanded;
  if (summaryFocused) root.querySelector<HTMLElement>('summary')?.focus();
  rows.forEach((p, i) => { const share = `${p.residentMB / total * 100}%`; const color = colors[i % colors.length]; const row = root.querySelector<HTMLElement>(`[data-memory-row="${i}"]`)!; row.style.setProperty('--share', share); row.style.setProperty('--bar', color); const segment = root.querySelector<HTMLElement>(`[data-memory-segment="${i}"]`)!; segment.style.width = share; segment.style.backgroundColor = color; });
}
function renderDownloads() {
  const list = $('#download-list'); if (!list) return;
  const focused = list.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
  const size = (n: number) => `${(n / 1048576).toFixed(1)} MiB`;
  list.innerHTML = state.downloads.length ? state.downloads.map(d => `<div class="download-item">${icon('download')}<div><strong>${esc(d.filename)}</strong><small>${d.state === 'progressing' ? d.total ? `Downloading · ${Math.min(100, Math.round(d.received / d.total * 100))}%` : 'Downloading…' : d.state === 'completed' ? 'Downloaded' : d.state === 'cancelled' ? 'Cancelled' : 'Interrupted'} · ${size(d.received)}${d.total > 0 ? ` / ${size(d.total)}` : ''}</small>${d.state === 'progressing' ? `<progress aria-label="Download ${esc(d.filename)}" max="${d.total || 1}" ${d.total ? `value="${d.received}"` : ''}></progress>` : ''}</div>${d.state === 'progressing' ? `<button data-download="${d.id}" data-operation="cancel">Cancel</button>` : d.state === 'completed' ? `<button data-download="${d.id}" data-operation="open">Open</button><button data-download="${d.id}" data-operation="show">${icon('folder')}<span class="sr-only">Show in Finder</span></button>` : ''}</div>`).join('') : '<p class="quiet">Downloaded files will appear here.</p>';
  if (focused?.dataset.download) list.querySelector<HTMLElement>(`[data-download="${focused.dataset.download}"][data-operation="${focused.dataset.operation}"]`)?.focus();
  list.querySelectorAll<HTMLElement>('[data-download]').forEach(el => el.onclick = () => void act({ type: 'download', id: el.dataset.download!, operation: el.dataset.operation as 'cancel' | 'open' | 'show' }));
}
async function closeAddress() { addressOpen = false; $('#omnibox').hidden = true; $('#address').setAttribute('aria-expanded', 'false'); $('#address').removeAttribute('aria-activedescendant'); await act({ type: 'overlay', open: false }); }
$('#address-form').onsubmit = async e => { e.preventDefault(); const a = addressOpen ? suggestionActions[selectedSuggestion] : undefined; if (await act(a ?? { type: 'navigate', input: $('#address').value })) { await closeAddress(); $('#address').blur(); await act({ type: 'focus-page' }); } };
$('#address').addEventListener('focus', () => $('#address').select());
$('#address').addEventListener('input', () => { const wasOpen = addressOpen; addressOpen = true; $('#omnibox').hidden = false; $('#address').setAttribute('aria-expanded', 'true'); selectedSuggestion = 0; suggestions($('#address').value); if (!wasOpen) void act({ type: 'overlay', open: true }); });
$('#address').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); void closeAddress(); $('#address').value = active()?.url ?? ''; $('#address').blur(); } else if (addressOpen && ['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); selectedSuggestion = (selectedSuggestion + (e.key === 'ArrowDown' ? 1 : -1) + suggestionActions.length) % Math.max(1, suggestionActions.length); suggestions($('#address').value); } });
$('#address').addEventListener('blur', () => { if (addressOpen) void closeAddress(); });
for (const id of ['side-new', 'horizontal-new']) $(`#${id}`).onclick = () => void act({ type: 'new' });
$('#welcome-search').onclick = () => { $('#address').focus(); $('#address').select(); };
$('#toolbar-settings').onclick = () => void act({ type: 'browser-menu' });
$('#site-info').setAttribute('type', 'button'); $('#site-info').onclick = () => void openModal('site');
$('#tab-overflow').onclick = () => void act({ type: 'tab-menu' });
$('#side-collapse').onclick = () => void act({ type: 'toggle-sidebar' });
$('#skip-page').onclick = () => void act({ type: 'focus-page' });
$('#downloads-button').onclick = () => void openModal('downloads');
$('#back').onclick = () => void act({ type: 'back' }); $('#forward').onclick = () => void act({ type: 'forward' });
$('#reload').onclick = () => void act({ type: active()?.lifecycle === 'loading' ? 'stop' : 'reload' });
$('#sidebar-button').onclick = () => void act({ type: 'toggle-sidebar' }); $('#favorite-add').onclick = () => { const f = state.favorites.find(f => (f.homeUrl ?? f.url) === active()?.url); void act(f ? { type: 'favorite-remove', id: f.id } : { type: 'favorite-add' }); };
$('#page-error').onclick = () => toast(active()?.error ?? '');
$('#memory').onclick = async () => { await act({ type: 'memory-refresh' }); state = await window.flots.getState(); await openModal('memory'); };
$('#find-form').onsubmit = e => { e.preventDefault(); void act({ type: 'find', text: $('#find-text').value, forward: true }); };
$('#find-prev').onclick = () => void act({ type: 'find', text: $('#find-text').value, forward: false });
$('#find-close').onclick = () => { $('#find-form').hidden = true; void act({ type: 'find-stop' }); };
document.addEventListener('click', e => { const el = e.target as HTMLElement; const close = el.closest<HTMLElement>('[data-close]'); if (close) { void act({ type: 'close', id: close.dataset.close! }); return; } const t = el.closest<HTMLElement>('[data-id]'); if (t) void act({ type: 'activate', id: t.dataset.id! }); });
document.addEventListener('auxclick', e => { if (e.button === 1) { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-kind="tab"]'); if (t) { e.preventDefault(); void act({ type: 'close', id: t.dataset.id! }); } } });
document.addEventListener('contextmenu', e => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (t) { e.preventDefault(); void act({ type: 'context', id: t.dataset.id! }); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (modal) void closeModal(); else if (!$('#find-form').hidden) $('#find-close').click(); }
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
  if (t && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const list = t.dataset.kind === 'favorite' ? state.favorites : state.tabs; const index = list.findIndex(x => x.id === t.dataset.id); const delta = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1; const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (index + delta + list.length) % list.length; if (e.altKey) { const ids = list.map(x => x.id); [ids[index], ids[next]] = [ids[next], ids[index]]; void act({ type: 'reorder', kind: t.dataset.kind as 'tab' | 'favorite', ids }); } else { const root = t.parentElement!; root.querySelector<HTMLElement>(`[data-id="${list[next].id}"] .tab-select, button[data-id="${list[next].id}"]`)?.focus(); void act({ type: 'activate', id: list[next].id }); } }
  if (t && e.shiftKey && e.key === 'F10') { e.preventDefault(); void act({ type: 'context', id: t.dataset.id! }); }
  if (modal && e.key === 'Tab') { const nodes = [...$('#modal-root').querySelectorAll<HTMLElement>('button:not(:disabled), input, select')].filter(el => !el.closest('[hidden]')); const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
});
document.addEventListener('dragstart', e => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (t) { drag = { id: t.dataset.id!, kind: t.dataset.kind as 'tab' | 'favorite' }; e.dataTransfer?.setData('text/plain', drag.id); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault(); const target = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
  if (drag && target && target.dataset.kind === drag.kind) { const ids = (drag.kind === 'tab' ? state.tabs : state.favorites).map(t => t.id); const to = ids.indexOf(target.dataset.id!); ids.splice(ids.indexOf(drag.id), 1); ids.splice(to, 0, drag.id); void act({ type: 'reorder', kind: drag.kind, ids }); }
  else if (!drag) { const url = e.dataTransfer?.getData('text/uri-list').split('\n').find(x => x && !x.startsWith('#')); if (url && /^https?:\/\//.test(url)) void act({ type: 'new', url }); }
  drag = undefined;
});
document.addEventListener('dragend', () => { drag = undefined; render(); });
const handle = $('#sidebar-resize');
handle.onkeydown = e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); void act({ type: 'settings', patch: { sidebarWidth: Math.max(200, Math.min(360, state.settings.sidebarWidth + (e.key === 'ArrowLeft' ? -10 : 10))) } }); } };
handle.onpointerdown = e => { handle.setPointerCapture(e.pointerId); handle.onpointermove = event => { const width = Math.max(200, Math.min(360, Math.round(event.clientX))); document.documentElement.style.setProperty('--sidebar-width', `${width}px`); }; handle.onpointerup = event => { handle.releasePointerCapture(event.pointerId); handle.onpointermove = null; handle.onpointerup = null; void act({ type: 'settings', patch: { sidebarWidth: Math.max(200, Math.min(360, Math.round(event.clientX))) } }); }; };
window.flots.onCommand((command, id) => {
  if (command.startsWith('error:')) { toast(command.slice(6)); return; }
  if (command === 'dismiss-overlays') { void (async () => { if (modal) await closeModal(); if (addressOpen) await closeAddress(); await act({ type: 'focus-page' }); })(); }
  else if (command === 'address') { const focusAddress = () => { $('#address').focus(); $('#address').select(); }; if (modal) void closeModal().then(focusAddress); else focusAddress(); }
  else if (command === 'find') { $('#find-form').hidden = false; $('#find-text').focus(); }
  else void openModal(command, id);
});
window.flots.subscribe(s => { if (state && s.activeId !== state.activeId) { $('#address').value = [...s.tabs, ...s.favorites].find(t => t.id === s.activeId)?.url ?? ''; if (addressOpen) void closeAddress(); } state = s; render(); });
void window.flots.getState().then(s => { state = s; render(); });
