import assert from 'node:assert/strict';
import test from 'node:test';
import {reportData} from './out/assets/daily-comparison-data.mjs';
import {createReport,aggregate,comparison,createOverview,trendSeries,overviewCsv} from './out/assets/daily-comparison-model.mjs';
import worker from './dist/server/index.js';
test('new report and its numeric dataset stay behind the existing login',async()=>{
 const env={SESSION_SECRET:'comparison-test-secret',VIEWER_PASSWORD:'comparison-viewer',ADMIN_PASSWORD:'comparison-admin'};
 for(const path of ['/daily-comparison','/assets/daily-comparison-data.mjs','/api/daily-comparison']){
  assert.equal((await worker.fetch(new Request('https://example.test'+path),env)).status,path.startsWith('/api/')?401:303);
 }
 const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:env.VIEWER_PASSWORD})}),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 for(const path of ['/daily-comparison','/assets/daily-comparison-data.mjs','/assets/daily-comparison-model.mjs','/assets/daily-comparison.mjs']){
  assert.equal((await worker.fetch(new Request('https://example.test'+path,{headers:{cookie}}),env)).status,200,path);
 }
});
test('source totals reconcile for each requested group; September stops at day 20',()=>{
 for(const [id,total] of [['standalone',22505853.57],['event',3237923.88],['event-outside',3759776.5],['department',20296477.46]]){
  const r=createReport(reportData,id);
  assert.equal(r.current.amount,total,id);
  assert.deepEqual(r.scope.latest,{month:9,day:20});
  assert.equal(Math.round(r.channels.reduce((s,c)=>s+(c.current.amount??0),0)*100)/100,total);
  assert(r.previous.amount>0);
 }
 assert.equal(createReport(reportData,'department','1').current.amount,2587379.28);
 assert.equal(createReport(reportData,'department','9').current.amount,1550308.41);
 assert.equal(createReport(reportData,'event','9').current.amount,502308);
 assert.equal(createReport(reportData,'event-outside','9').current.amount,247986);
});
test('unentered future cells and missing years stay missing, never turn into zero sales',()=>{
 const r=createReport(reportData,'standalone','12');
 assert.equal(r.current.amount,null);assert.equal(r.current.net,null);assert.equal(r.growth,null);
 assert.equal(reportData.records.find(r=>r.year===2569&&r.month===5&&r.channel==='Rama 9').row,176);
 assert.equal(reportData.records.filter(r=>r.year===2569&&r.month===5&&r.channel==='Rama 9').length,1);
 assert(reportData.records.every(r=>!/[()@]/.test(r.channel.replace(' (ไม่แยกแบรนด์)',''))));
});
test('combined like-period totals reconcile to both imported workbooks',()=>{
 const o=createOverview(reportData,'matched');
 assert.equal(o.scope.firstMonth,3);assert.equal(o.scope.endMonth,9);assert.equal(o.scope.endDay,20);
 assert.equal(o.current.amount,38901843.17);assert.equal(o.previous.amount,43497753.28);
 assert.equal(o.delta,-4595910.11);assert(Math.abs(o.growth+10.565856310820475)<1e-8);
 const expected=[[17579336.07,13754068.48],[2659173.93,4859375.42],[3107611.5,3417647],[15555721.67,21466662.38]];
 for(const [i,r] of o.reports.entries()){
  assert.equal(r.current.amount,expected[i][0]);assert.equal(r.previous.amount,expected[i][1]);
  assert(r.current.complete&&r.previous.complete);
  for(const year of ['current','previous'])assert.equal(Math.round(r.channels.reduce((s,c)=>s+(c[year].amount??0),0)*100)/100,r[year].amount);
 }
 for(const m of o.monthly)for(const year of ['current','previous'])if(m[year].amount!==null)assert.equal(Math.round(m.byGroup.reduce((s,g)=>s+(g[year].amount??0),0)*100)/100,m[year].amount);
 assert.equal(o.monthly[8].current.amount,3965521.41);assert.equal(o.monthly[8].previous.amount,3438238.9);
});
test('missing January EVENT and February outside EVENT block a false YTD comparison',()=>{
 const o=createOverview(reportData,'ytd');
 assert.equal(o.current.amount,49800031.41);assert.equal(o.previous.amount,53785186.18);
 assert.equal(o.delta,null);assert.equal(o.growth,null);assert.equal(o.previous.complete,false);
 assert.equal(o.reports[0].previous.amount,15957867.48);assert.equal(o.reports[1].previous.complete,false);assert.equal(o.reports[2].previous.complete,false);assert(o.reports[3].previous.complete);
 assert.equal(createOverview(reportData,'1').reports[1].previous.amount,null);
 assert.equal(createOverview(reportData,'2').reports[2].growth,null);
 assert.equal(createOverview(reportData,'12').current.amount,null);
 const trend=trendSeries(o,'cumulative');
 assert.equal(trend[8].current,o.current.amount);assert.equal(trend[8].previous,o.previous.amount);
 assert.equal(trend[9].current,null);assert.equal(trend[9].previous,null);
});
test('CSV preserves exact totals and explicitly labels incomplete source data',()=>{
 const csv=overviewCsv(createOverview(reportData,'matched'));
 assert(csv.startsWith('\uFEFF'));assert(csv.includes('"รวม 4 ช่องทาง","38901843.17","43497753.28","-4595910.11","-10.57","ครบ / ครบ"'));
 const ytd=overviewCsv(createOverview(reportData,'ytd'));assert(ytd.includes('"รวม 4 ช่องทาง","49800031.41","53785186.18","","","ครบ / ไม่ครบ"'));
});
test('like-period calculations exclude later days in the prior year and avoid allocating monthly refunds',()=>{
 const data={sources:{'2568':{status:'ready'}},records:[{year:2568,group:'EVENT',month:9,channel:'event',daily:[10,20,999],net:900,lastDay:3}]};
 const p=aggregate(data,2568,'EVENT',{firstMonth:9,endMonth:9,endDay:2});
 assert.equal(p.amount,30);assert.equal(p.net,null);assert.equal(p.complete,true);
 assert.deepEqual(comparison({amount:60,complete:true},p),{delta:30,growth:100,reason:null});
 const zero=comparison({amount:60,complete:true},{amount:0,complete:true});
 assert.equal(zero.delta,60);assert.equal(zero.growth,null);
 data.records[0].daily=[10,null,999];
 const missing=aggregate(data,2568,'EVENT',{firstMonth:9,endMonth:9,endDay:2});
 assert.equal(missing.amount,10);assert.equal(missing.complete,false);assert.equal(comparison({amount:60,complete:true},missing).delta,null);
});
