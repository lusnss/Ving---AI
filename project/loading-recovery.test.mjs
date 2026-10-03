import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsLoader} from './operations-live.mjs';
import {createComparisonLoader,parseComparisonSource} from './daily-comparison-live.mjs';
import {createRecoverableRead} from './out/assets/read-recovery.mjs';
import {previewDatabase} from './preview-db.mjs';
const hang=()=>new Promise(()=>{});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const start=Date.parse('2026-10-03T00:00:00Z');
const contractCsv=name=>`ข้อมูล,2026-10-03\nสาขา,,ระยะ,เริ่ม,วันหมดสัญญา,คงเหลือ,สถานะ,ต่อแล้ว\n${name},,1 ปี,2026-01-01,2026-12-31,89,ปกติ,FALSE`;
function comparisonCsv(amount=10){return Array.from({length:12},(_,i)=>{
 const month=i+1,n=new Date(Date.UTC(2026,month,0)).getUTCDate(),head=Array(10).fill('');head[2]='Group';head[4]='Channel';
 const rows=[[...head,...Array.from({length:n},(_,d)=>`${d+1}/${month}/2569`)]];
 for(const group of ['Stand Alone','EVENT','EVENT นอก','Department Stores']){const row=Array(10).fill('');row[2]=group;row[4]=group==='Stand Alone'?'Stand Alone Rama 9':group;rows.push([...row,...Array.from({length:n},()=>amount)]);}
 return rows.map(row=>row.join(',')).join('\n');
}).join('\n');}
function bucket(){const rows=new Map();let n=0;return {rows,async get(key){const item=rows.get(key);return item?{etag:item.etag,json:async()=>JSON.parse(item.body)}:null;},async put(key,body,{onlyIf}={}){const old=rows.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const item={body,etag:String(++n)};rows.set(key,item);return item;}};}
function context(){const jobs=[];return {jobs,waitUntil(p){jobs.push(p);}};}
test('saved operations return before a slow source; background success becomes visible',async()=>{
 const BUCKET=bucket();let clock=start;const load=createOperationsLoader({now:()=>clock});
 const old=await load({BUCKET},'contracts',async()=>new Response(contractCsv('Saved')));clock+=61000;
 const gate=deferred(),ctx=context();let calls=0;
 const fetcher=async()=>{calls++;await gate.promise;return new Response(contractCsv('New'));};
 const cached=await load({BUCKET},'contracts',fetcher,ctx);
 assert.equal(cached.items[0].branch,'Saved');assert.equal(cached.source.online_status,'refreshing');assert.equal(cached.source.fetched_at,old.source.fetched_at);
 await load({BUCKET},'contracts',fetcher,ctx);assert.equal(calls,1);
 gate.resolve();await Promise.all(ctx.jobs);
 const fresh=await load({BUCKET},'contracts',fetcher,ctx);assert.equal(fresh.items[0].branch,'New');assert.equal(fresh.source.online_status,'online');
});
test('comparison cache renders before the source and preserves the successful timestamp',async()=>{
 let clock=start;const BUCKET=bucket(),old=parseComparisonSource(comparisonCsv(10),new Date(clock-60000).toISOString());
 await BUCKET.put('daily-comparison-live.json',JSON.stringify(old));
 const gate=deferred(),ctx=context(),load=createComparisonLoader({now:()=>clock,fetchImpl:async()=>{await gate.promise;return new Response(comparisonCsv(20));}});
 const cached=await load({BUCKET},ctx);assert.equal(cached.records[0].daily[0],10);assert.equal(cached.extractedAt,old.extractedAt);assert.equal(cached.live.status,'refreshing');
 gate.resolve();await Promise.all(ctx.jobs);const fresh=await load({BUCKET},ctx);assert.equal(fresh.records[0].daily[0],20);assert.equal(fresh.live.status,'online');
});
test('all stalled operations stages settle and a forced retry can recover',async()=>{
 for(const stage of ['get','json','fetch','body','put']){
  let stalled=true;const real=bucket();
  const BUCKET={get:key=>stalled&&stage==='get'?hang():stalled&&stage==='json'?Promise.resolve({etag:'a',json:hang}):real.get(key),put:(...args)=>stalled&&stage==='put'?hang():real.put(...args)};
  const fetcher=()=>stalled&&stage==='fetch'?hang():stalled&&stage==='body'?Promise.resolve({ok:true,text:hang}):Promise.resolve(new Response(contractCsv('Recovered')));
  const load=createOperationsLoader({now:()=>start,storageTimeoutMs:10,sourceTimeoutMs:15});
  const before=performance.now();assert.equal((await load({BUCKET},'contracts',fetcher)).source.online_status,'stale',stage);assert(performance.now()-before<300);
  stalled=false;assert.equal((await load({BUCKET,FORCE_DATA_REFRESH:true},'contracts',fetcher)).source.online_status,'online',stage);
 }
});
test('all stalled comparison stages settle, clear pending and allow recovery',async()=>{
 for(const stage of ['get','json','fetch','body','put']){
  let stalled=true;const real=bucket();
  const BUCKET={get:key=>stalled&&stage==='get'?hang():stalled&&stage==='json'?Promise.resolve({etag:'a',json:hang}):real.get(key),put:(...args)=>stalled&&stage==='put'?hang():real.put(...args)};
  const load=createComparisonLoader({now:()=>start,storageTimeoutMs:10,sourceTimeoutMs:15,fetchImpl:()=>stalled&&stage==='fetch'?hang():stalled&&stage==='body'?Promise.resolve({ok:true,text:hang}):Promise.resolve(new Response(comparisonCsv()))});
  const before=performance.now();assert.equal((await load({BUCKET,FORCE_DATA_REFRESH:true})).live.status,'stale',stage);assert(performance.now()-before<300);
  stalled=false;assert.equal((await load({BUCKET,FORCE_DATA_REFRESH:true})).live.status,'online',stage);
 }
});
test('late timed-out comparison fetch cannot replace a newer successful response',async()=>{
 let calls=0;const late=deferred(),BUCKET=bucket();
 const load=createComparisonLoader({sourceTimeoutMs:15,fetchImpl:()=>++calls===1?late.promise:Promise.resolve(new Response(comparisonCsv(20)))});
 await load({BUCKET});assert.equal((await load({BUCKET,FORCE_DATA_REFRESH:true})).records[0].daily[0],20);
 late.resolve(new Response(comparisonCsv(99)));await new Promise(r=>setTimeout(r,5));
 assert.equal((await load({BUCKET})).records[0].daily[0],20);assert.equal((await(await BUCKET.get('daily-comparison-live.json')).json()).records[0].daily[0],20);
});
test('explicit refresh waits for its source even when a background context exists',async()=>{
 const gate=deferred(),ctx=context(),BUCKET=bucket();let done=false;
 const load=createOperationsLoader({now:()=>start});
 const request=load({BUCKET,FORCE_DATA_REFRESH:true},'contracts',async()=>{await gate.promise;return new Response(contractCsv('Fresh'));},ctx).then(result=>{done=true;return result;});
 await new Promise(r=>setTimeout(r,5));assert.equal(done,false);assert.equal(ctx.jobs.length,0);
 gate.resolve();assert.equal((await request).source.online_status,'online');
});
test('Summary first failure rejects, stale reads disable editing, and auth loss clears saved data',async()=>{
 let mode='offline';const data={report:{},comparison:{records:[]},deletedSummaryEvents:[],permissions:{canEdit:true,canApprove:true}};
 const read=createRecoverableRead({timeoutMs:15,fetchImpl:()=>mode==='hang'?hang():Promise.resolve(Response.json(data,{status:mode==='ok'?200:mode==='auth'?401:503}))});
 await assert.rejects(read('/api/summary',{fallback:true}));mode='ok';await read('/api/summary',{fallback:true});mode='hang';
 const old=await read('/api/summary',{fallback:true});assert.equal(old.recovery.stale,true);assert.equal(old.permissions.canEdit,false);
 mode='auth';await assert.rejects(read('/api/summary',{fallback:true}),error=>error.status===401);mode='offline';await assert.rejects(read('/api/summary',{fallback:true}));mode='ok';assert.equal((await read('/api/summary',{fallback:true})).permissions.canEdit,true);
});
test('production Summary and snapshot respond while every upstream fetch is stalled',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=hang;
 const {default:worker}=await import('./dist/server/index.js?loading-regression');
 const env={SESSION_SECRET:'fixture',ADMIN_PASSWORD:'fixture-admin',VIEWER_PASSWORD:'fixture-viewer',DB:previewDatabase(),BUCKET:bucket()};
 try{
  assert.equal((await worker.fetch(new Request('https://example.test/api/summary'),env)).status,401);
  const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:env.VIEWER_PASSWORD})}),env),cookie=login.headers.get('set-cookie').split(';')[0];
  const ctx=context();
  for(const path of ['/api/summary','/api/snapshot']){const before=performance.now(),response=await worker.fetch(new Request('https://example.test'+path,{headers:{cookie}}),env,ctx),data=await response.json();assert.equal(response.status,200);assert(performance.now()-before<1000);if(path.endsWith('summary')){assert.equal(data.comparison.live.status,'refreshing');assert(data.failures.some(s=>s.includes('Event')));assert(Array.isArray(data.deletedSummaryEvents));}}
  await Promise.all(ctx.jobs);
 }finally{globalThis.fetch=originalFetch;env.DB.close();}
});
test('a successful mutation invalidates older in-flight and saved Summary reads',async()=>{
 let mode='saved';const late=deferred(),read=createRecoverableRead({fetchImpl:()=>mode==='pending'?late.promise:Promise.resolve(Response.json({items:[mode]},{status:mode==='offline'?503:200}))});
 await read('/api/summary',{fallback:true});mode='pending';const old=read('/api/summary',{fallback:true});
 read.invalidate('/api/summary');mode='new';await read('/api/summary',{fallback:true});
 late.resolve(Response.json({items:['deleted-event']}));await assert.rejects(old,error=>error.invalidated);
 mode='offline';assert.deepEqual((await read('/api/summary',{fallback:true})).items,['new']);
});
