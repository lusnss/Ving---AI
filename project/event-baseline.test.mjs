import assert from 'node:assert/strict';
import test from 'node:test';
import {historyFor,baselineFor,baselineMonths,baselineMonthLabel,rowsForBaseline,forecast,historySignature} from './out/assets/event-predict-model.mjs';
import {baselinePickerMarkup,baselineEventsMarkup} from './out/assets/event-baseline.mjs';
import {prepareEventRequest,createEventRequest,listEventRequests} from './event-requests.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';
import {previewDatabase} from './preview-db.mjs';

const records=[
 {id:'a',name:'เมกาบางนา A',range:{start:'2026-01-01',end:'2026-01-02'},channel:'direct',days:2,net:2000},
 {id:'b',name:'เมกาบางนา B',range:{start:'2026-01-30',end:'2026-02-06'},channel:'gp',days:8,net:24000},
 {id:'c',name:'เมกาบางนา C',range:{start:'2026-02-07',end:'2026-02-16'},channel:'direct',days:10,net:10000},
 {id:'d',name:'เมกาบางนา D',range:{start:'2025-01-01',end:'2025-01-05'},channel:'gp',days:5,net:25000},
 {id:'e',name:'เมกาบางนา E',range:{start:'2026-03-01',end:'2026-03-03'},channel:'direct',days:3,net:900000,exclusion:'ยอดไม่ครบ'},
 {id:'f',name:'เมกาบางนา F',range:{start:'2027-01-01',end:'2027-01-03'},channel:'gp',days:3,net:900000},
];
const rows=historyFor(records,'mega',null,'2026-09-21');
const input={mode:'history',channel:'direct',days:10,cogs:20,rent:1000,pc:100,shipping:100,other:0,targetMode:'roi',target:'',downside:10,upside:20,proposalDate:'2026-09-21',confirmBy:'2026-09-25'};
const body=()=>({id:crypto.randomUUID(),place:'เมกาบางนา',startDate:'2026-10-01',endDate:'2026-10-10',referenceKey:historySignature(rows),input:{...input,baselineMonth:'2026-01'}});
const request=body=>new Request('https://example.test/api/event-requests',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});

test('monthly baseline keeps years separate and counts a cross-month event once in its start month',()=>{
 const months=baselineMonths(rows);
 assert.deepEqual(months.map(m=>m.month),['2027-01','2026-03','2026-02','2026-01','2025-01']);
 assert.deepEqual(rowsForBaseline(rows,'2026-01').map(r=>r.id),['a','b']);
 assert.deepEqual(rowsForBaseline(rows,'2026-02').map(r=>r.id),['c']);
 assert.deepEqual(baselineFor(rows,'2026-01'),{rate:2600,days:10,sales:26000,observations:2});
 assert.equal(baselineFor(rows,'2025-01').rate,5000);
 assert.deepEqual(baselineFor(rows),{rate:2440,days:25,sales:61000,observations:4});
 assert.equal(months.reduce((sum,m)=>sum+m.observations,0),4);
 assert.equal(months.find(m=>m.month==='2026-03').excluded,1);
 assert.equal(baselineMonthLabel('2026-01'),'มกราคม 2569');
});
test('month changes sales, scenarios and P&L while preserving fixed costs and entered assumptions',()=>{
 const all=forecast(rows,input),jan=forecast(rows,{...input,baselineMonth:'2026-01'}),feb=forecast(rows,{...input,baselineMonth:'2026-02'});
 assert.equal(all.base.sales,24400);assert.equal(jan.base.sales,26000);assert.equal(feb.base.sales,10000);
 assert.deepEqual(jan.scenarios.map(s=>s.sales),[23400,26000,31200]);
 assert.equal(jan.base.profit,18700);assert.equal(feb.base.profit,5900);
 assert.equal(jan.base.fixed,all.base.fixed);assert.equal(jan.base.fixed,feb.base.fixed);assert.equal(jan.roiTarget,all.roiTarget);
 assert.equal(jan.baseline.month,'2026-01');assert.equal(jan.observations,2);
 assert.equal(input.baselineMonth,undefined);
});
test('invalid, missing, incomplete or future month never falls back to the all-venue average',()=>{
 for(const month of ['2026-13','2026-04','2026-03','2027-01','<img src=x>']){
  const result=forecast(rows,{...input,baselineMonth:month});
  assert.equal(result.base.sales,null);assert.equal(result.base.profit,null);assert(result.errors.includes('baselineMonth'));
 }
 assert.equal(forecast(rows,{...input,mode:'manual',expectedSales:35000}).base.sales,35000);
});
test('picker and event table expose counts, months, days, selected state and exclusions without opening details',()=>{
 const html=baselinePickerMarkup(rows,'2026-01','เมกาบางนา');
 assert.match(html,/6 Event/);assert.match(html,/4 Event \/ 25 วันขาย/);assert.match(html,/data-baseline-month="2026-01" aria-pressed="true"/);
 assert.match(html,/data-baseline-month="2026-03" aria-pressed="false" disabled/);assert.match(html,/ค่าเฉลี่ยทั้งหมดของห้าง/);
 assert.match(html,/งานข้ามเดือนนับครั้งเดียว/);
 const table=baselineEventsMarkup(rows,'2026-01');assert.match(table,/เมกาบางนา A/);assert.match(table,/เมกาบางนา B/);assert.doesNotMatch(table,/เมกาบางนา C/);assert.match(table,/6 กุมภาพันธ์ 2569/);
 assert.doesNotMatch(baselineEventsMarkup([{...rows[0],name:'<img src=x>'}]),/<img/);
});
test('server recomputes selected month and saves selected references for CEO review',()=>{
 const proposed=body();proposed.sales=999999;
 const saved=prepareEventRequest(proposed,{records},new Date('2026-09-21T00:00:00Z'));
 assert.equal(saved.sales,'26000');assert.equal(saved.input.baselineMonth,'2026-01');assert.equal(saved.reference.baselineMonth,'2026-01');
 assert.deepEqual(saved.reference.rows.map(r=>r.id),['a','b']);assert.equal(saved.calculation.baseline.days,10);
 assert.match(reviewMarkup(saved),/มกราคม 2569/);assert.match(reviewMarkup(saved),/2,600.00/);
 assert.throws(()=>prepareEventRequest({...proposed,input:{...proposed.input,baselineMonth:'2026-03'}},{records}));
 assert.throws(()=>prepareEventRequest({...proposed,referenceKey:'stale'},{records}),e=>e.code==='history_changed');
 const legacy=prepareEventRequest({...proposed,input:{...input}},{records});
 assert.equal(legacy.sales,'24400');assert.equal(legacy.input.baselineMonth,'all');assert.match(reviewMarkup(legacy),/ค่าเฉลี่ยทั้งหมดของห้าง/);
});
test('retry with the same month is idempotent and changing the month needs a new request',async()=>{
 const env={DB:previewDatabase()},proposed=body();
 try{
  await createEventRequest(request(proposed),env,{records});
  await createEventRequest(request(proposed),env,{records:[]});
  assert.equal((await listEventRequests(env)).items.length,1);
  await assert.rejects(()=>createEventRequest(request({...proposed,input:{...proposed.input,baselineMonth:'all'}}),env,{records}),e=>e.status===409);
 }finally{env.DB.close();}
});
