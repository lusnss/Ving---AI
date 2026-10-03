import {stockAccountHeaders,normalizeBranchStock} from './branch-stock.mjs';
export function forecastPeriod(now=new Date()){
 const local=new Date(now.getTime()+7*3600000),year=local.getUTCFullYear(),month=local.getUTCMonth();
 const months=Array.from({length:6},(_,i)=>new Date(Date.UTC(year,month-6+i,1)).toISOString().slice(0,7));
 const start=months[0]+'-01',end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
 return {months,start,end,days:Math.round((Date.parse(end)-Date.parse(start))/86400000)+1,asOf:local.toISOString().slice(0,10)};
}
const fcOrigin='https://ving-branch-stock.vercel.app';
const fcText=v=>typeof v==='string'?v.slice(0,200):'';
const fcNum=v=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('Invalid forecast quantity');return v;};
const fcDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const fcProduct=p=>({sku:fcText(p?.sku),model:fcText(p?.model),color:fcText(p?.color),size:fcText(p?.size),barcode:fcText(p?.barcode)});
const fcReply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
async function forecastMap(items,limit,fn){const result=new Array(items.length);let cursor=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;result[i]=await fn(items[i]);}}));return result;}
export function normalizeForecastSales(data,month,page){
 if(data.ok===false||!Array.isArray(data.items)||data.page!==page||!Number.isInteger(data.total)||data.total<0||!Number.isInteger(data.totalPages)||data.totalPages<1||data.pageSize!==200)throw Error('Invalid sales page');
 const rows=data.items.map(r=>{if(!r.id||!r.branchId||!r.sku||r.type!=='issue'||!fcDate(r.createdAt)||fcNum(r.qty)<=0)throw Error('Invalid sale');return {id:fcText(r.id),branchId:fcText(r.branchId),...fcProduct({...r.product,sku:r.sku}),qty:r.qty,date:fcDate(r.createdAt)};});
 return {month,page,total:data.total,totalPages:data.totalPages,expectedQty:fcNum(data.summary.issueQty),rows};
}
export function normalizeForecastStock(data,branchId){
 const rows=Array.isArray(data)?data:data.rows;if(!Array.isArray(rows))throw Error('Invalid branch balance');
 const seen=new Set();return {branchId,rows:rows.map(r=>{if(!r.sku||r.branchId!==branchId||seen.has(r.sku))throw Error('Invalid branch SKU');seen.add(r.sku);return {...fcProduct({...r.product,sku:r.sku}),normal:fcNum(r.qtyNormal),hold:fcNum(r.qtyOnHoldReturn),updatedAt:fcDate(r.updatedAt)};})};
}
export async function loadStockForecast(request,env,fetcher=fetch,now=new Date()){
 if(request.method!=='GET')return fcReply({error:'รองรับการอ่านข้อมูลเท่านั้น'},405);
 if(!env.BRANCH_STOCK_ACCOUNT_EMAIL&&!env.BRANCH_STOCK_API_TOKEN)return fcReply({error:'รอเชื่อมบัญชีเว็บสต็อก'},503);
 const query=new URL(request.url).searchParams,part=query.get('part')||'manifest',period=forecastPeriod(now),month=query.get('month'),startPage=Number(query.get('page')||1),ids=(query.get('ids')||'').split(',').filter(Boolean);
 if(!['manifest','history','stock'].includes(part)||part==='history'&&(!period.months.includes(month)||!Number.isInteger(startPage)||startPage<1||startPage>100000)||part==='stock'&&(!ids.length||ids.length>6||new Set(ids).size!==ids.length||ids.some(id=>! /^[A-Za-z0-9 _-]{1,80}$/.test(id))))return fcReply({error:'ตัวกรองไม่ถูกต้อง'},400);
 const key='stock-forecast/v1/'+part+'/'+(part==='history'?month+'/'+startPage:part==='stock'?ids.slice().sort().map(encodeURIComponent).join('_'):period.asOf)+'.json';
 const maxAge=part==='history'?6*3600000:5*60000;
 const historical=part==='history'&&month<period.asOf.slice(0,7);
 if(!env.FORCE_DATA_REFRESH&&query.get('refresh')!=='1'&&env.BUCKET){try{const saved=await env.BUCKET.get(key),cached=saved?await saved.json():null;if(cached&&Number.isFinite(Date.parse(cached.fetchedAt))&&now.getTime()-Date.parse(cached.fetchedAt)>=0&&(historical||Date.parse(cached.fetchedAt)>=(env.DATA_REFRESH_AFTER||0)&&now.getTime()-Date.parse(cached.fetchedAt)<maxAge))return fcReply({...cached,cached:true});}catch{}}
 try{
  const signal=AbortSignal.timeout(40000),auth=await stockAccountHeaders(env,fetcher,signal,{});
  const headers={...auth,...(auth['x-actor-email']?{'x-user-email':auth['x-actor-email']}:{})};
  async function get(path,params={}){const url=new URL(path,fcOrigin);for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));const response=await fetcher(url,{method:'GET',headers:{...headers,accept:'application/json'},redirect:'manual',signal});if(!response.ok)throw Error('Source unavailable');return response.json();}
  let result;
  if(part==='manifest'){
   const source=normalizeBranchStock(await get('/api/admin/stock-dashboard'));
   result={period,branches:source.branches.map(b=>({id:b.id,name:b.name,syncStatus:b.syncStatus})),products:source.products,lastUpdatedAt:source.lastUpdatedAt};
  }else if(part==='stock'){
   const batches=await forecastMap(ids,3,async id=>{try{return {data:normalizeForecastStock(await get('/api/summary',{branchId:id}),id)};}catch{return {failed:id};}});
   result={branches:batches.filter(r=>r.data).map(r=>r.data),failedBranchIds:batches.filter(r=>r.failed).map(r=>r.failed)};
  }else{
   const read=async page=>normalizeForecastSales(await get('/api/warehouse/movement-logs',{month,type:'issue',pageSize:200,page}),month,page);
   const first=await read(startPage);if(startPage>first.totalPages)throw Error('Page range changed');
   const last=Math.min(first.totalPages,startPage+11),others=await forecastMap(Array.from({length:last-startPage},(_,i)=>startPage+i+1),3,read),pages=[first,...others];
   if(pages.some(p=>p.total!==first.total||p.expectedQty!==first.expectedQty||p.totalPages!==first.totalPages))throw Error('History changed while reading');
   const rows=pages.flatMap(p=>p.rows);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate sales page');
   result={month,page:startPage,nextPage:last<first.totalPages?last+1:null,total:first.total,expectedQty:first.expectedQty,totalPages:first.totalPages,rows};
  }
  const data={...result,fetchedAt:now.toISOString(),cached:false};
  // Cached source snapshots contain operational fields only; incomplete branch reads are retried.
  if(env.BUCKET&&!result.failedBranchIds?.length){try{await env.BUCKET.put(key,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}}
  return fcReply(data);
 }catch{return fcReply({error:'ยังอ่านข้อมูลสำหรับคาดการณ์ไม่ครบ กรุณาลองอีกครั้ง'},502);}
}
