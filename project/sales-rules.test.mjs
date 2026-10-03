import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSalesReportModel,dailyCell,zeroSalesDays,tableMarkup,summaryMarkup} from './out/assets/daily-sales.mjs';
import {eventDateRange,eventSchedule,eventForecast} from './out/assets/event-forecast.mjs';
const today='2026-09-16';
const period={year:2026,month:9,latest_date:'2026-09-15'};
const store={branch:'Store',branch_code:'VC-1',type:'CDS',month_to_date:100,target:1000,daily_sales:{'2026-09-03':100,'2026-09-04':null,'2026-09-05':''}};
const modelFor=(branches,extra={})=>buildSalesReportModel({periods:{'2026-09':{...period,dates:['2026-09-15'],branches},...extra}},{year:2026,month:'2026-09'},today);

test('blank days after first sale become zeros, including consecutive blanks; leading and unreported days remain blank',()=>{
  assert.equal(dailyCell(store,'2026-09-02',period,today).kind,'missing');
  for(const day of ['04','05','06','15'])assert.deepEqual(dailyCell(store,`2026-09-${day}`,period,today),{kind:'zero',value:0});
  assert.equal(dailyCell(store,'2026-09-16',period,today).kind,'pending');
  assert.equal(dailyCell(store,'2026-09-17',period,today).kind,'future');
  assert.equal(zeroSalesDays(store,period,today),12);
  assert.equal(dailyCell({...store,daily_sales:{'2026-09-01':0}},'2026-09-02',period,today).kind,'missing');
  assert.equal(dailyCell({...store,daily_sales:{...store.daily_sales,'2026-09-04':'bad'}},'2026-09-04',period,today).kind,'missing');
});

test('earlier months activate established branches without using later sales as evidence',()=>{
  const previous={...period,month:8,latest_date:'2026-08-31',branches:[{...store,daily_sales:{'2026-08-31':100}}]};
  const m=modelFor([{...store,daily_sales:{}}],{'2026-08':previous});
  assert.equal(zeroSalesDays(m.totals.rows[0],m.selectedPeriod,today),15);
  const leading=modelFor([store]);
  assert.equal(dailyCell(leading.totals.rows[0],'2026-09-02',leading.selectedPeriod,today).kind,'missing');
});

test('selected daily amount and zero count use the same business rule',()=>{
  const data={periods:{'2026-09':{...period,dates:['2026-09-02','2026-09-04'],branches:[store,{...store,branch:'Another',daily_sales:{'2026-09-02':50,'2026-09-04':10}}]}}};
  const m=buildSalesReportModel(data,{year:2026,month:'2026-09',date:'2026-09-04'},today);
  assert.equal(m.totals.rows.find(r=>r.branch==='Store').daily,0);
  assert.equal(m.summary.daily,10);
  const before=buildSalesReportModel(data,{year:2026,month:'2026-09',date:'2026-09-02'},today);
  assert.equal(before.totals.rows.find(r=>r.branch==='Store').daily,null);
});

test('Event dates support Thai years, abbreviated Thai months, single days and cross-year ranges',()=>{
  assert.deepEqual(eventDateRange('งาน 03-16/09/69',2026),{start:'2026-09-03',end:'2026-09-16'});
  assert.deepEqual(eventDateRange('งาน 10-16/09/26',2026),{start:'2026-09-10',end:'2026-09-16'});
  assert.deepEqual(eventDateRange('งาน 3-16 ก.ย. 2569',2026),{start:'2026-09-03',end:'2026-09-16'});
  assert.deepEqual(eventDateRange('งาน 28/12-05/01/70',2027),{start:'2026-12-28',end:'2027-01-05'});
  assert.deepEqual(eventDateRange('งาน 4/09/69',2026),{start:'2026-09-04',end:'2026-09-04'});
  assert.equal(eventDateRange('งาน 30/06-12/06/69',2026),null);
  assert.equal(eventDateRange('งาน 30-31/02/69',2026),null);
});

const event={type:'Event',branch:'Fair 10-16/09/26',month_to_date:0,target:1000,daily_sales:{'2026-09-10':100,'2026-09-11':200,'2026-09-13':300}};
test('Event forecast counts scheduled zero-sales days and uses daily actual when MTD is zero',()=>{
  const m=modelFor([event]);
  assert.equal(m.totals.rows[0].forecast,700); // 600 / 6 elapsed selling days * 7 days
  assert.equal(m.channels.find(c=>c.name==='Event').forecast,700); // Dashboard includes the same selling-day forecast as the row.
  assert.equal(zeroSalesDays(m.totals.rows[0],m.selectedPeriod,today),3);
  assert.equal(dailyCell(m.totals.rows[0],'2026-09-09',m.selectedPeriod,today).kind,'missing');
  assert.match(summaryMarkup(m),/คาดการณ์ Event/);
});

test('ended events equal actual; missing schedules never use calendar-month run rate',()=>{
  const ended={...event,branch:'Fair 10-13/09/26'};
  const m=modelFor([ended,{...event,branch:'Unknown'}]);
  assert.equal(m.totals.rows.find(r=>r.branch===ended.branch).forecast,600);
  assert.equal(m.totals.rows.find(r=>r.branch==='Unknown').forecast,null);
  assert.equal(m.summary.forecast,600); // Known forecasts still appear while unknown schedules use recorded actuals.
  assert.equal(m.summary.unknownEventSchedules,1);
  assert.match(tableMarkup(m,{},today),/รอวันเปิดขาย/);
  const row=m.totals.rows.find(r=>r.branch===ended.branch);
  assert.equal(dailyCell({...row,daily_sales:{...row.daily_sales,'2026-09-14':0}},'2026-09-14',m.selectedPeriod,today).kind,'missing');
});

test('unique catalog dates resolve; overlapping or conflicting schedules do not',()=>{
  const branch={...event,branch:'Event เมกาบางนา'};
  const catalog={years:{2026:{items:[{name:'เมกาบางนา ชั้น 1 03-16/09/69',categories:['direct'],month:9}]}}};
  assert.deepEqual(eventSchedule(branch,period,catalog,today),{start:'2026-09-03',end:'2026-09-16'});
  catalog.years[2026].items.push({name:'เมกาบางนา ชั้น 2 01-20/09/69',categories:['direct'],month:9});
  assert.equal(eventSchedule(branch,period,catalog,today),null);
  assert.equal(eventSchedule({...event,branch:'Fair 10-12/09/26'},period,catalog,today),null,'sales outside embedded range invalidate it');
});

test('cross-month event uses only selling days and actuals belonging to the selected month',()=>{
  const branch={...event,branch:'Fair 28/08-05/09/69',daily_sales:{'2026-09-01':100,'2026-09-02':300}};
  const p={...period,latest_date:'2026-09-02'};
  const result=eventForecast(branch,p,eventDateRange(branch.branch,2026),today);
  assert.equal(result.value,1000); // September contribution: 400 / 2 * 5; excludes August and Sep 6–30.
  assert.equal(result.totalDays,5);
  assert.equal(result.elapsed,2);
});

test('events never carry into artificial future months and pending events stay neutral',()=>{
  const data={periods:{'2026-09':{...period,branches:[store,event,{...event,branch:'Unstarted 17-27/09/69',daily_sales:{}}]}}};
  const current=buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
  assert.equal(current.totals.rows.find(r=>r.branch.startsWith('Unstarted')).forecast,null);
  const future=buildSalesReportModel(data,{year:2026,month:'2026-10'},today);
  assert.equal(future.totals.rows.length,1);
  assert.ok(future.totals.rows[0].forecast>0);
});
