import {loadContracts,updateContract} from './notifications.mjs';
import {loadOperations,latestOperation} from './operations-live.mjs';
const contractError=(message,status=400)=>Object.assign(new Error(message),{status});
const contractFields=['branch','term','starts_on','ends_on','renewed','status'];
const contractPick=row=>Object.fromEntries(contractFields.map(k=>[k,row[k]]));
async function contractHash(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function contractDate(value){if(typeof value!=='string')return null;let y,m,d;if(/^\d{4}-\d{2}-\d{2}$/.test(value))[y,m,d]=value.split('-').map(Number);else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value))[d,m,y]=value.split('/').map(Number);else return null;if(y>2400)y-=543;const n=Date.UTC(y,m-1,d),v=new Date(n);return y>=2000&&y<=2200&&v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d?n:null;}
async function contractSnapshot(env,fallback){let snapshot=fallback,stored=false;try{const object=await env.BUCKET?.get('snapshot.json');if(object){snapshot=await object.json();stored=true;}}catch{}return {snapshot,stored};}
export async function loadContractWorkspace(env,fallback,canEdit=false){
 if(!env.DB)throw contractError('ยังเชื่อมต่อฐานข้อมูลสัญญาไม่ได้ กรุณาลองอีกครั้ง',503);
 const original=await contractSnapshot(env,fallback),live=await loadOperations(env,'contracts');
 const snapshot=live?.items?{...original.snapshot,data:{...original.snapshot.data,'/api/contracts':latestOperation(original.snapshot.data['/api/contracts'],live)}}:original.snapshot,stored=!!live?.items||original.stored,base=snapshot.data?.['/api/contracts'];if(!Array.isArray(base?.items))throw contractError('ยังไม่มีข้อมูลสัญญา',503);
 const data=await loadContracts(env,snapshot,canEdit?'admin':'viewer');
 const changes=await env.DB.prepare('SELECT e.id, c.created_at FROM contract_edits e LEFT JOIN web_changes c ON c.id=e.revision').all(),dates=new Map(changes.results.map(r=>[r.id,r.created_at]));
 const items=await Promise.all(data.items.map(async(r,index)=>({...contractPick(r),key:'contract:'+r.id,revision:r.revision,updated_at:dates.get(r.id)||null,edited:r.revision!=='base',sourceBranch:base.items[index].branch,sourceHash:await contractHash(JSON.stringify(contractPick(base.items[index])))})));
 if(new Set(items.map(r=>r.key)).size!==items.length)throw contractError('พบชื่อสาขาซ้ำในต้นทาง กรุณาตรวจสอบก่อนแก้ไข',503);
 return {...data,source:{...base.source,...(!stored||env.FORCE_DATA_REFRESH&&live?.source?.online_status!=='online'?{online_status:'stale'}:{})},items,web:{edited:items.filter(r=>r.edited).length,latestEdit:changes.results.map(r=>r.created_at).filter(Boolean).sort().at(-1)||null},permissions:{canEdit}};
}
export async function updateContractWorkspace(request,env,fallback,actor=null){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw contractError('คำขอต้องมาจากเว็บนี้',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw contractError('รูปแบบข้อมูลไม่ถูกต้อง',415);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>5000)throw contractError('ข้อมูลเกินขนาด',413);
 let body;try{body=JSON.parse(raw);}catch{throw contractError('รูปแบบข้อมูลไม่ถูกต้อง');}
 if(!body||typeof body!=='object'||!/^contract:[a-f0-9]{64}$/.test(body.key||'')||!(/^(base|[a-f0-9]{32})$/.test(body.revision||''))||!/^[a-f0-9]{32}$/.test(body.changeId||''))throw contractError('รหัสสัญญาไม่ถูกต้อง');
 if(body.operation!==undefined&&!['update','renew'].includes(body.operation))throw contractError('ประเภทการเปลี่ยนแปลงไม่ถูกต้อง');
 const values=body.values;if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!contractFields.includes(k)))throw contractError('ข้อมูลสัญญาไม่ถูกต้อง');
 for(const [field,max] of [['branch',120],['term',60]])if(typeof values[field]!=='string'||!values[field].trim()||values[field].trim().length>max||/[<>\r\n\x00-\x1f@]|(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b|\b\d{13}\b/.test(values[field]))throw contractError('กรอกเฉพาะชื่อสาขาและระยะสัญญา ไม่ใส่ข้อมูลส่วนบุคคล');
 if(typeof values.renewed!=='boolean'||!['ปกติ','เริ่มพิจารณา','อยู่ระหว่างเจรจา','รอต่อสัญญา','ต่อสัญญาแล้ว','ไม่ต่อสัญญา'].includes(values.status))throw contractError('สถานะสัญญาไม่ถูกต้อง');
 const start=contractDate(values.starts_on),end=contractDate(values.ends_on);if(start===null||end===null||end<start)throw contractError('วันหมดสัญญาต้องไม่ก่อนวันเริ่ม และวันที่ต้องอยู่ระหว่างปี 2000–2200');
 if(values.status==='ต่อสัญญาแล้ว'&&!values.renewed||values.status==='ไม่ต่อสัญญา'&&values.renewed)throw contractError('สถานะกับการต่ออายุไม่สอดคล้องกัน');
 const current=await loadContractWorkspace(env,fallback,true),item=current.items.find(r=>r.key===body.key);if(!item)throw contractError('ไม่พบสัญญานี้ กรุณาโหลดข้อมูลล่าสุด',404);
 const previous=await env.DB.prepare('SELECT id FROM web_changes WHERE id=? AND entity=?').bind(body.changeId,body.key).first();if(previous)return {ok:true,item};
 if(item.revision!==body.revision||item.sourceHash!==body.sourceHash)throw contractError('สัญญานี้มีข้อมูลใหม่แล้ว ปิดหน้าต่างแล้วอัปเดตข้อมูลก่อนแก้ไขอีกครั้ง',409);
 if(current.items.some(r=>r.key!==body.key&&r.branch.normalize('NFC').trim()===values.branch.normalize('NFC').trim()))throw contractError('มีชื่อสาขานี้อยู่แล้ว');
 const original=await contractSnapshot(env,fallback),live=await loadOperations({...env,FORCE_DATA_REFRESH:false},'contracts');
 const snapshot=live?.items?{...original.snapshot,data:{...original.snapshot.data,'/api/contracts':latestOperation(original.snapshot.data['/api/contracts'],live)}}:original.snapshot;
 const payload={...values,operation:body.operation||'update',branch:values.branch.trim(),term:values.term.trim(),starts_on:new Date(start).toISOString().slice(0,10),ends_on:new Date(end).toISOString().slice(0,10),id:body.key.slice(9),revision:body.revision,changeId:body.changeId};
 // Reuse the existing atomic contract update and approval notification workflow.
 const saved=await updateContract(new Request(request.url,{method:'PATCH',headers:request.headers,body:JSON.stringify(payload)}),env,snapshot,actor);
 return {ok:true,unchanged:!!saved.unchanged,item:(await loadContractWorkspace(env,fallback,true)).items.find(r=>r.key===body.key)};
}
