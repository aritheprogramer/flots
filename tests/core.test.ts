import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emptyProfile } from '../src/shared/model';
import { navigateInput } from '../src/shared/navigation';
import { validateAction } from '../src/shared/validation';
import { Tabs, destination, mayDiscard } from '../src/main/tabs';
import { ProfileStore, restoreProfile } from '../src/main/persistence';
import { shouldFilter } from '../src/main/blocker';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import { downloadState } from '../src/main/downloads';
import { trustedSender } from '../src/main/security';
test('normalizes web addresses and encodes searches; rejects executable schemes', () => {
  assert.equal(navigateInput(' example.com/hello '), 'https://example.com/hello');
  assert.equal(navigateInput('localhost:3000/test'), 'http://localhost:3000/test');
  assert.equal(navigateInput('https://example.com'), 'https://example.com/');
  assert.equal(navigateInput('a calm web & more'), 'https://www.google.com/search?q=a%20calm%20web%20%26%20more');
  for (const input of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,test', 'https://user:pass@example.com']) assert.throws(() => navigateInput(input));
});
test('favorite limit is enforced at the model and duplicates are idempotent', () => {
  const tabs = new Tabs(emptyProfile());
  for (let i = 0; i < 9; i++) { tabs.add(`https://site${i}.example/`); tabs.addFavorite(); }
  assert.equal(tabs.state.favorites.length, 9); tabs.addFavorite(); assert.equal(tabs.state.favorites.length, 9);
  tabs.add('https://overflow.example/'); assert.throws(() => tabs.addFavorite(), /9/);
});
test('reorder preserves identities, rejects duplicates/missing/foreign ids', () => {
  const tabs = new Tabs(emptyProfile()); for (let i = 0; i < 3; i++) { tabs.add(`https://site${i}.example/`); tabs.addFavorite(); }
  const reversed = tabs.state.favorites.map(t => t.id).reverse(); tabs.reorder('favorite', reversed);
  assert.deepEqual(tabs.state.favorites.map(t => t.id), reversed);
  assert.throws(() => tabs.reorder('favorite', [reversed[0], reversed[0], reversed[1]]));
  assert.throws(() => tabs.reorder('tab', ['foreign']));
});
test('tabs open, close, restore and keep an appropriate active destination', () => {
  const tabs = new Tabs(emptyProfile()); const a = tabs.add('https://example.com/'); const b = tabs.add('https://example.org/');
  tabs.close(b.id); assert.equal(tabs.state.activeId, a.id); const restored = tabs.restore()!;
  assert.equal(restored.url, b.url); assert.notEqual(restored.id, b.id); assert.equal(restored.lifecycle, 'unloaded');
});
test('automatic discard is favorite-only and fails closed on unsafe lifecycle state', () => {
  const t = destination('https://example.com/', 'favorite'); t.lifecycle = 'loaded'; t.lastActive = 1;
  assert.equal(mayDiscard(t, 'other', false, true, 5, 600001), true);
  for (const patch of [{ id: 'active' }, { audible: true }, { dirty: true }, { protected: true }, { lifecycle: 'loading' as const }, { kind: 'tab' as const }]) assert.equal(mayDiscard({ ...t, ...patch }, 'active', false, true, 5, 600001), false);
  assert.equal(mayDiscard(t, 'other', true, false, 5), false);
  assert.equal(mayDiscard(t, 'other', false, true, 0), false);
  assert.equal(mayDiscard({ ...t, kind: 'tab' }, 'other', false, false, 5), true);
});
test('restoration validates data and lazily restores destinations', () => {
  const p = emptyProfile(); const tabs = new Tabs(p); const t = tabs.add('https://example.com/'); t.lifecycle = 'loaded'; t.dirty = true;
  p.favorites = Array.from({ length: 15 }, (_, i) => destination(`https://s${i}.example/`, 'favorite'));
  const restored = restoreProfile(p); assert.equal(restored.tabs[0].lifecycle, 'unloaded'); assert.equal(restored.tabs[0].dirty, false); assert.equal(restored.favorites.length, 9);
  assert.equal(restoreProfile({ tabs: [{ url: 'javascript:alert(1)' }] }).tabs.length, 0);
  p.settings.restoreSession = false; assert.equal(restoreProfile(p).tabs.length, 0);
});
test('atomic serialized persistence survives repeated flushes and backs up corruption', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'flots-test-')); const filename = path.join(dir, 'session.json');
  const p = emptyProfile(); const store = new ProfileStore(filename, () => p);
  new Tabs(p).add('https://example.com/'); const one = store.flush(); p.settings.layout = 'horizontal'; await Promise.all([one, store.flush()]);
  assert.equal(JSON.parse(await readFile(filename, 'utf8')).settings.layout, 'horizontal');
  assert.equal((await ProfileStore.load(filename)).tabs.length, 1);
  await writeFile(filename, '{invalid'); assert.equal((await ProfileStore.load(filename)).tabs.length, 0); assert.ok((await readdir(dir)).some(n => n.includes('.corrupt-')));
});
test('IPC rejects extra fields, bad settings and untrusted senders', () => {
  for (const a of [{ type: 'shell', path: '/tmp' }, { type: 'new', preload: '/tmp/code' }, { type: 'settings', patch: { downloadPath: '/tmp' } }, { type: 'settings', patch: { discardMinutes: -1 } }, { type: 'settings', patch: { blocker: 'yes' } }, { type: 'overlay', open: 1 }, { type: 'reorder', kind: ['tab'], ids: [] }, { type: 'download', id: 'x', operation: ['open'] }]) assert.throws(() => validateAction(a));
  assert.deepEqual(validateAction({ type: 'settings', patch: { blocker: false } }), { type: 'settings', patch: { blocker: false } });
  const frame = { url: 'file:///ui.html' }; const ui = { mainFrame: frame } as any;
  assert.equal(trustedSender({ sender: ui, senderFrame: frame as any }, ui, frame.url), true);
  assert.equal(trustedSender({ sender: {} as any, senderFrame: frame as any }, ui, frame.url), false);
  assert.equal(trustedSender({ sender: ui, senderFrame: { ...frame } as any }, ui, frame.url), false);
});
test('blocker honors global switch, site exception, main-frame allowance and rules', async () => {
  const s = emptyProfile().settings;
  assert.equal(shouldFilter(s, 'https://example.com/', 'script'), true);
  s.siteExceptions = ['example.com']; assert.equal(shouldFilter(s, 'https://example.com/', 'script'), false);
  s.siteExceptions = []; s.blocker = false; assert.equal(shouldFilter(s, 'https://example.com/', 'script'), false);
  s.blocker = true; assert.equal(shouldFilter(s, 'https://example.com/', 'mainFrame'), false);
  const engine = FiltersEngine.parse(await readFile('assets/network-filters.txt', 'utf8'));
  assert.equal(engine.match(Request.fromRawDetails({ url: 'https://doubleclick.net/ad.js', sourceUrl: 'https://example.com/', type: 'script' })).match, true);
  assert.equal(engine.match(Request.fromRawDetails({ url: 'https://example.com/app.js', sourceUrl: 'https://example.com/', type: 'script' })).match, false);
});
test('download state handles interruption and completion', () => {
  assert.equal(downloadState('completed'), 'completed'); assert.equal(downloadState('cancelled'), 'cancelled'); assert.equal(downloadState('interrupted'), 'interrupted'); assert.equal(downloadState('unknown'), 'interrupted');
});
test('favorite destination and edited display name survive page navigation and restart', () => {
  const p = emptyProfile(); const tabs = new Tabs(p); tabs.add('https://example.com/'); const f = tabs.addFavorite();
  f.name = 'My corner'; f.url = 'https://example.com/another-page'; f.title = 'Page title';
  const restored = restoreProfile(p).favorites[0]; assert.equal(restored.url, 'https://example.com/'); assert.equal(restored.name, 'My corner');
});
test('malformed persisted downloads cannot introduce markup or unsupported states', () => {
  const p = restoreProfile({ downloads: [{ id: '\"><script>', path: '/tmp/a', filename: 'a' }, { id: 'known-id', path: '/tmp/a', filename: 'a', state: '<script>', received: 'bad' }] });
  assert.equal(p.downloads.length, 1); assert.equal(p.downloads[0].state, 'interrupted'); assert.equal(p.downloads[0].received, 0);
});
