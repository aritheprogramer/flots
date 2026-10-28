import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import { profile, launch, action, loaded, snapshot, finish, pause } from './test-support.mjs';
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<title>Response fixture ${req.url}</title><h1>Lightweight page</h1>`); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const dir = await profile('response'); let app;
try {
  const run = await launch(dir); app = run.application; const ui = run.ui;
  await action(app, { type: 'navigate', input: base }); await loaded(app);
  await action(app, { type: 'new', url: `${base}/second` }); await loaded(app); await pause(200);
  const ids = (await snapshot(app)).tabs.map(t => t.id);
  const samples = [];
  const memory = async () => { const rows = []; for (let i = 0; i < 3; i++) { await pause(1000); rows.push(await app.evaluate(({app}) => ({ residentMiB: app.getAppMetrics().reduce((n,p) => n+p.memory.workingSetSize/1024,0), liveViews: globalThis.__flots.views.live.size }))); } return rows; };
  const before = await memory();
  for (let i = 0; i < 60; i++) {
    samples.push(await ui.evaluate(id => new Promise((resolve,reject) => {
      const selector = `#horizontal-tabs [data-id="${id}"] .tab-select`;
      const start = performance.now();
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Tab feedback timed out')); }, 3000);
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)?.getAttribute('aria-selected') === 'true') {
          observer.disconnect(); clearTimeout(timer); requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()-start)));
        }
      });
      observer.observe(document.querySelector('#horizontal-tabs'), { subtree:true, attributes:true, childList:true });
      document.querySelector(selector).click();
    }), ids[i%2]));
  }
  const after = await memory();
  const retained = await ui.evaluate(async () => {
    const row = document.querySelector('#horizontal-tabs .tab'); const input = document.querySelector('#address');
    await window.flots.act({type:'memory-refresh'}); await new Promise(r=>setTimeout(r,150));
    return { tabNode: row === document.querySelector('#horizontal-tabs .tab'), addressNode: input === document.querySelector('#address') };
  });
  const sorted = [...samples].sort((a,b)=>a-b);
  const report = {date:new Date().toISOString(),version:await app.evaluate(({app})=>app.getVersion()),method:'60 alternating clicks on two loaded local pages; click to selected-tab DOM update plus two animation frames. Actual Chromium views retained. Three 1-second-apart process RSS sums before/after; shared memory can be counted twice; not unique RAM or a controlled whole-system benchmark.',latencyMs:{median:sorted[30],p95:sorted[56],min:sorted[0],max:sorted.at(-1),samples},memory:{before,after},retained};
  assert.ok(after.every(s=>s.liveViews===2));
  if (process.env.FLOTS_RESPONSE_OUTPUT) await writeFile(process.env.FLOTS_RESPONSE_OUTPUT,JSON.stringify(report,null,2));
  else await writeFile('docs/responsiveness-results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,latencyMs:{...report.latencyMs,samples:undefined}},null,2));
} finally {if(app)await finish(app);server.close();}
