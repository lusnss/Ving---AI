import {eventDateRange} from './event-forecast.mjs';
import {eventCatalogRange,eventMonths,eventMonthNames} from './event-months.mjs';
import {identifyVenue} from './event-predict-model.mjs';

export const isCancelledEvent=row=>row.workflow?.status==='cancelled';
const keyOf=row=>row.deletionKey||row.proposalKey||row.approved_event_key;
const nameOf=value=>String(value||'').normalize('NFC').toLowerCase().replace(/\s*\(?\d{1,2}[./-]\d.*$/,'').replace(/\s+/g,' ').trim();
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function identity(row,fallbackYear){
 const month=String(row.input?.eventMonth||row.month||'');
 const year=Number(row.year||row.sourceYear||(/^\d{4}-\d{2}$/.test(month)?month.slice(0,4):row.createdAt?.slice(0,4))||fallbackYear)||null;
 const dates=String(row.dates||row.date||'').replace(/(\d)\.(?=\d)/g,'$1/');
 const iso=dates.match(/(\d{4}-\d{2}-\d{2})\s*(?:ถึง|[-–—])\s*(\d{4}-\d{2}-\d{2})/);
 let range=row.range||row.event_schedule||(row.startDate||iso?{start:row.startDate||iso?.[1],end:row.endDate||iso?.[2]}:null);
 range=range||eventDateRange(dates,year)||eventCatalogRange({...row,name:row.name||row.branch},year);
 if(!validDate(range?.start)||!validDate(range?.end)||range.start>range.end)range=null;
 return {range,year:range?Number(range.start.slice(0,4)):year,month:/^\d{4}-\d{2}$/.test(month)?Number(month.slice(5)):eventMonthNames.indexOf(month)+1||Number(month)||0,name:nameOf(row.name||row.branch),place:nameOf(row.place),venue:identifyVenue(row.place||row.name||row.branch||''),categories:[...new Set([row.input?.channel,row.category,...(row.categories||[])].filter(v=>['gp','direct'].includes(v)))]};
}
export function sameEventOccurrence(a,b,year){
 if(keyOf(a)&&keyOf(a)===keyOf(b))return true;
 const left=identity(a,year),right=identity(b,year);
 if(left.categories.length&&right.categories.length&&!left.categories.some(c=>right.categories.includes(c)))return false;
 if(left.range||right.range){
  if(!left.range||!right.range||left.range.start!==right.range.start||left.range.end!==right.range.end)return false;
  return !!left.name&&left.name===right.name||!left.venue.unmapped&&!right.venue.unmapped&&left.venue.id===right.venue.id;
 }
 // Undated records require the same recorded period and exact name/place.
 return !!left.year&&left.year===right.year&&!!left.month&&left.month===right.month&&!!left.name&&left.name===right.name&&left.place===right.place;
}
export function excludeCancelledEvents(items=[],cancelled=[],year){
 const excluded=[...cancelled.filter(isCancelledEvent),...items.filter(isCancelledEvent)];
 return items.filter(row=>!isCancelledEvent(row)&&!excluded.some(other=>sameEventOccurrence(row,other,year)));
}
export function visibleEventCatalog(catalog,cancelled=[]){
 if(!catalog)return catalog;
 const years=Object.fromEntries(Object.entries(catalog.years||{}).map(([year,current])=>{
  const items=excludeCancelledEvents(current.items||[],cancelled,year);
  if(items.length===(current.items||[]).length)return [year,current];
  const removed=current.items.filter(row=>!items.includes(row));
  const months=(current.months||[]).map((month,index)=>{const number=eventMonthNames.indexOf(month.month)+1||Number(month.month)||index+1;return {...month,count:Math.max(0,month.count-removed.filter(row=>Number(year)===2026?Number(row.month)===number:eventMonths(row,year).includes(number)).length)};});
  return [year,{...current,items,months,top_events:excludeCancelledEvents(current.top_events||[],cancelled,year),summary:{...current.summary,count:items.length,with_sales:items.filter(row=>row.sales>0).length,planned:items.filter(row=>Number(year)===2026?!row.report_rows:!(row.sales>0)).length},sources:(current.sources||[]).map(source=>({...source,count:items.filter(row=>(row.categories||[row.category]).some(c=>source.label===(c==='gp'?'Event จ่าย GP':'Event เก็บเงินเอง'))).length}))}];
 }));
 return {...catalog,years};
}
export function visibleEventFinancials(data,cancelled=data?.cancelledProposals||[]){
 if(!data)return data;
 return {...data,records:(data.records||[]).filter(row=>!row.channel?.startsWith('event-')||excludeCancelledEvents([{...row,category:row.channel.slice(6)}],cancelled,row.year||data.year).length)};
}
