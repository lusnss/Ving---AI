import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSummaryModel,chartSeries} from './out/assets/summary-data.mjs';
import {summaryMarkup} from './out/assets/summary.mjs';
const branch=(branch_code,type,total)=>({branch_code,branch:branch_code,type,month_to_date:total,daily_sales:{'2026-09-30':total}});
const data={report:{periods:{'2025-09':{year:2025,month:9,latest_date:'2025-09-30',branches:[branch('VA-1','Stand alone',100),branch('VA-2','Stand alone',200),branch('D1','CDS',100)]},'2026-09':{year:2026,month:9,latest_date:'2026-09-30',branches:[branch('VA-1','Stand alone',200),branch('VA-2','Stand alone',100),branch('VA-3','Stand alone',50),branch('D1','CDS',150),branch('D2','CDS',75)]}}},comparison:null};
const state={year:2026,month:9,metric:'growth',growthChannel:'standalone'};
test('Stand Alone splits growing, declining and new branches without changing Department',()=>{
 const m=buildSummaryModel(data,state,'2026-09-30');
 assert.equal(m.selected.standalone.length,3);
 assert.equal(m.selected.standaloneGrowth.up,1);assert.equal(m.selected.standaloneGrowth.down,1);assert.equal(m.selected.standaloneGrowth.new,1);
 assert.equal(m.selected.growth.up,1);assert.equal(m.selected.growth.down,0);assert.equal(m.selected.growth.new,1);
 assert.equal(chartSeries(m,{...state,growthStatus:'new'})[8].a,1);
 const r=m.selected.standalone[0];assert.equal(chartSeries(m,{...state,branch:`${r.type}|${r.branch_code}|${r.branch}`})[8].a,r.forecast);
 const html=summaryMarkup(data,state,'2026-09-30');assert.match(html,/Stand Alone · แนวโน้มสาขา/);assert.match(html,/YOY/);assert.doesNotMatch(html,/undefined|NaN|Infinity/);
 const missing=buildSummaryModel({report:null},state,'2026-09-30');assert.equal(chartSeries(missing,state)[8].a,null);
});
