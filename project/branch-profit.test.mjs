import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {gpCalculate,gpAggregate,gpBranches,gpDecode,gpSort,gpRatios} from './out/assets/branch-profit-model.mjs';
import {gpFetchMonth,handleBranchProfit} from './branch-profit-data.mjs';import {previewDatabase} from './preview-db.mjs';
const seed=JSON.parse(fs.readFileSync('branch-profit.snapshot.json'));
test('25% estimate, refunds, actual gift cost and unresolved zero-revenue gift',()=>{const a=gpCalculate({status:'estimate',sales:107,qty:1}),b=gpCalculate({status:'estimate',sales:-107,qty:-1});assert.equal(a.cost,25);assert.equal(a.profit,75);assert.equal(b.cost,-25);assert.equal(gpCalculate({status:'actual',sales:0,qty:2,unitCost:50}).profit,-100);const t=gpAggregate([a,{status:'hold',sales:0,qty:1}]);assert.equal(t.fullProfit,t.profit);assert.equal(t.gp,.75);assert.equal(t.costRatio,.25);assert.equal(t.profit,75);});
test('September reconciles approved25% workbook; full profit includes approved estimates',()=>{const d=gpDecode({rawMonths:[seed.rawMonths['2026-09']],productMap:seed.productMap,branches:seed.branches}),t=gpAggregate(d.months[0].rows);assert.ok(Math.abs(t.net-4898574.355140187)<.02);assert.ok(Math.abs(t.cost-(1308892.1418229+t.held*.78))<.02,'COGS '+t.cost);assert.ok(Math.abs(t.profit-(3583880.3441584+t.held*.22))<.02,'GP '+t.profit);assert.equal(gpBranches(d.months[0].rows).filter(b=>!b.pending).length,54);assert.equal(t.fullProfit,t.profit);});
test('Annual source totals and finite costs; anomalies scoped to month',()=>{const d=gpDecode({rawMonths:Object.values(seed.rawMonths),productMap:seed.productMap,branches:seed.branches});assert.equal(d.months.length,9);const rs=d.months.flatMap(x=>x.rows);assert.ok(Math.abs(rs.reduce((s,r)=>s+r.sales,0)-53402526.86)<.03);assert.ok(rs.filter(r=>r.status==='actual').every(r=>Number.isFinite(r.unitCost)&&r.unitCost>=0));const sep=d.months.find(m=>m.period==='2026-09');assert.ok(sep.rows.filter(r=>r.branch==='172'&&r.sku==='VING-Ultra_Clean_Solution').every(r=>r.status==='hold'));assert.ok(d.months.find(m=>m.period==='2026-02').rows.some(r=>r.qty===-123212&&r.status==='hold'));});
const metric={product_qty:1,price_sub_total:107,total_discount:0,price_total:107,order_id:1,__count:1};
function mockFetcher(mode='ok'){let calls=0;return async(url,options)=>{const p=JSON.parse(options.body).params;if(url.endsWith('/authenticate'))return new Response(JSON.stringify({result:{uid:1}}),{headers:{'set-cookie':'other=x; Path=/, session_id=test-session; Path=/'}});assert.equal(options.redirect,'manual');assert.equal(options.headers.cookie,'session_id=test-session');const q=p.kwargs;assert.deepEqual(q.domain,[['date','>=','2026-08-31 17:00:00'],['date','<','2026-09-30 17:00:00']]);let result;if(!q.groupby.length){calls++;result=[{...metric,...(mode==='changed'&&calls===2?{price_total:108}:{})}];}else{const r={...metric,config_id:[3,'Branch (staff.login)'],product_id:[7,'[SKU] Product'],__range:{date:{from:'2026-08-31 17:00:00'}}};if(mode==='malformed')delete r.price_total;result=mode==='duplicate'?[r,r]:[r];}return Response.json({result});};}
const credentials={ODOO_LOGIN:'test',ODOO_PASSWORD:'test',ODOO_DATABASE:'test'};
test('RPC month boundaries, cookie, Bangkok date and distinctorder total',async()=>{const result=await gpFetchMonth(credentials,'2026-09',mockFetcher());assert.equal(result.rows[0][0],'2026-09-01');assert.equal(result.branches[3].erp,'Branch');assert.equal(result.totals.order_id,1);});
test('Failed/malformed/duplicate/changing source cannot return a publishable month',async()=>{for(const mode of ['changed','malformed','duplicate'])await assert.rejects(gpFetchMonth(credentials,'2026-09',mockFetcher(mode)));});
test('Persistence, cross-origin, future period, lock and last-good preservation',async()=>{const DB=previewDatabase(),env={...credentials,DB};const post=(period,origin='https://test.site')=>new Request('https://test.site/api/branch-profit/refresh',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({period})});assert.equal((await handleBranchProfit(post('2026-09','https://evil.test'),env,seed,mockFetcher())).status,403);assert.equal((await handleBranchProfit(post('2099-01'),env,seed,mockFetcher())).status,400);assert.equal((await handleBranchProfit(post('2026-09'),env,seed,mockFetcher())).status,200);const before=await DB.prepare('SELECT payload FROM branch_profit_snapshots WHERE period=?').bind('2026-09').first();assert.equal((await handleBranchProfit(post('2026-09'),env,seed,mockFetcher('changed'))).status,502);const after=await DB.prepare('SELECT payload FROM branch_profit_snapshots WHERE period=?').bind('2026-09').first();assert.equal(before.payload,after.payload);await DB.prepare('UPDATE branch_profit_snapshots SET lock_until=? WHERE period=?').bind(Date.now()+60000,'2026-09').run();assert.equal((await handleBranchProfit(post('2026-09'),env,seed,mockFetcher())).status,409);const get=await handleBranchProfit(new Request('https://test.site/api/branch-profit'),env,seed);assert.equal((await get.json()).rawMonths.find(x=>x.month==='2026-09').totals.price_total,107);DB.close();});
test('Worker gates financial pages and APIs; every signed-in role may refresh',async()=>{const {default:worker}=await import('./dist/server/index.js');const crypto=await import('node:crypto'),DB=previewDatabase(),env={DB,SESSION_SECRET:'unit-test-only',BUCKET:{get:async()=>null}};const anon=await worker.fetch(new Request('https://test.site/api/branch-profit'),env);assert.equal(anon.status,401);assert.equal((await worker.fetch(new Request('https://test.site/branch-profit'),env)).status,303);for(const [role,id] of [['viewer','viewer'],['admin','admin'],['assistant','assistant-1']]){const value=`v4.${role}.${id}.${Math.floor(Date.now()/1000)+600}`,cookie='ving_session='+value+'.'+crypto.createHmac('sha256',env.SESSION_SECRET).update(value).digest('base64url');const report=await worker.fetch(new Request('https://test.site/api/branch-profit',{headers:{cookie}}),env);assert.equal(report.status,200,role+' cannot read report');const reportData=await report.json();assert.equal(reportData.rawMonths.length,9);assert.ok(reportData.rawMonths.every(month=>month.rows.length>0));assert.equal(reportData.policy.pendingCostRate,.25);const result=await worker.fetch(new Request('https://test.site/api/branch-profit/refresh',{method:'POST',headers:{cookie,origin:'https://test.site'},body:'{"period":"2099-01"}'}),env);assert.equal(result.status,400,role+' blocked before validation');}DB.close();});

