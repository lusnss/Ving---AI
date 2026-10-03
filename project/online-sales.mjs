import {parseOnlineSales} from './online-sales-parser.mjs';
import {sanitizeDailySales} from './sanitize.mjs';

const SALES_ORIGIN='https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site';
const SALES_CALLBACK='/api/sales-online/callback';
const SALES_SCOPE='offline_access https://graph.microsoft.com/Files.ReadWrite';
const SALES_SOURCE='https://vingrun-my.sharepoint.com/:x:/r/personal/anchalee_ving_run/_layouts/15/doc2.aspx?sourcedoc=%7B4683C9CE-44C2-4D99-93C7-575CFFEFC84B%7D&file=Sales%20Report%202026%20PC%20VING.xlsx&action=default';
const SALES_CONNECTION='sales-online/connection.json',SALES_CACHE='sales-online/report.json',SALES_LOCK='sales-online/lease.json';
const salesEncoder=new TextEncoder();
const salesB64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const salesUnb64=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const salesRandom=()=>salesB64(crypto.getRandomValues(new Uint8Array(32)));
const salesJSON=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const salesConfigured=env=>/^[a-zA-Z0-9.-]+$/.test(env.MS_SALES_TENANT_ID||'') && /^[a-f0-9-]{36}$/i.test(env.MS_SALES_CLIENT_ID||'') && !!env.MS_SALES_CLIENT_SECRET && !!env.SESSION_SECRET;
async function salesKey(env) {
  const material=await crypto.subtle.importKey('raw',salesEncoder.encode(env.SESSION_SECRET),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:salesEncoder.encode('ving-sales-online-v1'),info:salesEncoder.encode(SALES_ORIGIN)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function salesSeal(env,value) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  return {iv:salesB64(iv),ciphertext:salesB64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await salesKey(env),salesEncoder.encode(JSON.stringify(value)))))};
}
async function salesUnseal(env,value) {
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:salesUnb64(value.iv)},await salesKey(env),salesUnb64(value.ciphertext))));
}
async function salesRead(env,key) {const object=await env.BUCKET.get(key);return object?{object,value:await object.json()}:null;}
const salesPut=(env,key,value,onlyIf)=>env.BUCKET.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'},...(onlyIf?{onlyIf}:{})});
async function salesToken(env,params,fetchImpl=fetch) {
  const response=await fetchImpl(`https://login.microsoftonline.com/${env.MS_SALES_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',redirect:'error',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MS_SALES_CLIENT_ID,client_secret:env.MS_SALES_CLIENT_SECRET,scope:SALES_SCOPE,...params}),signal:AbortSignal.timeout(12000)});
  const value=await response.json();
  if (!response.ok || !value.access_token) throw Error(value.error==='invalid_grant'?'reconnect_required':'connection_failed');
  return {access:value.access_token,refresh:value.refresh_token,expires:Date.now()+Number(value.expires_in||3600)*1000};
}
async function salesGraph(path,token,fetchImpl=fetch,signal=AbortSignal.timeout(24000)) {
  // Only fixed Graph GET routes: no workbook writes and no file downloads.
  const response=await fetchImpl('https://graph.microsoft.com/v1.0'+path,{headers:{authorization:'Bearer '+token},method:'GET',redirect:'error',signal});
  if (!response.ok) throw Error(response.status===401?'reconnect_required':response.status===403?'access_required':response.status===429?'throttled':'source_unavailable');
  const text=await response.text();if(text.length>6_000_000)throw Error('source_too_large');
  return JSON.parse(text);
}

export function createOnlineSales({fetchImpl=fetch,now=Date.now}={}) {
  let pending;
  async function refresh(env) {
    if (pending) return pending;
    pending=(async()=>{
      const connection=await salesRead(env,SALES_CONNECTION);if(!connection)return;
      const oldLease=await salesRead(env,SALES_LOCK);
      if (oldLease?.value.until>now())return;
      const lease=await salesPut(env,SALES_LOCK,{until:now()+90000},oldLease?{etagMatches:oldLease.object.etag}:{etagDoesNotMatch:'*'});
      if (!lease)return;
      let cache=await salesRead(env,SALES_CACHE),previous=cache?.value;
      try {
        // A different isolate may have refreshed while this request waited.
        if (!env.FORCE_DATA_REFRESH&&previous?.connectionId===connection.value.id && previous.checkedAt && now()-Date.parse(previous.checkedAt)<60000)return;
        let token=await salesUnseal(env,connection.value.sealed);
        if (token.expires<now()+60000) {
          const next=await salesToken(env,{grant_type:'refresh_token',refresh_token:token.refresh},fetchImpl);
          token={...next,refresh:next.refresh||token.refresh};
          const saved=await salesPut(env,SALES_CONNECTION,{...connection.value,sealed:await salesSeal(env,token)},{etagMatches:connection.object.etag});
          if(!saved)return;
        }
        const signal=AbortSignal.timeout(24000),get=path=>salesGraph(path,token.access,fetchImpl,signal);
        const item=await get('/shares/u!'+salesB64(salesEncoder.encode(SALES_SOURCE))+'/driveItem?$select=id,name,parentReference,sharepointIds');
        const guid=item.sharepointIds?.listItemUniqueId?.replace(/[{}]/g,'').toLowerCase();
        if (item.name!=='Sales Report 2026 PC VING.xlsx'||!item.id||!item.parentReference?.driveId || guid && guid!=='4683c9ce-44c2-4d99-93c7-575cffefc84b')throw Error('wrong_workbook');
        const base='/drives/'+encodeURIComponent(item.parentReference.driveId)+'/items/'+encodeURIComponent(item.id)+'/workbook/worksheets';
        const listing=await get(base+'?$select=id,name');
        const sheets=listing.value?.filter(s=>String(s.name).replace(/\s/g,'').includes('ยอดขาย'));
        if (!sheets?.length||sheets.length>24||listing['@odata.nextLink'])throw Error('invalid_layout');
        const ranges=[];
        for(let i=0;i<sheets.length;i+=4)ranges.push(...await Promise.all(sheets.slice(i,i+4).map(async sheet=>({name:sheet.name,...await get(base+'/'+encodeURIComponent(sheet.id)+'/usedRange(valuesOnly=true)?$select=values')}))));
        const report=parseOnlineSales(ranges,new Date(now()).toISOString());
        // A missing previously imported month can indicate a partial read or
        // renamed worksheet. Keep the complete last good report in that case.
        if(Object.keys(previous?.report?.periods||{}).some(key=>!report.periods[key]))throw Error('incomplete_report');
        if((await salesRead(env,SALES_CONNECTION))?.value.id!==connection.value.id)return;
        await salesPut(env,SALES_CACHE,{connectionId:connection.value.id,status:'online',checkedAt:new Date(now()).toISOString(),report},cache?{etagMatches:cache.object.etag}:{etagDoesNotMatch:'*'});
      } catch(error) {
        if((await salesRead(env,SALES_CONNECTION))?.value.id!==connection.value.id)return;
        const status=['reconnect_required','access_required','throttled'].includes(error.message)?error.message:'stale';
        await salesPut(env,SALES_CACHE,{...previous,connectionId:connection.value.id,status,checkedAt:new Date(now()).toISOString()},cache?{etagMatches:cache.object.etag}:{etagDoesNotMatch:'*'});
      } finally {await salesPut(env,SALES_LOCK,{until:0},{etagMatches:lease.etag});}
    })().finally(()=>{pending=null;});
    return pending;
  }
  async function apply(snapshot,env,ctx) {
    if(!salesConfigured(env))return {...snapshot,salesOnline:{status:'setup_required',intervalSeconds:60}};
    try {
      if(env.FORCE_DATA_REFRESH)await refresh(env);
      const [connection,cached]=await Promise.all([salesRead(env,SALES_CONNECTION),salesRead(env,SALES_CACHE)]);
      if(!connection)return {...snapshot,salesOnline:{status:'not_connected',intervalSeconds:60}};
      const cache=cached?.value,matching=cache?.connectionId===connection.value.id;
      if(ctx?.waitUntil && (!matching||!cache?.checkedAt||now()-Date.parse(cache.checkedAt)>=60000))ctx.waitUntil(refresh(env).catch(()=>{}));
      const report=cache?.report?sanitizeDailySales(cache.report):null;
      const status=!matching?'waiting':cache.status==='online'&&now()-Date.parse(cache.checkedAt)>120000?'stale':cache.status;
      const salesOnline={status:status||'waiting',intervalSeconds:60,checkedAt:cache?.checkedAt||null,fetchedAt:report?.source.fetched_at||null};
      if(!report)return {...snapshot,salesOnline};
      const local=snapshot.data['/api/daily-sales'];
      return {...snapshot,salesOnline,data:{...snapshot.data,'/api/daily-sales':{...local,source:report.source,periods:{...local.periods,...report.periods}}},salesSync:{mode:'online',periodKeys:Object.keys(report.periods),fetchedAt:report.source.fetched_at,asOfDate:report.source.as_of_date}};
    }catch{return {...snapshot,salesOnline:{status:'stale',intervalSeconds:60}};}
  }
  return {refresh,apply};
}
const salesOnlineLoader=createOnlineSales();
export const applyOnlineSales=salesOnlineLoader.apply;

const salesMessages={setup_required:'ยังต้องตั้งค่าการเชื่อมต่อ Microsoft ครั้งแรก',not_connected:'ยังไม่ได้อนุญาตให้เว็บอ่าน Excel',waiting:'กำลังอ่านยอดขายครั้งแรก',online:'เชื่อมต่อแล้ว · ตรวจยอดอัตโนมัติทุก 1 นาทีขณะเปิดเว็บ',reconnect_required:'การเชื่อมต่อหมดอายุ กรุณาเชื่อม Microsoft อีกครั้ง',access_required:'บัญชีที่เชื่อมต่อไม่มีสิทธิ์อ่านไฟล์รายงาน',throttled:'Microsoft ขอให้รอสักครู่ · แสดงยอดที่อ่านสำเร็จล่าสุด',stale:'อ่านต้นทางไม่สำเร็จ · แสดงยอดที่อ่านสำเร็จล่าสุด'};
const salesPage=(status,configured,extra='')=>new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เชื่อม Excel ออนไลน์ · VING</title><style>body{margin:0;background:#080808;color:#ffffff;font:16px/1.7 system-ui,sans-serif}main{max-width:680px;margin:8vh auto;padding:28px}h1{font-size:32px;line-height:1.3}a{color:#fde412}section{border:1px solid #242414;border-radius:16px;padding:24px;margin:24px 0}button{font:inherit;font-weight:700;background:#fde412;color:#161616;border:0;border-radius:10px;padding:12px 20px;cursor:pointer}.status{font-weight:700;color:#fde412}</style><link rel="stylesheet" href="/assets/ving-brand.css"><link rel="icon" href="/assets/push-icon-192.png" type="image/png"><main><a href="/daily-sales">← กลับ Sales Report</a><h1>เชื่อม Excel ออนไลน์</h1><p>แก้ยอดใน Excel แล้วเว็บอ่านตัวเลขล่าสุดให้เอง โดยไม่ต้องเปิด Mac หรืออัปโหลดรายงานซ้ำ</p><section><p class="status">${salesMessages[status]||salesMessages.stale}</p>${extra}${configured?'<form method="post" action="/api/sales-online/connect"><button>เชื่อมต่อ Microsoft</button></form><p>ใช้บัญชีที่เปิด Sales Report 2026 PC VING.xlsx ได้ Microsoft กำหนดสิทธิ์ชื่อ Files.ReadWrite สำหรับ API นี้ เว็บใช้เฉพาะการอ่านยอดขาย</p>':'<p>ผู้ดูแล Microsoft 365 ต้องลงทะเบียนการเชื่อมต่อของเว็บก่อน จากนั้นจะเข้าสู่ระบบ Microsoft เพื่ออนุญาตได้ที่หน้านี้</p>'}</section><p>เว็บเก็บเฉพาะสาขา ช่องทาง เป้าหมาย และยอดขาย หากอ่านไม่ได้จะคงยอดที่อ่านสำเร็จล่าสุด พร้อมแจ้งสถานะ การอนุญาตอาจต้องทำใหม่หากองค์กรถอนสิทธิ์หรือเปลี่ยนนโยบาย</p></main></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'"}});

export async function handleOnlineSales(request,env,identity,ctx) {
  const url=new URL(request.url),configured=salesConfigured(env);
  if(url.pathname===SALES_CALLBACK) {
    if(request.method!=='GET'||url.origin!==SALES_ORIGIN)return salesJSON({error:'Forbidden'},403);
    const state=url.searchParams.get('state'),cookie=(request.headers.get('cookie')||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('__Host-ving-sales-oauth='))?.split('=')[1];
    if(!configured||!state||!/^[\w-]{43}$/.test(state)||cookie!==state)return salesJSON({error:'กรุณาเริ่มเชื่อมต่อใหม่จาก Sales Report'},400);
    const stored=await salesRead(env,'sales-online/oauth/'+state);
    if(!stored||!Number.isFinite(stored.value.expires)||stored.value.expires<Date.now()||stored.value.used)return salesJSON({error:'การเชื่อมต่อหมดเวลา กรุณาเริ่มใหม่'},400);
    const claimed=await salesPut(env,'sales-online/oauth/'+state,{used:true,expires:0},{etagMatches:stored.object.etag});
    if(!claimed)return salesJSON({error:'กรุณาเริ่มเชื่อมต่อใหม่'},400);
    let status='not_connected';
    try {
      if(url.searchParams.has('error'))throw Error('denied');
      const code=url.searchParams.get('code');if(!code||code.length>10000)throw Error('invalid_code');
      const {verifier}=await salesUnseal(env,stored.value.sealed);
      const token=await salesToken(env,{grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:SALES_ORIGIN+SALES_CALLBACK});
      if(!token.refresh)throw Error('missing_refresh');
      await salesPut(env,SALES_CONNECTION,{id:salesRandom(),sealed:await salesSeal(env,token)});
      status='waiting';ctx?.waitUntil?.(salesOnlineLoader.refresh(env).catch(()=>{}));
    }catch{status='reconnect_required';}
    const response=salesPage(status,true,'<p>เปิด Sales Report เพื่อดูสถานะและยอดล่าสุด</p>');
    response.headers.set('set-cookie','__Host-ving-sales-oauth=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');
    return response;
  }
  if(identity?.role!=='admin')return salesJSON({error:'เฉพาะผู้ดูแลเท่านั้นที่เชื่อมบัญชีต้นทางได้'},403);
  if(url.pathname==='/sales-online' && request.method==='GET') {
    const state=await salesOnlineLoader.apply({data:{'/api/daily-sales':{periods:{}}}},env,ctx);
    return salesPage(state.salesOnline.status,configured);
  }
  if(url.pathname==='/api/sales-online/connect' && request.method==='POST') {
    if(url.origin!==SALES_ORIGIN||request.headers.get('origin')!==url.origin)return salesJSON({error:'Forbidden'},403);
    if(!configured)return salesPage('setup_required',false);
    const state=salesRandom(),verifier=salesRandom(),challenge=salesB64(new Uint8Array(await crypto.subtle.digest('SHA-256',salesEncoder.encode(verifier))));
    await salesPut(env,'sales-online/oauth/'+state,{expires:Date.now()+600000,sealed:await salesSeal(env,{verifier})});
    const location=new URL(`https://login.microsoftonline.com/${env.MS_SALES_TENANT_ID}/oauth2/v2.0/authorize`);
    location.search=new URLSearchParams({client_id:env.MS_SALES_CLIENT_ID,response_type:'code',redirect_uri:SALES_ORIGIN+SALES_CALLBACK,response_mode:'query',scope:SALES_SCOPE,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
    return new Response(null,{status:303,headers:{location:location.href,'cache-control':'no-store','referrer-policy':'no-referrer','set-cookie':`__Host-ving-sales-oauth=${state}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`}});
  }
  return salesJSON({error:'Not found'},404);
}
