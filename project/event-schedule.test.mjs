import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedSchedule,scheduleModel,scheduledIn,eventStatus,scheduleMarkup,scheduleDetail} from './out/assets/event-schedule.mjs';
import {eventsMarkup} from './out/assets/events.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';

const id='55555555-5555-4555-8555-555555555555',key='web:'+id;
const row={id,source:'web',deletionKey:key,name:'Event ทดสอบ',place:'สถานที่ทดสอบ',startDate:'2026-09-28',endDate:'2026-10-04',month:'2026-09',trade:'อนุมัติ',ceo:'อนุมัติ',floor:'1',input:{channel:'gp'}};
const state={year:'2026',scheduleMonth:'9'},today='2026-09-22';
test('calendar includes only both approvals, every occupied month, and deduplicates keys',()=>{
 const input=[row,row,{...row,deletionKey:'pending',ceo:'รออนุมัติ'},{...row,deletionKey:'rejected',trade:'ไม่อนุมัติ'}];
 const before=JSON.stringify(input),model=scheduleModel(input,state,today);
 assert.equal(model.items.length,1);assert.equal(model.monthCounts[8],1);assert.equal(model.monthCounts[9],1);assert.equal(model.counts.upcoming,1);assert.equal(JSON.stringify(input),before);
 assert.equal(scheduleModel([{...row,ceo:'ไม่อนุมัติ'}],state,today).selected.length,0);
 const cross=approvedSchedule([{...row,startDate:'2026-12-28',endDate:'2027-01-03'}])[0];
 assert(scheduledIn(cross,2027,'1'));assert(!scheduledIn(cross,2027,'12'));
});
test('invalid or missing dates retain known month and unscheduled events remain discoverable',()=>{
 const undated={...row,startDate:'',endDate:'',dates:'รอยืนยัน',month:'2026-10'};
 assert.equal(scheduleModel([undated],{...state,scheduleMonth:'10'},today).counts.undated,1);
 assert.equal(scheduleModel([{...undated,month:'',createdAt:'2026-09-22'}],{...state,scheduleMonth:'unknown'},today).selected.length,1);
 const unknown={name:'ยังไม่กำหนดเดือน',trade:'อนุมัติ',ceo:'อนุมัติ'};
 assert.equal(scheduleModel([unknown],{...state,scheduleMonth:'unknown'},today).selected.length,1);
 assert.equal(approvedSchedule([{...undated,startDate:'2026-02-31',endDate:'2026-02-31'}])[0].range,null);
});
test('status boundaries, search, day filtering, and leap-day calendar are deterministic',()=>{
 const item=approvedSchedule([row])[0];assert.equal(eventStatus(item,'2026-09-28'),'live');assert.equal(eventStatus(item,'2026-10-04'),'live');assert.equal(eventStatus(item,'2026-10-05'),'ended');
 assert.equal(scheduleModel([row],{...state,query:'สถานที่'},today).visible.length,1);
 assert.equal(scheduleModel([row],{...state,query:'ไม่มีชื่อนี้'},today).visible.length,0);
 assert.equal(scheduleModel([row],{...state,day:'2026-09-28'},today).visible.length,1);
 assert.equal(scheduleModel([row],{...state,day:'2026-09-22'},today).visible.length,0);
 assert.equal(scheduleModel([row],{...state,status:'live'},today).visible.length,0);
 const leap=scheduleMarkup({items:[]},{year:'2028',scheduleMonth:'2'},today);
 assert.match(leap,/data-schedule-day="2028-02-29"/);assert.doesNotMatch(leap,/data-schedule-day="2028-02-30"/);
});
test('proposal strings are escaped, missing data is honest, and forecast never becomes sales',()=>{
 const dangerous={...row,name:'<img src=x onerror=alert(1)>',sales:'99999999'};
 const html=scheduleMarkup({items:[dangerous]},state,today)+scheduleDetail(approvedSchedule([dangerous])[0],today);
 assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(!html.includes('99999999'));
 const catalog={years:{2026:{summary:{sales:125,count:1},items:[],months:[]}}},before=JSON.stringify(catalog);
 const page=eventsMarkup(catalog,state,{items:[row]});assert(page.includes('฿125.00'));assert.equal(JSON.stringify(catalog),before);
 assert.match(eventsMarkup(catalog,{year:'2027',scheduleMonth:'1'},{items:[{...row,startDate:'2026-12-28',endDate:'2027-01-03'}]}),/2570/);
 assert.match(scheduleMarkup({items:[],failures:['อ่านข้อมูลไม่ได้']},state,today),/ยังโหลดตารางงานไม่ได้/);
});
test('authenticated endpoint reflects both approvals, revocation and deletion without leaking forecasts or personal fields',async()=>{
 const sheet={version:1,items:[],source:{status:'online',fetched_at:new Date().toISOString()}};
 const env={SESSION_SECRET:'schedule-test',ADMIN_PASSWORD:'schedule-admin',VIEWER_PASSWORD:'schedule-viewer',DB:previewDatabase(),BUCKET:{get:async name=>name==='event-proposals.json'?{json:async()=>sheet}:null}};
 const request=(path,method='GET',body,cookie='')=>new Request('https://example.test'+path,{method,headers:{cookie,origin:'https://example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await env.DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind(id,'2026-09-22T00:00:00Z',JSON.stringify({...row,trade:'รออนุมัติ',ceo:'รออนุมัติ',owner:'PRIVATE_TEST_VALUE',sales:'99999999',input:{...row.input,privateField:'PRIVATE_TEST_VALUE'}})).run();
  const login=async password=>(await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),env)).headers.get('set-cookie').split(';')[0];
  const admin=await login('schedule-admin'),viewer=await login('schedule-viewer');
  const read=async()=>{const res=await worker.fetch(request('/api/events/approved','GET',null,viewer),env);assert.equal(res.status,200);return res.json();};
  const approve=async(field,status)=>assert.equal((await worker.fetch(request('/api/event-proposals/approval','PATCH',{key,field,status},admin),env)).status,200);
  assert.equal((await worker.fetch(request('/api/events/approved'),env)).status,401);
  assert.equal((await worker.fetch(request('/api/event-proposals/approval','PATCH',{key,field:'ceo',status:'อนุมัติ'},viewer),env)).status,403);
  assert.equal((await read()).items.length,0);
  await approve('trade','อนุมัติ');assert.equal((await read()).items.length,0);
  await approve('ceo','อนุมัติ');const data=await read();assert.equal(data.items.length,1);assert.equal(scheduleModel(data.items,state,today).selected.length,1);assert(!JSON.stringify(data).includes('PRIVATE_TEST_VALUE'));assert(!JSON.stringify(data).includes('99999999'));
  await approve('ceo','ไม่อนุมัติ');assert.equal((await read()).items.length,0);
  await approve('ceo','อนุมัติ');assert.equal((await read()).items.length,1);
  await worker.fetch(request('/api/event-proposals/'+key,'DELETE',null,admin),env);assert.equal((await read()).items.length,0);
  const unavailable=await worker.fetch(request('/api/events/approved','GET',null,viewer),{...env,DB:undefined});assert.equal((await unavailable.json()).unavailable,true);
 }finally{env.DB.close();}
});
