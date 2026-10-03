import assert from 'node:assert/strict';
import {loadSavedSummarySales} from './stock-summary-sales-data.mjs';
import {stockSalesAllocation} from './out/assets/stock-summary-scenario.mjs';
import {stockSummaryExcelSheet, stockSummaryExcelWorkbook} from './out/assets/stock-summary-excel.mjs';
import worker from './dist/server/index.js';

const sale = (id,sku,qty) => ({id,sku,qty,branchId:'branch',date:'2026-08-01T00:00:00Z'});
const chunk = (month,rows,extra={}) => ({month,page:1,nextPage:null,total:rows.length,expectedQty:rows.reduce((s,r)=>s+r.qty,0),rows,fetchedAt:'2026-09-24T00:00:00Z',...extra});
const prefix='stock-report/v1/';
const saved=new Map([
 [prefix+'2026-08/1.json',chunk('2026-08',[sale('a','VING-Jarix1.5-Black#40',3),sale('b','VING-Jarix1.5_BB-White#41',2)],{nextPage:13,total:3,expectedQty:6})],
 [prefix+'2026-08/13.json',chunk('2026-08',[sale('c','VING-Flexstraps-White',1)],{page:13,total:3,expectedQty:6})],
 [prefix+'2026-07/1.json',chunk('2026-07',[sale('d','TORANI-Sandal-Green#40',4)])],
 [prefix+'2026-09/1.json',chunk('2026-09',[sale('e','VING-Jarix1.5-Black#40',999)],{nextPage:13,total:2,expectedQty:1000})],
 [prefix+'2026-06/1.json',chunk('2026-06',[sale('f','VING-Wrong-Black#40',999)],{expectedQty:1000})],
 [prefix+'manifest/2026-09-24.json',{products:[]}]
]);
const keys=[...saved.keys()], reads=[];
const BUCKET={
 async list({prefix:requested,cursor}) {assert.equal(requested,prefix);return {objects:(cursor?keys.slice(3):keys.slice(0,3)).map(key=>({key})),truncated:!cursor,...(!cursor?{cursor:'next'}:{})};},
 async get(key){reads.push(key);return saved.has(key)?{json:async()=>saved.get(key)}:null;}
};
const pivot={items:[{sku:'VING-Flexstraps-White',model:'สายรัดรองเท้า',productType:'ACC'}]};
const history=await loadSavedSummarySales({BUCKET},pivot);
assert.deepEqual(history.months,['2026-07','2026-08']);assert.deepEqual(history.skippedMonths,['2026-06','2026-09']);
assert.equal(history.status,'partial');assert.equal(history.totalQty,10);
assert.equal(history.models.find(r=>r.model==='Jarix1.5').qty,5,'combine branches, colors, sizes and grades');
assert.equal(history.models.find(r=>r.model==='สายรัดรองเท้า').qty,1,'exact inventory display alias');
assert.equal(history.models.find(r=>r.model==='TORANI Sandal').qty,4,'brand identity retained');
assert.ok(!JSON.stringify(history).includes('sku'));assert.ok(!history.models.some(r=>r.model==='Wrong'));
assert.equal((await loadSavedSummarySales({},pivot)).status,'unavailable');
assert.equal((await loadSavedSummarySales({BUCKET:{list:async()=>({objects:[],truncated:false}),get:async()=>null}},pivot)).status,'empty');
const duplicate=sale('d','TORANI-Sandal-Green#40',4);
saved.set(prefix+'2026-08/1.json',chunk('2026-08',[duplicate]));
const dedup=await loadSavedSummarySales({BUCKET},pivot);assert.equal(dedup.totalQty,4);assert.equal(dedup.duplicateRowsSkipped,1);

