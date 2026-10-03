import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {parseEventCatalog} from './event-catalog.mjs';
import {reconcileEvents,applyEventSales} from './events-data.mjs';
import {eventsMarkup,render,refreshReadonly} from './out/assets/events.mjs';

const past='ประเภท,สถานที่,,ชื่อ,วันที่,เดือน,ยอดขาย\nEVENT,ห้าง,,งานเก่า,1/1/68,มกราคม,100\nEVENT,ห้าง,,งานเก่า,1/1/68,กุมภาพันธ์,200';
const direct=',สาขา,,,ยอดขาย\n1,เมกาบางนา ชั้น1 21/1-4/2/69,,,999999\n2,งานไม่มีรายงาน 25/01/69,,,999999';
const gp='เดือนมกราคม\nลำดับ,สาขา,,,ยอดขาย\n1,ลานโปร CDS Pinklao 8-21/01/69,,,999999';
const base=()=>parseEventCatalog(past,direct,gp,'2026-09-16T15:00:00Z');
const mall={branch:'Mega Bangna',branch_code:'VC-050',type:'CDS',month_to_date:100000,daily_sales:{'2026-01-21':100000}};
const store={branch:'ร้านประจำ',branch_code:'VA-001',type:'Stand alone',month_to_date:888888};
const report={source:{fetched_at:'2026-09-16T15:00:00Z'},periods:{
 '2026-01':{latest_date:'2026-01-31',branches:[mall,{branch:'อีเวนท์นอก – Mega Bangna',type:'',month_to_date:0,daily_sales:{'2026-01-21':250,'2026-01-22':null}},{branch:'Pinklao',type:'CDS',daily_sales:{'2026-01-08':50}},store]},
 '2026-02':{latest_date:'2026-02-04',branches:[mall,{branch:'อีเวนท์นอก – Mega Bangna',type:'',month_to_date:75,daily_sales:{'2026-02-01':75,'2026-02-10':99999}},{branch:'งานไม่อยู่ในต้นทุน',type:'',daily_sales:{'2026-02-02':25}},store]}
}};
test('2025 stays on cost source; 2026 counts catalog and sums only report daily amounts',()=>{
 const output=reconcileEvents(base(),report),year=output.years['2026'];
 assert.equal(output.years['2025'].summary.sales,300);assert.equal(output.years['2025'].summary.count,1);
 assert.equal(year.summary.count,3);assert.equal(year.summary.sales,400);
 assert.equal(year.items.find(x=>x.name.startsWith('เมกาบางนา')).sales,325);
 assert.equal(year.items.find(x=>x.name.includes('Pinklao')).sales,50);
 assert.equal(year.items.find(x=>x.name.includes('ไม่มีรายงาน')).sales,null);
 assert.equal(year.unallocated_sales,25);assert.equal(year.allocated_sales+year.unallocated_sales,year.summary.sales);
 assert.equal(year.months[11].sales,null);assert.equal(year.mtd_differences>0,true);
});
test('duplicate catalogs do not add sales twice and ambiguous dates stay unallocated',()=>{
 assert.throws(()=>parseEventCatalog(past,direct,''),/ไม่พบรายชื่อ/);
 assert.throws(()=>parseEventCatalog(past,'',gp),/ไม่พบรายชื่อ/);
 const c=base();c.years['2026'].items.push({...c.years['2026'].items[0],name:'Mega Bangna อีกงาน 21/1-4/2/69'});
 const y=reconcileEvents(c,report).years['2026'];assert.equal(y.summary.sales,400);assert.equal(y.unallocated_sales,350);
 const dup=parseEventCatalog(past,direct+'\n3,เมกาบางนา ชั้น1 21/1-4/2/69,,,900',gp);assert.equal(dup.years['2026'].items.length,3);
});
test('cloud report replacement recomputes totals and no report never uses cost sales',()=>{
 const c=base();assert.equal(reconcileEvents(c,{periods:{}}).years['2026'].summary.sales,null);
 const updated=structuredClone(report);updated.periods['2026-01'].branches[1].daily_sales['2026-01-21']=500;
 assert.equal(applyEventSales({data:{'/api/events':c,'/api/daily-sales':updated}}).data['/api/events'].years['2026'].summary.sales,650);
});
test('year switch renders only selected year and refresh preserves selection',async()=>{
 const data=reconcileEvents(base(),report),modern=eventsMarkup(data,{year:'2026'}),old=eventsMarkup(data,{year:'2025'});
 assert.match(modern,/ภาพรวมปี 2569/);assert.doesNotMatch(modern,/ภาพรวมปี 2568|งานเก่า/);
 assert.match(old,/ภาพรวมปี 2568/);assert.doesNotMatch(old,/ภาพรวมปี 2569|งานไม่มีรายงาน/);
 let change;const select={value:'2025',addEventListener:(event,handler)=>{change=handler;},focus(){}};
 const root={dataset:{},innerHTML:'',querySelector:()=>select};globalThis.location={href:'http://localhost/events',search:''};globalThis.history={replaceState(){}};
 await render(root,{api:async()=>data});await change();assert.equal(root.dataset.eventYear,'2025');
 await refreshReadonly(root,{api:async()=>data});assert.match(root.innerHTML,/ภาพรวมปี 2568/);
});
test('real snapshot preserves all cost names and reconciles every report baht',async()=>{
 const snapshot=JSON.parse(await fs.readFile(new URL('./out/snapshot.json',import.meta.url)));
 const data=applyEventSales(snapshot).data['/api/events'],y=data.years['2026'];
 assert.equal(data.years['2025'].summary.count,116);assert.equal(y.summary.count,75);
 assert.equal(y.summary.sales,6696096.88);assert.equal(y.allocated_sales,6107373.95);
 assert.equal(y.unallocated_sales,588722.93);assert.equal(y.unmatched.length,8);
 assert.equal(y.items.find(x=>x.name.includes('MPR.016 Anello) 03-16/09')).sales,202395);
 assert.equal(y.items.find(x=>x.name.includes('Sneaker Showcase')).sales,null);
 assert.equal(y.months.reduce((n,m)=>n+m.count,0),75);
 for(const file of await fs.readdir(new URL('./out/',import.meta.url)))if(file.endsWith('.html')){
  const html=await fs.readFile(new URL('./out/'+file,import.meta.url),'utf8');assert.match(html,/<summary data-nav="events">Event<\/summary>/);assert.match(html,/<a href="\/events">ภาพรวม Event<\/a>/);assert.match(html,/<a href="\/event-proposals">เสนอ Event<\/a>/);assert.doesNotMatch(html,/aria-label="Event"/);
 }
});
