import {summaryEventKey} from './summary-event-key.mjs';
import {reportData} from './daily-comparison-data.mjs';
import {groups} from './daily-comparison-model.mjs';
import {buildSalesReportModel} from './daily-sales.mjs';
import {comparisonCounts} from './sales-yoy.mjs';
import {summarize,outcomeCounts,months} from './profit-loss.mjs';
import {summaryEventCatalog} from './summary-event-proposals.mjs';
import {eventMonths} from './event-months.mjs';
import {eventDateRange} from './event-forecast.mjs';
import {visibleEventFinancials,sameEventOccurrence} from './event-visibility.mjs';

export {groups,months};
export const shortMonths=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export const todayBangkok=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export const keyFor=(year,month)=>`${year}-${String(month).padStart(2,'0')}`;
export const daysIn=(year,month)=>new Date(Date.UTC(year,month,0)).getUTCDate();
export const finite=v=>typeof v==='number'&&Number.isFinite(v);
const sum=values=>values.some(finite)?Math.round(values.reduce((n,v)=>n+(finite(v)?v:0),0)*100)/100:null;
export const statusLabels={ongoing:'กำลังจัด',upcoming:'กำลังจะจัด',completed:'จัดแล้ว',unknown:'รอยืนยันวันที่'};
export function eventStatus(item,year,today=todayBangkok()){
 const range=item.range||eventDateRange(item.date||item.name,Number(year));
 return {range,status:!range?'unknown':range.end<today?'completed':range.start>today?'upcoming':'ongoing'};
}
export function monthlyEvents(catalog,year,month,today=todayBangkok()){
 return (catalog?.years?.[String(year)]?.items||[]).filter(item=>item.range?item.range.start<=`${keyFor(year,month)}-${daysIn(year,month)}`&&item.range.end>=`${keyFor(year,month)}-01`:eventMonths(item,year).includes(Number(month))).map((item,index)=>({...item,id:item.proposalKey||`${year}-${month}-${index}`,...eventStatus(item,year,today)}));
}
const basisLabel=rows=>{const bases=[...new Set(rows.map(r=>r.basis))];return bases.length>1?'ACT + FCT':bases[0]==='FCT'?'คาดการณ์ FCT':bases.length?'ยอดบันทึก ACT':'ไม่มีข้อมูล';};
export function financeBranches(records){
 const by=new Map();for(const r of records){if(r.channel.startsWith('event-'))continue;const key=JSON.stringify([r.channel,(r.code||r.name).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()]);if(!by.has(key))by.set(key,[]);by.get(key).push(r);}
 return [...by].map(([id,rows])=>{const f=summarize(rows);return {id,name:rows[0].name,channel:rows[0].channel,...f,status:f.profit===null||f.missingCore?'pending':Math.round(f.profit*100)>0?'profit':Math.round(f.profit*100)<0?'loss':'zero',basis:basisLabel(rows)};});
}
// Count the calendar's events once, using all recorded periods for the same event occurrence.
// Approved proposals without matching financials remain pending.
export function eventOutcomes(events,records,year){
 const financials=records.filter(row=>row.channel?.startsWith('event-'));
 const matches=financials.map(row=>({row,events:events.filter(item=>sameEventOccurrence(item,{...row,category:row.channel.slice(6)},year))}));
 return events.map(event=>{
  const candidates=matches.filter(match=>match.events.includes(event));
  const rows=candidates.filter(match=>match.events.length===1).map(match=>match.row);
  const pending=reason=>({event,status:'pending',profit:null,reason,basis:basisLabel(rows),months:[...new Set(rows.map(row=>row.month))].sort((a,b)=>a-b)});
  if(candidates.some(match=>match.events.length!==1))return pending('ยังจับคู่งบกับ Event ได้ไม่ชัดเจน');
  if(!rows.length)return pending('ยังไม่มีงบที่ตรงกับรอบจัด Event และฐานที่เลือก');
  const result=summarize(rows);
  if(!finite(result.profit)||result.missingCore||result.pending)return pending('ยอดขายสุทธิหรือต้นทุนในงบยังไม่ครบ');
  const cents=Math.round(result.profit*100);
  return {event,status:cents>0?'profit':cents<0?'loss':'zero',profit:result.profit,reason:'',basis:basisLabel(rows),months:[...new Set(rows.map(row=>row.month))].sort((a,b)=>a-b)};
 });
}
export function eventOutcomeCounts(events,records,year){
 const counts={total:events.length,profit:0,loss:0,zero:0,pending:0};
 for(const result of eventOutcomes(events,records,year))counts[result.status]++;
 return counts;
}
// Latest recorded sales and a separate shared-period comparison.
// No Sales Report totals or P&L revenue are added to this sales source.
export function salesWindow(source,year,month,day=null,channel='all',today=todayBangkok(),basis='latest'){
 const y=year+543,available=source?.sources?.[String(y)]?.status==='ready';
 const rows=(source?.records||[]).filter(r=>r.year===y);
 const limits=groups.map(g=>rows.filter(r=>r.group===g.name&&r.lastDay!==null).reduce((n,r)=>Math.max(n,r.month*100+r.lastDay),0)).filter(Boolean);
 let cutoff=limits.length?(basis==='matched'?Math.min(...limits):Math.max(...limits)):0;
 if(year===Number(today.slice(0,4)))cutoff=Math.min(cutoff,Number(today.slice(5,7))*100+Number(today.slice(8)));
 if(year>Number(today.slice(0,4)))cutoff=0;
 const endDay=month===Math.floor(cutoff/100)?cutoff%100:daysIn(year,month);
 const future=!cutoff||month>Math.floor(cutoff/100);
 const start=day??1,end=day??endDay;
 const aggregate=(target,g)=>{
  const ready=source?.sources?.[String(target)]?.status==='ready';
  if(!ready||(target===y&&(future||(day!==null&&day>endDay)))||end>daysIn(target-543,month))return {amount:null,complete:false};
  const groupRows=(source.records||[]).filter(r=>r.year===target&&r.month===month&&r.group===g.name);
  const values=[],seen=new Set();for(const row of groupRows)for(let d=start;d<=end;d++){const v=row.daily[d-1];if(finite(v)){values.push(v);seen.add(d);}}
  return {amount:sum(values),complete:seen.size===end-start+1&&end>=start};
 };
 const compare=(a,b)=>{const known=a.complete&&b.complete&&finite(a.amount)&&finite(b.amount);const delta=known?Math.round((a.amount-b.amount)*100)/100:null;return {current:a.amount,previous:b.amount,complete:a.complete,previousComplete:b.complete,delta,growth:known&&b.amount>0?delta/b.amount:null};};
 const channels=groups.map(g=>{const last=rows.filter(r=>r.group===g.name&&r.month===month).reduce((n,r)=>Math.max(n,...r.daily.slice(0,end).map((v,i)=>finite(v)?i+1:0)),0);return {...g,...compare(aggregate(y,g),aggregate(y-1,g)),recordedThrough:last?`${year}-${String(month).padStart(2,'0')}-${String(last).padStart(2,'0')}`:null};});
 const included=channels.filter(c=>channel==='all'||c.id===channel);
 const combined=key=>({amount:sum(included.map(c=>c[key])),complete:included.length>0&&included.every(c=>c[key==='current'?'complete':'previousComplete'])});
 return {...compare(combined('current'),combined('previous')),channels,available,latest:cutoff?`${year}-${String(Math.floor(cutoff/100)).padStart(2,'0')}-${String(cutoff%100).padStart(2,'0')}`:null,endDay,future,startDay:start,...(basis==='latest'?{matched:salesWindow(source,year,month,day,channel,today,'matched')}:{})};
}
const caches=new WeakMap();
export function buildSummaryModel(data,state,today=todayBangkok()){
 const year=Number(state.year),month=Number.isInteger(Number(state.month))&&Number(state.month)>=1&&Number(state.month)<=12?Number(state.month):Number(today.slice(5,7));
 const basis=['ACT','FCT'].includes(state.basis)?state.basis:'all';
 const cacheKey=`${year}|${basis}|${today}`;let cache=caches.get(data);if(!cache){cache=new Map();caches.set(data,cache);}
 let base=cache.get(cacheKey);
 if(!base){
  const calendar=summaryEventCatalog(data.events,data.approvedProposals,data.cancelledProposals);
  const deleted=new Set(data.deletedSummaryEvents||[]);
  for(const [eventYear,group] of Object.entries(calendar.years||{}))group.items=group.items.map(item=>({...item,summaryKey:summaryEventKey(item,eventYear)})).filter(item=>!deleted.has(item.summaryKey));
  const source=data.comparison===undefined?reportData:data.comparison;
  const report={...(data.report||{periods:{}}),event_catalog:data.events};
  const records=(data.pnl?.year===year?visibleEventFinancials(data.pnl,data.cancelledProposals).records:[]).filter(r=>basis==='all'||r.basis===basis);
  const monthly=months.map((_,i)=>{
   const sales=buildSalesReportModel(report,{year,month:keyFor(year,i+1)},today),rows=records.filter(r=>r.month===i+1),events=monthlyEvents(calendar,year,i+1,today);
   const department=sales.channels.filter(c=>['RBS','CDS','TM'].includes(c.name)).flatMap(c=>c.rows);
   const standalone=sales.channels.filter(c=>c.name==='Stand alone').flatMap(c=>c.rows);
   const counts=Object.fromEntries(Object.keys(statusLabels).map(k=>[k,events.filter(item=>item.status===k).length]));
   const revenue=salesWindow(source,year,i+1,null,'all',today);
   return {month:i+1,sales,actual:revenue.current,revenue,finance:summarize(rows),records:rows,basis:basisLabel(rows),events,counts,department,standalone,standaloneGrowth:comparisonCounts(standalone),growth:comparisonCounts(department),branches:financeBranches(rows),outcomes:outcomeCounts(rows)};
  });
  base={source,calendar,year,monthly,today,canDeleteEvents:!!data.permissions?.canEdit,eventRecords:records.filter(r=>r.channel?.startsWith('event-')),eventBasis:basis==='all'?'ACT + FCT':basis,eventsUnavailable:!calendar?.years?.[String(year)],unknownEvents:(calendar.years?.[String(year)]?.items||[]).filter(item=>!item.range&&!eventMonths(item,year).length).length};cache.set(cacheKey,base);
 }
 const selected=base.monthly[month-1];const requested=Number(state.day);const day=Number.isInteger(requested)&&requested>=1&&requested<=daysIn(year,month)?requested:Math.max(1,selected.revenue.future?1:selected.revenue.endDay);
 const grain=state.grain==='day'?'day':'month';const channel=groups.some(g=>g.id===state.channel)?state.channel:'all';
 const revenue=salesWindow(base.source,year,month,grain==='day'?day:null,channel,today);
 const last=month>1?base.monthly[month-2].actual:null;
 return {...base,month,day,grain,channel,selected,revenue,counts:selected.outcomes,salesMoM:finite(selected.actual)&&last>0?(selected.actual-last)/last:null};
}
export function visibleSummaryEvents(model,state){
 const order={ongoing:0,upcoming:1,unknown:2,completed:3};const selectedDate=`${keyFor(model.year,model.month)}-${String(model.day).padStart(2,'0')}`;
 return model.selected.events.filter(item=>(!state.eventStatus||state.eventStatus==='all'||item.status===state.eventStatus)&&(model.grain!=='day'||item.range&&item.range.start<=selectedDate&&item.range.end>=selectedDate)).sort((a,b)=>order[a.status]-order[b.status]||(a.range?.start||'').localeCompare(b.range?.start||''));
}
export function chartSeries(model,state){
 if(state.metric==='growth'&&state.growthChannel==='standalone')return chartSeries({...model,monthly:model.monthly.map(m=>({...m,department:m.standalone,growth:m.standaloneGrowth}))},{...state,growthChannel:'department'});
 const metric=state.metric||'sales';
 if(metric==='sales')return (model.grain==='day'?Array.from({length:daysIn(model.year,model.month)},(_,i)=>({key:i+1,label:String(i+1),...salesWindow(model.source,model.year,model.month,i+1,model.channel,model.today)})):model.monthly.map(m=>({key:m.month,label:shortMonths[m.month-1],...salesWindow(model.source,model.year,m.month,null,model.channel,model.today)}))).map(r=>({...r,a:r.current,b:r.previous}));
 if(metric==='growth'&&!state.branch&&state.growthStatus&&state.growthStatus!=='all')return model.monthly.map(m=>({key:m.month,label:shortMonths[m.month-1],a:m.department.length?m.growth[state.growthStatus]:null,b:null}));
 if(metric==='growth')return model.monthly.map(m=>({key:m.month,label:shortMonths[m.month-1],a:state.branch?m.department.find(r=>`${r.type}|${r.branch_code}|${r.branch}`===state.branch)?.forecast??null:m.department.length?m.growth.up:null,b:state.branch?m.department.find(r=>`${r.type}|${r.branch_code}|${r.branch}`===state.branch)?.yoy?.actual??null:m.department.length?m.growth.down:null}));
 if(metric==='finance'&&!state.branch&&state.profitStatus&&state.profitStatus!=='all')return model.monthly.map(m=>({key:m.month,label:shortMonths[m.month-1],a:m.records.length?m.outcomes.branches[state.profitStatus]:null,b:null}));
 if(metric==='finance')return model.monthly.map(m=>({key:m.month,label:shortMonths[m.month-1],a:state.branch?m.branches.find(r=>r.id===state.branch)?.profit??null:m.records.length?m.outcomes.branches.profit:null,b:state.branch?null:m.records.length?m.outcomes.branches.loss:null}));
 const events=state.event?model.selected.events.filter(r=>r.id===state.event):model.selected.events.filter(r=>!state.eventStatus||state.eventStatus==='all'||r.status===state.eventStatus);
 return model.grain==='day'?Array.from({length:daysIn(model.year,model.month)},(_,i)=>{const key=i+1,dt=`${keyFor(model.year,model.month)}-${String(key).padStart(2,'0')}`;return {key,label:String(key),a:model.eventsUnavailable?null:events.filter(r=>r.range&&r.range.start<=dt&&r.range.end>=dt).length,b:null};}):model.monthly.map(m=>({key:m.month,label:shortMonths[m.month-1],a:model.eventsUnavailable?null:m.events.filter(r=>(!state.eventStatus||state.eventStatus==='all'||r.status===state.eventStatus)&&(!state.event||events.some(s=>(s.proposalKey&&s.proposalKey===r.proposalKey)||s.name===r.name&&s.range?.start===r.range?.start))).length,b:null}));
}
