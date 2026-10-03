import assert from 'node:assert/strict';
import {buildStockSummary} from './out/assets/stock-summary-model.mjs';
import {filteredStockSummary, stockDashboardModels, hasSummarySelection} from './out/assets/stock-summary-view.mjs';
import {stockSummaryExcelSheet} from './out/assets/stock-summary-excel.mjs';
const snapshot = items => ({items});
const report = buildStockSummary(snapshot([
  {sku:'VING-X-Black#40',available:7}, {sku:'VING-X-White#41/42',available:2},
  {sku:'VING-X_BB-Black#40',available:4}, {sku:'VING-Y-Blue#39',available:11}
]),snapshot([{sku:'VING-X-Black#40',grade:'A',available:3},{sku:'VING-X-Black#41/42',grade:'A',available:5}]));
assert.equal(hasSummarySelection({}),false);assert.equal(hasSummarySelection({query:'  ',sort:'total-desc'}),false);
for(const field of ['query','model','grade','color','size']) assert.equal(hasSummarySelection({[field]:'X'}),true);
const selected=filteredStockSummary(report,{model:'X',grade:'A'}),model=stockDashboardModels(selected)[0];
assert.deepEqual(selected.totals,{scaleup:9,pivot:8,total:17});
assert.equal(model.grades.length,1);assert.equal(model.grades[0].grade,'A');
assert.deepEqual(model.grades[0].sizes,['40','41/42']);
assert.deepEqual(model.grades[0].colors.map(row=>[row.color,row.cells,row.total]),[['Black',[10,5],15],['White',[0,2],2]]);
assert.deepEqual(model.grades[0].sizeTotals,[10,7]);
const exact=filteredStockSummary(report,{model:'X',grade:'A',color:'Black',size:'40'});
assert.equal(exact.variants.length,1);assert.equal(exact.totals.total,10);
const sheet=stockSummaryExcelSheet(exact,'variants',{model:'X',grade:'A',color:'Black',size:'40'});
assert.match(sheet.rows[1].values[0],/Black/);assert.match(sheet.rows[1].values[0],/40/);assert.equal(sheet.rows.at(-1).values[0],'รวมตามตัวกรอง');
assert.equal(stockDashboardModels(filteredStockSummary(report,{model:'X'}))[0].grades[1].grade,'B+');
assert.equal(filteredStockSummary(report,{query:'Y'}).totals.total,11);assert.equal(filteredStockSummary(report,{model:'X',grade:'A'}).totals.total,17);
const partial=buildStockSummary(snapshot([{sku:'VING-X-Black#40',available:7}]),null);
assert.equal(stockDashboardModels(partial)[0].grades[0].colors[0].cells[0],null);
assert.equal(stockDashboardModels(filteredStockSummary(report,{model:'not found'})).length,0);
console.log('PASS: selection visibility, exact grade/color/size filters, grade A matrix cells and totals, independent selections, Excel metadata and missing warehouse.');
