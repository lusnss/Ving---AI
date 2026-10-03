import test from 'node:test';
import assert from 'node:assert/strict';
import {excludeCancelledEvents,sameEventOccurrence,visibleEventCatalog} from './out/assets/event-visibility.mjs';
import {summaryEventCatalog} from './out/assets/summary-event-proposals.mjs';
import {buildSummaryModel,summaryMarkup} from './out/assets/summary.mjs';
import {scheduleModel,scheduleMarkup} from './out/assets/event-schedule.mjs';
import {directoryItems,eventsMarkup} from './out/assets/events.mjs';
import {directoryExcelWorkbook} from './out/assets/event-directory.mjs';
import {attachApprovedSalesEvents} from './out/assets/approved-sales-events.mjs';
import {selectRecords} from './out/assets/profit-loss.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';

const id='99999999-9999-4999-8999-999999999999',key='web:'+id;
const event={id,source:'web',deletionKey:key,name:'Fashion Island',place:'Fashion Island',month:'2026-10',startDate:'2026-10-20',endDate:'2026-10-29',trade:'อนุมัติ',ceo:'อนุมัติ',createdAt:'2026-09-24T00:00:00Z',input:{channel:'gp'}};
const cancelled={...event,workflow:{status:'cancelled',note:'test reason'}};
const duplicate={...event,deletionKey:'sheet:duplicate',source:'sheet'};
const catalog={years:{2026:{items:[{name:'แฟชั่นไอส์แลนด์ 20-29/10/69',month:10,categories:['gp'],sales:null},{name:'งานที่ยังจัด 1-3/10/69',month:10,categories:['gp'],sales:null}],summary:{count:2,planned:2,sales:123},months:[{month:'ตุลาคม',count:2,sales:123}],sources:[{label:'Event จ่าย GP',count:2,sales:123}]}}};

