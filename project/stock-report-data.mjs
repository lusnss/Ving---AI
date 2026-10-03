import {stockAccountHeaders,normalizeBranchStock} from './branch-stock.mjs';
import {normalizeForecastSales} from './stock-forecast-data.mjs';

export function stockReportPeriod(now=new Date()){
 const local=new Date(now.getTime()+7*3600000),year=local.getUTCFullYear(),month=local.getUTCMonth();
 return {asOf:local.toISOString().slice(0,10),months:Array.from({length:24},(_,i)=>new Date(Date.UTC(year,month-i,1)).toISOString().slice(0,7))};
}
const srReply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function loadStockReport(request,env,fetcher=fetch,now=new Date()){
 if(request.method!=='GET')return srReply({error:'รองรับการอ่านข้อมูลเท่านั้น'},405);
 if(!env.BRANCH_STOCK_ACCOUNT_EMAIL&&!env.BRANCH_STOCK_API_TOKEN)return srReply({error:'รอเชื่อมบัญชีเว็บสต็อก'},503);
 const query=new URL(request.url).searchParams,part=query.get('part')||'manifest',period=stockReportPeriod(now),month=query.get('month'),page=Number(query.get('page')||1);
 if(!['manifest','history'].includes(part)||part==='history'&&(!period.months.includes(month)||!Number.isInteger(page)||page<1||page>100000))return srReply({error:'ช่วงเดือนหรือตัวกรองไม่ถูกต้อง'},400);
 const key='stock-report/v1/'+(part==='manifest'?'manifest/'+period.asOf:month+'/'+page)+'.json',maxAge=part==='history'&&month!==period.months[0]?6*3600000:5*60000;
 const historical=part==='history'&&month<period.months[0];
 if(!env.FORCE_DATA_REFRESH&&query.get('refresh')!=='1'&&env.BUCKET){try{const saved=await env.BUCKET.get(key),data=saved?await saved.json():null;if(data&&Number.isFinite(Date.parse(data.fetchedAt))&&now.getTime()-Date.parse(data.fetchedAt)>=0&&(historical||Date.parse(data.fetchedAt)>=(env.DATA_REFRESH_AFTER||0)&&now.getTime()-Date.parse(data.fetchedAt)<maxAge))return srReply({...data,cached:true});}catch{}}
 try{
  const signal=AbortSignal.timeout(40000),auth=await stockAccountHeaders(env,fetcher,signal,{}),headers={...auth,...(auth['x-actor-email']?{'x-user-email':auth['x-actor-email']}:{})};
  async function get(path,params={}){const url=new URL(path,'https://ving-branch-stock.vercel.app');for(const[k,v]of Object.entries(params))url.searchParams.set(k,String(v));const r=await fetcher(url,{method:'GET',headers:{...headers,accept:'application/json'},redirect:'manual',signal});if(!r.ok)throw Error('Source unavailable');return r.json();}
  let result;
  if(part==='manifest'){
   const source=normalizeBranchStock(await get('/api/admin/stock-dashboard'));
   result={period,branches:source.branches.map(b=>({id:b.id,name:b.name})),products:source.products,lastUpdatedAt:source.lastUpdatedAt};
  }else{
   const read=async p=>normalizeForecastSales(await get('/api/warehouse/movement-logs',{month,type:'issue',pageSize:200,page:p}),month,p),first=await read(page);
   if(page>first.totalPages)throw Error('Page changed');
   const last=Math.min(first.totalPages,page+11),pages=[first];
   // At most 12 source pages per Worker request; three parallel reads at a time.
   for(let p=page+1;p<=last;p+=3)pages.push(...await Promise.all(Array.from({length:Math.min(3,last-p+1)},(_,i)=>read(p+i))));
   if(pages.some(p=>p.total!==first.total||p.totalPages!==first.totalPages||p.expectedQty!==first.expectedQty))throw Error('History changed');
   const rows=pages.flatMap(p=>p.rows);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate sale');
   result={month,page,nextPage:last<first.totalPages?last+1:null,total:first.total,expectedQty:first.expectedQty,totalPages:first.totalPages,rows};
  }
  const data={...result,fetchedAt:now.toISOString(),cached:false};
  if(env.BUCKET)try{await env.BUCKET.put(key,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}
  return srReply(data);
 }catch{return srReply({error:'ยังอ่านรายการขายไม่ครบ กรุณากดอัปเดตข้อมูลอีกครั้ง'},502);}
}
