import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSummaryModel,eventStatus,monthlyEvents,summaryMarkup} from './out/assets/summary.mjs';
import {reportData} from './out/assets/daily-comparison-data.mjs';
import {salesWindow} from './out/assets/summary-data.mjs';
import {summarize} from './out/assets/profit-loss.mjs';
const snapshot=JSON.parse(fs.readFileSync('out/snapshot.json'));
const data={report:snapshot.data['/api/daily-sales'],events:snapshot.data['/api/events'],pnl:JSON.parse(fs.readFileSync('profit-loss.snapshot.json'))};
const state={year:2026,month:9,basis:'all',eventStatus:'all'};
const today='2026-09-17';
test('Summary uses Daily report totals and subtracts cost-only financial rows',()=>{
 const model=buildSummaryModel(data,state,today);
 assert.equal(model.selected.actual,salesWindow(reportData,2026,9,null,'all',today).current);
 assert.notEqual(model.selected.actual,model.selected.sales.summary.total);
 const finance=summarize(data.pnl.records.filter(r=>r.month===9));
 assert.equal(model.selected.finance.profit,finance.profit);
 assert.match(model.selected.basis,/ACT.*FCT/);
 assert.equal(model.monthly.length,12);
 assert.equal(model.monthly[9].actual,null);
 assert.ok(model.monthly[9].finance.net>0);
});
test('Event status uses dates, keeps unknown distinct, and includes cross-month schedules',()=>{
 assert.equal(eventStatus({name:'งาน 1-16/09/69'},2026,today).status,'completed');
 assert.equal(eventStatus({name:'งาน 17-27/09/69'},2026,today).status,'ongoing');
 assert.equal(eventStatus({name:'งาน 18-27/09/69'},2026,today).status,'upcoming');
 assert.equal(eventStatus({name:'งานรอวันที่',month:9,sales:1000},2026,today).status,'unknown');
 const catalog={years:{2026:{items:[{name:'งาน 23/10-01/11/69',month:10}]}}};
 assert.equal(monthlyEvents(catalog,2026,10,today).length,1);
 assert.equal(monthlyEvents(catalog,2026,11,today).length,1);
 assert.equal(monthlyEvents(catalog,2026,9,today).length,0);
});
test('ACT filter excludes forecast from all profit metrics; missing year is not zero',()=>{
 const m=buildSummaryModel(data,{...state,month:10,basis:'ACT'},today);
 assert.equal(m.selected.finance.profit,null);
 assert.equal(m.selected.finance.net,null);
 const prior=buildSummaryModel(data,{...state,year:2025},today);
 assert.equal(prior.selected.finance.profit,null);
 assert.ok(prior.selected.actual>0);
});
test('All periods and partial source failures render without misleading invalid numbers',()=>{
 for(const year of [2025,2026])for(let month=1;month<=12;month++){
  const html=summaryMarkup(data,{...state,year,month},today);
  assert.doesNotMatch(html,/NaN|undefined|Infinity/);
 }
 const html=summaryMarkup({report:null,events:null,pnl:null,failures:['โหลดข้อมูลไม่สำเร็จ']},state,today);
 assert.match(html,/โหลดข้อมูลไม่สำเร็จ/);
 assert.doesNotMatch(html,/NaN|undefined|Infinity/);
});

test('Missing sales stays unknown, numeric zero stays zero, fractional month normalizes',()=>{
 const make=value=>({comparison:{sources:{2569:{status:'ready'}},records:[{year:2569,month:9,group:'Department Stores',lastDay:1,daily:[value]}]},report:{periods:{'2026-09':{year:2026,month:9,dates:[],latest_date:'2026-09-16',branches:[{branch:'A',type:'CDS',month_to_date:value,daily_sales:{}}]}}},events:{years:{2026:{items:[]}}},pnl:null});
 assert.equal(buildSummaryModel(make(null),state,today).selected.actual,null);
 assert.equal(buildSummaryModel(make(0),state,today).selected.actual,0);
 assert.equal(buildSummaryModel(data,{...state,month:1.5},today).month,9);
 const html=summaryMarkup({report:null,events:null,pnl:null},state,today);
 assert.doesNotMatch(html,/กำไร 0<|ขาดทุน 0</);
 assert.match(html,/ยังไม่มีรายชื่ออีเวนต์ของปีนี้/);
});
