import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {eventSalesMetrics} from './out/assets/event-metrics.mjs';
import {eventsMarkup} from './out/assets/events.mjs';
import {applyEventSales} from './events-data.mjs';

test('event days include both endpoints across Thai date formats, months and years',()=>{
  for (const [date,days] of [['15-28 พ.ค.. 2568',14],['1 กค. - 13 กค. 68',13],['18 กค. -28 กค. 68',11],['02-15/10/68',14],['1-16 เม.ย. 68',16],['21 ส.ค. - 3 ก.ย. 68',14],['11-เม.ย. - 1พ.ค. 68',21],['31/12/68-2/1/69',3],['1/1/68',1]]) {
    const result=eventSalesMetrics({date,sales:2100},2025);
    assert.equal(result.days,days,date);assert.equal(result.dailySales,2100/days,date);
  }
});
test('unknown, invalid and future dates never invent averages; zero sales remain zero',()=>{
  for (const date of ['', '31/02/68', '15-12/05/68']) assert.deepEqual(eventSalesMetrics({date,sales:100},2025),{days:null,dailySales:null});
  assert.deepEqual(eventSalesMetrics({date:'3-16/09/69',sales:100},2026,'2026-09-02'),{days:null,dailySales:null});
  assert.deepEqual(eventSalesMetrics({date:'3-16/09/69',sales:100},2026,'bad'),{days:null,dailySales:null});
  assert.deepEqual(eventSalesMetrics({date:'1-3/01/68',sales:0},2025),{days:3,dailySales:0});
  assert.deepEqual(eventSalesMetrics({date:'1-3/01/68',sales:null},2025),{days:3,dailySales:null});
});
test('ongoing events divide sales by elapsed selling days, including zero-sales days',()=>{
  const item={name:'เมกาบางนา 03-16/09/69',sales:202395};
  assert.deepEqual(eventSalesMetrics(item,2026,'2026-09-15'),{days:13,dailySales:202395/13});
  assert.equal(eventSalesMetrics(item,2026,'2026-09-20').days,14);
});
test('real historical leaders retain durations and per-day sales alongside the expanded directory',async()=>{
  const data=applyEventSales(JSON.parse(await fs.readFile(new URL('./out/snapshot.json',import.meta.url)))).data['/api/events'];
  assert.deepEqual(data.years['2025'].top_events.map(item=>eventSalesMetrics(item,2025).days),[null,14,13,11,14,16,14,21]);
  for (const year of ['2025','2026']) {
    const html=eventsMarkup(data,{year,page:'ranking'}),top=html.split('<article id="event-top-sales"')[1].split('</article>')[0];
    assert.match(top,/<th>ยอดขาย<\/th><th>จำนวนวัน<\/th><th>ยอดต่อวัน<\/th>/);
    assert.equal((top.match(/data-label="จำนวนวัน"/g)||[]).length,8);
    assert.equal((html.match(/data-label="ยอดต่อวัน"/g)||[]).length,8);
    data.years[year].top_events=[];
    assert.match(eventsMarkup(data,{year,page:'ranking'}),/colspan="5">ยังไม่มีงานที่มียอดขาย/);
  }
});
