export const scheduleSourceUrl='https://docs.google.com/spreadsheets/d/1iRZDTA6gbkCGOH-bVGumf4R7N_PjlzWdo14vXs2t1fU/edit?gid=1732890767#gid=1732890767';
export const scheduleMode=value=>value==='logistics'?'logistics':'timeline';
export function retainSchedule(next,previous){
 if(next?.source?.status==='online')return next;
 if(previous?.source?.fetched_at&&(!next?.source?.fetched_at||previous.source.fetched_at>next.source.fetched_at))return {...previous,source:{...previous.source,status:'stale'}};
 return next;
}
export function sheetScheduleItems(feed,mode='timeline'){
 return (feed?.items||[]).flatMap(row=>{
  const base={...row,source:'sheet',eventTypes:[row.type].filter(Boolean),floor:'',category:'',proposalKey:'',year:Number((row.startDate||row.setupDate||row.endDate||'').slice(0,4))||null,month:Number((row.startDate||row.setupDate||row.endDate||'').slice(5,7))||0};
  if(scheduleMode(mode)==='timeline')return row.startDate?[{...base,range:row.endDate&&row.endDate>=row.startDate?{start:row.startDate,end:row.endDate}:null}]:[];
  const action=(kind,date,time,anchor)=>({...base,key:row.key+'-'+kind,kind,time,year:Number((date||anchor||'').slice(0,4))||null,month:Number((date||anchor||'').slice(5,7))||0,range:date?{start:date,end:date}:null,pickupBasedOnEnd:kind==='pickup'&&!!date});
  return [...(row.setupDate||row.setupTime?[action('setup',row.setupDate,row.setupTime,row.startDate||row.endDate)]:[]),...(row.endDate||row.pickupTime?[action('pickup',row.endDate&&row.pickupTime?row.endDate:null,row.pickupTime,row.endDate||row.startDate)]:[])];
 }).sort((a,b)=>(a.range?.start||'9999').localeCompare(b.range?.start||'9999')||(a.time||'').localeCompare(b.time||'')||a.name.localeCompare(b.name,'th'));
}
