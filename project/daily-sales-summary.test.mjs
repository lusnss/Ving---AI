import assert from 'node:assert/strict';
import {buildSalesReportModel, eventNotStarted, summaryMarkup, tableMarkup} from './out/assets/daily-sales.mjs';

const today = '2026-09-16';
const branch = (name,type,total,target,daily={}) => ({branch:name,type,month_to_date:total,target,daily_sales:daily});
const september = {year:2026,month:9,latest_date:'2026-09-15',dates:['2026-09-15'],branches:[
  branch('Store','CDS',0,100),
  branch('Pending','Event',0,200,{'2026-09-15':0}),
  branch('Active','Event',50,300,{'2026-09-15':50}),
  branch('Daily evidence','Sports Mall',0,400,{'2026-09-15':25}),
  branch('Future only','Event',null,500,{'2026-09-20':100}),
  branch('Returns','Event',-10,100),
]};
const data = {periods:{'2026-09':september}};
const model = buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
assert.equal(model.summary.total,40);
assert.equal(model.summary.target,900);
assert.equal(model.summary.gap,-860);
assert.equal(model.summary.branches,4);
assert.equal(model.pendingEvents,2);
const events = model.channels.find(c=>c.name==='Event');
assert.equal(events.branches,3);
assert.equal(events.target,800);
assert.equal(events.total,40);
assert.equal(model.channels.reduce((s,c)=>s+c.total,0),model.summary.total);
assert.equal(model.channels.reduce((s,c)=>s+c.target,0),model.summary.target);
assert.equal(model.totals.rows.find(r=>r.branch==='Pending').forecast,null);
assert.equal(model.totals.rows.find(r=>r.branch==='Store').gap,-100);
assert.equal(eventNotStarted(september.branches[3],september,today),false);
const table=tableMarkup(model,{},today);
const pendingRow=table.match(/<tr>[^]*?Pending[^]*?<\/tr>/)?.[0].split('<tr>').at(-1);
assert.match(pendingRow,/ยังไม่เริ่ม/);
assert.doesNotMatch(pendingRow,/is-negative|฿200|100\.00%|<strong>15<\/strong>/);
assert.match(summaryMarkup(model),/ยอดขายรวม/);

const august = {...september,month:8,latest_date:'2026-08-31',dates:[],branches:[branch('Active','Event',0,999)]};
const annual=buildSalesReportModel({periods:{'2026-08':august,'2026-09':september}},{year:2026,month:'all'},today);
assert.equal(annual.summary.target,900,'exclude pending event-month targets even when the event starts in a later month');
assert.equal(annual.totals.rows.find(r=>r.branch==='Active').target,300);
const future=buildSalesReportModel(data,{year:2026,month:'2026-10'},today);
assert.equal(future.summary.branches,1,'do not carry Events into unscheduled future months');
assert.equal(future.totals.rows.some(r=>r.type==='Event'),false);
const allPending=buildSalesReportModel({periods:{'2026-09':{...september,branches:[september.branches[1]]}}},{year:2026,month:'2026-09'},today);
assert.equal(allPending.summary.target,0);
assert.equal(allPending.summary.gap,null);
assert.equal(allPending.summary.forecast,null);
assert.equal(allPending.summary.branches,0);
console.log('Passed: pending Events excluded, daily-sales evidence and zero-sales stores retained, monthly/yearly/future summaries consistent, pending rows neutral.');
