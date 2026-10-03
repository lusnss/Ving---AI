import assert from 'node:assert/strict';
import {buildStockSummary} from './out/assets/stock-summary-model.mjs';
import {filteredStockSummary, summaryViews, summarySorts, summaryPriceLabel} from './out/assets/stock-summary-view.mjs';
import {stockSummaryExcelSheet, stockSummaryExcelWorkbook} from './out/assets/stock-summary-excel.mjs';
const snapshot = items => ({items, updatedAt: '2026-09-24T00:00:00Z'});
const report = buildStockSummary(snapshot([
  {sku: 'VING-Jarix1.5-Onyx_Black#40', available: 7},
  {sku: 'VING-Jarix1.5_BB-Onyx_Black#40', available: 2},
  {sku: 'VING-Jarix1.5-Pearl_White#41/42', available: 11},
  {sku: 'VING-Vix-Pearl_White#40', available: 20}
]), snapshot([
  {sku: 'VING-Jarix1.5-Onyx_Black#40', grade: 'A', available: 8},
  {sku: 'VING-Jarix1.5_B-Onyx_Black#40', grade: 'C', available: 3},
  {sku: 'VING-Vix-Pearl_White#40', grade: 'A', available: 0}
]));
const original = JSON.stringify(report), state = {query: ' JARIX1.5 onyx_black 40 ', sort: 'total-desc'};
const visible = filteredStockSummary(report, state);
assert.deepEqual(visible.totals, {scaleup: 9, pivot: 11, total: 20});
assert.equal(visible.models.length, 1); assert.equal(visible.variants.length, 3);
assert.deepEqual(visible.grades.map(row => [row.grade, row.total]), [['A', 15], ['C', 3], ['B+', 2]]);
for (const view of summaryViews) assert.equal(visible[view.key].reduce((sum, row) => sum + row.total, 0), 20);
for (const sort of Object.keys(summarySorts).filter(sort => sort !== 'name')) {
  const selected = filteredStockSummary(report, {sort}), [field, direction] = sort.split('-');
  for (const view of summaryViews) {
    const values = selected[view.key].map(row => row[field]);
    assert.deepEqual(values, [...values].sort((a, b) => direction === 'desc' ? b - a : a - b));
  }
}
assert.equal(JSON.stringify(report), original, 'filters must not mutate loaded report');
const empty = filteredStockSummary(report, {query: 'does not exist'});
assert.deepEqual(empty.totals, {scaleup: 0, pivot: 0, total: 0});assert.equal(empty.variants.length, 0);
const partial = filteredStockSummary(buildStockSummary(snapshot([{sku: 'VING-Vix-Black#40', available: 0}]), null), {query: 'Vix', sort: 'total-desc'});
assert.deepEqual(partial.totals, {scaleup: 0, pivot: null, total: null});
assert.deepEqual(stockSummaryExcelSheet(partial, 'models').rows.find(row => row.kind === 'total').values.slice(0,11), ['รวมทั้งหมด', 0, '—', '—', ...Array(7).fill('')]);
for (const view of summaryViews) {
  const sheet = stockSummaryExcelSheet(visible, view.key, state);
  const modelOnly = view.key === 'models';
  assert.equal(sheet.widths.length, modelOnly ? 17 : 15);
  assert.equal(sheet.rows.length, visible[view.key].length + (modelOnly ? 17 : 8));
  assert.deepEqual(sheet.rows.slice(7, 7 + visible[view.key].length).map(row => modelOnly ? row.values.slice(0,4) : [...row.values.slice(0,4), ...row.values.slice(11,14)]), visible[view.key].map(item => [...(modelOnly ? ['model'] : ['model','grade','color','size']).map(field => item[field] || ''), item.scaleup, item.pivot, item.total]));
  assert.deepEqual(sheet.rows.find(row => row.kind === 'total').values.slice(modelOnly ? 1 : 11, modelOnly ? 4 : 14), [9, 11, 20]);
  assert.ok(sheet.rows.some(row => /JARIX1.5 onyx_black 40/.test(row.values[0])));
  const bytes = stockSummaryExcelWorkbook(visible, view.key, state), xml = new TextDecoder().decode(bytes);
  assert.equal(bytes[0], 80); assert.equal(bytes[1], 75);
  assert.doesNotMatch(xml, /SKU|VING-Jarix/);
  assert.match(xml, /ySplit="7"/);
}
const unsafe = {...visible, models: [{model: '=HYPERLINK("x")', scaleup: 1, pivot: 0, total: 1}]};
const text = new TextDecoder().decode(stockSummaryExcelWorkbook(unsafe, 'models', {query: '<script>'}));
assert.match(text, /t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/);assert.match(text, /&lt;script&gt;/);assert.doesNotMatch(text, /<f>.*HYPERLINK/);
console.log('PASS: shared search, color/size rollups, all warehouse sort orders, unchanged source, zero/missing values, per-table Excel columns/order/totals and text safety.');

