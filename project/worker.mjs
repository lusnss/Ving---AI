import {handleCloudData,mergeCloudSnapshot,isLegacyCloudPath} from './cloud-data.mjs';
import {handleEventStaff} from './event-staff-data.mjs';
import {refreshPlan,refreshSource} from './data-refresh.mjs';
import {loadOperations,applyOperations} from './operations-live.mjs';
import {loadEventSchedule} from './event-logistics-data.mjs';
import {handleBranchProfit} from './branch-profit-data.mjs';
import {readSummaryEventDeletions,deleteSummaryEvent} from './summary-event-deletions.mjs';
import {handleWorkspaceDrafts} from './workspace-drafts.mjs';
import {loadPromotionEvents,promotionEventDetail} from './promotion-events-data.mjs';
import {handleMobilePush,revokeMobilePush,dispatchMobilePush,mobilePushReady} from './mobile-push.mjs';
import {readPromotionHistory} from './promotion-forecast-data.mjs';
import {readPromotionPlans,promotionStock,savePromotionPlan,changePromotionPlan} from './promotions-data.mjs';
import {loadStockSummary} from './stock-summary-data.mjs';
import {handleInventory} from './inventory-data.mjs';
import {loadProductCosts} from './product-cost-data.mjs';
import {uploadEventImage,readEventImage} from './event-images.mjs';
import {accessForRole} from './out/assets/access-permissions.mjs';
import {loadStockReport} from './stock-report-data.mjs';
import {handleAnalysis} from './analysis-data.mjs';
import {loadStockForecast,forecastPeriod} from './stock-forecast-data.mjs';
import {loadWarehouse} from './warehouse-data.mjs';
import { loadBranchStock } from './branch-stock.mjs';
import {loadComparison} from './daily-comparison-live.mjs';
import { notificationReader, dismissNotification, listNotifications, readNotifications, decideNotification, loadContracts, updateContract } from './notifications.mjs';
import { assets, fallback } from './assets.mjs';
import { sanitizeSnapshot, ensureDailySales } from './sanitize.mjs';
import { receiveCloudSales, applyCloudSales } from './cloud-sales.mjs';
import { handleOnlineSales } from './online-sales.mjs';
import { applyEventSales } from './events-data.mjs';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','referrer-policy':'same-origin'};
const json=(data,status=200)=>Response.json(data,{status,headers});
const SESSION_COOKIE='ving_session';
const SESSION_SECONDS=28_800;
const encoder=new TextEncoder();
function readCookie(request,name){return (request.headers.get('cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1)||'';}
function toBase64Url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function fromBase64Url(value){const padded=value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4);return Uint8Array.from(atob(padded),char=>char.charCodeAt(0));}
async function sessionKey(env){if(!env.SESSION_SECRET)throw Error('Session configuration unavailable');return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function accountIdentity(env,userId){
 const index=/^assistant-([123])$/.exec(userId)?.[1];
 const business=userId==='business-development-1';
 const role=index||business?'assistant':userId==='admin'?'admin':userId==='viewer'?'viewer':null;
 if(!role)return null;
 const position=business?'Business Development':accessForRole(role).label;
 const team=index?'ทีมห้าง':null;
 const configured=index?env['ASSISTANT_NAME_'+index]:null;
 const userName=typeof configured==='string'&&configured.trim()?configured.trim().slice(0,80):position;
 return {role,userId,userName,position,team};
}
async function createSession(env,identity){const expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;const payload=`v4.${identity.role}.${identity.userId}.${expires}`;const signature=await crypto.subtle.sign('HMAC',await sessionKey(env),encoder.encode(payload));return `${payload}.${toBase64Url(new Uint8Array(signature))}`;}
async function sessionIdentity(request,env){
 try{
  const parts=readCookie(request,SESSION_COOKIE).split('.');if(parts.length!==5)return null;
  const [version,role,userId,expires,signature]=parts,identity=accountIdentity(env,userId);
  if(version!=='v4'||!identity||identity.role!==role||!/^\d+$/.test(expires)||Number(expires)<=Math.floor(Date.now()/1000)||!signature)return null;
  return await crypto.subtle.verify('HMAC',await sessionKey(env),fromBase64Url(signature),encoder.encode(`${version}.${role}.${userId}.${expires}`))?identity:null;
 }catch{return null;}
}
function safeNext(value){return value&&value.startsWith('/')&&!value.startsWith('//')&&!/[\\\r\n]/.test(value)?value:'/';}
function escapeAttr(value){return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function loginPage(failed=false,next='/'){return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เข้าสู่ระบบ</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(90deg,#17171738,#17171712 55%,#17171740),url('/assets/login-hero.png') center/cover no-repeat fixed;color:#272727;font:16px/1.5 system-ui,sans-serif}
.login{box-sizing:border-box;width:min(100% - 32px,370px);padding:36px;background:#fffffff2;border:1px solid #ffffffa6;border-radius:18px;box-shadow:0 18px 52px #08080866;backdrop-filter:blur(8px)}
h1{margin:0 0 8px;color:#ef7023;font-size:1.8rem;letter-spacing:-.04em}p{margin:0 0 24px;color:#5a5a5a}label{display:block;margin-bottom:8px;font-weight:700}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #b9b9b9;border-radius:8px;background:#ffffff;font:inherit}button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:8px;background:#ef7023;color:#ffffff;font:700 1rem inherit;cursor:pointer}button:hover{background:#ef7023}.error{margin:-8px 0 16px;color:#ef7023;font-weight:700}
@media (max-width:600px){body{background-position:35% center}.login{padding:28px}}
</style><link rel="stylesheet" href="/assets/ving-brand.css"><link rel="icon" href="/assets/push-icon-192.png" type="image/png"></head><body><main class="login"><h1><span class="ving-wordmark" role="img" aria-label="VING"></span></h1><p>กรอกรหัสเพื่อเข้าใช้งาน</p>${failed?'<p class="error">รหัสไม่ถูกต้อง</p>':''}<form method="post" action="/login"><input type="hidden" name="next" value="${escapeAttr(safeNext(next))}"/><label for="password">รหัสผ่าน</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus/><button type="submit">เข้าสู่ระบบ</button></form></main></body></html>`;}
function redirectLogin(url){return Response.redirect(new URL('/login?next='+encodeURIComponent(url.pathname+url.search),url),303);}
async function login(request,url,env){
 if(request.method==='GET'||request.method==='HEAD'){const failed=url.searchParams.get('error')==='1';return new Response(request.method==='HEAD'?null:loginPage(failed,url.searchParams.get('next')),{headers:{...headers,'content-type':'text/html; charset=utf-8'}});}
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Forbidden'},403);
 if(!env.SESSION_SECRET||!env.ADMIN_PASSWORD||!env.VIEWER_PASSWORD)return json({error:'ระบบเข้าสู่ระบบยังไม่พร้อม'},503);
 const form=await request.formData().catch(()=>null),next=safeNext(String(form?.get('next')||'/')),password=form?.get('password');
 const accounts=[['admin',env.ADMIN_PASSWORD],['viewer',env.VIEWER_PASSWORD],['business-development-1',env.BUSINESS_DEVELOPMENT_PASSWORD],...[1,2,3].map(index=>['assistant-'+index,env['ASSISTANT_PASSWORD_'+index]])];
 const matches=typeof password==='string'&&password.length>0?accounts.filter(([,value])=>typeof value==='string'&&value.length>0&&value===password):[];
 if(matches.length!==1)return Response.redirect(new URL('/login?error=1&next='+encodeURIComponent(next),url),303);
 const identity=accountIdentity(env,matches[0][0]);
 try{await revokeMobilePush(env,request,identity.userId);}catch{return json({error:'ยังเปลี่ยนบัญชีไม่ได้ กรุณาลองใหม่'},503);}
 const token=await createSession(env,identity);return new Response(null,{status:303,headers:{...headers,location:next,'set-cookie':`${SESSION_COOKIE}=${token}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`}});
}
async function authorized(request,secret){if(!secret)return false;const actual=request.headers.get('authorization')||'';const enc=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(actual)),crypto.subtle.digest('SHA-256',enc.encode('Bearer '+secret))]);const aa=new Uint8Array(a),bb=new Uint8Array(b);let d=0;for(let i=0;i<aa.length;i++)d|=aa[i]^bb[i];return d===0;}
async function predictionDatabase(env){
 const costsPending=predictWithin(()=>loadPredictData(env,predictFallback),5500).catch(()=>({...predictFallback,source:{...predictFallback.source,status:'stale'}}));
 let snapshot=fallback,salesStatus='saved';
 try{
  const saved=await predictWithin(async()=>{const stored=await env.BUCKET.get('snapshot.json');return stored?await stored.json():null;},1000);if(saved)snapshot=saved;
  snapshot=ensureDailySales(snapshot);
  const report=snapshot.data['/api/daily-sales'];
  const periods=Object.fromEntries(Object.entries(report.periods||{}).map(([key,p])=>[key,{...p,source:{...p.source,fetched_at:p.source?.fetched_at||report.source?.fetched_at||null}}]));
  snapshot={...snapshot,data:{...snapshot.data,'/api/daily-sales':{...report,periods}}};
  snapshot=await predictWithin(()=>applyCloudSales(snapshot,env),1000);
 }catch{salesStatus='stale';}
 return mergeVenueDatabase(await costsPending,snapshot.data?.['/api/daily-sales'],{salesStatus});
}
async function handleRequest(request,env,ctx){
  const publicPushPaths=['/assets/ving-brand.css','/assets/ving-brand-source.png',...['Regular','Medium','SemiBold','Bold'].map(weight=>'/assets/fonts/IBMPlexSansThaiLooped-'+weight+'.woff2'),'/sw.js','/manifest.webmanifest','/assets/push-icon-192.png','/assets/push-icon-512.png'];
  const pushPath=new URL(request.url).pathname;
  if(publicPushPaths.includes(pushPath)){
   if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
   const asset=assets[pushPath];if(!asset)return new Response('Not found',{status:404});
   return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),{headers:{...headers,'content-type':asset.type,...(pushPath==='/sw.js'?{'service-worker-allowed':'/'}:{})}});
  }
  const url=new URL(request.url);
  if(['/api/cloud-workspace/import','/api/cloud-workspace/import-status'].includes(url.pathname)){
    // The verified one-time import is complete. Retire the HTTP capability even
    // if an older runtime environment retains the former migration secret.
    return json({error:'Migration completed; this endpoint is retired'},410);
  }
  if(url.pathname==='/api/sales-online/callback')return handleOnlineSales(request,env,null,ctx);
  if(url.pathname==='/api/sync/daily-sales')return receiveCloudSales(request,env);
  if(url.pathname==='/login')return login(request,url,env);
  if(url.pathname==='/api/sync'){
    if(request.method!=='PUT')return json({error:'Method not allowed'},405);
    if(!await authorized(request,env.SYNC_TOKEN))return json({error:'Unauthorized'},401);
    try{
      if(Number(request.headers.get('content-length'))>2_000_000)return json({error:'Too large'},413);
      const text=await request.text();if(new TextEncoder().encode(text).length>2_000_000)return json({error:'Too large'},413);
      const input=JSON.parse(text);const stamp=Date.parse(input.exportedAt);
      if(!Number.isFinite(stamp)||Math.abs(Date.now()-stamp)>300_000)return json({error:'Invalid timestamp'},400);
      const snapshot=sanitizeSnapshot(input);snapshot.syncedAt=new Date().toISOString();
      await env.BUCKET.put('snapshot.json',JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
      return json({ok:true,syncedAt:snapshot.syncedAt});
    }catch{return json({error:'Unable to save snapshot'},503);}
  }
  const identity=await sessionIdentity(request,env);
  const role=identity?.role;
  const actor=identity?{userId:identity.userId,name:identity.userName,role:identity.role}:null;
  const access=accessForRole(role);
  const permissions={canEdit:access.canEdit,canApprove:access.canApprove};
  if(url.pathname!=='/assets/login-hero.png'&&!role)return url.pathname.startsWith('/api/')?json({error:'Login required'},401):redirectLogin(url);
  const cloudResponse=await handleCloudData(request,env,{role});
  if(cloudResponse)return cloudResponse;
  const refreshAfter=Number(request.headers.get('x-ving-refresh-after'));
  if(Number.isFinite(refreshAfter)&&refreshAfter>0&&refreshAfter<=Date.now()+60000)env={...env,DATA_REFRESH_AFTER:refreshAfter};
  // Carry selected-source freshness through aggregate report reads without
  // invalidating their unrelated dependencies.
  const sourceHeader=request.headers.get('x-ving-refresh-sources');
  if(sourceHeader&&sourceHeader.length<=6000){try{
    const input=JSON.parse(sourceHeader),boundaries={};
    for(const key of ['/api/product-costs','/api/daily-comparison','/api/profit-loss','/api/event-proposals','/api/event-predict','/api/rebrand']){
      const value=input?.[key];if(typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=Date.now()+60000)boundaries[key]=value;
    }
    env={...env,DATA_REFRESH_SOURCES:boundaries};
  }catch{}}
  if(url.pathname==='/api/data-refresh'){
    if(request.method==='GET')return json(refreshPlan());
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(request.headers.get('origin')!==url.origin)return json({error:'คำขอต้องมาจาก Warroom นี้'},403);
    const body=await request.text();if(body.length>3000)return json({error:'คำขอมีขนาดใหญ่เกินไป'},413);
    let id;try{id=JSON.parse(body).source;}catch{}
    if(typeof id!=='string'||id.length>2000)return json({error:'ไม่พบแหล่งข้อมูลนี้'},400);
    try{
      const read=async(path,options={})=>{
        const childHeaders=new Headers(request.headers);childHeaders.delete('content-length');
        const force=!['snapshot','pivot','gp','activities','promotions','approved','stock-summary','summary','notifications'].includes(id);
        const response=await handleRequest(new Request(new URL(path,url),{method:options.method||'GET',headers:childHeaders,...(options.body?{body:options.body}:{})}),{...env,FORCE_DATA_REFRESH:force});
        const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'อ่านต้นทางไม่สำเร็จ'),{status:response.status});return value;
      };
      return json(await refreshSource(id,{read}));
    }catch(error){return json({status:'failed',checkedAt:new Date().toISOString(),message:error.status?error.message:'ดึงข้อมูลแหล่งนี้ไม่สำเร็จ ข้อมูลเดิมยังคงอยู่'},error.status===401?401:200);}
  }
  if(url.pathname==='/api/events/catalog'){if(request.method!=='GET')return json({error:'Method not allowed'},405);return json(await loadOperations(env,'events')||{source:{online_status:'stale'}});}
  if(url.pathname==='/api/events/staff')return handleEventStaff(request,env,permissions);
  if(url.pathname==='/api/events/schedule'){if(request.method!=='GET')return json({error:'Method not allowed'},405);return json(await loadEventSchedule(env));}
  if(url.pathname.startsWith('/api/branch-profit'))return handleBranchProfit(request,env);
  if(url.pathname==='/api/workspace-drafts')return handleWorkspaceDrafts(request,env,identity,permissions);
  if(url.pathname==='/sales-online'||url.pathname.startsWith('/api/sales-online/'))return handleOnlineSales(request,env,identity,ctx);
  if(['/api/mobile-push','/api/mobile-push/test'].includes(url.pathname))return handleMobilePush(request,env,identity);
  // Refresh imports a read-only report; all signed-in stock viewers may use it.
  // handleInventory enforces same-origin POST and never refreshes during GET.
  if(url.pathname==='/api/stock-summary'){if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);return json(await loadStockSummary(env,inventoryInitial,()=>loadProductCosts(env,productCostFallback),{includeSales:url.searchParams.get('includeSales')==='1'}));}
  if(['/api/inventory','/api/inventory/refresh'].includes(url.pathname))return handleInventory(request,env,inventoryInitial);
  if(url.pathname==='/api/analysis/status'&&request.method==='GET')return json({aiConfigured:!!env.OPENAI_API_KEY});
  // Asking questions reads existing data. Every authenticated role may ask,
  // before the separate permission guard for mutations below.
  if(url.pathname==='/api/analysis')return handleAnalysis(request,env,{
   sales:async()=>{
    let snapshot=fallback;
    try{const stored=await env.BUCKET.get('snapshot.json');if(stored)snapshot=await stored.json();}catch{throw Error('Sales source unavailable');}
    snapshot=await applyCloudSales(ensureDailySales(snapshot),env);
    const report=applyEventSales(snapshot).data['/api/daily-sales'];
    return {...report,source:{...report.source,fetched_at:report.source?.fetched_at||snapshot.exportedAt}};
   },
   stock:async branchId=>{
    const stockURL=new URL('/api/branch-stock',url);if(branchId)stockURL.searchParams.set('branchIds',branchId);
    const result=await loadBranchStock(new Request(stockURL),env);if(!result.ok)throw Error('Stock unavailable');return result.json();
   }
  });
  if(url.pathname==='/logout'&&request.method==='POST'){if(request.headers.get('origin')!==url.origin)return json({error:'Forbidden'},403);try{await revokeMobilePush(env,request);}catch{return json({error:'ยังออกจากระบบไม่ได้ กรุณาลองใหม่'},503);}return new Response(null,{status:303,headers:{...headers,location:'/login','set-cookie':`${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`}});}
  if(url.pathname==='/api/notifications/dismiss'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return json({error:'คำขอต้องมาจากเว็บนี้'},403);
   try{return json(await dismissNotification(request,env,role,await notificationReader(request,identity.userId),identity.userId));}catch(error){return json({error:error.status?error.message:'ลบการแจ้งเตือนไม่ได้'},error.status||503);}
  }
  if(url.pathname==='/api/notifications/read'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return json({error:'คำขอต้องมาจากเว็บนี้'},403);
   try{return json(await readNotifications(request,env,role,await notificationReader(request,identity.userId),identity));}catch(error){return json({error:error.status?error.message:'บันทึกสถานะอ่านไม่ได้'},error.status||503);}
  }
  if(!['GET','HEAD'].includes(request.method)&&!permissions.canEdit)return json({error:'สิทธิ์ดูอย่างเดียว ไม่สามารถแก้ไขข้อมูลได้'},403);
  if(['/api/event-proposals/approval','/api/notifications/decision'].includes(url.pathname)&&!['GET','HEAD'].includes(request.method)&&!permissions.canApprove)return json({error:'อนุมัติงานได้เฉพาะ CEO / Trade Manager'},403);
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:'คำขอต้องมาจากเว็บนี้'},403);
  if(url.pathname==='/api/promotions/events'){if(request.method!=='GET')return json({error:'Method not allowed'},405);try{return json(await loadPromotionEvents(env));}catch{return json({error:'ยังโหลดรายการ Event ไม่ได้ กรุณาลองใหม่'},503);}}
  if(['/api/promotions/approval','/api/promotions/delete'].includes(url.pathname)){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   try{return json(await changePromotionPlan(request,env,permissions,url.pathname.endsWith('/approval')?'approve':'delete'));}
   catch(error){return json({error:error.status?error.message:'ยังบันทึกการอนุมัติหรือลบไม่ได้ กรุณาลองอีกครั้ง'},error.status||503);}
  }
  if(['/api/promotions','/api/promotions/stock'].includes(url.pathname)){
   try{
    if(!['GET','POST'].includes(request.method)||url.pathname.endsWith('/stock')&&request.method!=='GET')return json({error:'Method not allowed'},405);
    const fresh=request.method==='POST'||url.searchParams.get('refresh')==='1';
    const sourcePromise=activitySources(env,inventoryInitial,fallback,()=>loadProductCosts(env,productCostFallback));
    const forecast=async params=>{const u=new URL('/api/stock-forecast',url);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);if(fresh)u.searchParams.set('refresh','1');const response=await loadStockForecast(new Request(u),env);if(!response.ok)throw Object.assign(Error('ยังเชื่อมสต็อกสาขาไม่ได้ กรุณาลองอีกครั้ง'),{status:503});return response.json();};
    const context={event:id=>promotionEventDetail(env,id),sources:()=>sourcePromise,activities:async()=>(await readActivityWorkspace(env)).items,period:forecastPeriod(),manifest:()=>forecast({part:'manifest'}),history:period=>readPromotionHistory(env,period),branchStock:async ids=>{const u=new URL('/api/branch-stock',url);if(ids)u.searchParams.set('branchIds',ids);const response=await loadBranchStock(new Request(u),env);if(!response.ok)throw Object.assign(Error('ยังอ่านข้อมูลจากแท็บสต็อกสาขาไม่ได้ กรุณาลองใหม่'),{status:503});return response.json();}};
    // Await source loading so failures cannot escape as unhandled rejections.
    const sources=await sourcePromise;
    if(url.pathname.endsWith('/stock'))return json(await promotionStock(context,url.searchParams.get('channel')||'department',url.searchParams.get('branchId')||''));
    if(request.method==='POST')return json(await savePromotionPlan(request,env,context,permissions),201);
    return json({plans:await readPromotionPlans(env),permissions,destinations:sources.branches});
   }catch(error){return json({error:error.status?error.message:'ยังโหลดหรือบันทึกโปรโมชั่นไม่ได้ กรุณาลองอีกครั้ง',...(error.code?{code:error.code}:{})},error.status||503);}
  }
  if(url.pathname==='/api/activities'){
   try{
    if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
    const sources=await activitySources(env,inventoryInitial,fallback,()=>loadProductCosts(env,productCostFallback));
    return json(request.method==='GET'?{...await readActivityWorkspace(env),...sources,permissions}:await saveActivityWorkspace(request,env,sources,permissions));
   }catch(error){return json({error:error.status?error.message:'ยังโหลดหรือบันทึกกิจกรรมไม่ได้ กรุณาลองอีกครั้ง'},error.status||503);}
  }
  if(url.pathname==='/api/notifications'&&request.method==='GET'){
   try{return json(await listNotifications(env,role,await notificationReader(request,identity.userId),url.searchParams.get('cursor'),identity.userId));}catch{return json({error:'ยังโหลดการแจ้งเตือนไม่ได้ กรุณาลองใหม่'},503);}
  }
  if(url.pathname==='/api/notifications/decision'&&request.method==='PATCH'){
   try{return json(await decideNotification(request,env));}catch(error){return json({error:error.status?error.message:'ยังบันทึกผลอนุมัติไม่ได้'},error.status||503);}
  }
  if(url.pathname==='/api/contracts'&&['GET','PATCH'].includes(request.method)){
   try{return json(request.method==='GET'?await loadContractWorkspace(env,fallback,permissions.canEdit):await updateContractWorkspace(request,env,fallback,actor));
   }catch(error){return json({error:error.status?error.message:'ยังอ่านหรือบันทึกสัญญาไม่ได้ กรุณาลองใหม่'},error.status||503);}
  }
  if(url.pathname.startsWith('/api/event-images/')){
   try{
    const parts=url.pathname.split('/').slice(3);
    if(parts.length===1&&request.method==='POST')return json(await uploadEventImage(request,env,parts[0],identity.userId),201);
    if(parts.length===2&&['GET','HEAD'].includes(request.method))return await readEventImage(env,parts[0],parts[1],request.method,identity.userId);
    return json({error:'ไม่พบรูปภาพ'},404);
   }catch(error){return json({error:error.status?error.message:'ยังอ่านหรือบันทึกรูปไม่ได้ กรุณาลองใหม่'},error.status||503);}
  }
  if(url.pathname==='/api/event-proposals/status'&&request.method==='PATCH'){try{return json(await updateEventWorkflow(request,env));}catch(error){return json({error:error.status?error.message:'ยังบันทึกสถานะงานไม่สำเร็จ กรุณาลองใหม่'},error.status||503);}}
  if(url.pathname==='/api/event-proposals/approval'&&request.method==='PATCH'){try{return json(await approveEventProposal(request,env));}catch(error){return json({error:error.status?error.message:'ยังบันทึกสถานะไม่สำเร็จ กรุณาลองใหม่'},error.status||503);}}
  if(url.pathname==='/api/event-requests'&&request.method==='POST'){try{return json(await createEventRequest(request,env,await predictionDatabase(env),actor),201);}catch(error){return json({error:error.status?error.message:'ระบบบันทึกคำขอไม่พร้อม กรุณาลองส่งใหม่ภายหลัง',code:error.code},error.status||503);}}
  if(url.pathname==='/api/event-requests'&&request.method==='PATCH'){try{return json(await updateEventRequest(request,env,await predictionDatabase(env),actor));}catch(error){return json({error:error.status?error.message:'ยังบันทึกการแก้ไขไม่ได้ กรุณาลองใหม่',code:error.code},error.status||503);}}
  if(url.pathname.startsWith('/api/event-proposals/')&&request.method==='DELETE'){try{return json(await deleteEventProposal(request,env,decodeURIComponent(url.pathname.slice('/api/event-proposals/'.length)),actor));}catch(error){return json({error:error.status?error.message:'ยังลบ Event ไม่สำเร็จ กรุณาลองใหม่'},error.status||503);}}
  if(url.pathname==='/api/summary/events/delete'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    try{return json(await deleteSummaryEvent(request,env,async()=>{
      const stored=await env.BUCKET.get('snapshot.json');
      const snapshot=applyEventSales(await applyOperations(ensureDailySales(stored?await stored.json():fallback),env));
      const proposals=await summaryApprovedProposals(env);
      return {events:snapshot.data['/api/events'],approvedProposals:proposals.items};
    }));}catch(error){return json({error:error.status?error.message:'ยังลบ Event ไม่สำเร็จ กรุณาลองใหม่'},error.status||503);}
  }
  if(!['GET','HEAD'].includes(request.method))return json({error:'Read only'},405);
  if(url.pathname==='/api/daily-comparison')return json(await loadComparison(env,ctx));
  if(url.pathname==='/api/stock-report')return loadStockReport(request,env);
  if(url.pathname==='/api/stock-forecast')return loadStockForecast(request,env);
  if(url.pathname==='/api/warehouse')return loadWarehouse(request,env);
  if(url.pathname==='/api/branch-stock')return loadBranchStock(request,env);
  if(url.pathname==='/api/session')return json({role,label:identity.position,team:identity.team,userId:identity.userId,userName:identity.userName,...permissions});
  if(url.pathname==='/api/events/approved'){
    try{
    const proposals=await predictWithin(()=>summaryApprovedProposals(env,{refreshSheet:true}),9000);
    // Expose scheduling fields only; proposal financials stay in their existing views.
    return json({items:proposals.items.map(eventSchedulingFields),cancelled:proposals.cancelled||[],failures:proposals.failures,unavailable:!!proposals.unavailable,checkedAt:new Date().toISOString()});
    }catch{return json({error:'ยังอัปเดตสถานะ Event ไม่ได้ กรุณาลองใหม่'},503);}
  }
  if(url.pathname==='/api/event-predict')return json(await predictionDatabase(env));
  if(url.pathname==='/api/event-proposals/detail'){try{return json({...await eventProposalDetail(env,url.searchParams.get('key')),permissions});}catch(error){return json({error:error.status?error.message:'ยังโหลดข้อมูล Event ไม่สำเร็จ กรุณาลองใหม่'},error.status||503);}}
  if(url.pathname==='/api/product-costs'){if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);return json(await loadProductCosts(env,productCostFallback));}
  if(url.pathname==='/api/rebrand')return json(await loadRebrand(env));
  if(url.pathname==='/api/event-proposals'){try{return json(await predictWithin(async()=>{const [sheet,web]=await Promise.all([loadEventProposals(env),listEventRequests(env)]);if(web.status!=='online')throw Error('ข้อมูลคำขอยังไม่พร้อม');return {...sheet,items:await visibleProposals(env,[...web.items,...sheet.items]),permissions,web:{status:web.status,truncated:web.truncated||false}};},9000));}catch{return json({error:'ยังอัปเดตรายการ Event ไม่ได้ กรุณาลองใหม่'},503);}}
  if(url.pathname==='/api/summary'){
    if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
    try{return await predictWithin(async()=>{
    let deletedSummaryEvents;
    try{deletedSummaryEvents=await readSummaryEventDeletions(env);}catch{return json({error:'ยังอ่านรายการ Event ที่ลบไม่ได้ กรุณาลองใหม่'},503);}
    // Use the same live sales source and cache as Daily report.
    const comparisonPromise=loadComparison(env,ctx);
    let snapshot=fallback;
    try{const stored=await env.BUCKET.get('snapshot.json');if(stored)snapshot=await stored.json();}catch{}
    snapshot=ensureDailySales(snapshot);
    try{snapshot=await applyCloudSales(snapshot,env,ctx);}catch{}
    snapshot=applyEventSales(await applyOperations(snapshot,env,fetch,ctx));
    let pnl=profitLossFallback;
    try{const stored=await env.BUCKET.get('profit-loss.json');if(stored){const value=await stored.json();if(value.version===1&&Array.isArray(value.records))pnl=value;}}catch{}
    const [proposals,comparison]=await Promise.all([summaryApprovedProposals(env),comparisonPromise]);
    const operationsStatus=snapshot.operationsSource?.online_status;
    const failures=[...proposals.failures,...(operationsStatus==='stale'?['Event · ยังตรวจข้อมูลใหม่ไม่ได้ แสดงข้อมูลที่บันทึกไว้']:operationsStatus==='refreshing'?['Event · แสดงข้อมูลที่บันทึกไว้ระหว่างตรวจข้อมูลใหม่']:[])];
    return json({permissions,deletedSummaryEvents,report:snapshot.data['/api/daily-sales'],comparison,events:snapshot.data['/api/events'],approvedProposals:proposals.items,cancelledProposals:proposals.cancelled||[],pnl,failures});
    },9000);}catch{return json({error:'ยังโหลดข้อมูลสรุปไม่สำเร็จ กรุณาลองใหม่'},503);}
  }
  if(url.pathname==='/api/profit-loss'){try{const [pnl,proposals]=await Promise.all([loadProfitLoss(env,profitLossFallback),summaryApprovedProposals(env)]);return json({...pnl,cancelledProposals:proposals.cancelled||[]});}catch{return json({error:'อ่านข้อมูลต้นทุนไม่สำเร็จ'},503);}}
  if(url.pathname==='/api/snapshot'||url.pathname==='/snapshot.json'){
    try{return await predictWithin(async()=>{const object=await env.BUCKET.get('snapshot.json');const snapshot=await applyOperations(ensureDailySales(object?await object.json():fallback),env,fetch,ctx);return json({...await mergeCloudSnapshot(applyEventSales(await applyCloudSales(snapshot,env,ctx)),env,{role}),syncConfigured:true});},9000);}catch{return json({error:'ยังอ่านข้อมูลคลาวด์ไม่ได้ กรุณาลองอีกครั้ง'},503);}
  }
  if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
  if(url.pathname==='/'||url.pathname==='/index.html')return new Response(null,{status:302,headers:{...headers,location:'/daily-sales'+url.search}});
  let key=url.pathname;
  if(!assets[key]&&assets[key+'.html'])key+='.html';
  const asset=assets[key];if(!asset)return new Response('Not found',{status:404,headers});
  let body=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
  const pageNonce=crypto.randomUUID();
  if(asset.type.startsWith('text/html')){
   let html=new TextDecoder().decode(body).replace('<body','<body data-access-role="'+role+'" data-access-user-name="'+escapeAttr(identity.userName)+'" data-access-position="'+escapeAttr(identity.position)+'" data-access-team="'+escapeAttr(identity.team||'')+'"');
   const monogram=identity.userId==='business-development-1'?'BD':access.monogram;
   const accessBar=`<div class="access-bar"><span class="access-brand ving-wordmark ving-wordmark-light" role="img" aria-label="VING"></span><div class="access-identity">${monogram?`<span class="access-monogram" aria-hidden="true">${escapeAttr(monogram)}</span>`:''}<div class="access-details"><span class="access-title">${escapeAttr(identity.userName)}</span><span class="access-caption">${role==='assistant'?escapeAttr([identity.position,identity.team].filter(Boolean).join(' · '))+' · ':''}${access.caption}</span></div></div><a class="access-manage" href="/login?next=${encodeURIComponent(url.pathname)}">เปลี่ยนสิทธิ์</a></div>`;
   html=html.replace('<nav class="notebook-tabs" aria-label="ห้องทำงานหลัก">','<nav class="notebook-tabs" aria-label="ห้องทำงานหลัก"><a href="/analysis" data-nav="analysis">วิเคราะห์ และ ถาม-ตอบ</a>');
   html=html.replace('</head>','<link rel="stylesheet" href="/assets/iphone-push-gate.css"><script>if(/iPhone/.test(navigator.userAgent)&&(navigator.standalone===true||matchMedia("(display-mode: standalone)").matches))document.documentElement.setAttribute("data-iphone-push-gated","");</script><link rel="stylesheet" href="/assets/navigation-premium.css"><link rel="stylesheet" href="/assets/ving-brand.css"><link rel="icon" href="/assets/push-icon-192.png" type="image/png"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/push-icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="VING Warroom"><meta name="theme-color" content="#1c1c1c"></head>');
   const salesConnect=role==='admin'&&['/daily-sales','/daily-sales.html'].includes(url.pathname)?'<div style="text-align:right;padding:8px 24px"><a href="/sales-online" style="color:#fde412">เชื่อม Excel ออนไลน์</a></div>':'';
   html=html.replace('</header>','</header>'+accessBar+salesConnect);
   html=html.replace(/<script(?=[\s>])/g,'<script nonce="'+pageNonce+'"');body=encoder.encode(html);
  }
  return new Response(request.method==='HEAD'?null:body,{headers:{...headers,'content-type':asset.type,...(asset.type.startsWith('text/html')?{'content-security-policy':`script-src 'self' 'nonce-${pageNonce}'; object-src 'none'; base-uri 'self'`}:{}),...(asset.type.startsWith('text/html')&&!/(?:^|;\s*)ving_reader=[a-f0-9-]{36}(?:;|$)/i.test(request.headers.get('cookie')||'')?{'set-cookie':`ving_reader=${crypto.randomUUID()}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Strict`}:{})}});

}
export default {async fetch(request,env,ctx){
 const response=await handleRequest(request,env,ctx);
 const url=new URL(request.url);
 if(ctx?.waitUntil&&response.ok&&mobilePushReady(env)&&(url.pathname==='/api/notifications'||(!['GET','HEAD'].includes(request.method)&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/mobile-push')&&!url.pathname.startsWith('/api/cloud-workspace')&&!isLegacyCloudPath(url.pathname)&&!['/api/workspace-drafts','/api/data-refresh'].includes(url.pathname)))){
  ctx.waitUntil((async()=>{
   const deadline=Date.now()+24000;
   for(let attempt=0;attempt<3&&Date.now()<deadline-6500;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,attempt*1200));
    try{await dispatchMobilePush(env,fetch,{deadline});}catch{console.warn('Mobile notification delivery deferred');}
   }
  })());
 }
 return response;
}};
