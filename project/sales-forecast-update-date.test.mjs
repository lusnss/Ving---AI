import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSalesReportModel,runRateForecast,summaryMarkup,dailyCell,zeroSalesDays,filterMarkup} from './out/assets/daily-sales.mjs';
import {salesFreshnessText} from './out/assets/sales-freshness.mjs';

const data = (latest_date='2026-09-17') => ({updated_at:'2026-09-21T00:15:56+07:00',periods:{'2026-09':{
  year:2026,month:9,latest_date,dates:['2026-09-01','2026-09-17'],branches:[
    {branch:'Store',branch_code:'VA-001',type:'Stand alone',month_to_date:1700,target:4000,daily_sales:{'2026-09-01':100,'2026-09-17':100}},
    {branch:'Counter',branch_code:'VC-001',type:'CDS',month_to_date:850,target:2000,daily_sales:{'2026-09-17':50}},
    {branch:'Event 01-10/09/69',type:'Event',month_to_date:500,target:1000,daily_sales:{'2026-09-01':500}}
  ]
}}});
const build=(today='2026-09-21',state={})=>buildSalesReportModel(data(),{year:2026,month:'2026-09',...state},today);

test('stale sales divide by the inclusive sales update date, independent of clock, sync and daily selection',()=>{
  for(const today of ['2026-09-17','2026-09-21','2026-09-25'])for(const date of ['latest','2026-09-01','month-end']){
    const m=build(today,{date});
    assert.equal(m.forecastDay,17);
    assert.equal(m.forecastBasis,'2026-09-17');
    assert.equal(m.totals.rows.find(r=>r.branch_code==='VA-001').forecast,3000);
    assert.equal(m.channels.find(c=>c.name==='CDS').forecast,1500);
    assert.equal(m.summary.forecast,5000);
    assert.equal(m.totals.forecast,m.summary.forecast);
    assert.equal(m.channels.reduce((sum,c)=>sum+(c.forecast??0),0),m.summary.forecast);
    assert.equal(m.channels.find(c=>c.name==='Event').forecast,500,'ended events retain their actual sales');
    assert.match(summaryMarkup(m),/÷ 17 × 30 วัน/);
  }
});

test('a new sales date moves the denominator, while future months use the same source date',()=>{
  const changed=data('2026-09-18');
  changed.periods['2026-09'].branches[0].month_to_date=1800;
  changed.periods['2026-09'].branches[0].daily_sales['2026-09-18']=100;
  const m=buildSalesReportModel(changed,{year:2026,month:'2026-09'},'2026-09-21');
  assert.equal(m.forecastDay,18);
  assert.equal(m.totals.rows.find(r=>r.branch_code==='VA-001').forecast,3000);
  const future=build('2026-09-21',{month:'2026-10'});
  assert.equal(future.summary.forecast,4650);
  assert.match(summaryMarkup(future),/÷ 17 × 31 วัน/);
});

test('new Event sales never advance the branch forecast or manufacture zero-sales days',()=>{
  const input=data('2026-09-20'),p=input.periods['2026-09'];
  p.dates.push('2026-09-18','2026-09-19','2026-09-20');
  for(const branch of p.branches.slice(0,2))Object.assign(branch.daily_sales,{'2026-09-18':null,'2026-09-19':'','2026-09-20':null});
  p.branches[2]={branch:'Event 17-27/09/69',type:'Event',month_to_date:500,target:1000,daily_sales:{'2026-09-17':100,'2026-09-20':400}};
  const m=buildSalesReportModel(input,{year:2026,month:'2026-09'},'2026-09-21');
  assert.equal(m.selectedPeriod.latest_date,'2026-09-20');
  assert.equal(m.selectedPeriod.branch_latest_date,'2026-09-17');
  assert.equal(m.selectedPeriod.event_latest_date,'2026-09-20');
  assert.equal(m.forecastDay,17);
  assert.equal(m.summary.branchForecast,4500);
  assert.equal(m.summary.eventForecast,1375);
  assert.equal(m.summary.forecast,5875);
  const store=m.totals.rows.find(r=>r.branch_code==='VA-001');
  assert.deepEqual(dailyCell(store,'2026-09-18',m.selectedPeriod,'2026-09-21'),{kind:'pending',value:null});
  assert.equal(zeroSalesDays(store,m.selectedPeriod,'2026-09-21'),15,'only gaps inside the reported branch period count');
  assert.match(filterMarkup(m),/เฉพาะ Event · สาขารอข้อมูล/);
  const status=salesFreshnessText({data:{'/api/daily-sales':input}},Date.parse('2026-09-21T05:00:00Z'));
  assert.match(status,/ยอดสาขาถึง 17 ก.ย. 2569 · ยอด Event ถึง 20 ก.ย. 2569/);
  assert.match(status,/รอยอดสาขา 20 ก.ย. 2569/);
  p.branches[0].daily_sales['2026-09-18']=0;
  const next=buildSalesReportModel(input,{year:2026,month:'2026-09'},'2026-09-21');
  assert.equal(next.forecastDay,18,'explicit reported zero advances the branch date');
  assert.equal(next.totals.rows.find(r=>r.branch_code==='VA-001').forecast,1700/18*30);
});

test('calendar days handle first-day sales, leap years and month end without subtracting a day',()=>{
  for(const [year,month,day,days] of [[2026,9,1,30],[2026,9,30,30],[2028,2,17,29],[2026,2,17,28],[2026,10,17,31]]){
    const latest_date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    assert.equal(runRateForecast(day*100,{year,month,latest_date},latest_date),days*100);
  }
});

test('missing, invalid, future or unrelated-month update dates do not create a forecast',()=>{
  for(const latest_date of [undefined,null,'','2026-09-00','2026-09-31','2026-09-22','2026-08-17']){
    assert.equal(runRateForecast(1700,{year:2026,month:9,latest_date},'2026-09-21'),null);
  }
  for(const total of [null,'',NaN,Infinity])assert.equal(runRateForecast(total,{year:2026,month:9,latest_date:'2026-09-17'},'2026-09-21'),null);
  assert.equal(runRateForecast(0,{year:2026,month:9,latest_date:'2026-09-17'},'2026-09-21'),0);
  assert.equal(build('2026-09-21',{month:'all'}).summary.forecast,null);
});
