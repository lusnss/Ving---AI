import {attachApprovedSalesEvents} from './approved-sales-events.mjs';
import {analyticsMarkup, reportToolbar, wireAnalytics} from './sales-analytics.mjs';
import { escapeHtml } from './api.mjs';
import { reportSourceTimestamp } from './sales-freshness.mjs';
import { eventSchedule, eventForecast } from './event-forecast.mjs';
import { compareForecasts, comparisonKey, comparisonCounts, compareAggregateSales } from './sales-yoy.mjs';
import { confirmedBranchMapping, isLadpraoCounter } from './branch-mapping.mjs';
import {REPORT_TYPES, reportType, sourceSections, prepareReportPeriod, periodSalesDatesText} from './sales-channels.mjs';
export {reportType} from './sales-channels.mjs';

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const gapPercent = new Intl.NumberFormat('th-TH', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthsLong = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);
const monthsShort = Object.freeze(['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']);

function dateLabel(value) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00+07:00`));
}
export function weekdayLabel(value) {
  return new Intl.DateTimeFormat('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`));
}

function keyFor(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }
function thaiYear(year) { return Number(year) + 543; }
function periodLabel(period) { return `${monthsLong[period.month - 1]} ${thaiYear(period.year)}`; }
function safeNumber(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function formatMoney(value) { return money.format(safeNumber(value)); }
function targetValue(value) { return safeNumber(value) !== 0 ? formatMoney(value) : '—'; }
function gapValue(value, target) {
  if (safeNumber(target) === 0) return '—';
  return `${formatMoney(value)} (${gapPercent.format(safeNumber(value) / safeNumber(target))})`;
}


function periods(data, today = todayBangkok()) {
  const all = Object.entries(data?.periods || {})
    .map(([key, period]) => ({ key, ...period, year: Number(period.year), month: Number(period.month) }))
    .filter((period) => /^\d{4}-\d{2}$/.test(period.key) && period.year >= 2000 && period.month >= 1 && period.month <= 12 && Array.isArray(period.branches))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(period => prepareReportPeriod(period,today));
  const starts = new Map();
  for (const period of all) for (const branch of period.branches) {
    if (reportType(branch) === 'Event') continue;
    const first = Object.entries(branch.daily_sales || {}).filter(([date,value]) => date <= today && date <= (period.latest_date || today) && Number(value)>0).map(([date])=>date).sort()[0];
    const id=branchIdentity(branch);
    if (first && (!starts.has(id) || first<starts.get(id))) starts.set(id,first);
  }
  return all.map(period=>({...period,branches:period.branches.map(branch=>{
    const schedule=reportType(branch)==='Event'?eventSchedule(branch,period,data.event_catalog,today):null;
    return {...branch,first_sale_date:starts.get(branchIdentity(branch)) || null,event_schedule:schedule,event_forecast:reportType(branch)==='Event'?eventForecast(branch,period,schedule,today):null};
  })}));
}
function reportYears(allPeriods) { return [...new Set(allPeriods.map((period) => period.year))].sort((a, b) => b - a); }
function monthCoverage(scope) {
  const months = [...new Set(scope.map((period) => period.month))].sort((a, b) => a - b);
  if (!months.length) return '—';
  const contiguous = months.every((month, index) => index === 0 || month === months[index - 1] + 1);
  return contiguous && months.length > 1 ? `${monthsShort[months[0] - 1]}–${monthsShort[months.at(-1) - 1]}` : months.map((month) => monthsShort[month - 1]).join(', ');
}
function availableDates(period) {
  return (period?.dates || []).filter((date) => date <= (period.latest_date || '9999') && period.branches.some((branch) => branch.daily_sales?.[date] != null));
}
function branchIdentity(branch) {
  return [branch.type, branch.branch_code, branch.branch, branch.source_section === 'event' ? 'event' : '', branch.approved_event_key||''].map((value) => String(value || '').trim()).join('\u0001');
}
export function eventNotStarted(branch, period, today = todayBangkok()) {
  if (reportType(branch) !== 'Event') return false;
  if(branch.event_match==='matched'&&Object.entries(branch.daily_sales||{}).some(([date,value])=>date<=today&&date<=(period?.latest_date||today)&&date>=branch.event_schedule.start&&date<=branch.event_schedule.end&&value!=null&&String(value).trim()!==''&&Number.isFinite(Number(value))))return false;
  if (period?.projected) return !branch.event_started;
  if (safeNumber(branch.month_to_date) !== 0) return false;
  return !Object.entries(branch.daily_sales || {}).some(([date, value]) =>
    date <= today && date <= (period?.latest_date || today) && safeNumber(value) !== 0);
}
function selectionFor(data, state = {}, today = todayBangkok()) {
  state = resolveReportMonth(state, today);
  let allPeriods = periods(data,today);
  const current = allPeriods.find((period) => period.key === today.slice(0,7));
  if (current) for (let month = Number(today.slice(5,7)) + 1; month <= 12; month++) {
    const key = keyFor(current.year, month);
    if (!allPeriods.some((period) => period.key === key)) allPeriods.push({
      key, year:current.year, month, projected:true, dates:[], latest_date:null,
      branches:current.branches.filter(branch=>reportType(branch)!=='Event').map((branch) => ({type:branch.type, branch:branch.branch, branch_code:branch.branch_code, source_section:branch.source_section, month_to_date:null, target:null, daily_sales:{}}))
    });
  }
  allPeriods=attachApprovedSalesEvents(allPeriods,data.approved_events||[],today,data.cancelled_events||[]);
  if (!allPeriods.some(period=>period.key===today.slice(0,7))) allPeriods.push({
    key:today.slice(0,7),year:Number(today.slice(0,4)),month:Number(today.slice(5,7)),
    awaitingSource:true,dates:[],latest_date:null,branches:[]
  });
  if (!data.periods?.[today.slice(0,7)]) allPeriods=allPeriods.map(period=>period.key===today.slice(0,7)?{...period,awaitingSource:true}:period);
  allPeriods.sort((a,b) => a.key.localeCompare(b.key));
  const years = reportYears(allPeriods);
  const year = years.includes(Number(state.year)) ? Number(state.year) : null;
  const yearPeriods = year ? allPeriods.filter((period) => period.year === year) : [];
  const requestedMonth = String(state.month || '');
  const month = requestedMonth === 'all' ? 'all' : yearPeriods.some((period) => period.key === requestedMonth) ? requestedMonth : '';
  const scope = month === 'all' ? yearPeriods.filter((period) => !period.projected && !period.awaitingSource) : month ? yearPeriods.filter((period) => period.key === month) : [];
  const selectedPeriod = month && month !== 'all' ? scope[0] : null;
  const reportedDates = availableDates(selectedPeriod);
  const dates = calendarDays(selectedPeriod);
  const dateMode = state.date === 'month-end' ? 'month-end' : dates.includes(state.date) ? 'day' : 'latest';
  const selectedDate = dateMode === 'month-end' ? '' : dateMode === 'day' ? state.date : (reportedDates.includes(selectedPeriod?.latest_date) ? selectedPeriod.latest_date : reportedDates.at(-1) || '');
  const monthEnd = dates.at(-1) || '';
  const monthComplete = !!monthEnd && monthEnd <= today && selectedPeriod?.latest_date === monthEnd && (!selectedPeriod.branches.some(row=>reportType(row)!=='Event') || selectedPeriod.branch_latest_date===monthEnd);
  return { allPeriods, years, year, yearPeriods, month, scope, selectedPeriod, dates, reportedDates, selectedDate, dateMode, monthEnd, monthComplete, autoMonth:state.autoMonth===true };
}

// Resolve on every render, including a Bangkok midnight tick with unchanged data.
// Explicit historical selections stay pinned until the user resumes auto mode.
export function resolveReportMonth(state, today = todayBangkok()) {
  if (!state.autoMonth) return state;
  const month=today.slice(0,7);
  return {...state,year:Number(today.slice(0,4)),month,
    ...(state.month!==month ? {date:'',tableFilters:{}} : {})};
}

function aggregate(scope, selectedDate, today = todayBangkok()) {
  const rowsByBranch = new Map();
  for (const period of scope) {
    for (const branch of period.branches) {
      const id = branchIdentity(branch);
      if (!id.replace(/\u0001/g, '')) continue;
      if (!rowsByBranch.has(id)) {
        rowsByBranch.set(id, {
          type: String(branch.type || '').trim(),
          branch: String(branch.branch || '').trim(),
          branch_code: String(branch.branch_code || '').trim(),
          source_section: branch.source_section,
          total: 0,
          target: 0,
          notStarted: true,
          daily: null,
          best_date: '',
          best_value: null,
          daily_sales: {}
        });
      }
      const row = rowsByBranch.get(id);
      if (branch.first_sale_date && (!row.first_sale_date || branch.first_sale_date < row.first_sale_date)) row.first_sale_date = branch.first_sale_date;
      row.approved_event_key=branch.approved_event_key;row.approved_event_name=branch.approved_event_name;row.event_match=branch.event_match;
      row.event_schedule = branch.event_schedule;
      row.event_forecast = branch.event_forecast;
      const pending = eventNotStarted(branch, period, today);
      row.notStarted = row.notStarted && pending;
      row.total += safeNumber(branch.month_to_date);
      if (!pending) row.target += safeNumber(branch.target);
      if (selectedDate) {
        const cell=dailyCell(branch,selectedDate,period,today);
        if (cell.value != null) row.daily=(row.daily ?? 0)+cell.value;
      }
      for (const [date, value] of Object.entries(branch.daily_sales || {})) {
        const recorded = value != null && String(value).trim() !== '' && Number.isFinite(Number(value));
        if (recorded) row.daily_sales[date] = (row.daily_sales[date] ?? 0) + Number(value);
        else if (!(date in row.daily_sales)) row.daily_sales[date] = null;
      }
    }
  }
  const rows = [...rowsByBranch.values()].map((row) => {
    for (const [date,value] of Object.entries(row.daily_sales)) {
      if (value > 0 && (row.best_value === null || value > row.best_value || value === row.best_value && date < row.best_date)) {
        row.best_value = value;
        row.best_date = date;
      }
    }
    return {...row, gap: !row.notStarted && row.target !== 0 ? row.total - row.target : null};
  })
    .sort((a, b) => selectedDate ? b.daily - a.daily || b.total - a.total || a.branch.localeCompare(b.branch, 'th') : b.total - a.total || a.branch.localeCompare(b.branch, 'th'));
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const target = rows.reduce((sum, row) => sum + row.target, 0);
  const daily = selectedDate && rows.some(row => row.daily !== null) ? rows.reduce((sum, row) => sum + (row.daily ?? 0), 0) : null;
  return { rows, total, target, gap: target !== 0 ? total - target : null, daily, branches: rows.length };
}

function forecastDataDay(sourceDate, today) {
  if (typeof sourceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) || sourceDate.slice(0,7) !== today.slice(0,7) || sourceDate > today) return null;
  const parsed = new Date(`${sourceDate}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === sourceDate ? Number(sourceDate.slice(8,10)) : null;
}
export function runRateForecast(mtd, targetPeriod, today = todayBangkok(), sourceDate = targetPeriod?.latest_date) {
  if (!targetPeriod || keyFor(targetPeriod.year,targetPeriod.month) < today.slice(0,7)) return null;
  const elapsed = forecastDataDay(sourceDate, today);
  if (elapsed === null || mtd == null || String(mtd).trim() === '' || !Number.isFinite(Number(mtd))) return null;
  return Number(mtd) / elapsed * new Date(Date.UTC(targetPeriod.year,targetPeriod.month,0)).getUTCDate();
}
export function buildSalesReportModel(data, state = {}, today = todayBangkok()) {
  const selection = selectionFor(data, state, today);
  const baseline = selection.allPeriods.find((period) => period.key === today.slice(0,7));
  const baselineRows = new Map(aggregate(baseline ? [baseline] : [], '', today).rows.map(row => [branchIdentity(row),row.total]));
  const useActual = !selection.selectedPeriod || selection.monthComplete || selection.selectedPeriod.key < today.slice(0,7);
  const totals = aggregate(selection.scope, selection.selectedDate, today);
  const summaryScope = selection.scope.map((period) => ({...period, branches:period.branches.filter((branch) => !eventNotStarted(branch,period,today))}));
  const forecastRows = (group) => {
    group.rows = group.rows.map((row) => ({...row, forecast:row.notStarted ? null : reportType(row)==='Event' ? (selection.selectedPeriod ? row.event_forecast?.value ?? null : null) : runRateForecast(baselineRows.get(branchIdentity(row)),selection.selectedPeriod,today,baseline?.branch_latest_date ?? null)}));
    const branches = group.rows.filter(row => reportType(row) !== 'Event');
    const events = group.rows.filter(row => reportType(row) === 'Event');
    group.branchForecast = branches.every(row => row.forecast !== null) ? branches.reduce((sum,row) => sum + row.forecast,0) : null;
    group.eventActual = events.reduce((sum,row) => sum + row.total,0);
    group.unknownEventSchedules = selection.selectedPeriod ? events.filter(row=>!row.notStarted && row.forecast == null).length : 0;
    group.eventForecast = events.reduce((sum,row) => sum + (row.forecast ?? row.total),0);
    group.forecastBasis = branches.length && events.length ? 'branch-and-event-forecast' : events.length ? 'event-forecast' : 'branch-forecast';
    // Unknown schedules contribute only recorded sales, explicitly labelled below;
    // scheduled events contribute their daily average over planned selling days.
    group.forecast = selection.selectedPeriod && group.rows.length && group.branchForecast !== null ? group.branchForecast + group.eventForecast : null;
    return group;
  };
  forecastRows(totals);
  const summary = forecastRows(aggregate(summaryScope,selection.selectedDate,today));
  const channels = REPORT_TYPES.map((name) => ({name, ...forecastRows(aggregate(summaryScope.map((period) => ({...period, branches:period.branches.filter((branch) => reportType(branch) === name)})),selection.selectedDate,today))}));
  const comparisons = compareForecasts(totals.rows,selection.allPeriods,selection.selectedPeriod,row=>reportType(row)!=='Event',useActual);
  for (const group of [totals,summary,...channels]) {
    group.rows = group.rows.map(row=>({...row,comparisonBasis:useActual?'actual':'forecast',yoy:comparisons.get(comparisonKey(row))}));
    group.yoyCounts = comparisonCounts(group.rows);
    group.yoySummary = compareAggregateSales({
      current:group.rows.length ? (useActual ? group.total : group.forecast) : null,
      basis:useActual ? 'actual' : group.forecastBasis,
      allPeriods:selection.allPeriods, scope:selection.scope,
      include:row => !group.name || reportType(row) === group.name
    });
  }
  for(const channel of channels)channel.approvedPending=totals.rows.filter(row=>row.approved_event_key&&row.notStarted&&reportType(row)===channel.name).length;
  const pendingEvents = totals.rows.filter((row) => row.notStarted).length;
  const sourceEventRows=selection.scope.flatMap(period=>sourceSections(data.periods?.[period.key]?.branches||[]).filter(row=>row.source_section==='event'));
  const exclusions=new Map();
  for(const row of sourceEventRows)if(confirmedBranchMapping(row)||isLadpraoCounter(row)){
    exclusions.set(row.branch,(exclusions.get(row.branch)||0)+safeNumber(row.month_to_date));
  }
  const eventReconciliation=sourceEventRows.length?{sourceTotal:sourceEventRows.reduce((sum,row)=>sum+safeNumber(row.month_to_date),0),excluded:[...exclusions].filter(([,amount])=>amount!==0).map(([name,amount])=>({name,amount}))}:null;
  return {...selection, useActual, totals, summary, pendingEvents, channels, eventReconciliation, coverage:monthCoverage(selection.scope), forecastDay:forecastDataDay(baseline?.branch_latest_date,today), forecastBasis:baseline?.branch_latest_date || null};
}

export function filterMarkup(model) {
  const yearOptions = [`<option value="">เลือกปี</option>`, ...model.years.map((year) => `<option value="${year}"${year === model.year ? ' selected' : ''}>${thaiYear(year)}</option>`)].join('');
  const monthOptions = model.year
    ? [`<option value="">เลือกเดือน</option>`, `<option value="all"${model.month === 'all' ? ' selected' : ''}>ทั้งปี (ข้อมูลที่มี)</option>`, ...model.yearPeriods.map((period) => `<option value="${period.key}"${model.month === period.key ? ' selected' : ''}>${monthsLong[period.month - 1]}${period.projected ? ' (คาดการณ์)' : ''}</option>`)].join('')
    : '<option value="">เลือกปีก่อน</option>';
  const dateOptions = model.selectedPeriod
    ? `<option value="latest"${model.dateMode === 'latest' ? ' selected' : ''}>ล่าสุด — อัตโนมัติ</option><option value="month-end"${model.dateMode === 'month-end' ? ' selected' : ''}>ปิดเดือน · ${dateLabel(model.monthEnd)}${model.monthComplete ? '' : ' (รอข้อมูลครบเดือน)'}</option>` + model.dates.map((date) => `<option value="${date}"${model.dateMode === 'day' && date === model.selectedDate ? ' selected' : ''}>${dateLabel(date)}${date > (model.selectedPeriod.latest_date || '') ? ' · รอข้อมูล' : model.selectedPeriod.branch_latest_date && date > model.selectedPeriod.branch_latest_date ? ' · เฉพาะ Event · สาขารอข้อมูล' : ''}</option>`).join('')
    : '<option value="">เลือกเดือนก่อน</option>';
  return `<div class="daily-sales-filters" aria-label="ตัวกรอง Sales Report">
    <button type="button" data-daily-sales-auto-month aria-pressed="${model.autoMonth===true}">${model.autoMonth ? 'เดือนปัจจุบัน · อัตโนมัติ' : 'กลับเดือนปัจจุบัน · อัตโนมัติ'}</button>
    <label><span>ปี</span><select data-daily-sales-year>${yearOptions}</select></label>
    <label><span>เดือน</span><select data-daily-sales-month${model.year ? '' : ' disabled'}>${monthOptions}</select></label>
    <label><span>วันที่รายงาน</span><select data-daily-sales-date${model.selectedPeriod && model.dates.length ? '' : ' disabled'}>${dateOptions}</select></label>
  </div>`;
}
function sourceNote(model, data) {
  if(model.selectedPeriod?.awaitingSource) return '<div class="daily-sales-source"><span class="badge badge-current">Sales Report</span><span>'+escapeHtml(periodLabel(model.selectedPeriod))+' · รอยอดจาก Excel ของเดือนนี้ · เลือกเดือนก่อนหน้าเพื่อดูประวัติได้</span></div>';
  const stamp = reportSourceTimestamp(data, model.selectedPeriod, model.selectedPeriod?.key);
  const updated = Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toLocaleString('th-TH', {timeZone:'Asia/Bangkok'}) : '';
  if (!model.year) return `<div class="daily-sales-source"><span class="badge badge-current">Sales Report</span><span>เลือกปีก่อน แล้วเลือกเดือนเพื่อดูตัวเลขรายวัน</span>${updated ? `<span>รับข้อมูลล่าสุด ${escapeHtml(updated)}</span>` : ''}</div>`;
  const mode = model.month === 'all'
    ? `รายปี ${thaiYear(model.year)} รวมเฉพาะข้อมูล ${model.coverage} ที่นำเข้า`
    : model.selectedPeriod
      ? `${periodLabel(model.selectedPeriod)}${model.dateMode === 'month-end' ? ` · ปิดเดือน ${dateLabel(model.monthEnd)}${model.monthComplete ? ' · ยอดจริงถึงสิ้นเดือน' : ' · รอข้อมูลครบเดือน แสดงยอดจริงที่รับแล้ว'}` : model.selectedDate ? ` · รายวัน ${dateLabel(model.selectedDate)}${model.selectedDate > (model.selectedPeriod.latest_date || '') ? ' · รอข้อมูล' : ''}` : ''}`
      : `ปี ${thaiYear(model.year)} · เลือกเดือนเพื่อดูรายวัน`;
  const asOf = model.selectedPeriod && !model.selectedPeriod.projected ? periodSalesDatesText(model.selectedPeriod,dateLabel) : '';
  return `<div class="daily-sales-source"><span class="badge badge-current">Sales Report</span><span>${escapeHtml(mode)}</span>${asOf ? `<span>${escapeHtml(asOf)}</span>` : ''}${updated ? `<span>รับข้อมูลล่าสุด ${escapeHtml(updated)}</span>` : ''}</div>`;
}
export const REPORT_COLUMNS = Object.freeze([
  ['zeroDays', 'จำนวนวันที่ขายไม่ได้'], ['type', 'ประเภท'], ['code', 'รหัสสาขา'], ['best', 'วันขายดีที่สุด'],
  ['target', 'เป้าหมาย'], ['total', 'ยอดรวม'], ['forecast', 'ยอดคาดการณ์'],
  ['yoy', 'คาดการณ์เทียบปีก่อน'],
  ['gap', 'ยอดห่างจากเป้าหมาย'], ['selectedDay', 'ยอดวันที่รายงาน'], ['daily', 'ยอดรายวัน (ทั้งเดือน)']
]);
function todayBangkok() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function calendarDays(period) {
  if (!period) return [];
  return Array.from({length:new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()}, (_, i) => `${keyFor(period.year, period.month)}-${String(i+1).padStart(2,'0')}`);
}
export function dailyCell(row, date, period, today = todayBangkok()) {
  if (date > today) return {kind:'future', value:null};
  const cutoff=reportType(row)!=='Event' && Object.hasOwn(period || {},'branch_latest_date') ? period.branch_latest_date : period?.latest_date;
  if (!cutoff || date > cutoff) return {kind:'pending', value:null};
  if (reportType(row)==='Event' && row.event_schedule && (date<row.event_schedule.start || date>row.event_schedule.end)) return {kind:'missing',value:null};
  const value = row.daily_sales?.[date];
  if (value == null || String(value).trim() === '') {
    if (reportType(row) !== 'Event') {
      const started = row.first_sale_date && row.first_sale_date < date || Object.entries(row.daily_sales || {}).some(([prior,amount])=>prior<date && Number(amount)>0);
      if (started) return {kind:'zero', value:0};
    } else if (row.event_schedule && date>=row.event_schedule.start && date<=row.event_schedule.end && !eventNotStarted({...row,month_to_date:row.total ?? row.month_to_date},period,today)) {
      return {kind:'zero', value:0};
    }
    return {kind:'missing', value:null};
  }
  if (!Number.isFinite(Number(value))) return {kind:'missing', value:null};
  return {kind:Number(value) === 0 ? 'zero' : 'value', value:Number(value)};
}
export function zeroSalesDays(row, period, today = todayBangkok()) {
  return calendarDays(period).filter((date) => dailyCell(row,date,period,today).kind === 'zero').length;
}
export function topSalesDays(row, period, today = todayBangkok()) {
  if (row.notStarted) return new Map();
  const limit = reportType(row) === 'Event' ? 1 : 3;
  return new Map(calendarDays(period)
    .map((date) => ({date, ...dailyCell(row,date,period,today)}))
    .filter((cell) => cell.value !== null && cell.value > 0)
    .sort((a,b) => b.value - a.value || a.date.localeCompare(b.date))
    .slice(0,limit)
    .map((cell,index) => [cell.date,index + 1]));
}
function columnControls(state) {
  const selected = new Set(state.columns || REPORT_COLUMNS.map(([id]) => id));
  return `<details class="daily-sales-columns"${state.columnsOpen ? ' open' : ''}>
    <summary>เลือกข้อมูล <span class="daily-sales-column-count">${selected.size}/${REPORT_COLUMNS.length}</span><span class="daily-sales-column-chevron" aria-hidden="true">⌄</span></summary>
    <fieldset class="daily-sales-column-panel"><legend class="sr-only">เลือกข้อมูลที่ต้องการแสดง</legend>
      <p class="help">เลือกได้หลายรายการ · ชื่อสาขาแสดงเสมอ</p>
      <div class="daily-sales-column-options">${REPORT_COLUMNS.map(([id,label]) => `<label><input type="checkbox" data-report-column="${id}"${selected.has(id) ? ' checked' : ''}><span>${label}</span></label>`).join('')}</div>
    </fieldset>
  </details>`;
}
function dailyMarkup(row, date, period, today, topDays) {
  const cell = dailyCell(row,date,period,today);
  const labels = {future:'ยังไม่ถึงวัน', pending:'รอข้อมูลรายงาน', missing:'ไม่มีข้อมูล', zero:'ยอดขายเป็น 0'};
  const low = cell.value !== null && cell.value < 2400;
  const rank = topDays.get(date);
  const title = [dateLabel(date), labels[cell.kind], low ? 'ยอดขายต่ำกว่า 2,400 บาท' : '', rank ? `ยอดขายสูงสุดอันดับ ${rank} ของเดือน` : ''].filter(Boolean).join(' · ');
  return `<td class="daily-sales-number daily-cell-${cell.kind}${rank ? ' daily-cell-top' : ''}${low ? ' daily-cell-low' : ''}" title="${escapeHtml(title)}">${cell.value == null ? '—' : number.format(cell.value)}</td>`;
}
const branchCollator = new Intl.Collator('th', {numeric:true, sensitivity:'base'});
const textColumns = new Set(['branch', 'type', 'code', 'best']);
function normalizedSearch(value) { return String(value || '').normalize('NFC').trim().toLocaleLowerCase('th'); }
function columnValue(row, key, period, selectedDate, today) {
  if (key === 'branch') return row.branch || null;
  if (key === 'type') return reportType(row);
  if (key === 'code') return row.branch_code || null;
  if (key === 'best') return row.best_date ? weekdayLabel(row.best_date) : null;
  if (key === 'yoy') return ['up','down','equal'].includes(row.yoy?.status) ? row.yoy.percent : null;
  if (row.notStarted) return null;
  if (key === 'zeroDays') return zeroSalesDays(row,period,today);
  if (key.startsWith('day:')) return period ? dailyCell(row,`${keyFor(period.year,period.month)}-${key.slice(4)}`,period,today).value : null;
  if (key === 'target') return row.target || null;
  if (key === 'total') return period?.projected ? null : row.total;
  if (key === 'selectedDay') return selectedDate ? row.daily : null;
  if (key === 'forecast' && row.comparisonBasis==='actual') return row.total;
  if (key === 'gap') return row.target ? row.gap : null;
  return row[key] ?? null;
}
function hasColumnFilter(filter) {
  return !!filter && (!!normalizedSearch(filter.query) || Array.isArray(filter.values));
}
function activeTableFilters(state, tableId, keys) {
  return Object.fromEntries(Object.entries(state.tableFilters?.[tableId] || {}).filter(([key,filter]) => keys.includes(key) && hasColumnFilter(filter)));
}
export function columnChoice(row, key, {period = null, selectedDate = '', today = todayBangkok()} = {}) {
  const value = columnValue(row,key,period,selectedDate,today);
  let label;
  if (value == null || typeof value === 'number' && !Number.isFinite(value)) {
    label = key === 'yoy' ? ({new:'สาขาเปิดใหม่',event:'Event ไม่เทียบสาขาเดิม'}[row.yoy?.status] || row.yoy?.reason || '—') : '—';
    if (key === 'forecast' && reportType(row) === 'Event' && !row.notStarted && period && !row.event_schedule) label = 'รอวันเปิดขาย';
  } else if (textColumns.has(key)) label = String(value);
  else if (key === 'yoy') label = gapPercent.format(value);
  else if (key === 'zeroDays') label = `${number.format(value)} วัน`;
  else label = number.format(value);
  // Match the displayed value so rounding and blank cells have one checkbox each.
  return {id:label,label,value};
}
function choiceMatches(choice, query) {
  const search = normalizedSearch(query).replaceAll('฿','').replace(/^\+/,'');
  return normalizedSearch(choice.label).includes(search) || normalizedSearch(choice.label).replaceAll(',','').includes(search.replaceAll(',',''));
}
export function selectedColumnValues(options, filter = {}) {
  return new Set(options.filter(option => choiceMatches(option,filter.query) && (!Array.isArray(filter.values) || filter.values.includes(option.id))).map(option=>option.id));
}
export function selectedColumnFilter(options, chosen) {
  return {query:'',values:options.length && options.every(option=>chosen.has(option.id)) ? null : [...chosen]};
}
export function columnChoices(rows, key, options = {}) {
  const otherFilters = {...options.filters};
  delete otherFilters[key];
  const available = branchTableRows(rows,{...options,filters:otherFilters,sort:{key,direction:'asc'}});
  return [...new Map(available.map(row => { const choice=columnChoice(row,key,options);return [choice.id,choice]; })).values()];
}
export function branchTableRows(rows, {query = '', filters = {}, sort = null, period = null, selectedDate = '', today = todayBangkok()} = {}) {
  const search = normalizedSearch(query);
  const applied = Object.entries(filters).filter(([,filter])=>hasColumnFilter(filter));
  const filtered = rows.filter(row => normalizedSearch(row.branch).includes(search) && applied.every(([key,filter]) => {
    const choice=columnChoice(row,key,{period,selectedDate,today});
    return choiceMatches(choice,filter.query) && (!Array.isArray(filter.values) || filter.values.includes(choice.id));
  }));
  if (!sort) return filtered;
  // Derive once per row: daily values must use the same rules as the visible cells.
  return filtered.map((row,index) => ({row,index,value:columnValue(row,sort.key,period,selectedDate,today)}))
    .sort((a,b) => {
      const missing = value => value == null || typeof value === 'number' && !Number.isFinite(value);
      if (missing(a.value) || missing(b.value)) return Number(missing(a.value)) - Number(missing(b.value)) || a.index - b.index;
      const order = textColumns.has(sort.key) ? branchCollator.compare(a.value,b.value) : a.value - b.value;
      return order * (sort.direction === 'asc' ? 1 : -1) || a.index - b.index;
    }).map(item => item.row);
}
export function reportColumnLabel(key,label,useActual) {
  return useActual && key==='forecast' ? 'ยอดจริงสะสม' : useActual && key==='yoy' ? 'ยอดจริงเทียบปีก่อน' : label;
}
export function selectedReportTable(model,state={},today=todayBangkok(),tableId='main') {
  const period=model.selectedPeriod,selected=new Set(state.columns||REPORT_COLUMNS.map(([id])=>id));
  const days=selected.has('daily')?calendarDays(period):[];
  const keys=['branch',...(selected.has('zeroDays')&&period?['zeroDays']:[]),...REPORT_COLUMNS.filter(([id])=>!['daily','zeroDays'].includes(id)&&selected.has(id)).map(([id])=>id),...days.map(date=>'day:'+date.slice(-2))];
  const requested=state.tableSorts?.[tableId],sort=requested&&keys.includes(requested.key)?requested:keys.includes(model.selectedDate?'selectedDay':'total')?{key:model.selectedDate?'selectedDay':'total',direction:'desc'}:null;
  const filters=activeTableFilters(state,tableId,keys);
  return {keys,days,rows:branchTableRows(model.totals.rows,{query:state.branchQuery,filters,sort,period,selectedDate:model.selectedDate,today}),filters,sort};
}
export function annualReportTables(model,state,today=todayBangkok()) {
  if(model.month!=='all' || !state.columns?.some(key=>['daily','zeroDays'].includes(key)))return [];
  return model.scope.map(period=>({period,...selectedReportTable({selectedPeriod:period,selectedDate:'',totals:aggregate([period],'',today)}, {...state,columns:state.columns.filter(key=>['daily','zeroDays'].includes(key))},today,period.key)}));
}
function headerCell(key, label, {className = '', detail = '', state, tableId, sort}) {
  const active = sort?.key === key;
  const filtered = hasColumnFilter(state.tableFilters?.[tableId]?.[key]) || key === 'branch' && normalizedSearch(state.branchQuery);
  return `<th scope="col" class="${className}" aria-sort="${active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}"><span class="daily-header-content"><span>${escapeHtml(label)}${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span><button type="button" class="daily-header-button${active || filtered ? ' is-active' : ''}" data-column-key="${key}" data-table-id="${tableId}" data-column-label="${escapeHtml(label)}" aria-label="กรอง ค้นหา และเรียง ${escapeHtml(label)}${filtered ? ' (กรองอยู่)' : ''}" aria-haspopup="dialog" aria-expanded="false" aria-controls="daily-column-menu"><span aria-hidden="true">${filtered ? '●' : active ? sort.direction === 'asc' ? '↑' : '↓' : '⌄'}</span></button></span></th>`;
}
function branchTable(rows, selectedDate, period, selected, today, state = {}, tableId = 'main') {
  const useActual=rows.some(row=>row.comparisonBasis==='actual');
  const days = selected.has('daily') ? calendarDays(period) : [];
  const showZeroDays = selected.has('zeroDays') && !!period;
  const keys = ['branch', ...(showZeroDays ? ['zeroDays'] : []), ...REPORT_COLUMNS.filter(([id]) => !['daily','zeroDays'].includes(id) && selected.has(id)).map(([id]) => id), ...days.map(date => `day:${date.slice(-2)}`)];
  const requestedSort = state.tableSorts?.[tableId];
  const sort = requestedSort && keys.includes(requestedSort.key) ? requestedSort : null;
  const defaultSort = sort || (keys.includes(selectedDate ? 'selectedDay' : 'total') ? {key:selectedDate ? 'selectedDay' : 'total',direction:'desc'} : null);
  const filters = activeTableFilters(state,tableId,keys);
  const displayed = branchTableRows(rows,{query:state.branchQuery,filters,sort:defaultSort,period,selectedDate,today});
  const header = (key,label,options = {}) => headerCell(key,label,{state,tableId,sort:defaultSort,...options});
  const headers = [];
  headers.push(header('branch','ชื่อสาขา',{className:'daily-branch-name'}));
  if (showZeroDays) headers.push(header('zeroDays','จำนวนวันที่ขายไม่ได้',{className:'daily-zero-count',detail:'(ยอดเป็น 0)'}));
  for (const [id,label] of REPORT_COLUMNS) if (!['daily','zeroDays'].includes(id) && selected.has(id)) headers.push(header(id,reportColumnLabel(id,label,useActual)));
  for (const date of days) headers.push(header(`day:${date.slice(-2)}`,String(Number(date.slice(-2))),{className:'daily-date-header',detail:weekdayLabel(date).replace('วัน','')}));
  const body = displayed.map((row) => {
    const topDays = days.length ? topSalesDays(row,period,today) : new Map();
    const gapClass = row.gap === null ? '' : row.gap < 0 ? ' is-negative' : ' is-positive';
    const cells = [];
    const sourceLabel = [row.source_section === 'event' ? 'ส่วน Event ในรายงาน' : '', reportType(row), row.branch_code].filter(Boolean).join(' · ');
    const emptySource = row.source_section === 'event' && row.total === 0 && !Object.values(row.daily_sales).some(value => value != null);
    cells.push(`<th scope="row" class="daily-branch-name">${escapeHtml(row.branch || '—')}<small class="daily-branch-source">${escapeHtml(sourceLabel)}</small>${emptySource ? '<small class="daily-branch-source">ยังไม่มียอดในแถวนี้</small>' : ''}${row.event_match?`<small class="daily-branch-source">${row.event_match==='matched'?'จับคู่ Event ที่อนุมัติแล้ว':row.event_match==='ambiguous'?'อนุมัติแล้ว · พบชื่อซ้ำ รอตรวจสอบ':'อนุมัติแล้ว · รอยอดจาก Sales Report 2026'}${row.event_schedule?' · '+escapeHtml(row.event_schedule.start+' – '+row.event_schedule.end):''}</small>`:''}${row.notStarted ? '<span class="daily-event-pending">ยังไม่เริ่ม</span>' : ''}</th>`);
    if (showZeroDays) cells.push(`<td class="daily-zero-count">${row.notStarted ? '—' : `<strong>${zeroSalesDays(row,period,today)}</strong> วัน`}</td>`);
    const values = {
      type: escapeHtml(reportType(row)), code:escapeHtml(row.branch_code || '—'),
      best:row.best_date ? escapeHtml(weekdayLabel(row.best_date)) : '—', target:targetValue(row.target),
      total:period?.projected ? '—' : formatMoney(row.total), forecast:useActual ? formatMoney(row.total) : row.forecast == null ? (reportType(row)==='Event' && !row.notStarted && period && !row.event_schedule ? '<span class="help">รอวันเปิดขาย</span>' : '—') : formatMoney(row.forecast), gap:gapValue(row.gap,row.target),
      selectedDay:selectedDate && row.daily != null ? formatMoney(row.daily) : '—'
    };
    values.yoy = comparisonMarkup(row.yoy);
    if (row.notStarted) for (const id of ['target','total','forecast','gap','selectedDay']) values[id] = '—';
    for (const [id] of REPORT_COLUMNS) if (!['daily','zeroDays'].includes(id) && selected.has(id)) cells.push(`<td class="${['target','total','forecast','gap','selectedDay'].includes(id) ? 'daily-sales-number' : ''}${id === 'gap' ? gapClass : ''}${id === 'yoy' ? ' daily-yoy-cell' : ''}">${values[id]}</td>`);
    cells.push(...days.map((date) => row.notStarted ? '<td class="daily-sales-number daily-cell-pending" title="Event ยังไม่เริ่ม">—</td>' : dailyMarkup(row,date,period,today,topDays)));
    return `<tr>${cells.join('')}</tr>`;
  }).join('') || `<tr><td colspan="${headers.length}" class="empty-state">${Object.keys(filters).length ? 'ไม่พบข้อมูลที่ตรงกับตัวกรอง ลองเปลี่ยนเงื่อนไขหรือล้างตัวกรอง' : normalizedSearch(state.branchQuery) ? 'ไม่พบสาขาที่ตรงกับคำค้น ลองเปลี่ยนคำค้นหรือล้างการค้นหา' : 'เลือกปีและเดือนเพื่อแสดงรายงาน'}</td></tr>`;
  const filterStatus = Object.keys(filters).length ? `<div class="daily-branch-filter" role="status"><strong>พบ ${displayed.length} จาก ${rows.length} รายการ</strong><span>กรอง ${Object.keys(filters).length} คอลัมน์</span><button type="button" data-clear-table-filters="${tableId}">ล้างตัวกรองทั้งหมด</button><small>กรองเฉพาะตารางนี้ · ยอดสรุปด้านบนรวมทุกสาขา</small></div>` : '';
  return `${filterStatus}<div class="table-wrap section-gap daily-branch-scroll${days.length ? ' has-daily' : ''}" tabindex="0" role="region" aria-label="ตารางรายสาขา${period ? ` ${periodLabel(period)}` : ''}"><table><thead><tr>${headers.join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}
export function tableMarkup(model, state = {}, today = todayBangkok()) {
  const selected = new Set(state.columns || REPORT_COLUMNS.map(([id]) => id));
  const title = model.selectedPeriod ? `ยอดขายรายสาขา · ${periodLabel(model.selectedPeriod)}` : model.month === 'all' ? `ยอดขายรายปี ${thaiYear(model.year)}` : 'เลือกเดือนเพื่อดูยอดขายรายสาขา';
  const annualDaily = model.month === 'all' && (selected.has('daily') || selected.has('zeroDays'));
  const monthlyTables = annualDaily ? model.scope.map((period) => `<section class="daily-month-section"><h3>${escapeHtml(periodLabel(period))}</h3>${branchTable(aggregate([period], '',today).rows,'',period,new Set(['daily','zeroDays'].filter(id=>selected.has(id))),today,state,period.key)}</section>`).join('') : '';
  return `<section class="card section-gap daily-sales-table-card">
    <div class="sales-section-head"><div><p class="sales-kpi-label">รายสาขา</p><h2>${escapeHtml(title)}</h2></div><div class="daily-sales-table-actions">${columnControls(state)}<span class="help">กด ▾ ที่หัวคอลัมน์เพื่อกรอง ค้นหา และเรียงข้อมูล</span></div></div>
    ${normalizedSearch(state.branchQuery) ? `<div class="daily-branch-filter" role="status"><span>ค้นหาสาขา: <strong>${escapeHtml(state.branchQuery)}</strong> · พบ ${branchTableRows(model.totals.rows,{query:state.branchQuery}).length} จาก ${model.totals.rows.length} รายการ</span><button type="button" data-clear-branch>ล้างการค้นหา</button><small>กรองเฉพาะตาราง · ยอดสรุปด้านบนรวมทุกสาขา</small></div>` : ''}
    ${selected.has('yoy') ? '<p class="help daily-yoy-table-note">เทียบปีก่อน = '+(model.useActual?'ยอดจริงสะสม':'ยอดคาดการณ์ปิดเดือน')+' − ยอดขายเต็มเดือนเดียวกันปีก่อน · % ใช้ยอดปีก่อนเป็นฐาน · สาขาเปิดใหม่ = สาขาที่ไม่มีรายการปีก่อนจับคู่ได้</p>' : ''}
    ${selected.has('daily') ? '<p class="help daily-calendar-note"><span class="daily-low-key">ตัวแดง = ต่ำกว่า 2,400 บาท</span> · <span class="daily-top-key">พื้นเขียว = 3 วันขายดีที่สุดต่อสาขา / Event 1 วัน ต่อเดือน</span><br><span class="daily-zero-key">0 = ไม่มียอดขาย รวมวันที่ไม่บันทึกหลังสาขาเคยมียอดขายแล้ว</span> · นับถึงวันล่าสุดในรายงาน · — = ก่อนเริ่มขาย / นอกช่วง Event / รอรายงาน / วันอนาคต · จัดอันดับเฉพาะยอดมากกว่า 0 หากยอดเท่ากันเลือกวันที่ก่อน · ยอดรายวันหน่วยบาท เลื่อนตารางแนวนอนเพื่อดูครบเดือน</p>' : ''}
    ${branchTable(model.totals.rows,model.selectedDate,model.selectedPeriod,selected,today,state)}
    ${monthlyTables}
    <div id="daily-column-menu" class="daily-column-menu" popover="auto" role="dialog" aria-label="ค้นหาและเรียงข้อมูล"></div>
  </section>`;
}
function targetProgress(group, projected) {
  if (!group.target || projected) return '';
  const ratio = group.total / group.target;
  return `<div class="daily-target-progress"><span>เป้า ${formatMoney(group.target)} <strong>${gapPercent.format(ratio)}</strong></span><progress max="100" value="${Math.max(0,Math.min(100,ratio*100))}" aria-label="ทำได้ ${gapPercent.format(ratio)} ของเป้าหมาย"></progress></div>`;
}
function summaryGap(group, projected) {
  if (group.gap == null || projected) return '';
  return `<p class="daily-summary-gapline">${group.gap < 0 ? 'ยังขาด' : group.gap > 0 ? 'เกินเป้า' : 'ถึงเป้า'} <strong>${formatMoney(Math.abs(group.gap))}</strong></p>`;
}
function summaryDelta(comparison) {
  if (comparison?.delta == null) return `<span class="daily-comparison-missing">${escapeHtml(comparison?.reason || 'ไม่มีฐานเทียบ')}</span>`;
  const sign = comparison.delta > 0 ? '+' : '';
  return `<strong class="daily-yoy-${comparison.status}">${sign}${formatMoney(comparison.delta)}</strong><span class="daily-yoy-${comparison.status}">${comparison.percent == null ? (comparison.actual < 0 ? '% — (ฐานติดลบ)' : '% — (ปีก่อนเป็น 0)') : `(${comparison.percent > 0 ? '+' : ''}${gapPercent.format(comparison.percent)})`}</span>`;
}
function priorLabel(model) {
  return model.selectedPeriod ? `${monthsShort[model.selectedPeriod.month-1]} ${thaiYear(model.selectedPeriod.year-1)}` : model.year ? `${thaiYear(model.year-1)} · เดือนเดียวกัน` : 'ปีก่อน';
}
function comparisonBasis(group) {
  return group.yoySummary?.basis === 'actual' ? 'ยอดจริงเทียบปีก่อน' : 'คาดการณ์เทียบปีก่อน';
}
function branchCounts(group, available) {
  const c = group.yoyCounts;
  return `<span class="daily-count-up">โต <strong>${available ? c.up : '—'}</strong></span><span class="daily-count-down">ตก <strong>${available ? c.down : '—'}</strong></span>${c.new ? `<span class="daily-count-new">เปิดใหม่ <strong>${c.new}</strong></span>` : ''}${c.equal ? `<span>เท่าเดิม ${c.equal}</span>` : ''}${c.unknown ? `<span class="daily-count-unknown">รอเทียบ ${c.unknown}</span>` : ''}`;
}
function comparisonMarkup(comparison) {
  if (!comparison || comparison.status === 'unknown' || comparison.status === 'excluded') return `<span class="daily-yoy-unavailable">${escapeHtml(comparison?.reason || 'ไม่มีฐานเทียบ')}</span>`;
  if (comparison.status === 'new') return '<span class="daily-yoy-badge daily-yoy-new">สาขาเปิดใหม่</span>';
  const {status,delta,percent,actual} = comparison;
  const sign = status === 'up' ? '+' : '';
  return `<strong class="daily-yoy-${status}">${status === 'up' ? '↑' : status === 'down' ? '↓' : '='} ${sign}${gapPercent.format(percent)}</strong><span class="daily-yoy-${status}">${sign}${formatMoney(delta)}</span><small>ปีก่อน ${formatMoney(actual)}</small>`;
}
function growthSummary(model) {
  const available = model.selectedPeriod && model.summary.rows.some(row=>['up','down','equal','new'].includes(row.yoy?.status));
  return `<div class="daily-growth-summary" aria-label="แนวโน้มสาขาเทียบปีก่อน"><span>แนวโน้มสาขา · ${model.useActual?'ยอดจริง':'คาดการณ์'}เทียบปีก่อน</span><div class="daily-branch-counts">${branchCounts(model.summary,available)}</div><span class="daily-growth-unit">สาขา · ไม่รวม Event</span></div>`;
}
function eventReconciliationMarkup(model){
  const reconciliation=model.eventReconciliation;
  if(!reconciliation?.excluded.length)return '';
  const exact=value=>new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  return `<details class="daily-event-reconciliation"><summary>เทียบยอดกับส่วน Event ใน Excel</summary><p>ยอดในส่วน Event: ฿${exact(reconciliation.sourceTotal)}</p><p>แยกออกตามกติกาสาขาประจำเดิม:</p><ul>${reconciliation.excluded.map(row=>`<li>${escapeHtml(row.name)} ฿${exact(row.amount)}</li>`).join('')}</ul><p>รายการเหล่านี้ใช้กติกาจับคู่สาขาประจำที่กำหนดไว้ จึงไม่นับรวมใน Event</p></details>`;
}
export function summaryMarkup(model) {
  const summary = model.summary;
  const projected = model.selectedPeriod?.projected;
  const period = model.selectedPeriod ? periodLabel(model.selectedPeriod) : model.month === 'all' ? `ปี ${thaiYear(model.year)} · ข้อมูล ${model.coverage}` : 'เลือกปีและเดือน';
  const total = (group) => model.scope.length && group.branches && !projected ? formatMoney(group.total) : '—';
  const prior = group => group.yoySummary?.actual == null ? '—' : formatMoney(group.yoySummary.actual);
  const forecastFormula = !model.useActual && summary.forecast != null && model.forecastDay && summary.rows.some(row=>reportType(row)!=='Event')
    ? `<small>สาขา: ยอดสะสมถึง ${escapeHtml(dateLabel(model.forecastBasis))} ÷ ${model.forecastDay} × ${new Date(Date.UTC(model.selectedPeriod.year,model.selectedPeriod.month,0)).getUTCDate()} วัน</small>` : '';
  return `<section class="daily-summary" aria-label="สรุป Sales Report">
    <article class="card daily-summary-total">
      <div class="daily-summary-main"><p class="daily-summary-period">${escapeHtml(period)} · ${number.format(summary.branches)} สาขา / จุดขาย</p><h2>ยอดขายรวม</h2><strong class="daily-summary-total-value">${total(summary)}</strong>${targetProgress(summary,projected)}${summaryGap(summary,projected)}</div>
      <div class="daily-summary-outlook"><dl class="daily-summary-metrics">
        <div><dt>${model.useActual ? (model.monthComplete?'ยอดจริงปิดเดือน':'ยอดจริงสะสม') : 'ยอดคาดการณ์รวม'}</dt><dd>${model.useActual ? total(summary) : summary.forecast == null ? '—' : formatMoney(summary.forecast)}</dd><small>${model.useActual ? (model.monthComplete?'รับยอดครบเดือนแล้ว · ใช้ยอดรวมจากต้นทาง':'ใช้ยอดจริงที่รับแล้ว · ตรวจวันที่อัปเดตด้านบน') : 'คาดการณ์สาขา + คาดการณ์ Event'+(summary.unknownEventSchedules ? ` · ${summary.unknownEventSchedules} งานรอวันขาย ใช้ยอดจริงเท่านั้น` : '')}</small>${forecastFormula}</div>
        <div><dt>ยอดจริง ${escapeHtml(priorLabel(model))}</dt><dd>${prior(summary)}</dd><small>ทุกช่องทาง รวม Event · เต็มเดือน${model.month === 'all' ? 'ที่มีข้อมูล' : ''}</small></div>
        <div><dt>${comparisonBasis(summary)}</dt><dd class="daily-summary-delta">${summaryDelta(summary.yoySummary)}</dd></div>
      </dl></div>
    </article>
    ${growthSummary(model)}
    <div class="daily-sales-stats">
      ${model.channels.map((channel,index) => `<article class="card daily-channel-card daily-channel-${index}">
        <div class="daily-channel-head"><h2>${escapeHtml(channel.name)}</h2><span>${number.format(channel.branches+(channel.approvedPending||0))} ${channel.name === 'Event' ? 'จุดขาย' : 'สาขา'}</span></div>
        <p class="daily-channel-sales-label">ยอดขายสะสม</p><strong class="daily-channel-value">${total(channel)}</strong>${targetProgress(channel,projected)}
        <dl class="daily-channel-metrics"><div><dt>${model.useActual ? (model.monthComplete?'ยอดจริงปิดเดือน':'ยอดจริงสะสม') : channel.name === 'Event' ? 'คาดการณ์ปิดงาน' : 'คาดการณ์สิ้นเดือน'}</dt><dd>${model.useActual ? total(channel) : channel.forecast == null ? '—' : formatMoney(channel.forecast)}</dd></div><div><dt>ปีก่อน · ${escapeHtml(priorLabel(model))}</dt><dd>${prior(channel)}</dd></div></dl>
        <div class="daily-channel-comparison"><p>${comparisonBasis(channel)}</p><div>${summaryDelta(channel.yoySummary)}</div></div>
        <div class="daily-channel-growth">${channel.name === 'Event' ? `${channel.unknownEventSchedules ? `<span>รอวันขาย ${channel.unknownEventSchedules} งาน · รวมเฉพาะยอดจริงของงานเหล่านี้</span>` : ''}${channel.approvedPending?`<span>อนุมัติแล้ว · รอยอด ${channel.approvedPending} งาน</span>`:''}${eventReconciliationMarkup(model)}` : `<span class="daily-channel-growth-label">แนวโน้มสาขา</span><div class="daily-branch-counts">${branchCounts(channel,model.selectedPeriod && channel.rows.some(row=>['up','down','equal','new'].includes(row.yoy?.status)))}</div>`}</div>
      </article>`).join('')}
    </div>
    <details class="daily-summary-notes"><summary>วิธีเทียบและขอบเขตข้อมูล</summary><p>ส่วนต่าง = ${model.summary.yoySummary?.basis === 'actual' ? 'ยอดจริง' : 'ยอดคาดการณ์สาขา + คาดการณ์ Event'} − ยอดจริงเดือนเดียวกันปีก่อน · % ใช้ยอดปีก่อนเป็นฐาน · ยอดรวมช่องทางรวมสาขาที่มีในแต่ละปี จึงอาจมีจำนวนสาขาต่างกัน</p><p>โต / ตก นับสาขาที่จับคู่ฐานปีก่อนได้ โดยเทียบ${model.useActual?'ยอดจริงสะสม':'คาดการณ์ปิดเดือน'}กับยอดจริงเต็มเดือนปีก่อน · รอเทียบ = ไม่มีฐานเทียบ / ยังไม่มีคาดการณ์ · สาขาเปิดใหม่ = สาขาที่ไม่มีรายการปีก่อนจับคู่ได้</p><p>สรุปนี้ไม่รวมเป้าหมายของ Event ที่ยังไม่เริ่ม${model.pendingEvents ? ` (${number.format(model.pendingEvents)} จุดขาย)` : ''} · ดูรายการและคาดการณ์ตามวันเปิดขายของ Event ได้ในตารางด้านล่าง</p></details>
  </section>`;
}
function markup(data, state) {
  const model = buildSalesReportModel(data, state);
  return `<section class="page-head daily-sales-page-head">
    <p class="eyebrow">Sales operations</p>
    <div class="daily-sales-heading"><div><h1>Sales Report</h1><p class="lede">สรุปยอดขายและเป้าหมายแยกช่องทาง</p></div>${filterMarkup(model)}</div>
    ${sourceNote(model, data)}${data.approval_unavailable?'<p class="error-box">ยังโหลด Event ที่อนุมัติไม่ครบ กรุณารีเฟรชเพื่อตรวจรายการล่าสุด</p>':''}
  </section>
  ${model.selectedPeriod?.awaitingSource ? '<section class="card section-gap"><p class="empty-state">ยังไม่ได้รับยอดขายเดือนนี้จาก Excel ระบบจะแสดงยอดเมื่ออ่านข้อมูลสำเร็จ โดยเก็บยอดเดือนก่อนหน้าไว้ให้เลือกดูได้</p></section>' : summaryMarkup(model)+analyticsMarkup(model,state,dailyCell)+reportToolbar(state)+tableMarkup(model,state)}
  <details class="sales-method section-gap" aria-label="ที่มาของข้อมูล"><summary>ที่มาและสูตรคำนวณ</summary><p>ข้อมูลมาจากไฟล์ Sales Report ที่นำเข้า · สาขาที่เคยมียอดขายแล้ว หากวันถัดมาไม่บันทึก ให้นับเป็นยอด 0 ถึงวันล่าสุดในรายงาน · คาดการณ์สาขา = ยอดสะสมเดือนปัจจุบัน ÷ เลขวันที่ล่าสุดที่มีข้อมูลรายวันของกลุ่มสาขาอัปเดตถึง × จำนวนวันในเดือนที่เลือก เช่น ยอดถึง 17 ก.ย. หาร 17 แล้วคูณ 30 สำหรับเดือนกันยายน แยกวันอัปเดตสาขาออกจาก Event โดยนับเลข 0 ที่บันทึกจริงเป็นข้อมูล แต่ไม่นับช่องว่างหลังวันอัปเดต ใช้วันที่ของยอดขาย ไม่ใช้วันเปิดเว็บหรือเวลาซิงก์ และไม่เปลี่ยนตามวันที่รายวันที่เลือก คำนวณเฉพาะเดือนปัจจุบันและอนาคต หากไม่มีวันที่ยอดสะสมที่ถูกต้องจะแสดง — · Event = ยอดรายวันสะสมในช่วงงาน ÷ วันที่เปิดขายผ่านไปแล้ว × จำนวนวันเปิดขายในเดือนที่เลือก ตามช่วงงานที่ระบุในรายงานหรือรายชื่อ Event · เมื่อจบช่วงขายในเดือนนั้นใช้ยอดจริง ไม่ขยายถึงสิ้นเดือน · หากยังไม่มีช่วงวันขายที่ยืนยัน แสดง “รอวันเปิดขาย” ในตารางราย Event · ยอดคาดการณ์รวมใช้คาดการณ์สาขา + คาดการณ์ Event · งานที่ยังไม่ทราบวันขายใช้เฉพาะยอดจริงและระบุจำนวนงานที่รอข้อมูล · มุมมองรายปีรวมเฉพาะเดือนที่มีข้อมูลและไม่คาดการณ์</p></details>`;
}

const viewStates = new WeakMap();
export async function render(root, services) {
  const [report,catalog,approved] = await Promise.all([services.api('/api/daily-sales'),services.api('/api/events').catch(()=>null),services.approved||services.api('/api/events/approved').catch(()=>({items:[],unavailable:true}))]);
  const data = {...report,event_catalog:catalog,approved_events:approved.items||[],cancelled_events:approved.cancelled||[],approval_unavailable:approved.unavailable};
  const query = new URLSearchParams(globalThis.location?.search || '');
  const requestedYear = Number(query.get('year'));
  const requestedMonth = query.get('month');
  const requestedPeriod = requestedMonth ? buildSalesReportModel(data, {year:requestedYear,month:requestedMonth}).selectedPeriod : null;
  const hasRequestedPeriod=!!requestedPeriod && Number(requestedPeriod.year)===requestedYear;
  const state = resolveReportMonth(viewStates.get(root) || {autoMonth:!hasRequestedPeriod,year:hasRequestedPeriod?requestedYear:'',month:hasRequestedPeriod?requestedMonth:'',date:'',columns:REPORT_COLUMNS.map(([id])=>id)});
  state.listeners?.abort();
  state.listeners = new AbortController();
  viewStates.set(root, state);
  let columnTrigger = null;
  let pointerTogglesColumn = false;
  root.ownerDocument.addEventListener('pointerdown', (event) => {
    pointerTogglesColumn = event.target.closest?.('[data-column-key]') === columnTrigger && !!root.querySelector('#daily-column-menu')?.matches(':popover-open');
    const menu = root.querySelector('.daily-sales-columns');
    if (menu?.open && !menu.contains(event.target)) { menu.open = false; state.columnsOpen = false; }
  }, {signal:state.listeners.signal});
  const closeColumnMenu = () => {
    columnTrigger?.setAttribute('aria-expanded','false');
    const panel = root.querySelector('#daily-column-menu');
    if (panel?.matches(':popover-open')) panel.hidePopover();
  };
  root.ownerDocument.defaultView.addEventListener('resize',closeColumnMenu,{signal:state.listeners.signal});
  root.ownerDocument.addEventListener('scroll',event => {
    if (!root.querySelector('#daily-column-menu')?.contains(event.target)) closeColumnMenu();
  },{capture:true,signal:state.listeners.signal});
  const draw = () => {
    closeColumnMenu();
    const scrolls = [...root.querySelectorAll('.daily-branch-scroll')].map((el) => [el.scrollLeft, el.scrollTop]);
    root.innerHTML = markup(data, state);
    wireAnalytics(root,state,buildSalesReportModel(data,state),draw,REPORT_COLUMNS,dailyCell);
    root.querySelector('[data-sx-excel]')?.addEventListener('click',async(event)=>{
      const button=event.currentTarget;button.disabled=true;
      const status=root.querySelector('.sx-export-status');
      try{const {downloadSalesExcel}=await import('./sales-excel.mjs');downloadSalesExcel(buildSalesReportModel(data,state),state);status.textContent='ส่งออก Excel พร้อมสรุปช่องทาง ตามตัวกรองและคอลัมน์ที่เลือกแล้ว';}
      catch{status.textContent='ส่งออก Excel ไม่สำเร็จ กรุณาลองอีกครั้ง';}finally{button.disabled=false;}
    });
    root.querySelectorAll('.daily-branch-scroll').forEach((el, i) => { if (scrolls[i]) [el.scrollLeft, el.scrollTop] = scrolls[i]; });
    const restoreHeaderFocus = (key,tableId) => root.querySelector(`[data-column-key="${key}"][data-table-id="${tableId}"]`)?.focus({preventScroll:true});
    const panel = root.querySelector('#daily-column-menu');
    panel?.addEventListener('beforetoggle',event => {
      if (event.newState === 'closed' && columnTrigger?.isConnected) columnTrigger.setAttribute('aria-expanded','false');
    });
    panel?.addEventListener('keydown',event => {
      if (event.key === 'Escape') {
        closeColumnMenu();
        columnTrigger?.focus({preventScroll:true});
        event.preventDefault();
      }
    });
    root.querySelectorAll('[data-column-key]').forEach(button => button.addEventListener('click',() => {
      const wasOpen = pointerTogglesColumn || panel.matches(':popover-open') && columnTrigger === button;
      pointerTogglesColumn = false;
      closeColumnMenu();
      if (wasOpen) return;
      columnTrigger = button;
      const {columnKey:key, tableId, columnLabel:label} = button.dataset;
      const text = textColumns.has(key);
      const currentDirection = button.closest('th').getAttribute('aria-sort');
      const model = buildSalesReportModel(data,state);
      const period = tableId === 'main' ? model.selectedPeriod : model.scope.find(p=>p.key === tableId);
      const rows = tableId === 'main' ? model.totals.rows : aggregate([period], '').rows;
      const visibleKeys = [...button.closest('table').querySelectorAll('[data-column-key]')].map(el=>el.dataset.columnKey);
      const filters = activeTableFilters(state,tableId,visibleKeys);
      const filter = filters[key] || {};
      const options = columnChoices(rows,key,{period,selectedDate:tableId === 'main' ? model.selectedDate : '',query:state.branchQuery,filters});
      const allOptions = columnChoices(rows,key,{period,selectedDate:tableId === 'main' ? model.selectedDate : '',query:state.branchQuery});
      const chosen = selectedColumnValues(allOptions,filter);
      panel.setAttribute('aria-label',`กรอง ค้นหา และเรียง ${label}`);
      panel.innerHTML = `<div class="daily-column-menu-title"><div><span class="daily-menu-eyebrow">ตัวกรองคอลัมน์</span><strong>${escapeHtml(label)}</strong></div><button type="button" data-close-column aria-label="ปิดเมนู">×</button></div>
        <div class="daily-sort-actions"><button type="button" data-sort-direction="asc" aria-pressed="${currentDirection === 'ascending'}"><span aria-hidden="true">↑</span> ${text ? 'เรียง ก → ฮ / A → Z' : 'เรียงจากน้อยไปมาก'}</button>
        <button type="button" data-sort-direction="desc" aria-pressed="${currentDirection === 'descending'}"><span aria-hidden="true">↓</span> ${text ? 'เรียง ฮ → ก / Z → A' : 'เรียงจากมากไปน้อย'}</button></div>
        <button type="button" data-reset-sort>คืนลำดับเริ่มต้น</button>
        <div class="daily-column-filter-controls"><label for="daily-column-search">ค้นหาใน${escapeHtml(label)}</label><div class="daily-branch-search-row"><input id="daily-column-search" type="search" placeholder="ค้นหาแล้วติ๊กเลือกได้หลายรายการ…" autocomplete="off" value=""></div>
        <p class="help">ค้นหาและเลือกเพิ่มได้หลายครั้ง · รายการที่เลือกไว้จะไม่หายเมื่อเปลี่ยนคำค้น</p>
        <div class="daily-filter-select-actions"><button type="button" data-select-values>เลือกทั้งหมดที่พบ</button><button type="button" data-deselect-values>ยกเลิกที่พบ</button></div>
        <button type="button" data-deselect-all>ยกเลิกทั้งหมด เพื่อเลือกใหม่</button>
        <div class="daily-filter-options" role="group" aria-label="ค่าที่ต้องการแสดง"></div><p class="help" data-option-count aria-live="polite"></p></div>
        <div class="daily-filter-footer"><button type="button" data-apply-filter>ใช้ตัวกรอง</button><button type="button" data-clear-filter>ล้างตัวกรองคอลัมน์นี้</button></div>
        <p class="help">${key === 'yoy' ? 'เรียงตาม % เทียบปีก่อน · ' : key === 'gap' ? 'เรียงตามจำนวนเงิน (บาท) · ' : ''}${text ? 'เรียงตามตัวอักษรและตัวเลข' : 'ค่าที่เป็น — อยู่ท้ายรายการ'}</p>`;
      const apply = () => { draw(); restoreHeaderFocus(key,tableId); };
      panel.querySelector('[data-close-column]').addEventListener('click',() => { closeColumnMenu();button.focus({preventScroll:true}); });
      const searchInput = panel.querySelector('#daily-column-search');
      const matchingOptions = () => options.filter(option=>choiceMatches(option,searchInput.value));
      const drawOptions = () => {
        const matching = matchingOptions();
        panel.querySelector('.daily-filter-options').innerHTML = matching.map(option=>`<label><input type="checkbox" data-filter-value value="${escapeHtml(option.id)}"${chosen.has(option.id) ? ' checked' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('') || '<p class="help">ไม่พบค่าที่ตรงกับคำค้น</p>';
        panel.querySelector('[data-option-count]').textContent = `เลือกไว้ทั้งหมด ${chosen.size} รายการ · ในคำค้นนี้เลือก ${matching.filter(option=>chosen.has(option.id)).length} จาก ${matching.length}`;
      };
      searchInput.addEventListener('input',drawOptions);
      panel.querySelector('.daily-filter-options').addEventListener('change',event => {
        if (!event.target.matches('[data-filter-value]')) return;
        if (event.target.checked) chosen.add(event.target.value); else chosen.delete(event.target.value);
        const matching = matchingOptions();
        panel.querySelector('[data-option-count]').textContent = `เลือกไว้ทั้งหมด ${chosen.size} รายการ · ในคำค้นนี้เลือก ${matching.filter(option=>chosen.has(option.id)).length} จาก ${matching.length}`;
      });
      panel.querySelector('[data-select-values]').addEventListener('click',()=>{matchingOptions().forEach(option=>chosen.add(option.id));drawOptions();});
      panel.querySelector('[data-deselect-values]').addEventListener('click',()=>{matchingOptions().forEach(option=>chosen.delete(option.id));drawOptions();});
      panel.querySelector('[data-deselect-all]').addEventListener('click',()=>{chosen.clear();drawOptions();});
      const applyFilter = () => {
        state.tableFilters ||= {};
        state.tableFilters[tableId] ||= {};
        const next = selectedColumnFilter(allOptions,chosen);
        if (hasColumnFilter(next)) state.tableFilters[tableId][key] = next;
        else delete state.tableFilters[tableId][key];
        apply();
      };
      panel.querySelector('[data-apply-filter]').addEventListener('click',applyFilter);
      searchInput.addEventListener('keydown',event => {
        if (event.key === 'Enter' && !event.isComposing) {event.preventDefault();applyFilter();}
      });
      panel.querySelectorAll('[data-sort-direction]').forEach(control => control.addEventListener('click',() => {
        state.tableSorts ||= {};
        state.tableSorts[tableId] = {key,direction:control.dataset.sortDirection};
        apply();
      }));
      panel.querySelector('[data-reset-sort]').addEventListener('click',() => { delete state.tableSorts?.[tableId];apply(); });
      panel.querySelector('[data-clear-filter]').addEventListener('click',() => {delete state.tableFilters?.[tableId]?.[key];apply();});
      drawOptions();
      panel.showPopover();
      button.setAttribute('aria-expanded','true');
      const bounds = button.getBoundingClientRect();
      const viewport = root.ownerDocument.defaultView;
      panel.style.left = `${Math.max(8,Math.min(bounds.right - panel.offsetWidth,viewport.innerWidth - panel.offsetWidth - 8))}px`;
      const below = bounds.bottom + 6;
      panel.style.top = `${Math.max(8,Math.min(below,viewport.innerHeight - panel.offsetHeight - 8))}px`;
      searchInput.focus({preventScroll:true});
    }));
    root.querySelectorAll('[data-clear-table-filters]').forEach(button=>button.addEventListener('click',()=>{
      const tableId=button.dataset.clearTableFilters;
      delete state.tableFilters?.[tableId];
      draw();restoreHeaderFocus('branch',tableId);
    }));
    root.querySelector('[data-clear-branch]')?.addEventListener('click',() => {
      state.branchQuery = '';
      draw();
      restoreHeaderFocus('branch','main');
    });
    const menu = root.querySelector('.daily-sales-columns');
    menu?.addEventListener('toggle', () => { if (menu.isConnected) state.columnsOpen = menu.open; });
    menu?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        menu.open = false;
        state.columnsOpen = false;
        menu.querySelector('summary')?.focus({preventScroll:true});
        event.preventDefault();
      }
    });
    root.querySelectorAll('[data-report-column]').forEach((input) => input.addEventListener('change', (event) => {
      const key = event.currentTarget.dataset.reportColumn;
      const checked = event.currentTarget.checked;
      state.columnsOpen = true;
      state.columns = REPORT_COLUMNS.map(([id]) => id).filter((id) => id === key ? checked : state.columns.includes(id));
      if (!checked) for (const [tableId,sort] of Object.entries(state.tableSorts || {})) {
        if (sort.key === key || key === 'daily' && sort.key.startsWith('day:')) delete state.tableSorts[tableId];
      }
      if (!checked) for (const filters of Object.values(state.tableFilters || {})) {
        for (const id of Object.keys(filters)) if (id === key || key === 'daily' && id.startsWith('day:')) delete filters[id];
      }
      draw();
      root.querySelector(`[data-report-column="${key}"]`)?.focus({preventScroll:true});
    }));
    root.querySelector('[data-daily-sales-auto-month]')?.addEventListener('click', () => {
      Object.assign(state,resolveReportMonth({...state,autoMonth:true,date:''}));
      state.tableFilters={};
      draw();
    });
    root.querySelector('[data-daily-sales-year]')?.addEventListener('change', (event) => {
      state.autoMonth=false;
      state.year = event.currentTarget.value;
      state.tableFilters = {};
      state.month = state.year ? 'all' : '';
      state.date = '';
      draw();
    });
    root.querySelector('[data-daily-sales-month]')?.addEventListener('change', (event) => {
      state.autoMonth=false;
      state.month = event.currentTarget.value;
      state.tableFilters = {};
      state.date = '';
      draw();
    });
    root.querySelector('[data-daily-sales-date]')?.addEventListener('change', (event) => {
      state.autoMonth=false;
      state.date = event.currentTarget.value;
      state.tableFilters = {};
      draw();
    });
  };
  draw();
}

export const refreshReadonly = render;
