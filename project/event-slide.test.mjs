import test from 'node:test';
import assert from 'node:assert/strict';
import {eventSlideModel,slideImageUrls,slideForecast} from './out/assets/event-slide.mjs';
import {proposalColumns,defaultProposalColumns,proposalsMarkup} from './out/assets/event-proposals.mjs';

test('slides use proposed amounts, retain zero and losses, and exclude personal fields',()=>{
 const row={source:'web',place:'พื้นที่ทดสอบ',input:{mode:'history',days:10,channel:'gp',gp:25,cogs:30,pc:500,shipping:0,other:0},sales:'5000',profit:'-1000',roi:'-16.67%',margin:'-20%',calculation:{base:{sales:8000,profit:1000},proposed:{sales:5000,profit:-1000,costs:6000},breakEven:5500.1},submittedBy:{name:'PRIVATE PERSON',email:'private@example.invalid'},trade:'รออนุมัติ'};
 const m=eventSlideModel(row);
 assert.equal(m.metrics[0][1],'฿5,000');assert.equal(m.metrics[1][1],'฿-1,000');assert.equal(m.metrics[1][2],'loss');assert.equal(m.metrics[2][1],'฿5,501');
 assert.equal(m.terms.find(([key])=>key==='ขนส่ง / งาน')[1],'฿0');
 assert.doesNotMatch(JSON.stringify(m),/PRIVATE PERSON|private@example/);
});
test('manual legacy target and unknowns preserve table meaning',()=>{
 const legacy=eventSlideModel({input:{mode:'manual'},target:'60000',calculation:{base:{sales:40000,profit:12000},target:{sales:60000,profit:20000,costs:40000,roi:50}}});
 assert.equal(legacy.metrics[0][1],'฿60,000');assert.equal(legacy.metrics[1][1],'฿20,000');assert.equal(legacy.metrics[4][1],'50%');
 const empty=eventSlideModel({sales:'พื้นที่ใหม่',profit:'พื้นที่ใหม่'});
 assert.equal(empty.metrics[0][1],'—');assert.equal(empty.metrics[1][1],'—');assert.match(empty.terms[0][1],/ต้องถามเจ้าของ/);
 const zero=eventSlideModel({sales:0,profit:-100});assert.equal(zero.metrics[0][1],'฿0');assert.equal(zero.metrics[1][1],'฿-100');
});
test('only valid saved image ids yield same-origin event attachment routes',()=>{
 const proposalId='10000000-0000-4000-8000-000000000000',imageId='20000000-0000-4000-8000-000000000000';
 assert.deepEqual(slideImageUrls({id:proposalId,attachments:[{id:imageId}]}),[`/api/event-images/${proposalId}/${imageId}`]);
 assert.deepEqual(slideImageUrls({}),[]);
 assert.throws(()=>slideImageUrls({id:proposalId,attachments:[{url:'https://untrusted.invalid'}]}));
 assert.throws(()=>slideImageUrls({id:'../other',attachments:[imageId]}));
});
test('slide action remains available in compact actions for both groups',()=>{
 assert.ok(proposalColumns.some(([key])=>key==='slide'));assert.ok(defaultProposalColumns.includes('actions'));assert.ok(!defaultProposalColumns.includes('slide'));
 const html=proposalsMarkup({items:[{id:'one',place:'A'},{id:'two',place:'B',input:{mode:'manual'}}]});
 assert.equal((html.match(/data-event-slide=/g)||[]).length,2);
});


test('slide goals preserve selected thresholds and distinguish required daily sales from forecast',()=>{
 const row={sales:62701,target:80000,input:{mode:'history',days:13,targetMode:'roi',roiPercent:50}};
 const model=eventSlideModel(row);
 assert.deepEqual(model.goals,[['ยอดขายเป้าหมาย / งาน','฿80,000'],['ยอดขายที่ต้องทำ / วัน','฿6,154'],['เกณฑ์เป้าหมาย','ROI 50%']]);
 assert.equal(model.dailySales,'฿4,823');
 const pc=eventSlideModel({...row,input:{...row.input,targetMode:'pc',pcPercent:12.5}});
 assert.equal(pc.goals[2][1],'ค่าแรง PC 12.5%');
 const both=eventSlideModel({...row,input:{...row.input,targetMode:'roi-pc',pcPercent:13}});
 assert.equal(both.goals[2][1],'ROI 50% + ค่าแรง PC 13%');
});
test('manual and missing goals do not invent a percentage or daily amount',()=>{
 assert.equal(eventSlideModel({target:80000}).goals[2][1],'กำหนดยอดขายเอง');
 const empty=eventSlideModel({});
 assert.equal(empty.goals[0][1],'—');assert.equal(empty.goals[1][1],'—');
 assert.equal(empty.goals[2][1],'ยังไม่ระบุ [ต้องถามเจ้าของ]');
 assert.equal(eventSlideModel({target:0,input:{days:13}}).goals[1][1],'฿0');
});

const forecastRow={place:'พื้นที่ทดสอบ',sales:85000,target:85000,input:{mode:'manual',salesMode:'cost-target',days:7,channel:'direct',rent:31500,cogs:22.5,pc:700,pcCount:1,pcCostMode:'person',shipping:3000,other:0},calculation:{base:{sales:85000,profit:26475,costs:58525},breakEven:50839}};
test('slide forecast starts at zero, recalculates costs and retains saved target without mutation',()=>{
 const before=structuredClone(forecastRow),zero=slideForecast(forecastRow);
 assert.equal(zero.sales,0);assert.equal(zero.profit,-39400);assert.equal(zero.margin,null);
 const result=slideForecast(forecastRow,'85,000');
 assert.equal(result.costs,58525);assert.equal(result.profit,26475);
 const model=eventSlideModel(forecastRow,{},85000);
 assert.equal(model.metrics[1][1],'฿26,475');assert.equal(model.metrics[5][1],'฿58,525');
 assert.equal(eventSlideModel(forecastRow,{},0).goals[0][1],'฿85,000');
 assert.equal(eventSlideModel(forecastRow,{},0).metrics[1][2],'loss');
 assert.deepEqual(forecastRow,before);
});
test('slide forecast handles GP, multiple PC staff, zero costs, missing costs and invalid values',()=>{
 const gp={input:{channel:'gp',gp:25,cogs:30,days:10,pc:500,pcCostMode:'person',pcCount:2,shipping:1000,other:2000}};
 assert.equal(slideForecast(gp,100000).profit,32000);
 assert.equal(slideForecast({input:{...gp.input,pc:0,gp:0,cogs:0,shipping:0,other:0}},100).profit,100);
 assert.equal(slideForecast({input:{...gp.input,cogs:''}},100).profit,null);
 assert.equal(slideForecast({},100).profit,null);
 for(const value of ['',-1,'abc','10%',Infinity,1e11,'1,2','1.234'])assert.equal(slideForecast(gp,value).invalid,true);
});
test('slide forecast recalculates commission at sales thresholds',async()=>{
 const {compensationDefaults}=await import('./out/assets/event-compensation.mjs');
 const row={input:{...forecastRow.input,...compensationDefaults('เดอะมอลล์ บางแค'),pcCount:1}};
 assert.equal(slideForecast(row,80000).commission,0);
 assert.equal(slideForecast(row,85000).commission,850);
 assert.equal(slideForecast(row,85000).profit,25625);
});
