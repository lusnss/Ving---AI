import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyPnlSummary,monthlyPnlMarkup} from './out/assets/event-pnl-monthly.mjs';
const item={name:'งาน A',category:'direct',months:[1,2,3]};
const record={name:'งาน A',year:2026,month:1,basis:'ACT',channel:'event-direct',net:100,cogs:20,costs:{rent:30}};
test('monthly results isolate month, year, ACT and channel; crossing months can change outcome',()=>{
 const rows=monthlyPnlSummary([item],2026,{records:[record,{...record,month:2,cogs:120},{...record,year:2025},{...record,basis:'FCT'},{...record,channel:'retail'}]});
 assert.equal(rows.length,12);assert.equal(rows[0].profit,1);assert.equal(rows[0].net,50);assert.equal(rows[1].loss,1);assert.equal(rows[1].net,-50);assert.equal(rows[2].pending,1);assert.equal(rows[2].net,null);assert.equal(rows[3].total,0);
});
test('break-even, missing costs, duplicates and failure never become profit or loss',()=>{
 for(const [records,status] of [[[ {...record,cogs:70} ],'even'],[[{...record,cogs:null}],'pending'],[[record,record],'pending']])assert.equal(monthlyPnlSummary([item],2026,{records})[0][status],1);
 const failed=monthlyPnlSummary([item],2026,{records:[record],unavailable:true})[0];assert.equal(failed.pending,1);assert.equal(failed.net,null);
 assert.match(monthlyPnlMarkup([item],2026,{unavailable:true}),/โหลดงบไม่ได้/);
});
test('booked month outside event dates is included; partial total is labeled',()=>{
 const rows=monthlyPnlSummary([item],2026,{records:[{...record,month:4}]});assert.equal(rows[3].profit,1);
 const items=[item,{name:'งาน B',category:'direct',months:[1]}];
 const html=monthlyPnlMarkup(items,2026,{records:[record]});assert.match(html,/เฉพาะงานที่ข้อมูลครบ/);
 for(const row of monthlyPnlSummary(items,2026,{records:[record]}))assert.equal(row.total,row.profit+row.loss+row.even+row.pending);
});
