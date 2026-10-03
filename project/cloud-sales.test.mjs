import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {validateCloudSales,receiveCloudSales,applyCloudSales} from './cloud-sales.mjs';

const now=Date.now(),today=new Date(now+7*3600000).toISOString().slice(0,10),key=today.slice(0,7);
const payload={exportedAt:new Date(now).toISOString(),periods:{[key]:{dates:[today],latest_date:today,branches:[{branch_code:'T01',branch:'Test branch',type:'CDS',month_to_date:100,target:500,daily_sales:{[today]:100},responsible:'must exclude',email:'test@example.test'}]}}};
const data=validateCloudSales(payload,now);
assert.equal(data.report.periods[key].latest_date,today);
assert(!JSON.stringify(data.report).includes('must exclude'));
assert(!JSON.stringify(data.report).includes('test@example'));
assert.throws(()=>validateCloudSales({...payload,exportedAt:'2020-01-01T00:00:00Z'},now));
const invalid=structuredClone(payload);invalid.periods[key].branches[0].daily_sales[today]='oops';
assert.throws(()=>validateCloudSales(invalid,now));
const objects=new Map();let serial=0,collide=false;
const env={CLOUD_SALES_TOKEN:'test-cloud-only',BUCKET:{
  async get(key){const item=objects.get(key);return item?{etag:item.etag,json:async()=>JSON.parse(item.body)}:null;},
  async put(key,body,options){const old=objects.get(key);if(collide||options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==old?.etag||options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const item={etag:String(++serial),body};objects.set(key,item);return item;}
}};
const request=(body=payload,token='test-cloud-only')=>new Request('https://example.test/api/sync/daily-sales',{method:'PUT',headers:{authorization:'Bearer '+token},body:JSON.stringify(body)});
assert.equal((await receiveCloudSales(request(payload,'wrong'),env)).status,401);
assert.equal((await receiveCloudSales(request(),{...env,CLOUD_SALES_TOKEN:undefined})).status,503);
assert.equal((await receiveCloudSales(request(),env)).status,200);
const local={data:{'/api/daily-sales':{version:2,periods:{'2024-01':{dates:['2024-01-01'],latest_date:'2024-01-01',branches:[{branch:'Historical',target:10,month_to_date:1,daily_sales:{'2024-01-01':1}}]},[key]:{...payload.periods[key],branches:[{...payload.periods[key].branches[0],month_to_date:999}]}},source:{}}}};
const merged=await applyCloudSales(local,env);
assert.equal(merged.data['/api/daily-sales'].periods[key].branches[0].month_to_date,100,'Mac must not overwrite cloud sales');
assert(merged.data['/api/daily-sales'].periods['2024-01'],'historical months kept');
assert.deepEqual(merged.salesSync.periodKeys,[key]);
assert.equal(merged.salesSync.schedule,undefined,'A received report does not establish a schedule');
const stale={...payload,exportedAt:new Date(now-1000).toISOString()};
assert.equal((await receiveCloudSales(request(stale),env)).status,409);
collide=true;assert.equal((await receiveCloudSales(request(),env)).status,409);
assert.equal((await receiveCloudSales(request(invalid),env)).status,400);
assert.equal((await applyCloudSales(local,env)).data['/api/daily-sales'].periods[key].branches[0].month_to_date,100);

// Exercise the actual Office Script against a workbook-shaped fixture, including
// Buddhist dates, a reported zero day, future dates, and staff columns.
const officeSource=stripTypeScriptTypes(await fs.readFile(new URL('./automation/export-sales-report.ts',import.meta.url),'utf8'));
const script=vm.runInNewContext(officeSource+'; main;', {Date});
const dates=Array.from({length:new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),0).getDate()},(_,i)=>`${i+1}/${Number(key.slice(5,7))}/${Number(key.slice(0,4))+543}`);
const rows=[['ลำดับ','ประเภท','รหัสสาขา','สาขา','เป้าหมาย','ยอดขายปัจจุบัน','ผู้รับผิดชอบ',...dates],['1','CDS','T01','Test branch','1,000','100','PRIVATE NAME',...dates.map((_,i)=>i===0?'100':i<Number(today.slice(8))?'0':'')]];
function fakeWorkbook(rows){return {getWorksheets:()=>[{getName:()=> 'ยอดขาย เดือนทดสอบ',getUsedRange:()=>({getTexts:()=>rows,getValues:()=>rows,getRowCount:()=>rows.length,getColumnCount:()=>rows[0].length})}]};}
const exported=JSON.parse(script(fakeWorkbook(rows),key));
assert.equal(exported.periods[key].latest_date,today);
assert.equal(exported.periods[key].branches[0].month_to_date,100);
assert(!JSON.stringify(exported).includes('PRIVATE NAME'));
validateCloudSales(exported);

// Regression: September's Rama 9 / Westgate ordinals were #VALUE!, while
// store codes and sales were valid. Both import paths must retain coded rows
// without treating headers/subtotals as stores or masking sales-cell errors.
const {parseOnlineSales}=await import('./online-sales-parser.mjs');
const codedRow=(ordinal,code,amount)=>[ordinal,'Stand alone',code,'Test '+code,'1000',String(amount),'PRIVATE NAME',...dates.map((_,i)=>i===0?String(amount):'')];
const brokenRows=[...rows,codedRow('#VALUE!','VA-001',250),codedRow('#VALUE!','VA-003',350),codedRow('','VA-004',75),['รวม','','','ยอดรวม','9999','9999','',...dates.map(()=> '9999')]];
for(const result of [JSON.parse(script(fakeWorkbook(brokenRows),key)),parseOnlineSales([{name:'ยอดขาย ทดสอบ',values:brokenRows}])]){
  const branches=result.periods[key].branches;
  assert.equal(branches.length,4);
  assert.equal(branches.reduce((sum,b)=>sum+b.month_to_date,0),775);
  assert.deepEqual(Array.from(branches,b=>b.branch_code),['T01','VA-001','VA-003','VA-004']);
  assert(!JSON.stringify(result).includes('PRIVATE NAME'));
}
const badSales=[...rows,codedRow('#VALUE!','VA-001',250)];badSales.at(-1)[5]='#VALUE!';
assert.throws(()=>script(fakeWorkbook(badSales),key));
assert.throws(()=>parseOnlineSales([{name:'ยอดขาย ทดสอบ',values:badSales}]));

if(process.argv[2]){
  const {parseCsv}=await import('./operations-live.mjs');
  const actualRows=parseCsv(await fs.readFile(process.argv[2],'utf8'));
  const actual=JSON.parse(script(fakeWorkbook(actualRows),'2026-09'));
  validateCloudSales(actual);
  assert.equal(actual.periods['2026-09'].latest_date,'2026-09-15');
  assert.equal(actual.periods['2026-09'].branches.reduce((sum,b)=>sum+(b.daily_sales['2026-09-15']||0),0),181105);
  console.log('Actual downloaded source matches September 15 and total 181105.');
}
console.log('Cloud sales tests passed: authentication, validation, old-file rejection, concurrent writes, historical preservation, PII filtering and Office Script.');
