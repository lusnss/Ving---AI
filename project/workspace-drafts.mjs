const draftHeaders = {'cache-control':'no-store','content-type':'application/json; charset=utf-8'};
const draftResponse = (value, status=200) => Response.json(value, {status,headers:draftHeaders});
const draftRecord = row => row ? {revision:row.revision,updatedAt:row.updated_at,payload:JSON.parse(row.payload)} : null;

// Drafts never mutate, submit or approve business records. Ownership comes only
// from the verified session, including when two users share the same device.
export async function handleWorkspaceDrafts(request, env, identity, permissions) {
 if (!identity) return draftResponse({error:'กรุณาเข้าสู่ระบบ'},401);
 if (!permissions.canEdit) return draftResponse({error:'บัญชีนี้ไม่มีสิทธิ์บันทึกร่าง'},403);
 const url=new URL(request.url),scope=url.searchParams.get('scope')||'';
 if (!/^\/[a-z0-9/_?=&.%-]{0,240}$/i.test(scope)) return draftResponse({error:'หน้าร่างไม่ถูกต้อง'},400);
 if (!['GET','PUT'].includes(request.method)) return draftResponse({error:'Method not allowed'},405);
 if (request.method==='PUT' && request.headers.get('origin')!==url.origin) return draftResponse({error:'คำขอต้องมาจากเว็บนี้'},403);
 if (!env.DB) return draftResponse({error:'ยังเชื่อมต่อฐานข้อมูลร่างไม่ได้'},503);
 const owner=identity.userId,id=owner+':'+scope;
 if(url.searchParams.has('account')&&url.searchParams.get('account')!==owner)return draftResponse({error:'บัญชีที่เข้าสู่ระบบเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่ก่อนแก้ไขต่อ'},403);
 try {
  if (request.method==='GET') {
   if (url.searchParams.get('history')==='1') {
    const rows=await env.DB.prepare('SELECT revision, updated_at, payload FROM workspace_draft_history WHERE owner = ? AND scope = ? ORDER BY updated_at DESC, rowid DESC LIMIT 30').bind(owner,scope).all();
    return draftResponse({items:rows.results.map(draftRecord)});
   }
   return draftResponse({draft:draftRecord(await env.DB.prepare('SELECT revision, updated_at, payload FROM workspace_drafts WHERE id = ?').bind(id).first())});
  }
  if (Number(request.headers.get('content-length'))>500000) return draftResponse({error:'ร่างมีขนาดใหญ่เกินไป'},413);
  const raw=await request.text();
  if (new TextEncoder().encode(raw).length>500000) return draftResponse({error:'ร่างมีขนาดใหญ่เกินไป'},413);
  let input;try {input=JSON.parse(raw);}catch{return draftResponse({error:'ข้อมูลร่างไม่ถูกต้อง'},400);}
  if (!input || !/^[a-f0-9-]{36}$/.test(input.saveId||'') || (input.revision!==null&&!/^[a-f0-9-]{36}$/.test(input.revision||'')) || !input.payload || Array.isArray(input.payload) || typeof input.payload!=='object' || input.payload.version!==1) return draftResponse({error:'ข้อมูลร่างไม่ถูกต้อง'},400);
  const previous=await env.DB.prepare('SELECT revision, updated_at, payload FROM workspace_drafts WHERE id = ?').bind(id).first();
  if (previous?.revision===input.saveId) return draftResponse({draft:draftRecord(previous)});
  if ((previous?.revision||null)!==input.revision) return draftResponse({error:'มีร่างที่ใหม่กว่าจากอีกแท็บ กรุณาเลือกฉบับที่จะใช้',draft:draftRecord(previous)},409);
  const payload=JSON.stringify(input.payload),now=new Date().toISOString();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO workspace_drafts (id, owner, scope, revision, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, updated_at=excluded.updated_at, payload=excluded.payload WHERE workspace_drafts.revision = ?').bind(id,owner,scope,input.saveId,now,payload,input.revision),
   env.DB.prepare('INSERT OR IGNORE INTO workspace_draft_history (revision, owner, scope, updated_at, payload) SELECT revision, owner, scope, updated_at, payload FROM workspace_drafts WHERE id = ? AND revision = ?').bind(id,input.saveId),
   env.DB.prepare('DELETE FROM workspace_draft_history WHERE owner = ? AND scope = ? AND revision NOT IN (SELECT revision FROM workspace_draft_history WHERE owner = ? AND scope = ? ORDER BY updated_at DESC, rowid DESC LIMIT 30)').bind(owner,scope,owner,scope),
  ]);
  const current=await env.DB.prepare('SELECT revision, updated_at, payload FROM workspace_drafts WHERE id = ?').bind(id).first();
  if (current?.revision!==input.saveId) return draftResponse({error:'มีร่างที่ใหม่กว่าจากอีกแท็บ กรุณาเลือกฉบับที่จะใช้',draft:draftRecord(current)},409);
  return draftResponse({draft:draftRecord(current)});
 } catch(error) {
  console.error('Workspace draft storage unavailable',error?.name);
  return draftResponse({error:'ยังบันทึกร่างในฐานข้อมูลไม่ได้ ข้อมูลที่แก้ไขยังอยู่ในหน้านี้ กรุณาลองอีกครั้ง'},503);
 }
}
