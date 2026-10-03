import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPromotionPolicy,validatePromotionPolicy,recommendedDiscount,promotionTotals,promotionUnitFinance,allocatePromotionLine,groupPromotionModels} from './out/assets/promotion-model.mjs';
import {promotionStock,savePromotionPlan,readPromotionPlans} from './promotions-data.mjs';
import {readPromotionHistory,applyPromotionHistory} from './promotion-forecast-data.mjs';
import {previewDatabase} from './preview-db.mjs';
import {promotionEventVersion} from './out/assets/promotion-schedule.mjs';
const period={months:['2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'],start:'2026-03-01',end:'2026-08-31',days:184,asOf:'2026-09-24'};
const branches=[{id:'CDS01',name:'Department one'},{id:'RBS02',name:'Department two'},{id:'STAND ALONE01',name:'Standalone one'}];
const history=Object.fromEntries(period.months.map((month,i)=>[month,{month,total:3,fetchedAt:'2026-09-24T08:00:00Z',rows:branches.map(b=>({id:b.id+i,branchId:b.id,sku:'VING-Test-Black#40',model:'Test',qty:10,date:month+'-01T00:00:00Z'}))}]));
function context(){return {
 period,
 sources:async()=>({inventory:{items:[{id:'one',sku:'VING-Test-Black#40',source:'scaleup',available:60,fullPrice:1000,productType:'NORMAL'},{id:'two',sku:'VING-Test-Black#41',source:'scaleup',available:30,fullPrice:1000,productType:'NORMAL'},{id:'bag',sku:'BAG',source:'scaleup',available:2000,productType:'FREE'}],sources:[{source:'scaleup',updatedAt:'2026-09-24T00:00:00Z'}]},costs:{items:[{model:'Test',grade:'A',type:'SHOES',beforeVat:300,includingVat:321,sourceRow:1}]},branches:[{id:'DEST',name:'Destination'}]}),
 activities:async()=>[{status:'planned',items:[{inventoryId:'one',qty:3}]}],
 manifest:async()=>({period,branches,products:[]}),history:async()=>({history,failedMonths:[],period}),
 branchStock:async ids=>({branches,products:[],lastUpdatedAt:'2026-09-24T00:00:00Z',skuTotals:[{sku:'VING-Test-Black#40',normal:60,hold:10},{sku:'VING-Test-Black#41',normal:30,hold:0}]})
};}
const input={name:'Monthly test',month:'2026-10',channel:'department',scope:'branch',branchId:'CDS01',status:'proposed',policy:defaultPromotionPolicy,policyConfirmed:true,gp:30,lines:[{key:JSON.stringify(['Test','A','model']),qty:2,discount:15}]};
const req=body=>new Request('https://local/api/promotions',{method:'POST',body:JSON.stringify(body)});
test('fixed prices mix with percent discounts, survive save/edit, and are applied to each allocated size',async()=>{
 const DB=previewDatabase(),env={DB},c=context();try{
  const stock=await promotionStock(c,'department','CDS01');
  const lines=[{key:stock.rows[0].key,qty:3,pricingMode:'price',salePrice:499.99,discount:99},{key:stock.rows[1].key,qty:2,discount:20}];
  const first=(await savePromotionPlan(req({...input,lines}),env,c,{canEdit:true})).plan;
  assert.equal(first.totals.net,3099.97);assert.equal(first.totals.afterGp,2169.98);
  assert.equal(first.lines[0].salePrice,499.99);assert.equal(first.lines[0].discount,null);
  assert.ok(allocatePromotionLine(first.lines[0]).every(r=>promotionUnitFinance(r).after===499.99));
  assert.equal(first.approval,'unapproved');
  assert.equal((await readPromotionPlans(env))[0].lines[0].pricingMode,'price');
  const edited=(await savePromotionPlan(req({...input,id:first.id,expectedVersion:1,lines:lines.map((line,i)=>i?line:{...line,salePrice:599})}),env,c,{canEdit:true})).plan;
  assert.equal(edited.totals.net,3397);assert.equal(edited.lines[0].salePrice,599);
  for(const salePrice of [null,0,-1,'499',1.001,1e20])await assert.rejects(savePromotionPlan(req({...input,lines:[{...lines[0],salePrice}]}),env,c,{canEdit:true}),e=>e.status===409);
  await assert.rejects(savePromotionPlan(req({...input,lines:[{...lines[0],pricingMode:'invalid'}]}),env,c,{canEdit:true}),e=>e.status===409);
 }finally{DB.close();}
});
test('fixed price calculates revenue without full price, leaves discount unknown, and does not invent missing cost',()=>{
 const lines=[{qty:2,pricingMode:'price',salePrice:499.99,fullPrice:null,unitCost:300},{qty:1,pricingMode:'price',salePrice:499.99,fullPrice:1000,unitCost:null}];
 const t=promotionTotals(lines,30);
 assert.equal(t.net,1499.97);assert.equal(t.profit,399.98);assert.equal(t.afterGp,1049.98);
 assert.equal(t.gross,null);assert.equal(t.discount,null);assert.equal(t.missingFullPrice,1);assert.equal(t.missingCost,1);assert.equal(t.missing,0);
 const varied={qty:10,pricingMode:'price',salePrice:650.25,members:[{key:'a',available:3,fullPrice:1000,unitCost:200},{key:'b',available:7,fullPrice:1200,unitCost:300}]};
 assert.equal(promotionTotals([varied],0).net,6502.5);assert.equal(promotionTotals([varied],0).profit,3802.5);
});
test('promotion conditions persist through create, reload, legacy edits and explicit clearing without changing totals',async()=>{
 const DB=previewDatabase(),env={DB},c=context();
 try{
  const conditions='คู่แรกลด 30%\nซื้อ 2 คู่ ลด 40%\nของแถมตามที่ระบุ';
  const first=(await savePromotionPlan(req({...input,conditions:' '+conditions+' '}),env,c,{canEdit:true})).plan;
  assert.equal(first.conditions,conditions);
  assert.equal((await readPromotionPlans(env))[0].conditions,conditions);
  assert.deepEqual(first.totals,promotionTotals(first.lines,first.gp));
  const edit={...input,id:first.id,expectedVersion:1};
  const retained=(await savePromotionPlan(req(edit),env,c,{canEdit:true})).plan;
  assert.equal(retained.conditions,conditions);
  const cleared=(await savePromotionPlan(req({...edit,expectedVersion:2,conditions:''}),env,c,{canEdit:true})).plan;
  assert.equal(cleared.conditions,'');
  for(const conditions of [null,{},42,'ก'.repeat(2001)])await assert.rejects(savePromotionPlan(req({...input,conditions}),env,c,{canEdit:true}),e=>e.status===400);
  assert.equal((await readPromotionPlans(env)).length,1);
 }finally{DB.close();}
});
test('promotion create/edit persists month and dates, and verifies the linked Event on the server',async()=>{
 const DB=previewDatabase(),env={DB},c=context();
 const event={id:'web:10000000-0000-4000-8000-000000000001',name:'Fixture Event',month:'2026-10',startDate:'2026-10-02',endDate:'2026-10-12'};
 c.event=async id=>{assert.equal(id,event.id);return event;};
 try{
  const body={...input,promotionType:'event',eventId:event.id,eventVersion:promotionEventVersion(event),startDate:event.startDate,endDate:event.endDate,event:{name:'Spoofed'}};
  const first=(await savePromotionPlan(req(body),env,c,{canEdit:true})).plan;
  assert.deepEqual(first.event,event);assert.equal(first.name,event.name);assert.equal(first.scheduleSource,'event');assert.equal(first.startDate,event.startDate);
  await assert.rejects(savePromotionPlan(req({...body,id:first.id,expectedVersion:1,month:'2026-11',startDate:'2026-11-01',endDate:'2026-11-07'}),env,c,{canEdit:true}),e=>e.status===409);
  const edited=(await savePromotionPlan(req({...body,id:first.id,expectedVersion:1,startDate:'2026-10-03',endDate:'2026-10-07'}),env,c,{canEdit:true})).plan;
  assert.equal(edited.id,first.id);assert.equal(edited.month,'2026-10');assert.equal(edited.scheduleSource,'manual');assert.equal(edited.endDate,'2026-10-07');
  event.name='Renamed Event';
  const legacy=(await savePromotionPlan(req({...input,id:first.id,expectedVersion:2}),env,c,{canEdit:true})).plan;
  assert.equal(legacy.promotionType,'event');assert.equal(legacy.startDate,'2026-10-03');assert.deepEqual(legacy.event,event);assert.equal(legacy.name,event.name);
  for(const patch of [{month:'2026-09'},{endDate:''},{startDate:'2026-10-13'}])await assert.rejects(savePromotionPlan(req({...body,...patch}),env,c,{canEdit:true}),e=>e.status===400);
  event.endDate='2026-10-15';await assert.rejects(savePromotionPlan(req(body),env,c,{canEdit:true}),e=>e.code==='event_schedule_changed');
  assert.equal((await readPromotionPlans(env)).length,1);
 }finally{DB.close();}
});
test('stock and DOH jointly cap discounts; near-stockout, unknown, no-sales and default rates remain distinct',()=>{for(let qty=0;qty<200;qty++){const d=recommendedDiscount({available:qty,doh:200},'department'),f=recommendedDiscount({available:qty,doh:200},'standalone');assert.equal(d,recommendedDiscount({available:qty,doh:200},'event_gp'));assert.equal(f,recommendedDiscount({available:qty,doh:200},'event_cash'));assert.ok(f>=d&&f<=40);}assert.equal(recommendedDiscount({available:1000,doh:7},'standalone'),0);assert.equal(recommendedDiscount({available:1000,doh:14},'standalone'),0);assert.equal(recommendedDiscount({available:1000,doh:null},'standalone'),10);assert.equal(recommendedDiscount({available:1000,noSales:true,doh:null},'standalone'),40);assert.equal(recommendedDiscount({available:2,noSales:true,doh:null},'standalone'),10);assert.throws(()=>validatePromotionPolicy({...defaultPromotionPolicy,doh:[14,10,60,120]}));assert.throws(()=>validatePromotionPolicy({...defaultPromotionPolicy,fast:[10,20,30,101]}));});
test('branch promotions read exactly Stock สาขา; filter family; group by model and segregate unsold sizes without double counting',async()=>{const c=context(),calls=[],original=c.branchStock;c.branchStock=async ids=>{calls.push(ids);return original(ids);};const stock=await promotionStock(c,'department');assert.deepEqual(calls,['','CDS01,RBS02']);assert.equal(stock.rows.length,2);assert.equal(stock.rows.reduce((n,r)=>n+r.available,0),90);assert.ok(stock.rows.every(r=>r.model==='Test'&&!('sku' in r)));const regular=stock.rows.find(r=>!r.noSales),slow=stock.rows.find(r=>r.noSales);assert.deepEqual(regular.sizes,['40']);assert.deepEqual(slow.sizes,['41']);assert.equal(regular.sold,120);assert.ok(Math.abs(regular.doh-92)<.001);assert.equal(regular.members[0].hold,10);assert.equal(regular.fullPrice,1000);assert.equal(regular.unitCost,321);await assert.rejects(promotionStock(c,'event_gp','STAND ALONE01'));calls.length=0;await promotionStock(c,'standalone');assert.equal(calls.at(-1),'STAND ALONE01');});
test('missing history is unknown rather than no-sales; same-model grades remain separate',async()=>{const c=context();c.history=async()=>({history:{},failedMonths:period.months});const stock=await promotionStock(c,'department','CDS01');assert.equal(stock.rows.length,1);assert.equal(stock.rows[0].noSales,false);assert.equal(stock.rows[0].doh,null);assert.equal(recommendedDiscount(stock.rows[0],'department'),5);const groups=groupPromotionModels([{key:'a',model:'Same',grade:'A',size:'40',available:5},{key:'b',model:'Same',grade:'B',size:'40',available:6}]);assert.equal(groups.length,2);});
test('warehouse subtracts activity allocations and never duplicates the pooled sales rate between warehouses',async()=>{const c=context(),original=c.sources;c.sources=async()=>{const s=await original();s.inventory.items.push({...s.inventory.items[0],id:'extra',source:'pivot',available:43});return s;};const result=await promotionStock(c,'event_cash','DEST');assert.equal(result.rows.reduce((n,r)=>n+r.available,0),130);assert.ok(result.rows.every(r=>r.model!=='BAG'));const sold=result.rows.find(r=>!r.noSales);assert.equal(sold.available,100);assert.equal(sold.sold,180);assert.ok(Math.abs(sold.doh-100/(180/184))<.001);});
test('unit price, GP gross margin and department fee are separate calculations, including loss and missing cost',()=>{assert.deepEqual(promotionUnitFinance({fullPrice:1000,unitCost:500,discount:20},30),{price:1000,cost:500,after:800,profit:300,gp:37.5,net:560,netProfit:60,netGp:60/560*100});const t=promotionTotals([{qty:2,fullPrice:1000,unitCost:500,discount:20},{qty:1,fullPrice:1000,unitCost:null,discount:20}],30);assert.equal(t.net,2400);assert.equal(t.profit,600);assert.equal(t.grossMargin,37.5);assert.equal(t.afterGp,1680);assert.equal(t.profitAfterGp,120);assert.equal(t.missingCost,1);assert.equal(promotionUnitFinance({fullPrice:1000,unitCost:800,discount:40}).gp,-200/600*100);});
test('model quantity allocation preserves requested total and per-size stock; weighted GP follows the selected mix',()=>{const line={qty:10,discount:20,members:[{key:'a',available:30,fullPrice:1000,unitCost:500},{key:'b',available:70,fullPrice:2000,unitCost:500}]};const allocated=allocatePromotionLine(line);assert.deepEqual(allocated.map(r=>r.qty),[3,7]);assert.equal(allocated.reduce((n,r)=>n+r.qty,0),10);const t=promotionTotals([line],0);assert.equal(t.net,13600);assert.equal(t.profit,8600);assert.equal(t.grossMargin,8600/13600*100);for(let qty=1;qty<=100;qty++){const split=allocatePromotionLine({...line,qty});assert.equal(split.reduce((n,r)=>n+r.qty,0),qty);assert.ok(split.every(r=>r.qty<=r.available));}});
test('cached forecast pages must be fresh and complete; partial pages never establish zero sales',async()=>{const month=period.months[0],chunk={month,page:1,nextPage:null,total:1,expectedQty:2,rows:[{id:'a',qty:2}],fetchedAt:'2026-09-24T08:00:00Z'},env={BUCKET:{get:async key=>key.includes(month)?{json:async()=>chunk}:null}};const good=await readPromotionHistory(env,period,Date.parse('2026-09-24T09:00:00Z'));assert.equal(Object.keys(good.history).length,1);chunk.total=2;const incomplete=await readPromotionHistory(env,period,Date.parse('2026-09-24T09:00:00Z'));assert.equal(Object.keys(incomplete.history).length,0);chunk.total=1;const stale=await readPromotionHistory(env,period,Date.parse('2026-09-24T20:00:00Z'));assert.equal(Object.keys(stale.history).length,0);});
test('save validates model scope, current stock and discounts server-side, recomputes cost, and persists model summary',async()=>{const DB=previewDatabase();try{const env={DB},c=context();await assert.rejects(savePromotionPlan(req(input),env,c,{canEdit:false}),e=>e.status===403);for(const patch of [{status:'approved'},{policyConfirmed:false},{lines:[{...input.lines[0],qty:1000}]},{lines:[{...input.lines[0],discount:101}]},{lines:[{...input.lines[0],key:'VING-Test-Black#40'}]}])await assert.rejects(savePromotionPlan(req({...input,...patch}),env,c,{canEdit:true}));const saved=await savePromotionPlan(req({...input,lines:[{...input.lines[0],unitCost:0}]}),env,c,{canEdit:true});assert.equal(saved.plan.schemaVersion,2);assert.equal(saved.plan.lines[0].members[0].unitCost,321);assert.equal(saved.plan.totals.net,1700);assert.equal(saved.plan.approval,'unapproved');assert.equal((await readPromotionPlans(env))[0].lines[0].model,'Test');c.history=async()=>({history:{},failedMonths:period.months});const adjusted=await savePromotionPlan(req({...input,lines:[{...input.lines[0],discount:25.5}]}),env,c,{canEdit:true});assert.equal(adjusted.plan.lines[0].recommended,5);assert.equal(adjusted.plan.lines[0].discount,25.5);assert.equal(adjusted.plan.totals.net,1490);assert.equal(adjusted.plan.approval,'unapproved');assert.equal((await readPromotionPlans(env)).find(p=>p.id===adjusted.plan.id).lines[0].discount,25.5);for(const discount of [0,40,50,75.25,100]){const boundary=await savePromotionPlan(req({...input,lines:[{...input.lines[0],discount}]}),env,c,{canEdit:true});assert.equal(boundary.plan.lines[0].discount,discount);}for(const discount of [-1,100.1,'20',null])await assert.rejects(savePromotionPlan(req({...input,lines:[{...input.lines[0],discount}]}),env,c,{canEdit:true}));}finally{DB.close();}});

