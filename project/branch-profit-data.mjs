import {gpExpandMonth} from './out/assets/branch-profit-model.mjs';
const gpResponse=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const gpError=(message,status=502)=>Object.assign(Error(message),{status});
const gpFields=['product_qty:sum','price_sub_total:sum','total_discount:sum','price_total:sum','order_id:count_distinct'];
const gpMeasures=['product_qty','price_sub_total','total_discount','price_total','order_id','__count'];
export function gpCleanBranch(label,id=0){let s=String(label||'ไม่ระบุสาขา');while(/\s*\([^()]*\)\s*$/.test(s)){const last=s.match(/\s*\(([^()]*)\)\s*$/)[1];if(/\d[/\-]\d/.test(last))break;s=s.replace(/\s*\([^()]*\)\s*$/,'');}s=s.trim();return /คุณ|(?:^|\s)(?:นาย|นางสาว|นาง|Mr\.?|Ms\.?)\s|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{9,13}\b/i.test(s)?'จุดขาย ERP #'+id:s;}
export async function gpFetchMonth(env,period,fetcher=fetch){
 if(!env.ODOO_LOGIN||!env.ODOO_PASSWORD||!env.ODOO_DATABASE)throw gpError('การเชื่อมต่อ Odoo ยังไม่พร้อม',503);
 let cookie='';const signal=AbortSignal.timeout(75000);
 const rpc=async(path,params)=>{let response;try{response=await fetcher('https://erp.ving.run'+path,{method:'POST',redirect:'manual',signal,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify({jsonrpc:'2.0',method:'call',params,id:1})});}catch{throw gpError('Odoo ใช้เวลาตอบนานหรือเชื่อมต่อไม่ได้ กรุณาลองใหม่');}if(!response.ok)throw gpError('Odoo ยังไม่พร้อมให้ข้อมูล ('+response.status+')');const cookies=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():typeof response.headers.getAll==='function'?response.headers.getAll('Set-Cookie'):[response.headers.get('set-cookie')||''];for(const value of cookies){const match=value.match(/(?:^|,\s*)session_id=([^;]+)/);if(match)cookie='session_id='+match[1];}const b=await response.json().catch(()=>null);if(!b||b.error)throw gpError('Odoo ปฏิเสธคำขอ กรุณาตรวจสิทธิ์บัญชีเชื่อมต่อ',503);return b.result;};
 const session=await rpc('/web/session/authenticate',{db:env.ODOO_DATABASE,login:env.ODOO_LOGIN,password:env.ODOO_PASSWORD});if(!session?.uid||!cookie)throw gpError('เข้าสู่ระบบ Odoo ไม่สำเร็จ กรุณาตรวจบัญชีเชื่อมต่อ',503);
 const [year,month]=period.split('-').map(Number),fmt=d=>d.toISOString().slice(0,19).replace('T',' '),startUtc=fmt(new Date(Date.UTC(year,month-1,1,-7))),endUtcExclusive=fmt(new Date(Date.UTC(year,month,1,-7))),domain=[['date','>=',startUtc],['date','<',endUtcExclusive]];
 const read=kwargs=>rpc('/web/dataset/call_kw/report.pos.order/read_group',{model:'report.pos.order',method:'read_group',args:[],kwargs:{context:{lang:'th_TH',tz:'Asia/Bangkok',allowed_company_ids:[1]},domain,fields:gpFields,lazy:false,...kwargs}});
 const valid=(rs)=>{if(!Array.isArray(rs))throw gpError('รูปแบบรายงาน Odoo ไม่ถูกต้อง');for(const r of rs)for(const k of gpMeasures)if(typeof r[k]!=='number'||!Number.isFinite(r[k])||(['order_id','__count'].includes(k)&&(!Number.isInteger(r[k])||r[k]<0)))throw gpError('ข้อมูลตัวเลขจาก Odoo ไม่ครบถ้วน');return rs;};
 const before=valid(await read({groupby:[]}));let raw=[];const seen=new Set();
 for(let offset=0;offset<50000;offset+=2000){const page=await read({groupby:['config_id','product_id','date:day'],limit:2000,offset,orderby:'config_id, product_id, date:day'});valid(page);for(const r of page){const id=JSON.stringify([r.config_id?.[0],r.product_id?.[0],r.__range?.date?.from]);if(seen.has(id))throw gpError('Odoo มีข้อมูลซ้ำระหว่างแบ่งหน้า กรุณาอัปเดตอีกครั้ง');seen.add(id);}raw.push(...page);if(page.length<2000)break;if(offset===48000)throw gpError('จำนวนรายการเกินขนาดที่รองรับในเดือนเดียว');}
 const branchRaw=await read({groupby:['config_id'],limit:false}),dailyRaw=await read({groupby:['config_id','date:day'],limit:false,orderby:'config_id, date:day'}),after=await read({groupby:[]});valid(branchRaw);valid(dailyRaw);valid(after);const total=Object.fromEntries(gpMeasures.map(k=>[k,after?.[0]?.[k]||0]));
 for(const k of gpMeasures){if(Math.abs((before?.[0]?.[k]||0)-total[k])>.03)throw gpError('ยอด Odoo เปลี่ยนระหว่างดึงข้อมูล กรุณากดอัปเดตอีกครั้ง');}
 for(const k of gpMeasures.filter(k=>k!=='order_id')){if(Math.abs(raw.reduce((s,r)=>s+(Number(r[k])||0),0)-total[k])>.03)throw gpError('ตรวจยอดรวม Odoo ไม่ผ่าน ข้อมูลเดิมยังคงอยู่');}
 const products={},branches={},values=r=>gpMeasures.map(k=>Number(r[k])||0),date=r=>{const d=new Date(String(r.__range?.date?.from||'').replace(' ','T')+'Z');if(!Number.isFinite(+d))throw gpError('วันที่รายงาน Odoo ไม่ถูกต้อง');return new Date(+d+7*3600000).toISOString().slice(0,10);},branch=r=>{const b=r.config_id||[0,'ไม่ระบุสาขา'];branches[b[0]]={id:b[0],erp:gpCleanBranch(b[1],b[0])};return b[0];};
 const rows=raw.map(r=>{const p=r.product_id||[0,'ไม่ระบุสินค้า'],match=String(p[1]).match(/^\[([^\]]+)\]\s*(.*)$/);products[p[0]]={id:p[0],sku:match?.[1]||'',product:match?.[2]||String(p[1])};const day=date(r);if(!day.startsWith(period))throw gpError('วันที่รายงานอยู่นอกช่วงที่เลือก');return [day,branch(r),p[0],...values(r)];});
 const branchTotals=branchRaw.map(r=>[branch(r),...values(r)]),dailyBranchTotals=dailyRaw.map(r=>[date(r),branch(r),...values(r)]);
 for(const [index,k] of gpMeasures.entries()){if(Math.abs(branchTotals.reduce((s,r)=>s+r[index+1],0)-total[k])>.03||Math.abs(dailyBranchTotals.reduce((s,r)=>s+r[index+2],0)-total[k])>.03)throw gpError('ยอดสรุปสาขาไม่ตรงกับข้อมูลรายวัน');}
 const updatedAt=new Date().toISOString(),today=new Date(Date.now()+7*3600000).toISOString().slice(0,10),last=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
 return {month:period,updatedAt,asOf:today<last?today:last,startUtc,endUtcExclusive,totals:total,products,branches,rows,branchTotals,dailyBranchTotals};
}
export async function handleBranchProfit(request,env,seed,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/branch-profit'){
  if(!['GET','HEAD'].includes(request.method))return gpResponse({error:'Method not allowed'},405);
  let stage='read-snapshots';
  try{
   const saved=await env.DB.prepare('SELECT period,payload,updated_at,last_error FROM branch_profit_snapshots WHERE payload IS NOT NULL').all(),rawMonths={...seed.rawMonths};
   stage='decode-snapshots';
   for(const item of saved.results||[])rawMonths[item.period]=JSON.parse(item.payload);
   stage='assemble-report';
   let costs=null,previous=null,previousObject=null;try{const saved=await env.BUCKET?.get('product-costs-v1.json');if(saved)costs=await saved.json();previousObject=await env.BUCKET?.get('branch-profit-costs-v1.json');if(previousObject)previous=await previousObject.json();}catch{}
   const base=Object.fromEntries(Object.entries(seed.productMap).map(([id,item])=>{
    const old=previous?.productMap?.[id];return [id,old&&old.key===item.key&&old.sourceRow===item.sourceRow&&old.costModel===item.costModel&&old.costGrade===item.costGrade&&old.factory===item.factory&&item.status==='actual'?{...item,unitCost:old.unitCost}:item];
   }));
   const refreshed=previous&&Date.parse(previous.updatedAt)>Date.parse(costs?.source?.fetched_at)?{...previous,productMap:base}:gpCurrentCosts(base,costs);
   if(refreshed.updatedAt&&(!previous||Date.parse(refreshed.updatedAt)>Date.parse(previous.updatedAt))){
    try{const saved=await env.BUCKET?.put('branch-profit-costs-v1.json',JSON.stringify(refreshed),{httpMetadata:{contentType:'application/json'},onlyIf:previousObject?.etag?{etagMatches:previousObject.etag}:{etagDoesNotMatch:'*'}});if(!saved)refreshed.status='partial';}catch{refreshed.status='partial';}
   }
   return gpResponse({rawMonths:Object.values(rawMonths).sort((a,b)=>a.month.localeCompare(b.month)),productMap:refreshed.productMap,branches:seed.branches,policy:{...seed.policy,reviewGpRate:.22,...(refreshed.updatedAt?{costUpdatedAt:refreshed.updatedAt}:{}),costRefresh:refreshed.status,retainedCosts:refreshed.retained},configured:!!env.ODOO_PASSWORD});
  }catch{
   console.error('branch-profit-read-failed',stage);
   return gpResponse({error:'ยังอ่านข้อมูลกำไรที่บันทึกไว้ไม่ได้ กรุณาลองใหม่'},503);
  }
 }
 if(path!=='/api/branch-profit/refresh')return gpResponse({error:'Not found'},404);
 if(request.method!=='POST')return gpResponse({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==url.origin)return gpResponse({error:'คำขอต้องมาจาก Warroom นี้'},403);
 if(Number(request.headers.get('content-length'))>2000)return gpResponse({error:'คำขอมีขนาดใหญ่เกินไป'},413);
 const text=await request.text();if(new TextEncoder().encode(text).length>2000)return gpResponse({error:'คำขอมีขนาดใหญ่เกินไป'},413);let input;try{input=JSON.parse(text);}catch{}const period=input?.period,today=new Date(Date.now()+7*3600000).toISOString().slice(0,7);
 if(typeof period!=='string'||!/^20\d\d-(0[1-9]|1[0-2])$/.test(period)||period<'2020-01'||period>today)return gpResponse({error:'เลือกเดือนที่เกิดขึ้นแล้วระหว่างปี 2020 ถึงปัจจุบัน'},400);
 let acquired=false;const token=crypto.randomUUID(),now=Date.now();
 try{const lock=await env.DB.prepare('INSERT INTO branch_profit_snapshots (period,lock_token,lock_until) VALUES (?,?,?) ON CONFLICT(period) DO UPDATE SET lock_token=excluded.lock_token,lock_until=excluded.lock_until WHERE branch_profit_snapshots.lock_until < ? RETURNING period').bind(period,token,now+100000,now).first();if(!lock)return gpResponse({error:'เดือนนี้กำลังอัปเดตโดยผู้ใช้อื่น กรุณารอสักครู่'},409);acquired=true;const month=await gpFetchMonth(env,period,fetcher);const saved=await env.DB.prepare('UPDATE branch_profit_snapshots SET payload=?,updated_at=?,last_error=NULL,lock_token=NULL,lock_until=0 WHERE period=? AND lock_token=? RETURNING period').bind(JSON.stringify(month),month.updatedAt,period,token).first();if(!saved)throw gpError('การอัปเดตหมดเวลา ข้อมูลเดิมยังคงอยู่',409);return gpResponse({ok:true,period,updatedAt:month.updatedAt,rows:month.rows.length,net:month.totals.price_total});}
 catch(error){return gpResponse({error:error.status?error.message:'อัปเดต Odoo ไม่สำเร็จ ข้อมูลเดิมยังคงอยู่'},error.status||503);}
 finally{if(acquired)try{await env.DB.prepare('UPDATE branch_profit_snapshots SET lock_token=NULL,lock_until=0 WHERE period=? AND lock_token=?').bind(period,token).run();}catch{}}
}

export function gpCurrentCosts(productMap,costs){
 if(!costs?.source?.purchaseColumn||!Array.isArray(costs.items))return {productMap,status:'saved',retained:0,updatedAt:null};
 let retained=0;
 const entries=Object.entries(productMap).map(([id,item])=>{
  if(item.status!=='actual'||!item.sourceRow)return [id,item];
  const matches=costs.items.filter(c=>c.sourceRow===item.sourceRow&&c.model===item.costModel&&c.grade===item.costGrade&&c.factory===item.factory);
  if(matches.length!==1||!Number.isFinite(matches[0].currentPurchaseCost)||matches[0].currentPurchaseCost<=0||matches[0].note){retained++;return [id,item];}
  return [id,{...item,unitCost:matches[0].currentPurchaseCost}];
 });
 return {productMap:Object.fromEntries(entries),status:retained||costs.source.status!=='online'?'partial':'online',retained,updatedAt:costs.source.fetched_at};
}
