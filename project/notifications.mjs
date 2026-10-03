const changeError=(message,status=400)=>Object.assign(new Error(message),{status});
async function changeBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw changeError('รูปแบบคำขอไม่ถูกต้อง',415);
 const raw=await request.text();if(raw.length>6000)throw changeError('ข้อมูลเกินขนาด',413);
 try{return JSON.parse(raw);}catch{throw changeError('ข้อมูลไม่ถูกต้อง');}
}
export async function notificationReader(request,role){
 // A browser ID tracks read state only. It never grants access to a role or record.
 const id=(request.headers.get('cookie')||'').match(/(?:^|;\s*)ving_reader=([a-f0-9-]{36})(?:;|$)/i)?.[1]||'shared';
 return role+':'+id;
}
// Receipt audiences always use the signed account ID supplied by the worker.
const receiptAccount=id=>typeof id==='string'&&/^(admin|assistant-[123]|business-development-1)$/.test(id);
const notificationVersion=row=>row.status+':'+(row.decided_at||row.created_at);
const changePayload=value=>value?JSON.parse(value):{};
function notificationVisibility(role){
 const normal=['admin','assistant'].includes(role)?"c.status <> 'superseded'":"c.status = 'approved'";
 return `((c.kind <> 'notification_read' AND ${normal}) OR (c.kind = 'notification_read' AND c.status = 'acknowledged' AND EXISTS (SELECT 1 FROM json_each(c.after_json,'$.recipients') audience WHERE audience.value = ?)))`;
}
function notificationURL(row,after){
 return row.entity.startsWith('contract:')?'/contracts':(row.kind==='proposal_deleted'||after.sourceKind==='proposal_deleted')?'/event-proposals':'/event-predict?proposal='+encodeURIComponent(row.entity);
}
export async function listNotifications(env,role,reader,cursor='',userId=''){
 const before=/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[a-f0-9]{32}$/.test(cursor)?cursor:null;
 const conditions=notificationVisibility(role)+" AND NOT EXISTS (SELECT 1 FROM notification_reads d WHERE d.reader = ? AND d.change_id = c.id AND d.version = 'dismissed:' || c.status || ':' || COALESCE(c.decided_at,c.created_at))";
 const query=`SELECT c.*, r.id AS read_id FROM web_changes c LEFT JOIN notification_reads r ON r.id = ? || ':' || c.id AND r.version = c.status || ':' || COALESCE(c.decided_at,c.created_at) WHERE ${conditions} ${before?"AND (c.created_at || '|' || c.id) < ?":''} ORDER BY c.created_at DESC, c.id DESC LIMIT 51`;
 const args=[reader,userId,reader,...(before?[before]:[])];
 const result=await env.DB.prepare(query).bind(...args).all();
 const count=await env.DB.prepare(`SELECT COUNT(*) AS total FROM web_changes c LEFT JOIN notification_reads r ON r.id = ? || ':' || c.id AND r.version = c.status || ':' || COALESCE(c.decided_at,c.created_at) WHERE ${conditions} AND r.id IS NULL`).bind(reader,userId,reader).first();
 const pending=['admin','assistant'].includes(role)?await env.DB.prepare("SELECT COUNT(*) AS total FROM web_changes WHERE status = 'pending'").first():null;
 const rows=result.results.slice(0,50),last=rows.at(-1);
 return {items:rows.map(row=>{
  const after=changePayload(row.after_json),receipt=row.kind==='notification_read',details=['admin','assistant'].includes(role)&&!receipt;
  return {id:row.id,entity:row.entity,kind:row.kind,title:row.title,submittedBy:after.submittedBy||null,summary:String(after.branch||after.place||''),confirmBy:['proposal_created','proposal_updated'].includes(row.kind)?after.confirmBy??after.input?.confirmBy??null:null,status:row.status,createdAt:row.created_at,decidedAt:row.decided_at,decidedBy:row.decided_by,read:!!row.read_id,version:notificationVersion(row),before:details&&row.before_json?changePayload(row.before_json):null,after:details&&row.after_json?after:null,receipt:receipt?{readerLabel:after.readerLabel,readAt:row.created_at,sourceTitle:after.sourceTitle}:null,url:notificationURL(row,after)};
 }),unread:count.total,pending:pending?.total||0,nextCursor:result.results.length>50?last.created_at+'|'+last.id:null,canApprove:role==='admin'};
}
async function receiptFor(env,row,identity){
 if(!identity||row.kind==='notification_read')return null;
 const after=changePayload(row.after_json),before=changePayload(row.before_json),recipients=new Set();
 const addOwners=payload=>{for(const actor of [payload.createdBy,payload.submittedBy])if(receiptAccount(actor?.userId))recipients.add(actor.userId);};
 addOwners(after);addOwners(before);
 let related={};
 if(!recipients.size||['proposal_decision','proposal_deleted'].includes(row.kind)){
  const previous=await env.DB.prepare("SELECT before_json,after_json FROM web_changes WHERE entity=? AND kind IN ('proposal_created','proposal_updated','contract_updated','contract_renewed') AND id<>? AND created_at<=? AND (json_extract(after_json,'$.createdBy.userId') IS NOT NULL OR json_extract(after_json,'$.submittedBy.userId') IS NOT NULL OR json_extract(before_json,'$.submittedBy.userId') IS NOT NULL) ORDER BY created_at DESC,id DESC LIMIT 1").bind(row.entity,row.id,row.created_at).first();
  if(previous){related=changePayload(previous.after_json);addOwners(related);addOwners(changePayload(previous.before_json));}
 }
 // Older imported records do not identify their requester. Notify the configured
 // request-handling team, which already has permission to see these records.
 if(!recipients.size){
  for(let i=1;i<=3;i++)if(env['ASSISTANT_PASSWORD_'+i])recipients.add('assistant-'+i);
  if(env.BUSINESS_DEVELOPMENT_PASSWORD)recipients.add('business-development-1');
 }
 recipients.add('admin');recipients.delete(identity.userId);
 if(!recipients.size)return null;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([row.id,notificationVersion(row),identity.userId])));
 const id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
 const readerLabel=identity.role==='admin'?'CEO / Trade Manager':identity.userId==='business-development-1'?'Business Development':identity.role==='assistant'?'ทีมผู้ขออนุมัติ':'ผู้ชม';
 return {id,title:readerLabel+' อ่านรายการแล้ว',payload:JSON.stringify({recipients:[...recipients],readerLabel,sourceId:row.id,sourceVersion:notificationVersion(row),sourceKind:row.kind,sourceTitle:row.title,branch:after.branch||before.branch||related.branch||'',place:after.place||before.place||related.place||''})};
}
export async function readNotifications(request,env,role,reader,identity=null){
 const body=await changeBody(request);
 if(!Array.isArray(body?.items)||body.items.length>50)throw changeError('รายการไม่ถูกต้อง');
 const queries=[],reads=[],receipts=[],userId=identity?.userId||'',stamp=new Date().toISOString();
 // Recheck the complete request within the transaction, so a racing revision
 // cannot partially mark a bulk request read before returning a conflict.
 const allCurrent=`NOT EXISTS (SELECT 1 FROM json_each(?) requested LEFT JOIN web_changes c ON c.id=json_extract(requested.value,'$.id') WHERE c.id IS NULL OR NOT ${notificationVisibility(role)} OR json_extract(requested.value,'$.version') <> c.status || ':' || COALESCE(c.decided_at,c.created_at))`;
 const requestedItems=JSON.stringify(body.items);
 for(const item of body.items){
  if(!item||!/^[a-f0-9]{32}$/.test(item.id)||typeof item.version!=='string'||item.version.length>100)throw changeError('รายการไม่ถูกต้อง');
  const row=await env.DB.prepare(`SELECT c.* FROM web_changes c WHERE c.id=? AND ${notificationVisibility(role)}`).bind(item.id,userId).first();
  if(!row)throw changeError('ไม่พบการแจ้งเตือน',404);
  if(item.version!==notificationVersion(row))throw changeError('รายการเปลี่ยนแล้ว กรุณาโหลดใหม่',409);
  const guard=`c.id=? AND ${notificationVisibility(role)} AND ? = c.status || ':' || COALESCE(c.decided_at,c.created_at) AND ${allCurrent}`;
  reads.push(queries.length);
  queries.push(env.DB.prepare(`INSERT INTO notification_reads (id,reader,change_id,version) SELECT ?,?,?,? FROM web_changes c WHERE ${guard} ON CONFLICT(id) DO UPDATE SET version=excluded.version`).bind(reader+':'+item.id,reader,item.id,item.version,item.id,userId,item.version,requestedItems,userId));
  const receipt=await receiptFor(env,row,identity);
  if(receipt){
   receipts.push(queries.length);
   queries.push(env.DB.prepare(`INSERT INTO web_changes (id,entity,kind,title,after_json,status,created_at) SELECT ?,c.entity,'notification_read',?,?,'acknowledged',? FROM web_changes c WHERE ${guard} ON CONFLICT(id) DO NOTHING`).bind(receipt.id,receipt.title,receipt.payload,stamp,item.id,userId,item.version,requestedItems,userId));
  }
 }
 const results=queries.length?await env.DB.batch(queries):[];
 const changes=index=>results[index].meta?.changes??results[index].changes;
 if(reads.some(index=>!changes(index)))throw changeError('รายการเปลี่ยนแล้ว กรุณาโหลดใหม่',409);
 return {ok:true,notified:receipts.some(index=>changes(index)),alreadyNotified:receipts.length>0&&receipts.every(index=>!changes(index))};
}
export async function dismissNotification(request,env,role,reader,userId=''){
 const {id,version}=await changeBody(request);
 if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id)||typeof version!=='string'||version.length>100)throw changeError('รายการไม่ถูกต้อง');
 const row=await env.DB.prepare(`SELECT c.status,c.created_at,c.decided_at FROM web_changes c WHERE c.id=? AND ${notificationVisibility(role)}`).bind(id,userId).first();
 if(!row)throw changeError('ไม่พบการแจ้งเตือน',404);
 if(version!==notificationVersion(row))throw changeError('รายการเปลี่ยนแล้ว กรุณาโหลดใหม่',409);
 await env.DB.prepare("INSERT INTO notification_reads (id,reader,change_id,version) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version").bind(reader+':'+id,reader,id,'dismissed:'+version).run();
 return {ok:true};
}
export async function decideNotification(request,env){
 const {id,status}=await changeBody(request);
 if(!/^[a-f0-9]{32}$/.test(id)||!['approved','rejected'].includes(status))throw changeError('สถานะไม่ถูกต้อง');
 const row=await env.DB.prepare('SELECT * FROM web_changes WHERE id=?').bind(id).first();
 if(!row)throw changeError('ไม่พบรายการ',404);
 if(!['contract_updated','contract_renewed','proposal_deleted'].includes(row.kind))throw changeError('กรุณาอนุมัติพื้นที่ในหน้าข้อเสนอ Event',409);
 if(row.status===status)return {ok:true};
 const result=await env.DB.prepare("UPDATE web_changes SET status=?,decided_at=?,decided_by='CEO / Trade' WHERE id=? AND status='pending'").bind(status,new Date().toISOString(),id).run();
 if(!(result.meta?.changes??result.changes))throw changeError('รายการนี้เปลี่ยนแล้ว กรุณาโหลดใหม่',409);
 return {ok:true};
}
async function contractKey(branch){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(branch));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
export async function loadContracts(env,snapshot,role){
 const base=structuredClone(snapshot.data['/api/contracts']);
 if(!base||!Array.isArray(base.items))throw changeError('ยังอ่านสัญญาไม่ได้',503);
 const changes=await env.DB.prepare('SELECT * FROM contract_edits').all();const byId=new Map(changes.results.map(row=>[row.id,row]));
 base.items=await Promise.all(base.items.map(async item=>{const id=await contractKey(item.branch),edit=byId.get(id);return {...item,...(edit?JSON.parse(edit.payload):{}),id,revision:edit?.revision||'base'};}));
 const today=Date.parse(new Date(Date.now()+7*3600000).toISOString().slice(0,10));
 for(const item of base.items){if(/^\d{4}-\d{2}-\d{2}$/.test(item.ends_on))item.remaining_days=Math.ceil((Date.parse(item.ends_on)-today)/86400000);}
 base.summary={...base.summary,total:base.items.length,renewed:base.items.filter(i=>i.renewed).length,pending:base.items.filter(i=>!i.renewed).length,expiring_60_days:base.items.filter(i=>!i.renewed&&i.remaining_days<=60).length};
 base.permissions={canEdit:['admin','assistant'].includes(role)};return base;
}
export async function updateContract(request,env,snapshot,actor=null){
 const body=await changeBody(request);
 if(!/^[a-f0-9]{64}$/.test(body.id||'')||!/^[a-f0-9]{32}$/.test(body.changeId||''))throw changeError('รหัสสัญญาไม่ถูกต้อง');
 const previous=await env.DB.prepare('SELECT id FROM web_changes WHERE id=? AND entity=?').bind(body.changeId,'contract:'+body.id).first();if(previous)return {ok:true};
 const data=await loadContracts(env,snapshot,'admin');const item=data.items.find(i=>i.id===body.id);if(!item)throw changeError('ไม่พบสัญญา',404);
 if(body.revision!==item.revision)throw changeError('สัญญาถูกแก้ไขแล้ว กรุณาเปิดใหม่',409);
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!validDate(body.starts_on)||!validDate(body.ends_on)||body.starts_on>body.ends_on||typeof body.renewed!=='boolean')throw changeError('กรุณาระบุวันที่เริ่มและสิ้นสุดให้ถูกต้อง');
 if(body.operation!==undefined&&!['update','renew'].includes(body.operation))throw changeError('ประเภทการเปลี่ยนแปลงไม่ถูกต้อง');
 if(body.operation==='renew'&&!body.renewed)throw changeError('กรุณาเลือกสถานะต่อสัญญาแล้ว');
 const clean=(value,max=100)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[<>\r\n@]|(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b|\b\d{13}\b/.test(value))throw changeError('กรอกเฉพาะรายละเอียดสัญญา ไม่ใส่ข้อมูลส่วนบุคคล');return value.trim();};
 const branch=body.branch===undefined?item.branch:clean(body.branch,120);
 if(data.items.some(row=>row.id!==item.id&&row.branch.normalize('NFC').trim()===branch.normalize('NFC').trim()))throw changeError('มีชื่อสาขานี้อยู่แล้ว');
 const after={branch,term:clean(body.term),starts_on:body.starts_on,ends_on:body.ends_on,renewed:body.renewed,status:clean(body.status)};
 const before=Object.fromEntries(Object.keys(after).map(k=>[k,item[k]]));
 if(JSON.stringify(before)===JSON.stringify(after))return {ok:true,unchanged:true};
 const stamp=new Date().toISOString(),payload=JSON.stringify({...after,submittedBy:actor}),revision=body.changeId;
 const write=item.revision==='base'?env.DB.prepare('INSERT INTO contract_edits (id,payload,revision) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,payload,revision):env.DB.prepare('UPDATE contract_edits SET payload=?,revision=? WHERE id=? AND revision=?').bind(payload,revision,body.id,item.revision);
 const guard='EXISTS (SELECT 1 FROM contract_edits WHERE id=? AND revision=?)';
 const results=await env.DB.batch([write,
 env.DB.prepare(`UPDATE web_changes SET status='superseded' WHERE entity=? AND status='pending' AND ${guard}`).bind('contract:'+body.id,body.id,revision),
 env.DB.prepare(`INSERT INTO web_changes (id,entity,kind,title,before_json,after_json,status,created_at) SELECT ?,?,?,?,?,?,'pending',? WHERE ${guard}`).bind(body.changeId,'contract:'+body.id,body.operation==='renew'||body.renewed&&!item.renewed?'contract_renewed':'contract_updated',body.operation==='renew'||body.renewed&&!item.renewed?'ต่อสัญญา':'อัปเดตสัญญา',JSON.stringify(before),payload,stamp,body.id,revision)
 ]);
 if(!(results[0].meta?.changes??results[0].changes))throw changeError('สัญญาถูกแก้ไขแล้ว กรุณาเปิดใหม่',409);
 return {ok:true};
}
