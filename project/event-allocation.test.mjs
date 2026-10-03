import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {allocateEventRecords} from './out/assets/event-allocation.mjs';
import {selectRecords,summarize,outcomeCounts,monthlySummaries,statementRecords,eventAllocationSection} from './out/assets/profit-loss.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const row={year:2026,month:8,channel:'event-direct',name:'งาน 26/08-09/09/69',code:'',basis:'ACT',gross:1500,discount:0,net:1500,cogs:300,opex:600,grossProfit:1200,profit:600,sourceProfit:600,difference:0,costs:{rent:450,pc:150,shipping:null},missingCosts:1};
const state={month:'9',channel:'all',basis:'all'};
test('inclusive days split all revenue and cost fields; preserve totals and nulls',()=>{
 const rows=allocateEventRecords([row]);assert.deepEqual(rows.map(r=>[r.month,r.allocation.days]),[[8,6],[9,9]]);
 near(rows[1].net,900);near(rows[1].profit,360);near(rows[1].costs.rent,270);assert.equal(rows[1].costs.shipping,null);
 for(const key of ['gross','discount','net','cogs','opex','grossProfit','profit','sourceProfit','difference'])near(rows.reduce((n,r)=>n+r[key],0),row[key]);
 assert.deepEqual(allocateEventRecords(rows),rows);assert.equal(outcomeCounts(rows).events.total,1);
});
test('all views use allocated values and count loss and missing data correctly',()=>{
 const data={year:2026,records:[row,{...row,name:'ขาดทุน 26/08-09/09/69',opex:1500,profit:-300,sourceProfit:-300},{...row,name:'รอต้นทุน 26/08-09/09/69',cogs:null,profit:null}]};
 const selected=selectRecords(data,state);assert.equal(selected.length,3);assert.deepEqual(outcomeCounts(selected).events,{total:3,profit:1,loss:1,zero:0,pending:1});
 near(monthlySummaries(data,state)[8].net,summarize(selected).net);assert.deepEqual(statementRecords(data,{...state,salesMode:'current'}),selected);
 near(summarize(statementRecords(data,{...state,salesMode:'cumulative'})).net,4500);
 const html=eventAllocationSection(selected);assert.match(html,/ยอดรวมรอบงาน 3 งาน/);assert.match(html,/9 \/ 15 วัน/);assert.match(html,/360.00/);
});
test('year boundary, leap days, invalid dates, branches, and separately booked months',()=>{
 const cross=allocateEventRecords([{...row,year:2025,month:12,name:'งาน 30/12/68-02/01/69'}]);assert.deepEqual(cross.map(r=>[r.year,r.month,r.allocation.days]),[[2025,12,2],[2026,1,2]]);
 assert.equal(selectRecords({year:2026,records:[{...row,year:2025,month:12,name:'งาน 30/12/68-02/01/69'}]},{...state,month:'1'}).length,1);
 assert.deepEqual(allocateEventRecords([{...row,year:2024,name:'งาน 28/02-01/03/67'}]).map(r=>r.allocation.days),[2,1]);
 const invalid=allocateEventRecords([{...row,name:'รอยืนยันวัน'}]);assert.equal(invalid[0].net,1500);assert(invalid[0].allocationWarning);
 const monthly=allocateEventRecords([row,{...row,month:9}]);assert.equal(monthly.length,2);assert(monthly.every(r=>!r.allocation&&r.net===1500));
 assert(!allocateEventRecords([{...row,amountScope:'monthly'}])[0].allocation);
 const branch={...row,channel:'consign'};assert.equal(allocateEventRecords([branch])[0],branch);
});
test('real workbook carries four August events into September without changing yearly money',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./profit-loss.snapshot.json',import.meta.url)));
 const rows=selectRecords(data,state).filter(r=>r.channel.startsWith('event-'));
 assert.equal(rows.filter(r=>r.allocation?.sourceMonth===8).length,4);assert.equal(outcomeCounts(rows).events.total,8);
 const all=allocateEventRecords(data.records);for(const key of ['net','cogs','opex','profit'])near(all.reduce((n,r)=>n+(r[key]||0),0),data.records.reduce((n,r)=>n+(r[key]||0),0));
});
