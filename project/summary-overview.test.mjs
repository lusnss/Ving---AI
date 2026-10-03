import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reportData} from './out/assets/daily-comparison-data.mjs';
import {createOverview,groups} from './out/assets/daily-comparison-model.mjs';
import {buildSummaryModel,salesWindow,chartSeries,visibleSummaryEvents} from './out/assets/summary-data.mjs';
import {summaryMarkup} from './out/assets/summary.mjs';
import {comparisonCounts} from './out/assets/sales-yoy.mjs';
import {outcomeCounts} from './out/assets/profit-loss.mjs';
const snap=JSON.parse(fs.readFileSync('out/snapshot.json'));
const data={report:snap.data['/api/daily-sales'],events:snap.data['/api/events'],pnl:JSON.parse(fs.readFileSync('profit-loss.snapshot.json'))};
const today='2026-09-22',state={year:2026,month:9,basis:'all',channel:'all',grain:'month',metric:'sales',eventStatus:'all'};
test('All totals and YoY match Daily comparison, including partial and missing months',()=>{
 for(let month=1;month<=12;month++){
  const expected=createOverview(reportData,String(month)),actual=salesWindow(reportData,2026,month,null,'all',today);
  assert.equal(actual.current,expected.current.amount,`current ${month}`);assert.equal(actual.previous,expected.previous.amount,`previous ${month}`);assert.equal(actual.delta,expected.delta,`delta ${month}`);
  assert.equal(actual.growth===null?null:Math.round(actual.growth*1e8),expected.growth===null?null:Math.round(expected.growth*1e6),`growth ${month}`);
  for(const group of groups){const r=salesWindow(reportData,2026,month,null,group.id,today),e=expected.reports.find(r=>r.group.id===group.id);assert.equal(r.current,e.current.amount);assert.equal(r.previous,e.previous.amount);}
 }
 assert.equal(salesWindow(reportData,2026,9,null,'all',today).current,3965521.41);
});
test('Daily values sum to the month and unrecorded cells remain distinct from zero',()=>{
 for(const group of ['all',...groups.map(g=>g.id)]){const days=Array.from({length:20},(_,i)=>salesWindow(reportData,2026,9,i+1,group,today).current);assert.equal(Math.round(days.reduce((n,v)=>n+v,0)*100)/100,salesWindow(reportData,2026,9,null,group,today).current);}
 const empty={sources:{2569:{status:'ready'},2568:{status:'ready'}},records:[{year:2569,month:9,group:'Department Stores',lastDay:2,daily:[0,null]},{year:2568,month:9,group:'Department Stores',lastDay:2,daily:[100,100]}]};
 assert.equal(salesWindow(empty,2026,9,1,'department',today).current,0);assert.equal(salesWindow(empty,2026,9,1,'department',today).growth,-1);
 assert.equal(salesWindow(empty,2026,9,2,'department',today).current,null);assert.equal(salesWindow(empty,2026,9,2,'department',today).growth,null);assert.equal(salesWindow(reportData,2026,9,21,'all',today).current,null);
});
test('Department uses RBS + CDS + TM and financial branch counts remain monthly and deduplicated',()=>{
 const m=buildSummaryModel(data,state,today),s=m.selected;
 assert.deepEqual(s.growth,comparisonCounts(s.sales.channels.filter(c=>['RBS','CDS','TM'].includes(c.name)).flatMap(c=>c.rows)));assert(s.department.every(r=>['RBS','CDS','TM'].includes(r.type)));
 assert.deepEqual(m.counts,outcomeCounts(data.pnl.records.filter(r=>r.month===9)));
 for(const [key,value] of Object.entries(m.counts.branches))assert.equal(key==='total'?s.branches.length:s.branches.filter(r=>r.status===key).length,value);
 const daily=buildSummaryModel(data,{...state,grain:'day',day:5},today);assert.deepEqual(daily.counts,m.counts);assert.equal(daily.selected.finance.profit,s.finance.profit);assert.notEqual(daily.revenue.current,m.revenue.current);
 const growth=chartSeries(m,{...state,metric:'growth',growthStatus:'down'});assert.equal(growth[8].a,s.growth.down);assert.equal(growth[8].b,null);
 const loss=chartSeries(m,{...state,metric:'finance',profitStatus:'loss'});assert.equal(loss[8].a,m.counts.branches.loss);
});
test('Daily Event selection honors actual dates, including cross-month events',()=>{
 const d={comparison:null,events:{years:{2026:{items:[{name:'งาน A',range:{start:'2026-08-29',end:'2026-09-02'}},{name:'งาน B',range:{start:'2026-09-17',end:'2026-09-27'}},{name:'รอวันที่',month:9}]}}}};
 const m=buildSummaryModel(d,{...state,grain:'day',day:1},today);assert.equal(visibleSummaryEvents(m,state).length,1);
 const series=chartSeries(m,{...state,metric:'events'});assert.equal(series[0].a,1);assert.equal(series[2].a,0);assert.equal(series[16].a,1);
 const selected=chartSeries(m,{...state,metric:'events',event:m.selected.events[1].id});assert.equal(selected[0].a,0);assert.equal(selected[16].a,1);assert.equal(buildSummaryModel(d,state,today).selected.actual,null);
});
test('UI labels unavailable forecasts and escapes names in every chart mode',()=>{
 assert.match(summaryMarkup(data,{...state,month:1},today),/รอ \d+/);
 for(const grain of ['day','month'])for(const metric of ['sales','growth','finance','events']){
  const html=summaryMarkup({comparison:null,events:{years:{2026:{items:[{name:'<script>alert(1)</script>',range:{start:'2026-09-01',end:'2026-09-30'}}]}}}},{...state,grain,metric},today);
  assert.doesNotMatch(html,/NaN|Infinity|undefined|<script>alert/);assert.match(html,/&lt;script&gt;/);
 }
});
