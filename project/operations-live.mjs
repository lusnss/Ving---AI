import {sanitizeSnapshot,tables} from './sanitize.mjs';
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('Google Sheet ส่ง CSV ที่ปิดเครื่องหมายคำพูดไม่ครบ');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

export function numberFromCell(value) {
  const normalized = clean(value).replaceAll(',', '').replace('%', '');
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function contractName(value) {
  return clean(value).replace(/^\d+\.\s*-?\s*/, '').replace(/^-\s*/, '');
}

export function buildContracts(csvText, source = {}, fetchedAt = new Date()) {
  const rows = parseCsv(csvText);
  const headerIndex = rows.findIndex((row) => clean(row[0]) === 'สาขา' && clean(row[3]) === 'เริ่ม' && clean(row[4]) === 'วันหมดสัญญา');
  if (headerIndex < 0) throw new Error('ไม่พบหัวตารางสรุปสัญญา');
  const items = rows.slice(headerIndex + 1).filter((row) => contractName(row[0]) && clean(row[3]) && clean(row[4])).map((row) => {
    const remainingDays = numberFromCell(row[5]);
    const renewed = clean(row[7]).toUpperCase() === 'TRUE' || clean(row[6]).includes('ต่อสัญญาแล้ว');
    return {
      branch: contractName(row[0]),
      term: clean(row[2]),
      starts_on: clean(row[3]),
      ends_on: clean(row[4]),
      remaining_days: remainingDays,
      status: clean(row[6]) || (remainingDays < 0 ? 'หมดสัญญา' : 'ปกติ'),
      renewed
    };
  }).sort((a, b) => a.remaining_days - b.remaining_days);
  if (!items.length) throw new Error('ไม่พบรายการสัญญาห้าง');
  const renewed = items.filter((item) => item.renewed).length;
  return {
    source: {
      kind: 'google_sheet',
      file: source.sheet_name || 'สรุปสัญญา',
      url: source.url,
      online_status: 'online',
      fetched_at: new Date(fetchedAt).toISOString()
    },
    as_of: clean(rows[0]?.[1]),
    summary: {
      total: items.length,
      renewed,
      pending: items.length - renewed,
      expiring_60_days: items.filter((item) => !item.renewed && item.remaining_days <= 60).length
    },
    items
  };
}

const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const trim = value => String(value ?? '').replace(/\s+/g,' ').trim();
const identity = value => trim(value).toLocaleLowerCase('th-TH');
const summarize = items => ({count:items.length,with_sales:items.filter(x=>x.sales>0).length,planned:items.filter(x=>x.sales<=0).length,sales:items.reduce((n,x)=>n+x.sales,0)});

export function parseEventCatalog(csv2025, csvDirect, csvGp, fetchedAt = new Date().toISOString()) {
  const past = new Map();
  const months = new Map();
  for (const row of parseCsv(csv2025).slice(1)) {
    if (!trim(row[3]) || !monthNames.includes(trim(row[5]))) continue;
    const name=trim(row[3]), id=identity(name), sales=numberFromCell(row[6]);
    const item=past.get(id)||{name,venue:trim(row[1]),date:trim(row[4]),months:[],sales:0};
    item.sales+=sales;
    const recordedMonth=monthNames.indexOf(trim(row[5]))+1;
    if(!item.months.includes(recordedMonth))item.months.push(recordedMonth);
    past.set(id,item);
    const month=trim(row[5]), entry=months.get(month)||{month,names:new Set(),sales:0};
    entry.names.add(id);entry.sales+=sales;months.set(month,entry);
  }
  const catalog=new Map();
  for (const [csv,category,label] of [[csvDirect,'direct','Event เก็บเงินเอง'],[csvGp,'gp','Event จ่าย GP']]) {
    let month=0, section=0, rowCount=0;
    for (const row of parseCsv(csv)) {
      const heading=trim(row[0]).replace(/^เดือน\s*/, '');
      if (monthNames.includes(heading)) month=monthNames.indexOf(heading)+1;
      if(trim(row[1])==='สาขา'){section++;month=section;}
      if (!/^\d+$/.test(trim(row[0])) || !trim(row[1])) continue;
      rowCount++;
      const name=trim(row[1]), id=identity(name);
      const item=catalog.get(id)||{name,category,categories:[],venue:label,month};
      if (!item.categories.includes(category)) item.categories.push(category);
      catalog.set(id,item);
    }
    if(!rowCount)throw Error(`ไม่พบรายชื่อใน ${label}`);
  }
  if (!past.size || !catalog.size) throw Error('ข้อมูลรายชื่อ Event ไม่ครบ');
  const items=[...past.values()].sort((a,b)=>b.sales-a.sales);
  return {catalog_version:1,source:{file:'สรุปต้นทุนห้าง 2569',online_status:'online',fetched_at:fetchedAt},years:{
    '2025':{year:2025,summary:summarize(items),items,top_events:items.slice(0,8),months:[...months.values()].map(x=>({month:x.month,count:x.names.size,sales:x.sales})).sort((a,b)=>monthNames.indexOf(a.month)-monthNames.indexOf(b.month))},
    '2026':{year:2026,items:[...catalog.values()]}
  }};
}

// Cache reads remain local to R2 for one minute. Expired or missing entries are
// refreshed by the Worker on the next authenticated read; no Mac is required.
export function createOperationsLoader({now=Date.now,ttl=60000,retryMs=30000,storageTimeoutMs=1000,sourceTimeoutMs=8000}={}){
 const inFlight=new WeakMap();
 const within=async(task,ms)=>{let timer;try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source timeout')),ms);})]);}finally{clearTimeout(timer);}};
 const stale=value=>({...value,source:{...value?.source,online_status:'stale',fetched_at:value?.source?.fetched_at||null}});
 const read=(bucket,key)=>within(async()=>{const object=await bucket.get(key);return {object,value:object?await object.json():null};},storageTimeoutMs);
 const fresh=(value,env,kind)=>{const checked=Date.parse(value?.source?.checked_at||value?.source?.fetched_at)||0;return !env.FORCE_DATA_REFRESH&&value&&checked>=Number(env.DATA_REFRESH_SOURCES?.[kind==='contracts'?'/api/contracts':'/api/events/catalog']||env.DATA_REFRESH_AFTER||0)&&now()>=checked&&now()-checked<(value.source?.online_status==='stale'?retryMs:ttl);};
 async function refresh(env,kind,fetchImpl){
  const key='operations-live/'+kind+'.json',bucket=env.BUCKET;
  let saved;try{saved=await read(bucket,key);}catch{return stale(null);}
  const previous=saved.value,started=now();
  const sourceKey=kind==='contracts'?'/api/contracts':'/api/events/catalog';
  const refreshAfter=Number(env.DATA_REFRESH_SOURCES?.[sourceKey]||env.DATA_REFRESH_AFTER||0);
  const checked=Date.parse(previous?.source?.checked_at||previous?.source?.fetched_at)||0;
  const interval=previous?.source?.online_status==='stale'?retryMs:ttl;
  if(!env.FORCE_DATA_REFRESH&&previous&&checked>=refreshAfter&&started>=checked&&started-checked<interval)return previous;
  // Existing objects must expose an ETag before any conditional mutation.
  if(saved.object&&!saved.object.etag)return stale(previous);
  const onlyIf=saved.object?{etagMatches:saved.object.etag}:{etagDoesNotMatch:'*'};
  let value;
  try{
   const sheets=kind==='contracts'?['1504066538']:['1054560136','1703349575','2066169026'];
   const csv=await within(()=>Promise.all(sheets.map(async gid=>{
    const url=new URL('https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/export');url.search=new URLSearchParams({format:'csv',gid,_:String(started)});
    const response=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(sourceTimeoutMs)});if(!response.ok)throw Error('Source unavailable');const body=await response.text();if(body.length>2000000||/^\s*</.test(body))throw Error('Invalid source');return body;
   })),sourceTimeoutMs);
   // Keep the read-start timestamp: a delayed read must not claim newer data.
   const fetchedAt=new Date(started).toISOString();
   const parsed=kind==='contracts'?buildContracts(csv[0],{},fetchedAt):parseEventCatalog(...csv,fetchedAt);
   const path='/api/'+kind;
   value=sanitizeSnapshot({exportedAt:fetchedAt,data:{...Object.fromEntries(tables.map(name=>['/api/'+name,{items:[]}])),'/api/mall-sales':{},'/api/contracts':{},'/api/events':{},[path]:parsed}}).data[path];
   if(!value)throw Error('Invalid source');
   value={...value,source:{...value.source,checked_at:fetchedAt}};
  }catch{
   // Preserve the successful read time and rows; checked_at only throttles retry.
   value={...stale(previous),source:{...stale(previous).source,checked_at:new Date(started).toISOString()}};
  }
  try{
   const written=await within(()=>bucket.put(key,JSON.stringify(value),{onlyIf,httpMetadata:{contentType:'application/json'}}),storageTimeoutMs);
   if(written)return value;
   // Another Worker changed this exact cache object. Never overwrite its result,
   // including when this reader failed while the concurrent reader succeeded.
   return (await read(bucket,key)).value||stale(previous);
  }catch{return stale(previous);}
 }
 return async function load(env,kind,fetchImpl=fetch,ctx){
  if(!['events','contracts'].includes(kind))throw new Error('Unsupported operations source');
  const bucket=env.BUCKET;
  if(!bucket||typeof bucket.get!=='function'||typeof bucket.put!=='function')return stale(null);
  let jobs=inFlight.get(bucket);if(!jobs){jobs=new Map();inFlight.set(bucket,jobs);}
  // A forced read must never join an ordinary read that only returns a cache.
  const sourceKey=kind==='contracts'?'/api/contracts':'/api/events/catalog';
  const boundary=Number(env.DATA_REFRESH_SOURCES?.[sourceKey]||env.DATA_REFRESH_AFTER||0);
  const jobKey=kind+':'+Boolean(env.FORCE_DATA_REFRESH)+':'+boundary;
  const start=()=>{if(jobs.has(jobKey))return jobs.get(jobKey);const task=refresh(env,kind,fetchImpl).finally(()=>{if(jobs.get(jobKey)===task)jobs.delete(jobKey);});jobs.set(jobKey,task);return task;};
  if(ctx?.waitUntil&&!env.FORCE_DATA_REFRESH){
   let previous;try{previous=(await read(bucket,'operations-live/'+kind+'.json')).value;}catch{return stale(null);}
   if(fresh(previous,env,kind))return previous;
   ctx.waitUntil(start().catch(()=>{}));
   return {...previous,source:{...previous?.source,online_status:previous?.source?.online_status==='stale'?'stale':'refreshing',fetched_at:previous?.source?.fetched_at||null}};
  }
  return start();
 };
}
const operationsLoader=createOperationsLoader();
export async function loadOperations(env,kind,fetchImpl=fetch,ctx){return operationsLoader(env,kind,fetchImpl,ctx);}
export function latestOperation(base,live){return live&&Date.parse(live.source?.fetched_at)>=(Date.parse(base?.source?.fetched_at)||0)?live:base;}
export async function applyOperations(snapshot,env,fetchImpl=fetch,ctx){
 const value=await loadOperations({...env,FORCE_DATA_REFRESH:false},'events',fetchImpl,ctx);
 const base=snapshot.data['/api/events'],selected=value?.years?latestOperation(base,value):base;
 const source={...selected?.source,online_status:value?.source?.online_status||'stale'};
 return {...snapshot,operationsSource:source,data:{...snapshot.data,'/api/events':{...selected,source}}};
}
