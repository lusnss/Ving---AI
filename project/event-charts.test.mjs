import test from 'node:test';
import assert from 'node:assert/strict';
import {eventChartSeries,monthlyEventChart,eventComposition,eventRankingChart} from './out/assets/event-charts.mjs';
test('charts retain missing versus zero and handle negative and empty values without invalid geometry',()=>{
 const months=[{month:'มกราคม',sales:0,count:0},{month:'กุมภาพันธ์',sales:null,count:2},{month:'มีนาคม',sales:-150,count:3}];
 assert.deepEqual(eventChartSeries(months).slice(0,3).map(x=>x.value),[0,null,-150]);
 const chart=monthlyEventChart({months,as_of:'2026-03-17'});
 assert.match(chart,/event-chart-zero/);assert.match(chart,/event-chart-missing/);assert.match(chart,/มีนาคม: -฿150.00/);
 assert.doesNotMatch(chart,/NaN|Infinity|height="-/);
 for(const input of [{months:[]},{months:[{sales:0}]},{months:[{sales:-100}]}])assert.doesNotMatch(monthlyEventChart(input),/NaN|Infinity|height="-/);
 assert.match(monthlyEventChart({months},'count'),/จำนวนงานรายเดือน มีข้อมูล 3 เดือน/);
 assert.doesNotMatch(monthlyEventChart({months},'count'),/text-anchor="end">\d+\.\d/);
});
test('partial-month styling stops at month end, and chart content is escaped',()=>{
 const current={months:[{month:'<img src=x>',sales:20,count:1}],as_of:'2026-01-31'};
 assert(!monthlyEventChart(current).includes('class="event-chart-partial"'));
 assert(!monthlyEventChart(current).includes('<img'));assert(monthlyEventChart(current).includes('&lt;img'));
 current.as_of='2026-01-17';assert(monthlyEventChart(current).includes('class="event-chart-partial"'));
 assert(!eventRankingChart([{name:'<script>bad</script>',sales:100}]).includes('<script>'));
 assert.doesNotMatch(eventComposition({sources:[]},true),/NaN|Infinity/);
});
