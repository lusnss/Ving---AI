import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast} from './out/assets/event-predict-model.mjs';
import {createEventRequest,listEventRequests,updateEventRequest} from './event-requests.mjs';
import {previewDatabase} from './preview-db.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';

const input={mode:'manual',salesMode:'cost-target',channel:'direct',days:10,cogs:20,rent:1000,gp:30,pc:100,shipping:100,other:0,pcCostMode:'total',targetMode:'roi',downside:10,upside:10};
test('individual goals and both goals use the minimum 5,000-baht increment satisfying their conditions',()=>{
 for(const rent of [1000,20000])for(const targetMode of ['roi','pc','roi-pc']){
  const r=forecast([],{...input,rent,targetMode});
  assert.equal(r.pcTarget,10000);
  const expected=targetMode==='roi'?r.roiTarget:targetMode==='pc'?10000:Math.max(r.roiTarget,10000);
  assert.equal(r.target.sales,expected);assert.equal(r.base.sales,expected);
  if(targetMode!=='pc')assert(r.target.roi>=40);
  if(targetMode!=='roi')assert(r.target.pc/r.target.sales<=.13);
  const lower=expected-5000,lowerCosts=r.fixedCosts+r.variableRate*lower;
  assert((targetMode!=='pc'&&(lower-lowerCosts)/lowerCosts<.4)||(targetMode!=='roi'&&r.target.pc/lower>.13));
 }
});
test('PC target uses inclusive dates and staff count only for per-person wages',()=>{
 const base={...input,targetMode:'pc',startDate:'2026-10-01',endDate:'2026-10-03',pc:500,pcCount:2};
 assert.equal(forecast([],base).target.sales,15000);
 assert.equal(forecast([],{...base,pcCostMode:'person'}).target.sales,25000);
 assert.equal(forecast([],{...base,pc:0}).pcTarget,0);
 for(const patch of [{pc:''},{pc:-1},{endDate:''},{pcCostMode:'person',pcCount:''},{pcCostMode:'person',pcCount:1.5}])assert.equal(forecast([],{...base,...patch}).target,null);
});
test('both goals stay unavailable when ROI cannot be reached; PC alone does not depend on ROI',()=>{
 assert.equal(forecast([],{...input,targetMode:'roi-pc',cogs:80}).target,null);
 assert.equal(forecast([],{...input,targetMode:'pc',cogs:80}).target.sales,10000);
 assert.equal(forecast([],{...input,targetMode:'roi-pc',rent:''}).target,null);
 const manual=forecast([],{...input,targetMode:'manual',target:12000});assert.equal(manual.base.sales,12000);
 assert.equal(forecast([],{...input,targetMode:'manual',target:''}).base.sales,null);
});
test('history scenarios retain their baseline when goals change',()=>{
 const rows=[{usable:true,net:10000,days:10}];
 for(const targetMode of ['roi','pc','roi-pc','manual']){
  const r=forecast(rows,{...input,mode:'history',salesMode:'',targetMode,target:20000});
  assert.deepEqual(r.scenarios.map(s=>s.sales),[9000,10000,11000]);
 }
});
test('goals persist per Event, are recalculated on save and edit, and appear in the approval review',async()=>{
 const env={DB:previewDatabase()},dataset={records:[],source:{}};
 const request=(body,method='POST')=>new Request('https://example.test/api/event-requests',{method,headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});
 const body={id:crypto.randomUUID(),place:'พื้นที่ทดสอบเป้าหมาย',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-10',input:{...input,targetMode:'roi-pc',target:999999,proposalDate:'2026-09-23',confirmBy:'2026-09-30'}};
 try{
  await createEventRequest(request(body),env,dataset);
  await createEventRequest(request(body),env,dataset);
  let items=(await listEventRequests(env)).items;assert.equal(items.length,1);
  const original=items[0];assert.equal(original.target,'10000');assert.equal(original.sales,'10000');assert.equal(original.input.targetMode,'roi-pc');
  assert.match(reviewMarkup(original),/ROI 40% \+ ค่าแรง PC 13%/);
  const edited={...body,revision:original.createdAt,editToken:crypto.randomUUID(),input:{...body.input,targetMode:'pc',pcCostMode:'person',pcCount:2,pc:500}};
  await updateEventRequest(request(edited,'PATCH'),env,dataset);
  items=(await listEventRequests(env)).items;assert.equal(items[0].input.targetMode,'pc');assert.equal(items[0].target,'80000');
  assert.match(reviewMarkup(items[0]),/คำนวณยอดขายเป้า ค่าแรง PC 13%/);
  assert.doesNotMatch(reviewMarkup(items[0]),/เป้า ROI 40%/);
 }finally{env.DB.close();}
});
test('custom percentages change the chosen target and reject invalid active percentages',()=>{
 for(const roiPercent of [0,25,60,100]){
  const r=forecast([],{...input,roiPercent});
  assert(r.target.roi>=roiPercent);
  const lower=r.target.sales-5000,cost=r.fixedCosts+r.variableRate*lower;
  assert((lower-cost)/cost*100<roiPercent);
 }
 for(const pcPercent of [10,13,20]){
  const r=forecast([],{...input,targetMode:'pc',pcPercent});
  assert.equal(r.target.sales,Math.ceil(1000/(pcPercent/100)/5000)*5000);
 }
 for(const roiPercent of ['',-1,'bad',10001]){const r=forecast([],{...input,roiPercent});assert(r.errors.includes('roiPercent'));assert.equal(r.target,null);}
 for(const pcPercent of ['',0,-1,101,'bad']){const r=forecast([],{...input,targetMode:'pc',pcPercent});assert(r.errors.includes('pcPercent'));assert.equal(r.target,null);}
});
test('custom target rates survive save, retry and edit and appear in approval review',async()=>{
 const env={DB:previewDatabase()},dataset={records:[],source:{}};
 const request=(body,method='POST')=>new Request('https://example.test/api/event-requests',{method,headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});
 const body={id:crypto.randomUUID(),place:'พื้นที่ทดสอบเปอร์เซ็นต์',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-10',input:{...input,targetMode:'pc',roiPercent:55,pcPercent:10,cogs:22.5,gp:33,proposalDate:'2026-09-23',confirmBy:'2026-09-30'}};
 try{
  await createEventRequest(request(body),env,dataset);await createEventRequest(request(body),env,dataset);
  const [saved]=(await listEventRequests(env)).items;
  assert.equal(saved.target,'10000');assert.equal(saved.input.roiPercent,55);assert.equal(saved.input.pcPercent,10);assert.equal(saved.input.cogs,22.5);assert.equal(saved.input.gp,33);
  assert.match(reviewMarkup(saved),/ค่า PC ไม่เกิน 10%/);assert.doesNotMatch(reviewMarkup(saved),/ค่า PC ไม่เกิน 14%/);
  await updateEventRequest(request({...body,revision:saved.createdAt,editToken:crypto.randomUUID(),input:{...body.input,targetMode:'roi',roiPercent:60}},'PATCH'),env,dataset);
  const [edited]=(await listEventRequests(env)).items;
  assert.equal(edited.input.roiPercent,60);assert(edited.calculation.target.roi>=60);assert.match(reviewMarkup(edited),/ROI 60%/);
 }finally{env.DB.close();}
});
