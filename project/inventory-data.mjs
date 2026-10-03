import {readPivotInventory,enrichInventoryPrices} from './pivot-inventory.mjs';
const INVENTORY_API='https://api-app.scaleup-fulfilment.com/api/v2';
const inventoryFields={onHand:'quantity',good:'normal',reserved:'sellable_reserved',available:'sellable_available',onHold:'on_hold',shelfLifeHold:'shelf_life_hold',pendingDestruction:'pending_destruction',defect:'defect',quarantine:'quarantine',expired:'expired'};
function inventoryError(message,status=502){return Object.assign(Error(message),{status});}
function inventoryText(value,max=300){return typeof value==='string'?value.slice(0,max):'';}
function inventoryQuantity(value){if(typeof value!=='number'||!Number.isFinite(value))throw inventoryError('รูปแบบจำนวนสต็อกจากต้นทางไม่ถูกต้อง');return value;}
export function normalizeInventory(rows,_summary,updatedAt){
 const ids=new Set();
 const items=rows.map(row=>{
  if(!row||typeof row.sku!=='string'||!row.sku||!Number.isInteger(row.inventory_id)||ids.has(row.inventory_id))throw inventoryError('รายการสต็อกไม่ครบหรือซ้ำ กรุณากดอัปเดตอีกครั้ง');
  ids.add(row.inventory_id);
  return {id:String(row.inventory_id),sku:inventoryText(row.sku),barcode:inventoryText(row.barcode),name:inventoryText(row.product_name),productType:inventoryText(row.product_type,40),unit:inventoryText(row.unit,40),warehouse:inventoryText(row.warehouse?.name),...Object.fromEntries(Object.entries(inventoryFields).map(([key,field])=>[key,inventoryQuantity(row[field])]))};
 });
 const totals={skuCount:new Set(items.map(row=>row.sku)).size,...Object.fromEntries(Object.keys(inventoryFields).map(key=>[key,items.reduce((sum,row)=>sum+row[key],0)]))};
 return {source:'scaleup',updatedAt,items,summary:totals};
}
export async function fetchScaleupInventory(env,fetcher=fetch){
 if(!env.SCALEUP_USERNAME||!env.SCALEUP_PASSWORD)throw inventoryError('ยังไม่ได้ตั้งค่าบัญชีเชื่อมต่อ Scaleup',503);
 const signal=AbortSignal.timeout(45000);
 const request=async(path,options={})=>{
  // Workers supports manual redirects. Reject them without forwarding credentials.
  const response=await fetcher(INVENTORY_API+path,{...options,redirect:'manual',signal});
  if(response.status>=300&&response.status<400)throw inventoryError('Scaleup เปลี่ยนเส้นทางการเชื่อมต่อ กรุณาตรวจสอบระบบต้นทาง');
  if([401,403].includes(response.status))throw inventoryError('บัญชี Scaleup ไม่สามารถอ่านรายงานได้ กรุณาตรวจสอบสิทธิ์หรือรหัสผ่าน',503);
  if(!response.ok)throw inventoryError('Scaleup ยังไม่พร้อมให้ข้อมูล กรุณาลองอีกครั้ง');
  return response.json();
 };
 const auth=await request('/auth/login',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({email:env.SCALEUP_USERNAME,password:env.SCALEUP_PASSWORD})});
 const organization=String(env.SCALEUP_ORGANIZATION_ID||'993'),consoleId=String(env.SCALEUP_CONSOLE_ID||'1222');
 if(typeof auth.token!=='string'||!auth.token||!Array.isArray(auth.console_access)||!auth.console_access.some(c=>c.is_active&&String(c.organization_id)===organization&&String(c.oms_console_id)===consoleId))throw inventoryError('ไม่พบสิทธิ์รายงานของ V-ING ในบัญชี Scaleup',503);
 const headers={accept:'application/json',authorization:'Bearer '+auth.token,'x-organization-id':organization,'x-oms-console-id':consoleId,'x-oms-console-ids':'','x-permission-scope':'oms_reports_inventory','x-active-system':'seller'};
 let rows=[],expected=null;
 for(let page=1;page<=200;page++){
  const query=new URLSearchParams({branchId:'all',sortBy:'sku',sortDirection:'asc',customerOrganizationId:organization,customerOmsConsoleId:consoleId,view:'oms',viewMode:'list',page:String(page),limit:'100',includeRows:'true',includeSummary:'false',includeTotal:'true'});
  const body=await request('/reports/inventory?'+query,{method:'GET',headers});const data=body.data;
  if(body.ok!==true||!Array.isArray(data?.items)||!Number.isInteger(data.total)||data.total<0||data.page!==page||typeof data.hasNextPage!=='boolean')throw inventoryError('รูปแบบรายงาน Scaleup ไม่ถูกต้อง');
  if(expected===null){expected=data.total;}
  if(data.total!==expected||expected>20000)throw inventoryError('จำนวนรายการต้นทางเปลี่ยนหรือเกินขนาดที่รองรับ กรุณาลองอีกครั้ง');
  rows.push(...data.items);
  if(!data.hasNextPage){if(rows.length!==expected)throw inventoryError('ดึงสต็อกไม่ครบทุกหน้า กรุณาลองอีกครั้ง');return normalizeInventory(rows,null,new Date().toISOString());}
  if(!data.items.length||rows.length>=expected)throw inventoryError('ข้อมูลแบ่งหน้าของ Scaleup ไม่ครบถ้วน');
 }
 throw inventoryError('รายงานมีจำนวนหน้าเกินขนาดที่รองรับ');
}
const inventoryResponse=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function handleInventory(request,env,initial=null,fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(path==='/api/inventory'){
  if(!['GET','HEAD'].includes(request.method))return inventoryResponse({error:'Method not allowed'},405);
  try{const [saved,pivot]=await Promise.all([env.DB.prepare('SELECT payload FROM inventory_snapshots WHERE source = ?').bind('scaleup').first(),readPivotInventory(env)]);return inventoryResponse({snapshot:enrichInventoryPrices(saved?.payload?JSON.parse(saved.payload):initial,pivot),pivot});}catch{return inventoryResponse({error:'ยังอ่านข้อมูลที่บันทึกไว้ไม่ได้ กรุณาลองเปิดหน้าใหม่'},503);}
 }
 if(request.method!=='POST')return inventoryResponse({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return inventoryResponse({error:'คำขอต้องมาจากเว็บนี้'},403);
 const body=await request.json().catch(()=>null);
 if(body?.source!=='scaleup')return inventoryResponse({error:'แหล่งข้อมูลนี้ยังไม่ได้เชื่อมต่อ'},400);
 const token=crypto.randomUUID(),now=Date.now();let acquired=false;
 try{
  // A durable lease prevents simultaneous button presses from publishing older
  // snapshots over a newer result, including across Worker isolates.
  const lock=await env.DB.prepare('INSERT INTO inventory_snapshots (source, lock_token, lock_until) VALUES (?, ?, ?) ON CONFLICT(source) DO UPDATE SET lock_token = excluded.lock_token, lock_until = excluded.lock_until WHERE inventory_snapshots.lock_until < ? RETURNING source').bind('scaleup',token,now+75000,now).first();
  if(!lock)return inventoryResponse({error:'มีการอัปเดต Stock อยู่แล้ว กรุณารอสักครู่แล้วเปิดหน้าใหม่'},409);
  acquired=true;
  const snapshot=await fetchScaleupInventory(env,fetcher);
  const saved=await env.DB.prepare('UPDATE inventory_snapshots SET payload = ?, updated_at = ?, lock_token = NULL, lock_until = 0 WHERE source = ? AND lock_token = ? RETURNING source').bind(JSON.stringify(snapshot),snapshot.updatedAt,'scaleup',token).first();
  if(!saved)throw inventoryError('การอัปเดตครั้งนี้หมดเวลา ข้อมูลเดิมยังคงอยู่ กรุณาลองอีกครั้ง',409);
  return inventoryResponse({snapshot:enrichInventoryPrices(snapshot,await readPivotInventory(env))});
 }catch(error){return inventoryResponse({error:error.status?error.message:'อัปเดต Stock ไม่สำเร็จ กรุณาลองอีกครั้ง'},error.status||503);}
 finally{if(acquired)try{await env.DB.prepare('UPDATE inventory_snapshots SET lock_token = NULL, lock_until = 0 WHERE source = ? AND lock_token = ?').bind('scaleup',token).run();}catch{}}
}
