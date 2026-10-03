import {prepareReportPeriod, periodSalesDatesText} from './sales-channels.mjs';

const timeZone = 'Asia/Bangkok';
const dayLabel = value => new Date(value + 'T12:00:00+07:00').toLocaleDateString('th-TH', {timeZone, day:'numeric', month:'short', year:'numeric'});
const stampLabel = value => new Date(value).toLocaleString('th-TH', {timeZone});

export function reportSourceTimestamp(report, period, key) {
  if (!period) return report?.source?.fetched_at;
  return period.source?.fetched_at || (report?.source?.as_of_date?.startsWith(key + '-') ? report.source.fetched_at : null);
}

// Transport timestamps do not establish that the source workbook was read.
export function salesFreshnessText(snapshot, now = Date.now()) {
  const report = snapshot.data?.['/api/daily-sales'];
  const today = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const yesterday = new Date(now + 7 * 3600000 - 86400000).toISOString().slice(0, 10);
  const latest = Object.entries(report?.periods || {}).map(([key, period]) => prepareReportPeriod({...period, key},today))
    .filter(period => period.latest_date && period.latest_date <= today &&
      period.branches?.some(branch => Number.isFinite(branch.daily_sales?.[period.latest_date])))
    .sort((a, b) => b.latest_date.localeCompare(a.latest_date))[0];
  const direct = snapshot.salesSync?.mode === 'online';
  const cloud = ['cloud','online'].includes(snapshot.salesSync?.mode) && snapshot.salesSync.periodKeys?.includes(latest?.key);
  const importedAt = reportSourceTimestamp(report, latest, latest?.key);
  const parts = ['ดูอย่างเดียว'];
  const live=snapshot.salesOnline;
  const messages={setup_required:'ยังไม่ได้เชื่อม Excel อัตโนมัติ',not_connected:'รออนุญาตเชื่อม Microsoft',waiting:'กำลังอ่าน Excel ออนไลน์ครั้งแรก',online:'Excel ออนไลน์ · ตรวจยอดทุก 1 นาที',reconnect_required:'ต้องเชื่อม Microsoft ใหม่ · ใช้ยอดล่าสุดที่มี',access_required:'ไม่มีสิทธิ์อ่าน Excel · ใช้ยอดล่าสุดที่มี',throttled:'Microsoft ให้รอ · ใช้ยอดล่าสุดที่มี',stale:'อ่าน Excel ล่าสุดไม่ได้ · ใช้ยอดล่าสุดที่มี'};
  parts.push(snapshot.syncUnavailable ? 'เชื่อมข้อมูลล่าสุดไม่ได้' : live ? messages[live.status]||messages.stale : cloud ? 'รับข้อมูลจาก Excel ออนไลน์' : 'ยังไม่ได้เชื่อม Excel ออนไลน์');
  if (latest) {
    parts.push(periodSalesDatesText(latest,dayLabel).replace('ยอดสะสมถึง ','ยอดถึง '));
    const branchDate=latest.branch_latest_date;
    if (branchDate && branchDate < yesterday) parts.push('รอยอดสาขา ' + dayLabel(yesterday));
    else if (!branchDate && latest.latest_date < yesterday) parts.push('รอยอด ' + dayLabel(yesterday));
  } else parts.push('ยังไม่มีข้อมูลรายวัน');
  if (Number.isFinite(Date.parse(importedAt))) parts.push((cloud ? 'อ่านต้นทางล่าสุด ' : 'นำเข้าล่าสุด ') + stampLabel(importedAt));
  if (direct && live?.status==='online') parts.push('อัปเดตหน้าเว็บอัตโนมัติ');
  return parts.join(' · ');
}
