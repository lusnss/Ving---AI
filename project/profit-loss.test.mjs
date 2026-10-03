import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseGoogleTable,loadProfitLoss} from './profit-loss-data.mjs';
import {summarize,selectRecords,outcomeCounts,monthOverMonth,monthlySummaries,filterDetails,netSalesRatio,detailComparisons,profitStatus,filteredDetailSummary} from './out/assets/profit-loss.mjs';
const data=JSON.parse(await fs.readFile(new URL('./profit-loss.snapshot.json',import.meta.url)));
const near=(a,b)=>assert(Math.abs(a-b)<0.02,`${a} differs from ${b}`);
test('January and September agree with independently checked workbook detail, not broken subtotal formulas',()=>{
  const january=summarize(selectRecords(data,{month:'1',channel:'all',basis:'all'}));
  near(january.net,5868771.52);near(january.cogs,1299543.2);near(january.opex,3112695.430847);near(january.profit,1456532.889153);
  const september=summarize(selectRecords(data,{month:'9',channel:'all',basis:'all'}));
  near(september.net,4170136.39523);near(september.profit,593936.46512);assert.equal(september.pending,1);
});
test('ACT and FCT filters never mix; unfilled event templates do not become zero sales',()=>{
  const actual=selectRecords(data,{month:'9',channel:'all',basis:'ACT'});
  assert(actual.length);assert(actual.every(r=>r.channel.startsWith('event-')));near(summarize(actual).profit,7461.22);
  assert.equal(selectRecords(data,{month:'9',channel:'event-gp',basis:'all'}).length,0);
  assert.equal(summarize([]).profit,null);
  const forecast=selectRecords(data,{month:'9',channel:'all',basis:'FCT'});assert(forecast.every(r=>r.basis==='FCT'));
});
test('missing costs remain visible and essential missing data prevents a misleading profit total',()=>{
  const first=data.records.find(r=>r.net>0&&r.cogs>0);
  assert.equal(summarize([{...first,cogs:null,profit:null}]).profit,null);
  assert(summarize(data.records).missingCosts>0);
  for(const r of data.records){if(r.profit!==null)near(r.profit,r.net-r.cogs-r.opex);}
});
test('recorded profit totals deduct cost-only Event rows and retain incomplete-data flags',()=>{
  const costOnly=data.records.filter(r=>r.channel==='event-gp'&&r.net===null&&r.opex>0);
  assert.equal(costOnly.length,2);near(costOnly.reduce((n,r)=>n+r.opex,0),9554.22);
  for(const month of [4,5]){const rows=selectRecords(data,{month:String(month),channel:'event-gp',basis:'all'});const result=summarize(rows);near(result.profit,result.net-result.cogs-result.opex);assert.equal(result.costOnly,1);assert(result.missingCore>0);near(result.opex,rows.reduce((n,r)=>n+(r.opex??0),0));}
  const total=summarize(data.records);
  near(total.profit,16522698.32);
  near(total.profit,total.net-total.cogs-total.opex);
  const gp=summarize(data.records.filter(r=>r.channel==='event-gp'));
  near(gp.profit,500983.50);
  near(gp.profit,costOnly.reduce((n,r)=>n-r.opex,0)+data.records.filter(r=>r.channel==='event-gp').reduce((n,r)=>n+(r.profit??0),0));
  near(total.profit,Object.keys({consign:1,standalone:1,'event-direct':1,'event-gp':1}).reduce((n,channel)=>n+summarize(data.records.filter(r=>r.channel===channel)).profit,0));
  for(const r of costOnly){assert.equal(r.net,null);assert.equal(r.profit,null);}
});
test('annual data is the sum of monthly records, with one inclusion of each home and garden event',()=>{
  const total=summarize(data.records);
  near(total.net,Array.from({length:12},(_,i)=>summarize(data.records.filter(r=>r.month===i+1)).net??0).reduce((a,b)=>a+b,0));
  assert(data.records.every(r=>['consign','standalone','event-direct','event-gp'].includes(r.channel)));
  for(const r of data.records)assert.deepEqual(Object.keys(r).sort(),['year','month','basis','channel','name','code','gross','discount','net','cogs','costs','sourceProfit','missingCosts','opex','grossProfit','profit','difference'].sort());
});
test('dashboard counts unique branches across months and preserves pending branches and event jobs',()=>{
  assert.deepEqual(outcomeCounts(data.records),{
    branches:{total:49,profit:39,loss:9,zero:0,pending:1},
    events:{total:50,profit:41,loss:7,zero:0,pending:2}
  });
  const actual=outcomeCounts(selectRecords(data,{month:'all',channel:'all',basis:'ACT'}));
  assert.deepEqual(actual.branches,{total:47,profit:44,loss:3,zero:0,pending:0});
  const forecast=outcomeCounts(selectRecords(data,{month:'all',channel:'all',basis:'FCT'}));
  assert.deepEqual(forecast.branches,{total:49,profit:31,loss:17,zero:0,pending:1});
  assert.equal(forecast.events.total,0);
  assert.equal(outcomeCounts([]).branches.total,0);
  near(summarize(data.records).pc,11879939.43);
  assert.equal((netSalesRatio(summarize(data.records).pc,summarize(data.records).net)*100).toFixed(1),'17.9');
});
test('MoM uses adjacent calendar months under the selected channel and basis',()=>{
  const monthly=monthlySummaries(data,{month:'all',channel:'all',basis:'all'});
  assert.equal((monthOverMonth(monthly[1].net,monthly[0].net)*100).toFixed(1),'-11.5');
  assert.equal((monthOverMonth(monthly[1].profit,monthly[0].profit)*100).toFixed(1),'-26.9');
  for(const previous of [null,undefined,0,-100,NaN,Infinity])assert.equal(monthOverMonth(50,previous),null);
  assert.equal(monthOverMonth(null,100),null);
  assert.equal(monthOverMonth(0,100),-1);
  assert.equal(monthOverMonth(-50,100),-1.5);
  const gap=monthlySummaries({records:data.records.filter(r=>r.month!==2)},{month:'3',channel:'standalone',basis:'ACT'});
  assert.equal(gap[1].net,null);assert.equal(monthOverMonth(gap[2].net,gap[1].net),null);
  assert(gap[0].records.every(r=>r.channel==='standalone'&&r.basis==='ACT'));
});
test('detail filters combine independently and numeric ranges do not match missing amounts',()=>{
  const filtered=filterDetails(data.records,{channel:'consign',month:'7',basis:'ACT',status:'profit',net_min:'50,000',net_max:'100000'});
  assert(filtered.length>0);
  assert(filtered.every(r=>r.channel==='consign'&&r.month===7&&r.basis==='ACT'&&r.profit>0&&r.net>=50000&&r.net<=100000));
  const code=data.records.find(r=>r.code)?.code;
  assert(filterDetails(data.records,{name:code.toLowerCase()}).every(r=>r.code===code));
  assert(filterDetails(data.records,{status:'loss'}).every(r=>r.profit<0));
  assert(filterDetails(data.records,{status:'pending'}).every(r=>r.profit===null));
  assert.equal(filterDetails(data.records,{net_min:'abc'}).length,0);
  assert.equal(filterDetails(data.records,{net_min:'100',net_max:'50'}).length,0);
  const missing=data.records.filter(r=>r.net===null);
  assert.equal(filterDetails(missing,{net_min:'0'}).length,0);
  assert.equal(filterDetails(data.records,{}).length,data.records.length);
  assert.equal(filterDetails(data.records,{name:'<script>unknown</script>'}).length,0);
});
test('detail MoM matches the same branch and immediate prior month outside visible month filters',()=>{
  const july=detailComparisons(data,{month:'7',channel:'consign',basis:'all'}).find(r=>r.code==='VM-002');
  assert.equal(july.previous.month,6);assert.equal(july.previous.code,'VM-002');
  assert.equal((july.momNet*100).toFixed(1),'35.4');
  assert.equal(july.momProfit,null);assert(july.previous.profit<0);
  assert.equal((netSalesRatio(july.cogs,july.net)*100).toFixed(1),'20.0');
  assert.equal((netSalesRatio(july.opex,july.net)*100).toFixed(1),'33.0');
  assert.equal((netSalesRatio(july.profit,july.net)*100).toFixed(1),'47.0');
  const rows=detailComparisons(data,{month:'all',channel:'all',basis:'all'});
  const august=rows.find(r=>r.code==='VM-002'&&r.month===8);
  assert.equal((august.momProfit*100).toFixed(1),'-112.0');
  assert(august.previousNote.includes('ACT → FCT'));
  const fct=detailComparisons(data,{month:'8',channel:'consign',basis:'FCT'}).find(r=>r.code==='VM-002');
  assert.equal(fct.previous,null);
  const localFct=detailComparisons(data,{month:'8',channel:'consign',basis:'all'},'FCT').find(r=>r.code==='VM-002');
  assert.equal(localFct.previous,null);
  assert(rows.filter(r=>r.channel.startsWith('event-')).every(r=>r.previous===null));
  const filtered=filterDetails(rows,{name:'VM-002',month:'8',status:'loss',momNet_max:'0'});
  assert.equal(filtered.length,1);assert.equal(filtered[0].previous.month,7);
  assert.equal(filterDetails(rows,{name:'VM-002',month:'8',momNet_min:'0'}).length,0);
  assert(rows.filter(r=>r.code==='VM-002').every((r,i,a)=>!i||r.month>a[i-1].month));
});
test('detail matching does not cross channels or missing months and refuses ambiguous baselines',()=>{
  const current=data.records.find(r=>r.code==='VM-002'&&r.month===7);
  const prior=data.records.find(r=>r.code==='VM-002'&&r.month===6);
  const selection={month:'7',channel:'all',basis:'all'};
  const one=records=>detailComparisons({records},selection)[0];
  assert.equal(one([current,{...prior,month:5}]).previous,null);
  assert.equal(one([current,{...prior,channel:'standalone'}]).previous,null);
  const ambiguous=one([current,prior,{...prior}]);
  assert.equal(ambiguous.previous,null);assert.equal(ambiguous.previousNote,'ข้อมูลเดือนก่อนซ้ำ');
  const jan={...current,year:2026,month:1};
  const dec={...prior,year:2025,month:12};
  assert.equal(detailComparisons({records:[jan,dec]},{...selection,month:'1'})[0].previous,dec);
  assert.equal(profitStatus({profit:null}),'pending');assert.equal(profitStatus({profit:0}),'zero');
  assert.equal(profitStatus({profit:0.001}),'zero');assert.equal(profitStatus({profit:1}),'profit');assert.equal(profitStatus({profit:-1}),'loss');
});
test('Google response parsing rejects source errors and preserves absent cells',()=>{
  assert.deepEqual(parseGoogleTable('google.visualization.Query.setResponse({"status":"ok","table":{"rows":[{"c":[{"v":1},null,{"v":"1,200.50"}]}]}});'),[[1,null,'1,200.50']]);
  assert.throws(()=>parseGoogleTable('{"status":"error"}'));
});
test('filtered totals match February Consign rows instead of full-year totals',()=>{
  const selection={month:'all',channel:'all',basis:'all'};
  const rows=filterDetails(detailComparisons(data,selection),{channel:'consign',month:'2'});
  const total=filteredDetailSummary(rows);
  const expected=data.records.filter(r=>r.channel==='consign'&&r.month===2);
  assert.deepEqual(rows.map(r=>r.code).sort(),expected.map(r=>r.code).sort());
  assert.equal(total.records.length,expected.length);assert.equal(total.months,1);
  near(total.net,expected.reduce((n,r)=>n+(r.net??0),0));
  near(total.profit,total.net-total.cogs-total.opex);
  assert.notEqual(total.net,summarize(data.records.filter(r=>r.channel==='consign')).net);
});
test('every detail filter and global selection narrows the same rows used by totals',()=>{
  const selection={month:'7',channel:'consign',basis:'ACT'};
  const pool=detailComparisons(data,selection,'ACT');
  const filters={name:'VM-002',channel:'consign',month:'7',basis:'ACT',status:'profit',net_min:'50000',net_max:'100000',momNet_min:'30',momNet_max:'40'};
  const rows=filterDetails(pool,filters),total=filteredDetailSummary(rows);
  assert.equal(rows.length,1);assert.equal(total.entities.length,1);assert.equal(total.months,1);
  near(total.net,rows[0].net);near(total.profit,rows[0].profit);
  for(const filter of [{month:'6'},{basis:'FCT'},{channel:'standalone'},{status:'loss'},{net_min:'999999999'},{momNet_max:'0'}]){
    const empty=filteredDetailSummary(filterDetails(pool,{...filters,...filter}));
    assert.equal(empty.records.length,0);assert.equal(empty.net,null);assert.equal(empty.profit,null);assert.equal(empty.margin,null);
  }
  const cleared=filteredDetailSummary(filterDetails(pool,{}));
  assert.equal(cleared.records.length,pool.length);near(cleared.net,summarize(pool).net);
});
test('filtered multi-branch totals retain cost-only deductions and weighted margin',()=>{
  const rows=filterDetails(detailComparisons(data,{month:'4',channel:'all',basis:'all'}),{channel:'event-gp'});
  const total=filteredDetailSummary(rows);
  assert.equal(total.months,1);assert.equal(total.costOnly,1);assert(total.missingCore>0);
  near(total.profit,total.net-total.cogs-total.opex);near(total.margin,total.profit/total.net);
  const empty=filteredDetailSummary([]);
  assert.equal(empty.net,null);assert.equal(empty.profit,null);assert.deepEqual(empty.entities,[]);
});
test('outage keeps last successful data and timestamp, with stale status',async()=>{
  const old={...data,source:{...data.source,fetched_at:'2026-01-01T00:00:00.000Z'}};
  const result=await loadProfitLoss({BUCKET:{get:async()=>null}},old,async()=>{throw Error('offline');});
  assert.equal(result.source.status,'stale');assert.equal(result.source.fetched_at,old.source.fetched_at);assert.deepEqual(result.records,old.records);
});
