import test from 'node:test';
import assert from 'node:assert/strict';
import {eventPnl,eventPnlDetail} from './out/assets/event-pnl.mjs';
import {eventListMarkup} from './out/assets/event-directory.mjs';
const item={name:'งาน A 1-3/01/69',category:'direct'};
const record={...item,year:2026,month:1,basis:'ACT',channel:'event-direct',gross:110,discount:10,net:100,cogs:20,costs:{rent:30,pc:0}};
const data=(...records)=>({records});
test('profit, loss, break-even, missing and explicit zero costs',()=>{
 assert.equal(eventPnl(item,2026,data(record)).totals.profit,50);
 assert.equal(eventPnl(item,2026,data({...record,cogs:120})).status,'loss');
 assert.equal(eventPnl(item,2026,data({...record,cogs:70})).status,'even');
 assert.equal(eventPnl(item,2026,data({...record,costs:{rent:null,pc:0}})).status,'incomplete');
 assert.equal(eventPnl(item,2026,data({...record,net:null})).totals.profit,null);
 assert.equal(eventPnl(item,2026,{}).status,'pending');
 assert.equal(eventPnl(item,2026,{unavailable:true}).status,'unavailable');
});
test('full identity, channel, year and ACT isolate each event; duplicate month cannot double count',()=>{
 for(const override of [{name:'งาน A 4-6/01/69'},{year:2025},{channel:'event-gp'},{basis:'FCT'}])assert.equal(eventPnl(item,2026,data({...record,...override})).status,'pending');
 assert.equal(eventPnl(item,2026,data(record,record)).status,'ambiguous');
 assert.equal(eventPnl(item,2026,data(record,{...record,month:2})).totals.profit,100);
 assert.equal(eventPnl({...item,name:'ชื่ออนุมัติ',catalogName:item.name},2026,data(record)).totals.profit,50);
});
test('directory names open statements and unknown amounts stay unknown without unsafe HTML',()=>{
 const html=eventListMarkup([item],'2026',{},data(record));assert.match(html,/data-event-pnl=/);assert.match(html,/กำไร \/ ขาดทุน/);assert.match(html,/50\.00/);
 assert.doesNotMatch(eventListMarkup([item],'2025'),/data-event-pnl=/);
 const detail=eventPnlDetail({...item,name:'<img src=x>'},2026,{});assert(!detail.includes('<img'));assert.match(detail,/ยังไม่มีงบ/);assert.match(detail,/ยอดขายสุทธิ/);
});

test('Only the three optional blank costs count as zero; every other missing cost stays incomplete',()=>{
 const costs={rent:18639.39,pc:8530.5,shipping:1000,mallDeduction:null,marketing:null,misc:null};
 const row={...record,net:56483,cogs:16690,costs};
 const result=eventPnl(item,2026,data(row));
 assert.equal(result.status,'profit');assert.equal(result.totals.opex,28169.89);assert.equal(result.totals.profit,11623.11);
 for(const key of ['mallDeduction','marketing','misc'])assert.equal(result.costTotals[key],0);
 assert.match(eventPnlDetail(item,2026,data(row)),/11,623.11/);
 assert.match(eventPnlDetail(item,2026,data(row)),/28,169.89/);
 for(const key of ['mallDeduction','marketing','misc']){
  assert.equal(eventPnl(item,2026,data({...row,costs:{...costs,[key]:100}})).totals.profit,11523.11);
  for(const blank of [null,undefined,'',' '])assert.equal(eventPnl(item,2026,data({...row,costs:{...costs,[key]:blank}})).totals.profit,11623.11);
  assert.equal(eventPnl(item,2026,data({...row,costs:{...costs,[key]:'invalid'}})).status,'incomplete');
 }
 for(const key of ['rent','pc','shipping','electricity','depreciation','interest','landTax']){
  assert.equal(eventPnl(item,2026,data({...row,costs:{...costs,[key]:null}})).status,'incomplete');
 }
 const combined=eventPnl(item,2026,data(row,{...row,month:2,costs:{...costs,mallDeduction:100,marketing:200,misc:300}}));
 assert.equal(combined.totals.profit,22646.22);
 assert.equal(combined.costTotals.misc,300);
 assert.equal(costs.misc,null);
});