test('Cost ratio uses covered ex-VAT sales including refunds; includes held sales at GP22% and handles zero',()=>{
 const actual={status:'actual',sales:1070,qty:2,unitCost:100};
 const t=gpAggregate([actual,{status:'hold',sales:1070,qty:1}]);
 assert.equal(t.costRatio,.49);assert.ok(Math.abs(t.gp-.51)<1e-12);
 assert.equal(gpAggregate([{status:'estimate',sales:107,qty:1}]).costRatio,.25);
 assert.equal(gpAggregate([{status:'actual',sales:-1070,qty:-2,unitCost:100}]).costRatio,.2);
 assert.equal(gpAggregate([actual,{status:'actual',sales:-1070,qty:-2,unitCost:100}]).costRatio,null);
 assert.equal(gpAggregate([]).costRatio,null);
 assert.equal(gpAggregate([{status:'actual',sales:0,qty:1,unitCost:100}]).costRatio,null);
});


test('Partial GP uses the same covered base as cost ratio, weighted totals, gifts and signed returns',()=>{
 const actual={status:'actual',sales:214,qty:2,unitCost:40},held={status:'hold',sales:107,qty:1};
 const partial=gpAggregate([actual,held]);assert.ok(Math.abs(partial.gp-142/300)<1e-12);assert.ok(Math.abs(partial.costRatio-158/300)<1e-12);assert.equal(partial.fullProfit,partial.profit);
 const weighted=gpAggregate([actual,held,{status:'estimate',sales:107,qty:1}]);assert.equal(weighted.gp,217/400);assert.equal(weighted.costRatio,183/400);
 const gift=gpAggregate([{status:'actual',sales:0,qty:1,unitCost:10}]);assert.equal(gift.profit,-10);assert.equal(gift.gp,null);assert.equal(gift.costRatio,null);
 const refund=gpAggregate([{status:'actual',sales:-107,qty:-1,unitCost:40}]);assert.equal(refund.gp,.6);assert.equal(refund.costRatio,.4);
 const loss=gpAggregate([{status:'actual',sales:107,qty:1,unitCost:120}]);assert.equal(loss.gp,-.2);assert.equal(loss.costRatio,1.2);
 const nearZero=gpAggregate([{status:'actual',sales:107,qty:1,unitCost:40},{status:'actual',sales:-107+1e-12,qty:-1,unitCost:40}]);assert.equal(nearZero.gp,null);
 const sep=gpBranches(gpDecode({rawMonths:[seed.rawMonths['2026-09']],productMap:seed.productMap,branches:seed.branches}).months[0].rows);
 for(const b of sep){assert.ok(Math.abs(b.gp+b.costRatio-1)<1e-10);if(b.pending)assert.equal(b.fullProfit,b.profit);}
});
test('Numeric sorting supports both directions, keeps missing values last and leaves source order intact',()=>{
 const data=[{id:'small',gp:.2,net:90},{id:'missing',gp:null,net:0},{id:'large',gp:.85,net:1200},{id:'loss',gp:-.1,net:50}];
 assert.deepEqual(gpSort(data,'gp','desc').map(x=>x.id),['large','small','loss','missing']);
 assert.deepEqual(gpSort(data,'gp','asc').map(x=>x.id),['loss','small','large','missing']);
 assert.deepEqual(gpSort(data,'sales','desc').map(x=>x.id),['large','small','loss','missing']);assert.equal(data[0].id,'small');
});


