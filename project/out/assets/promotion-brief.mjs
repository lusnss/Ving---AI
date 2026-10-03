import {promotionScheduleText} from './promotion-schedule.mjs';
import {escapeHtml as esc} from './api.mjs';
import {promotionChannels, promotionTotals, promotionUnitFinance, allocatePromotionLine, groupPromotionDiscounts,promotionDiscountPercent} from './promotion-model.mjs';
import {reportExcelWorkbook, downloadExcelWorkbook} from './event-excel.mjs';

const number = value => Number(value || 0).toLocaleString('th-TH', {maximumFractionDigits: 0});
const money = value => Number.isFinite(value) ? value.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—';
const percent = value => Number.isFinite(value) ? value.toLocaleString('th-TH', {maximumFractionDigits: 1}) + '%' : '—';
const ratio = value => Number.isFinite(value) ? value / 100 : null;
const sizes = line => (line.sizes || [line.size].filter(Boolean)).join(', ') || 'ไม่ระบุไซซ์';
const timestamp = value => value ? new Date(value).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'}) : 'ตัวอย่างก่อนบันทึก';
const period = brief => brief.forecast?.period ? `${brief.forecast.period.start} – ${brief.forecast.period.end}` : 'ยังไม่มีข้อมูล DOH';
const month = value => new Date(value + '-01T00:00:00+07:00').toLocaleDateString('th-TH', {month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok'});
const isApproved = brief => brief.approval === 'approved' || brief.status === 'approved';
const approvalNote = brief => isApproved(brief) ? 'อนุมัติราคาและส่วนลดแล้ว · ไม่กันสต็อก' : 'ข้อเสนอเท่านั้น · ยังไม่อนุมัติราคาและไม่กันสต็อก';
const conditionsText = brief => typeof brief.conditions === 'string' ? brief.conditions.trim() : '';
const conditionsCalculationNote = 'ราคาและ GP คำนวณจากราคาขายหรือส่วนลดรายรุ่น ยังไม่รวมเงื่อนไขหรือของแถมด้านบน';
const kind = line => (line.noSales ? 'เฉพาะไซซ์ไม่พบขาย' : 'รายรุ่น')+(line.pricingMode==='price'?' · ราคาขายคงที่':'');
const pricingText = line => line.pricingMode==='price'?'ราคาขาย ฿'+money(line.salePrice):percent(line.discount);
function priceBounds(line) {
  const prices = allocatePromotionLine(line).map(row => promotionUnitFinance(row).after).filter(Number.isFinite);
  return prices.length ? [Math.min(...prices), Math.max(...prices)] : [null, null];
}
function priceText(line) {
  const [min, max] = priceBounds(line);
  return min === null ? '[ต้องถามเจ้าของ]' : '฿' + money(min) + (min === max ? '' : '–' + money(max));
}
function completeness(total) {
  return [total.missing || total.missingCost ? 'ยอดและ GP รวมเฉพาะข้อมูลครบ · รายการที่ขาด [ต้องถามเจ้าของ]' : 'ราคาขายและต้นทุนครบ', total.missingFullPrice?'ราคาเต็มไม่ครบ จึงยังเทียบส่วนลดรวมไม่ได้ [ต้องถามเจ้าของ]':''].filter(Boolean).join(' · ');
}
function methodNotes(brief, total) {
  return [
    `Stock + DOH: ${period(brief)} · ส่วนลดตามข้อเสนอ · ไซซ์ไม่พบขายแยกเมื่อประวัติครบ`,
    'จำนวนกระจายตามสัดส่วนสต็อก · ต้นทุนรวม VAT เฉลี่ยต่ำสุด–สูงสุด · ยังไม่หักค่าใช้จ่ายอื่น',
    'GP% = (ยอดหลังลด − ต้นทุน) ÷ ยอดหลังลด · หลังห้างหักใช้ยอดรับสุทธิแทนยอดหลังลด',
    completeness(total)
  ];
}

export function renderPromotionBrief(brief, {canEdit = false} = {}) {
  const total = promotionTotals(brief.lines, brief.gp), groups = groupPromotionDiscounts(brief.lines);
  const count = new Set(brief.lines.map(line => line.model)).size;
  const department = promotionChannels[brief.channel].family === 'department';
  return `<section class="pm-brief" aria-label="สรุปโปรโมชั่นหน้าเดียว">
    <header class="pm-brief-header"><div><p class="pm-eyebrow">PROMOTION BRIEF / ${month(brief.month)}</p><h2>${esc(brief.name)}</h2><p>${esc(promotionChannels[brief.channel].label)} · ${esc(brief.branchName || 'ภาพรวมประเภท')} · ${esc(promotionScheduleText(brief))}</p></div><div class="pm-brief-tools"><button type="button" class="pm-button pm-primary" data-promo-control data-export="brief">Export Excel ↗</button><button type="button" class="pm-brief-close" data-promo-control data-close aria-label="ปิด">×</button></div></header>
    <div class="pm-brief-kpis"><div><span>รุ่นที่ร่วมโปร</span><strong>${number(count)} <small>รุ่น / ${number(total.qty)} หน่วย</small></strong></div><div><span>ยอดขายตามโปรโมชั่น</span><strong>฿${money(total.net)}</strong></div><div><span>ส่วนลดรวม</span><strong>฿${money(total.discount)}</strong></div><div><span>GP% หลังลด</span><strong class="${total.grossMargin < 0 ? 'pm-risk' : ''}">${percent(total.grossMargin)} <small>กำไร ฿${money(total.profit)}</small></strong></div></div>
    <div class="pm-brief-content" tabindex="0" role="region" aria-label="รายละเอียดสรุปโปรโมชั่น">
      ${conditionsText(brief) ? `<section class="pm-brief-conditions" aria-label="เงื่อนไขโปรโมชั่น / ของแถม"><h3>เงื่อนไขโปรโมชั่น / ของแถม</h3><p>${esc(conditionsText(brief))}</p><small>${conditionsCalculationNote}</small></section>` : ''}
      <section class="pm-brief-discounts" aria-label="สรุปโปรโมชั่น"><div class="pm-brief-groups-wrap"><table class="pm-brief-groups"><thead><tr><th scope="col">โปรโมชั่น</th><th scope="col">จำนวนรุ่น</th><th scope="col">รุ่น</th></tr></thead><tbody>${groups.map(group => `<tr><th scope="row"><b>${pricingText(group)}</b></th><td><strong>${number(group.models.length)}</strong> รุ่น</td><td><ul>${group.models.map(model => `<li><span>${esc(model.name)}</span>${model.grades.length ? `<small> (${esc(model.grades.join(', '))})</small>` : ''}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table></div></section>
      <p class="pm-brief-count-note">นับชื่อรุ่นไม่ซ้ำในแต่ละโปรโมชั่น${groups.reduce((n, g) => n + g.models.length, 0) > count ? ' · รุ่นเดียวอยู่ได้หลายกลุ่มเมื่อเกรดหรือไซซ์ใช้ราคาต่างกัน' : ''}</p>
      <details class="pm-brief-more"><summary><span>ดูรายละเอียดเพิ่มเติม</span><small>รายรุ่น / ไซซ์ / ราคา / GP</small></summary><div class="pm-brief-more-body">
      <div class="pm-brief-section-title"><h3>รายละเอียดรายรุ่นและไซซ์</h3><span>${number(brief.lines.length)} รายการ · มูลค่าเมื่อขายครบ</span></div>
      <div class="pm-table-wrap pm-brief-table-wrap" tabindex="0" role="region" aria-label="ตารางโปรโมชั่น"><table class="pm-brief-table"><thead><tr><th scope="col">รุ่น / เกรด / ไซซ์</th><th scope="col">จำนวน</th><th scope="col">โปรโมชั่น</th><th scope="col">ราคาขาย / หน่วย</th><th scope="col">ยอดหลังลด</th><th scope="col">GP% หลังลด</th></tr></thead><tbody>${brief.lines.map(line => {const t = promotionTotals([line], brief.gp); return `<tr><th scope="row"><strong>${esc(line.model)} <span>· ${esc(line.grade || '—')}</span></strong><small>${line.noSales ? 'เฉพาะไซซ์ไม่พบขาย · ' : ''}${esc(sizes(line))}</small></th><td>${number(line.qty)}</td><td>${pricingText(line)}</td><td>${priceText(line)}</td><td>฿${money(t.net)}</td><td class="${t.grossMargin < 0 ? 'pm-risk' : ''}">${percent(t.grossMargin)}</td></tr>`;}).join('')}</tbody><tfoot><tr><th scope="row">รวม ${number(count)} รุ่น</th><td>${number(total.qty)}</td><td>—</td><td>รวมหลังส่วนลด</td><td>฿${money(total.net)}</td><td>${percent(total.grossMargin)}</td></tr></tfoot></table></div>
      ${department ? `<div class="pm-brief-settlement"><span>GP ที่ห้างหัก <b>${brief.gp === null ? '[ต้องถามเจ้าของ]' : percent(brief.gp)}</b></span><span>รับสุทธิ <b>฿${money(total.afterGp)}</b></span><span>GP% หลังห้างหัก <b>${percent(total.marginAfterGp)}</b></span></div>` : ''}
      <div class="pm-brief-notes">${methodNotes(brief, total).map(note => `<p>${esc(note)}</p>`).join('')}${groups.reduce((n, g) => n + g.models.length, 0) > count ? '<p>นับรุ่นไม่ซ้ำต่อโปรโมชั่น · รุ่นเดียวอาจอยู่หลายกลุ่มเมื่อเกรดหรือไซซ์ใช้ราคาต่างกัน</p>' : ''}</div>
      </div></details>
    </div>
    <footer class="pm-brief-footer"><p><b>${brief.updatedAt || brief.createdAt ? (brief.updatedAt ? 'แก้ไขล่าสุด · ' : 'บันทึกแล้ว · ') + esc(timestamp(brief.updatedAt || brief.createdAt)) : 'ตัวอย่างก่อนบันทึก'}</b><span>${approvalNote(brief)}</span></p><div class="pm-brief-footer-actions">${brief.id ? '<button type="button" class="pm-button pm-outline" data-promo-control data-action="saved-back">← ข้อเสนอที่บันทึก</button>' : ''}${!brief.id || canEdit ? '<button type="button" class="pm-button pm-primary" data-promo-control data-action="edit-brief">แก้ไขโปรโมชั่น ↗</button>' : ''}</div></footer>
  </section>`;
}

export function promotionBriefSheets(brief) {
  const total = promotionTotals(brief.lines, brief.gp), department = promotionChannels[brief.channel].family === 'department';
  const row = (values, options = {}) => ({values, ...options});
  const title = text => row([text], {kind: 'title', merge: 8, height: 34});
  const note = text => row([text], {merge: 8, height: 28});
  const header = values => row(values, {kind: 'header', height: 32});
  const summary = [title(brief.name), note(`${month(brief.month)} · ${promotionChannels[brief.channel].label} · ${brief.branchName || 'ภาพรวมประเภท'}`),
    header(['รุ่นร่วมโปร', 'จำนวน (หน่วย)', 'ยอดก่อนลด', 'ส่วนลดรวม', 'ยอดหลังลด', 'ต้นทุนที่จับคู่ได้', 'กำไร', 'GP% หลังลด']),
    row([new Set(brief.lines.map(line => line.model)).size, total.qty, total.gross, total.discount, total.net, total.cost, total.profit, ratio(total.grossMargin)], {kind: 'total', decimalColumns: [2,3,4,5,6], percentColumns: [7]})];
  if (department) summary.push(header(['GP ที่ห้างหัก', 'รับสุทธิหลังห้างหัก', 'กำไรหลังห้างหัก', 'GP% หลังห้างหัก']), row([ratio(brief.gp), total.afterGp, total.profitAfterGp, ratio(total.marginAfterGp)], {percentColumns: [0,3], decimalColumns: [1,2]}));
  if (conditionsText(brief)) {
    summary.push(header(['เงื่อนไขโปรโมชั่น / ของแถม']));
    for (const text of conditionsText(brief).split(/\r?\n/)) {
      for (const part of text.match(/.{1,85}/gu) || ['']) summary.push(note(part));
    }
    summary.push(note(conditionsCalculationNote));
  }
  summary.push(header(['โปรโมชั่น', 'จำนวนรุ่น', 'รุ่น']));
  for (const group of groupPromotionDiscounts(brief.lines)) {
    const names = group.models.map(model => `${model.name}${model.grades.length ? ' (' + model.grades.join(', ') + ')' : ''}`).join(' · ');
    summary.push(row([group.pricingMode==='price'?pricingText(group):ratio(group.discount), group.models.length, names], {percentColumns: group.pricingMode==='price'?[]:[0], merges: [{start: 2, end: 7}], height: Math.max(28, Math.ceil(names.length / 85) * 18)}));
  }
  summary.push(note('นับชื่อรุ่นไม่ซ้ำในแต่ละโปรโมชั่น · รุ่นเดียวอาจอยู่หลายกลุ่มเมื่อเกรดหรือไซซ์ใช้ราคาต่างกัน'));
  summary.push(note(promotionScheduleText(brief)),...methodNotes(brief, total).map(note), note(`สถานะ: ${isApproved(brief) ? 'อนุมัติแล้ว' : brief.status === 'draft' ? 'ร่าง' : brief.id ? 'เสนอเพื่อพิจารณา' : 'ตัวอย่างก่อนบันทึก'} · ${timestamp(brief.updatedAt || brief.createdAt)} · ${approvalNote(brief)}`));
  const models = [header(['รุ่น', 'เกรด', 'ไซซ์ร่วมโปร', 'รูปแบบ', 'จำนวนเสนอ', 'ส่วนลด', 'ราคาขายต่ำสุด', 'ราคาขายสูงสุด', 'ยอดก่อนลด', 'ส่วนลดรวม', 'ยอดหลังลด', 'ต้นทุนที่จับคู่ได้', 'กำไร', 'GP% หลังลด', 'GP ห้าง', 'รับสุทธิหลังห้างหัก', 'GP% หลังห้างหัก', 'DOH (วัน)', 'ข้อมูลที่ขาด'])];
  const details = [header(['รุ่น', 'เกรด', 'สี', 'ไซซ์', 'รูปแบบ', 'สต็อกพร้อมขาย', 'จำนวนจัดสรร', 'ราคาเต็ม / หน่วย', 'ต้นทุน / หน่วย', 'ส่วนลด', 'ราคาขาย / หน่วย', 'ยอดหลังลด', 'กำไร', 'GP% หลังลด', 'รับสุทธิหลังห้างหัก', 'GP% หลังห้างหัก', 'ข้อมูลที่ขาด'])];
  for (const line of brief.lines) {
    const t = promotionTotals([line], brief.gp), [min, max] = priceBounds(line);
    models.push(row([line.model, line.grade, sizes(line), kind(line), line.qty, line.pricingMode==='price'?null:ratio(line.discount), min, max, t.gross, t.discount, t.net, t.cost, t.profit, ratio(t.grossMargin), ratio(brief.gp), t.afterGp, ratio(t.marginAfterGp), line.doh ?? (line.noSales ? 'ไม่พบขาย' : 'ประเมินไม่ได้'), completeness(t)], {percentColumns: [5,13,14,16], decimalColumns: [6,7,8,9,10,11,12,15,17], height: 36}));
    for (const item of allocatePromotionLine(line)) {
      const finance = promotionUnitFinance(item, brief.gp), t = promotionTotals([item], brief.gp);
      details.push(row([line.model, line.grade, item.color, item.size, kind(line), item.available, item.qty, finance.price, finance.cost, ratio(promotionDiscountPercent(item)), finance.after, finance.after === null ? null : t.net, t.profit, ratio(t.grossMargin), finance.after === null ? null : t.afterGp, ratio(t.marginAfterGp), completeness(t)], {percentColumns: [9,13,15], decimalColumns: [7,8,10,11,12,14], height: 30}));
    }
  }
  return [
    {name: 'สรุปโปรโมชั่น', widths: [25,14,28,16,18,24,20,18], rows: summary, fitToHeight: 1},
    {name: 'รายละเอียดรายรุ่น', widths: [25,10,30,23,15,13,21,21,20,20,20,22,20,18,14,24,22,18,50], rows: models, freezeRows: 1, freezeCols: 2, filterRow: 1},
    {name: 'รายละเอียดสีและไซซ์', widths: [25,10,20,12,23,18,17,21,21,13,22,20,20,18,24,22,50], rows: details, freezeRows: 1, freezeCols: 2, filterRow: 1}
  ];
}
export function promotionBriefWorkbook(brief) { return reportExcelWorkbook(promotionBriefSheets(brief)); }
export function downloadPromotionBriefExcel(brief) {
  downloadExcelWorkbook(promotionBriefWorkbook(brief), `VING-Promotion-${brief.month}-${brief.channel}.xlsx`);
}
