import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { profile, launch, action, snapshot, finish, pause } from './test-support.mjs';
const report={date:new Date().toISOString(),checks:[]};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS',name);};
const dir=await profile('interaction');let app;
try{
 const run=await launch(dir);app=run.application;const ui=run.ui;
 await action(app,{type:'new'});await pause(100);
 const ids=(await snapshot(app)).tabs.map(t=>t.id);
 await ui.evaluate(()=>{window.__tabNodes=[...document.querySelectorAll('#horizontal-tabs .tab')];});
 for(let i=0;i<10;i++)await action(app,{type:'activate',id:ids[i%2]});
 await pause(100);
 check('Tab DOM nodes survive switching',await ui.evaluate(()=>window.__tabNodes.every((n,i)=>n===document.querySelectorAll('#horizontal-tabs .tab')[i])));
 await app.evaluate(()=>{const b=globalThis.__flots;globalThis.__scheduleCount=0;const original=b.store.schedule.bind(b.store);b.store.schedule=()=>{globalThis.__scheduleCount++;original();};});
 for(const a of [{type:'overlay',open:true},{type:'overlay',open:false},{type:'find',text:'',forward:true},{type:'find-stop'},{type:'focus-page'},{type:'memory-refresh'}])await action(app,a);
 check('Transient controls do not schedule session disk writes',await app.evaluate(()=>globalThis.__scheduleCount===0));
 await ui.emulateMedia({reducedMotion:'no-preference'});
 await app.evaluate(()=>globalThis.__flots.command('settings'));
 await ui.locator('.modal').waitFor();
 check('Opening panels use a short transform/opacity animation',await ui.locator('.modal').evaluate(el=>getComputedStyle(el).animationName==='panel-enter'&&parseFloat(getComputedStyle(el).animationDuration)<=.2));
 await ui.locator('.dismiss').click();await ui.locator('#modal-root').waitFor({state:'hidden'});
 check('Closing panel releases inert controls',await ui.locator('#toolbar').evaluate(el=>!el.inert));
 await ui.emulateMedia({reducedMotion:'reduce'});
 await app.evaluate(()=>globalThis.__flots.command('settings'));await ui.locator('.modal').waitFor();
 check('Reduce Motion disables panel and hover animation',await ui.locator('.modal').evaluate(el=>getComputedStyle(el).animationName==='none')&&await ui.locator('.dismiss').evaluate(el=>getComputedStyle(el).transitionDuration==='0s'));
 await ui.locator('.dismiss').click();await ui.locator('#modal-root').waitFor({state:'hidden'});
 // Interrupt a close with another panel opening; no stale callback may hide it.
 await ui.emulateMedia({reducedMotion:'no-preference'});
 await app.evaluate(()=>globalThis.__flots.command('settings'));await ui.locator('.modal').waitFor();
 await ui.locator('.dismiss').click();await app.evaluate(()=>globalThis.__flots.command('downloads'));await pause(250);
 check('Rapid panel changes preserve the newest panel',await ui.locator('.modal').isVisible()&&(await ui.locator('.modal').innerText()).includes('Downloads'));
 await ui.locator('.dismiss').click();await ui.locator('#modal-root').waitFor({state:'hidden'});
 check('Finished transitions leave no running animations',await ui.evaluate(()=>document.getAnimations().length===0));
 check('Chrome interactions create no page renderer',await app.evaluate(()=>globalThis.__flots.views.live.size===0));
 await writeFile('docs/interaction-results.json',JSON.stringify(report,null,2));
}finally{if(app)await finish(app);}
