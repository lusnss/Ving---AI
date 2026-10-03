import {pushBase64,pushBytes,pushEndpoint,sendWebPush} from './web-push.mjs';
const mobileError=(message,status=400)=>Object.assign(Error(message),{status});
const mobileJson=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export function mobilePushReady(env){return !!(env.DB&&env.WEB_PUSH_PRIVATE_JWK&&env.WEB_PUSH_PUBLIC_KEY&&env.WEB_PUSH_SUBJECT);}
function mobileDevice(request){return (request.headers.get('cookie')||'').match(/(?:^|;\s*)ving_reader=([a-f0-9-]{36})(?:;|$)/i)?.[1]||'';}
async function mobileAccountTag(env,userId){
 const name=userId==='admin'?'ADMIN_PASSWORD':userId==='viewer'?'VIEWER_PASSWORD':userId==='business-development-1'?'BUSINESS_DEVELOPMENT_PASSWORD':/^assistant-[123]$/.test(userId)?'ASSISTANT_PASSWORD_'+userId.slice(-1):null;
 if(!name||!env[name])return '';
 const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return pushBase64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(userId+':'+env[name]))));
}
export async function revokeMobilePush(env,request,keepUser=null){
 const device=mobileDevice(request);if(!mobilePushReady(env)||!device)return;
 await env.DB.prepare('DELETE FROM mobile_push_subscriptions WHERE device_id=? AND (? IS NULL OR user_id<>?)').bind(device,keepUser,keepUser).run();
}
async function mobileBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw mobileError('รูปแบบคำขอไม่ถูกต้อง',415);
 if(Number(request.headers.get('content-length'))>5000)throw mobileError('ข้อมูลเกินขนาด',413);
 const raw=await request.text();if(raw.length>5000)throw mobileError('ข้อมูลเกินขนาด',413);
 try{return JSON.parse(raw);}catch{throw mobileError('ข้อมูลไม่ถูกต้อง');}
}
export async function handleMobilePush(request,env,identity){
 try{
  const url=new URL(request.url),device=mobileDevice(request),now=Date.now();
  if(!identity)return mobileJson({error:'กรุณาเข้าสู่ระบบ'},401);
  if(!['GET','POST','DELETE'].includes(request.method))return mobileJson({error:'Method not allowed'},405);
  if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return mobileJson({error:'คำขอต้องมาจากเว็บนี้'},403);
  if(request.method==='GET'){
   if(!mobilePushReady(env))return mobileJson({configured:false,enabled:false});
   const saved=device?await env.DB.prepare('SELECT account_tag,expires_at FROM mobile_push_subscriptions WHERE device_id=? AND user_id=? LIMIT 1').bind(device,identity.userId).first():null;
   return mobileJson({configured:true,publicKey:env.WEB_PUSH_PUBLIC_KEY,enabled:!!(saved&&saved.expires_at>now&&saved.account_tag===await mobileAccountTag(env,identity.userId))});
  }
  if(!mobilePushReady(env))throw mobileError('ระบบแจ้งเตือนบนมือถือยังไม่พร้อม กรุณาลองใหม่',503);
  if(!device)throw mobileError('กรุณาโหลดหน้าเว็บใหม่ก่อนเปิดแจ้งเตือน',409);
  if(request.method==='DELETE'){
   await env.DB.prepare('DELETE FROM mobile_push_subscriptions WHERE device_id=? AND user_id=?').bind(device,identity.userId).run();
   return mobileJson({ok:true});
  }
  if(url.pathname==='/api/mobile-push/test'){
   const row=await env.DB.prepare('UPDATE mobile_push_subscriptions SET test_after=? WHERE device_id=? AND user_id=? AND expires_at>? AND test_after<=? RETURNING *').bind(now+30000,device,identity.userId,now,now).first();
   if(!row)throw mobileError('กรุณาเปิดแจ้งเตือนก่อน หรือเว้นการทดสอบ 30 วินาที',429);
   if(row.account_tag!==await mobileAccountTag(env,identity.userId))throw mobileError('กรุณาเปิดแจ้งเตือนใหม่',409);
   const status=await sendWebPush({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},{title:'VING Warroom',body:'ทดสอบการแจ้งเตือนสำเร็จ แตะเพื่อเปิดเว็บ',url:'/daily-sales?notifications=1',tag:'ving-push-test'},env);
   if(status===404||status===410){await env.DB.prepare('DELETE FROM mobile_push_subscriptions WHERE id=?').bind(row.id).run();throw mobileError('การเชื่อมต่อหมดอายุ กรุณาปิดแล้วเปิดแจ้งเตือนใหม่',409);}
   if(status<200||status>=300)throw mobileError('ยังส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่',503);
   return mobileJson({ok:true});
  }
  const {subscription}=await mobileBody(request);
  try{
   pushEndpoint(subscription.endpoint);
   const key=pushBytes(subscription.keys.p256dh),auth=pushBytes(subscription.keys.auth);
   if(key.length!==65||key[0]!==4||auth.length!==16)throw Error();
   await crypto.subtle.importKey('raw',key,{name:'ECDH',namedCurve:'P-256'},false,[]);
  }catch{throw mobileError('ข้อมูลอุปกรณ์ไม่ถูกต้อง กรุณาเปิดแจ้งเตือนใหม่');}
  const id=pushBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint))));
  const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM mobile_push_subscriptions WHERE user_id=? AND expires_at>? AND device_id<>?').bind(identity.userId,now,device).first();
  if(total.n>=20)throw mobileError('บัญชีนี้เปิดแจ้งเตือนครบ 20 อุปกรณ์แล้ว',409);
  const tag=await mobileAccountTag(env,identity.userId);
  await env.DB.batch([
   env.DB.prepare('DELETE FROM mobile_push_subscriptions WHERE device_id=? AND id<>?').bind(device,id),
   env.DB.prepare(`INSERT INTO mobile_push_subscriptions (id,endpoint,p256dh,auth,user_id,role,device_id,account_tag,last_event,expires_at)
    VALUES (?,?,?,?,?,?,?,?,COALESCE((SELECT MAX(seq) FROM mobile_push_events),0),?)
    ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,role=excluded.role,device_id=excluded.device_id,account_tag=excluded.account_tag,p256dh=excluded.p256dh,auth=excluded.auth,expires_at=excluded.expires_at,
    last_event=CASE WHEN mobile_push_subscriptions.user_id=excluded.user_id AND mobile_push_subscriptions.account_tag=excluded.account_tag AND mobile_push_subscriptions.expires_at>? THEN mobile_push_subscriptions.last_event ELSE excluded.last_event END,
    lock_until=CASE WHEN mobile_push_subscriptions.user_id=excluded.user_id THEN mobile_push_subscriptions.lock_until ELSE 0 END,
    lock_token=CASE WHEN mobile_push_subscriptions.user_id=excluded.user_id THEN mobile_push_subscriptions.lock_token ELSE NULL END`).bind(id,subscription.endpoint,subscription.keys.p256dh,subscription.keys.auth,identity.userId,identity.role,device,tag,now+180*86400000,now)
  ]);
  return mobileJson({ok:true,enabled:true});
 }catch(error){return mobileJson({error:error.status?error.message:'ยังเชื่อมต่อการแจ้งเตือนไม่ได้ กรุณาลองใหม่'},error.status||503);}
}
const mobileKinds={notification_read:'มีผู้เกี่ยวข้องอ่านรายการแล้ว',proposal_created:'มีคำขออนุมัติ Event ใหม่',proposal_updated:'มีการแก้ไขคำขอ Event',proposal_deleted:'มีคำขอลบ Event',proposal_decision:'มีผลพิจารณา Event',contract_updated:'มีการแก้ไขสัญญา',contract_renewed:'มีการต่อสัญญา'};
async function drainMobileSubscription(env,original,send){
 const now=Date.now(),token=crypto.randomUUID();
 const row=await env.DB.prepare('UPDATE mobile_push_subscriptions SET lock_until=?,lock_token=? WHERE id=? AND lock_until<? RETURNING *').bind(now+25000,token,original.id,now).first();
 if(!row)return;
 try{
  if(row.expires_at<=now||row.account_tag!==await mobileAccountTag(env,row.user_id)){await env.DB.prepare('DELETE FROM mobile_push_subscriptions WHERE id=? AND lock_token=?').bind(row.id,token).run();return;}
  const result=await env.DB.prepare(`SELECT e.seq,e.status,e.version,c.kind,c.entity,c.after_json,c.status AS current_status,COALESCE(c.decided_at,c.created_at) AS current_version FROM mobile_push_events e LEFT JOIN web_changes c ON c.id=e.change_id WHERE e.seq>? ORDER BY e.seq LIMIT 100`).bind(row.last_event).all();
  if(!result.results.length)return;
  const visible=result.results.filter(e=>{
   if(e.current_status!==e.status||e.current_version!==e.version||e.status==='superseded')return false;
   if(e.kind==='notification_read'){try{return e.status==='acknowledged'&&JSON.parse(e.after_json).recipients.includes(row.user_id);}catch{return false;}}
   return row.role!=='viewer'||e.status==='approved';
  });
  if(visible.length){
   const latest=visible.at(-1),status=latest.status==='approved'?' · อนุมัติแล้ว':latest.status==='rejected'?' · ไม่อนุมัติ':'',url=latest.entity?.startsWith('contract:')?'/contracts?notifications=1':'/event-proposals?notifications=1';
   // Only fixed copy goes onto lock screens; record contents remain behind login.
   const body=visible.length===1?(mobileKinds[latest.kind]||'มีการเปลี่ยนแปลงในเว็บ')+status:`มีรายการแจ้งเตือนใหม่ ${visible.length} รายการ แตะเพื่อดูรายละเอียด`;
   const code=await sendWebPush({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},{title:'VING Warroom',body,url,tag:'ving-event-'+latest.seq},env,send);
   if(code===404||code===410){await env.DB.prepare('DELETE FROM mobile_push_subscriptions WHERE id=? AND lock_token=?').bind(row.id,token).run();return;}
   if(code<200||code>=300)throw Error('Push service rejected request');
  }
  await env.DB.prepare('UPDATE mobile_push_subscriptions SET last_event=? WHERE id=? AND lock_token=?').bind(result.results.at(-1).seq,row.id,token).run();
 }finally{await env.DB.prepare('UPDATE mobile_push_subscriptions SET lock_until=0,lock_token=NULL WHERE id=? AND lock_token=?').bind(row.id,token).run();}
}
export async function dispatchMobilePush(env,send=fetch,{deadline=Date.now()+19000}={}){
 if(!mobilePushReady(env))return;
 // Persistent cursors prevent repeat notifications; failed deliveries remain queued.
 const rows=await env.DB.prepare('SELECT id FROM mobile_push_subscriptions WHERE last_event<COALESCE((SELECT MAX(seq) FROM mobile_push_events),0) ORDER BY last_event LIMIT 60').all();
 for(let i=0;i<rows.results.length&&Date.now()<deadline-6500;i+=6)await Promise.allSettled(rows.results.slice(i,i+6).map(row=>drainMobileSubscription(env,row,send)));
}
