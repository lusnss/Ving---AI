import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast} from './out/assets/event-predict-model.mjs';
import {prepareEventRequest} from './event-requests.mjs';
const input={mode:'manual',channel:'direct',days:3,expectedSales:10000,cogs:20,rent:1000,pc:500,shipping:200,other:0,downside:10,upside:10,targetMode:'manual',target:10000,area:24,pcCount:2,pcCostMode:'person',proposalDate:'2026-09-20',confirmBy:'2026-09-25'};
test('per-person PC cost multiplies staff and selling days; area does not scale sales',()=>{
 const r=forecast([],input);assert.equal(r.base.pc,3000);assert.equal(r.base.costs,6200);assert.equal(r.base.profit,3800);
 const more=forecast([],{...input,pcCount:3,area:48});assert.equal(more.base.sales,10000);assert.equal(more.base.pc,4500);assert.equal(more.base.profit,2300);
 assert(r.base.roi>more.base.roi);assert(r.breakEven<more.breakEven);
});
test('legacy total PC cost is not multiplied twice',()=>{
 for(const pcCostMode of ['total',undefined])assert.equal(forecast([],{...input,pcCostMode}).base.pc,1500);
});
test('missing and invalid headcount block per-person financials, explicit zero accepted',()=>{
 for(const pcCount of ['',-1,1.5,'abc',10001]){const r=forecast([],{...input,pcCount});assert(r.errors.includes('pcCount'));assert.equal(r.base.profit,null);}
 assert.equal(forecast([],{...input,pcCount:0}).base.pc,0);
 for(const area of [-1,0,'abc'])assert(forecast([],{...input,area}).errors.includes('area'));
 assert(!forecast([],{...input,area:''}).errors.includes('area'));
});
test('approval retains area, count, rate basis and server-computed PC costs',()=>{
 const body={id:'df164a45-6ea6-4aaa-bbae-e0afc841f752',place:'พื้นที่ทดสอบ',startDate:'2026-10-01',endDate:'2026-10-03',input,referenceKey:'manual'};
 const record=prepareEventRequest(body,{records:[],source:{}});
 assert.equal(record.area,'24');assert.equal(record.pc,'2');assert.equal(record.input.pcCostMode,'person');assert.equal(record.calculation.base.pc,3000);
 assert.equal(record.input.pc,500);
});
