import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewModel,reviewMarkup} from './out/assets/event-review.mjs';
import {proposalsMarkup} from './out/assets/event-proposals.mjs';
import {forecast} from './out/assets/event-predict-model.mjs';
import {eventProposalDetail,proposalKey} from './event-proposal-deletions.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';
const id='22222222-2222-4222-8222-222222222222';
const input={mode:'manual',channel:'gp',days:6,area:12,pcCount:2,pcCostMode:'person',pc:500,cogs:30,gp:20,shipping:1000,other:500,expectedSales:40000,downside:10,upside:10,targetMode:'manual',target:60000};
const calculation=forecast([],input);
const row={id,source:'web',place:'Event ทดสอบ',name:'Event ทดสอบ',dates:'2026-10-01 ถึง 2026-10-06',month:'2026-10',sales:'40000',profit:'12500',input,calculation,createdAt:'2026-09-20T00:00:00Z',trade:'รออนุมัติ',ceo:'รออนุมัติ',deletionKey:'web:'+id};
test('proposal links use the exact identity for both place and event name and preserve escaping',()=>{
 const a={...row,place:'<img src=x>',name:'Event A'},b={...row,id:'33333333-3333-4333-8333-333333333333',deletionKey:'web:33333333-3333-4333-8333-333333333333'};
 const html=proposalsMarkup({items:[a,b],source:{status:'online'}});
 assert.equal((html.match(/href="\/event-predict\?proposal=web%3A222/g)||[]).length,2);
 assert.equal((html.match(/href="\/event-predict\?proposal=web%3A333/g)||[]).length,2);
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('review preserves saved base and legacy cases; selected P&L reflects fixed and variable costs',()=>{
 const m=reviewModel(row);assert.equal(m.base.sales,40000);assert.equal(m.daily,40000/6);assert.equal(m.margin,31.25);assert.equal(m.breakEven,15000);
 assert.deepEqual(m.cases.map(s=>s.profit),[10500,12500,14500]);
 const down=reviewMarkup(row,{},0);assert.match(down,/36,000.00/);assert.match(down,/10,800.00/);assert.match(down,/7,200.00/);assert.match(down,/6,000.00/);assert.match(down,/Downside · ต่ำกว่าคาดการณ์ · %/);
 const up=reviewMarkup(row,{},2);assert.match(up,/13,200.00/);assert.match(up,/Upside · สูงกว่าคาดการณ์ · %/);
 const legacy={...row,calculation:{...calculation,base:{...calculation.base,label:'Base case'},scenarios:[{sales:48000,profit:1},calculation.base,{sales:72000,profit:2}]}};
 assert.equal(reviewModel(legacy).cases[0].sales,48000);assert.match(reviewMarkup(legacy),/เทียบเป้าหมาย/);
});
test('sheet summaries retain missing and zero separately, derive only total costs and never fabricate scenarios',()=>{
 const m=reviewModel({sales:'19,065',profit:'1,033.17',days:'8'});assert.equal(m.base.costs,18031.83);assert.equal(m.cases[0].sales,null);assert.equal(m.breakEven,null);
 assert.match(reviewMarkup({sales:'พื้นที่ใหม่',profit:'',place:'พื้นที่ใหม่'}),/ต้องถามเจ้าของ/);
 assert.equal(reviewModel({sales:'พื้นที่ใหม่',profit:''}).base.costs,null);
 assert.equal(reviewModel({sales:'0',profit:'-500'}).base.costs,500);assert.equal(reviewModel({sales:'0',profit:'-500'}).margin,null);
 assert.match(reviewMarkup({sales:'0',profit:'-500'}),/er-negative/);
});
test('direct lookup is read-only, retains overrides and hides deleted records; auth and exact deep links work',async()=>{
 const env={DB:previewDatabase(),BUCKET:{get:async()=>null},SESSION_SECRET:'test-secret',VIEWER_PASSWORD:'test-viewer',ADMIN_PASSWORD:'test-admin'};
 try{
  await env.DB.prepare('INSERT INTO event_requests VALUES (?, ?, ?)').bind(id,row.createdAt,JSON.stringify(row)).run();
  await env.DB.prepare('INSERT INTO event_proposal_approvals (id, ceo, updated_at) VALUES (?, ?, ?)').bind(row.deletionKey,'อนุมัติ',row.createdAt).run();
  const data=await eventProposalDetail(env,row.deletionKey);assert.equal(data.item.id,id);assert.equal(data.item.ceo,'อนุมัติ');assert.deepEqual(data.item.calculation,calculation);
  await assert.rejects(()=>eventProposalDetail(env,'bad'),{status:400});
  const base='https://example.test';const path='/api/event-proposals/detail?key='+encodeURIComponent(row.deletionKey);
  assert.equal((await worker.fetch(new Request(base+path),env)).status,401);
  const login=await worker.fetch(new Request(base+'/login',{method:'POST',body:new URLSearchParams({password:'test-viewer'})}),env);const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
  const detail=await worker.fetch(new Request(base+path,{headers}),env);assert.equal(detail.status,200);assert.equal((await detail.json()).item.id,id);
  const page=await worker.fetch(new Request(base+'/event-predict?proposal='+encodeURIComponent(row.deletionKey),{headers}),env);assert.equal(page.status,200);assert.match(await page.text(),/event-review.css/);
  await env.DB.prepare('INSERT INTO event_proposal_deletions VALUES (?, ?)').bind(row.deletionKey,row.createdAt).run();
  await assert.rejects(()=>eventProposalDetail(env,row.deletionKey),{status:404});
  assert.equal((await worker.fetch(new Request(base+path,{headers}),env)).status,404);
 }finally{env.DB.close();}
});
test('sheet detail uses full event key and preserves stale source status',async()=>{
 const sheet={place:'สถานที่ทดสอบ',name:'งาน A',dates:'1-2.10.26',month:'ตุลาคม',sales:'1000',profit:'-100'};
 const other={...sheet,dates:'3-4.10.26'};const key=await proposalKey(sheet);
 const env={DB:previewDatabase(),BUCKET:{get:async()=>({json:async()=>({version:1,source:{status:'online',fetched_at:new Date().toISOString()},items:[other,sheet]})})}};
 try{const result=await eventProposalDetail(env,key);assert.equal(result.item.dates,sheet.dates);assert.equal(result.item.profit,'-100');}finally{env.DB.close();}
});
