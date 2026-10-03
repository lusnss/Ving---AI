import test from 'node:test';import assert from 'node:assert/strict';
import {buildSalesReportModel,summaryMarkup,tableMarkup} from './out/assets/daily-sales.mjs';
const event=(extra={})=>({deletionKey:'web:a',name:'Fashion Island',place:'Fashion Island',startDate:'2026-10-20',endDate:'2026-11-01',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',input:{channel:'gp'},...extra});
const report=(rows=[],events=[event()])=>({approved_events:events,periods:{'2026-09':{year:2026,month:9,latest_date:'2026-09-21',dates:['2026-09-21'],branches:[{branch:'Store',type:'Stand alone',branch_code:'VA-01',month_to_date:100,daily_sales:{'2026-09-21':100}}]},...(rows.length?{'2026-10':{year:2026,month:10,latest_date:'2026-10-21',dates:['2026-10-20','2026-10-21'],branches:rows}}:{})}});
const build=(data,month='2026-10',today='2026-09-22')=>buildSalesReportModel(data,{year:2026,month},today);
const row=(extra={})=>({branch:'แฟชั่น ไอส์แลนด์',type:'Event',source_section:'event',month_to_date:300,daily_sales:{'2026-10-20':100,'2026-10-21':200},...extra});
test('both approvals create monthly pending events without fabricated actuals or forecasts',()=>{
 const d=report(),before=JSON.stringify(d),m=build(d),e=m.totals.rows.find(r=>r.type==='Event');
 assert.equal(e.event_match,'waiting');assert.equal(e.notStarted,true);assert.equal(e.forecast,null);assert.equal(m.channels.find(c=>c.name==='Event').approvedPending,1);
 assert.match(summaryMarkup(m),/อนุมัติแล้ว · รอยอด 1 งาน/);
 assert.equal(build(d,'2026-11').totals.rows.filter(r=>r.type==='Event').length,1);
 assert.equal(build(d,'2026-12').totals.rows.filter(r=>r.type==='Event').length,0);
 assert.equal(build(report([],[event({ceo:'รออนุมัติ'})])).totals.rows.filter(r=>r.type==='Event').length,0);
 assert.equal(JSON.stringify(d),before);
});
test('similar curated venue names match once, original sales stay unchanged and revoked approval detaches',()=>{
 const m=build(report([row()]),'2026-10','2026-10-22');assert.equal(m.totals.rows.length,1);assert.equal(m.totals.total,300);assert.equal(m.totals.rows[0].event_match,'matched');assert.equal(m.totals.rows[0].event_schedule.start,'2026-10-20');assert.equal(m.totals.rows[0].forecast,1800);
 const revoked=build(report([row()],[event({ceo:'ไม่อนุมัติ'})]),'2026-10','2026-10-22');assert.equal(revoked.totals.total,300);assert.equal(revoked.totals.rows[0].event_match,undefined);
});
test('store rows, activity outside schedule, mismatched dates and ambiguous venue campaigns never auto-match',()=>{
 for(const rows of [[row({type:'CDS',source_section:'branch'})],[row({daily_sales:{'2026-10-10':300}})],[row({branch:'Fashion Island 1-3/10/69'})],[row(),row({branch:'Fashion Island'})]]){
 const m=build(report(rows),'2026-10','2026-10-22');assert.equal(m.totals.rows.filter(r=>r.event_match==='matched').length,0);assert.equal(m.totals.rows.filter(r=>r.approved_event_key).length,1);
 }
 const m=build(report([row()],[event(),event({deletionKey:'web:b',name:'Fashion Island งานสอง'})]),'2026-10','2026-10-22');assert.equal(m.totals.rows.filter(r=>r.event_match==='matched').length,0);assert.equal(m.totals.total,300);assert.equal(m.totals.rows.filter(r=>r.event_match==='ambiguous').length,2);
});
test('reported zero is distinct from waiting, duplicates do not create extra placeholders',()=>{
 const m=build(report([row({month_to_date:0,daily_sales:{'2026-10-20':0}})]),'2026-10','2026-10-22');assert.equal(m.totals.rows[0].notStarted,false);assert.equal(m.totals.rows[0].total,0);
 assert.equal(build(report([],[event(),event()])).totals.rows.filter(r=>r.type==='Event').length,1);
});
