import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {previewDatabase} from './preview-db.mjs';
import {encryptPush,pushAuthorization,pushBase64,pushBytes,pushEndpoint} from './web-push.mjs';
import {handleMobilePush,dispatchMobilePush,revokeMobilePush} from './mobile-push.mjs';
import worker from './dist/server/index.js';
const ua='BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const subscription=(n=1)=>({endpoint:'https://web.push.apple.com/QTestOnly'+n,keys:{p256dh:ua,auth:'BTBZMqHH6r4Tts7J_aSIgg'}});
const identity=role=>({role,userId:role});
const device=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const req=(method='GET',n=1,body={},path='/api/mobile-push',origin='https://example.test')=>new Request('https://example.test'+path,{method,headers:{origin,cookie:'ving_reader='+device(n),'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
async function environment(){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return {DB:previewDatabase(),SESSION_SECRET:'local-test-secret',ADMIN_PASSWORD:'admin-test',VIEWER_PASSWORD:'viewer-test',WEB_PUSH_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.privateKey)),WEB_PUSH_PUBLIC_KEY:pushBase64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),WEB_PUSH_SUBJECT:'https://example.test',pair};}
const enroll=(env,role='admin',n=1)=>handleMobilePush(req('POST',n,{subscription:subscription(n)}),env,identity(role));
async function change(db,id='a'.repeat(32),status='pending'){
 await db.prepare('INSERT INTO web_changes (id,entity,kind,title,status,created_at) VALUES (?,?,?,?,?,?)').bind(id,'web:test','proposal_created','PRIVATE RECORD CONTENT',status,new Date().toISOString()).run();
}
test('aes128gcm matches published RFC 8291 Appendix A byte for byte',async()=>{
 const raw=pushBytes('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
 const publicKey=await crypto.subtle.importKey('raw',raw,{name:'ECDH',namedCurve:'P-256'},true,[]);
 const privateKey=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:pushBase64(raw.slice(1,33)),y:pushBase64(raw.slice(33)),d:'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'},{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const encrypted=await encryptPush(subscription(),'When I grow up, I want to be a watermelon',{keyPair:{publicKey,privateKey},salt:pushBytes('DGv6ra1nlYgDCS1FRnbzlw')});
 assert.equal(pushBase64(encrypted.slice(86)),'8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ');
 assert.equal(new DataView(encrypted.buffer).getUint32(16),4096);
});
test('VAPID signature verifies and is scoped to the push service origin',async()=>{
 const e=await environment();try{
 const header=await pushAuthorization(subscription().endpoint,e);const token=header.match(/t=([^,]+)/)[1];const [h,p,s]=token.split('.');
 assert(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},e.pair.publicKey,pushBytes(s),new TextEncoder().encode(h+'.'+p)));
 assert.equal(JSON.parse(new TextDecoder().decode(pushBytes(p))).aud,'https://web.push.apple.com');
 }finally{e.DB.close();}
});
test('enrollment requires login and same origin; rejects SSRF and malformed curve keys',async()=>{
 const e=await environment();try{
 assert.equal((await handleMobilePush(req(),e,null)).status,401);
 assert.equal((await handleMobilePush(req('POST',1,{subscription:subscription()},'/api/mobile-push','https://evil.test'),e,identity('admin'))).status,403);
 for(const endpoint of ['http://web.push.apple.com/x','https://127.0.0.1/x','https://web.push.apple.com.evil.test/x','https://web.push.apple.com:444/x','https://web.push.apple.com@evil.test/x'])assert.throws(()=>pushEndpoint(endpoint));
 const bad=subscription();bad.keys.p256dh=pushBase64(new Uint8Array(65).fill(4));assert.equal((await handleMobilePush(req('POST',1,{subscription:bad}),e,identity('admin'))).status,400);
 assert.equal((await enroll(e)).status,200);const status=await (await handleMobilePush(req(),e,identity('admin'))).json();assert.equal(status.enabled,true);assert(!JSON.stringify(status).includes(e.WEB_PUSH_PRIVATE_JWK));
 }finally{e.DB.close();}
});

