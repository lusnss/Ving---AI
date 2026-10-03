const STOCK_ENDPOINT='https://ving-branch-stock.vercel.app/api/admin/stock-dashboard';
const stockHeaders={'cache-control':'no-store','x-content-type-options':'nosniff'};
const stockResponse=(body,status=200)=>Response.json(body,{status,headers:stockHeaders});
function stockCount(value){if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid stock quantity');return value;}
function stockText(value,max=200){return typeof value==='string'?value.slice(0,max):'';}
export function normalizeBranchStock(data){
 if(!data||data.ok===false||!Array.isArray(data.branches)||!Array.isArray(data.skuTotals))throw Error('Invalid stock response');
 return {
  branches:data.branches.map(b=>{if(!b||typeof b.id!=='string'||!b.id)throw Error('Invalid branch');return {id:stockText(b.id),name:stockText(b.name),normal:stockCount(b.normal),hold:stockCount(b.hold),syncStatus:['success','failed','pending','running'].includes(b.lastSync?.status)?b.lastSync.status:null};}),
  skuTotals:data.skuTotals.map(s=>{if(!s||typeof s.sku!=='string'||!s.sku)throw Error('Invalid SKU');return {sku:stockText(s.sku),barcode:stockText(s.barcode),model:stockText(s.model),color:stockText(s.color),size:stockText(s.size),normal:stockCount(s.normal),hold:stockCount(s.hold),total:stockCount(s.total),branchCount:typeof s.branchCount==='number'&&Number.isFinite(s.branchCount)?s.branchCount:null};}),
  products:Array.isArray(data.products)?data.products.filter(p=>p&&typeof p.sku==='string').map(p=>({sku:stockText(p.sku),model:stockText(p.model),color:stockText(p.color),size:stockText(p.size)})):[],
  lastUpdatedAt:typeof data.lastUpdatedAt==='string'&&Number.isFinite(Date.parse(data.lastUpdatedAt))?new Date(data.lastUpdatedAt).toISOString():null
 };
}
export async function stockAccountHeaders(env,fetcher,signal,trace){
 if(env.BRANCH_STOCK_API_TOKEN)return {'x-admin-token':env.BRANCH_STOCK_API_TOKEN};
 const email=String(env.BRANCH_STOCK_ACCOUNT_EMAIL||'').trim();
 const login=async branchId=>{
  trace.stage=branchId?'login_branch':'login';
  const response=await fetcher('https://ving-branch-stock.vercel.app/api/auth/login',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({email,...(branchId?{branchId}:{})}),redirect:'manual',signal});
  trace.upstreamStatus=response.status;
  if(!response.ok){const error=Error('Stock account rejected');error.accessDenied=[401,403].includes(response.status);throw error;}
  return response.json();
 };
 let account=await login();
 if(account.requiresBranchSelection){
  const branch=account.branches?.find(b=>typeof b.id==='string'&&b.id);
  if(!branch){const error=Error('Stock branch access unavailable');error.accessDenied=true;throw error;}
  account=await login(branch.id);
 }
 if(account.requiresBranchSelection||!['admin','admin_editor','admin_viewer'].includes(account.user?.role)||typeof account.user?.email!=='string'||account.user.email.trim().toLowerCase()!==email.toLowerCase()){
  const error=Error('Stock account access unavailable');error.accessDenied=true;throw error;
 }
 return {'x-actor-email':account.user.email};
}
export async function loadBranchStock(request,env,fetcher=fetch){
 if(!env.BRANCH_STOCK_API_TOKEN&&!env.BRANCH_STOCK_ACCOUNT_EMAIL)return stockResponse({status:'not_configured',error:'รอเชื่อมข้อมูลจากเว็บสต็อก กรุณาให้ผู้ดูแลระบบตั้งค่าสิทธิ์อ่านข้อมูล'},503);
 const query=new URL(request.url).searchParams,upstream=new URL(STOCK_ENDPOINT);
 const branch=query.get('branchIds')||'',q=(query.get('q')||'').trim();
 if(branch.length>1000||q.length>120)return stockResponse({status:'invalid_query',error:'คำค้นหายาวเกินไป'},400);
 if(branch)upstream.searchParams.set('branchIds',branch);if(q)upstream.searchParams.set('q',q);
 const trace={stage:'prepare',upstreamStatus:null};
 try{
  const signal=AbortSignal.timeout(12000);
  const authHeaders=await stockAccountHeaders(env,fetcher,signal,trace);
  trace.stage='stock_fetch';trace.upstreamStatus=null;
  const response=await fetcher(upstream,{method:'GET',headers:{...authHeaders,accept:'application/json'},redirect:'manual',signal});
  trace.upstreamStatus=response.status;
  if([401,403].includes(response.status))return stockResponse({status:'access_denied',error:'สิทธิ์เชื่อมข้อมูลยังใช้ไม่ได้ กรุณาให้ผู้ดูแลเว็บสต็อกตรวจสอบ'},503);
  if(!response.ok)throw Error('Stock source unavailable');
  trace.stage='stock_parse';
  const data=normalizeBranchStock(await response.json());
  return stockResponse({status:'connected',...data,fetchedAt:new Date().toISOString()});
 }catch(error){console.error(JSON.stringify({event:'branch_stock_failed',stage:trace.stage,upstreamStatus:trace.upstreamStatus,errorType:['TypeError','SyntaxError','TimeoutError','AbortError'].includes(error.name)?error.name:'Error',accessDenied:!!error.accessDenied}));if(error.accessDenied)return stockResponse({status:'access_denied',error:'สิทธิ์บัญชีเชื่อมข้อมูลยังใช้ไม่ได้ กรุณาให้ผู้ดูแลเว็บสต็อกตรวจสอบ'},503);return stockResponse({status:'unavailable',error:'ยังโหลดสต็อกไม่ได้ กรุณาลองอีกครั้ง'},502);}
}
