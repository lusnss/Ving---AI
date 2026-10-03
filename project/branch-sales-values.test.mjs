import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSalesReportModel,dailyCell,tableMarkup} from './out/assets/daily-sales.mjs';

const today='2026-09-17';
const dates=Array.from({length:30},(_,i)=>`2026-09-${String(i+1).padStart(2,'0')}`);
const branch=(name,code,type,total,values)=>({branch:name,branch_code:code,type,month_to_date:total,target:100000,daily_sales:{...Object.fromEntries(dates.map(d=>[d,null])),...values}});
const model=branches=>buildSalesReportModel({periods:{'2026-09':{year:2026,month:9,dates,latest_date:'2026-09-16',branches}}},{year:2026,month:'2026-09',date:'2026-09-06'},today);
const value=(m,row,date)=>dailyCell(row,date,m.selectedPeriod,today).value;

test('merges owner-confirmed CDS Ladprao split sales and counts its target once',()=>{
  const m=model([
    branch('พระราม2','VC-010','CDS',10260,{'2026-09-06':10260,'2026-09-16':0}),
    branch('อีสวิลล์','','CDS',9195,{'2026-09-06':9195}),
    branch('Festival เชียงใหม่','VC-018','CDS',4625,{'2026-09-06':4625}),
    branch('ลาดพร้าว','','CDS',5420,{'2026-09-03':4050,'2026-09-04':140,'2026-09-05':5,'2026-09-06':1225}),
    branch('โรบินสันเชียงใหม่','VC-006','RBS',5100,{'2026-09-06':5100}),
    branch('ลาดพร้าว','','CDS',11622.5,{'2026-09-01':3387.5,'2026-09-02':8235}),
    branch('CM (เชียงใหม่)','','RBS',0,{}),
    branch('RAMA 2','','CDS',0,{}),
    branch('รังสิต','VA-002','Stand alone',100,{'2026-09-06':100})
  ]);
  const lad=m.totals.rows.filter(r=>r.branch==='ลาดพร้าว');
  assert.equal(lad.length,1);
  const counter=lad.find(r=>r.source_section==='branch');
  assert.equal(value(m,counter,'2026-09-03'),4050);
  assert.equal(value(m,counter,'2026-09-02'),8235);
  assert.equal(counter.total,17042.5);
  assert.equal(counter.target,100000);
  assert.equal(counter.forecast,17042.5/16*30);
  assert.equal(counter.best_date,'2026-09-02');
  assert.equal(m.channels.find(c=>c.name==='CDS').total,41122.5,'preserve source channel classification');
  for(const [name,expected] of [['RAMA 2',10260],['อีสวิลล์',9195],['Festival เชียงใหม่',4625],['CM (เชียงใหม่)',5100]]) {
    assert.equal(value(m,m.totals.rows.find(r=>r.branch===name),'2026-09-06'),expected,name);
  }
  for(const name of ['CM (เชียงใหม่)','RAMA 2']) {
    const row=m.totals.rows.find(r=>r.branch===name);
    assert.equal(row.source_section,'branch');
    assert.equal(m.totals.rows.filter(r=>r.branch===name).length,1,'one row per confirmed counter');
    assert.equal(row.target,100000,'preserve the coded counter target without adding its empty alias');
  }
  const html=tableMarkup(m,{columns:['daily']},today);
  assert.doesNotMatch(html,/ส่วน Event ในรายงาน · CDS/);
  assert.match(html,/CDS · VC-010/);
  assert.doesNotMatch(html,/ยังไม่มียอดในแถวนี้/);
});

test('combines daily amounts without null, blank or zero overwriting sales; row order is irrelevant',()=>{
  const first=branch('Counter','VC-001','CDS',120,{'2026-09-01':100,'2026-09-02':20,'2026-09-03':0,'2026-09-16':0});
  const second=branch('Counter','VC-001','CDS',95,{'2026-09-01':0,'2026-09-02':100,'2026-09-03':-5,'2026-09-04':''});
  for(const rows of [[first,second],[second,first]]) {
    const m=model(rows),row=m.totals.rows[0];
    assert.equal(value(m,row,'2026-09-01'),100);
    assert.equal(value(m,row,'2026-09-02'),120);
    assert.equal(value(m,row,'2026-09-03'),-5);
    assert.equal(row.daily_sales['2026-09-04'],null);
    assert.equal(row.best_value,120);
    assert.equal(row.best_date,'2026-09-02');
    assert.equal(row.total,215);
    assert.equal(row.forecast,215/16*30);
    assert.equal(value(m,row,'2026-09-17'),null,'unreported days remain pending');
  }
});
