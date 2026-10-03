import test from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonLoader} from './daily-comparison-live.mjs';
import {createOverview,filterOverview} from './out/assets/daily-comparison-model.mjs';
import {salesWindow} from './out/assets/summary-data.mjs';
import {summaryMarkup} from './out/assets/summary.mjs';
const names=['Stand Alone','EVENT','EVENT นอก','Department Stores'];
function csv(value=20,lastDay=27){return Array.from({length:12},(_,i)=>{
 const m=i+1,n=new Date(Date.UTC(2026,m,0)).getUTCDate(),h=Array(10).fill('');h[2]='Group';h[4]='Channel';
 return [[...h,...Array.from({length:n},(_,d)=>`${d+1}/${m}/2569`)],...names.map((group,g)=>{
  const r=Array(10).fill('');r[2]=group;r[4]=g===0?'Stand Alone Rama 9':group;
  return [...r,...Array.from({length:n},(_,d)=>m<9?10:m===9&&d<(g===0?lastDay:24)?(g===0&&d>=24?value:10):'')];
 })].map(r=>r.join(',')).join('\n');
}).join('\n');}
test('uneven source edits reach both latest totals; matched YOY stays separate; deletion and outage recover',async()=>{
 let at=Date.parse('2026-09-28T02:00:00Z'),value=20,lastDay=27,offline=false,saved;
 const env={BUCKET:{get:async()=>saved?{json:async()=>JSON.parse(saved)}:null,put:async(k,v)=>{saved=v;}}};
 const load=createComparisonLoader({now:()=>at,fetchImpl:async()=>{if(offline)throw Error('offline');return new Response(csv(value,lastDay));}});
 const check=async(expected,matched=960)=>{
  const data=await load(env),overview=createOverview(data,'9'),summary=salesWindow(data,2026,9,null,'all','2026-09-28');
  assert.equal(overview.current.amount,expected);assert.equal(summary.current,expected);
  assert.equal(overview.matched.current.amount,matched);assert.equal(summary.matched.current,matched);
  assert.equal(overview.scope.endDay,lastDay);assert.equal(overview.matched.scope.endDay,24);
  assert.equal(summary.channels[0].recordedThrough,`2026-09-${lastDay}`);
  assert.equal(summary.channels[1].recordedThrough,'2026-09-24');
  assert.equal(filterOverview(overview,'standalone').current.amount,expected-720);
  assert.equal(filterOverview(overview,'standalone').matched.current.amount,240);
  const html=summaryMarkup({comparison:data},{year:2026,month:9},'2026-09-28');
  assert.match(html,new RegExp(expected.toLocaleString('en-US',{minimumFractionDigits:2})));
  assert.match(html,/YOY · 1–24 ก.ย. ทั้งสองปี/);
  return data;
 };
 await check(1020);
 at+=5000;value=40;await check(1080);
 at+=5000;lastDay=28;await check(1120);
 at+=5000;value=0;await check(960);
 at+=5000;lastDay=25;value=30;await check(990);
 at+=5000;offline=true;assert.equal((await check(990)).live.status,'stale');
 at+=5000;offline=false;value=10;assert.equal((await check(970)).live.status,'online');
});
