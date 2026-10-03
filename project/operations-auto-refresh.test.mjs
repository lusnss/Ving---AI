import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsLoader,applyOperations,latestOperation} from './operations-live.mjs';
const start=Date.parse('2026-10-03T00:00:00Z');
const contractCsv=(branch='Test Branch')=>`ข้อมูล,2026-10-03\nสาขา,,ระยะ,เริ่ม,วันหมดสัญญา,คงเหลือ,สถานะ,ต่อแล้ว\n${branch},,1 ปี,2026-01-01,2026-12-31,89,ปกติ,FALSE`;
const eventCsv={
 '1054560136':'a,venue,c,event,date,month,sales\n1,Test Venue,,Test Event,2025-01-01,มกราคม,123',
 '1703349575':'มกราคม\n1,Test Direct',
 '2066169026':'มกราคม\n1,Test GP'
};
function bucket(){
 const values=new Map();let revision=0;
 return {values,async get(key){const saved=values.get(key);return saved?{etag:saved.etag,json:async()=>JSON.parse(saved.body)}:null;},async put(key,body,{onlyIf}={}){
  const saved=values.get(key);
  if(onlyIf?.etagMatches&&saved?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&saved)return null;
  const etag='r'+(++revision);values.set(key,{body,etag});return {etag};
 }};
}
const read=async(bucket,kind)=>(await bucket.get('operations-live/'+kind+'.json')).json();
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('ordinary contract reads import the cloud source, cache for 60s, then replace changed source',async()=>{
 const BUCKET=bucket();let time=start,calls=0,branch='First Test';
 const load=createOperationsLoader({now:()=>time}),fetcher=async(url,options)=>{calls++;assert.equal(url.hostname,'docs.google.com');assert.equal(options.cache,'no-store');assert.equal(url.searchParams.get('gid'),'1504066538');return new Response(contractCsv(branch));};
 const first=await load({BUCKET},'contracts',fetcher);
 assert.equal(first.items[0].branch,'First Test');assert.equal(first.source.online_status,'online');assert.equal(first.source.fetched_at,new Date(start).toISOString());
 branch='Updated Test';time+=59999;assert.equal((await load({BUCKET},'contracts',fetcher)).items[0].branch,'First Test');assert.equal(calls,1);
 time++;const updated=await load({BUCKET},'contracts',fetcher);assert.equal(updated.items[0].branch,'Updated Test');assert.equal(calls,2);assert.deepEqual(await read(BUCKET,'contracts'),updated);
});
test('ordinary events reads fetch all three existing sheets and overlay the older snapshot',async()=>{
 const BUCKET=bucket();const calls=[];
 const fetcher=async url=>{const gid=url.searchParams.get('gid');calls.push(gid);return new Response(eventCsv[gid]);};
 const base={data:{'/api/events':{source:{fetched_at:'2025-01-01T00:00:00Z'},years:{}}},other:true};
 const result=await applyOperations(base,{BUCKET},fetcher);
 assert.equal(calls.length,3);assert.equal(result.other,true);assert.equal(result.data['/api/events'].years['2025'].summary.sales,123);assert.equal(result.data['/api/events'].years['2026'].items.length,2);
 assert.equal((await applyOperations(base,{BUCKET},()=>assert.fail('fresh cache must not fetch'))).data['/api/events'].source.online_status,'online');
 const newer={source:{fetched_at:'2099-01-01T00:00:00Z'},years:{}};assert.equal(latestOperation(newer,result.data['/api/events']),newer);
});
test('force and selected source invalidation refresh inside TTL, unrelated source does not',async()=>{
 const BUCKET=bucket();let time=start,calls=0;const load=createOperationsLoader({now:()=>time}),fetcher=async()=>{calls++;return new Response(contractCsv('Test '+calls));};
 await load({BUCKET},'contracts',fetcher);time+=1000;
 await load({BUCKET,DATA_REFRESH_SOURCES:{'/api/rebrand':time}},'contracts',fetcher);assert.equal(calls,1);
 await load({BUCKET,DATA_REFRESH_SOURCES:{'/api/contracts':time}},'contracts',fetcher);assert.equal(calls,2);
 await load({BUCKET,FORCE_DATA_REFRESH:true},'contracts',fetcher);assert.equal(calls,3);
});
test('failed refresh retains rows and successful timestamp with persisted 30s retry backoff',async()=>{
 const BUCKET=bucket();let time=start,calls=0;const load=createOperationsLoader({now:()=>time});
 const first=await load({BUCKET},'contracts',async()=>new Response(contractCsv()));time+=60000;
 const fail=async()=>{calls++;throw Error('offline');};const stale=await load({BUCKET},'contracts',fail);
 assert.deepEqual(stale.items,first.items);assert.equal(stale.source.fetched_at,first.source.fetched_at);assert.equal(stale.source.online_status,'stale');assert.equal(stale.source.checked_at,new Date(time).toISOString());
 time+=29999;assert.deepEqual(await createOperationsLoader({now:()=>time})({BUCKET},'contracts',fail),stale);assert.equal(calls,1);
 time++;await load({BUCKET},'contracts',fail);assert.equal(calls,2);
});
test('empty cache failures are retried after backoff and never marked online',async()=>{
 const BUCKET=bucket();let time=start,calls=0;const load=createOperationsLoader({now:()=>time}),fail=async()=>{calls++;return new Response('<html>Sign in</html>');};
 const first=await load({BUCKET},'contracts',fail);assert.equal(first.source.online_status,'stale');assert.equal(first.source.fetched_at,null);assert.equal(first.items,undefined);
 await load({BUCKET},'contracts',fail);assert.equal(calls,1);time+=30000;
 const valid=await load({BUCKET},'contracts',async()=>new Response(contractCsv()));assert.equal(valid.source.online_status,'online');
});
test('changed source structure or oversized CSV does not replace saved rows',async()=>{
 const BUCKET=bucket(),load=createOperationsLoader({now:()=>start});const first=await load({BUCKET},'contracts',async()=>new Response(contractCsv()));
 for(const text of ['invalid headers','a'.repeat(2000001),'<html>sign in</html>']){
  const result=await load({BUCKET,FORCE_DATA_REFRESH:true},'contracts',async()=>new Response(text));assert.equal(result.source.online_status,'stale');assert.deepEqual(result.items,first.items);
 }
});
test('concurrent readers within one Worker share a single source request',async()=>{
 const BUCKET=bucket(),load=createOperationsLoader({now:()=>start}),gate=deferred();let calls=0;
 const fetcher=async()=>{calls++;await gate.promise;return new Response(contractCsv());};
 const a=load({BUCKET},'contracts',fetcher),b=load({BUCKET},'contracts',fetcher);gate.resolve();assert.deepEqual(await a,await b);assert.equal(calls,1);
});
test('cross-worker late success cannot overwrite a successful conditional winner',async()=>{
 const BUCKET=bucket(),entered=deferred(),release=deferred();
 const slow=createOperationsLoader({now:()=>start}),fast=createOperationsLoader({now:()=>start+1000});
 const a=slow({BUCKET},'contracts',async()=>{entered.resolve();await release.promise;return new Response(contractCsv('Delayed Test'));});
 await entered.promise;const b=await fast({BUCKET},'contracts',async()=>new Response(contractCsv('Winner Test')));release.resolve();
 assert.deepEqual(await a,b);assert.deepEqual(await read(BUCKET,'contracts'),b);assert.equal(b.items[0].branch,'Winner Test');
});
test('cross-worker late failure cannot overwrite newer success or mark it stale',async()=>{
 const BUCKET=bucket();await createOperationsLoader({now:()=>start})({BUCKET},'contracts',async()=>new Response(contractCsv('Original Test')));
 const entered=deferred(),release=deferred(),slow=createOperationsLoader({now:()=>start+60000}),fast=createOperationsLoader({now:()=>start+61000});
 const a=slow({BUCKET},'contracts',async()=>{entered.resolve();await release.promise;throw Error('offline');});
 await entered.promise;const b=await fast({BUCKET},'contracts',async()=>new Response(contractCsv('Winner Test')));release.resolve();
 assert.deepEqual(await a,b);assert.deepEqual(await read(BUCKET,'contracts'),b);assert.equal(b.source.online_status,'online');
});
test('storage failure does not report unpersisted fresh values or destroy the old value',async()=>{
 const BUCKET=bucket(),load=createOperationsLoader({now:()=>start});const previous=await load({BUCKET},'contracts',async()=>new Response(contractCsv()));
 const broken={...BUCKET,put:async()=>{throw Error('storage failed');}};
 const result=await load({BUCKET:broken,FORCE_DATA_REFRESH:true},'contracts',async()=>new Response(contractCsv('Unsaved Test')));
 assert.equal(result.source.online_status,'stale');assert.deepEqual(result.items,previous.items);assert.deepEqual(await read(BUCKET,'contracts'),previous);
 const readFailed={get:async()=>{throw Error('storage failed');},put:()=>assert.fail('cannot overwrite unknown cache')};
 assert.equal((await load({BUCKET:readFailed},'contracts',()=>assert.fail('cannot persist source'))).source.online_status,'stale');
});
test('unknown source names are rejected before any reads',async()=>{
 const load=createOperationsLoader();await assert.rejects(load({BUCKET:{get:()=>assert.fail('no reads'),put:()=>{}}},'../private',()=>assert.fail('no requests')),/Unsupported/);
});
test('forced reads never join a pending ordinary cache hit',async()=>{
 const BUCKET=bucket(),load=createOperationsLoader({now:()=>start});
 const first=await load({BUCKET},'contracts',async()=>new Response(contractCsv('Cached Test')));
 const entered=deferred(),release=deferred();let reads=0,calls=0;
 const delayed={...BUCKET,get:async key=>{const value=await BUCKET.get(key);if(++reads===1){entered.resolve();await release.promise;}return value;}};
 const cached=load({BUCKET:delayed},'contracts',()=>assert.fail('normal read stays cached'));await entered.promise;
 const forced=load({BUCKET:delayed,FORCE_DATA_REFRESH:true},'contracts',async()=>{calls++;return new Response(contractCsv('Refreshed Test'));});
 const refreshed=await forced;release.resolve();assert.equal(calls,1);assert.equal(refreshed.items[0].branch,'Refreshed Test');assert.deepEqual(await cached,first);
});
