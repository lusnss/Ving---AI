import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSalesReportModel,summaryMarkup,tableMarkup,REPORT_COLUMNS} from './out/assets/daily-sales.mjs';
const today='2026-09-16';
const branch=(branch_code,month_to_date,extra={})=>({branch_code,branch:branch_code,type:'CDS',month_to_date,target:1000,daily_sales:{},...extra});
const period=(key,branches)=>({key,year:Number(key.slice(0,4)),month:Number(key.slice(5)),branches,dates:[],latest_date:`${key}-${key==='2026-09'?'15':new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5)),0)).getUTCDate()}`});
const model=(current,prior,extra={},state={year:2026,month:'2026-09'},date=today)=>buildSalesReportModel({periods:{'2026-09':period('2026-09',current),...(prior?{'2025-09':period('2025-09',prior)}:{}),...extra}},state,date);

test('compares month-end forecast, not current MTD, to the same full month last year',()=>{
  const m=model([branch('up',80),branch('down',20),branch('equal',50)],[branch('up',100),branch('down',100),branch('equal',100)]);
  assert.deepEqual(m.summary.yoyCounts,{up:1,down:1,equal:1,new:0,unknown:0,eligible:3});
  const up=m.totals.rows.find(r=>r.branch_code==='up').yoy;
  assert.deepEqual(up,{status:'up',actual:100,delta:60,percent:0.6,priorKey:'2025-09'});
});
test('unique stable codes survive name and channel changes',()=>{
  const m=model([branch('VC-003',200,{branch:'New name',type:'CDS'})],[branch('VC-003',100,{branch:'Old name',type:'RBS'})]);
  assert.equal(m.summary.yoyCounts.up,1);
});
test('reused codes must be disambiguated; code-free rows cannot reuse coded baselines',()=>{
  const m=model([branch('VA-012',80,{branch:'A'}),branch('VA-012',30,{branch:'B'}),branch('VC-014',100,{branch:'Venue'}),branch('',100,{branch:'Venue'})],[branch('VA-012',100,{branch:'A'}),branch('VC-014',100,{branch:'Venue'})]);
  assert.equal(m.totals.rows.find(r=>r.branch==='A').yoy.status,'up');
  assert.equal(m.totals.rows.find(r=>r.branch==='B').yoy.status,'new');
  assert.equal(m.totals.rows.find(r=>!r.branch_code).yoy.status,'new');
});
test('duplicate raw rows remain unknown even if existing report aggregates them',()=>{
  const m=model([branch('',80,{branch:'Venue'}),branch('',30,{branch:'Venue'})],[branch('',100,{branch:'Venue'})]);
  assert.equal(m.totals.rows[0].yoy.status,'unknown');
  assert.match(m.totals.rows[0].yoy.reason,/ซ้ำ/);
});
test('missing history, zero prior sales and unavailable forecasts never imply growth or opening',()=>{
  assert.equal(model([branch('A',100)],null).totals.rows[0].yoy.status,'unknown');
  assert.equal(model([branch('A',100)],[branch('A',0)]).totals.rows[0].yoy.status,'unknown');
  assert.equal(model([branch('A',100)],[branch('A',100)],{},{year:2026,month:'2026-09'},'2026-09-01').totals.rows[0].yoy.status,'unknown');
  assert.equal(model([branch('A',100)],[branch('A',100)],{},{year:2026,month:'all'}).summary.yoyCounts.up,0);
});
test('a partial prior-year month cannot be presented as a full-month comparison',()=>{
  const m=model([branch('A',75)],[branch('A',100)],{'2025-09':{...period('2025-09',[branch('A',100)]),latest_date:'2025-09-15'}});
  assert.equal(m.totals.rows[0].yoy.status,'unknown');
  assert.equal(m.totals.rows[0].yoy.reason,'ข้อมูลเดือนปีก่อนยังไม่ครบ');
});
test('owner classifies unmatched branches as newly opened regardless of code or earlier history',()=>{
  const m=model([branch('new',100),branch('old',100),branch('',100,{branch:'Uncoded'})],[],{'2025-01':period('2025-01',[branch('old',0)])});
  assert.equal(m.totals.rows.find(r=>r.branch_code==='new').yoy.status,'new');
  assert.equal(m.totals.rows.find(r=>r.branch_code==='old').yoy.status,'new');
  assert.equal(m.totals.rows.find(r=>!r.branch_code).yoy.status,'new');
});
test('Event is excluded, and column can be independently hidden',()=>{
  const m=model([branch('E',100,{type:'Event'})],[branch('E',100,{type:'Event'})]);
  assert.equal(m.summary.yoyCounts.eligible,0);
  assert.equal(m.totals.rows[0].yoy.status,'excluded');
  assert.ok(REPORT_COLUMNS.some(([id])=>id==='yoy'));
  assert.match(tableMarkup(m,{},today),/คาดการณ์เทียบปีก่อน/);
  assert.doesNotMatch(tableMarkup(m,{columns:['forecast']},today),/<td class="daily-yoy-cell"/);
});
test('future month forecast selects that month in prior year; old months stay neutral',()=>{
  const m=model([branch('A',50)],[branch('A',900)],{'2025-10':period('2025-10',[branch('A',100)])},{year:2026,month:'2026-10'});
  assert.equal(m.totals.rows[0].yoy.priorKey,'2025-10');
  assert.equal(m.totals.rows[0].yoy.actual,100);
  const past=model([branch('A',50)],[branch('A',100)],{},{year:2025,month:'2025-09'});
  assert.equal(past.totals.rows[0].yoy.status,'unknown');
});
test('September snapshot: newly opened classification and summary match table',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('./out/snapshot.json',import.meta.url)));
  const m=buildSalesReportModel(snapshot.data['/api/daily-sales'],{year:2026,month:'2026-09'},today);
  assert.deepEqual(m.summary.yoyCounts,{up:19,down:20,equal:0,new:9,unknown:0,eligible:48});
  assert.equal(m.totals.rows.find(r=>r.branch==='ลาดพร้าว').yoy.status,'new');
  assert.equal(m.totals.rows.find(r=>r.branch==='อีสวิลล์').yoy.status,'new');
  assert.match(summaryMarkup(m),/สาขาเปิดใหม่/);
  assert.doesNotMatch(tableMarkup(m,{},today),/ไม่มีฐานเทียบสาขาที่จับคู่ได้|สาขาใหม่\*/);
});
