import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {normalizeReportBranches} from './out/assets/branch-mapping.mjs';
import {buildSalesReportModel,dailyCell} from './out/assets/daily-sales.mjs';
import {reconcileEvents} from './events-data.mjs';

const snapshot=JSON.parse(fs.readFileSync(new URL('./out/snapshot.json',import.meta.url)));
const data=snapshot.data['/api/daily-sales'];
const today='2026-09-17';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.00001,`${actual} != ${expected}`);
const row=(branch,branch_code,type,month_to_date=0,daily_sales={})=>({branch,branch_code,type,month_to_date,daily_sales,target:100});

test('confirmed counters show source sales once, preserve daily values and coded targets across history',()=>{
  const original=JSON.stringify(data);
  const m=buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
  const expected=[
    ['VC-006','CM (เชียงใหม่)','RBS',49825,100000,80305],
    ['VC-028','Fashion Island','CDS',96863.09,135000,173600],
    ['VC-010','RAMA 2','CDS',53042.5,200000,106321.5],
    ['VA-007','สนามกีฬาเทพหัสดิน','Stand alone',24115,200000,137843.3]
  ];
  for(const [code,name,type,total,target,prior] of expected) {
    const matches=m.totals.rows.filter(b=>b.branch===name);
    assert.equal(matches.length,1,name);
    const actual=matches[0],source=data.periods['2026-09'].branches.find(b=>b.branch_code===code);
    assert.equal(actual.branch_code,code);
    assert.equal(actual.type,type);
    assert.equal(actual.source_section,'branch');
    close(actual.total,total);
    assert.equal(actual.target,target);
    assert.deepEqual(actual.daily_sales,source.daily_sales);
    close(actual.forecast,total/16*30);
    assert.notEqual(actual.yoy.status,'new');
    assert.notEqual(actual.yoy.status,'unknown');
    const priorRow=m.allPeriods.find(p=>p.key==='2025-09').branches.find(b=>b.branch_code===code);
    assert.equal(priorRow.type,type);
    close(priorRow.month_to_date,prior);
  }
  const stadium=m.totals.rows.find(b=>b.branch_code==='VA-007');
  assert.equal(stadium.event_schedule,null);
  assert.equal(stadium.event_forecast,null);
  assert.equal(stadium.best_date,'2026-09-01');
  assert.equal(dailyCell(stadium,'2026-09-07',m.selectedPeriod,today).value,0);
  assert.equal(m.totals.rows.length,data.periods['2026-09'].branches.length-5);
  for(const p of m.allPeriods.filter(p=>!p.projected)) {
    const raw=data.periods[p.key].branches.filter(b => !(b.branch === 'พิษณุโลก' && b.type === 'RBS' && !b.branch_code));
    close(p.branches.reduce((n,b)=>n+Number(b.month_to_date||0),0),raw.reduce((n,b)=>n+Number(b.month_to_date||0),0));
    for(const date of p.dates) close(p.branches.reduce((n,b)=>n+Number(b.daily_sales?.[date]||0),0),raw.reduce((n,b)=>n+Number(b.daily_sales?.[date]||0),0));
  }
  assert.equal(JSON.stringify(data),original,'source report is never mutated');
});

test('coalescing requires a unique coded counterpart and no recorded alias sales',()=>{
  const primary=row('แฟชั่นไอซ์แลนด์','VC-028','CDS',20,{'2026-09-01':20});
  const empty=row('Fashion Island','','CDS',0,{'2026-09-01':null});
  assert.equal(normalizeReportBranches([primary,empty]).length,1);
  assert.equal(normalizeReportBranches([empty]).length,1);
  assert.equal(normalizeReportBranches([primary,{...primary},empty]).length,3);
  for(const alias of [{...empty,month_to_date:5},{...empty,daily_sales:{'2026-09-01':5}},{...empty,daily_sales:{'2026-09-01':0}}]) {
    const rows=normalizeReportBranches([primary,alias]);
    assert.equal(rows.length,2);
    assert.equal(rows[1].branch_code,'','do not assign the same code to two recorded rows');
  }
  for(const p of Object.values(data.periods)) {
    const rows=normalizeReportBranches(p.branches);
    assert.deepEqual(normalizeReportBranches(rows),rows,'normalization is idempotent');
    const sort = list => [...list].sort((a,b)=>JSON.stringify([a.branch_code,a.branch,a.type,a.month_to_date,a.target]).localeCompare(JSON.stringify([b.branch_code,b.branch,b.type,b.month_to_date,b.target])));
    assert.deepEqual(sort(normalizeReportBranches([...p.branches].reverse())),sort(rows),'row order does not affect identity');
  }
});

test('same-venue promotions and other Chiang Mai stores remain distinct',()=>{
  const unrelated=[row('Fashion Island','Sport World Cup','',100),row('Fashion Island','Sneaker Showcase','',200),
    row('Kelly Fashion Island','','ลานโปร',300),row('Festival เชียงใหม่','VC-018','CDS',400),
    row('เชียงใหม่แอร์พอร์ต','VA-012','Stand alone',500),row('CM HALL','','RBS',600),row('CNP Hall','','CDS',700)];
  assert.deepEqual(normalizeReportBranches(unrelated),unrelated);
});

test('Event reconciliation excludes confirmed branch aliases even if they later record sales',()=>{
  const catalog={catalog_version:1,years:{'2026':{items:[{name:'Fashion Island 1-30/9/69',month:9,categories:['gp']} ]}}};
  const branches=[row('Counter','VC-001','CDS',100),row('Fashion Island','','CDS',40),
    row('CM (เชียงใหม่)','','RBS',50),row('RAMA 2','','CDS',60),
    row('Fashion Island','Sneaker Showcase','',70),row('Pinklao','','CDS',80),
    row('สนามกีฬาเทพหัสดิน','VA-007','Flagship',90),row('Store','VA-002','Stand alone',100)];
  const year=reconcileEvents(catalog,{periods:{'2026-09':{branches,latest_date:'2026-09-16'}}}).years['2026'];
  assert.equal(year.summary.sales,150,'only actual promotions enter Event totals');
  assert.equal(year.items[0].report_rows,0,'the branch alias cannot attach itself to an event catalog entry');
});

test('Phitsanulok uses authoritative VC-014 values once and preserves coded events',()=>{
  const primary={...row('พิษณุโลก','VC-014','RBS',54690,{'2026-09-02':6230}),target:80000};
  const alias={...row('พิษณุโลก','','RBS',22125,{'2026-09-01':3610}),target:100000,source_section:'event'};
  const promotion=row('RBS พิษณุโลก','20124','',11070);
  const result=normalizeReportBranches([alias,primary,promotion]);
  assert.deepEqual(result,[{...primary,source_section:'branch'},promotion]);
  assert.deepEqual(normalizeReportBranches(result),result);
  assert.deepEqual(normalizeReportBranches([primary,alias,promotion]),result);
  const m=buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
  const rows=m.totals.rows.filter(b=>b.branch==='พิษณุโลก');
  assert.equal(rows.length,1);
  assert.equal(rows[0].branch_code,'VC-014');
  assert.equal(rows[0].target,80000);
  assert.equal(rows[0].total,52120);
  assert.notEqual(rows[0].yoy.status,'new');
  const catalog={catalog_version:1,years:{'2026':{items:[]}}};
  const events=reconcileEvents(catalog,{periods:{'2026-09':{branches:[primary,alias,row('Store','VA-001','Stand alone')],latest_date:'2026-09-19'}}}).years['2026'];
  assert.equal(events.summary.sales,0);
});
