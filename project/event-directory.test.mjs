import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalogEvent,eventDirectoryModel,directoryExcelWorkbook,eventListMarkup} from './out/assets/event-directory.mjs';
import {scheduleModel,combinedSchedule,scheduleDetail} from './out/assets/event-schedule.mjs';
import {applyEventSales} from './events-data.mjs';
const today='2026-09-22';
const history=[{name:'เมกาบางนา 21/1-4/2/69',venue:'Event เก็บเงินเอง',category:'direct',categories:['direct'],month:1,sales:200},{name:'ยังรอยืนยันวันที่',month:2,category:'gp',sales:null},{name:'งานปีหน้า 1-5/10/69',month:10,category:'direct',sales:null}];
const approved={name:'เมกาบางนา',place:'เมกาบางนา',startDate:'2026-01-21',endDate:'2026-02-04',month:'2026-01',trade:'อนุมัติ',ceo:'อนุมัติ',deletionKey:'approved',input:{channel:'direct'}};
test('historical schedules fill past months, preserve undated rows and do not approve future catalog entries',()=>{
 const before=JSON.stringify(history),model=scheduleModel([],{year:2026,scheduleMonth:'2'},today,history);
 assert.equal(model.selected.length,2);assert.equal(model.monthCounts[0],1);assert.equal(model.monthCounts[1],2);assert.equal(model.monthCounts[9],1);
 assert.equal(model.counts.ended,1);assert.equal(model.counts.undated,1);
 assert.equal(scheduleModel([],{year:2026,scheduleMonth:'2',day:'2026-02-04'},today,history).visible.length,1);
 const detail=scheduleDetail(model.selected[0],today);assert.match(detail,/15 วัน/);assert.match(detail,/ข้อมูลย้อนหลัง/);assert.doesNotMatch(detail,/Trade อนุมัติแล้ว/);
 assert.equal(JSON.stringify(history),before);
});
test('a unique approval and historical date/venue pair appears once; ambiguous campaigns stay separate',()=>{
 const combined=combinedSchedule([approved],history,2026,today);assert.equal(combined.length,3);assert.equal(combined[0].source,'both');assert.equal(combined[0].proposalKey,'approved');
 assert.equal(combinedSchedule([{...approved,ceo:'รออนุมัติ'}],history,2026,today).length,3);
 assert.equal(combinedSchedule([approved],[...history,{...history[0],name:'เมกาบางนา อีกกิจกรรม 21/1-4/2/69'} ],2026,today).length,5);
 assert.equal(combinedSchedule([{...approved,input:{channel:'gp'}}],history,2026,today).length,4);
});
test('duration, venue, year boundaries, Thai abbreviations and missing information are consistent',()=>{
 const event=catalogEvent(history[0],2026);assert.equal(event.days,15);assert.equal(event.place,'เมกาบางนา');assert.deepEqual(event.months,[1,2]);
 const old=catalogEvent({name:'งานเดิม',venue:'สถานที่ต้นทาง',date:'11-เม.ย. - 1พ.ค. 68'},2025);assert.equal(old.days,21);assert.deepEqual(old.months,[4,5]);
 const yearEnd=catalogEvent({name:'ข้ามปี 28/12/68-04/01/69'},2026);assert.equal(yearEnd.days,8);assert.deepEqual(yearEnd.months,[1]);
 assert.equal(catalogEvent({name:'ข้อมูลไม่ครบ'},2026).place,'');assert.equal(catalogEvent({name:'ผิดวันที่ 31/02/69',month:2},2026).days,null);
 assert.deepEqual(catalogEvent({name:'ไม่มีวัน',months:[1,2]},2025).months,[1,2]);
});
test('all directory filters intersect and empty results never export unrelated rows',()=>{
 const state={month:'2',listQuery:'เมกา',listType:'direct',listPlace:'เมกาบางนา',listStatus:'ended'};
 assert.equal(eventDirectoryModel(history,2026,state,today).visible.length,1);
 for(const override of [{month:'3'},{listQuery:'ไม่มี'},{listType:'gp'},{listPlace:'ไม่มี'},{listStatus:'live'}])assert.equal(eventDirectoryModel(history,2026,{...state,...override},today).visible.length,0);
 assert.match(eventListMarkup(history,'2026',{listQuery:'ไม่มี'}),/data-event-export disabled/);
 const unsafe=eventListMarkup([{name:'<img src=x>',place:'<script>',sales:0}],2026);assert(!unsafe.includes('<script>'));assert(!unsafe.includes('<img'));assert(unsafe.includes('&lt;img'));
 const book=directoryExcelWorkbook(history,2026,state,today),text=new TextDecoder().decode(book);assert.equal(new DataView(book.buffer).getUint32(0,true),0x04034b50);assert.match(text,/A1:J2/);assert.match(text,/r="F2" s="2"><v>15<\/v>/);assert.match(text,/r="J2" s="3"><v>200<\/v>/);assert(!text.includes('ยังรอยืนยันวันที่'));
 const literal=new TextDecoder().decode(directoryExcelWorkbook([{name:'=1+1',sales:null}],2026,{},today));assert(!literal.includes('<f>'));assert(literal.includes('=1+1'));assert.match(literal,/r="J2" s="3"\//);
});
test('real history contains all prior 2026 months and all catalog names without changing sales',()=>{
 const data=applyEventSales(JSON.parse(fs.readFileSync(new URL('./out/snapshot.json',import.meta.url)))).data['/api/events'];
 for(const year of ['2025','2026']){
  const current=data.years[year],before=JSON.stringify(current),model=scheduleModel([],{year,scheduleMonth:'1'},today,current.items);
  assert.equal(eventDirectoryModel(current.items,year).rows.length,current.items.length);
  assert(model.monthCounts.slice(0,8).every(n=>n>0));assert.equal(JSON.stringify(current),before);
 }
});
test('historical events cross the year boundary using their original catalog year',()=>{
 const history=[{name:'งาน 28/12/68-04/01/69',catalogYear:2025,sales:100}];
 const model=scheduleModel([],{year:2026,scheduleMonth:'1'},today,history);
 assert.equal(model.visible.length,1);assert.equal(model.visible[0].days,8);
 assert.equal(scheduleModel([],{year:2026,scheduleMonth:'12'},today,history).visible.length,0);
});

test('October calendar and directory share eight events, preserve unknown sales and deduplicate later approvals',async()=>{
 const {directoryItems,eventsMarkup}=await import('./out/assets/events.mjs');
 const fairs=[{name:'บ้านและสวน Living Festival 23/10-01/11/69',category:'direct',sales:null},{name:'LHB SME FAST LANE GROWTH SUMMIT 2026 สามย่านมิตรทาวน์ฮอลล์ 28/10/69',category:'direct',sales:null}];
 const six=['เซ็นทรัล นครสวรรค์','เดอะมอลล์ บางแค','โรบินสัน สมุทรปราการ','M space BANGKAPI','Fashion Island','เมกาบางนา'].map((name,i)=>({name,place:name,startDate:'2026-10-01',endDate:'2026-10-20',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',deletionKey:'six-'+i,input:{channel:'gp'},sales:99999}));
 const data={years:{2026:{items:fairs}}},approval={items:six};
 const schedule=scheduleModel(six,{year:2026,scheduleMonth:'10'},today,fairs);
 const items=directoryItems(data,approval,'2026'),directory=eventDirectoryModel(items,'2026',{month:'10'},today);
 assert.equal(schedule.selected.length,8);assert.equal(directory.visible.length,8);
 assert.deepEqual(directory.visible.map(x=>x.name).sort(),schedule.selected.map(x=>x.name).sort());
 assert.ok(directory.visible.every(x=>x.sales==null));
 assert.equal(eventDirectoryModel(items,'2026',{month:'11'},today).visible.length,1);
 assert.equal(schedule.monthCounts[10],1);
 assert.match(scheduleDetail(schedule.selected.find(x=>x.name.includes('LHB')),today),/กำหนดการจากรายงาน/);
 assert.doesNotMatch(scheduleDetail(schedule.selected.find(x=>x.name.includes('LHB')),today),/Trade อนุมัติแล้ว/);
 const fairApproval={name:'บ้านและสวน Living Festival',place:'IMPACT เมืองทองธานี',startDate:'2026-10-23',endDate:'2026-11-01',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',deletionKey:'fair',input:{channel:'direct'}};
 const matching=[{...fairs[0],place:'IMPACT เมืองทองธานี'},fairs[1]];
 assert.equal(combinedSchedule([...six,fairApproval],matching,2026,today).length,8);
 const html=eventListMarkup(items,'2026',{month:'10'});assert.match(html,/Export Excel <span>8 งาน/);
 const book=new TextDecoder().decode(directoryExcelWorkbook(items,'2026',{month:'10'},today));assert.match(book,/A1:J9/);
});
