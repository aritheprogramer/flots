import assert from 'node:assert/strict';
import http from 'node:http';
import { writeFile } from 'node:fs/promises';
import { profile, launch, action, loaded, snapshot } from './test-support.mjs';
const report = { date:new Date().toISOString(), checks:[], observations:{} };
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS',name);};
let assetRequests=0;
const server=http.createServer((req,res)=>{
  if(req.url==='/login'){res.setHeader('Set-Cookie',['remember=fixture-login; Max-Age=86400; HttpOnly; SameSite=Lax; Path=/','sessionOnly=temporary; HttpOnly; SameSite=Lax; Path=/']);res.end('signed in');return;}
  if(req.url==='/logout'){res.setHeader('Set-Cookie','remember=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/');res.end('signed out');return;}
  if(req.url==='/auth'){res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({authenticated:(req.headers.cookie||'').includes('remember=fixture-login')}));return;}
  if(req.url==='/asset'){assetRequests++;res.setHeader('Cache-Control','public, max-age=86400');res.end('cache-resource-'+ 'x'.repeat(65536));return;}
  if(req.url==='/worker.js'){res.setHeader('Content-Type','text/javascript');res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));");return;}
  res.setHeader('Content-Type','text/html');res.end('<title>Storage fixture</title><h1>Local account fixture</h1>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;const dir=await profile('storage');let app;
const page=code=>app.evaluate(async(_e,code)=>globalThis.__flots.views.active().executeJavaScript(code),code);
async function quit(){const closing=app.waitForEvent('close');await app.evaluate(({app})=>app.quit());await closing;app=undefined;}
try{
  ({application:app}=await launch(dir));await action(app,{type:'navigate',input:base});await loaded(app);
  check('Fixture account starts logged out',!(await page("fetch('/auth').then(r=>r.json())")).authenticated);
  await page(`(async()=>{
    localStorage.setItem('flots-fixture','durable');sessionStorage.setItem('flots-fixture','ephemeral');
    await new Promise((resolve,reject)=>{const r=indexedDB.open('flots-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('records','readwrite');tx.objectStore('records').put('durable','key');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};});
    const cache=await caches.open('flots-fixture');await cache.put('/offline',new Response('offline-durable'));
    await navigator.serviceWorker.register('/worker.js');await navigator.serviceWorker.ready;
    await fetch('/asset').then(r=>r.text());await fetch('/login');return true;
  })()`);
  check('Server recognizes the fixture login', (await page("fetch('/auth').then(r=>r.json())")).authenticated);
  check('Login cookie is HttpOnly',!(await page('document.cookie')).includes('remember='));
  const before=await snapshot(app);const initialRequests=assetRequests;
  // Exercise the actual Quit handler. No test-only cookie/storage flush is used.
  await quit();
  ({application:app}=await launch(dir));await loaded(app);
  check('Remembered login survives immediate full quit and relaunch',(await page("fetch('/auth').then(r=>r.json())")).authenticated);
  check('Local storage survives relaunch',await page("localStorage.getItem('flots-fixture')")==='durable');
  check('IndexedDB transaction survives relaunch',await page(`new Promise((resolve,reject)=>{const r=indexedDB.open('flots-fixture',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('records');const q=tx.objectStore('records').get('key');q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();};})`)==='durable');
  check('Cache Storage survives relaunch',await page("caches.open('flots-fixture').then(c=>c.match('/offline')).then(r=>r?.text())")==='offline-durable');
  check('Service worker registration survives relaunch',await page("navigator.serviceWorker.getRegistration().then(r=>!!r?.active)"));
  await page("fetch('/asset').then(r=>r.text())");check('Fresh HTTP cache reused across relaunch',assetRequests===initialRequests);
  check('Only active page is restored',await app.evaluate(()=>globalThis.__flots.views.live.size===1));
  check('Tab metadata persists', (await snapshot(app)).activeId===before.activeId);
  report.observations.sessionCookieSurvived=await app.evaluate(async()=>!!(await globalThis.__flots.profileSession.cookies.get({name:'sessionOnly'})).length);
  report.observations.sessionStorage=await page("sessionStorage.getItem('flots-fixture')");
  check('sessionStorage is not misrepresented as durable', report.observations.sessionStorage===null);
  await page("fetch('/logout')");await quit();
  ({application:app}=await launch(dir));await loaded(app);
  check('Logout remains effective after another relaunch',!(await page("fetch('/auth').then(r=>r.json())")).authenticated);
  check('Cached data remains independent of account logout',await page("localStorage.getItem('flots-fixture')")==='durable');
  await quit();await writeFile('docs/storage-results.json',JSON.stringify(report,null,2));
}finally{if(app){await quit().catch(()=>app?.process().kill());}server.close();}
