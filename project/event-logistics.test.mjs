import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEventSchedule,scheduleDate,scheduleTime,createEventScheduleLoader} from './event-logistics-data.mjs';
import {sheetScheduleItems,retainSchedule} from './out/assets/event-logistics.mjs';
import {scheduleModel,scheduleMarkup,scheduleDetail} from './out/assets/event-schedule.mjs';
import worker from './dist/server/index.js';
const header=['ประเภท','สถานที่ (หน้างาน)','Set up','เวลา set up','เริ่มขายจริง','วันจบงาน','เวลาเข้าเก็บกลับ'];
const csv=(rows)=>[header,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
const fixture=csv([['อีเว้นท์ (GP)','Venue A','30/9/2026','22.30 น.','1/10/2026','10/10/2026','21.00 น.']]);
const state={year:2026,scheduleMonth:'10',scheduleMode:'logistics'};
const feed=buildEventSchedule(fixture,'2026-10-01T00:00:00Z');
test('strict Thai sheet dates, quoted multiline fields and malformed schema',()=>{
 assert.equal(scheduleDate('13/10/26'),'2026-10-13');assert.equal(scheduleDate('13/10/2569'),'2026-10-13');
 assert.equal(scheduleDate('29/2/2028'),'2028-02-29');assert.equal(scheduleDate('31/2/2026'),null);assert.equal(scheduleDate('บูธประจำ'),null);
 assert.equal(scheduleTime('18.30น.'),'18:30 น.');assert.equal(scheduleTime('24.00 น.'),null);
 const parsed=buildEventSchedule(csv([['อีเว้นท์\nGP','Test "Hall"','1/10/2026','','1/10/2026','2/10/2026','']]));assert.equal(parsed.items[0].name,'Test "Hall"');assert.equal(parsed.items[0].type,'อีเว้นท์ GP');
 assert.throws(()=>buildEventSchedule('wrong header'));assert.deepEqual(buildEventSchedule(csv([])).items,[]);
});
test('logistics uses point dates across months independently of the old calendar',()=>{
 const old={name:'Old catalog',catalogYear:2026,startDate:'2026-10-01',endDate:'2026-10-31'};
 const october=scheduleModel([],state,'2026-10-01',[old],feed);
 assert.equal(october.selected.length,1);assert.equal(october.selected[0].kind,'pickup');assert.equal(october.monthCounts[8],1);assert.equal(october.monthCounts[9],1);
 assert.equal(scheduleModel([],{...state,day:'2026-10-05'},'2026-10-01',[],feed).visible.length,0);
 assert.equal(scheduleModel([],{...state,scheduleMode:'timeline',day:'2026-10-05'},'2026-10-01',[],feed).visible.length,0);
 assert.equal(scheduleModel([],state,'2026-10-01',[old],buildEventSchedule(csv([]))).items.length,0);
 assert.equal(scheduleModel([],state,'2026-10-01',[old]).items.length,0);
});
test('timeline preserves report history and approved events regardless of the new sheet',()=>{
 const history=[{name:'Report January 1-5/1/69',catalogYear:2026,category:'direct'},{name:'Report October 1-31/10/69',catalogYear:2026,category:'direct'}];
 const rows=[{name:'Approved October',place:'Old venue',startDate:'2026-10-02',endDate:'2026-10-06',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',deletionKey:'approved-october',input:{channel:'gp'}}];
 const timeline={...state,scheduleMode:'timeline',day:'2026-10-05'};
 const expected=scheduleModel(rows,timeline,'2026-10-01',history);
 assert.equal(expected.monthCounts[0],1);assert.equal(expected.selected.length,2);assert.equal(expected.visible.length,2);
 for(const source of [feed,{...feed,source:{...feed.source,status:'stale'}},{items:[],source:{status:'unavailable'}},buildEventSchedule(csv([]))]){
  assert.deepEqual(scheduleModel(rows,timeline,'2026-10-01',history,source),expected);
 }
 assert.equal(scheduleModel(rows,state,'2026-10-01',history,feed).selected[0].name,'Venue A');
});
test('source labels, links and failures follow the selected mode',()=>{
 const timeline={...state,scheduleMode:'timeline'},offline={items:[],source:{status:'unavailable'}};
 const timelineHtml=scheduleMarkup({schedule:offline},timeline,'2026-10-01');
 assert.match(timelineHtml,/รายงาน \+ งานอนุมัติ/);assert.match(timelineHtml,/data-schedule-mode/);
 assert.doesNotMatch(timelineHtml,/Google Sheets|เปิดชีตต้นทาง|โหลดสำเร็จล่าสุด|ยังโหลดชีตต้นทางไม่ได้/);
 const failedApproval={schedule:feed,failures:['อ่านสถานะอนุมัติไม่ได้']};
 assert.match(scheduleMarkup(failedApproval,timeline,'2026-10-01'),/อ่านสถานะอนุมัติไม่ได้/);
 const logisticsHtml=scheduleMarkup(failedApproval,state,'2026-10-01');
 assert.match(logisticsHtml,/Google Sheets/);assert.match(logisticsHtml,/เปิดชีตต้นทาง/);
 assert.doesNotMatch(logisticsHtml,/อ่านสถานะอนุมัติไม่ได้/);
 assert.match(scheduleMarkup({},state,'2026-10-01'),/ยังโหลดชีตต้นทางไม่ได้/);
});
test('missing pickup date or time remains unconfirmed; same-day actions remain distinct; unknown setup is retained',()=>{
 const missing=buildEventSchedule(csv([['Event','No pickup time','1/10/2026','07.00 น.','1/10/2026','2/10/2026',''],['Event','No dates','','07.00 น.','','','21.00 น.']]));
 const items=sheetScheduleItems(missing,'logistics');assert.equal(items.length,4);assert.equal(items.filter(x=>x.kind==='pickup').every(x=>x.range===null),true);
 assert.equal(scheduleModel([],{...state,scheduleMonth:'unknown'},'2026-10-01',[],missing).selected.length,2);
 const both=buildEventSchedule(csv([['Event','One day','28/10/2026','07.00 น.','28/10/2026','28/10/2026','18.30น.']]));
 assert.equal(new Set(sheetScheduleItems(both,'logistics').map(x=>x.key)).size,2);
 const nextYear=buildEventSchedule(csv([['Event','New year','31/12/2026','','1/1/2027','2/1/2027','21.00 น.']]));
 assert.equal(scheduleModel([],{year:2027,scheduleMonth:'1',scheduleMode:'logistics'},'2026-10-01',[],nextYear).selected[0].kind,'pickup');
});
test('source markup escapes text and labels end-date pickup basis without claiming approval',()=>{
 const data=buildEventSchedule(csv([['Event','<img src=x>','1/10/2026','07.00 น.','1/10/2026','2/10/2026','21.00 น.']]));
 const html=scheduleMarkup({schedule:data},state,'2026-10-01')+scheduleDetail(sheetScheduleItems(data,'logistics')[1]);
 assert.match(html,/Timeline Event/);assert.match(html,/Set up &amp; เก็บกลับ/);assert.match(html,/อิงวันจบงาน/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|CEO อนุมัติแล้ว/);
 assert.match(scheduleMarkup({schedule:{items:[],source:{status:'unavailable'}}},state),/ยังโหลดชีตต้นทางไม่ได้/);
});
test('every read fetches approved columns; changed and empty sources replace cache, failures retain stale',async()=>{
 let body=fixture,fail=false,calls=0;const saved=new Map();
 const load=createEventScheduleLoader({fetchImpl:async(url,options)=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('tq'),'select A,B,K,L,M,O,P where B is not null');assert.equal(options.cache,'no-store');if(fail)throw Error();return new Response(body);}});
 const env={BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>saved.set(key,value)}};
 assert.equal((await load(env)).source.status,'online');assert.equal((await load(env)).items[0].endDate,'2026-10-10');assert.equal(calls,2);
 body=fixture.replace('10/10/2026','13/10/2026');assert.equal((await load(env)).items[0].endDate,'2026-10-13');
 fail=true;assert.equal((await load(env)).source.status,'stale');fail=false;body=csv([]);assert.equal((await load(env)).items.length,0);
 const offline={items:[],source:{status:'unavailable'}};assert.equal(retainSchedule(offline,feed).items.length,1);assert.equal(retainSchedule(offline,feed).source.status,'stale');assert.equal(retainSchedule(buildEventSchedule(csv([])),feed).items.length,0);
});
test('schedule API requires login, permits viewers, is read-only/no-store and returns only schedule fields',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(fixture);
 try{
 const env={SESSION_SECRET:'test-schedule-source',ADMIN_PASSWORD:'editor-test',VIEWER_PASSWORD:'viewer-test',BUCKET:{put:async()=>{}}};
 const request=(method='GET',cookie='')=>new Request('https://example.test/api/events/schedule',{method,headers:{cookie}});
 assert.equal((await worker.fetch(request(),env)).status,401);
 const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:'viewer-test'})}),env);const cookie=login.headers.get('set-cookie').split(';')[0];
 const response=await worker.fetch(request('GET',cookie),env);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json();assert.equal(data.items[0].setupDate,'2026-09-30');assert.equal(data.source.status,'online');assert.equal(Object.keys(data.items[0]).sort().join(','),'endDate,key,name,pickupTime,place,setupDate,setupTime,startDate,type');
 assert.equal((await worker.fetch(request('POST',cookie),env)).status,405);
 }finally{globalThis.fetch=originalFetch;}
});