const items=['A','B','C','Unknown'].map(model=>({model,scaleup:1,pivot:2,total:3,unitCostMin:20,unitCostMax:20,fullPriceMin:100,fullPriceMax:100}));
const salesHistory={status:'ready',models:[{model:'A',qty:3},{model:'B',qty:2},{model:'C',qty:1},{model:'Outside',qty:500}],months:['2026-08'],skippedMonths:[],fetchedAt:'2026-09-24T00:00:00Z'};
const mix=stockSalesAllocation(items,salesHistory);assert.deepEqual(mix.rows.map(r=>r.qty),[500,333,167,null]);
assert.deepEqual(stockSalesAllocation(items,salesHistory,1001).rows.map(r=>r.qty),[501,333,167,null]);
assert.deepEqual(stockSalesAllocation(items,salesHistory,1).rows.map(r=>r.qty),[1,0,0,null]);
assert.deepEqual(stockSalesAllocation(items,salesHistory,0).rows.map(r=>r.qty),[0,0,0,null]);
assert.ok(stockSalesAllocation(items,salesHistory,'bad').rows.every(r=>r.qty===null));
assert.deepEqual(stockSalesAllocation([items[1]],salesHistory).rows.map(r=>r.qty),[1000],'normalize within exported historical models');
const report={models:items,grades:items,variants:items,totals:{scaleup:4,pivot:8,total:12},sources:{scaleup:{ready:true},pivot:{ready:true},cost:{}},salesHistory};
const sheet=stockSummaryExcelSheet(report,'models',{hiddenColumns:['scaleup','cost']});
assert.equal(sheet.rows[1].values[7],1000);assert.ok(!sheet.hiddenColumns.includes(7),'target remains editable when stock columns hidden');
assert.deepEqual(sheet.rows.slice(7,11).map(r=>r.values[14]),[500,333,167,'']);
assert.equal(sheet.rows[10].values[11],'ไม่มีข้อมูลบันทึก');assert.ok(sheet.rows[10].values.slice(12,17).every(v=>v===''));
assert.equal(sheet.rows[3].values[0],100000);assert.equal(sheet.rows[3].values[7],80000);assert.equal(sheet.rows[3].values[9],.8);
const xml=new TextDecoder().decode(stockSummaryExcelWorkbook(report,'models'));
assert.match(xml,/<c r="H2" s="25"><v>1000<\/v>/);assert.match(xml,/<autoFilter ref="A7:Q11"\/>/);
assert.match(xml,/<mergeCell ref="H4:I4"\/>/);assert.match(xml,/sqref="H2"/);assert.doesNotMatch(xml,/จำนวนพื้นฐาน|เศษจัดสรร|ลำดับจัดสรร/);
assert.equal(sheet.widths.length,17);
assert.ok(sheet.rows.slice(7).every(row => !row.merge && !row.merges));
assert.ok(sheet.rows.slice(7,11).every(row => !Object.hasOwn(row.formulas,13)), 'share values are static numbers');
assert.match(xml,/<table[^>]+name="VingStockSummary"[^>]+ref="A7:Q11"/);
assert.deepEqual(sheet.rows[11].values,[], 'blank separator keeps totals outside the sort range');
const unknown=stockSummaryExcelSheet({...report,salesHistory:{models:[]}},'models');assert.equal(unknown.rows[3].values[0],'');
const incomplete=stockSummaryExcelSheet({...report,models:items.map((r,i)=>i? r:{...r,unitCostMin:null,unitCostMax:null})},'models');assert.equal(incomplete.rows[3].values[0],100000);assert.equal(incomplete.rows[3].values[7],40000);assert.equal(incomplete.rows[3].values[9],.8);assert.match(incomplete.rows[4].values[0],/กำไร 1 รุ่น/);
const unpriced=stockSummaryExcelSheet({...report,models:items.map((r,i)=>i? r:{...r,fullPriceMin:null,fullPriceMax:null})},'models');
assert.equal(unpriced.rows[3].values[0],50000);assert.equal(unpriced.rows[3].values[7],40000);assert.equal(unpriced.rows[3].values[9],.8);
assert.match(unpriced.rows[4].values[0],/ยอดขาย 1 รุ่น \/ กำไร 1 รุ่น/);
const noFinance=stockSummaryExcelSheet({...report,models:items.map(r=>({...r,fullPriceMin:null,fullPriceMax:null}))},'models');
assert.equal(noFinance.rows[3].values[0],0);assert.equal(noFinance.rows[3].values[7],0);assert.equal(noFinance.rows[3].values[9],'');
const env={SESSION_SECRET:'test',ADMIN_PASSWORD:'admin',VIEWER_PASSWORD:'viewer',BUCKET};
const login=await worker.fetch(new Request('https://test.invalid/login',{method:'POST',body:new URLSearchParams({password:'viewer'})}),env);
const cookie=login.headers.get('set-cookie').split(';')[0];
const response=await worker.fetch(new Request('https://test.invalid/api/stock-summary?includeSales=1',{headers:{cookie}}),env);
assert.equal(response.status,200);assert.equal((await response.json()).salesHistory.totalQty,4);
assert.equal((await worker.fetch(new Request('https://test.invalid/api/stock-summary?includeSales=1'),env)).status,401);
const reordered = stockSalesAllocation([...items].reverse(),salesHistory,1001);
assert.deepEqual(reordered.rows.map(r=>r.qty).reverse(),[501,333,167,null]);
for (const target of [0,1,2,3,17,999,1000,1001,1000000000]) {
 const allocation=stockSalesAllocation(items,salesHistory,target);
 assert.equal(allocation.rows.reduce((s,r)=>s+(r.qty||0),0),target);
 for(const r of allocation.rows.filter(r=>r.share!==null)) assert.ok(Math.abs(r.qty-target*r.share)<1);
}
const stockOrder=stockSummaryExcelSheet({...report,models:items.map((r,i)=>({...r,total:[10,70,20,null][i]}))},'models',{sort:'total-asc'});
assert.deepEqual(stockOrder.rows.slice(7,11).map(row=>row.values[3]),[70,20,10,'—']);
assert.deepEqual(report.models.map(r=>r.model),['A','B','C','Unknown']);
console.log('PASS: saved report pagination, completeness, aliases, all-grade mix, deduplication, allocation conservation, missing data, dashboard caches, editable target, filters, and authorized export history.');
