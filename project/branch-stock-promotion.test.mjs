import assert from 'node:assert/strict';
import {branchPromotionReport, stockPromotionExcelSheet, stockPromotionExcelWorkbook} from './out/assets/stock-promotion-excel.mjs';
import {stockSummaryExcelSheet} from './out/assets/stock-summary-excel.mjs';
import {filterStockItems} from './out/assets/stock-grid.mjs';

const finance = (model, price = 1000, cost = 200) => ({model, fullPriceMin: price, fullPriceMax: price, unitCostMin: cost, unitCostMax: cost, costRows: [8]});
const reference = {models: [finance('Vari S1.0'), finance('Jarix'), finance('สายรัดรองเท้า', 150, 20), finance('TORANI Sandal', 1500, 300)],
  grades: [{...finance('Vari S1.0', 1000, 100), grade: 'B'}],
  sources: {cost: {file: 'ต้นทุนสินค้า'}, pivot: {file: 'Pivot'}, scaleup: {ready: true}},
  salesHistory: {status: 'ready', months: ['2026-08'], models: [{model: 'Vari S1.0', qty: 6}, {model: 'Jarix', qty: 3}, {model: 'สายรัดรองเท้า', qty: 1}]}};
const item = (sku, normal, hold, model = '') => ({sku, normal, hold, total: normal + hold, model});
const items = [item('VING-Vari_S1.0-Black#40', 3, 1), item('VING-Vari_S1.0-White#41', 5, 2), item('VING-Vari_S1.0_B-White#42', 2, 1),
  item('VING-Jarix-Black#40', 20, 0), item('VING-Flexstraps-White', 1, 0), item('VING-Unknown-Black#40', 1, 0),
  item('TORANI-Sandal-Green#40', 0, 4)];
const products = [{sku: 'VING-Flexstraps-White', model: 'สายรัดรองเท้า'}];
const options = {metric: 'normal', branch: 'สาขาทดสอบ', branchType: 'STAND ALONE', grade: 'all', sourceQuery: 'SKU test'};
const before = JSON.stringify({items, products, reference});
const report = branchPromotionReport(items, products, reference, options);
assert.equal(report.models.length, 4, 'one row per model across colors, sizes and grades; omit selected-metric zero');
assert.deepEqual(report.totals, {scaleup: 32, pivot: 4, total: 32});
assert.equal(report.models.find(row => row.model === 'Vari S1.0').total, 10);
assert.equal(report.models.find(row => row.model === 'Flexstraps').fullPriceMin, 150, 'exact catalog alias');
assert.equal(report.salesHistory.models.find(row => row.model === 'Flexstraps').qty, 1);
const sheet = stockPromotionExcelSheet(items, products, reference, options);
assert.equal(sheet.name, 'คิดโปรโมชั่น');
assert.deepEqual(sheet.rows[6].values.slice(0,4), ['รุ่น', 'สต็อกปกติ (สาขาที่เลือก)', 'On-Hold (สาขาที่เลือก)', 'จำนวนที่เลือก · สต็อกปกติ']);
assert.ok(!sheet.rows[6].values.some(value => ['เกรด', 'สี', 'ไซซ์', 'SKU'].includes(value)));
assert.deepEqual(sheet.rows.slice(7,11).map(row => row.values[0]), ['Jarix', 'Vari S1.0', 'Flexstraps', 'Unknown']);
assert.deepEqual(sheet.rows.slice(7,11).map(row => row.values[3]), [20,10,1,1]);
assert.equal(sheet.rows[10].values[4], '[ต้องถามเจ้าของ]');
assert.equal(sheet.rows[10].values[5], '[ต้องถามเจ้าของ]');
assert.equal(sheet.rows[10].values[14], '', 'unknown history never fabricated');
assert.equal(sheet.rows[3].values[0], 915000);
assert.equal(sheet.rows[3].values[7], 733000);
assert.deepEqual(sheet.rows.find(row => row.kind === 'total').values.slice(1,4), [32,4,32]);
const shared = stockSummaryExcelSheet(report, 'models', {}, {source: 'test'});
assert.deepEqual(sheet.rows.slice(7,11).map(row => row.formulas), shared.rows.slice(7,11).map(row => row.formulas), 'reuse all finance and forecast formulas from summary table 1');
assert.ok(sheet.rows.some(row => String(row.values[0]).includes('สาขาทดสอบ') && String(row.values[0]).includes('SKU test')));
assert.ok(!sheet.rows.some(row => String(row.values[0]).startsWith('Scalup:')));
for (const metric of ['normal', 'hold', 'total']) {
  const filtered = filterStockItems(items, {grade: 'grade_b', query: 'Vari'});
  const selected = stockPromotionExcelSheet(filtered, products, reference, {...options, metric, grade: 'grade_b'});
  assert.equal(selected.rows[7].values[3], {normal:2, hold:1, total:3}[metric]);
  assert.equal(selected.rows[7].values[4], 100, 'grade filter keeps its own finance reference');
}
const hold = stockPromotionExcelSheet(items, products, reference, {...options, metric:'hold'});
assert.equal(hold.rows.slice(7,9).length, 2);
assert.deepEqual(hold.rows.slice(7,9).map(row=>row.values[3]), [4,4]);
assert.equal(hold.rows.find(row=>row.values[0]==='TORANI Sandal').values[5],1500);
const unknown = stockPromotionExcelSheet(items, products, {}, options);
assert.equal(unknown.rows[7].values[4], '[ต้องถามเจ้าของ]');
assert.equal(unknown.rows[3].values[0], '');
const empty = stockPromotionExcelSheet([], [], reference, options);
assert.equal(empty.table, undefined);
const xml = new TextDecoder().decode(stockPromotionExcelWorkbook(items, products, reference, options));
assert.match(xml, /name="คิดโปรโมชั่น"/);
assert.match(xml, /sqref="H8:H11"/);
assert.match(xml, /calcMode="auto"/);
assert.match(xml, /name="VingStockSummary"[^>]+ref="A7:Q11"/);
assert.match(xml, /<c r="H2" s="25"><v>1000<\/v>/);
assert.equal(JSON.stringify({items, products, reference}), before, 'leave branch data and reference untouched');
console.log('PASS: branch-only model aggregation, metric/grade filters, aliases, missing finance/history, shared formula parity, scenario totals and XLSX layout.');
