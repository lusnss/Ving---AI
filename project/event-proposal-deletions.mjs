import { loadEventProposals } from './event-proposals-data.mjs';
import {listEventRequests} from './event-requests.mjs';

export async function summaryApprovedProposals(env,{refreshSheet=false}={}){
 const failures=[];
 let sheet=[];
 try{
  const stored=refreshSheet?{json:()=>loadEventProposals(env)}:await env.BUCKET?.get('event-proposals.json');
  if(stored){const value=await stored.json();if(value.version!==1||!Array.isArray(value.items))throw Error('Invalid proposals');sheet=value.items.map(row=>({...row,sourceYear:2026}));if(value.source?.status==='stale'||value.source?.status==='unavailable')failures.push('เชื่อมชีตเสนอ Event ไม่ได้ ข้อมูลจากชีตอาจยังไม่ครบ');}
  else failures.push('ยังไม่มีข้อมูลข้อเสนอจากชีตที่บันทึกไว้ เปิดหน้าเสนอ Event เพื่ออัปเดตข้อมูล');
 }catch{failures.push('ยังอ่านข้อเสนอจากชีตไม่ได้');}
 const web=await listEventRequests(env);
 if(web.status!=='online')failures.push('ยังอ่านข้อเสนอจากเว็บไม่ได้');
 if(web.truncated)failures.push('แสดงข้อเสนอจากเว็บล่าสุด 500 รายการ');
 try{
  const items=await visibleProposals(env,[...web.items,...sheet]);
  return {items:items.filter(row=>row.trade==='อนุมัติ'&&row.ceo==='อนุมัติ'&&row.workflow?.status!=='cancelled'),cancelled:items.filter(row=>row.workflow?.status==='cancelled').map(eventSchedulingFields),failures};
 }catch{return {items:[],unavailable:true,failures:[...failures,'ยังตรวจสถานะอนุมัติ Event ไม่ได้ กรุณาลองใหม่']};}
}
export function eventSchedulingFields(row){
 const fields=['deletionKey','name','place','dates','startDate','endDate','month','sourceYear','createdAt','trade','ceo','floor','eventTypes','category'];
 return {...Object.fromEntries(fields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]])),input:{eventMonth:row.input?.eventMonth,channel:row.input?.channel},...(row.workflow?{workflow:{status:row.workflow.status}}:{})};
}
const deletionError=(message,status=400)=>Object.assign(new Error(message),{status});
export async function proposalKey(row){
 if(row.source==='web'&&row.id)return 'web:'+row.id;
 const identity=JSON.stringify(['place','name','dates','month'].map(k=>String(row[k]||'').normalize('NFC').trim()));
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
 return 'sheet:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function visibleProposals(env,items){
 if(!env.DB)throw deletionError('ยังอ่านรายการ Event ที่ลบไม่ได้ กรุณาลองใหม่',503);
 const deleted=await env.DB.prepare('SELECT id FROM event_proposal_deletions').all();
 const keys=new Set(deleted.results.map(r=>r.id));
 const identified=await Promise.all(items.map(async row=>({...row,deletionKey:await proposalKey(row)})));
 const approvals=await env.DB.prepare('SELECT id, trade, ceo FROM event_proposal_approvals').all();
 const statuses=new Map(approvals.results.map(row=>[row.id,row]));
 const workflows=await env.DB.prepare('SELECT id, status, note, revision, updated_at FROM event_proposal_workflow').all();
 const workflowByKey=new Map(workflows.results.map(row=>[row.id,{status:row.status,note:row.note,revision:row.revision,updatedAt:row.updated_at}]));
 return identified.filter(row=>!keys.has(row.deletionKey)).map(row=>{const saved=statuses.get(row.deletionKey),workflow=workflowByKey.get(row.deletionKey);return {...row,...(saved?{trade:saved.trade??row.trade,ceo:saved.ceo??row.ceo}:{}),...(workflow?{workflow}:{})};});
}
export async function eventProposalDetail(env,key){
 if(!/^(web:[0-9a-f-]{36}|sheet:[0-9a-f]{64})$/i.test(key||''))throw deletionError('รหัส Event ไม่ถูกต้อง');
 if(!env.DB)throw deletionError('ยังอ่านข้อมูล Event ไม่ได้ กรุณาลองใหม่',503);
 let items,source;
 if(key.startsWith('web:')){
  const saved=await env.DB.prepare('SELECT payload FROM event_requests WHERE id = ?').bind(key.slice(4)).first();
  items=saved?[JSON.parse(saved.payload)]:[];
  source={status:'saved',fetched_at:items[0]?.createdAt||null};
 }else{
  const sheet=await loadEventProposals(env);source=sheet.source;
  if(source.status==='unavailable')throw deletionError('ยังอ่านข้อมูลจากชีตไม่ได้ กรุณาลองใหม่',503);
  items=sheet.items;
 }
 const item=(await visibleProposals(env,items)).find(row=>row.deletionKey===key);
 if(!item)throw deletionError('ไม่พบ Event นี้ อาจถูกลบหรือข้อมูลในชีตเปลี่ยนแล้ว',404);
 return {item,source};
}
export async function deleteEventProposal(request,env,key,actor=null){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw deletionError('คำขอต้องมาจากเว็บนี้',403);
 if(!/^(web:[0-9a-f-]{36}|sheet:[0-9a-f]{64})$/i.test(key))throw deletionError('รหัส Event ไม่ถูกต้อง');
 if(!env.DB)throw deletionError('ยังลบ Event ไม่ได้ กรุณาลองใหม่',503);
 if(await env.DB.prepare('SELECT id FROM event_proposal_deletions WHERE id = ?').bind(key).first())return {ok:true};
 let exists=false;
 if(key.startsWith('web:'))exists=!!await env.DB.prepare('SELECT id FROM event_requests WHERE id = ?').bind(key.slice(4)).first();
 else {const sheet=await loadEventProposals(env);if(sheet.source.status==='unavailable')throw deletionError('ยังตรวจสอบ Event จากชีตไม่ได้ กรุณาลองใหม่',503);exists=(await Promise.all(sheet.items.map(proposalKey))).includes(key);}
 if(!exists)throw deletionError('ไม่พบ Event นี้ กรุณารีเฟรชรายการ',404);
 const stamp=new Date().toISOString();
 await env.DB.batch([
  env.DB.prepare('INSERT INTO event_proposal_deletions (id, deleted_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING').bind(key,stamp),
  env.DB.prepare("UPDATE web_changes SET after_json=? WHERE entity=? AND kind='proposal_deleted' AND created_at=? AND after_json IS NULL AND changes()=1").bind(JSON.stringify({submittedBy:actor}),key,stamp)
 ]);
 return {ok:true};
}

