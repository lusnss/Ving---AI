import {mergeSummaryPrices, mergeSummaryCosts} from './stock-summary-model.mjs';
export const summaryColumns = {model: 'รุ่น', grade: 'เกรด', color: 'สี', size: 'ไซซ์'};
export const summaryPriceColumn = 'ราคาเต็ม (บาท/หน่วย)';
export const summaryCostColumn = 'ต้นทุนรวม VAT (บาท/หน่วย)';
export function summaryAverageCost(row) {
  if (!Number.isFinite(row.unitCostMin) || !Number.isFinite(row.unitCostMax)) return null;
  // Average the displayed range endpoints, with one consistent cent rounding.
  return Math.round((Math.round(row.unitCostMin * 100) + Math.round(row.unitCostMax * 100)) / 2) / 100;
}
export function summaryCostLabel(row) {
  const cost = summaryAverageCost(row);
  return cost === null ? '[ต้องถามเจ้าของ]' : cost.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
export function summaryUnitEconomics(row) {
  const cost = summaryAverageCost(row);
  const price = Number.isFinite(row.fullPriceMin) && row.fullPriceMin === row.fullPriceMax ? row.fullPriceMin : null;
  return {cost, price, gp: cost !== null && price > 0 ? (price - cost) / price : null};
}
export const summaryGpLabel = row => {
  const gp = summaryUnitEconomics(row).gp;
  return gp === null ? '—' : gp.toLocaleString('th-TH', {style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2});
};
export function summaryPriceLabel(row) {
  if (!Number.isFinite(row.fullPriceMin) || !Number.isFinite(row.fullPriceMax)) return '[ต้องถามเจ้าของ]';
  const number = value => value.toLocaleString('th-TH', {maximumFractionDigits: 2});
  const price = row.fullPriceMin === row.fullPriceMax ? number(row.fullPriceMin) : `${number(row.fullPriceMin)}–${number(row.fullPriceMax)}`;
  return price;
}
export const summaryViews = [
  {key: 'models', id: 'stock-models', number: '01', title: 'สรุปรวมตามรุ่น', fields: ['model'], unit: 'รุ่น'},
  {key: 'grades', id: 'stock-grades', number: '02', title: 'แยกตามรุ่นและเกรด', fields: ['model', 'grade'], unit: 'รายการ'},
  {key: 'variants', id: 'stock-variants', number: '03', title: 'แยกตามรุ่น เกรด สี และไซซ์', fields: ['model', 'grade', 'color', 'size'], unit: 'รายการ'}
];
export function summaryTableColumns(view) {
  return [...view.fields.map(key => ({key, label: summaryColumns[key]})),
    {key: 'cost', label: summaryCostColumn}, {key: 'price', label: summaryPriceColumn}, {key: 'gp', label: 'GP%'},
    {key: 'scaleup', label: 'จำนวนในคลัง Scalup'}, {key: 'pivot', label: 'จำนวนในคลัง Pivot'}, {key: 'total', label: 'จำนวนรวมพร้อมขาย'}];
}
export function visibleSummaryColumns(view, state = {}) {
  const hidden = new Set(Array.isArray(state.hiddenColumns) ? state.hiddenColumns : []);
  return summaryTableColumns(view).filter(column => column.key === 'model' || !hidden.has(column.key));
}
export function summaryExcelHiddenColumns(view, state = {}) {
  const indices = {model: 0, grade: 1, color: 2, size: 3, cost: 4, price: 5, gp: 6, scaleup: 11, pivot: 12, total: 13};
  const visible = new Set(visibleSummaryColumns(view, state).map(column => column.key));
  return summaryTableColumns(view).filter(column => !visible.has(column.key)).map(column => indices[column.key]);
}
export const summarySorts = {
  name: 'ชื่อรุ่น A–Z',
  'total-desc': 'รวมพร้อมขาย · มากไปน้อย',
  'total-asc': 'รวมพร้อมขาย · น้อยไปมาก',
  'scaleup-desc': 'Scalup · มากไปน้อย',
  'scaleup-asc': 'Scalup · น้อยไปมาก',
  'pivot-desc': 'Pivot · มากไปน้อย',
  'pivot-asc': 'Pivot · น้อยไปมาก'
};
const normalized = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s_-]+/g, '');
const compare = (a, b) => ['model', 'grade', 'color', 'size'].reduce((result, field) =>
  result || String(a[field] || '').localeCompare(String(b[field] || ''), 'th', {numeric: true, sensitivity: 'base'}), 0);

