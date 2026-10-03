import test from 'node:test';
import assert from 'node:assert/strict';
import {handleWorkspaceDrafts} from './workspace-drafts.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';
import {uploadEventImage,readEventImage} from './event-images.mjs';
const origin='https://draft.test',scope='/promotions';
const identity={userId:'assistant-1',role:'assistant'},permissions={canEdit:true,canApprove:false};
const value=(text='unfinished',revision=null)=>({saveId:crypto.randomUUID(),revision,payload:{version:1,adapters:{promotion:{work:{name:text,selected:[{key:'sample',qty:7}],pricing:[['sample',{pricingMode:'price',salePrice:255}]]}}},fields:{}}});
const request=(input,options={})=>new Request(origin+'/api/workspace-drafts?scope='+encodeURIComponent(options.scope||scope)+(options.history?'&history=1':''),input?{method:'PUT',headers:{origin:options.origin||origin,'content-type':'application/json'},body:JSON.stringify(input)}:{});
test('incomplete drafts survive fresh requests, stay isolated by account/page, never submit records',async()=>{
 const DB=previewDatabase(),env={DB};try{
  const input=value();assert.equal((await handleWorkspaceDrafts(request(input),env,identity,permissions)).status,200);
  const draft=(await (await handleWorkspaceDrafts(request(),env,identity,permissions)).json()).draft;
  assert.deepEqual(draft.payload,input.payload);
  assert.equal((await (await handleWorkspaceDrafts(request(),env,{userId:'assistant-2'},permissions)).json()).draft,null);
  assert.equal((await (await handleWorkspaceDrafts(request(null,{scope:'/activities'}),env,identity,permissions)).json()).draft,null);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM promotion_plans').first()).n,0);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM web_changes').first()).n,0);
 }finally{DB.close();}
});
test('compare-and-swap rejects stale tabs, retries are idempotent, reset retains previous payload',async()=>{
 const DB=previewDatabase(),env={DB};try{
  const first=value(),second=value('after reset',first.saveId);
  await handleWorkspaceDrafts(request(first),env,identity,permissions);
  await handleWorkspaceDrafts(request(second),env,identity,permissions);
  assert.equal((await handleWorkspaceDrafts(request(second),env,identity,permissions)).status,200);
  assert.equal((await handleWorkspaceDrafts(request(value('stale',first.saveId)),env,identity,permissions)).status,409);
  const history=await (await handleWorkspaceDrafts(request(null,{history:true}),env,identity,permissions)).json();
  assert.equal(history.items.length,2);assert.deepEqual(history.items[1].payload,first.payload);
 }finally{DB.close();}
});
test('simultaneous first saves preserve one head and reject the other tab',async()=>{
 const DB=previewDatabase(),env={DB};try{
  const batch=DB.batch.bind(DB);let queue=Promise.resolve();DB.batch=statements=>{const result=queue.then(()=>batch(statements));queue=result.catch(()=>{});return result;};
  const results=await Promise.all([value('a'),value('b')].map(v=>handleWorkspaceDrafts(request(v),env,identity,permissions)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM workspace_draft_history').first()).n,1);
 }finally{DB.close();}
});
test('history bounded to 30; malformed, oversized, cross-origin and view-only writes rejected',async()=>{
 const DB=previewDatabase(),env={DB};try{
  let revision=null;
  for(let i=0;i<32;i++){const input=value(String(i),revision);assert.equal((await handleWorkspaceDrafts(request(input),env,identity,permissions)).status,200);revision=input.saveId;}
  const history=await (await handleWorkspaceDrafts(request(null,{history:true}),env,identity,permissions)).json();assert.equal(history.items.length,30);
  assert.equal((await handleWorkspaceDrafts(request(value()),env,identity,{canEdit:false})).status,403);
  assert.equal((await handleWorkspaceDrafts(request(value(),{origin:'https://other.test'}),env,identity,permissions)).status,403);
  assert.equal((await handleWorkspaceDrafts(request({...value(),saveId:'bad'}),env,identity,permissions)).status,400);
  assert.equal((await handleWorkspaceDrafts(request(value('a'.repeat(510000))),env,identity,permissions)).status,413);
  assert.equal((await handleWorkspaceDrafts(request(),{},identity,permissions)).status,503);
 }finally{DB.close();}
});
test('worker enforces authentication for drafts and keeps private image drafts owner-only',async()=>{
 const DB=previewDatabase(),objects=new Map();
 const env={DB,SESSION_SECRET:'test-only',ADMIN_PASSWORD:'test-admin',VIEWER_PASSWORD:'test-viewer',BUCKET:{async put(key,bytes,options){objects.set(key,{...options,body:bytes,size:bytes.length});},async get(key){return objects.get(key);}}};
 try{
  assert.equal((await worker.fetch(request(),env)).status,401);
  const login=await worker.fetch(new Request(origin+'/login',{method:'POST',body:new URLSearchParams({password:'test-admin'})}),env),cookie=login.headers.get('set-cookie').split(';')[0];
  const req=request(value());req.headers.set('cookie',cookie);assert.equal((await worker.fetch(req,env)).status,200);
  const id=crypto.randomUUID(),png=Uint8Array.from([137,80,78,71,13,10,26,10,0]);
  const image=await uploadEventImage(new Request(origin+'/api/event-images/'+id,{method:'POST',headers:{origin,'content-type':'image/png'},body:png}),env,id,'assistant-1');
  assert.equal((await readEventImage(env,id,image.id,'GET','assistant-1')).status,200);
  await assert.rejects(readEventImage(env,id,image.id,'GET','assistant-2'),{status:404});
 }finally{DB.close();}
});
