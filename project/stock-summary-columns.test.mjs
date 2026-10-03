import assert from 'node:assert/strict';
import {summaryAverageCost,summaryCostLabel,summaryPriceLabel,summaryUnitEconomics,summaryViews,summaryTableColumns,visibleSummaryColumns,summaryExcelHiddenColumns} from './out/assets/stock-summary-view.mjs';
import {stockSummaryExcelSheet,stockSummaryExcelWorkbook} from './out/assets/stock-summary-excel.mjs';
const item={model:'Jarix1.5',unitCostMin:257.87,unitCostMax:321.8,costMissing:true,fullPriceMin:2350,fullPriceMax:2350,priceMissing:true,costRows:[6,7],scaleup:1,pivot:2,total:3};
assert.equal(summaryAverageCost(item),289.84);
assert.equal(summaryCostLabel(item),'289.84');assert.equal(summaryPriceLabel(item),'2,350');
assert.equal(summaryUnitEconomics(item).gp,(2350-289.84)/2350);
assert.equal(summaryAverageCost({unitCostMin:0,unitCostMax:0}),0);
assert.equal(summaryAverageCost({unitCostMin:null,unitCostMax:null}),null);
assert.equal(summaryCostLabel({}),'[ต้องถามเจ้าของ]');
for(const view of summaryViews){
 const hiddenColumns=['model','cost','price','scaleup','fake','__proto__'];
 const shown=visibleSummaryColumns(view,{hiddenColumns});
 assert.equal(shown[0].key,'model');assert.ok(shown.every(c=>!['cost','price','scaleup'].includes(c.key)));
 assert.deepEqual(summaryExcelHiddenColumns(view,{hiddenColumns}),[4,5,11]);
 assert.equal(visibleSummaryColumns(view).length,summaryTableColumns(view).length);
}
const report={models:[item],grades:[],variants:[],totals:{scaleup:1,pivot:2,total:3},sources:{scaleup:{ready:true},pivot:{ready:true},cost:{}}};
const sheet=stockSummaryExcelSheet(report,'models',{hiddenColumns:['cost','price','scaleup']});
assert.equal(sheet.rows[7].values[4],289.84);assert.equal(sheet.rows[7].values[5],2350);
assert.equal(sheet.rows[7].values[6],summaryUnitEconomics(item).gp);
assert.deepEqual(sheet.hiddenColumns,[4,5,1]);assert.match(sheet.rows[7].formulas[9],/\$E\$8/);assert.match(sheet.rows[7].formulas[9],/\$I\$8/);assert.match(sheet.rows[7].formulas[8],/\$H\$8/);
const xml=new TextDecoder().decode(stockSummaryExcelWorkbook(report,'models',{hiddenColumns:['cost','price','scaleup']}));
assert.match(xml,/<col min="5" max="5"[^>]+hidden="1"/);assert.match(xml,/<c r="E8" s="12"><v>289.84<\/v>/);assert.match(xml,/<c r="H8" s="24"\/>/);
console.log('PASS: cost midpoint and cent rounding; partial numeric data; independent column selection; fixed Excel positions, hidden columns and formula dependencies.');
