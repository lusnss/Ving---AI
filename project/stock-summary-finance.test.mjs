import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildStockSummary,summaryItemCost} from './out/assets/stock-summary-model.mjs';
import {filteredStockSummary,summaryUnitEconomics,summaryCostLabel} from './out/assets/stock-summary-view.mjs';
import {stockSummaryExcelSheet,stockSummaryExcelWorkbook,stockFinanceHeaders} from './out/assets/stock-summary-excel.mjs';
import {loadStockSummary} from './stock-summary-data.mjs';
const cost=(model,grade,value,extra={})=>({model,grade,type:'SHOES',beforeVat:value,includingVat:value,note:'',sourceRow:6,...extra});
const costs=[cost('Test','A',300),cost('Test_B','B',200,{sourceRow:7}),cost('Test_C','C',5.35,{sourceRow:8,beforeVat:0}),cost('Unreviewed','A',250,{note:'รอแก้ไข'})];
const item=(sku,fullPrice=1000,available=10)=>({sku,fullPrice,available});
assert.equal(summaryItemCost(item('VING-Test-Black#40'),costs).unitCostMin,300);
assert.equal(summaryItemCost(item('VING-Test_B-Black#40'),costs).unitCostMin,200);
assert.equal(summaryItemCost(item('VING-Test_C-Black#40'),costs).costMissing,true);
assert.equal(summaryItemCost(item('VING-Unreviewed-Black#40'),costs).unitCostMin,null);
assert.equal(summaryItemCost(item('VING-Test_BB-Black#40'),costs).unitCostMin,null,'never borrow a different grade');
const multi=summaryItemCost(item('VING-Test-Black#40'),[...costs,cost('Test','A',320,{factory:'another'})]);
assert.equal(multi.unitCostMin,300);assert.equal(multi.unitCostMax,320);
const accessory=cost('Flex Straps','',20.29,{type:'ACC'});
assert.equal(summaryItemCost(item('VING-Flexstraps-White'),[accessory]).unitCostMin,20.29);
const sizeCost=cost('Sock : M','',70,{type:'SOCKS'});
assert.equal(summaryItemCost(item('VING-Sock-Black#M'),[sizeCost]).unitCostMin,70);
assert.equal(summaryItemCost(item('VING-Sock-Black#S'),[sizeCost]).unitCostMin,null);
const snap=items=>({items});
const report=buildStockSummary(snap([]),snap([item('VING-Test-Black#40'),item('VING-Test_B-Black#40'),item('VING-Unreviewed-Black#40')]),costs);
assert.equal(summaryCostLabel(report.models.find(r=>r.model==='Test')),'250.00');
const selected=filteredStockSummary(report,{query:'Test Black 40'});
assert.equal(summaryUnitEconomics(selected.models[0]).gp,.75);
assert.equal(summaryUnitEconomics(selected.grades.find(r=>r.grade==='A')).gp,.7);
for(const view of ['models','grades','variants']){
 const sheet=stockSummaryExcelSheet(selected,view);
 assert.deepEqual(sheet.rows[6].values.slice(4,11),stockFinanceHeaders.slice(4,11));
 for(const [i,row]of sheet.rows.slice(7,7+selected[view].length).entries()){
  assert.equal(row.values[7],'');
  if(view==='models' && selected.models.length===1) {
   assert.ok(row.formulas[6].includes('$E$8'));
   assert.ok(row.formulas[8].includes('$H$8'));
   assert.ok(row.formulas[9].includes('$I$8'));
  } else if(view==='models') {
   assert.match(row.formulas[6],/INDEX\(\$E\$8:/);
   assert.match(row.formulas[8],/INDEX\(\$H\$8:/);
   assert.match(row.formulas[9],/INDEX\(\$I\$8:/);
   assert.match(row.formulas[10],/ROW\(\)-7/);
  } else {
  assert.match(row.formulas[6],new RegExp(`E${i+8}`));
  assert.match(row.formulas[8],new RegExp(`H${i+8}`));
  assert.match(row.formulas[9],new RegExp(`\\(I${i+8}-E${i+8}\\)/I${i+8}`));
  assert.match(row.formulas[10],new RegExp(`I${i+8}-E${i+8}`));
  }
 }
 assert.deepEqual(sheet.rows.find(row => row.kind === 'total').values.slice(view === 'models' ? 1 : 11, view === 'models' ? 4 : 14),[0,20,20]);
 const xml=new TextDecoder().decode(stockSummaryExcelWorkbook(selected,view));
 assert.match(xml,/<dataValidation type="decimal"/);assert.match(xml,/<c r="H8" s="24"\/>/);assert.match(xml,/calcMode="auto"/);
}
const unavailable=await loadStockSummary({DB:{prepare(){return {bind(){return {async first(){return null;}};}};}}},snap([]),async()=>{throw Error('offline');});
assert.equal(unavailable.sources.cost.status,'unavailable');assert.ok(unavailable.variants.every(r=>r.costMissing));
console.log('PASS: exact model/grade/size cost mapping, unavailable and unreviewed costs, multiple factories, all E–K positions, input validation and sales-based GP formula references.');
