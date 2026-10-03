// Read-only adapter. The selected range excludes the personal OWNER column.
const SOURCE = 'https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/export';
export const proposalHeaders = ['สถานที่','ชื่อ Event','ขนาด ตรม.','เดือนที่จัด','วันที่จัด','จำนวนวัน','คาดการณ์ยอดขาย','คาดการณ์กำไร','คาดการณ์กำไรสุทธิ %','Trade approve','CEO approve'];
const fields = ['place','name','area','month','dates','days','sales','profit','margin','trade','ceo'];
const clean = value => String(value ?? '').trim().replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]').replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]').slice(0,240);
export function parseProposalCsv(csv) {
  const rows=[]; let row=[],cell='',quoted=false;
  csv=csv.replace(/^\uFEFF/,'');
  for(let i=0;i<csv.length;i++) {
    const c=csv[i];
    if(c==='"') {if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&csv[i+1]==='\n')i++;}
    else cell+=c;
  }
  if(quoted)throw Error('ข้อมูลชีตไม่สมบูรณ์');
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}
export function buildEventProposals(csv, fetchedAt=new Date().toISOString()) {
  const [header,...rows]=parseProposalCsv(csv);
  const names=header?.map(v=>v.trim())||[];
  const indexes=proposalHeaders.map(name=>names.indexOf(name));
  if(indexes.some(i=>i<0)||proposalHeaders.some(name=>names.filter(v=>v===name).length!==1))throw Error('หัวคอลัมน์เสนอ Event เปลี่ยนรูปแบบ');
  const pc=names.indexOf('จำนวน PC');
  const items=rows.filter(row=>indexes.some(i=>row[i]?.trim())||(pc>=0&&row[pc]?.trim())).map(row=>{
    if(!row[indexes[0]]?.trim()&&!row[indexes[1]]?.trim())throw Error('รายการเสนอ Event ไม่สมบูรณ์');
    return {...Object.fromEntries(fields.map((field,i)=>[field,clean(row[indexes[i]])])),...(pc>=0?{pc:clean(row[pc])}:{})};
  });
  return {version:1,source:{sheet:'เสนอ Event',fetched_at:fetchedAt,status:'online'},items};
}
export async function proposalWithin(operation,milliseconds,onTimeout=()=>{}) {
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();reject(Error('โหลดข้อมูลเกินเวลาที่กำหนด'));},milliseconds);})]);}
  finally{clearTimeout(timer);}
}
export function createProposalLoader({fetchImpl=fetch,now=Date.now,ttl=15000,readMs=750,fetchMs=4500,writeMs=500,retryMs=3000}={}) {
  // Cache values only: Worker requests must never inherit another request's I/O.
  let memory,sequence=0,committed=0;
  return async function load(env) {
    if(!env.FORCE_DATA_REFRESH&&memory&&memory.checked>=(env.DATA_REFRESH_SOURCES?.['/api/event-proposals']||env.DATA_REFRESH_AFTER||0)&&now()-memory.checked<(memory.value.source.status==='online'?ttl:retryMs))return memory.value;
    const generation=++sequence;
    const remember=value=>{if(generation>=committed){committed=generation;memory={checked:now(),value};}return value;};
      let previous=memory?.value.source.fetched_at?memory.value:undefined;
      try {const value=await proposalWithin(async()=>{const stored=await env.BUCKET.get('event-proposals.json');return stored?stored.json():null;},readMs);if(value?.version===1&&Array.isArray(value.items)&&value.source?.fetched_at&&(!previous||Date.parse(value.source.fetched_at)>Date.parse(previous.source.fetched_at)))previous=value;}catch{}
      if(!env.FORCE_DATA_REFRESH&&previous?.source.status==='online'&&Date.parse(previous.source.fetched_at)>=(env.DATA_REFRESH_SOURCES?.['/api/event-proposals']||env.DATA_REFRESH_AFTER||0)&&now()-Date.parse(previous.source.fetched_at)<ttl)return remember(previous);
      try {
        const url=new URL(SOURCE);url.searchParams.set('format','csv');url.searchParams.set('gid','560515462');url.searchParams.set('range','B:AA');url.searchParams.set('_',String(now()));
        const controller=new AbortController();
        const body=await proposalWithin(async()=>{const response=await fetchImpl(url.href,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('อ่านชีตไม่สำเร็จ');return response.text();},fetchMs,()=>controller.abort());
        if(body.length>1_000_000)throw Error('ข้อมูลเกินขนาด');
        const value=buildEventProposals(body,new Date(now()).toISOString());
        remember(value);
        try {await proposalWithin(()=>env.BUCKET.put('event-proposals.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}}),writeMs);}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}
        return value;
      }catch {
        if(memory?.value.source.fetched_at&&(!previous||Date.parse(memory.value.source.fetched_at)>Date.parse(previous.source.fetched_at)))previous=memory.value;
        const value=previous?{...previous,source:{...previous.source,status:'stale'}}:{version:1,source:{sheet:'เสนอ Event',fetched_at:null,status:'unavailable'},items:[]};
        return remember(value);
      }
  };
}
export const loadEventProposals=createProposalLoader();
