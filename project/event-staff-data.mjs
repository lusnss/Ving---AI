import {loadEventSchedule} from './event-logistics-data.mjs';
import {sheetScheduleItems} from './out/assets/event-logistics.mjs';
const namesAllowed=['Nat','Not','Tom'];
const keyFor=item=>JSON.stringify([item.place||item.name,item.type||'',item.setupDate||'',item.startDate||'',item.endDate||'',item.kind]);
const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
export async function handleEventStaff(request,env,permissions){
 const url=new URL(request.url);
 if(!['GET','PUT'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(request.method==='PUT'&&!permissions.canEdit)return reply({error:'บัญชีนี้ดูได้อย่างเดียว'},403);
 if(request.method==='PUT'&&request.headers.get('origin')!==url.origin)return reply({error:'คำขอต้องมาจากเว็บนี้'},403);
 if(!env.DB)return reply({error:'ยังเชื่อมต่อแผนกำลังคนไม่ได้'},503);
 try{
  if(request.method==='GET'){
   const rows=await env.DB.prepare('SELECT id, names, revision FROM event_staff_assignments').all();
   return reply({canEdit:permissions.canEdit,items:Object.fromEntries(rows.results.map(row=>[row.id,{names:JSON.parse(row.names),revision:row.revision}]))});
  }
  const raw=await request.text();if(raw.length>4000)return reply({error:'ข้อมูลใหญ่เกินไป'},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({error:'ข้อมูลไม่ถูกต้อง'},400);}
  if(!input||typeof input.key!=='string'||input.key.length>2000||!Array.isArray(input.names)||input.names.length>3||input.names.some(n=>!namesAllowed.includes(n))||new Set(input.names).size!==input.names.length||!(input.revision===null||typeof input.revision==='string'&&/^[a-f0-9-]{36}$/.test(input.revision)))return reply({error:'ข้อมูลผู้ไปงานไม่ถูกต้อง'},400);
  const feed=await loadEventSchedule(env);
  if(feed.source.status!=='online')return reply({error:'ยังยืนยันตารางล่าสุดไม่ได้ กรุณาลองใหม่'},503);
  if(sheetScheduleItems(feed,'logistics').filter(item=>keyFor(item)===input.key).length!==1)return reply({error:'ตารางงานเปลี่ยนหรือมีรายการซ้ำ กรุณาโหลดหน้าใหม่'},409);
  const revision=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO event_staff_assignments (id,names,revision,updated_at) SELECT ?,?,?,? WHERE ? IS NULL OR EXISTS (SELECT 1 FROM event_staff_assignments WHERE id=? AND revision=?) ON CONFLICT(id) DO UPDATE SET names=excluded.names,revision=excluded.revision,updated_at=excluded.updated_at WHERE event_staff_assignments.revision=?').bind(input.key,JSON.stringify(namesAllowed.filter(n=>input.names.includes(n))),revision,new Date().toISOString(),input.revision,input.key,input.revision,input.revision).run();
  const current=await env.DB.prepare('SELECT names,revision FROM event_staff_assignments WHERE id=?').bind(input.key).first();
  if(current?.revision!==revision)return reply({error:'มีคนปรับแผนงานนี้แล้ว กรุณาโหลดแผนล่าสุดแล้วเลือกอีกครั้ง'},409);
  return reply({names:JSON.parse(current.names),revision});
 }catch(error){console.error('Event staffing database unavailable',error?.name,error?.message);return reply({error:'บันทึกหรือโหลดแผนไม่สำเร็จ กรุณาลองใหม่'},503);}
}
