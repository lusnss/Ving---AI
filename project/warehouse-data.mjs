import {stockAccountHeaders} from './branch-stock.mjs';
const warehouseOrigin='https://ving-branch-stock.vercel.app';
const warehousePaths={overview:'/api/warehouse/overview',initial:'/api/warehouse/initial-stock-logs',movement:'/api/warehouse/movement-logs',returns:'/api/warehouse/returns',grades:'/api/grade-adjustments/admin',audit:'/api/audit'};
const whText=v=>typeof v==='string'?v.slice(0,300):'';
const whNumber=v=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('Invalid warehouse number');return v;};
const whDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const whList=v=>{if(!Array.isArray(v))throw Error('Invalid warehouse list');return v;};
const whProduct=p=>p?{sku:whText(p.sku),barcode:whText(p.barcode),model:whText(p.model),color:whText(p.color),size:whText(p.size)}:null;
const whBranches=v=>whList(v).map(b=>({id:whText(b.id),name:whText(b.name)}));
const whPhoto=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const whReply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
// Keep operational fields only. Actor identities and free-form personal data stay at the source.
export function normalizeWarehouse(section,data){
 if(!data||data.ok===false)throw Error('Invalid warehouse response');
 if(section==='overview')return {metrics:{activeBranches:whNumber(data.metrics.activeBranches),totalNormal:whNumber(data.metrics.totalNormal),totalOnHold:whNumber(data.metrics.totalOnHold),inTransit:whNumber(data.metrics.returnOrders?.in_transit??0)},branches:whBranches(data.branches),skuTotals:whList(data.skuTotals).map(s=>({...whProduct(s),normal:whNumber(s.normal),hold:whNumber(s.hold),total:whNumber(s.normal)+whNumber(s.hold),branchCount:whNumber(s.branchCount)})),lastUpdatedAt:whDate(data.lastUpdatedAt)};
 if(['initial','movement'].includes(section))return {page:whNumber(data.page),pageSize:whNumber(data.pageSize),total:whNumber(data.total),totalPages:whNumber(data.totalPages),summary:Object.fromEntries((section==='initial'?['normalQty','damagedQty','totalQty','skuCount']:['receiveQty','issueQty','netQty','skuCount']).map(k=>[k,whNumber(data.summary[k])])),branches:whBranches(data.branches),items:whList(data.items).map(r=>({id:whText(r.id),branchId:whText(r.branchId),branchName:whText(r.branchName),sku:whText(r.sku),product:whProduct(r.product),type:whText(r.type),qty:whNumber(r.qty),createdAt:whDate(r.createdAt)}))};
 if(section==='returns')return {orders:whList(data.orders).map(o=>({id:whText(o.id),branchId:whText(o.branchId),branchName:whText(o.branchName),status:whText(o.status),trackingNo:whText(o.trackingNo),createdAt:whDate(o.createdAt),shippedAt:whDate(o.shippedAt),receivedAt:whDate(o.receivedAt),totalQty:whNumber(o.totalQty),photoUrl:whPhoto(o.photoUrl),items:whList(o.items).map(i=>({...whProduct(i),qty:whNumber(i.qty)}))}))};
 if(section==='grades')return {requests:whList(data.requests).map(r=>({id:whText(r.id),branchId:whText(r.branchId),branchName:whText(r.branch?.name),sourceSku:whText(r.sourceSku),targetSku:whText(r.targetSku||r.expectedTargetSku),targetGrade:whText(r.targetGrade),status:whText(r.status),qty:whNumber(r.qty),requestedAt:whDate(r.requestedAt),targetProductExists:typeof r.targetProductExists==='boolean'?r.targetProductExists:null,photos:Array.isArray(r.photos)?r.photos.map(whPhoto).filter(Boolean):[]}))};
 if(section==='audit')return {logs:whList(data.logs).map(r=>({id:whText(r.id),branchId:whText(r.branchId),action:whText(r.action),entityType:whText(r.entityType),entityId:whText(r.entityId),createdAt:whDate(r.createdAt)}))};
 throw Error('Invalid warehouse section');
}
export async function loadWarehouse(request,env,fetcher=fetch){
 if(request.method!=='GET')return whReply({status:'read_only',error:'รองรับการอ่านข้อมูลเท่านั้น'},405);
 const input=new URL(request.url).searchParams,section=input.get('section')||'overview';
 if(!Object.hasOwn(warehousePaths,section))return whReply({error:'ไม่พบหมวดข้อมูล'},400);
 if(!env.BRANCH_STOCK_ACCOUNT_EMAIL&&!env.BRANCH_STOCK_API_TOKEN)return whReply({status:'not_configured',error:'รอเชื่อมบัญชีเว็บสต็อก'},503);
 const upstream=new URL(warehousePaths[section],warehouseOrigin);
 const page=input.get('page')||'1',month=input.get('month')||new Date(Date.now()+7*3600000).toISOString().slice(0,7),branch=input.get('branchId')||'',q=(input.get('q')||'').trim(),type=input.get('type')||'',status=input.get('status')||'';
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!/^\d{1,7}$/.test(page)||Number(page)<1||branch.length>200||q.length>120)return whReply({error:'ตัวกรองไม่ถูกต้อง'},400);
 if(['initial','movement'].includes(section)){
  if(type&&!(section==='initial'?['normal','damaged']:['receive','issue']).includes(type))return whReply({error:'ประเภทไม่ถูกต้อง'},400);
  for(const [k,v] of Object.entries({month,page,pageSize:'20',branchId:branch,q,type}))if(v)upstream.searchParams.set(k,v);
 }
 if(['returns','grades'].includes(section)&&status){if(!(section==='returns'?['pending','in_transit','completed','cancelled']:['requested','approved','label_sent','completed','rejected']).includes(status))return whReply({error:'สถานะไม่ถูกต้อง'},400);upstream.searchParams.set('status',status);}
 if(section==='audit'){upstream.searchParams.set('limit','50');if(branch)upstream.searchParams.set('branchId',branch);}
 const trace={stage:'prepare',upstreamStatus:null};
 try{
  const signal=AbortSignal.timeout(15000),account=await stockAccountHeaders(env,fetcher,signal,trace);
  const headers={accept:'application/json',...(account['x-actor-email']?{'x-user-email':account['x-actor-email']}:account)};
  const response=await fetcher(upstream,{method:'GET',headers,redirect:'manual',signal});
  if([401,403].includes(response.status))return whReply({status:'access_denied',error:'บัญชีเชื่อมต่อไม่มีสิทธิ์อ่านคลังกลาง'},503);
  if(!response.ok)throw Error('Warehouse unavailable');
  return whReply({status:'connected',section,...normalizeWarehouse(section,await response.json()),fetchedAt:new Date().toISOString()});
 }catch(error){return whReply({status:error.accessDenied?'access_denied':'unavailable',error:error.accessDenied?'บัญชีเชื่อมต่อไม่มีสิทธิ์อ่านคลังกลาง':'ยังโหลดข้อมูลคลังกลางไม่ได้ กรุณาลองอีกครั้ง'},error.accessDenied?503:502);}
}