export async function approveEventProposal(request,env){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw deletionError('คำขอต้องมาจากเว็บนี้',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw deletionError('รูปแบบคำขอไม่ถูกต้อง',415);
 const raw=await request.text();if(raw.length>2000)throw deletionError('ข้อมูลเกินขนาด',413);
 let body;try{body=JSON.parse(raw);}catch{throw deletionError('รูปแบบคำขอไม่ถูกต้อง');}
 const {key,field,status}=body||{};
 if(!/^(web:[0-9a-f-]{36}|sheet:[0-9a-f]{64})$/i.test(key||'')||!['trade','ceo'].includes(field)||!['อนุมัติ','ไม่อนุมัติ','รออนุมัติ'].includes(status))throw deletionError('สถานะหรือ Event ไม่ถูกต้อง');
 if(!env.DB)throw deletionError('ยังบันทึกสถานะไม่ได้ กรุณาลองใหม่',503);
 if(await env.DB.prepare('SELECT id FROM event_proposal_deletions WHERE id = ?').bind(key).first())throw deletionError('Event นี้ถูกลบแล้ว กรุณารีเฟรช',409);
 let exists;
 if(key.startsWith('web:')){exists=await env.DB.prepare('SELECT id,payload FROM event_requests WHERE id = ?').bind(key.slice(4)).first();if(exists){const saved=JSON.parse(exists.payload);if((body.revision||null)!==(saved.updatedAt||saved.createdAt||null))throw deletionError('ข้อเสนอนี้ถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนอนุมัติ',409);}}
 else{const sheet=await loadEventProposals(env);if(sheet.source.status==='unavailable')throw deletionError('ยังตรวจสอบ Event ไม่ได้',503);exists=(await Promise.all(sheet.items.map(proposalKey))).includes(key);}
 if(!exists)throw deletionError('ไม่พบ Event นี้',404);
 // field is selected from a fixed allowlist above; values remain bound.
 const statement=key.startsWith('web:')
 ? env.DB.prepare(`INSERT INTO event_proposal_approvals (id, ${field}, updated_at) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM event_requests WHERE id=? AND payload=?) AND NOT EXISTS (SELECT 1 FROM event_proposal_deletions WHERE id=?) ON CONFLICT(id) DO UPDATE SET ${field}=excluded.${field},updated_at=excluded.updated_at`).bind(key,status,new Date().toISOString(),key.slice(4),exists.payload,key)
 : env.DB.prepare(`INSERT INTO event_proposal_approvals (id, ${field}, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET ${field}=excluded.${field},updated_at=excluded.updated_at`).bind(key,status,new Date().toISOString());
 const result=await statement.run();if(!(result.meta?.changes??result.changes))throw deletionError('ข้อเสนอนี้เปลี่ยนแล้ว กรุณาโหลดใหม่ก่อนอนุมัติ',409);
 return {ok:true,key,field,status};
}

export async function updateEventWorkflow(request,env){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw deletionError('คำขอต้องมาจากเว็บนี้',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw deletionError('รูปแบบคำขอไม่ถูกต้อง',415);
 const raw=await request.text();if(raw.length>6000)throw deletionError('ข้อมูลเกินขนาด',413);
 let body;try{body=JSON.parse(raw);}catch{throw deletionError('รูปแบบคำขอไม่ถูกต้อง');}
 const {key,status,revision=null,proposalRevision=null}=body||{};
 if(!['scheduled','completed','cancelled'].includes(status))throw deletionError('สถานะงานไม่ถูกต้อง');
 if(typeof body?.note!=='string'||body.note.length>1000)throw deletionError('หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร');
 const note=status==='cancelled'?body.note.trim():'';
 if(status==='cancelled'&&!note)throw deletionError('กรุณาระบุเหตุผลที่ยกเลิก');
 const {item}=await eventProposalDetail(env,key);
 if((item.workflow?.revision||null)!==revision||(item.updatedAt||item.createdAt||null)!==proposalRevision)throw deletionError('รายการนี้เปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก',409);
 if(status!=='cancelled'&&(item.trade!=='อนุมัติ'||item.ceo!=='อนุมัติ'))throw deletionError('ต้องอนุมัติครบทั้ง Trade และ CEO ก่อนเปลี่ยนเป็นสถานะนี้',409);
 const workflow={status,note,revision:crypto.randomUUID(),updatedAt:new Date().toISOString()};
 // Compare revisions in the write itself so two editors cannot overwrite each other.
 const conditions=['NOT EXISTS (SELECT 1 FROM event_proposal_deletions WHERE id=?)'];
 const values=[key,status,note,workflow.revision,workflow.updatedAt,key];
 if(key.startsWith('web:')){
  conditions.push("EXISTS (SELECT 1 FROM event_requests WHERE id=? AND COALESCE(json_extract(payload,'$.updatedAt'),json_extract(payload,'$.createdAt')) IS ?)");
  values.push(key.slice(4),proposalRevision);
 }
 if(status!=='cancelled'){
  for(const field of ['trade','ceo']){
   const fallback=key.startsWith('web:')?`(SELECT json_extract(payload,'$.${field}') FROM event_requests WHERE id=?)`:'?';
   conditions.push(`COALESCE((SELECT ${field} FROM event_proposal_approvals WHERE id=?),${fallback})='อนุมัติ'`);
   values.push(key,key.startsWith('web:')?key.slice(4):item[field]);
  }
 }
 conditions.push(revision===null?'NOT EXISTS (SELECT 1 FROM event_proposal_workflow WHERE id=?)':'EXISTS (SELECT 1 FROM event_proposal_workflow WHERE id=? AND revision=?)');
 values.push(key);if(revision!==null)values.push(revision);
 const result=await env.DB.prepare(`INSERT INTO event_proposal_workflow (id,status,note,revision,updated_at) SELECT ?,?,?,?,? WHERE ${conditions.join(' AND ')} ON CONFLICT(id) DO UPDATE SET status=excluded.status,note=excluded.note,revision=excluded.revision,updated_at=excluded.updated_at`).bind(...values).run();
 if(!(result.meta?.changes??result.changes))throw deletionError('รายการนี้เปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก',409);
 return {ok:true,key,workflow};
}