test('Business Development can enroll push with an account tag that changes with its own password',async()=>{
 const e=await environment();e.BUSINESS_DEVELOPMENT_PASSWORD='business-test';
 const business={role:'assistant',userId:'business-development-1'};
 try{
  const response=await handleMobilePush(req('POST',1,{subscription:subscription()}),e,business);
  assert.equal(response.status,200,await response.text());
  const stored=await e.DB.prepare('SELECT user_id,role,account_tag FROM mobile_push_subscriptions').first();
  assert.equal(stored.user_id,business.userId);assert.equal(stored.role,'assistant');assert.ok(stored.account_tag);
  assert.equal((await(await handleMobilePush(req(),e,business)).json()).enabled,true);
  e.BUSINESS_DEVELOPMENT_PASSWORD='changed-business-test';
  assert.equal((await(await handleMobilePush(req(),e,business)).json()).enabled,false);
 }finally{e.DB.close();}
});
test('only future events send, viewer sees approved events, repeated/concurrent dispatch does not duplicate',async()=>{
 const e=await environment();try{
 await change(e.DB,'0'.repeat(32));await enroll(e);await enroll(e,'viewer',2);
 const sent=[];const send=async(url,options)=>{sent.push(url);assert.equal(options.headers['content-encoding'],'aes128gcm');assert(!new TextDecoder().decode(options.body).includes('PRIVATE RECORD'));return new Response(null,{status:201});};
 await dispatchMobilePush(e,send);assert.equal(sent.length,0);
 await change(e.DB);await Promise.all([dispatchMobilePush(e,send),dispatchMobilePush(e,send)]);assert.deepEqual(sent,[subscription().endpoint]);
 await dispatchMobilePush(e,send);assert.equal(sent.length,1);
 await e.DB.prepare("UPDATE web_changes SET status='approved',decided_at=? WHERE id=?").bind(new Date(Date.now()+10).toISOString(),'a'.repeat(32)).run();
 await dispatchMobilePush(e,send);assert.equal(sent.length,3);assert(sent.includes(subscription(2).endpoint));
 }finally{e.DB.close();}
});
test('failed sends stay queued; expired endpoint removed; password change and logout revoke delivery',async()=>{
 const e=await environment();try{
 await enroll(e);await change(e.DB);await dispatchMobilePush(e,async()=>new Response(null,{status:503}));assert.equal((await e.DB.prepare('SELECT last_event FROM mobile_push_subscriptions').first()).last_event,0);
 let sent=0;await dispatchMobilePush(e,async()=>{sent++;return new Response(null,{status:201});});assert.equal(sent,1);
 await change(e.DB,'b'.repeat(32));await dispatchMobilePush(e,async()=>new Response(null,{status:410}));assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM mobile_push_subscriptions').first()).n,0);
 await enroll(e);e.ADMIN_PASSWORD='changed';await change(e.DB,'c'.repeat(32));await dispatchMobilePush(e,async()=>{throw Error('must not send');});assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM mobile_push_subscriptions').first()).n,0);
 await enroll(e);await revokeMobilePush(e,req());assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM mobile_push_subscriptions').first()).n,0);
 }finally{e.DB.close();}
});
test('database rollback also rolls back queued events',async()=>{
 const e=await environment();try{
 const insert=()=>e.DB.prepare("INSERT INTO web_changes (id,entity,kind,title,status,created_at) VALUES ('same','web:test','proposal_created','test','pending','now')");
 await assert.rejects(e.DB.batch([insert(),insert()]));assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM mobile_push_events').first()).n,0);
 }finally{e.DB.close();}
});
test('public worker/manifest/icons are reachable after session expiry; protected APIs remain gated',async()=>{
 const e=await environment();try{
 for(const path of ['/sw.js','/manifest.webmanifest','/assets/push-icon-192.png','/assets/push-icon-512.png']){const r=await worker.fetch(new Request('https://example.test'+path),e);assert.equal(r.status,200,path);}
 assert.equal((await worker.fetch(new Request('https://example.test/api/mobile-push'),e)).status,401);
 const manifest=await (await worker.fetch(new Request('https://example.test/manifest.webmanifest'),e)).json();assert.equal(manifest.display,'standalone');
 const r=await worker.fetch(new Request('https://example.test/sw.js'),e);assert.match(r.headers.get('content-type'),/javascript/);assert.equal(r.headers.get('service-worker-allowed'),'/');
 }finally{e.DB.close();}
});
test('service worker always displays a notification without fetching a session and rejects external click URLs',async()=>{
 const handlers={},shown=[],opened=[];
 const self={location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,opts)=>shown.push({title,...opts})},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(await readFile(new URL('./out/sw.js',import.meta.url),'utf8'),{self,URL});
 let task;handlers.push({data:{json:()=>({body:'test',url:'https://evil.test'})},waitUntil:p=>task=p});await task;assert.equal(shown.length,1);assert.equal(shown[0].data.url,'/daily-sales?notifications=1');
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test'}},waitUntil:p=>task=p});await task;assert.equal(opened[0],'https://example.test/daily-sales?notifications=1');
});
test('HTTP mutation sends in waitUntil after the record is committed; viewer can enroll its own device',async()=>{
 const e=await environment(),originalFetch=globalThis.fetch,tasks=[];
 try{
  async function signed(role,n,method,path,body={}){
   const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:role==='admin'?e.ADMIN_PASSWORD:e.VIEWER_PASSWORD})}),e);
   const request=req(method,n,body,path);request.headers.set('cookie',login.headers.get('set-cookie').split(';')[0]+'; ving_reader='+device(n));return request;
  }
  await e.DB.prepare("INSERT INTO web_changes (id,entity,kind,title,status,created_at) VALUES (?,'contract:test','contract_updated','test','pending','2026-09-25T00:00:00.000Z')").bind('f'.repeat(32)).run();
  const enrolled=await worker.fetch(await signed('viewer',2,'POST','/api/mobile-push',{subscription:subscription(2)}),e);assert.equal(enrolled.status,200);
  let sent=0;globalThis.fetch=async(url)=>{assert.equal(url,subscription(2).endpoint);assert.equal((await e.DB.prepare('SELECT status FROM web_changes WHERE id=?').bind('f'.repeat(32)).first()).status,'approved');sent++;return new Response(null,{status:201});};
  const response=await worker.fetch(await signed('admin',1,'PATCH','/api/notifications/decision',{id:'f'.repeat(32),status:'approved'}),e,{waitUntil:task=>tasks.push(task)});
  assert.equal(response.status,200);assert.equal(tasks.length,1);await Promise.all(tasks);assert.equal(sent,1);
 }finally{globalThis.fetch=originalFetch;e.DB.close();}
});
