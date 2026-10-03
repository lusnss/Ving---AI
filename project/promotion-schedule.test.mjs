import test from 'node:test';
import assert from 'node:assert/strict';
import {promotionEventOption,promotionSchedule,promotionScheduleError,promotionEventVersion,promotionEventInMonth} from './out/assets/promotion-schedule.mjs';
import {loadPromotionEvents,promotionEventDetail} from './promotion-events-data.mjs';
import {proposalKey} from './event-proposal-deletions.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';

const base={deletionKey:'web:10000000-0000-4000-8000-000000000001',name:'Fixture Event',month:'2026-10',sourceYear:2026};
test('Month picker includes recorded and overlapping months, excluding unrelated years and unknown schedules',()=>{
 const event=promotionEventOption({...base,month:'2026-12',startDate:'2026-11-28',endDate:'2026-12-05'});
 for(const month of ['2026-11','2026-12'])assert.equal(promotionEventInMonth(event,month),true);
 for(const month of ['2026-10','2027-12','2026-13',''])assert.equal(promotionEventInMonth(event,month),false);
 const undated=promotionEventOption(base);
 assert.equal(promotionEventInMonth(undated,'2026-10'),true);
 assert.equal(promotionEventInMonth(undated,'2026-11'),false);
 assert.equal(promotionEventInMonth({...undated,month:''},'2026-10'),false);
 assert.equal(promotionSchedule({month:'2026-11',promotionType:'event',eventId:event.id,startDate:event.startDate,endDate:event.endDate},event).scheduleSource,'event');
 assert.throws(()=>promotionSchedule({month:'2026-11',promotionType:'event',eventId:undated.id},undated),e=>e.status===409);
});
test('Event schedules normalize source dates without inventing absent or ambiguous dates',()=>{
 for(const dates of ['2-12/10/2569','2–12/10/2026','2-12.10.2569','2026-10-02 ถึง 2026-10-12','2-12']){
  const event=promotionEventOption({...base,dates});assert.equal(event.startDate,'2026-10-02',dates);assert.equal(event.endDate,'2026-10-12',dates);
 }
 for(const month of ['ตุลาคม','ต.ค.','10','2569-10'])assert.equal(promotionEventOption({...base,month}).month,'2026-10');
 const cross=promotionEventOption({...base,month:'2026-12',startDate:'2026-11-28',endDate:'2026-12-05'});
 assert.equal(cross.month,'2026-12');assert.equal(cross.startDate,'2026-11-28');
 for(const dates of ['', 'รอยืนยัน', '1-3, 8-10/10/2569','31/02/2569','12-2/10/2569']){
  const event=promotionEventOption({...base,dates});assert.equal(event.startDate,'',dates);assert.equal(event.endDate,'',dates);
 }
 assert.equal(promotionEventOption({...base,workflow:{status:'cancelled'}}),null);
 const safe=promotionEventOption({...base,email:'secret',owner:'secret',calculation:{private:'secret'},input:{channel:'gp',private:'secret'}});
 assert.equal(safe.category,'gp');assert.doesNotMatch(JSON.stringify(safe),/secret/);
});
test('Schedule validation handles cross-month periods, partial dates and changed source schedules',()=>{
 const event=promotionEventOption({...base,startDate:'2026-10-02',endDate:'2026-10-12'});
 const input={month:'2026-10',promotionType:'event',eventId:event.id,eventVersion:promotionEventVersion(event),startDate:event.startDate,endDate:event.endDate};
 assert.equal(promotionSchedule(input,event).scheduleSource,'event');
 assert.equal(promotionSchedule({...input,startDate:'2026-10-03'},event).scheduleSource,'manual');
 assert.equal(promotionScheduleError({month:'2026-12',startDate:'2026-11-28',endDate:'2026-12-05'}),'');
 assert.equal(promotionScheduleError({month:'2026-10'}),'');
 for(const patch of [{month:'2026-13'},{month:'2026-09'},{endDate:''},{startDate:'2026-02-30'},{endDate:'2026-10-01'},{eventId:''},{promotionType:'bad'}])assert.ok(promotionScheduleError({...input,...patch}));
 assert.throws(()=>promotionSchedule(input,{...event,endDate:'2026-10-13'}),e=>e.status===409&&e.code==='event_schedule_changed');
 assert.throws(()=>promotionSchedule(input),e=>e.status===409);
});
test('Event picker and bundled API include web and sheet schedules, remove deleted/cancelled records, and project safe fields',async()=>{
 const DB=previewDatabase(),sheet={name:'Sheet Event',place:'Test place',month:'พฤศจิกายน',dates:'1-10/11/2569'},env={DB,SESSION_SECRET:'fixture-secret',VIEWER_PASSWORD:'fixture-password',BUCKET:{get:async()=>({json:async()=>({version:1,source:{status:'online',fetched_at:new Date().toISOString()},items:[sheet]})})}};
 try{
  const id=base.deletionKey.slice(4),record={id,source:'web',name:base.name,month:base.month,startDate:'2026-10-02',endDate:'2026-10-12',createdAt:new Date().toISOString(),owner:'secret',input:{channel:'gp',contact:'secret'}};
  await DB.prepare('INSERT INTO event_requests (id,created_at,payload) VALUES (?,?,?)').bind(id,record.createdAt,JSON.stringify(record)).run();
  const result=await loadPromotionEvents(env);assert.equal(result.items.length,2);assert.equal(result.warnings.length,0);assert.doesNotMatch(JSON.stringify(result),/secret/);
  assert.equal((await promotionEventDetail(env,base.deletionKey)).startDate,record.startDate);
  const sheetKey=await proposalKey(sheet);assert.equal((await promotionEventDetail(env,sheetKey)).month,'2026-11');
  const login=await worker.fetch(new Request('https://test.local/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=fixture-password'}),{...env,ADMIN_PASSWORD:'fixture-admin'});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const request=()=>new Request('https://test.local/api/promotions/events',{headers:{cookie}});
  const response=await worker.fetch(request(),env);assert.equal(response.status,200);assert.equal((await response.json()).items.length,2);
  assert.equal((await worker.fetch(new Request('https://test.local/api/promotions/events'),env)).status,401);
  await DB.prepare('INSERT INTO event_proposal_deletions (id,deleted_at) VALUES (?,?)').bind(sheetKey,record.createdAt).run();
  await DB.prepare('INSERT INTO event_proposal_workflow (id,status,note,revision,updated_at) VALUES (?,?,?,?,?)').bind(base.deletionKey,'cancelled','fixture','1',record.createdAt).run();
  assert.equal((await loadPromotionEvents(env)).items.length,0);
  await assert.rejects(promotionEventDetail(env,base.deletionKey),e=>e.status===409);
  await assert.rejects(promotionEventDetail(env,sheetKey),e=>e.status===404);
 }finally{DB.close();}
});
