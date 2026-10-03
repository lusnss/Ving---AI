import {proposalCalendarItem} from './summary-event-proposals.mjs';
import {identifyForecastVenue,identifyVenue} from './event-predict-model.mjs';
import {eventDateRange,eventForecast} from './event-forecast.mjs';
import {reportType} from './sales-channels.mjs';
import {excludeCancelledEvents} from './event-visibility.mjs';
const normalize=value=>String(value||'').normalize('NFC').toLowerCase().replace(/\d{1,2}\s*[-–/]\s*\d.*$/,'').replace(/(?:event|ลานโปร|อีเวนท์|อีเว้นท์|cds|rbs|sports?\s*(?:mall|world))/gi,'').replace(/[^a-z0-9ก-๙]/g,'');
const observed=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
function nameMatches(row,event){
 const a=normalize(row.branch),names=[event.name,event.place].map(normalize).filter(Boolean);
 if(a.length>=4&&names.includes(a))return true;
 const special=identifyForecastVenue(row.branch),target=identifyForecastVenue(event.name);
 if(target.id==='baan-suan')return special.id==='baan-suan';
 if(/\blhb\b/i.test(event.name)&&/\blhb\b/i.test(row.branch))return true;
 const venue=identifyVenue(row.branch),place=identifyVenue(event.place||event.name);
 return !venue.unmapped&&!place.unmapped&&venue.id===place.id;
}
function compatible(row,event,period){
 if(reportType(row)!=='Event'||!nameMatches(row,event))return false;
 const range=event.range,key=period.key;
 const explicit=eventDateRange(row.branch,period.year);
 if(explicit&&(explicit.start!==range.start||explicit.end!==range.end))return false;
 const activity=Object.entries(row.daily_sales||{}).filter(([d,v])=>d.startsWith(key)&&observed(v)&&Number(v)!==0).map(([d])=>d);
 return activity.every(d=>d>=range.start&&d<=range.end);
}
// Join only mutually unique event rows. Sales stay on their original imported row.
export function attachApprovedSalesEvents(periods,proposals=[],today,cancelled=[]){
 cancelled=[...cancelled,...proposals.filter(row=>row.workflow?.status==='cancelled')];
 const events=[],seen=new Set();
 for(const row of excludeCancelledEvents(proposals,cancelled)){if(row.trade!=='อนุมัติ'||row.ceo!=='อนุมัติ')continue;
  const item=proposalCalendarItem(row);if(!item?.range)continue;
  const key=row.deletionKey||JSON.stringify([row.name,row.place,item.range]);if(seen.has(key))continue;seen.add(key);events.push({...item,key});
 }
 const result=periods.map(p=>({...p,branches:p.branches.filter(b=>reportType(b)!=='Event'||excludeCancelledEvents([b],cancelled,p.year).length).map(b=>({...b}))}));
 for(const event of events){for(let date=event.range.start.slice(0,7)+'-01';date<=event.range.end;){
  const key=date.slice(0,7);if(!result.some(p=>p.key===key))result.push({key,year:Number(key.slice(0,4)),month:Number(key.slice(5)),projected:true,dates:[],latest_date:null,branches:[]});
  const d=new Date(date+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);date=d.toISOString().slice(0,10);
 }}
 for(const period of result){
  const monthEvents=events.filter(e=>e.range.start<=period.key+'-31'&&e.range.end>=period.key+'-01');
  const candidates=new Map(monthEvents.map(e=>[e.key,period.branches.filter(b=>compatible(b,e,period))]));
  for(const event of monthEvents){
   const matches=candidates.get(event.key),row=matches.length===1&&monthEvents.filter(e=>candidates.get(e.key).includes(matches[0])).length===1?matches[0]:null;
   if(row){row.approved_event_key=event.key;row.approved_event_name=event.name;row.event_match='matched';row.event_schedule=event.range;row.event_forecast=eventForecast(row,period,event.range,today);}
   else period.branches.push({type:'Event',source_section:'event',branch:event.name,branch_code:'',month_to_date:null,target:null,daily_sales:{},approved_event_key:event.key,approved_event_name:event.name,event_match:matches.length?'ambiguous':'waiting',event_schedule:event.range,event_forecast:null});
  }
 }
 return result;
}
