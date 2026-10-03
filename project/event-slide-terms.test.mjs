import test from 'node:test';
import assert from 'node:assert/strict';
import {slideTermsRow,slideForecast,eventSlideModel} from './out/assets/event-slide.mjs';
import {prepareEventRequest,createEventRequest,updateEventRequest} from './event-requests.mjs';
import {eventProposalDetail} from './event-proposal-deletions.mjs';
import {previewDatabase} from './preview-db.mjs';
const body={id:'10000000-0000-4000-8000-000000000000',place:'พื้นที่ทดสอบ',startDate:'2026-10-01',endDate:'2026-10-07',referenceKey:'manual',input:{mode:'manual',salesMode:'cost-target',channel:'direct',days:7,cogs:22.5,rent:31500,gp:0,pc:700,pcCount:1,pcCostMode:'person',shipping:3000,other:0,targetMode:'roi',roiPercent:40,expectedSales:'',target:'',downside:10,upside:10,proposalDate:'2026-09-27',confirmBy:'2026-09-30',proposalScenario:'base'}};
const request=body=>new Request('https://example.test/api/event-requests',{method:'PATCH',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});
test('edited expenses reconcile fixed cost, target, break-even and persisted financials',async()=>{
 const env={DB:previewDatabase()};try{
 await createEventRequest(request(body),env,{records:[]});const original=(await eventProposalDetail(env,'web:'+body.id)).item;
 const edited=slideTermsRow(original,{rent:40000,pc:800,shipping:4000,other:500});
 assert.equal(edited.calculation.fixedCosts,50100);assert.equal(original.calculation.fixedCosts,39400);
 const projection=slideForecast(edited,85000);assert.equal(projection.costs,69225);assert.equal(projection.profit,15775);
 assert.notEqual(edited.calculation.breakEven,original.calculation.breakEven);assert.notEqual(edited.target,original.target);
 await updateEventRequest(request({...body,input:edited.input,revision:original.createdAt,editToken:crypto.randomUUID()}),env,{records:[]});
 const saved=(await eventProposalDetail(env,'web:'+body.id)).item;
 assert.deepEqual(saved.calculation,edited.calculation);assert.equal(Number(saved.sales),edited.sales);
 assert.deepEqual(eventSlideModel(saved,{},85000).metrics,eventSlideModel(edited,{},85000).metrics);
 const gp=slideTermsRow(saved,{channel:'gp',gp:20});assert.equal(gp.calculation.fixedCosts,10100);assert.equal(slideForecast(gp,85000).costs,46225);
 const invalid=slideTermsRow(saved,{cogs:101});assert.ok(invalid.calculation.errors.includes('cogs'));
 }finally{env.DB.close();}
});
