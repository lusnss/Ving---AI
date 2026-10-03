import {eventDateRange} from './event-forecast.mjs';
import {eventMonthNames} from './event-months.mjs';
import {excludeCancelledEvents,visibleEventCatalog} from './event-visibility.mjs';
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const normalize=value=>String(value||'').normalize('NFC').toLowerCase().replace(/\s+/g,' ').trim();
export function proposalCalendarItem(row){
 const explicitMonth=String(row.input?.eventMonth||row.month||'');
 const year=/^\d{4}-(0[1-9]|1[0-2])$/.test(explicitMonth)?Number(explicitMonth.slice(0,4)):Number(row.createdAt?.slice(0,4)||row.sourceYear)||null;
 const text=String(row.dates||'').replace(/(\d)\.(?=\d)/g,'$1/');
 const iso=text.match(/(\d{4}-\d{2}-\d{2})\s*(?:ถึง|[-–—])\s*(\d{4}-\d{2}-\d{2})/);
 const start=row.startDate||iso?.[1],end=row.endDate||iso?.[2];
 let range=validDate(start)&&validDate(end)&&start<=end?{start,end}:eventDateRange(text,year)||eventDateRange(row.name,year);
 if(range&&(!validDate(range.start)||!validDate(range.end)))range=null;
 const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(explicitMonth)?Number(explicitMonth.slice(5)):eventMonthNames.indexOf(explicitMonth)+1||Number(explicitMonth)||0;
 const eventYear=range?Number(range.start.slice(0,4)):year;
 if(!eventYear)return null;
 return {name:row.name||row.place,place:row.place,category:row.input?.channel||row.category||'',venue:row.input?.channel==='gp'?'Event จ่าย GP':row.input?.channel==='direct'?'Event เก็บเงินเอง':'Event ที่อนุมัติแล้ว',month,year:eventYear,range,dates:row.dates||'',days:row.days,pcCount:row.input?.pcCount??row.pc,shipping:row.input?.shipping??row.shipping,other:row.input?.other??row.other,approved:true,proposalKey:row.deletionKey,floor:row.floor||row.input?.floor||'',eventTypes:row.eventTypes||row.input?.eventTypes||[]};
}
const catalogRange=(item,year)=>item.range||eventDateRange(String(item.date||item.name).replace(/(\d)\.(?=\d)/g,'$1/'),year);
const eventIdentity=(item,year)=>{
 const range=catalogRange(item,year);
 if(!range)return null;
 const name=normalize(item.name).replace(/\s+\d{1,2}(?:[./-]\d{1,2})*[./]\d{2,4}.*$/,'').trim();
 return name+'|'+range.start+'|'+range.end;
};
export function summaryEventCatalog(catalog,proposals=[],cancelled=[]){
 cancelled=[...cancelled,...proposals.filter(row=>row.workflow?.status==='cancelled')];
 catalog=visibleEventCatalog(catalog,cancelled);
 const years=Object.fromEntries(Object.entries(catalog?.years||{}).map(([year,value])=>[year,{...value,items:(value.items||[]).map(item=>({...item}))}]));
 const seen=new Set();
 for(const row of excludeCancelledEvents(proposals,cancelled)){
  if(row.trade!=='อนุมัติ'||row.ceo!=='อนุมัติ'||seen.has(row.deletionKey))continue;
  if(row.deletionKey)seen.add(row.deletionKey);
  const item=proposalCalendarItem(row);if(!item)continue;
  const lastYear=item.range?Number(item.range.end.slice(0,4)):item.year;
  for(let year=item.year;year<=lastYear;year++){
   const group=years[year]??={year,items:[]};
   const identity=eventIdentity(item,year);
   const match=identity?group.items.findIndex(existing=>!existing.proposalKey&&eventIdentity(existing,year)===identity):-1;
   if(match>=0)group.items[match]={...group.items[match],...item};else group.items.push({...item});
  }
 }
 return {...catalog,years};
}
