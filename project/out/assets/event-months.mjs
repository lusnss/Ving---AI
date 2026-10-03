import { eventDateRange } from './event-forecast.mjs';
import {predictRange} from './event-predict-model.mjs';

export function eventCatalogRange(item,year){
 return predictRange(item.date||item.name,Number(year))||eventDateRange(item.date||item.name,Number(year));
}

export const eventMonthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

export function eventMonths(item, year) {
  const range = eventCatalogRange(item,year);
  if (range) {
    return Array.from({length:12}, (_, i) => i + 1).filter(month => {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const lastDay = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
      return range.start <= `${prefix}-${lastDay}` && range.end >= `${prefix}-01`;
    });
  }
  // When dates are missing or invalid, retain the month explicitly recorded in the catalog.
  return [...new Set([...(item.months||[]),item.month].map(Number).filter(month=>Number.isInteger(month)&&month>=1&&month<=12))].sort((a,b)=>a-b);
}

export function normalizeEventMonth(value) {
  return /^(?:[1-9]|1[0-2]|unknown)$/.test(String(value)) ? String(value) : 'all';
}
