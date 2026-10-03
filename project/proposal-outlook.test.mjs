import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeProposalOutlook,proposalsMarkup} from './out/assets/event-proposals.mjs';

test('outlook separates selected forecasts from independent targets without changing saved rows',()=>{
 const rows=[
  {input:{mode:'history'},sales:'10,000',target:20000,calculation:{proposed:{sales:10000},target:{sales:20000}}},
  {input:{mode:'manual'},sales:30000,target:40000,calculation:{proposed:{sales:30000},target:{sales:40000}}},
  {input:{mode:'manual'},sales:9000,target:15000,calculation:{target:{sales:15000,profit:3000}}},
  {sales:'พื้นที่ใหม่',profit:'พื้นที่ใหม่',target:'5,000'},
  {sales:7000,target:'',workflow:{status:'cancelled'}}
 ];
 const before=JSON.stringify(rows);
 assert.deepEqual(summarizeProposalOutlook(rows),{
  new:{value:50000,count:3,total:3},history:{value:17000,count:2,total:2},target:{value:80000,count:4,total:5}
 });
 assert.equal(JSON.stringify(rows),before);
});

test('missing forecasts and targets remain unknown while explicit zero counts as known',()=>{
 const summary=summarizeProposalOutlook([
  {sales:12000},
  {sales:'พื้นที่ใหม่',profit:'พื้นที่ใหม่'},
  {input:{mode:'manual'},sales:0,target:0,calculation:{proposed:{sales:0},target:{sales:0}}},
  {sales:'?',target:'Infinity'},
  {sales:'',target:' '}
 ]);
 assert.deepEqual(summary.new,{value:0,count:1,total:2});
 assert.deepEqual(summary.history,{value:12000,count:1,total:3});
 assert.deepEqual(summary.target,{value:0,count:1,total:5});
 for(const group of Object.values(summarizeProposalOutlook([])))assert.deepEqual(group,{value:null,count:0,total:0});
 assert.deepEqual(summarizeProposalOutlook([{sales:100}]).target,{value:null,count:0,total:1});
});

test('targets use their saved snapshot and round each event upward like the target column',()=>{
 assert.deepEqual(summarizeProposalOutlook([
  {sales:1,target:99999,calculation:{target:{sales:12000.01}}},
  {sales:2,target:'20,000.01'},
  {sales:3,calculation:{target:{sales:0}}}
 ]).target,{value:32002,count:3,total:3});
});

test('all three cards follow selected month, include all statuses and report incomplete targets',()=>{
 const items=[
  {month:'2026-10',input:{mode:'manual'},sales:30000,target:40000,calculation:{proposed:{sales:30000}}},
  {month:'2026-10',sales:10000,target:20000,workflow:{status:'cancelled'}},
  {month:'2026-10',sales:5000},
  {month:'2026-11',sales:900000,target:1000000}
 ];
 const overview=month=>proposalsMarkup({items},undefined,month).split('<section class="proposal-dashboard"')[0];
 const oct=overview('2026-10');
 for(const [key,value] of [['sales-new',30000],['sales-history',15000],['target-total',60000]])assert.ok(oct.includes(`data-proposal-number="${value}" data-metric-key="${key}"`));
 assert.match(oct,/มีเป้าหมาย <b>2<\/b> จาก 3 งาน · ยังไม่มีเป้าหมาย 1 งาน/);
 assert.equal((oct.match(/data-outlook=/g)||[]).length,3);
 assert.doesNotMatch(oct,/ยอดขายคาดการณ์ \/ ตั้งเป้ารวม/);
 const nov=overview('2026-11');
 assert.match(nov,/data-proposal-number="1000000" data-metric-key="target-total"/);
 assert.doesNotMatch(nov,/data-metric-key="sales-new"/);
 const empty=overview('2027-01');
 assert.doesNotMatch(empty,/data-metric-key="(?:sales-new|sales-history|target-total)"|NaN|Infinity/);
});
