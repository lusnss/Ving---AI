import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {buildSummaryModel,eventOutcomeCounts,visibleSummaryEvents} from './out/assets/summary-data.mjs';
import {summaryMarkup} from './out/assets/summary.mjs';
import {createOverview} from './out/assets/daily-comparison-model.mjs';
const state={year:2026,month:9,grain:'month',basis:'all',channel:'all',metric:'sales',eventStatus:'all'};
const event=(name,range={start:'2026-09-01',end:'2026-09-10'},category='direct')=>({name,year:2026,month:9,range,category});
const record=(item,profit,basis='ACT')=>({name:item.name,year:2026,month:9,range:item.range,channel:'event-'+item.category,code:'',basis,gross:100,net:100,cogs:20,opex:80-profit,sourceProfit:profit,profit,costs:{rent:80-profit},missingCosts:0,difference:0});
test('Event card counts calendar events once, includes pending proposals and keeps zero separate',()=>{
 const items=[event('กำไร'),event('ขาดทุน'),event('เท่าทุน'),event('ขาดต้นทุน'),event('รอรายงาน')];
 const rows=[record(items[0],25),record(items[1],-10),record(items[2],0),{...record(items[3],20),cogs:null}];
 assert.deepEqual(eventOutcomeCounts(items,rows,2026),{total:5,profit:1,loss:1,zero:1,pending:2});
 const data={comparison:null,events:{years:{2026:{items}}},pnl:{year:2026,records:rows}};
 const html=summaryMarkup(data,state,'2026-09-26');
 for(const [key,count] of [['profit',1],['loss',1],['pending',2]])assert.match(html,new RegExp(`data-event-outcome="${key}"><b[^>]*>${count}</b>`));
 assert.match(html,/เท่าทุน 1 ที่/);
 for(const [status,count] of [['profit',1],['loss',1],['zero',1],['pending',2]])assert.equal((html.match(new RegExp(`data-event-financial="${status}"`,'g'))||[]).length,count);
 assert.match(html,/กำไร · 25.00 บาท/);
 assert.match(html,/ขาดทุน · -10.00 บาท/);
 assert.match(html,/ยอดขายสุทธิหรือต้นทุนในงบยังไม่ครบ/);
 const model=buildSummaryModel(data,state,'2026-09-26');
 const detail=summaryMarkup(data,{...state,metric:'events',event:model.selected.events[0].id},'2026-09-26');
 assert.match(detail,/sum-inspector[\s\S]*data-event-financial=/);

});
test('Matching respects occurrence dates, channel, basis, daily selection and cancelled events',()=>{
 const a=event('สถานที่ A'),b=event('สถานที่ A',{start:'2026-09-15',end:'2026-09-20'}),gp=event('สถานที่ A',a.range,'gp');
 const rows=[record(a,20),record(a,-30,'FCT'),record(b,-10),record(gp,5)];
 const data={comparison:null,events:{years:{2026:{items:[a,b,gp]}}},pnl:{year:2026,records:rows}};
 const counts=(s)=>{const model=buildSummaryModel(data,{...state,...s},'2026-09-26');return eventOutcomeCounts(visibleSummaryEvents(model,{eventStatus:'all'}),model.selected.records,2026);};
 assert.deepEqual(counts({}),{total:3,profit:1,loss:2,zero:0,pending:0});
 assert.deepEqual(counts({basis:'ACT'}),{total:3,profit:2,loss:1,zero:0,pending:0});
 assert.deepEqual(counts({grain:'day',day:16}),{total:1,profit:0,loss:1,zero:0,pending:0});
 const cancelled=buildSummaryModel({...data,cancelledProposals:[{...a,workflow:{status:'cancelled'}}]},state,'2026-09-26');
 assert.equal(cancelled.selected.events.length,2);
 assert.deepEqual(eventOutcomeCounts([a,{...a}],rows,2026),{total:2,profit:0,loss:0,zero:0,pending:2});
});
function csv(amount){return Array.from({length:12},(_,i)=>{
 const month=i+1,n=new Date(Date.UTC(2026,month,0)).getUTCDate(),head=Array(10).fill('');head[2]='Group';head[4]='Channel';
 const rows=[[...head,...Array.from({length:n},(_,d)=>`${d+1}/${month}/2569`)]];
 for(const group of ['Stand Alone','EVENT','EVENT นอก','Department Stores']){const row=Array(10).fill('');row[2]=group;row[4]=group==='Stand Alone'?'Stand Alone Rama 9':group;rows.push([...row,...Array.from({length:n},(_,d)=>month<9||month===9&&d<25?amount:'')]);}
 return rows.map(row=>row.join(',')).join('\n');
}).join('\n');}
test('Summary and Daily report share live edits, stale values and recovery without exposing unauthenticated data',async()=>{
 const realFetch=globalThis.fetch,realNow=Date.now;let at=Date.parse('2026-09-26T00:00:00Z'),amount=10,offline=false,calls=0;const saved=new Map();
 Date.now=()=>at;globalThis.fetch=async url=>{assert.match(String(url),/docs.google.com\/spreadsheets/);calls++;if(offline)throw Error('offline');return new Response(csv(amount));};
 const {default:worker}=await import('./dist/server/index.js?summary-live-fixture');
 const env={SESSION_SECRET:'summary-fixture',ADMIN_PASSWORD:'summary-admin',VIEWER_PASSWORD:'summary-viewer',DB:previewDatabase(),BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>saved.set(key,value)}};
 const req=(path,cookie='')=>new Request('https://example.test'+path,{headers:{cookie}});
 try{
  assert.equal((await worker.fetch(req('/api/summary'),env)).status,401);assert.equal(calls,0);
  const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:env.VIEWER_PASSWORD})}),env),cookie=login.headers.get('set-cookie').split(';')[0];
  const read=async()=>{const response=await worker.fetch(req('/api/summary',cookie),env);assert.equal(response.headers.get('cache-control'),'no-store');return response.json();};
  const first=await read(),firstModel=buildSummaryModel(first,state,'2026-09-26');assert.equal(firstModel.revenue.current,1000);assert.equal(first.comparison.live.status,'online');
  const daily=await(await worker.fetch(req('/api/daily-comparison',cookie),env)).json();assert.deepEqual(daily,first.comparison);assert.equal(firstModel.revenue.current,createOverview(daily,'9').current.amount);assert.equal(calls,1);
  at+=5000;amount=20;const second=await read();assert.equal(buildSummaryModel(second,state,'2026-09-26').revenue.current,2000);
  assert.equal(buildSummaryModel(second,{...state,grain:'day',day:25},'2026-09-26').revenue.current,80);
  at+=5000;offline=true;const stale=await read();assert.equal(stale.comparison.live.status,'stale');assert.equal(buildSummaryModel(stale,state,'2026-09-26').revenue.current,2000);assert.match(summaryMarkup(stale,state,'2026-09-26'),/เชื่อมต่อไม่ได้/);
  at+=5000;offline=false;amount=0;const zero=await read();assert.equal(zero.comparison.live.status,'online');assert.equal(buildSummaryModel(zero,state,'2026-09-26').revenue.current,0);
 }finally{globalThis.fetch=realFetch;Date.now=realNow;env.DB.close();}
});
test('Cross-month events use all matching accounting periods while monthly branch totals stay unchanged',async()=>{
 const {readFile}=await import('node:fs/promises');
 const pnl=JSON.parse(await readFile(new URL('./profit-loss.snapshot.json',import.meta.url),'utf8'));
 const rows=pnl.records.filter(r=>r.channel.startsWith('event-'));
 const items=rows.map(r=>({...r,category:r.channel.slice(6)}));
 const data={comparison:null,pnl,events:{years:{2026:{items}}}};
 const model=buildSummaryModel(data,state,'2026-09-26');
 const html=summaryMarkup(data,state,'2026-09-26');
 assert.match(html,/กำไร · 34,744.67 บาท/);
 assert.match(html,/ยอดบันทึก ACT · งบ ส.ค./);
 assert.ok(model.selected.records.every(r=>r.month===9));
 assert.equal(model.eventRecords.length,rows.length);
 const a=event('งานข้ามเดือน',{start:'2026-08-20',end:'2026-09-02'});
 const sample={comparison:null,events:{years:{2026:{items:[a]}}},pnl:{year:2026,records:[{...record(a,25),month:8},record(a,-5)]}};
 assert.match(summaryMarkup(sample,state,'2026-09-26'),/กำไร · 20.00 บาท/);
 assert.match(summaryMarkup(sample,state,'2026-09-26'),/งบ ส.ค., ก.ย./);
 assert.match(summaryMarkup(sample,{...state,basis:'FCT'},'2026-09-26'),/data-event-financial="pending"/);
});
