import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshPlan,refreshSource} from './data-refresh.mjs';
import {buildProductCosts,createProductCostLoader} from './product-cost-data.mjs';
import {gpCurrentCosts,handleBranchProfit} from './branch-profit-data.mjs';
import {latestOperation,loadOperations,applyOperations} from './operations-live.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';
import {loadStockReport} from './stock-report-data.mjs';
import {loadStockForecast} from './stock-forecast-data.mjs';
const stamp='2026-10-02T02:00:00.000Z';
function bucket(){const values=new Map();return {values,async get(k){return values.has(k)?{etag:'v',json:async()=>JSON.parse(values.get(k))}:null;},async put(k,v){values.set(k,v);return {etag:'v'};}};}
function costCsv(cost='100',note=''){
 const head=Array(34).fill('');Object.assign(head,{0:'MODEL',1:'GRADE',2:'TYPE',4:'FACTORY',18:'EXTRA',19:'TOTAL PKG',26:'MAX',27:'MIN',28:'AVG\nFG EX.VAT',29:'ค่านำสินค้าเข้าคลัง',30:'VAT7%',31:'AVG\nFG INC.VAT',32:'ตอนนี้ซื้อราคานี้',33:'Remark'});
 const row=Array(34).fill('');Object.assign(row,{0:'TEST',1:'A',2:'SHOES',4:'TSS',28:'70',31:'80',32:cost,33:note});
 return [[],head,[],[],['รุ่น'],row].map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n');
}
test('forced refresh reads changed source inside TTL and preserves last persisted success after a failed import',async()=>{
 const BUCKET=bucket(),env={BUCKET};let calls=0,value='100',fail=false;
 const loader=createProductCostLoader({fetchImpl:async()=>{calls++;if(fail)throw Error('offline');return new Response(costCsv(value));}});
 const first=await loader(env);assert.equal(first.items[0].currentPurchaseCost,100);
 value='120';assert.equal((await loader(env)).items[0].currentPurchaseCost,100);assert.equal(calls,1);
 assert.equal((await loader({...env,FORCE_DATA_REFRESH:true})).items[0].currentPurchaseCost,120);assert.equal(calls,2);
 fail=true;const stale=await loader({...env,FORCE_DATA_REFRESH:true});assert.equal(stale.source.status,'stale');assert.equal(stale.items[0].currentPurchaseCost,120);
 assert.equal(JSON.parse(BUCKET.values.get('product-costs-v1.json')).items[0].currentPurchaseCost,120);
 fail=false;const badStorage={...env,FORCE_DATA_REFRESH:true,BUCKET:{...BUCKET,put:async()=>{throw Error('storage unavailable');}}};
 assert.equal((await loader(badStorage)).source.status,'stale');
});
test('current purchase column is independent of VAT average and review notes; approved GP identities only',()=>{
 const costs=buildProductCosts(costCsv('351.46',''),stamp),item=costs.items[0];assert.equal(item.includingVat,80);assert.equal(item.currentPurchaseCost,351.46);
 const map={a:{key:'TEST',status:'actual',sourceRow:6,costModel:'TEST',costGrade:'A',factory:'TSS',unitCost:90},b:{key:'NEW',status:'hold',unitCost:null}};
 assert.equal(gpCurrentCosts(map,costs).productMap.a.unitCost,351.46);assert.equal(gpCurrentCosts(map,costs).productMap.b.unitCost,null);
 const prior=gpCurrentCosts(map,costs).productMap;
 assert.equal(gpCurrentCosts(prior,buildProductCosts(costCsv('','รออัพเดท'),stamp)).productMap.a.unitCost,351.46);
 assert.equal(gpCurrentCosts(map,{...costs,items:[{...item,sourceRow:7}]}).productMap.a.unitCost,90);
});
test('GP report retains the last applied live cost across Worker requests when the next sheet cost is missing',async()=>{
 const DB=previewDatabase(),BUCKET=bucket(),env={DB,BUCKET},seed={rawMonths:{},branches:{},policy:{},productMap:{a:{key:'TEST',status:'actual',sourceRow:6,costModel:'TEST',costGrade:'A',factory:'TSS',unitCost:90}}};
 try{
  await BUCKET.put('product-costs-v1.json',JSON.stringify(buildProductCosts(costCsv('120'),stamp)));
  const read=async()=>(await handleBranchProfit(new Request('https://test.site/api/branch-profit'),env,seed)).json();
  assert.equal((await read()).productMap.a.unitCost,120);
  await BUCKET.put('product-costs-v1.json',JSON.stringify(buildProductCosts(costCsv(''), '2026-10-02T03:00:00.000Z')));
  const result=await read();assert.equal(result.productMap.a.unitCost,120);assert.equal(result.policy.costRefresh,'partial');
 }finally{DB.close();}
});
test('only current month is queued; dynamic pagination and stale status remain accurate',async()=>{
 const plan=refreshPlan(new Date(stamp));assert.deepEqual(plan.tasks.filter(t=>t.id.startsWith('history:')).map(t=>t.id),['history:2026-10:1']);assert.equal(plan.tasks.filter(t=>t.id.startsWith('forecast-history:')).length,0);assert.equal(plan.currentMonth,'2026-10');
 assert.equal(new Set([...plan.tasks,...plan.finalTasks].map(t=>t.id)).size,plan.tasks.length+plan.finalTasks.length);
 const paths=[];const result=await refreshSource('history:2026-10:1',{now:()=>new Date(stamp),read:async path=>{paths.push(path);return {nextPage:13,fetchedAt:stamp};}});
 assert.match(paths[0],/refresh=1/);assert.equal(result.nextTasks[0].id,'history:2026-10:13');
 assert.equal((await refreshSource('costs',{read:async()=>({source:{status:'stale'}})})).status,'attention');
 assert.equal((await refreshSource('costs',{read:async()=>({source:{status:'stale'}})})).retryable,true);
 const inv=await refreshSource('inventory',{read:async(path,options)=>{assert.equal(JSON.parse(options.body).source,'scaleup');return {snapshot:{updatedAt:stamp}};}});assert.equal(inv.status,'success');
 await assert.rejects(refreshSource('https://evil.test',{read:()=>{throw Error('should never forward');}}),/ไม่พบ/);
 const gp=await refreshSource('gp',{now:()=>new Date(stamp),read:async()=>({rawMonths:[{month:'2025-12'}],policy:{costRefresh:'partial'}})});
 assert.equal(gp.status,'success');assert.equal(gp.nextTasks.length,1);assert.equal(gp.nextTasks[0].id,'gp:2026-10');
});
test('newer synced operations win; failed refresh preserves saved contracts and signals stale',async()=>{
 const newer={source:{fetched_at:'2026-10-03T00:00:00Z'},items:[{branch:'new'}]},older={source:{fetched_at:stamp,online_status:'online'},items:[{branch:'old'}]};
 assert.equal(latestOperation(newer,older),newer);
 const BUCKET=bucket();await BUCKET.put('operations-live/contracts.json',JSON.stringify(older));
 const result=await loadOperations({BUCKET,FORCE_DATA_REFRESH:true},'contracts',async()=>{throw Error('offline');});
 assert.equal(result.source.online_status,'stale');assert.deepEqual(result.items,older.items);
 assert.equal((await loadOperations({BUCKET},'contracts')).source.online_status,'stale');
 await BUCKET.put('operations-live/events.json',JSON.stringify({...older,years:{2026:{items:[]}}}));
 assert.deepEqual((await applyOperations({data:{'/api/events':newer}},{BUCKET},async()=>{throw Error('offline');})).data['/api/events'],newer);
});
test('global refresh requires login and same-origin POST but supports viewers without allowing business writes',async()=>{
 const env={SESSION_SECRET:'test-only-secret',ADMIN_PASSWORD:'test-admin',VIEWER_PASSWORD:'test-viewer',BUCKET:bucket()};
 const req=(path,options={})=>new Request('https://test.site'+path,options);
 assert.equal((await worker.fetch(req('/api/data-refresh'),env)).status,401);
 const login=await worker.fetch(req('/login',{method:'POST',body:new URLSearchParams({password:env.VIEWER_PASSWORD})}),env),cookie=login.headers.get('set-cookie').split(';')[0];
 const post=(origin,source)=>req('/api/data-refresh',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({source})});
 assert.equal((await worker.fetch(post('https://evil.test','references'),env)).status,403);
 const result=await worker.fetch(post('https://test.site','references'),env);assert.equal(result.status,200);assert.equal((await result.json()).status,'attention');
 assert.equal((await worker.fetch(req('/api/event-proposals',{method:'POST',headers:{cookie,origin:'https://test.site'},body:'{}'}),env)).status,403);
 const unknown=await worker.fetch(post('https://test.site','https://evil.test'),env);assert.equal((await unknown.json()).status,'failed');
});

 test('month boundaries use Bangkok time and stale queued months never read upstream',async()=>{
  for(const [at,month] of [['2026-09-30T16:59:59Z','2026-09'],['2026-09-30T17:00:00Z','2026-10'],['2026-12-31T17:00:00Z','2027-01']]){
   const now=()=>new Date(at),plan=refreshPlan(now());assert.equal(plan.currentMonth,month);
   const gp=await refreshSource('gp',{now,read:()=>assert.fail('Month planning must not read or refresh sources')});assert.deepEqual(gp.nextTasks.map(t=>t.id),['gp:'+month]);
  }
  for(const id of ['gp:2026-09','gp:2026-11','history:2026-09:1','history:2026-11:13','forecast-history:2026-09:1','forecast-history:2026-10:1']){
   const result=await refreshSource(id,{now:()=>new Date(stamp),read:()=>assert.fail('Must skip non-current requests before any reads')});
   assert.equal(result.status,'skipped',id);assert.equal(result.retryable,false,id);
  }
  let calls=0;
  await refreshSource('gp:2026-10',{now:()=>new Date(stamp),read:async(path,options)=>{calls++;assert.equal(path,'/api/branch-profit/refresh');assert.equal(JSON.parse(options.body).period,'2026-10');return {updatedAt:stamp};}});
  assert.equal(calls,1);
 });
 test('saved prior-month stock history is unchanged after refresh even beyond TTL',async()=>{
  const BUCKET=bucket(),saved={month:'2026-09',page:1,nextPage:null,total:0,expectedQty:0,rows:[],fetchedAt:'2026-09-30T00:00:00Z'};
  const env={BUCKET,BRANCH_STOCK_API_TOKEN:'test-token',DATA_REFRESH_AFTER:Date.parse(stamp)};
  for(const [load,path,key] of [[loadStockReport,'stock-report','stock-report/v1/2026-09/1.json'],[loadStockForecast,'stock-forecast','stock-forecast/v1/history/2026-09/1.json']]){
   await BUCKET.put(key,JSON.stringify(saved));
   const response=await load(new Request('https://test.site/api/'+path+'?part=history&month=2026-09'),env,()=>assert.fail('Historical source must remain cached'),new Date(stamp));
   const result=await response.json();assert.equal(response.status,200);assert.equal(result.cached,true);assert.equal(result.fetchedAt,saved.fetchedAt);assert.equal(BUCKET.values.get(key),JSON.stringify(saved));
  }
 });

test('aggregate freshness invalidates only its selected source across worker caches',async()=>{
 const BUCKET=bucket();let time=Date.parse(stamp),value='100',calls=0;
 const loader=createProductCostLoader({now:()=>time,fetchImpl:async()=>{calls++;return new Response(costCsv(value));}});
 assert.equal((await loader({BUCKET})).items[0].currentPurchaseCost,100);assert.equal(calls,1);
 time+=1000;value='120';
 assert.equal((await loader({BUCKET,DATA_REFRESH_SOURCES:{'/api/rebrand':time}})).items[0].currentPurchaseCost,100);assert.equal(calls,1);
 assert.equal((await loader({BUCKET,DATA_REFRESH_SOURCES:{'/api/product-costs':time}})).items[0].currentPurchaseCost,120);assert.equal(calls,2);
});
