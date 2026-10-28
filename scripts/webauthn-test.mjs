import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { profile, launch, action, loaded, finish } from './test-support.mjs';
const report={date:new Date().toISOString(),method:'Chromium CDP virtual CTAP2 USB authenticator, test-only. Native sheets are stubbed only in this test. This does NOT test iCloud, Google account login, Touch ID or a physical security key.',checks:[]};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS',name);};
const dir=await profile('webauthn');let app;
const page=code=>app.evaluate(async(_e,code)=>globalThis.__flots.views.active().executeJavaScript(code,true),code);
try{
  ({application:app}=await launch(dir));await action(app,{type:'navigate',input:'https://example.com/'});await loaded(app);
  check('Unsigned build does not falsely advertise native iCloud passkeys',await page('PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()')===false);
  await app.evaluate(async({dialog})=>{
    globalThis.__dialogOriginal=dialog.showMessageBox;globalThis.__accountPrompts=0;
    dialog.showMessageBox=async()=>{globalThis.__accountPrompts++;return {response:1,checkboxChecked:false};};
    const wc=globalThis.__flots.views.active();wc.debugger.attach('1.3');await wc.debugger.sendCommand('WebAuthn.enable');
    globalThis.__authenticator=await wc.debugger.sendCommand('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'usb',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  });
  const registration=await page(`(async()=>{const c=await navigator.credentials.create({publicKey:{challenge:new Uint8Array(32).fill(7),rp:{id:'example.com',name:'Flots test'},user:{id:new Uint8Array([1,2,3]),name:'fixture@example.com',displayName:'Fixture'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},timeout:10000}});const b=x=>Array.from(new Uint8Array(x));return {id:c.id,publicKey:b(c.response.getPublicKey()),clientData:b(c.response.clientDataJSON)};})()`);
  check('Chromium creates a resident credential',!!registration.id&&registration.publicKey.length>0);
  const assertion=await page(`(async()=>{const c=await navigator.credentials.get({publicKey:{challenge:new Uint8Array(32).fill(9),rpId:'example.com',userVerification:'required',timeout:10000}});const b=x=>Array.from(new Uint8Array(x));return {id:c.id,authenticatorData:b(c.response.authenticatorData),clientData:b(c.response.clientDataJSON),signature:b(c.response.signature)};})()`);
  const client=Buffer.from(assertion.clientData);const decoded=JSON.parse(client);const auth=Buffer.from(assertion.authenticatorData);
  check('Discoverable credential signs in with selected account',assertion.id===registration.id);
  check('Account chooser is connected',await app.evaluate(()=>globalThis.__accountPrompts)>0);
  check('Assertion challenge and origin match',decoded.challenge===Buffer.alloc(32,9).toString('base64url')&&decoded.origin==='https://example.com'&&decoded.type==='webauthn.get');
  check('RP hash, user presence and verification flags preserved',auth.subarray(0,32).equals(createHash('sha256').update('example.com').digest())&&(auth[32]&5)===5);
  check('Assertion signature verifies with registration public key',verify('sha256',Buffer.concat([auth,createHash('sha256').update(client).digest()]),createPublicKey({key:Buffer.from(registration.publicKey),format:'der',type:'spki'}),Buffer.from(assertion.signature)));
  check('Unrelated relying party rejected',await page(`navigator.credentials.get({publicKey:{challenge:new Uint8Array(32),rpId:'unrelated.invalid',timeout:1000}}).then(()=>false,e=>e.name==='SecurityError')`));
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0,checkboxChecked:false});});
  check('Cancel chooser rejects credential request',await page(`navigator.credentials.get({publicKey:{challenge:new Uint8Array(32),rpId:'example.com',timeout:10000}}).then(()=>false,e=>e.name==='NotAllowedError')`));
  check('Null request frame is cancelled exactly once',await app.evaluate(async()=>{let calls=0,value;await globalThis.__flots.profileSession.listeners('select-webauthn-account')[0]({}, {frame:null,relyingPartyId:'example.com',accounts:[{credentialId:'fake'}]},v=>{calls++;value=v});return calls===1&&value===undefined;}));
  await app.evaluate(async({dialog})=>{dialog.showMessageBox=globalThis.__dialogOriginal;const wc=globalThis.__flots.views.active();await wc.debugger.sendCommand('WebAuthn.removeVirtualAuthenticator',globalThis.__authenticator);wc.debugger.detach();});
  await writeFile('docs/webauthn-results.json',JSON.stringify(report,null,2));
}finally{if(app){await app.evaluate(({dialog})=>{if(globalThis.__dialogOriginal)dialog.showMessageBox=globalThis.__dialogOriginal;}).catch(()=>{});await finish(app);}}