test('cancellation overrides stale approvals and duplicate sources, but not another occurrence or channel',()=>{
 const later={...duplicate,startDate:'2026-11-20',endDate:'2026-11-29'};
 const otherChannel={...duplicate,deletionKey:'direct',input:{channel:'direct'}};
 assert.deepEqual(excludeCancelledEvents([cancelled,duplicate,later,otherChannel]),[later,otherChannel]);
 assert(sameEventOccurrence(catalog.years[2026].items[0],cancelled,2026));
 assert(!sameEventOccurrence({...catalog.years[2026].items[0],name:'แฟชั่นไอส์แลนด์ 20-29/10/68'},cancelled,2025));
 assert.equal(excludeCancelledEvents([duplicate],[{...cancelled,workflow:{status:'scheduled'}}]).length,1);
});
test('Summary, calendar, directory, counters and exports all exclude a cancelled occurrence',()=>{
 const before=JSON.stringify(catalog),approval={items:[duplicate],cancelled:[cancelled]};
 const summary={events:catalog,approvedProposals:[duplicate],cancelledProposals:[cancelled]},state={year:2026,month:10,eventStatus:'all',basis:'all'};
 const model=buildSummaryModel(summary,state,'2026-09-25');assert.equal(model.selected.events.length,1);assert.equal(model.selected.events[0].name,'งานที่ยังจัด 1-3/10/69');
 assert.doesNotMatch(summaryMarkup(summary,state,'2026-09-25'),/Fashion|แฟชั่น/);
 assert.equal(summaryEventCatalog(catalog,[cancelled,duplicate]).years[2026].items.length,1);
 const visible=visibleEventCatalog(catalog,[cancelled]);assert.equal(visible.years[2026].summary.count,1);assert.equal(visible.years[2026].months[0].count,1);assert.equal(visible.years[2026].sources[0].count,1);
 const rows=directoryItems(catalog,approval,2026);assert.equal(rows.length,1);
 assert.doesNotMatch(eventsMarkup(catalog,{year:2026,scheduleMonth:'10'},approval),/Fashion|แฟชั่น/);
 assert.equal(scheduleModel([duplicate,cancelled],{year:2026,scheduleMonth:'10'},'2026-09-25').counts.all,0);
 assert.doesNotMatch(scheduleMarkup(approval,{year:2026,scheduleMonth:'10'},'2026-09-25'),/Fashion|แฟชั่น/);
 const workbook=new TextDecoder().decode(directoryExcelWorkbook(rows,2026));assert.doesNotMatch(workbook,/Fashion|แฟชั่น/);assert.match(workbook,/งานที่ยังจัด/);
 assert.equal(JSON.stringify(catalog),before);
});
test('sales views remove cancelled placeholders and matching dated rows without hiding unrelated rounds or stores',()=>{
 const periods=[{key:'2026-10',year:2026,month:10,branches:[{type:'Event',branch:'Fashion Island 20-29/10/69'},{type:'Event',branch:'Fashion Island 1-3/10/69'},{type:'CDS',branch:'Fashion Island 20-29/10/69',source_section:'branch'}]}];
 const result=attachApprovedSalesEvents(periods,[duplicate],'2026-09-25',[cancelled]);
 assert.equal(result.length,1);assert.equal(result[0].branches.length,2);assert(!result[0].branches.some(row=>row.approved_event_key));assert.equal(periods[0].branches.length,3);
 assert.equal(attachApprovedSalesEvents([], [cancelled,duplicate],'2026-09-25').length,0);
});
test('undated cancellations match only an exact name, place, year and month; cross-year cancellation covers both years',()=>{
 const unknown={...cancelled,startDate:'',endDate:'',month:'2026-10'},row={...duplicate,startDate:'',endDate:'',month:'2026-10'};
 assert.equal(excludeCancelledEvents([row],[unknown]).length,0);
 assert.equal(excludeCancelledEvents([{...row,month:'2026-11'}],[unknown]).length,1);
 const cross={...cancelled,startDate:'2026-12-28',endDate:'2027-01-03'};
 const data={years:{2026:{items:[{name:'Fashion Island 28/12/69-3/1/70'}]},2027:{items:[{name:'Fashion Island 28/12/69-3/1/70'}]}}};
 assert.equal(summaryEventCatalog(data,[],[cross]).years[2026].items.length,0);
 assert.equal(summaryEventCatalog(data,[],[cross]).years[2027].items.length,0);
});
test('P&L excludes the cancelled event while retaining other rounds, channels and normal branches',()=>{
 const base={year:2026,month:10,basis:'FCT',channel:'event-gp',name:'Fashion Island 20-29/10/69'};
 const other={...base,name:'Fashion Island 1-3/10/69'},direct={...base,channel:'event-direct'},branch={...base,channel:'consign'};
 const data={year:2026,cancelledProposals:[cancelled],records:[base,other,direct,branch]};
 assert.deepEqual(selectRecords(data,{month:'all',channel:'all',basis:'all'}),[other,direct,branch]);
});
test('saved cancellation reaches every consumer and restoration returns the event without exposing notes',async()=>{
 const sheet={...duplicate,sourceYear:2026};
 const env={DB:previewDatabase(),SESSION_SECRET:'visibility-test-secret',ADMIN_PASSWORD:'visibility-admin',VIEWER_PASSWORD:'visibility-viewer',BUCKET:{get:async name=>name==='event-proposals.json'?{json:async()=>({version:1,items:[sheet],source:{status:'online',fetched_at:new Date().toISOString()}})}:null}};
 try{
  await env.DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind(id,event.createdAt,JSON.stringify(event)).run();
  const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:'visibility-admin'})}),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const request=(path,method='GET',body)=>new Request('https://example.test'+path,{method,headers:{cookie,origin:'https://example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const patch=async body=>{const response=await worker.fetch(request('/api/event-proposals/status','PATCH',{key,proposalRevision:event.createdAt,...body}),env);assert.equal(response.status,200);return response.json();};
  const saved=await patch({status:'cancelled',note:'private cancellation reason'});
  const summary=await (await worker.fetch(request('/api/summary'),env)).json();
  const approval=await (await worker.fetch(request('/api/events/approved'),env)).json();
  assert.equal(summary.cancelledProposals.length,1);assert.equal(approval.cancelled.length,1);
  assert.doesNotMatch(JSON.stringify(approval),/private cancellation reason/);
  assert.equal(summaryEventCatalog({years:{}},summary.approvedProposals,summary.cancelledProposals).years[2026],undefined);
  assert.equal(scheduleModel([...approval.items,...approval.cancelled],{year:2026,scheduleMonth:'10'}).counts.all,0);
  const proposals=await (await worker.fetch(request('/api/event-proposals'),env)).json();assert.equal(proposals.items.find(row=>row.deletionKey===key).workflow.status,'cancelled');
  await patch({status:'scheduled',note:'',revision:saved.workflow.revision});
  const restored=await (await worker.fetch(request('/api/events/approved'),env)).json();assert.equal(restored.cancelled.length,0);assert(restored.items.some(row=>row.deletionKey===key));
 }finally{env.DB.close();}
});
