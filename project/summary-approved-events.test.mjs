import test from 'node:test';
import {reportData} from './out/assets/daily-comparison-data.mjs';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';
import {proposalCalendarItem,summaryEventCatalog} from './out/assets/summary-event-proposals.mjs';
import {buildSummaryModel,summaryMarkup} from './out/assets/summary.mjs';
const state={year:2026,month:10,basis:'all',eventStatus:'all'},today='2026-09-21';
const id='44444444-4444-4444-8444-444444444444',key='web:'+id;
const approved={id,source:'web',deletionKey:key,name:'พื้นที่ทดสอบ',place:'พื้นที่ทดสอบ',startDate:'2026-10-23',endDate:'2026-11-01',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',sales:'999999',input:{channel:'gp'}};
test('approved proposals join every scheduled month, preserve calendar entries, and never affect sales or P&L',()=>{
 const events={years:{2026:{items:[{name:'งานเดิม 28/10/69'}]}}};
 const data={events,approvedProposals:[approved,{...approved,id:'other',deletionKey:'other',ceo:'รออนุมัติ'}]};
 const model=buildSummaryModel(data,state,today);
 assert.equal(model.selected.events.length,2);assert.equal(model.monthly[10].events.length,1);assert.equal(model.selected.actual,null);assert.equal(model.selected.finance.net,null);
 assert.equal(events.years[2026].items.length,1);
 const html=summaryMarkup(data,state,today);assert.match(html,/Trade และ CEO อนุมัติแล้ว/);assert.match(html,/proposal=web%3A444/);assert.doesNotMatch(html,/999,999/);
 const withdrawn=buildSummaryModel({...data,approvedProposals:[{...approved,ceo:'ไม่อนุมัติ'}]},state,today);assert.equal(withdrawn.selected.events.length,1);
});
test('sheet dot dates, explicit ISO dates, unknown dates and cross-year schedules are handled',()=>{
 const sheet={name:'งานจากชีต',dates:'01-08.10.26',month:'ตุลาคม',sourceYear:2026};
 assert.deepEqual(proposalCalendarItem(sheet).range,{start:'2026-10-01',end:'2026-10-08'});
 assert.deepEqual(proposalCalendarItem({...sheet,dates:'2026-10-23 ถึง 2026-11-01'}).range,{start:'2026-10-23',end:'2026-11-01'});
 const unknown={...approved,startDate:'',endDate:'',dates:'รอยืนยัน',month:'2026-12'};
 const model=buildSummaryModel({approvedProposals:[unknown]}, {...state,month:12},today);assert.equal(model.selected.counts.unknown,1);
 const cross={...approved,startDate:'2026-12-28',endDate:'2027-01-03'};
 assert.equal(buildSummaryModel({approvedProposals:[cross]},{...state,year:2027,month:1},today).selected.events.length,1);
 assert.match(summaryMarkup({approvedProposals:[cross]},{...state,year:2027,month:1},today),/2570/);
});
test('same named and dated catalog event is shown once, different named events are retained',()=>{
 const catalog={years:{2026:{items:[{name:'พื้นที่ทดสอบ 23/10-01/11/69'},{name:'Event 1 23/10-01/11/69'}]}}};
 const combined=summaryEventCatalog(catalog,[approved,approved,{...approved,name:'Event 2',deletionKey:'web:second'}]);
 assert.equal(combined.years[2026].items.length,3);assert.equal(combined.years[2026].items.filter(row=>row.approved).length,2);
});
test('Summary follows both approval columns, revocation and deletion immediately, including cached sheet proposals',async()=>{
 const sheet={name:'งานจากชีต',place:'ห้างทดสอบ',dates:'01-08.10.26',month:'ตุลาคม',trade:'อนุมัติ',ceo:'อนุมัติ'};
 const env={SESSION_SECRET:'summary-secret',ADMIN_PASSWORD:'summary-admin',VIEWER_PASSWORD:'summary-viewer',DB:previewDatabase(),BUCKET:{get:async name=>name==='daily-comparison-live.json'?{json:async()=>({...reportData,live:{status:'online',checkedAt:new Date().toISOString()}})}:name==='event-proposals.json'?{json:async()=>({version:1,items:[sheet]})}:null}};
 const req=(path,method='GET',body,cookie='')=>new Request('https://example.test'+path,{method,headers:{cookie,origin:'https://example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await env.DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind(id,'2026-09-21T00:00:00Z',JSON.stringify({...approved,trade:'รออนุมัติ',ceo:'รออนุมัติ'})).run();
  const login=async password=>(await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),env)).headers.get('set-cookie').split(';')[0];
  const admin=await login('summary-admin'),viewer=await login('summary-viewer');
  const summary=async()=>{const response=await worker.fetch(req('/api/summary','GET',null,viewer),env);assert.equal(response.status,200);return response.json();};
  const approve=async(field,status)=>assert.equal((await worker.fetch(req('/api/event-proposals/approval','PATCH',{key,field,status},admin),env)).status,200);
  assert.equal((await worker.fetch(req('/api/summary'),env)).status,401);
  assert.equal((await summary()).approvedProposals.length,1);
  await approve('trade','อนุมัติ');assert.equal((await summary()).approvedProposals.length,1);
  await approve('ceo','อนุมัติ');let data=await summary();assert.equal(data.approvedProposals.length,2);assert.ok(buildSummaryModel(data,state,today).selected.events.some(item=>item.proposalKey===key));
  await approve('ceo','ไม่อนุมัติ');assert.equal((await summary()).approvedProposals.length,1);
  await approve('ceo','อนุมัติ');
  await worker.fetch(req('/api/event-proposals/'+key,'DELETE',null,admin),env);assert.equal((await summary()).approvedProposals.length,1);
 }finally{env.DB.close();}
});
