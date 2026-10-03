import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeVenueDatabase,historicalSchedules,reportEventRows} from './event-venue-database.mjs';
import {historyFor,identifyVenue,defaultsFor,predictRange} from './out/assets/event-predict-model.mjs';
const cost=(over={})=>({id:'direct-1',name:'Mega Bangna 21/01-04/02/69',channel:'direct',month:1,row:1,net:1100,days:11,cogs:220,space:110,pc:110,shipping:0,other:0,target:2000,...over});
const period=(key,branches)=>({year:Number(key.slice(0,4)),month:Number(key.slice(5)),latest_date:`${key}-${key.endsWith('02')?'28':'31'}`,branches:[{branch:'permanent',branch_code:'VC-001'},...branches,{branch:'store',branch_code:'VA-001'}]});
const row=(branch,daily,more={})=>({branch,branch_code:'',type:'',daily_sales:daily,...more});
const costs=records=>({records,source:{status:'online',fetched_at:'2026-09-20T00:00:00Z'}});
const report=periods=>({periods});
test('special and ordinary events at the same venue keep separate sales and baseline identities',()=>{
 const events=[cost({id:'special',name:'บ้านและสวน ไบเทค 1-5/01/69',days:5}),cost({id:'ordinary',name:'อีเวนท์นอก ไบเทค 1-5/01/69',days:5})];
 const monthly=report({'2026-01':period('2026-01',[row('อีเวนท์นอก บ้านและสวน ไบเทค 1-5/01/69',{'2026-01-01':5000}),row('อีเวนท์นอก ไบเทค 1-5/01/69',{'2026-01-01':900})])});
 const db=mergeVenueDatabase(costs(events),monthly);
 assert.equal(db.records.length,2);
 const special=historyFor(db.records,'baan-suan',null,'2026-09-22');assert.equal(special.length,1);assert.equal(special[0].net,5000);assert.equal(special[0].usable,true);
 const ordinary=historyFor(db.records,identifyVenue('ไบเทค').id,null,'2026-09-22');assert.equal(ordinary.length,1);assert.equal(ordinary[0].net,900);
});
test('cross-month report replaces sheet sales once; complete schedule includes zero-sales days; cost ratios keep original denominator',()=>{
 const db=mergeVenueDatabase(costs([cost()]),report({'2026-01':period('2026-01',[row('อีเวนท์นอก Mega Bangna',{'2026-01-21':1100})]),'2026-02':period('2026-02',[row('อีเวนท์นอก Mega Bangna',{'2026-02-01':400})])}));
 const r=db.records[0];assert.equal(r.net,1500);assert.equal(r.days,15);assert.equal(r.costNet,1100);assert.equal(r.difference,400);assert.equal(r.sources.length,3);
 const h=historyFor(db.records,'mega',null,'2026-09-20'),d=defaultsFor(h);assert.equal(d.cogs,20);assert.equal(d.pc,10);
});
test('2025 repeated venue separates date ranges and joins monthly continuations without doubling days',()=>{
 const header=['ประเภท','สาขา','ชื่อสาขา (สถานที่)','ชื่อสาขา','วันที่ Event','เดือนที่จัด','ยอดขาย','จำนวนวัน'];
 const rows=[header,['EVENT','CDS Bangna','','CDS Bangna','11 ต.ค. - 03 พ.ย. 68','ตุลาคม',2100,24],['EVENT','CDS Bangna','','CDS Bangna','11 ต.ค. - 03 พ.ย. 68','พฤศจิกายน',300,24],['EVENT','CDS Bangna','','CDS Bangna','1-5 กค.68','กรกฎาคม',500,5]];
 const db=mergeVenueDatabase(costs(historicalSchedules(rows)),report({}));assert.equal(db.records.length,2);assert.equal(db.records[0].net,2400);assert.equal(db.records[0].days,24);assert.equal(db.records[1].range.start,'2025-07-01');
 assert.equal(historyFor(db.records,'bangna',null,'2026-09-20').filter(r=>r.usable).length,2);
});
test('partial report keeps paired sheet sales and days; partial 2025 fallback is excluded',()=>{
 const db=mergeVenueDatabase(costs([cost()]),report({'2026-01':period('2026-01',[row('อีเวนท์นอก Mega Bangna',{'2026-01-21':1100})])}));assert.equal(db.records[0].net,1100);assert.equal(db.records[0].days,11);assert.equal(db.records[0].salesSource,'google');
 const old=cost({year:2025,range:{start:'2025-01-21',end:'2025-02-04'},name:'Mega Bangna'});assert(mergeVenueDatabase(costs([old]),report({})).records[0].exclusion);
});
test('duplicate source months, competing report rows and overlapping campaigns never inflate baseline',()=>{
 const p={'2026-01':period('2026-01',[row('อีเวนท์นอก Mega Bangna',{'2026-01-21':1100}),row('อีเวนท์นอก Mega Bangna',{'2026-01-21':1100})]),'2026-02':period('2026-02',[row('อีเวนท์นอก Mega Bangna',{'2026-02-01':400})])};
 assert(mergeVenueDatabase(costs([cost()]),report(p)).records[0].exclusion);
 assert(mergeVenueDatabase(costs([cost(),cost({row:2})]),report({})).records[0].exclusion);
 const overlap=mergeVenueDatabase(costs([cost(),cost({name:'Mega Bangna other 21/01-04/02/69',row:3})]),report(p));assert(overlap.records.slice(0,2).every(r=>r.exclusion));
});
test('permanent counters excluded; missing schedule shown but not used; explicit report-only schedule may be used',()=>{
 const p=period('2026-01',[row('พิษณุโลก',{'2026-01-21':999},{type:'RBS'}),row('Fashion Island',{'2026-01-21':999},{type:'CDS'}),row('ลานโปร CDS Pinklao',{'2026-01-21':100}),row('อีเวนท์นอก Terminal21 Asok 1-2/01/69',{'2026-01-01':200,'2026-01-02':300})]);
 assert.equal(reportEventRows(p).length,2);const db=mergeVenueDatabase(costs([]),report({'2026-01':p}));assert.equal(db.records.find(r=>r.venue.id==='terminal-asok').net,500);assert(db.records.find(r=>r.venue.id==='pinklao').exclusion);
});
test('different malls do not collapse, historical typo years fail closed, future events excluded',()=>{
 assert.notEqual(identifyVenue('เดอะมอลล์โคราช').id,identifyVenue('CDS โคราช').id);assert.equal(predictRange('9/10/1968',2025),null);
 const db=mergeVenueDatabase(costs([cost({name:'Mega Bangna 1-4/12/69'})]),report({}));assert.equal(historyFor(db.records,'mega',null,'2026-09-20')[0].usable,false);
});
test('real dataset includes both years and produces traceable records with no cross-source addition',()=>{
 const d=JSON.parse(fs.readFileSync('event-predict.snapshot.json'));const r=JSON.parse(fs.readFileSync('out/snapshot.json')).data['/api/daily-sales'];const db=mergeVenueDatabase(d,r,{today:'2026-09-20'});
 assert.equal(db.source.sources[1].months.length,12);assert.equal(db.source.sources[2].months.length,9);
 for(const year of [2025,2026])assert(db.records.some(r=>r.salesSource==='sales-'+year&&!r.exclusion));
 const mega=db.records.find(r=>r.channel==='direct'&&r.range?.start==='2026-01-21'&&r.venue.id==='mega');assert.equal(mega.net,347422);assert.equal(mega.days,15);assert.equal(mega.costNet,244965);
 for(const r of db.records){if(r.salesSource.startsWith('sales')&&!r.exclusion){assert(r.sources.some(s=>s.source.startsWith('sales')));assert(r.days>0);}}
});
test('Thai date variants preserve both endpoints and valid cross-year schedules',()=>{
 for(const [text,start,end] of [['22 พ.ค.68 - 4 มิย 2568','2025-05-22','2025-06-04'],['19 มิย.-2 ก.ค.68','2025-06-19','2025-07-02'],['14-พ.ค.. - 4 มิ.ย.68','2025-05-14','2025-06-04'],['11-เม.ย. - 1พ.ค.68','2025-04-11','2025-05-01'],['18 ธ.ค.68 - 4 ม.ค.69','2025-12-18','2026-01-04']])assert.deepEqual(predictRange(text,2025),{start,end});
 assert.equal(predictRange('22 พ.ค.68 - 4 UNKNOWN 2568',2025),null);
 assert.equal(identifyVenue('สถาบันการจัดการปัญญาภิวัฒน์ ถนนแจ้งวัฒนะ').id,'pim');
});
test('row activity outside a schedule does not leak partial totals into another event',()=>{
 const c=cost({name:'Fashion Island 09-22/07/69',channel:'gp',month:7,net:700,days:14});
 const p=period('2026-07',[row('Fashion Island',{'2026-07-01':500,'2026-07-10':300},{branch_code:'Sneaker Showcase'})]);
 const db=mergeVenueDatabase(costs([c]),report({'2026-07':p}));assert.equal(db.records[0].net,700);assert.equal(db.records[0].salesSource,'google');
 const outside=mergeVenueDatabase(costs([cost({name:'Mega Bangna 1-10/01/69'})]),report({'2026-01':period('2026-01',[row('อีเวนท์นอก Mega Bangna',{'2026-01-01':1000,'2026-01-05':1000,'2026-01-15':18000})])}));assert.equal(outside.records[0].net,1100);assert.equal(outside.records[0].salesSource,'google');
});
