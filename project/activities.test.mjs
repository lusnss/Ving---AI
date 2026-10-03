import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {couponCost,activityTotals,allocation,monthlyActivities,activitiesCsv,automaticActivityCost,activityCostReference,costCandidates,activityProductIdentity,activityCostReady,activityProductType,couponForecast,activityForecast} from './out/assets/activity-model.mjs';
import {validateActivity,saveActivityWorkspace,readActivityWorkspace} from './activities-data.mjs';
import {activityRewards} from './out/assets/activity-model.mjs';
test('reward values use each SKU retail price, include discount entitlements, and exclude costs and expenses',()=>{
 const a={items:[{inventoryId:'one',qty:3,unitCost:10},{inventoryId:'two',qty:2,unitCost:null}],coupons:[{kind:'fixed',value:50,uses:4}],extra:500,actualDiscount:10};
 const inventory=[{id:'one',fullPrice:199.95},{id:'two',fullPrice:1200}];
 const r=activityRewards(a,inventory);
 assert.equal(r.count,9);assert.equal(r.products,5);assert.equal(r.couponUses,4);
 assert.deepEqual(r.rows.map(i=>i.rewardValue),[599.85,2400]);
 assert.equal(r.productValue,2999.85);assert.equal(r.discountValue,200);assert.equal(r.value,3199.85);
 assert.equal(activityRewards({...a,extra:9999,actualDiscount:9999},inventory).value,r.value);
 assert.equal(activityRewards({}).value,0);
 assert.equal(activityRewards({coupons:[{kind:'percent',value:10,uses:3,cap:75}]}).value,225);
});
test('missing or invalid selling prices never fall back to cost; zero is a valid selling price',()=>{
 const a={items:[{inventoryId:'one',qty:2,unitCost:100}],coupons:[]};
 for(const fullPrice of [null,undefined,NaN,-10]){const r=activityRewards(a,[{id:'one',fullPrice}]);assert.equal(r.value,0);assert.equal(r.missingPrices,1);assert.equal(r.rows[0].rewardValue,null);assert.equal(r.count,2);}
 assert.equal(activityRewards(a,[{id:'different',fullPrice:200}]).value,0);
 assert.equal(activityRewards(a,[{id:'one',fullPrice:0}]).value,0);
 assert.equal(activityRewards({coupons:[{kind:'percent',value:10,uses:5}]}).value,0);
 const mixed=activityRewards({items:[{inventoryId:'known',qty:2,unitCost:10},{inventoryId:'unknown',qty:3,unitCost:900}],coupons:[{kind:'fixed',value:50,uses:4},{kind:'percent',value:10,uses:5}]},[{id:'known',fullPrice:200}]);
 assert.equal(mixed.value,600);assert.equal(mixed.productValue,400);assert.equal(mixed.discountValue,200);assert.equal(mixed.count,14);assert.equal(mixed.missingPrices,1);assert.equal(mixed.missingCoupons,1);assert.equal(mixed.rows[1].rewardValue,null);
});
const perms={canEdit:true,canApprove:true};
const sources={inventory:{updatedAt:'2026-09-23T00:00:00Z',items:[{id:'stock1',sku:'ELITE#40',name:'VING Sandals ELITE',available:10,warehouse:'Scaleup',unit:'pcs'}]},costs:{source:{fetched_at:'2026-09-23T00::00Z'},items:[{sourceRow:6,model:'ELITE',beforeVat:100,includingVat:155.15,grade:'A',factory:'Factory'}]},branches:[{id:'VC-01',name:'Branch',type:'CDS'}]};
const input=()=>({name:'Test campaign',month:'2026-10',branchId:'VC-01',type:'CDS',status:'planned',items:[{inventoryId:'stock1',qty:3,costRow:6,costMode:'sheet'}],coupons:[],budget:1000,extra:0,actualDiscount:null});
const request=body=>new Request('https://local/api/activities',{method:'POST',body:JSON.stringify(body)});
test('all coupons budget for full redemption, including records carrying old basket/rate fields',()=>{assert.deepEqual(couponCost({kind:'percent',value:10,basket:1000,uses:100,rate:50,cap:100}),{per:100,maximum:10000,expected:10000,missing:false});assert.equal(couponCost({kind:'fixed',value:100,basket:50,uses:3,rate:100}).maximum,300);assert.equal(couponCost({kind:'percent',value:20,basket:1000,uses:10,rate:50,cap:100}).expected,1000);});
test('source costs are authoritative, money rounds to cents, missing cost stays missing',()=>{const v=validateActivity({...input(),items:[{...input().items[0],unitCost:0}]},sources,null,perms,[]);assert.equal(v.items[0].unitCost,155.15);assert.equal(activityTotals(v).gift,465.45);assert.throws(()=>validateActivity({...input(),items:[{inventoryId:'stock1',qty:1,costRow:999}]},sources,null,perms,[]),/ต้นทุน/);const draft=validateActivity({...input(),status:'draft',items:[{inventoryId:'stock1',qty:1,costRow:999}]},sources,null,perms,[]);assert.equal(activityTotals(draft).missing,1);});
test('quantity, discounts, dates and budget validate on server',()=>{for(const qty of [-1,0,0.5,11])assert.throws(()=>validateActivity({...input(),items:[{...input().items[0],qty}]},sources,null,perms,[]));assert.throws(()=>validateActivity({...input(),start:'2026-10-32'},sources,null,perms,[]));assert.throws(()=>validateActivity({...input(),budget:100},sources,null,perms,[]),/เกินงบ/);assert.throws(()=>validateActivity({...input(),coupons:[{kind:'percent',value:101,basket:1000,uses:10,rate:100}]},sources,null,perms,[]));});
test('all months reserve stock and exclude the current edit; completed remains reserved until settled',()=>{const first=validateActivity({...input(),month:'2026-09',items:[{...input().items[0],qty:6}],budget:2000},sources,null,perms,[]);assert.throws(()=>validateActivity({...input(),items:[{...input().items[0],qty:5}]},sources,null,perms,[first]),/ไม่พอ/);assert.equal(allocation([first],first.id).size,0);assert.equal(allocation([{...first,status:'completed'}]).get('stock1'),6);assert.equal(allocation([{...first,status:'completed',stockSettled:true}]).size,0);assert.equal(allocation([{...first,status:'cancelled'}]).size,0);});
test('assistant may draft but cannot approve commercial terms or modify an approved plan',()=>{assert.throws(()=>validateActivity(input(),sources,null,{canEdit:true,canApprove:false},[]),/CEO/);assert.equal(validateActivity({...input(),status:'draft'},sources,null,{canEdit:true,canApprove:false},[]).status,'draft');});
test('completed quantities cannot change and completed records are immutable',()=>{const a=validateActivity(input(),sources,null,perms,[]);const b=validateActivity({...a,status:'completed'},sources,a,perms,[a]);assert.equal(b.status,'completed');assert.throws(()=>validateActivity({...a,status:'completed',items:[{...a.items[0],qty:4}]},sources,a,perms,[a]),/จำนวน/);assert.throws(()=>validateActivity(b,sources,b,perms,[b]),/แก้ไขไม่ได้/);});
test('atomic workspace revision blocks two concurrent stock allocations and persists across reads',async()=>{const DB=previewDatabase();const env={DB};try{const results=await Promise.allSettled([saveActivityWorkspace(request({revision:'0',activity:input()}),env,sources,perms),saveActivityWorkspace(request({revision:'0',activity:input()}),env,sources,perms)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected')[0].reason.status,409);const saved=await readActivityWorkspace(env);assert.equal(saved.items.length,1);assert.equal(saved.items[0].items[0].qty,3);await assert.rejects(()=>saveActivityWorkspace(request({revision:saved.revision,activity:input()}),env,sources,{canEdit:false}),e=>e.status===403);}finally{DB.close();}});
test('monthly rollup excludes cancelled and export neutralizes formulas',()=>{const a=validateActivity(input(),sources,null,perms,[]);const months=monthlyActivities([a,{...a,status:'cancelled'}],'2026');assert.equal(months[9].gift,465.45);assert.equal(months[9].count,1);assert.match(activitiesCsv([{...a,name:'=1+2'}]),/'=1\+2/);});
test('four-field discounts use the full cap for every entitlement and never invent a basket',()=>{
 assert.deepEqual(couponCost({kind:'percent',value:10,uses:50,cap:100}),{per:100,maximum:5000,expected:5000,missing:false});
 assert.equal(couponCost({kind:'fixed',value:100,uses:50,cap:0}).maximum,5000);
 assert.equal(couponCost({kind:'fixed',value:100,uses:50,cap:50}).maximum,2500);
 assert.equal(couponCost({kind:'percent',value:10,uses:50,cap:0}).maximum,null);
 assert.throws(()=>validateActivity({...input(),coupons:[{kind:'percent',value:10,uses:50,cap:0}]},sources,null,perms,[]),/ลดสูงสุด/);
 const a=validateActivity({...input(),budget:10000,coupons:[{kind:'percent',value:10,uses:50,cap:100,basket:1,rate:1}]},sources,null,perms,[]);
 assert.equal(a.coupons[0].calculation,'full-redemption');assert.equal(activityTotals(a).discount,5000);assert.equal('rate' in a.coupons[0],false);assert.equal('basket' in a.coupons[0],false);
});
test('cost auto matching respects full model, grade, aliases, version, size and ambiguity',()=>{
 const costs=[{model:'NIRUN',grade:'A',beforeVat:100,includingVat:693.09,sourceRow:1},{model:'NIRUN_BB',grade:'B+',beforeVat:100,includingVat:555,sourceRow:2},{model:'MEKI / MEKI1.5',grade:'B+',beforeVat:100,includingVat:273.35,sourceRow:3},{model:'VARI_S1.0',grade:'A',beforeVat:100,includingVat:229.24,sourceRow:4},{model:'VARI_S',grade:'A',beforeVat:100,includingVat:283.55,sourceRow:5}];
 const p={sku:'VING-Nirun_BB-White#36',name:'VING Sandals Nirun_BB'};
 assert.equal(activityProductIdentity(p).grade,'B+');assert.equal(automaticActivityCost(p,costs).sourceRow,2);
 assert.equal(automaticActivityCost({sku:'VING-Nirun-White#36',name:'VING Sandals Nirun'},costs).sourceRow,1);
 assert.equal(automaticActivityCost({sku:'VING-NIRUN_Carbon_T_Shirt-Black#L',name:'NIRUN Carbon Shirt'},costs),null);
 assert.equal(automaticActivityCost({sku:'VING-Meki1.5_BB-Black#38',name:'VING Sandals'},costs).sourceRow,3);
 assert.equal(automaticActivityCost({sku:'VING-Vari_S1.0-Black#38',name:'VING Sandals'},costs).sourceRow,4);
 assert.equal(automaticActivityCost(p,[...costs,{...costs[1],beforeVat:100,includingVat:444,sourceRow:10}]),null);
 assert.equal(automaticActivityCost({sku:'VING-ESCS-Black#L',name:'VING-ESSENTIAL CREW SOCK-ESCS-Black#L'},[{model:'ESSENTIAL_CREW_SOCK : S',grade:'',beforeVat:100,includingVat:1},{model:'ESSENTIAL_CREW_SOCK : L',grade:'',beforeVat:100,includingVat:2}]).includingVat,2);
});
test('API auto matching rejects tampered grade/cost and stores stock before and after other allocations',()=>{
 const prior=validateActivity(input(),sources,null,perms,[]);
 const a=validateActivity({...input(),items:[{...input().items[0],costMode:'auto',costRow:123,unitCost:1}]},sources,null,perms,[prior]);
 assert.equal(a.items[0].unitCost,155.15);assert.equal(a.items[0].grade,'A');assert.equal(a.items[0].availableAtSave,7);assert.equal(a.items[0].availableAtSave-a.items[0].qty,4);
 assert.throws(()=>validateActivity(input(),{...sources,costs:{...sources.costs,items:[{...sources.costs.items[0],grade:'B'}]}},null,perms,[]),/เกรด/);
});
test('model and grade are required for every cost selection; incomplete rows retain their reference',()=>{
 const p={sku:'VING-Elite2.0_BB-Onyx_Black#37',name:'VING Marathon Sandals - Elite2.0_BB'};
 const incomplete={sourceRow:40,model:'ELITE2.0_BB',grade:'B+',type:'SHOES',beforeVat:0,includingVat:5.35,note:'รออัปเดต'};
 const alternate={sourceRow:33,model:'ELITE2.0',grade:'A',type:'SHOES',beforeVat:222.95,includingVat:243.9};
 const src={...sources,inventory:{items:[{...p,id:'elite',available:10}]},costs:{items:[incomplete,alternate]}};
 assert.equal(activityProductIdentity(p).model,'Elite2.0');assert.equal(automaticActivityCost(p,src.costs.items),null);
 assert.equal(activityCostReference(p,src.costs.items,33).sourceRow,40);
 assert.equal(activityCostReference({...p,grade:' BB '},src.costs.items).sourceRow,40);
 for(const costMode of ['catalog','sheet','manual'])assert.throws(()=>validateActivity({...input(),status:'draft',items:[{inventoryId:'elite',qty:2,costRow:33,costMode,unitCost:243.9,costNote:'old override'}]},src,null,perms,[]),/รุ่นและเกรด/);
 const draft=validateActivity({...input(),status:'draft',items:[{inventoryId:'elite',qty:1,costMode:'auto',costRow:33}]},src,null,perms,[]);
 assert.equal(draft.items[0].costRow,40);assert.equal(draft.items[0].unitCost,null);assert.equal(activityTotals(draft).missing,1);
 assert.throws(()=>validateActivity({...draft,status:'planned'},src,null,perms,[]),/ต้นทุน/);
 const complete={...incomplete,beforeVat:200,includingVat:219.35,note:''};
 const matched=validateActivity({...input(),items:[{inventoryId:'elite',qty:2,costMode:'auto',costRow:33,unitCost:243.9}]},{...src,costs:{items:[complete,alternate]}},null,perms,[]);
 assert.equal(matched.items[0].unitCost,219.35);assert.equal(matched.items[0].costRow,40);assert.equal(matched.items[0].grade,'B+');
 const otherModel={...complete,model:'JARIX1.5_BB',sourceRow:39};
 assert.throws(()=>validateActivity({...input(),items:[{inventoryId:'elite',qty:1,costMode:'catalog',costRow:39}]},{...src,costs:{items:[complete,otherModel]}},null,perms,[]),/รุ่นและเกรด/);
 const factory={...complete,factory:'second',includingVat:230,sourceRow:140};
 assert.equal(automaticActivityCost(p,[complete,factory]),null);
 assert.equal(activityCostReference(p,[complete,factory]),null);
 assert.equal(activityCostReference(p,[complete,factory],140).sourceRow,140);
 const selected=validateActivity({...input(),items:[{inventoryId:'elite',qty:1,costMode:'catalog',costRow:140,unitCost:1}]},{...src,costs:{items:[complete,factory]}},null,perms,[]);
 assert.equal(selected.items[0].unitCost,230);
});
test('product category comes from matching source type or recognizable inventory description, never cost override',()=>{
 assert.equal(activityProductType({sku:'VING-ESCS-White#L',name:'VING-ESSENTIAL CREW SOCK-ESCS'},[{model:'ESSENTIAL_CREW_SOCK : L',grade:'',type:'SOCKS'}]),'SOCKS');
 assert.equal(activityProductType({sku:'VING-NIRUN_Carbon_T_Shirt-Orange#L'}),'Apparel');assert.equal(activityProductType({sku:'VING-V_Compression_Short-Black#XS'}),'Apparel');
 assert.equal(activityProductType({sku:'VING-Flexstraps-White'}),'ACC');assert.equal(activityProductType({sku:'VING-PP_Woven_Bag-Mix'}),'ACC');assert.equal(activityProductType({sku:'Unknown'}),'other');
});
test('approval workflow enforces roles, optional rejection note, resubmission and stock allocation',async()=>{
 const DB=previewDatabase(),env={DB},assistant={canEdit:true,canApprove:false};try{
 let w=await saveActivityWorkspace(request({revision:'0',activity:{...input(),status:'pending'}}),env,sources,assistant);
 const id=w.savedId;assert.equal(w.items[0].status,'pending');assert.equal(allocation(w.items).size,0);
 await assert.rejects(()=>saveActivityWorkspace(request({revision:w.revision,action:'review',activity:{id},decision:'rejected'}),env,sources,assistant),e=>e.status===403);
 w=await saveActivityWorkspace(request({revision:w.revision,action:'review',activity:{id},decision:'rejected'}),env,sources,perms);
 assert.equal(w.items[0].status,'rejected');assert.equal(w.items[0].review.note,'');assert.equal(allocation(w.items).size,0);assert.equal(monthlyActivities(w.items,'2026')[9].total,0);
 w=await saveActivityWorkspace(request({revision:w.revision,activity:{...w.items[0],status:'pending'}}),env,sources,assistant);
 w=await saveActivityWorkspace(request({revision:w.revision,action:'review',activity:{id},decision:'rejected',note:'ปรับงบ'}),env,sources,perms);assert.equal(w.items[0].review.note,'ปรับงบ');
 w=await saveActivityWorkspace(request({revision:w.revision,activity:{...w.items[0],status:'pending'}}),env,sources,assistant);
 w=await saveActivityWorkspace(request({revision:w.revision,action:'review',activity:{id},decision:'approved'}),env,sources,perms);assert.equal(w.items[0].status,'planned');assert.equal(w.items[0].review.decision,'approved');assert.equal(allocation(w.items).get('stock1'),3);
 await assert.rejects(()=>saveActivityWorkspace(request({revision:w.revision,action:'review',activity:{id},decision:'rejected'}),env,sources,perms),e=>e.status===409);
 }finally{DB.close();}
});
test('instant-discount forecast uses minimum spend, respects cap, and charges 22% of pre-discount sales',()=>{
 const c={kind:'percent',value:10,uses:10,cap:100,minSpend:1000};
 assert.deepEqual(couponForecast(c),{perGross:1000,perDiscount:100,perNet:900,gross:10000,discount:1000,net:9000,cogs:2200,profit:6800});
 const f=activityForecast({items:[{qty:2,unitCost:100}],extra:500,coupons:[c]});
 assert.equal(f.totalCost,3900);assert.equal(f.net,9000);assert.equal(f.profit,6100);
 assert.equal(couponForecast({...c,cap:50}).discount,500);assert.equal(couponForecast({...c,kind:'fixed',value:2000,cap:0}).net,0);
 assert.equal(couponForecast({...c,minSpend:null}),null);assert.equal(couponForecast({...c,minSpend:0}),null);
 assert.equal(activityForecast({items:[{qty:1,unitCost:null}],coupons:[c]}).profit,null);
 const saved=validateActivity({...input(),status:'pending',coupons:[c]},sources,null,perms,[]);assert.equal(saved.coupons[0].minSpend,1000);assert.equal(saved.coupons[0].redemption,'instant');
 assert.throws(()=>validateActivity({...input(),coupons:[{...c,minSpend:-1}]},sources,null,perms,[]),/ยอดซื้อขั้นต่ำ/);
});
test('missing matches use exactly one higher grade and never bypass an existing incomplete row',()=>{
 const product=grade=>({sku:'VING-Elite2.0-'+grade+'#37',model:'Elite2.0',name:'VING Marathon Sandals Elite2.0',grade});
 const cost=(grade,sourceRow,amount)=>({model:'ELITE2.0',grade,sourceRow,beforeVat:100,includingVat:amount,note:''});
 const a=cost('A',33,243.9),bb=cost('B+',40,220),b=cost('B',45,200),c=cost('C',50,180);
 assert.equal(automaticActivityCost(product('B'),[a,bb]).sourceRow,40);
 assert.equal(automaticActivityCost(product('B+'),[a]).sourceRow,33);
 assert.equal(automaticActivityCost(product('C'),[a,bb,b]).sourceRow,45);
 assert.equal(automaticActivityCost(product('D'),[a,bb,b,c]).sourceRow,50);
 assert.equal(automaticActivityCost(product('B'),[a]),null);
 assert.equal(automaticActivityCost(product('A'),[bb,b]),null);
 assert.equal(automaticActivityCost(product('B'),[a,bb,b]).sourceRow,45);
 const pending={...b,beforeVat:0,includingVat:5.35,note:'รออัปเดต'};
 assert.equal(automaticActivityCost(product('B'),[a,bb,pending]),null);
 assert.equal(activityCostReference(product('B'),[a,bb,pending],40).sourceRow,45);
 const src={...sources,inventory:{items:[{...product('B'),id:'fallback-b',available:10}]},costs:{items:[a,bb]}};
 const saved=validateActivity({...input(),items:[{inventoryId:'fallback-b',qty:1,costMode:'auto'}]},src,null,perms,[]);
 assert.equal(saved.items[0].grade,'B');assert.equal(saved.items[0].costRow,40);assert.equal(saved.items[0].unitCost,220);
 assert.throws(()=>validateActivity({...input(),items:[{inventoryId:'fallback-b',qty:1,costMode:'catalog',costRow:33}]},src,null,perms,[]),/รุ่นและเกรด/);
 assert.equal(automaticActivityCost(product('B'),[{...bb,model:'JARIX1.5'}]),null);
});
