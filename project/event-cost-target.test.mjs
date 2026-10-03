import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast} from './out/assets/event-predict-model.mjs';
import {prepareEventRequest} from './event-requests.mjs';
import {reviewModel,reviewMarkup} from './out/assets/event-review.mjs';

const input={mode:'manual',salesMode:'cost-target',channel:'direct',days:10,cogs:20,rent:1000,gp:30,pc:100,shipping:100,other:0,pcCostMode:'total',targetMode:'roi',downside:10,upside:10};

test('cost-only targets include every fixed and variable cost, with no sales input',()=>{
 for(const channel of ['direct','gp']){
  const r=forecast([],{...input,channel});
  assert.deepEqual(r.errors,[]);assert.equal(r.baseline.rate,null);
  assert.equal(r.breakEven,channel==='direct'?2625:2200);
  assert.equal(r.roiTarget,channel==='direct'?5000:10000);
  assert.equal(r.base.sales,r.roiTarget);assert(r.base.roi>=40);
  const lower=r.roiTarget-5000,costs=r.fixedCosts+r.variableRate*lower;
  assert((lower-costs)/costs*100<40);
  assert(Math.ceil(r.breakEven)*(1-r.variableRate)>=r.fixedCosts);
 }
});
test('per-person staff, inclusive dates and all one-time costs contribute to targets',()=>{
 const r=forecast([],{...input,startDate:'2026-10-01',endDate:'2026-10-03',pcCostMode:'person',pcCount:2,pc:500,shipping:200,other:300});
 assert.equal(r.base.pc,3000);assert.equal(r.fixedCosts,4500);
 assert.equal(r.breakEven,5625);assert.equal(r.roiTarget,10000);
 assert.equal(r.base.profit,3500);
});
test('missing costs, zero costs and unreachable targets do not produce misleading targets',()=>{
 for(const key of ['days','cogs','rent','pc','shipping','other']){
  const r=forecast([],{...input,[key]:''});assert(r.errors.includes(key));assert.equal(r.roiTarget,null);assert.equal(r.breakEven,null);
 }
 const high=forecast([],{...input,cogs:80});assert.equal(high.roiTarget,null);assert.equal(high.roiTargetStatus,'unreachable');assert.equal(high.base.sales,null);
 const loss=forecast([],{...input,channel:'gp',gp:90});assert.equal(loss.breakEven,null);assert(loss.noBreakEven);
 const free=forecast([],{...input,rent:0,pc:0,shipping:0,cogs:0});assert.equal(free.breakEven,0);assert.equal(free.roiTargetStatus,'no-fixed-cost');assert.equal(free.base.roi,null);
 const exact=forecast([],{...input,rent:0,pc:0,shipping:0,cogs:100});assert.equal(exact.breakEven,0);assert.equal(exact.noBreakEven,false);
});
test('server recomputes cost-only proposal and review identifies target sales accurately',()=>{
 const body={id:crypto.randomUUID(),place:'พื้นที่ใหม่ทดสอบ',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-10',input:{...input,expectedSales:999999,target:999999,proposalDate:'2026-09-21',confirmBy:'2026-09-25'}};
 const record=prepareEventRequest(body,{records:[],source:{}});
 assert.equal(record.sales,'5000');assert.equal(record.target,'5000');assert.equal(record.input.salesMode,'cost-target');
 assert.equal(reviewModel(record).legacy,false);assert.equal(reviewModel(record).costTarget,true);
 const html=reviewMarkup(record);assert.match(html,/คำนวณยอดขายเป้า ROI 40% จากต้นทุน/);assert.doesNotMatch(html,/ยอดประมาณการที่ผู้เสนอกรอก/);
 assert.throws(()=>prepareEventRequest({...body,input:{...body.input,cogs:80}},{records:[],source:{}}));
});
test('legacy manual estimates still use entered sales',()=>{
 const r=forecast([],{...input,salesMode:undefined,expectedSales:10000});assert.equal(r.base.sales,10000);assert.equal(r.base.profit,5900);
});
