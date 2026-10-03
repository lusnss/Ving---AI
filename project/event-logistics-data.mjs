// Read only the seven scheduling columns. Staff and contact columns never enter this feed.
export const eventScheduleSource={sheet:'Set up หน้าร้าน/เก็บกลับ',url:'https://docs.google.com/spreadsheets/d/1iRZDTA6gbkCGOH-bVGumf4R7N_PjlzWdo14vXs2t1fU/edit?gid=1732890767#gid=1732890767'};
const sourceUrl='https://docs.google.com/spreadsheets/d/1iRZDTA6gbkCGOH-bVGumf4R7N_PjlzWdo14vXs2t1fU/gviz/tq';
const headers=['ประเภท','สถานที่ (หน้างาน)','Set up','เวลา set up','เริ่มขายจริง','วันจบงาน','เวลาเข้าเก็บกลับ'];
const clean=value=>String(value??'').replace(/\s+/g,' ').trim().replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]').replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]').slice(0,240);
export function scheduleDate(value){
 const raw=String(value??'').trim();let year,month,day;
 let match=/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(raw);
 if(match){day=+match[1];month=+match[2];year=+match[3];if(year<100)year+=2000;if(year>=2400)year-=543;}
 else if((match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw))){year=+match[1];month=+match[2];day=+match[3];}
 else return null;
 if(year<2000||year>2100||month<1||month>12||day<1)return null;
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;
}
export function scheduleTime(value){
 const match=/^(\d{1,2})[.:](\d{2})\s*(?:น\.?|นาฬิกา)?$/.exec(String(value??'').trim());
 return match&&+match[1]<24&&+match[2]<60?`${match[1].padStart(2,'0')}:${match[2]} น.`:null;
}
function csvRows(csv){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&csv[i+1]==='\n')i++;}else cell+=c;}
 if(quoted)throw Error('Incomplete schedule');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function buildEventSchedule(csv,fetchedAt=new Date().toISOString()){
 const [header,...rows]=csvRows(csv.replace(/^\uFEFF/,''));
 if(header?.length!==headers.length||headers.some((name,index)=>header[index]?.trim()!==name))throw Error('Schedule columns changed');
 const items=rows.flatMap((row,index)=>{
  const place=clean(row[1]);if(!place||place==='หมายเหตุ')return [];
  const setupDate=scheduleDate(row[2]),startDate=scheduleDate(row[4]),endDate=scheduleDate(row[5]);
  if(!setupDate&&!startDate&&!endDate&&!scheduleTime(row[3])&&!scheduleTime(row[6]))return [];
  return [{key:`sheet-schedule-${index+2}`,name:place,place,type:clean(row[0]),setupDate,setupTime:scheduleTime(row[3]),startDate,endDate,pickupTime:scheduleTime(row[6])}];
 });
 return {version:1,source:{...eventScheduleSource,status:'online',fetched_at:fetchedAt},items};
}
export function createEventScheduleLoader({fetchImpl=(...args)=>fetch(...args),now=Date.now,timeout=8000}={}){
 let memory;
 return async env=>{
  // Fetch on every read; saved data is a visibly stale fallback only.
  try{
   const url=new URL(sourceUrl);url.searchParams.set('tqx','out:csv');url.searchParams.set('gid','1732890767');url.searchParams.set('headers','1');url.searchParams.set('tq','select A,B,K,L,M,O,P where B is not null');url.searchParams.set('_',String(now()));
   const response=await fetchImpl(url.href,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
   if(!response.ok)throw Error('Schedule unavailable');const csv=await response.text();if(csv.length>1_000_000)throw Error('Schedule too large');
   const value=buildEventSchedule(csv,new Date(now()).toISOString());memory=value;
   // No user details or unrelated sheet columns are persisted.
   try{await bounded(()=>env.BUCKET?.put('event-schedule.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}}),700);}catch{}
   return value;
  }catch{
   let saved=memory;
   try{const value=await bounded(async()=>{const object=await env.BUCKET?.get('event-schedule.json');return object?object.json():null;},700);if(value?.version===1&&Array.isArray(value.items)&&value.source?.fetched_at&&(!saved||value.source.fetched_at>saved.source.fetched_at))saved=value;}catch{}
   return {version:1,items:saved?.items||[],source:{...eventScheduleSource,fetched_at:saved?.source?.fetched_at||null,status:saved?'stale':'unavailable'}};
  }
 };
}
async function bounded(operation,ms){let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout')),ms);})]);}finally{clearTimeout(timer);}}
export const loadEventSchedule=createEventScheduleLoader();
