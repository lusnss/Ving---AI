import { eventDateRange } from './event-forecast.mjs';

const thaiMonths = {มค:'ม.ค.',กพ:'ก.พ.',มีค:'มี.ค.',เมย:'เม.ย.',พค:'พ.ค.',มิย:'มิ.ย.',กค:'ก.ค.',สค:'ส.ค.',กย:'ก.ย.',ตค:'ต.ค.',พย:'พ.ย.',ธค:'ธ.ค.'};
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

export function eventSalesMetrics(item, year, asOf = null) {
  // The historical sheet uses both กค. and ก.ค., and sometimes 11-เม.ย.
  const text = String(item.date || item.name || '').replace(/[–—]/g,'-');
  const normalized = text.replace(/(\d{1,2})\s*-?\s*(ม\.?\s*ค|ก\.?\s*พ|มี\.?\s*ค|เม\.?\s*ย|พ\.?\s*ค|มิ\.?\s*ย|ก\.?\s*ค|ส\.?\s*ค|ก\.?\s*ย|ต\.?\s*ค|พ\.?\s*ย|ธ\.?\s*ค)\.*/g,(_,day,month)=>`${day} ${thaiMonths[month.replace(/[.\s]/g,'')]}`);
  const range = eventDateRange(normalized, Number(year));
  const missing = {days:null, dailySales:null};
  if (!range || (asOf !== null && !validDate(asOf))) return missing;
  const end = asOf && asOf < range.end ? asOf : range.end;
  if (end < range.start) return missing;
  const days = (Date.parse(end)-Date.parse(range.start))/86400000+1;
  const hasSales = item.sales != null && String(item.sales).trim() !== '' && Number.isFinite(Number(item.sales));
  return {days, dailySales:hasSales ? Number(item.sales)/days : null};
}
