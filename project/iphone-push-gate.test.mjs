import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {requiresIPhonePush} from './out/assets/mobile-push-policy.mjs';
import worker from './dist/server/index.js';
const cases=[
 ['iPhone from Home Screen','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',true,false,true],
 ['iPhone standalone media query','iPhone',false,true,true],
 ['iPhone Safari tab','iPhone',false,false,false],
 ['Android PWA','Linux; Android 15',true,true,false],
 ['iPad PWA','iPad; CPU OS 18_0',true,true,false],
 ['desktop browser','Macintosh; Intel Mac OS X',false,false,false],
 ['desktop installed app','Macintosh; Intel Mac OS X',true,true,false],
];
test('mandatory enrollment is limited to iPhone Home Screen launches',()=>{
 for(const [label,userAgent,standalone,displayStandalone,expected] of cases)assert.equal(requiresIPhonePush({userAgent,standalone,displayStandalone}),expected,label);
});
test('every account and main/prediction route receives the same gate, while login stays usable',async()=>{
 const env={SESSION_SECRET:'test-only',ADMIN_PASSWORD:'test-admin',VIEWER_PASSWORD:'test-viewer',ASSISTANT_PASSWORD_1:'test-assistant'};
 for(const password of ['test-admin','test-viewer','test-assistant']){
  const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  for(const path of ['/daily-sales','/contracts','/event-predict']){
   const response=await worker.fetch(new Request('https://example.test'+path,{headers:{cookie}}),env);
   const html=await response.text();assert.equal(response.status,200);assert.match(html,/iphone-push-gate.css/);
   const bootstrap=html.match(/<script>(if\(\/iPhone\/[\s\S]+?)<\/script>/)?.[1];assert(bootstrap);
   for(const [label,userAgent,standalone,displayStandalone,expected] of cases){
    let gated=false;
    vm.runInNewContext(bootstrap,{navigator:{userAgent,standalone},matchMedia:()=>({matches:displayStandalone}),document:{documentElement:{setAttribute:()=>{gated=true;}}}});
    assert.equal(gated,expected,password+' '+path+' '+label);
   }
  }
 }
 const login=await worker.fetch(new Request('https://example.test/login'),env);assert.doesNotMatch(await login.text(),/data-iphone-push-gated/);
});
