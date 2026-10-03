import test from 'node:test';
import assert from 'node:assert/strict';
import {createProposalLoader,proposalHeaders,buildEventProposals} from './event-proposals-data.mjs';
import {createRecoverableRead} from './out/assets/read-recovery.mjs';
const csv=proposalHeaders.join(',')+'\nสถานที่ทดสอบ,งานทดสอบ,10,ตุลาคม,01-02.10.26,2,1000,100,10%,อนุมัติ,อนุมัติ';
const hang=()=>new Promise(()=>{}),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const good=()=>new Response(csv);
const budgets={readMs:15,fetchMs:25,writeMs:15,retryMs:0,ttl:0};
test('each stalled upstream stage finishes and the following request can recover',async()=>{
 for(const stage of ['read','json','fetch','body','write']){
  let stalled=true,calls=0;
  const env={BUCKET:{get:()=>stalled&&stage==='read'?hang():Promise.resolve(stalled&&stage==='json'?{json:hang}:null),put:()=>stalled&&stage==='write'?hang():Promise.resolve()}};
  const load=createProposalLoader({...budgets,fetchImpl:()=>{calls++;return stalled&&stage==='fetch'?hang():stalled&&stage==='body'?Promise.resolve({ok:true,text:hang}):Promise.resolve(good());}});
  const first=await Promise.race([load(env),wait(300).then(()=>{throw Error('loader still blocked: '+stage);})]);
  assert.equal(first.source.status,['fetch','body'].includes(stage)?'unavailable':'online',stage);
  stalled=false;const next=await load(env);assert.equal(next.source.status,'online');assert.equal(next.items.length,1);assert.equal(calls,2);
 }
});
test('a concurrent request never waits for a previous Worker request; late data cannot poison memory',async()=>{
 let release,clock=100000,calls=0;
 const load=createProposalLoader({...budgets,ttl:1000,now:()=>clock,fetchImpl:()=>++calls===1?new Promise(resolve=>release=resolve):Promise.resolve(good())});
 const env={BUCKET:{get:async()=>null,put:async()=>{}}};
 const first=load(env);await wait(2);clock+=1000;
 const fresh=await load(env);assert.equal(fresh.source.status,'online');assert.equal(calls,2);
 await first;release(new Response(csv.replace('1000,100','9999,999')));await wait(2);
 assert.equal((await load(env)).items[0].sales,'1000');assert.equal(calls,2);
});
test('source failure keeps last successful timestamp and cached rows',async()=>{
 const previous=buildEventProposals(csv,'2026-09-30T00:00:00Z');
 const load=createProposalLoader({...budgets,fetchImpl:hang});
 const result=await load({BUCKET:{get:async()=>({json:async()=>previous}),put:async()=>{}}});
 assert.equal(result.source.status,'stale');assert.equal(result.source.fetched_at,previous.source.fetched_at);assert.deepEqual(result.items,previous.items);
});
test('client timeout releases pending, keeps last good data read-only, and restores fresh permissions',async()=>{
 let mode='good',calls=0,release,aborted=false;
 const data={items:[{id:'old'}],permissions:{canEdit:true,canApprove:true}};
 const read=createRecoverableRead({timeoutMs:20,fetchImpl:async(url,{signal})=>{calls++;if(mode==='hang'){signal.addEventListener('abort',()=>aborted=true);return new Promise(resolve=>release=resolve);}return Response.json(mode==='new'?{...data,items:[{id:'new'}]}:data);}});
 await read('/api/event-proposals',{fallback:true});mode='hang';
 const [a,b]=await Promise.all([read('/api/event-proposals',{fallback:true}),read('/api/event-proposals',{fallback:true})]);
 assert.equal(calls,2);assert.equal(aborted,true);assert.deepEqual(a,b);assert.equal(a.recovery.stale,true);assert.equal(a.permissions.canEdit,false);assert.equal(a.permissions.canApprove,false);assert.equal(a.items[0].id,'old');
 mode='new';const fresh=await read('/api/event-proposals',{fallback:true});assert.equal(fresh.permissions.canEdit,true);assert.equal(fresh.recovery,undefined);assert.equal(fresh.items[0].id,'new');
 release(Response.json(data));await wait(2);mode='hang';const cached=await read('/api/event-proposals',{fallback:true});assert.equal(cached.items[0].id,'new');
});
test('first-load errors reject for retry UI; unauthorized reads never fall back to saved data',async()=>{
 let status=503;
 const read=createRecoverableRead({fetchImpl:async()=>Response.json({items:[]},{status})});
 await assert.rejects(read('/api/event-proposals',{fallback:true}));status=200;await read('/api/event-proposals',{fallback:true});status=401;
 await assert.rejects(read('/api/event-proposals',{fallback:true}),error=>error.status===401);status=503;await assert.rejects(read('/api/event-proposals',{fallback:true}));
});
