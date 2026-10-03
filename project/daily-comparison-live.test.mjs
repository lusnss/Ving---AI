import test from 'node:test';
import assert from 'node:assert/strict';
import {parseComparisonSource,createComparisonLoader} from './daily-comparison-live.mjs';
import {createOverview} from './out/assets/daily-comparison-model.mjs';
const groups=['Stand Alone','EVENT','EVENT นอก','Department Stores'];
function csv({day=21,month=9,amount=10,label='Rama 9',missingMonth=0}={}){
 const rows=[];
 for(let m=1;m<=12;m++){
  if(m===missingMonth)continue;
  const n=new Date(Date.UTC(2026,m,0)).getUTCDate(),head=Array(10).fill('');head[2]='Group';head[4]='Channel';
  rows.push([...head,...Array.from({length:n},(_,i)=>`${i+1}/${m}/2569`)]);
  for(const group of groups){const row=Array(10).fill('');row[2]=group;row[4]=group==='Stand Alone'?`Stand Alone ${label} (ผู้รับผิดชอบ)`:group;rows.push([...row,...Array.from({length:n},(_,i)=>m<month||m===month&&i<day?amount:'')]);}
 }
 return rows.map(r=>r.join(',')).join('\n');
}
test('live source advances through month end and next month; retains historical baseline and strips staff labels',()=>{
 for(const [month,day] of [[9,21],[9,30],[10,1]]){
  const d=parseComparisonSource(csv({month,day}),'2026-10-02T00:00:00Z'),o=createOverview(d,'ytd');assert.deepEqual(o.scope.latest,{month,day});assert(d.records.some(r=>r.year===2568));assert(!JSON.stringify(d).includes('ผู้รับผิดชอบ'));
 }
 const a=parseComparisonSource(csv()),b=parseComparisonSource(csv({amount:0}));assert.equal(b.records.find(r=>r.year===2569).daily[0],0);assert.notDeepEqual(a.records,b.records);
 assert.throws(()=>parseComparisonSource(csv({label:'Unreviewed person'})));assert.throws(()=>parseComparisonSource(csv({missingMonth:2})));assert.throws(()=>parseComparisonSource('<html>login</html>'));
});
test('new edits replace cached values; outages preserve last success and recovery updates without reload',async()=>{
 let time=Date.parse('2026-09-22T00:00:00Z'),body=csv(),calls=0,fail=false,saved;
 const env={BUCKET:{get:async()=>saved?{json:async()=>JSON.parse(saved)}:null,put:async(k,v)=>{saved=v;}}};
 const load=createComparisonLoader({now:()=>time,fetchImpl:async()=>{calls++;if(fail)throw Error('offline');return new Response(body);}});
 const first=await load(env);assert.equal(first.live.status,'online');await load(env);assert.equal(calls,1);
 time+=5000;body=csv({amount:20});const next=await load(env);assert.equal(next.records[0].daily[0],20);
 const success=saved;time+=5000;fail=true;const stale=await load(env);assert.equal(stale.live.status,'stale');assert.equal(stale.extractedAt,next.extractedAt);assert.equal(saved,success);
 time+=5000;fail=false;body=csv({day:20});const cleared=await load(env);assert.equal(createOverview(cleared).scope.latest.day,20);assert.equal(cleared.live.status,'online');
});
