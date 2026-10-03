import {summaryEventKey} from './out/assets/summary-event-key.mjs';
const summaryDeletionError=(message,status=400)=>Object.assign(new Error(message),{status});
export async function readSummaryEventDeletions(env){
 if(!env.DB)throw summaryDeletionError('ยังอ่านรายการ Event ที่ลบไม่ได้ กรุณาลองใหม่',503);
 return (await env.DB.prepare('SELECT id FROM summary_event_deletions').all()).results.map(row=>row.id);
}
export async function deleteSummaryEvent(request,env,loadCatalog){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw summaryDeletionError('คำขอต้องมาจากเว็บนี้',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw summaryDeletionError('รูปแบบคำขอไม่ถูกต้อง',415);
 const raw=await request.text();if(raw.length>4000)throw summaryDeletionError('ข้อมูลเกินขนาด',413);
 let body;try{body=JSON.parse(raw);}catch{throw summaryDeletionError('รูปแบบคำขอไม่ถูกต้อง');}
 const key=body?.key;
 if(typeof key!=='string'||!key||key.length>2000)throw summaryDeletionError('รหัส Event ไม่ถูกต้อง');
 if(!env.DB)throw summaryDeletionError('ยังลบ Event ไม่ได้ กรุณาลองใหม่',503);
 if(await env.DB.prepare('SELECT id FROM summary_event_deletions WHERE id = ?').bind(key).first())return {ok:true,key};
 const {events,approvedProposals}=await loadCatalog();
 const keys=new Set(Object.entries(events?.years||{}).flatMap(([year,group])=>(group.items||[]).map(item=>summaryEventKey(item,year))));
 for(const item of approvedProposals)if(item.deletionKey)keys.add('proposal:'+item.deletionKey);
 if(!keys.has(key))throw summaryDeletionError('ไม่พบ Event นี้ กรุณารีเฟรชรายการ',404);
 await env.DB.prepare('INSERT INTO summary_event_deletions (id, deleted_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING').bind(key,new Date().toISOString()).run();
 return {ok:true,key};
}
