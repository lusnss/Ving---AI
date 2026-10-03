import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {handleEventStaff} from './event-staff-data.mjs';
import {buildEventSchedule} from './event-logistics-data.mjs';
import {sheetScheduleItems} from './out/assets/event-logistics.mjs';
import {staffKey} from './out/assets/event-staff.mjs';
import {scheduleModel,scheduleMarkup} from './out/assets/event-schedule.mjs';
const csv='ประเภท,สถานที่ (หน้างาน),Set up,เวลา set up,เริ่มขายจริง,วันจบงาน,เวลาเข้าเก็บกลับ\nEvent,Test Hall,08/10/2026,21:00,09/10/2026,10/10/2026,22:00';
test('shared assignments persist, isolate setup/pickup, reject stale writes and enforce edit/origin permissions',async()=>{
 const db=previewDatabase(),env={DB:db,BUCKET:{put:async()=>{}}},previousFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(csv);
 const items=sheetScheduleItems(buildEventSchedule(csv),'logistics'),key=staffKey(items[0]);
 const call=(body,permissions={canEdit:true},origin='https://test.example')=>handleEventStaff(new Request('https://test.example/api/events/staff',{method:body?'PUT':'GET',headers:{origin},...(body?{body:JSON.stringify(body)}:{})}),env,permissions);
 try{
  assert.equal((await call({key,names:['Nat'],revision:null},{canEdit:false})).status,403);
  assert.equal((await call({key,names:['Nat'],revision:null},undefined,'https://other.example')).status,403);
  assert.equal((await call({key,names:['Other'],revision:null})).status,400);
  let saved=await (await call({key,names:['Nat','Tom'],revision:null})).json();assert.deepEqual(saved.names,['Nat','Tom']);
  assert.equal((await call({key,names:['Not'],revision:null})).status,409);
  const read=await (await call(null,{canEdit:false})).json();assert.deepEqual(read.items[key].names,['Nat','Tom']);assert.equal(read.canEdit,false);assert.equal(read.items[staffKey(items[1])],undefined);
  const stale=saved.revision;saved=await (await call({key,names:[],revision:saved.revision})).json();assert.deepEqual(saved.names,[]);
  assert.equal((await call({key,names:['Not'],revision:stale})).status,409);
  assert.equal(staffKey({...items[0],key:'sheet-schedule-999-setup'}),key);
  assert.notEqual(staffKey({...items[0],setupDate:'2026-10-09'}),key);
 }finally{globalThis.fetch=previousFetch;db.close();}
});
test('staff filters and monthly summary keep setup and pickup separate',()=>{
 const feed=buildEventSchedule(csv),items=sheetScheduleItems(feed,'logistics');
 const state={year:'2026',scheduleMonth:'10',scheduleMode:'logistics',view:'list',staffFilter:'Nat',staff:{canEdit:true,items:{[staffKey(items[0])]:{names:['Nat','Tom'],revision:'x'}}}};
 const model=scheduleModel([],state,'2026-10-02',[],feed);assert.equal(model.visible.length,1);assert.equal(model.visible[0].kind,'setup');assert.equal(model.selected.length,2);
 const html=scheduleMarkup({schedule:feed},state,'2026-10-02');assert.match(html,/ใครไปงานไหน/);assert.match(html,/ผู้ไปงาน: Nat, Tom/);assert.match(html,/data-staff-name="Not"/);
 state.staffFilter='unassigned';assert.equal(scheduleModel([],state,'2026-10-02',[],feed).visible[0].kind,'pickup');
});
