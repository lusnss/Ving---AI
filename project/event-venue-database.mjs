import { identifyVenue, predictRange, numeric, isBaanSuan } from './out/assets/event-predict-model.mjs';
import { confirmedBranchMapping, isLadpraoCounter } from './out/assets/branch-mapping.mjs';
const day=86400000;
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const monthNames=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const dateList=range=>{const dates=[];if(range)for(let t=Date.parse(range.start);t<=Date.parse(range.end);t+=day)dates.push(new Date(t).toISOString().slice(0,10));return dates;};
const monthKeys=range=>[...new Set(dateList(range).map(d=>d.slice(0,7)))];
const channelOf=text=>/เก็บเงินเอง|อีเวนท์นอก|sneaker|showcase|world\s*cup/i.test(text)?'direct':/ลานโปร|\bCDS\b|\bRBS\b|Sport[s]?\s*(?:World|Mall)|SPW|OLM/i.test(text)?'gp':'unknown';
export function historicalSchedules(rows){
 if(rows[0]?.[4]!=='วันที่ Event'||rows[0]?.[6]!=='ยอดขาย')throw Error('หัวตาราง Event 2025 เปลี่ยน');
 return rows.slice(1).flatMap((r,i)=>{
  const month=monthNames.indexOf(String(r[5]).trim())+1;
  if(!r[3]||!month)return [];
  const place=identifyVenue(r[1]),named=identifyVenue(r[3]),venue=place.unmapped?named:place;
  return [{id:'history2025-'+(i+2),year:2025,channel:channelOf(`${r[0]} ${r[2]}`),month,name:venue.unmapped?String(r[3]):venue.label,originalName:String(r[3]),venue,range:predictRange(r[4],2025),net:numeric(r[6]),days:numeric(r[7]),target:null,cogs:null,space:null,pc:null,shipping:null,other:null,row:i+2,sheet:'Event 2025',dateText:String(r[4])}];
 });
}
export function reportEventRows(period){
 const rows=period.branches||[],lastMall=rows.findLastIndex(b=>/^V[CMR]-\d+/i.test(b.branch_code)),nextStore=rows.findIndex((b,i)=>i>lastMall&&/^VA-\d+/i.test(b.branch_code));
 return rows.map((b,index)=>({...b,index:index+1})).filter((b,i)=>!confirmedBranchMapping(b)&&!isLadpraoCounter(b)&&!/^V[ACMR]-\d+/i.test(b.branch_code)&&((lastMall>=0&&nextStore>lastMall&&i>lastMall&&i<nextStore)||/EVENT|อีเวนท์|ลานโปร/i.test(`${b.branch_code} ${b.branch} ${b.type}`)));
}
export function mergeVenueDatabase(costData,report,{today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),salesStatus='saved'}={}){
 const groups=new Map(),issues=[];
 for(const source of costData.records||[]){
  const year=source.year||2026,venue=identifyVenue(source.name),range=source.range||predictRange(source.name,year);
  // Keep distinct same-period rows: only monthly continuations of the same named campaign merge.
  const eventName=String(source.originalName||source.name).toLowerCase().replace(/\s+/g,'').replace(/\([^)]*\)/g,'');
  const key=[year,venue.id,source.channel,range?.start,range?.end,year===2025?'':eventName].join('|')+(isBaanSuan(source)?'|baan-suan':'');
  const group=groups.get(key)||{...source,year,venue,range,databaseKey:key,id:key,parts:[]};group.parts.push(source);groups.set(key,group);
 }
 const events=[...groups.values()].map(g=>{
  const periods=g.parts.map(r=>r.month),duplicate=new Set(periods).size!==periods.length;
  const sum=field=>g.parts.every(r=>numeric(r[field])!==null)?g.parts.reduce((n,r)=>n+numeric(r[field]),0):null;
  const net=sum('net'),costDays=sum('days');
  return {...g,net,costNet:net,costDays,days:g.year===2025&&g.range?dateList(g.range).length:costDays,exclusion:duplicate?'มีหลายแถวในเดือนเดียวกัน ต้องตรวจยอดซ้ำ':(!g.range?'วันเริ่ม–สิ้นสุดหรือปีไม่ชัดเจน':''),salesSource:'google',sources:g.parts.map(p=>({source:'google',sheet:p.sheet||(p.channel==='gp'?'Event จ่าย GP':'Event เก็บเงินเอง'),row:p.row,month:p.month})),cogs:sum('cogs'),space:sum('space'),pc:sum('pc'),shipping:sum('shipping'),other:sum('other'),allocations:new Map(),ambiguous:false};
 });
 const entries=Object.entries(report?.periods||{}).filter(([k])=>/^(2025|2026)-\d{2}$/.test(k)).sort(([a],[b])=>a.localeCompare(b));
 // A report may supply a dated venue absent from the cost catalog. Its own
 // explicit schedule is sufficient; activity alone never supplies dates.
 for(const [,period] of entries)for(const row of reportEventRows(period)){
  const venue=identifyVenue(row.branch),range=predictRange(row.branch,period.year),channel=channelOf(`${row.branch} ${row.branch_code} ${row.type}`);
  if(!range||venue.unmapped)continue;
  if(events.some(e=>e.venue.id===venue.id&&isBaanSuan(e)===isBaanSuan(row.branch)&&e.range&&e.range.start<=range.end&&e.range.end>=range.start&&(e.channel===channel||e.channel==='unknown'||channel==='unknown')))continue;
  const key=['report',venue.id,channel,range.start,range.end].join('|')+(isBaanSuan(row.branch)?'|baan-suan':'');
  events.push({id:key,databaseKey:key,year:period.year,name:venue.label,originalName:row.branch,venue,range,channel,parts:[],row:row.index,net:null,costNet:null,costDays:null,days:null,target:null,cogs:null,space:null,pc:null,shipping:null,other:null,sources:[],salesSource:'sales-'+period.year,allocations:new Map(),ambiguous:false});
 }
 const reportOnly=[];
 for(const [key,period] of entries){
  const cutoff=[today,period.latest_date||today].sort()[0];
  for(const row of reportEventRows(period)){
   const venue=identifyVenue(row.branch),channel=channelOf(`${row.branch} ${row.branch_code} ${row.type}`),embedded=predictRange(row.branch,period.year);
   const numericEntries=Object.entries(row.daily_sales||{}).filter(([d,v])=>d.startsWith(key)&&d<=cutoff&&numeric(v)!==null);
   const active=numericEntries.filter(([,v])=>Number(v)!==0);
   if(!active.length)continue; // all-zero placeholders are not proof that an Event took place
   let candidates=events.filter(e=>!e.exclusion&&e.venue.id===venue.id&&isBaanSuan(e)===isBaanSuan(row.branch)&&e.range&&monthKeys(e.range).includes(key)&&(e.channel==='unknown'||channel==='unknown'||e.channel===channel));
   if(embedded)candidates=candidates.filter(e=>e.range.start===embedded.start&&e.range.end===embedded.end);
   candidates=candidates.filter(e=>active.every(([date])=>date>=e.range.start&&date<=e.range.end));
   const evidence={source:'sales-'+period.year,period:key,row:row.index,name:row.branch};
   let assigned=0;
   for(const [date,amount] of active){
    const matches=candidates.filter(e=>date>=e.range.start&&date<=e.range.end);
    if(matches.length!==1){for(const e of matches)e.ambiguous=true;continue;}
    const e=matches[0];e.allocations.set(date,[...(e.allocations.get(date)||[]),{amount:Number(amount),evidence}]);assigned++;
   }
   if(assigned<active.length){
    const reason=candidates.length?'มีวันที่ขายที่จับคู่งานไม่ได้หรือทับซ้อน':'ยังจับคู่กำหนดการกับชีตต้นทุนไม่ได้';
    issues.push({...evidence,venue:venue.label,reason});
    // Retain a discoverable place and evidence, but never manufacture trading dates.
    if(!candidates.length)reportOnly.push({id:`report-${key}-${row.index}`,databaseKey:`report-${key}-${row.index}`,year:period.year,name:venue.unmapped?row.branch:venue.label,originalName:row.branch,venue,channel,range:embedded,days:null,net:null,costNet:null,cogs:null,space:null,pc:null,shipping:null,other:null,target:null,row:row.index,salesSource:'sales-'+period.year,sources:[evidence],exclusion:reason});
   }
  }
 }
 for(const e of events){
  const dates=dateList(e.range),keys=monthKeys(e.range),covered=keys.length&&keys.every(k=>{const p=report?.periods?.[k];return p&&(p.latest_date||'')>=dates.filter(d=>d.startsWith(k)).at(-1);});
  const hasMonths=keys.every(k=>[...e.allocations.keys()].some(d=>d.startsWith(k)));
  const collisions=[...e.allocations.values()].some(v=>v.length>1);
  if(e.ambiguous||collisions)e.exclusion='ยอดรายวันตรงกับหลายงานหรือหลายแถว ต้องตรวจรายการซ้ำ';
  if(!e.exclusion&&covered&&hasMonths){
   e.net=round([...e.allocations.values()].reduce((s,v)=>s+v[0].amount,0));e.days=dates.length;e.salesSource='sales-'+e.year;
   const refs=[...new Map([...e.allocations.values()].flat().map(v=>[v.evidence.period+'-'+v.evidence.row,v.evidence])).values()];e.sources.push(...refs);
   e.difference=e.costNet===null?null:round(e.net-e.costNet);
   e.note='จำนวนวันตามกำหนดการ รวมวันยอดขายศูนย์; ความครบขึ้นอยู่กับการบันทึกในรายงาน';
  }else if(!e.exclusion){
   if(!e.parts.length)e.exclusion='รายงานยังไม่ครอบคลุมทุกเดือนของงาน';
   else if(e.year===2025){
    const months=new Set(e.parts.map(p=>`2025-${String(p.month).padStart(2,'0')}`));
    if(!keys.every(k=>months.has(k)))e.exclusion='ประวัติยังไม่ครอบคลุมทุกเดือนของงาน';
   }
   e.note='ใช้ยอดและจำนวนวันจากชีต เนื่องจากรายงานยังจับคู่ไม่ได้ครบช่วง';
  }
  if(!e.exclusion&&e.net===0&&!e.allocations.size)e.exclusion='รอยืนยันยอดขายจริง ต้นทางยังเป็นศูนย์';
  delete e.allocations;delete e.parts;delete e.ambiguous;
 }
 const records=[...events,...reportOnly];
 const sources=[{id:'google',label:'สรุปต้นทุนห้าง',status:costData.source?.status||'unavailable',fetched_at:costData.source?.fetched_at,records:events.length},...[2025,2026].map(year=>({id:'sales-'+year,label:'Sales Report '+(year+543),status:entries.some(([k])=>k.startsWith(year))?salesStatus:'unavailable',months:entries.filter(([k])=>k.startsWith(year)).map(([k])=>k),as_of:entries.filter(([k])=>k.startsWith(year)).map(([,p])=>p.latest_date).filter(Boolean).sort().at(-1)||null,fetched_at:entries.filter(([k])=>k.startsWith(year)).map(([,p])=>p.source?.fetched_at).filter(Boolean).sort().at(-1)||report?.source?.fetched_at||null,records:records.filter(r=>r.salesSource==='sales-'+year&&!r.exclusion).length}))];
 return {version:3,records,source:{...costData.source,sources,issues,rule:'ยอดรายวันจาก Sales Report ใช้แทนยอดชีตเมื่อจับคู่ได้ครบช่วง ไม่บวกยอดซ้ำ; ต้นทุนและเป้าหมายอิง Google Sheets'}};
}
