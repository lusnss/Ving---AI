import {reportData as comparisonFallback} from './out/assets/daily-comparison-data.mjs';
const comparisonGroups=['Stand Alone','EVENT','EVENT นอก','Department Stores'];
const permittedChannels=new Set(comparisonFallback.records.filter(r=>r.group==='Stand Alone').map(r=>r.channel));
function csvRows(text){
 if(/<html|<!doctype/i.test(text))throw Error('Invalid source');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&text[i+1]==='\n')i++;}else cell+=c;}
 if(quoted)throw Error('Incomplete source');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
function saleNumber(value){
 const s=String(value??'').trim().replaceAll(',','');if(!s||s==='-'||s==='–'||s==='ปิดทำการ')return null;
 if(!/^-?\d+(?:\.\d+)?$/.test(s))throw Error('Invalid sales cell');
 const n=Number(s);if(!Number.isFinite(n))throw Error('Invalid amount');return Math.round(n*100)/100;
}
function safeChannel(group,value){
 if(group==='Department Stores')return 'ห้าง';
 if(group==='EVENT')return 'EVENT ในห้าง GP / ลานโปร ห้าง';
 if(group==='EVENT นอก')return 'EVENT นอก เก็บเงินเอง ห้าง';
 let name=String(value).replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim().replace(/^Stand Alone\s+/i,'');
 name=({'Thaphra : VING+':'Thaphra : VING','Ngamwongwan':'Ngamwongwan (ไม่แยกแบรนด์)'})[name]||name;
 if(!permittedChannels.has(name))throw Error('Channel label needs review');return name;
}
export function parseComparisonSource(csv,at=new Date().toISOString()){
 const rows=csvRows(csv),records=[],sections=new Set(),seen=new Map();let month,dates;
 const today=new Date(Date.parse(at)+7*3600000).toISOString().slice(0,10);
 for(const [index,row] of rows.entries()){
  if(row[2]?.trim()==='Group'){
   if(row[4]?.trim()!=='Channel')throw Error('Changed source layout');
   dates=[];month=null;
   for(let col=10;col<42;col++){
    const m=String(row[col]||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(2569|2026)$/);if(!m)continue;
    const day=Number(m[1]),mo=Number(m[2]);month??=mo;
    if(mo!==month||day!==dates.length+1)throw Error('Invalid dates');dates.push({col,day});
   }
   if(!month||month>12||dates.length!==new Date(Date.UTC(2026,month,0)).getUTCDate()||sections.has(month))throw Error('Incomplete month');
   sections.add(month);continue;
  }
  const group=row[2]?.trim();if(!comparisonGroups.includes(group))continue;
  if(!month)throw Error('Missing date header');
  const channel=safeChannel(group,row[4]);
  const daily=dates.map(({col,day})=>`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`>today?null:saleNumber(row[col]));
  const lastDay=daily.reduce((last,v,i)=>v!==null?i+1:last,null);
  const record={year:2569,month,group,channel,row:index+1,daily,marks:[],net:lastDay?saleNumber(row[6]):null,beforeVat:lastDay?saleNumber(row[7]):null,refunds:saleNumber(row[8]),gross:lastDay?saleNumber(row[9]):null,lastDay};
  const key=month+'|'+group+'|'+channel,old=seen.get(key);
  if(old){if(old.lastDay===null&&old.gross===null)records.splice(records.indexOf(old),1);else if(lastDay===null&&record.gross===null)continue;else throw Error('Duplicate populated channel');}
  seen.set(key,record);records.push(record);
 }
 if(sections.size!==12||!comparisonGroups.every(g=>records.some(r=>r.group===g&&r.lastDay!==null)))throw Error('Incomplete report');
 return {...comparisonFallback,extractedAt:at,records:[...records,...comparisonFallback.records.filter(r=>r.year===2568)],live:{status:'online',checkedAt:at,intervalSeconds:5}};
}
export function createComparisonLoader({fetchImpl=fetch,now=Date.now,ttl=3000,storageTimeoutMs=1000,sourceTimeoutMs=8000}={}){
 let memory,pending;
 const within=async(task,ms)=>{let timer;try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source timeout')),ms);})]);}finally{clearTimeout(timer);}};
 const storedValue=env=>within(async()=>{const stored=await env.BUCKET.get('daily-comparison-live.json');return {stored,value:stored?await stored.json():null};},storageTimeoutMs);
 const refresh=async(env,previous)=>{
   let saved;
   try{saved=await storedValue(env);if(saved.value?.records&&(!previous||Date.parse(saved.value.extractedAt)>Date.parse(previous.extractedAt)))previous=saved.value;}catch{}
   if(!env.FORCE_DATA_REFRESH&&previous?.live?.status==='online'&&Date.parse(previous.live.checkedAt)>=(env.DATA_REFRESH_SOURCES?.['/api/daily-comparison']||env.DATA_REFRESH_AFTER||0)&&now()-Date.parse(previous.live.checkedAt)<ttl){memory={checked:now(),value:previous};return previous;}
   const checkedAt=new Date(now()).toISOString();
   try{
    const url=new URL('https://docs.google.com/spreadsheets/d/1z9Xs0JJWQHbBP2J54NLfUSDQcaNBmgTi/export');
    url.search=new URLSearchParams({format:'csv',gid:'657843391',_:String(now())});
    const text=await within(async()=>{const response=await fetchImpl(url.href,{cache:'no-store',signal:AbortSignal.timeout(sourceTimeoutMs)});
    if(!response.ok)throw Error('Source unavailable');const text=await response.text();if(text.length>2_000_000)throw Error('Source too large');return text;},sourceTimeoutMs);
    const value=parseComparisonSource(text,checkedAt);
    try{
     if(!saved||saved.stored&&!saved.stored.etag)throw Error('Unknown cache revision');
     const onlyIf=saved.stored?.etag?{etagMatches:saved.stored.etag}:saved.stored?undefined:{etagDoesNotMatch:'*'};
     const written=await within(()=>env.BUCKET.put('daily-comparison-live.json',JSON.stringify(value),{...(onlyIf?{onlyIf}:{}),httpMetadata:{contentType:'application/json'}}),storageTimeoutMs);
     if(written===null){const winner=(await storedValue(env)).value;if(winner?.records){memory={checked:now(),value:winner};return winner;}throw Error('Cache changed');}
    }catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}
    memory={checked:now(),value};return value;
   }catch{
    const value={...(previous||comparisonFallback),live:{status:'stale',checkedAt,intervalSeconds:5}};
    memory={checked:now(),value};return value;
   }
 };
 return async (env,ctx)=>{
  const boundary=env.DATA_REFRESH_SOURCES?.['/api/daily-comparison']||env.DATA_REFRESH_AFTER||0;
  if(!env.FORCE_DATA_REFRESH&&memory&&memory.checked>=boundary&&now()-memory.checked<ttl)return memory.value;
  if(ctx?.waitUntil&&!env.FORCE_DATA_REFRESH){
   let previous=memory?.value;
   if(!previous)try{previous=(await storedValue(env)).value;}catch{}
   if(previous?.live?.status==='online'&&Date.parse(previous.live.checkedAt)>=boundary&&now()-Date.parse(previous.live.checkedAt)<ttl){memory={checked:now(),value:previous};return previous;}
   if(!pending)pending=refresh(env,previous).finally(()=>{pending=null;});
   ctx.waitUntil(pending.catch(()=>{}));
   return {...(previous||comparisonFallback),live:{...previous?.live,status:previous?.live?.status==='stale'?'stale':'refreshing',intervalSeconds:5}};
  }
  if(pending){await pending;if(!env.FORCE_DATA_REFRESH)return memory.value;}
  pending=refresh(env,memory?.value).finally(()=>{pending=null;});return pending;
 };
}
export const loadComparison=createComparisonLoader();
