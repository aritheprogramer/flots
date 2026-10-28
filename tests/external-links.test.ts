import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalWebURL } from '../src/main/external-links';
import { validateAction } from '../src/shared/validation';
test('OS links accept only bounded credential-free HTTP(S) URLs', () => {
  assert.equal(externalWebURL('https://example.com/a?b=1#test'),'https://example.com/a?b=1#test');
  assert.equal(externalWebURL('http://localhost:1234/'),'http://localhost:1234/');
  for (const input of ['javascript:alert(1)','file:///etc/passwd','data:text/html,test','search words','https://user:pass@example.com','https://example.com/\n',null,'https://example.com/'+ 'a'.repeat(8192)]) assert.equal(externalWebURL(input),null);
});
test('native browsing actions do not accept arbitrary arguments over IPC',()=>{
  for(const type of ['default-browser','print','save-page']) {
    assert.deepEqual(validateAction({type}),{type});
    assert.throws(()=>validateAction({type,path:'/tmp/untrusted'}));
  }
});