test('Held products use GP22%, retain review status and classify cost as estimated',()=>{
 for(const sales of [1120,-1120,0]){
  const r=gpCalculate({status:'hold',sales,qty:1,sku:'vsjb35',note:'ยังไม่ยืนยันต้นทุน'});
  assert.ok(Math.abs(r.cost-sales/1.07*.78)<1e-10);
  assert.ok(Math.abs(r.profit-sales/1.07*.22)<1e-10);
  assert.equal(r.pending,1);assert.equal(r.reviewEstimate,true);assert.equal(r.estimateCost,r.cost);
  assert.equal(r.status,'hold');assert.equal(r.note,'ยังไม่ยืนยันต้นทุน');
  if(sales)assert.ok(Math.abs(gpRatios(r).gp-.22)<1e-12);else assert.equal(gpRatios(r).gp,null);
  const t=gpAggregate([r]);assert.equal(t.actualCost,0);assert.equal(t.fullProfit,t.profit);
 }
 const d=gpDecode({rawMonths:[seed.rawMonths['2026-06']],productMap:seed.productMap,branches:seed.branches});
 const item=d.months[0].rows.find(r=>r.sku==='vsjb35'&&r.date==='2026-06-28');assert.ok(item);
 const r=gpCalculate(item);assert.equal(r.profit.toFixed(2),'230.28');assert.equal(r.cost.toFixed(2),'816.45');
});
