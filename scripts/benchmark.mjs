import { writeFile } from 'node:fs/promises';
import { profile, launch, action, loaded, snapshot, finish, pause } from './test-support.mjs';
const dir = await profile('benchmark');
let { application: app } = await launch(dir);
const report = { date: new Date().toISOString(), platform: process.platform, arch: process.arch, versions: (await snapshot(app)).versions, method: 'app.getAppMetrics(): summed per-process resident workingSetSize / 1024, MiB; includes shared-memory double counting; three samples 5s apart after 5s settling. No claim of unique physical footprint.', scenarios: [] };
async function sample(name, notes, urls = []) {
  await pause(5000); const samples = [];
  for (let i = 0; i < 3; i++) {
    samples.push(await app.evaluate(({ app }) => {
      const processes = app.getAppMetrics().map(p => ({ pid: p.pid, type: p.type, residentMiB: p.memory.workingSetSize / 1024, cpu: p.cpu.percentCPUUsage }));
      return { at: new Date().toISOString(), residentMiB: processes.reduce((n, p) => n + p.residentMiB, 0), processes, liveViews: globalThis.__flots.views.live.size };
    })); if (i < 2) await pause(5000);
  }
  const entry = { name, notes, urls, samples }; report.scenarios.push(entry); console.log(name, samples.map(s => Math.round(s.residentMiB)), 'MiB; views:', samples[0].liveViews);
}
try {
  await sample('A', 'Empty new tab; no external site loaded.');
  await action(app, { type: 'navigate', input: 'https://example.com/' }); await loaded(app);
  await sample('B', 'One lightweight HTTPS page.', ['https://example.com/']);
  // Favorites are saved without creating renderer instances.
  await app.evaluate(() => { const b = globalThis.__flots; const original = b.tabs.get(); const urls = ['https://example.com/', 'https://www.wikipedia.org/', 'https://developer.mozilla.org/', 'https://www.electronjs.org/', 'https://www.rfc-editor.org/', 'https://github.com/', 'https://www.nasa.gov/', 'https://www.bbc.com/', 'https://www.gnu.org/']; for (const url of urls) { const t = b.tabs.add(url); b.tabs.addFavorite(); b.tabs.close(t.id); } b.tabs.activate(original.id); });
  const first = await snapshot(app);
  await action(app, { type: 'activate', id: first.favorites[0].id }); await loaded(app);
  await action(app, { type: 'close', id: first.tabs[0].id });
  await sample('D', 'Nine favorite records saved; only the first favorite loaded. No regular tabs.', ['https://example.com/']);
  await action(app, { type: 'new', url: 'https://example.com/' }); await loaded(app);
  await action(app, { type: 'discard', id: first.favorites[0].id });
  const urls = ['https://example.com/', 'https://www.wikipedia.org/', 'https://developer.mozilla.org/', 'https://www.electronjs.org/', 'https://www.rfc-editor.org/'];
  const failures = [];
  for (const url of urls.slice(1)) { await action(app, { type: 'new', url }); try { await loaded(app); } catch (error) { failures.push(`${url}: ${error.message}`); } }
  await sample('C', `Five sites requested. ${failures.length ? `Failures: ${failures.join('; ')}` : 'All loaded.'}`, urls);
  const tabs = (await snapshot(app)).tabs;
  for (let round = 0; round < 20; round++) for (const t of tabs) { await action(app, { type: 'activate', id: t.id }); await pause(100); }
  await sample('G', '100 switches across five loaded pages; compare to C. Short-run check only, not a leak-proof result.', urls);
  for (const t of tabs.slice(0, -1)) await action(app, { type: 'discard', id: t.id });
  await sample('E', 'Four inactive regular tabs manually discarded; active page retained.', [urls.at(-1)]);
  await finish(app); app = undefined;
  ({ application: app } = await launch(dir)); await loaded(app);
  await sample('F', 'Restart populated session with five tabs and nine favorites; only active destination loaded.', [urls.at(-1)]);
  await writeFile('docs/benchmark-results.json', JSON.stringify(report, null, 2));
} finally { if (app) await finish(app); }
