import {reportExcelWorkbook, downloadExcelWorkbook} from './event-excel.mjs';
import {withStockSalesScenario} from './stock-summary-scenario.mjs';
import {summaryViews, summarySorts, summaryPriceColumn, summaryPriceLabel, summaryCostColumn, summaryCostLabel, summaryUnitEconomics, hasSummarySelection, summaryFilterText, summaryExcelHiddenColumns} from './stock-summary-view.mjs';
const quantity = value => Number.isFinite(value) ? value : '—';
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'}) : 'ไม่ระบุเวลา';
export const stockFinanceHeaders = ['รุ่น', 'เกรด', 'สี', 'ไซซ์', summaryCostColumn, summaryPriceColumn, 'GP%', 'ส่วนลดโปรโมชั่น (%) · กรอกเอง', 'ราคาขายหลังส่วนลด (บาท/หน่วย)', 'GP% หลังส่วนลด', 'กำไรหลังส่วนลด (บาท/หน่วย)', 'จำนวนในคลัง Scalup', 'จำนวนในคลัง Pivot', 'จำนวนรวมพร้อมขาย', 'ต้นทุนอ้างอิง'];

// Only application-owned formulas enter the writer; all imported values stay literal.
export function stockFinanceFormulas(r) {
  return {
    6: `IF(AND(ISNUMBER(E${r}),ISNUMBER(F${r}),E${r}>=0,F${r}>0),(F${r}-E${r})/F${r},"")`,
    8: `IF(AND(ISNUMBER(F${r}),F${r}>=0,OR(H${r}="",AND(ISNUMBER(H${r}),H${r}>=0,H${r}<=1))),ROUND(F${r}*(1-IF(H${r}="",0,H${r})),2),"")`,
    9: `IF(AND(ISNUMBER(E${r}),E${r}>=0,ISNUMBER(I${r}),I${r}>0),(I${r}-E${r})/I${r},"")`,
    10: `IF(AND(ISNUMBER(E${r}),E${r}>=0,ISNUMBER(I${r}),I${r}>=0),ROUND(I${r}-E${r},2),"")`
  };
}
export function stockSummaryExcelSheet(report, viewKey, state = {}, presentation = {}) {
  const view = summaryViews.find(view => view.key === viewKey);
  if (!view) throw Error('ไม่พบตารางที่ต้องการส่งออก');
  // Export order is independent of the on-screen sort; never mutate the loaded report.
  if (viewKey === 'models') report = {...report, models: [...report.models].sort((a,b) =>
    (Number.isFinite(b.total) ? b.total : -Infinity) - (Number.isFinite(a.total) ? a.total : -Infinity)
    || String(a.model).localeCompare(String(b.model), 'th'))};
  // Table 1 puts warehouse quantities first; all views share finance columns E–K.
  const columns = viewKey === 'models' ? [0, 11, 12, 13, 4, 5, 6, 7, 8, 9, 10] : stockFinanceHeaders.map((_, index) => index);
  const project = values => columns.map(index => values[index]);
  const headers = [...stockFinanceHeaders];
  if (presentation.quantityHeaders) headers.splice(11, 3, ...presentation.quantityHeaders);
  const width = columns.length;
  const row = (values, kind = 'body', extra = {}) => ({values, kind, ...extra});
  const intro = (value, kind = 'body', height = 32) => row([value], kind, {merge: width, height});
  const totals = [hasSummarySelection(state) ? 'รวมตามตัวกรอง' : 'รวมทั้งหมด', ...Array(10).fill(''), ...['scaleup', 'pivot', 'total'].map(field => quantity(report.totals[field])), ''];
  const cost = report.sources.cost || {};
  const sheet = {
    name: presentation.name || {models: 'สรุปตามรุ่น', grades: 'รุ่นและเกรด', variants: 'รุ่น เกรด สี ไซซ์'}[viewKey],
    widths: project([38, 12, 26, 16, 30, 28, 16, 24, 28, 20, 28, 24, 24, 26, 42]),
    freezeRows: 7, freezeCols: 4,
    hiddenColumns: summaryExcelHiddenColumns(view, state).map(index => columns.indexOf(index)).filter(index => index >= 0),
    validations: report[viewKey].length ? [{range: `H8:H${7 + report[viewKey].length}`, type: 'decimal', operator: 'between', formula1: '0', formula2: '1', promptTitle: 'ส่วนลดโปรโมชั่น', prompt: 'กรอกเปอร์เซ็นต์ เช่น 20% · ว่าง = ไม่ลด', errorTitle: 'ส่วนลดไม่ถูกต้อง', error: 'กรอกส่วนลดตั้งแต่ 0% ถึง 100% เช่น 20%'}] : [],
    rows: [
      intro('VING | ' + (presentation.title || view.title), 'title', 38),
      intro('ตัวกรอง: ' + (presentation.scope || summaryFilterText(state)) + ' · เรียงตาม: ' + (presentation.sortLabel || (viewKey === 'models' ? summarySorts['total-desc'] : summarySorts[state.sort] || summarySorts.name)), 'body', 42),
      intro(presentation.source || ('Scalup: ' + (report.sources.scaleup.ready ? stamp(report.sources.scaleup.updatedAt) : 'ยังอ่านข้อมูลไม่ได้') + ' · Pivot: ' + (report.sources.pivot.ready ? stamp(report.sources.pivot.updatedAt) : 'ยังอ่านข้อมูลไม่ได้') + ' · ราคาเต็ม: ' + (report.sources.pivot.file || 'Pivot')), 'body', 42),
      intro('ต้นทุนรวม VAT: ' + (cost.file || '[ต้องถามเจ้าของ]') + ' · ' + (cost.sheet || '') + ' · ' + stamp(cost.fetched_at) + (cost.status === 'stale' ? ' · ข้อมูลที่บันทึกไว้ล่าสุด' : '') + (cost.url ? ' · ' + cost.url : ''), 'body', 44),
      intro('กรอก H เป็นส่วนลด เช่น 20% · ว่าง = ไม่ลด · I = ราคาขายหลังส่วนลด · J = (I − ต้นทุน) ÷ I · K = I − ต้นทุน (บาท/หน่วย ก่อนค่าใช้จ่ายอื่น)', 'stripe', 42),
      intro('ต้นทุน = ค่าเฉลี่ยของค่าต่ำสุดและค่าสูงสุดในแต่ละรายการ · GP คำนวณจากตัวเลขที่แสดง · คอลัมน์ที่ซ่อนตามหน้าจอยังคงข้อมูลและสูตรเดิม', 'stripe', 42),
      row(project(headers), 'header', {height: 48}),
      ...report[viewKey].map((item, index) => {
        const {cost, price, gp} = summaryUnitEconomics(item);
        const salePrice = price !== null ? Math.round(price * 100) / 100 : null;
        const discountedGp = cost !== null && salePrice > 0 ? (salePrice - cost) / salePrice : '';
        const profit = cost !== null && salePrice !== null ? Math.round((salePrice - cost) * 100) / 100 : '';
        return row(project([
          ...['model', 'grade', 'color', 'size'].map(field => String(item[field] ?? '')),
          cost ?? summaryCostLabel(item), price ?? summaryPriceLabel(item), gp ?? '', '', salePrice ?? '', discountedGp, profit,
          ...['scaleup', 'pivot', 'total'].map(field => quantity(item[field])),
          (item.costRows?.length ? 'ชีตต้นทุนสินค้า · แถว ' + item.costRows.join(', ') : '[ต้องถามเจ้าของ]')
        ]), index % 2 ? 'stripe' : 'body', {
          totalColumn: columns.indexOf(13), decimalColumns: [4, 5, 8, 10], percentColumns: [6, 7, 9], inputColumns: [7], formulas: stockFinanceFormulas(index + 8)
        });
      }),
      row(project(totals), 'total', {height: 34})
    ]
  };
  return viewKey === 'models' ? withStockSalesScenario(sheet,report,state) : sheet;
}
export function stockSummaryExcelWorkbook(report, viewKey, state) {
  return reportExcelWorkbook([stockSummaryExcelSheet(report, viewKey, state)]);
}
export function downloadStockSummaryExcel(report, viewKey, state) {
  const date = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Bangkok'});
  downloadExcelWorkbook(stockSummaryExcelWorkbook(report, viewKey, state), `VING-Stock-Summary-${viewKey}-${date}.xlsx`);
}
