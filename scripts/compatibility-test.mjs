import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { profile, launch, action, loaded, snapshot, finish, pause } from './test-support.mjs';
const report={date:new Date().toISOString(),checks:[],limits:['Fixture tests do not verify every website, physical printer, camera/microphone, DRM service or iCloud passkey.']};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS',name);};
let pdf;
const server=http.createServer((req,res)=>{
 if(req.url==='/document.pdf'){res.setHeader('Content-Type','application/pdf');res.end(pdf);return;}
 res.setHeader('Content-Type','text/html');res.end(`<title>Everyday ${req.url}</title><h1>Everyday browser fixture</h1><form action="/submitted"><label>Name<input name="name" value="fixture"></label><button>Submit</button></form><input id="upload" type="file"><a target="_blank" href="/new-window">Open link</a>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;const dir=await profile('compatibility');let app;
try{
 const run=await launch(dir);app=run.application;const ui=run.ui;
 await app.evaluate(({app},url)=>{app.emit('open-url',{preventDefault(){}},url);},base);
 await loaded(app);
 check('External OS link opens in the browser', (await snapshot(app)).tabs.some(t=>t.url===base+'/'));
 check('External link reuses the fresh-window placeholder', (await snapshot(app)).tabs.length===1);
 await app.evaluate(({app})=>{app.emit('open-url',{preventDefault(){}},'javascript:alert(1)');app.emit('open-url',{preventDefault(){}},'file:///etc/passwd');});
 check('Unsafe external schemes are rejected',(await snapshot(app)).tabs.length===1);
 await app.evaluate(async()=>globalThis.__flots.views.active().executeJavaScript('document.querySelector("form").requestSubmit()'));
 await pause(200);await loaded(app);
 check('Form navigation submits correctly',(await snapshot(app)).tabs[0].url.includes('/submitted?name=fixture'));
 const page=app.context().pages().find(p=>p.url().startsWith(base));
 check('Real website is available for interaction testing',!!page);
 const file=path.join(dir,'upload-fixture.txt');await writeFile(file,'upload fixture');
 await page.locator('#upload').setInputFiles(file);
 check('File input receives selected file',await page.locator('#upload').evaluate(el=>el.files[0].name==='upload-fixture.txt'&&el.files[0].size===14));
 await page.locator('a').click();await pause(250);await loaded(app);
 check('New-window link opens a controlled tab',(await snapshot(app)).tabs.length===2);
 const destination=path.join(dir,'saved.html');
 await app.evaluate(({dialog},destination)=>{globalThis.__saveDialog=dialog.showSaveDialog;dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});},destination);
 await action(app,{type:'save-page'});
 check('Save Page writes the actual webpage',(await readFile(destination,'utf8')).includes('Everyday browser fixture'));
 await app.evaluate(({dialog})=>{dialog.showSaveDialog=globalThis.__saveDialog;});
 const print=await app.evaluate(async()=>{
   const wc=globalThis.__flots.views.active();const bytes=await wc.printToPDF({});return {pdf:bytes.toString('base64'),sandbox:wc.getLastWebPreferences().sandbox};
 });pdf=Buffer.from(print.pdf,'base64');
 check('Chromium produces a valid PDF',pdf.subarray(0,5).toString()==='%PDF-'&&pdf.length>1000&&print.sandbox);
 await app.evaluate(()=>{const wc=globalThis.__flots.views.active();globalThis.__printOriginal=wc.print;globalThis.__printCalls=0;wc.print=()=>{globalThis.__printCalls++;};});
 await action(app,{type:'print'});
 check('Print action reaches the active page',await app.evaluate(()=>globalThis.__printCalls===1));
 await app.evaluate(()=>{globalThis.__flots.views.active().print=globalThis.__printOriginal;});
 await action(app,{type:'navigate',input:base+'/document.pdf'});await loaded(app);
 check('Inline PDF navigation succeeds',await app.evaluate(()=>globalThis.__flots.views.active().getURL().endsWith('/document.pdf')));
 const before=(await snapshot(app)).tabs.length;
 await app.evaluate(({app},base)=>{for(let i=0;i<3;i++)app.emit('open-url',{preventDefault(){}},`${base}/external-${i}`);},base);
 for(let i=0;i<50;i++){if((await snapshot(app)).tabs.length===before+3)break;await pause(50);}
 check('Burst of external links preserves each URL',(await snapshot(app)).tabs.length===before+3);
 check('Concurrent activation does not create duplicate windows',await app.evaluate(({app,BrowserWindow})=>{app.emit('activate');app.emit('activate');return BrowserWindow.getAllWindows().length===1;}));
 check('Default-browser preference has a functional control',await ui.evaluate(async()=>{const result=await window.flots.act({type:'default-browser'});return !result.ok&&result.error.includes('packaged');}));
 await writeFile('docs/compatibility-results.json',JSON.stringify(report,null,2));
}finally{if(app)await finish(app);server.close();}