const priced = buildStockSummary(snapshot([]), snapshot([
  {sku: 'VING-Test-Black#40', grade: 'A', available: 3, fullPrice: 2350},
  {sku: 'VING-Test-White#40', grade: 'A', available: 2, fullPrice: 2450.5},
  {sku: 'VING-Test_B-Black#40', grade: 'B', available: 4, fullPrice: 1800},
  {sku: 'VING-Gift-Black#40', grade: 'A', available: 5, fullPrice: 0},
  {sku: 'VING-Unpriced-Black#40', grade: 'A', available: 6, fullPrice: null}
]));
assert.equal(summaryPriceLabel(priced.models.find(r => r.model === 'Test')), '1,800–2,450.5');
assert.equal(summaryPriceLabel(priced.models.find(r => r.model === 'Gift')), '0');
assert.equal(summaryPriceLabel(priced.models.find(r => r.model === 'Unpriced')), '[ต้องถามเจ้าของ]');
const selectedPrice = filteredStockSummary(priced, {query: 'Test White'});
assert.equal(summaryPriceLabel(selectedPrice.models[0]), '2,450.5');
assert.equal(selectedPrice.models[0].total, 2);
assert.equal(stockSummaryExcelSheet(selectedPrice, 'models').rows[7].values[5], 2450.5, 'single prices stay numeric in Excel');
assert.equal(stockSummaryExcelSheet(priced, 'models').rows.find(r => r.values[0] === 'Gift').values[5], 0);
const missingPrice = buildStockSummary(snapshot([{sku: 'VING-Test-Red#41', available: 7, fullPrice: 999}]), snapshot([
  {sku: 'VING-Test-Black#40', grade: 'A', available: 3, fullPrice: 2350}
]));
assert.equal(summaryPriceLabel(missingPrice.models[0]), '2,350');
assert.equal(summaryPriceLabel(filteredStockSummary(missingPrice, {query: 'Test Red'}).models[0]), '[ต้องถามเจ้าของ]');
assert.equal(summaryPriceLabel(filteredStockSummary(missingPrice, {query: 'Test Black'}).models[0]), '2,350');
assert.equal(missingPrice.totals.total, 10);
assert.equal(summaryPriceLabel(buildStockSummary(snapshot([]), snapshot([{sku: 'VING-X', available: 1, fullPrice: -10}])).models[0]), '[ต้องถามเจ้าของ]');
console.log('PASS: PIVOT retail prices, ranges, grade/color filtering, numeric Excel prices, zero, missing and partial coverage.');

assert.deepEqual(stockSummaryExcelSheet(priced, 'models').rows[7].decimalColumns, [4, 5, 8, 10, 15, 16]);
const priceXml = new TextDecoder().decode(stockSummaryExcelWorkbook(priced, 'models'));
assert.match(priceXml, /<c r="F10" s="12"><v>0<\/v>/, 'zero retail prices use a format that displays zero');
