// Read only: the nine renovation fields; no contact or owner information.
export const rebrandHeaders=['รูปแบบขาย','สาขา','งบประมาณที่ใช้','เริ่ม Renovate','Plan Renovate เสร็จ','สถานะ','VM ออกแบบ','ห้างประสานปผู้รับเหมา','การตลาดโพสสื่อสาร'];
const fields=['channel','branch','budget','start','end','status','vm','contractor','marketing'];
function parseCsv(csv){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&csv[i+1]==='\n')i++;}else cell+=c;}
 if(quoted)throw Error('Incomplete CSV');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
const clean=value=>String(value??'').trim().replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]').replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]').slice(0,200);
export function buildRebrand(csv,fetchedAt=new Date().toISOString()){
 const [head,...rows]=parseCsv(csv.replace(/^\uFEFF/,'')),names=head?.map(v=>v.trim())||[];
 const indexes=rebrandHeaders.map(name=>names.indexOf(name));
 if(indexes.some(i=>i<0)||rebrandHeaders.some(name=>names.filter(v=>v===name).length!==1))throw Error('หัวคอลัมน์ Rebrand เปลี่ยนรูปแบบ');
 const items=rows.filter(row=>indexes.some(i=>row[i]?.trim())).map(row=>{
  if(!row[indexes[1]]?.trim())throw Error('ไม่มีชื่อสาขา');
  return Object.fromEntries(fields.map((field,i)=>[field,clean(row[indexes[i]])]));
 });
 return {version:1,source:{sheet:'สาขาที่รีโนเวท2026',fetched_at:fetchedAt,status:'online'},items};
}
export function createRebrandLoader({fetchImpl=fetch,now=Date.now,ttl=15000}={}){
 let memory,pending;
 return async function load(env){
  if(!env.FORCE_DATA_REFRESH&&memory&&memory.checked>=(env.DATA_REFRESH_SOURCES?.['/api/rebrand']||env.DATA_REFRESH_AFTER||0)&&now()-memory.checked<ttl)return memory.value;if(pending){await pending;if(!env.FORCE_DATA_REFRESH)return memory.value;}
  pending=(async()=>{
   let previous=memory?.value.source.fetched_at?memory.value:undefined;
   try{const stored=await env.BUCKET.get('rebrand.json');if(stored){const value=await stored.json();if(value.version===1&&Array.isArray(value.items)&&value.source?.fetched_at)previous=value;}}catch{}
   if(!env.FORCE_DATA_REFRESH&&previous?.source.status==='online'&&Date.parse(previous.source.fetched_at)>=(env.DATA_REFRESH_SOURCES?.['/api/rebrand']||env.DATA_REFRESH_AFTER||0)&&now()-Date.parse(previous.source.fetched_at)<ttl){memory={checked:now(),value:previous};return previous;}
   try{
    const url=new URL('https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/export');
    url.search=new URLSearchParams({format:'csv',gid:'268411880',range:'A1:I1000',_:String(now())});
    const response=await fetchImpl(url.href,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('อ่านชีตไม่สำเร็จ');const body=await response.text();if(body.length>1_000_000)throw Error('ข้อมูลเกินขนาด');
    const value=buildRebrand(body,new Date(now()).toISOString());
    try{await env.BUCKET.put('rebrand.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}
    memory={checked:now(),value};return value;
   }catch{
    const value=previous?{...previous,source:{...previous.source,status:'stale'}}:{version:1,source:{sheet:'สาขาที่รีโนเวท2026',fetched_at:null,status:'unavailable'},items:[]};
    memory={checked:now(),value};return value;
   }
  })().finally(()=>{pending=null;});return pending;
 };
}
export const loadRebrand=createRebrandLoader();
