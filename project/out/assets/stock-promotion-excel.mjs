import {stockGridIdentity} from './stock-grid.mjs';
import {stockSummaryExcelSheet} from './stock-summary-excel.mjs';
import {reportExcelWorkbook, downloadExcelWorkbook} from './event-excel.mjs';

const key = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s_-]+/g, '');
const metrics = {normal: 'สต็อกปกติ', hold: 'On-Hold', total: 'รวมทั้งหมด'};
const grades = {normal: 'สินค้าปกติ', grade_b_plus: 'Grade B+', grade_b: 'Grade B'};
const summaryGrades = {normal: 'A', grade_b_plus: 'B+', grade_b: 'B'};
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'}) : 'ไม่ระบุเวลา';

export function branchPromotionReport(items, products = [], reference = {}, options = {}) {
  const metric = Object.hasOwn(metrics, options.metric) ? options.metric : 'normal';
  const catalog = new Map(products.map(product => [product.sku, product]));
  const references = new Map((reference.models || []).map(model => [key(model.model), model]));
  const byGrade = new Map((reference.grades || []).map(row => [JSON.stringify([key(row.model), row.grade]), row]));
  const groups = new Map();
  for (const item of items) {
    const identity = stockGridIdentity(item), modelKey = key(identity.section);
    if (!groups.has(modelKey)) groups.set(modelKey, {model: identity.section, normal: 0, hold: 0, total: 0, aliases: new Set([identity.section])});
    const group = groups.get(modelKey);
    for (const field of ['normal', 'hold', 'total']) group[field] += Number.isFinite(item[field]) ? item[field] : 0;
    for (const alias of [item.model, catalog.get(item.sku)?.model]) if (alias) group.aliases.add(alias);
  }
  const models = [], history = [];
  const sales = new Map((reference.salesHistory?.models || []).map(row => [key(row.model), row]));
  for (const group of groups.values()) {
    if (group[metric] === 0) continue;
    // Prefer the same SKU model boundary as the branch grid; only use an exact,
    // unambiguous catalog alias when the summary uses a readable product name.
    const matches = [...new Set([...group.aliases].map(alias => references.get(key(alias))).filter(Boolean))];
    const matched = references.get(key(group.model)) || (matches.length === 1 ? matches[0] : null);
    const finance = summaryGrades[options.grade]
      ? byGrade.get(JSON.stringify([key(matched?.model || group.model), summaryGrades[options.grade]]))
      : matched;
    // The shared table places its three quantity slots before finance columns
    // E–K. Supply branch quantities and relabel those slots in the presentation.
    models.push({model: group.model, scaleup: group.normal, pivot: group.hold, total: group[metric],
      ...Object.fromEntries(['unitCostMin', 'unitCostMax', 'costMissing', 'costRows', 'fullPriceMin', 'fullPriceMax', 'priceMissing'].map(field => [field, finance?.[field]]))});
    const sale = sales.get(key(matched?.model || group.model));
    if (sale) history.push({...sale, model: group.model});
  }
  return {models, totals: Object.fromEntries(['scaleup', 'pivot', 'total'].map(field => [field, models.reduce((sum, row) => sum + row[field], 0)])),
    sources: reference.sources || {}, salesHistory: {...reference.salesHistory, models: history}};
}

export function stockPromotionExcelSheet(items, products = [], reference = {}, options = {}) {
  const report = branchPromotionReport(items, products, reference, options);
  const metric = Object.hasOwn(metrics, options.metric) ? options.metric : 'normal';
  const scope = [options.branchType || 'ทุกประเภท', options.branch || 'รวมทุกสาขา', grades[options.grade] || 'ทุกเกรด', options.model || 'ทุกรุ่น',
    options.query ? 'ค้นหารุ่น: ' + options.query : '', options.sourceQuery ? 'ค้นหา SKU: ' + options.sourceQuery : '', metrics[metric]].filter(Boolean).join(' · ');
  return stockSummaryExcelSheet(report, 'models', {}, {
    name: 'คิดโปรโมชั่น', title: 'สต็อกสาขา · คิดโปรโมชั่นตามรุ่น', scope,
    quantityHeaders: ['สต็อกปกติ (สาขาที่เลือก)', 'On-Hold (สาขาที่เลือก)', 'จำนวนที่เลือก · ' + metrics[metric]],
    sortLabel: 'จำนวนที่เลือก · มากไปน้อย',
    source: 'สต็อก: Check Stock App · ' + (options.branch || 'รวมทุกสาขา') + ' · ต้นทางอัปเดต ' + stamp(options.lastUpdatedAt) + ' · ดึงข้อมูล ' + stamp(options.fetchedAt) + ' · ราคาเต็ม: ' + (reference.sources?.pivot?.file || 'Pivot')
  });
}
export function stockPromotionExcelWorkbook(items, products, reference, options) {
  return reportExcelWorkbook([stockPromotionExcelSheet(items, products, reference, options)]);
}
export function downloadStockPromotionExcel(items, products, reference, options = {}) {
  const date = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Bangkok'});
  downloadExcelWorkbook(stockPromotionExcelWorkbook(items, products, reference, options), `VING-Branch-Stock-Promotion-${options.metric || 'normal'}-${date}.xlsx`);
}
