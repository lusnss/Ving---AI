import {eventDateRange} from './event-forecast.mjs';
import {eventMonthLabel} from './event-planning-fields.mjs';

const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const short=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const year=value=>Number(value)>2400?Number(value)-543:Number(value);
const isoMonth=value=>{const match=String(value||'').match(/^(\d{4})-(0[1-9]|1[0-2])(?:$|-\d{2})/);return match?`${year(match[1])}-${match[2]}`:null;};

// Use the recorded event month; dates supply a year only when explicitly present.
export function proposalMonth(row){
 const value=String(row.input?.eventMonth||row.month||'').trim();
 const explicit=isoMonth(value);if(explicit)return explicit;
 const start=isoMonth(row.startDate||row.input?.startDate)||isoMonth(row.dates);
 const dates=String(row.dates||'').replace(/(\d)\.(?=\d)/g,'$1/');
 const range=start?null:eventDateRange(dates,NaN);
 const dated=start||range?.start.slice(0,7);
 const monthIndex=months.findIndex((name,i)=>value.includes(name)||value.includes(short[i]));
 const numeric=/^(0?[1-9]|1[0-2])$/.test(value)?Number(value):null;
 const month=monthIndex>=0?monthIndex+1:numeric;
 if(month){
  const recordedYear=value.match(/(?:^|\s)(\d{4})(?:$|\s)/)?.[1];
  let knownYear=recordedYear?year(recordedYear):dated?Number(dated.slice(0,4)):row.sourceYear?year(row.sourceYear):null;
  if(!recordedYear&&range&&month<Number(range.start.slice(5,7)))knownYear=Number(range.end.slice(0,4));
  return knownYear?`${knownYear}-${String(month).padStart(2,'0')}`:`month-${String(month).padStart(2,'0')}`;
 }
 return dated||'unknown';
}
export function proposalMonthLabel(key){
 if(key==='all')return 'ทุกเดือน';
 if(key==='unknown')return 'ไม่ระบุเดือน';
 if(/^month-(0[1-9]|1[0-2])$/.test(key))return months[Number(key.slice(-2))-1]+' (ไม่ระบุปี)';
 return eventMonthLabel(key);
}
export const filterProposalMonth=(items,month='all')=>month==='all'?items:items.filter(row=>proposalMonth(row)===month);
export function proposalMonthOptions(items,selected='all'){
 const keys=new Set(items.map(proposalMonth));
 if(selected!=='all')keys.add(selected);
 return [...keys].sort((a,b)=>a==='unknown'?1:b==='unknown'?-1:a.localeCompare(b)).map(value=>({value,label:proposalMonthLabel(value)}));
}