test('edit updates the same persisted proposal, preserves creation time, and recalculates from fresh stock',async()=>{
 const DB=previewDatabase(),env={DB},c=context();try{
  const first=(await savePromotionPlan(req(input),env,c,{canEdit:true})).plan;
  const other=(await savePromotionPlan(req({...input,name:'Unrelated'}),env,c,{canEdit:true})).plan;
  const change={...input,id:first.id,expectedVersion:first.revision,name:'Edited proposal',month:'2026-11',gp:20,lines:[{...input.lines[0],qty:3,discount:10.1,unitCost:0}]};
  const edited=(await savePromotionPlan(req(change),env,c,{canEdit:true})).plan;
  assert.equal(edited.id,first.id);assert.equal(edited.createdAt,first.createdAt);assert.equal(edited.revision,2);
  assert.equal(edited.totals.net,2697);assert.equal(edited.lines[0].members[0].unitCost,321);
  const plans=await readPromotionPlans(env);assert.equal(plans.length,2);assert.deepEqual(plans.find(p=>p.id===other.id),other);
  assert.equal(plans.find(p=>p.id===first.id).name,'Edited proposal');assert.equal(edited.approval,'unapproved');
  assert.equal((await DB.prepare('SELECT month FROM promotion_plans WHERE id = ?').bind(first.id).first()).month,'2026-11');
  await assert.rejects(savePromotionPlan(req(change),env,c,{canEdit:true}),e=>e.status===409);
  await assert.rejects(savePromotionPlan(req({...change,expectedVersion:2}),env,c,{canEdit:false}),e=>e.status===403);
  await assert.rejects(savePromotionPlan(req({...change,id:'missing'}),env,c,{canEdit:true}),e=>e.status===404);
  await assert.rejects(savePromotionPlan(req({...change,expectedVersion:2,lines:[{...input.lines[0],qty:1000}]}),env,c,{canEdit:true}),e=>e.status===409);
  assert.equal((await readPromotionPlans(env)).find(p=>p.id===first.id).revision,2);
 }finally{DB.close();}
});
test('legacy proposals can be edited; locked proposals and racing updates cannot be overwritten',async()=>{
 const DB=previewDatabase(),env={DB},c=context();try{
  const first=(await savePromotionPlan(req(input),env,c,{canEdit:true})).plan;
  delete first.revision;delete first.updatedAt;
  await DB.prepare('UPDATE promotion_plans SET payload = ? WHERE id = ?').bind(JSON.stringify(first),first.id).run();
  const edit={...input,id:first.id,expectedVersion:1};
  const results=await Promise.allSettled([savePromotionPlan(req({...edit,name:'A'}),env,c,{canEdit:true}),savePromotionPlan(req({...edit,name:'B'}),env,c,{canEdit:true})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  const current=(await readPromotionPlans(env))[0];assert.equal(current.revision,2);
  current.approval='approved';
  await DB.prepare('UPDATE promotion_plans SET payload = ? WHERE id = ?').bind(JSON.stringify(current),current.id).run();
  await assert.rejects(savePromotionPlan(req({...edit,expectedVersion:2}),env,c,{canEdit:true}),e=>e.status===409);
  assert.equal((await readPromotionPlans(env))[0].approval,'approved');
 }finally{DB.close();}
});

test('custom policy supports discounts above 40 percent and decimals without clipping',()=>{const policy=validatePromotionPolicy({...defaultPromotionPolicy,department:[5,20,50.25,80],fast:[10,30,75.5,100]});assert.equal(recommendedDiscount({available:1000,doh:200},'department',policy),80);assert.equal(recommendedDiscount({available:30,noSales:true},'standalone',policy),75.5);assert.equal(recommendedDiscount({available:1000,noSales:true},'standalone',policy),100);assert.equal(promotionUnitFinance({fullPrice:1000,unitCost:300,discount:100}).after,0);});