export function hasSummarySelection(state = {}) {
  return ['query', 'model', 'grade', 'color', 'size'].some(field => String(state[field] || '').trim());
}
export function summaryFilterText(state = {}) {
  return ['query', 'model', 'grade', 'color', 'size'].filter(field => String(state[field] || '').trim())
    .map(field => `${field === 'query' ? 'ค้นหา' : summaryColumns[field]}: ${String(state[field]).trim()}`).join(' · ') || 'ทั้งหมด';
}
export function filteredStockSummary(report, {query = '', sort = 'name', ...selection} = {}) {
  const terms = query.trim().split(/\s+/).map(normalized).filter(Boolean);
  const variants = report.variants.filter(row => {
    const haystack = normalized([row.model, row.grade, row.color, row.size].join(' '));
    return terms.every(term => haystack.includes(term)) && ['model', 'grade', 'color', 'size'].every(field =>
      !selection[field] || normalized(row[field]) === normalized(selection[field]));
  });
  const totals = rows => Object.fromEntries(['scaleup', 'pivot', 'total'].map(field => [field,
    (field === 'total' ? report.sources.scaleup.ready && report.sources.pivot.ready : report.sources[field].ready)
      ? rows.reduce((sum, row) => sum + row[field], 0) : null
  ]));
  const group = fields => {
    const groups = new Map();
    for (const row of variants) {
      const id = JSON.stringify(fields.map(field => normalized(row[field])));
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(row);
    }
    return [...groups.values()].map(rows => ({...Object.fromEntries(fields.map(field => [field, rows[0][field]])), ...totals(rows), ...mergeSummaryPrices(rows), ...mergeSummaryCosts(rows)}));
  };
  const output = {...report, variants, models: group(['model']), grades: group(['model', 'grade']), totals: totals(variants)};
  const [field, direction] = (Object.hasOwn(summarySorts, sort) ? sort : 'name').split('-');
  for (const view of summaryViews) output[view.key].sort((a, b) => {
    if (field === 'name') return compare(a, b);
    // Missing source quantities always sort after known quantities, including zero.
    if (!Number.isFinite(a[field]) || !Number.isFinite(b[field])) {
      return Number(Number.isFinite(b[field])) - Number(Number.isFinite(a[field])) || compare(a, b);
    }
    return (a[field] - b[field]) * (direction === 'desc' ? -1 : 1) || compare(a, b);
  });
  return output;
}

export function stockDashboardModels(report) {
  const ready = report.sources.scaleup.ready && report.sources.pivot.ready;
  const gradeOrder = ['A', 'B+', 'B', 'C', 'D'];
  const sizes = values => [...new Set(values)].sort((a, b) => {
    const rank = value => ({XS: 1, S: 2, M: 3, L: 4, XL: 5, '2XL': 6, '3XL': 7})[value.toUpperCase()] || 100;
    return rank(a) - rank(b) || a.localeCompare(b, 'th', {numeric: true});
  });
  return report.models.map(model => ({...model, grades: report.grades.filter(row => row.model === model.model)
    .sort((a, b) => (gradeOrder.indexOf(a.grade) < 0 ? 99 : gradeOrder.indexOf(a.grade)) - (gradeOrder.indexOf(b.grade) < 0 ? 99 : gradeOrder.indexOf(b.grade)))
    .map(grade => {
      const rows = report.variants.filter(row => row.model === model.model && row.grade === grade.grade);
      const orderedSizes = sizes(rows.map(row => row.size));
      const colors = [...new Set(rows.map(row => row.color))].sort((a, b) => a.localeCompare(b, 'th'));
      return {...grade, sizes: orderedSizes, colors: colors.map(color => {
        const cells = orderedSizes.map(size => ready ? rows.find(row => row.color === color && row.size === size)?.total || 0 : null);
        return {color, cells, total: ready ? cells.reduce((sum, n) => sum + n, 0) : null};
      }), sizeTotals: orderedSizes.map(size => ready ? rows.filter(row => row.size === size).reduce((sum, row) => sum + row.total, 0) : null)};
    })}));
}
