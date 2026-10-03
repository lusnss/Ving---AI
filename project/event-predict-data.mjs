import { identifyVenue, numeric } from './out/assets/event-predict-model.mjs';
import { historicalSchedules } from './event-venue-database.mjs';
const BOOK='1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4';
export function parsePredictCsv(body){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<body.length;i++){const c=body[i];if(c==='"'){if(quoted&&body[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
 else if(c===','&&!quoted){row.push(cell);cell='';}
 else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&body[i+1]==='\n')i++;}
 else cell+=c;}if(quoted)throw Error('CSV ไม่สมบูรณ์');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
const clean=v=>String(v??'').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]').replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]').replace(/\b\d{13}\b/g,'[ปกปิด]').trim().slice(0,180);
export function buildPredictData(tables, fetchedAt=new Date().toISOString()) {
 const records=[];
 for(const [channel,rows] of Object.entries(tables).filter(([key])=>key!=='history2025')){
  let month=0;const gp=channel==='gp';
  for(let i=0;i<rows.length;i++) {const row=rows[i];if(String(row[1]||'').trim()==='สาขา') {if(!String(row[2]).includes('จำนวนวัน')||!String(row[6]).includes('หลังหักส่วนลด'))throw Error('หัวตารางเปลี่ยน');month++;continue;}
   if(!/^\d+$/.test(String(row[0]))||!row[1])continue;
   const name=clean(row[1]),otherCols=gp?[10,13,14]:[12,13],other=otherCols.map(j=>numeric(row[j]));
   records.push({id:channel+'-'+(i+1),channel,month,name,venue:identifyVenue(name),days:numeric(row[2]),target:numeric(row[3]),net:numeric(row[6]),cogs:numeric(row[7]),space:numeric(row[9]),pc:numeric(row[gp?11:10]),shipping:numeric(row[gp?12:11]),other:other.every(v=>v!==null)?other.reduce((s,v)=>s+v,0):null,row:i+1});
  }if(month!==12)throw Error('หัวเดือน Event ไม่ครบ');
 }
 if(tables.history2025)records.push(...historicalSchedules(tables.history2025.map(row=>row.map(clean))));
 return {version:3,records,source:{fetched_at:fetchedAt,status:'online',sheets:['Event เก็บเงินเอง','Event จ่าย GP','Event 2025']}};
}
export async function predictWithin(operation, milliseconds){
 let timer;
 try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Read deadline exceeded')),milliseconds);})]);}
 finally{clearTimeout(timer);}
}
export function createPredictLoader({fetchImpl=fetch,now=Date.now,readMs=750,fetchMs=3500}={}) {
 let memory,pending;
 return async function(env,fallback){
  if(!env.FORCE_DATA_REFRESH&&memory&&memory.checked>=(env.DATA_REFRESH_SOURCES?.['/api/event-predict']||env.DATA_REFRESH_AFTER||0)&&now()-memory.checked<(memory.value.source.status==='online'?300000:30000))return memory.value;if(pending){await pending;if(!env.FORCE_DATA_REFRESH)return memory.value;}
  pending=(async()=>{let previous=memory?.value||fallback;
   try{const v=await predictWithin(async()=>{const saved=await env.BUCKET.get('event-predict-v3.json');return saved?await saved.json():null;},readMs);if(v?.version===3&&Array.isArray(v.records))previous=v;}catch{}
   try {
    const entries=await predictWithin(()=>Promise.all([['direct','1703349575','A1:O959'],['gp','2066169026','A1:P999'],['history2025','1054560136','A1:I1000']].map(async([channel,gid,range])=>{
     const url=new URL(`https://docs.google.com/spreadsheets/d/${BOOK}/export`);url.searchParams.set('format','csv');url.searchParams.set('gid',gid);url.searchParams.set('range',range);
     const response=await fetchImpl(url,{signal:AbortSignal.timeout(fetchMs),cache:'no-store'});if(!response.ok)throw Error('อ่านชีตไม่ได้');const body=await response.text();if(body.length>2000000)throw Error('ข้อมูลเกินขนาด');
     return [channel,parsePredictCsv(body)];
    })),fetchMs);
    const value=buildPredictData(Object.fromEntries(entries),new Date(now()).toISOString());try{await predictWithin(()=>env.BUCKET.put('event-predict-v3.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}}),readMs);}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}memory={checked:now(),value};return value;
   }catch{const value=previous?{...previous,source:{...previous.source,status:'stale'}}:{version:2,records:[],source:{fetched_at:null,status:'unavailable'}};memory={checked:now(),value};return value;}
  })().finally(()=>pending=null);return pending;
 };
}
export const loadPredictData=createPredictLoader();
