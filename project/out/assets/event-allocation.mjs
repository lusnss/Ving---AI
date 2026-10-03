import {eventCatalogRange} from './event-months.mjs';
const day=86400000;
const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const identity=r=>JSON.stringify([r.channel,(r.code||r.name).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),r.basis]);
const fields=['gross','discount','net','cogs','opex','grossProfit','profit','sourceProfit','difference'];
const scale=(value,ratio)=>Number.isFinite(value)?value*ratio:value;
// A single booked event total is allocated across inclusive calendar days.
// Repeated monthly bookings are retained, never redistributed a second time.
export function allocateEventRecords(records){
 const periods=new Map();
 for(const r of records){if(!r.channel.startsWith('event-'))continue;const key=identity(r);if(!periods.has(key))periods.set(key,new Set());periods.get(key).add(`${r.year}-${r.month}`);}
 return records.flatMap(r=>{
  if(!r.channel.startsWith('event-')||r.allocation)return [r];
  const range=r.range||eventCatalogRange(r,r.year);
  if(!range||!valid(range.start)||!valid(range.end)||range.start>range.end||Date.parse(range.end)-Date.parse(range.start)>366*day)return [{...r,allocationWarning:'วันที่จัดงานไม่ครบหรือไม่ถูกต้อง · ใช้เดือนที่บันทึก'}];
  if(r.amountScope==='monthly'||periods.get(identity(r)).size>1)return [{...r,allocationWarning:'มีรายการแยกเดือน · คงยอดตามเดือนที่บันทึก ไม่เฉลี่ยซ้ำ'}];
  const totalDays=(Date.parse(range.end)-Date.parse(range.start))/day+1;
  const result=[];
  let cursor=new Date(range.start);cursor.setUTCDate(1);
  while(cursor.toISOString().slice(0,10)<=range.end){
   const year=cursor.getUTCFullYear(),month=cursor.getUTCMonth()+1;
   const start=[range.start,cursor.toISOString().slice(0,10)].sort().at(-1);
   const end=[range.end,new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)].sort()[0];
   const days=(Date.parse(end)-Date.parse(start))/day+1,ratio=days/totalDays;
   const row={...r,year,month,costs:Object.fromEntries(Object.entries(r.costs).map(([key,v])=>[key,scale(v,ratio)]))};
   for(const key of fields)row[key]=scale(r[key],ratio);
   row.allocation={key:JSON.stringify([r.channel,(r.code||r.name).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),range.start,range.end]),range,days,totalDays,ratio,sourceMonth:r.month,sourceYear:r.year,net:r.net,profit:r.profit,dailyNet:scale(r.net,1/totalDays),dailyProfit:scale(r.profit,1/totalDays),crossMonth:range.start.slice(0,7)!==range.end.slice(0,7)};
   result.push(row);cursor.setUTCMonth(cursor.getUTCMonth()+1);
  }
  return result;
 });
}
