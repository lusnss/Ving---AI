import {activityTotals,activityBranches,allocation,cents,baht,activityCostReference,costCandidates,activityProductIdentity,activityCostReady,activityProductType} from './out/assets/activity-model.mjs';
import {readPivotInventory,enrichInventoryPrices} from './pivot-inventory.mjs';
import {applyCloudSales} from './cloud-sales.mjs';
import {ensureDailySales} from './sanitize.mjs';
const actError=(message,status=400)=>Object.assign(Error(message),{status});
const actText=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
function actNumber(value,label,{max=10000000,integer=false,nullable=false}={}){if(nullable&&(value===null||value===undefined||value===''))return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||integer&&!Number.isInteger(value))throw actError(label+'ไม่ถูกต้อง');return integer?value:baht(cents(value));}
export async function readActivityWorkspace(env){const row=await env.DB.prepare('SELECT payload, revision FROM activity_workspace WHERE id = ?').bind('main').first();return row?{items:JSON.parse(row.payload),revision:row.revision}:{items:[],revision:'0'};}
export function activityInventory(scaleup,pivot){
 // Keep existing Scaleup IDs so saved allocations still refer to the same stock.
 const scaleupItems=(enrichInventoryPrices(scaleup,pivot)?.items||[]).map(p=>({...p,source:'scaleup'}));
 // PIVOT IDs already include source, product code and grade. Never merge by SKU.
 const pivotItems=(pivot?.items||[]).map(p=>({...p,source:'pivot',warehouse:'PIVOT',priceReference:Number.isFinite(p.fullPrice)&&p.fullPrice>=0?{source:'pivot',fileName:pivot.sourceFile?.name,sheet:pivot.sourceFile?.sheet,rows:[p.sourceRow],importedAt:pivot.updatedAt}:null}));
 return {source:'activities',updatedAt:scaleup?.updatedAt||null,sources:[{source:'scaleup',label:'Scaleup',updatedAt:scaleup?.updatedAt||null},{source:'pivot',label:'PIVOT',updatedAt:pivot?.updatedAt||null}],items:[...scaleupItems,...pivotItems]};
}
export async function activitySources(env,initial,fallback,loadCosts){const [inventory,costs,stored,pivot]=await Promise.all([env.DB.prepare('SELECT payload FROM inventory_snapshots WHERE source = ?').bind('scaleup').first(),loadCosts(),env.BUCKET?.get('snapshot.json'),readPivotInventory(env)]);let snapshot=stored?await stored.json():fallback;try{snapshot=await applyCloudSales(ensureDailySales(snapshot),{...env,FORCE_DATA_REFRESH:false});}catch{}return {inventory:activityInventory(inventory?.payload?JSON.parse(inventory.payload):initial,pivot),costs,branches:activityBranches(snapshot)};}
export function validateActivity(input,sources,previous,permissions,others){
 if(!input||typeof input!=='object')throw actError('ข้อมูลกิจกรรมไม่ถูกต้อง');
 const name=actText(input.name,160),month=actText(input.month,7),status=actText(input.status),branchId=actText(input.branchId),type=actText(input.type);
 if(!name||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw actError('กรุณาระบุชื่อกิจกรรมและเดือน');
 if(!['draft','pending','planned','completed','cancelled'].includes(status))throw actError('สถานะไม่ถูกต้อง');
 if(!permissions.canApprove&&(!['draft','pending','cancelled'].includes(status)||previous&&['planned','completed'].includes(previous.status)))throw actError('กิจกรรมที่อนุมัติแล้วและการอนุมัติส่วนลด จัดการได้เฉพาะ CEO / Trade Manager',403);
 if(previous?.status==='completed')throw actError('กิจกรรมที่แจกแล้วแก้ไขไม่ได้ ใช้การคัดลอกเพื่อสร้างแผนใหม่');
 if(status==='completed'&&previous?.status!=='planned')throw actError('กรุณาอนุมัติจัดสรรกิจกรรมก่อนบันทึกว่าแจกแล้ว');
 const branch=sources.branches.find(b=>b.id===branchId);if(branchId&&!branch||type&&!sources.branches.some(b=>b.type===type))throw actError('ไม่พบสาขาหรือประเภทร้านใน Sales Report');
 if(!Array.isArray(input.items)||input.items.length>200||!Array.isArray(input.coupons)||input.coupons.length>20)throw actError('รายการเกินขนาดที่รองรับ');
 const taken=allocation(others,previous?.id),seen=new Set();
 const items=input.items.map(line=>{
  const inventoryId=actText(line.inventoryId),product=sources.inventory?.items.find(p=>p.id===inventoryId);if(!product||seen.has(inventoryId))throw actError('สินค้าไม่มีในคลังหรือเลือกซ้ำ');seen.add(inventoryId);
  const qty=actNumber(line.qty,'จำนวนสินค้า',{integer:true,max:1000000});if(qty<1)throw actError('จำนวนแจกต้องมากกว่า 0');
  if(['planned','completed'].includes(status)&&qty>Math.max(0,product.available-(taken.get(inventoryId)||0)))throw actError('สต็อกพร้อมใช้ไม่พอ: '+product.sku,409);
  const manual=line.costMode==='manual',catalog=line.costMode==='catalog';
  const matches=costCandidates(product,sources.costs.items);
  const row=line.costMode==='auto'?activityCostReference(product,sources.costs.items):sources.costs.items.find(c=>c.sourceRow===line.costRow);
  if(status!=='completed'&&(manual||row&&!matches.includes(row)))throw actError('ต้นทุนต้องตรงชื่อรุ่นและเกรดสินค้า หรือเกรดสูงขึ้น 1 ขั้นเมื่อไม่มีคู่: '+product.sku+' กรุณาใช้รายการที่จับคู่จากตารางต้นทุน');
  const old=previous?.items.find(i=>i.inventoryId===inventoryId);
  const keepingCompletion=status==='completed'&&old;
  const unitCost=keepingCompletion?old.unitCost:manual?actNumber(line.unitCost,'ต้นทุนต่อหน่วย',{nullable:true}):activityCostReady(row)?row.includingVat:null;
  const costNote=manual?actText(line.costNote,160):row?[row.model,'เกรด '+row.grade,row.factory].filter(Boolean).join(' · '):'';
  if(manual&&unitCost!==null&&!costNote)throw actError('กรุณาระบุที่มาของต้นทุนที่กรอกเอง');
  if(['planned','completed'].includes(status)&&(unitCost===null||unitCost<0||!manual&&row?.note))throw actError('กรุณายืนยันต้นทุนสินค้าให้ครบก่อนอนุมัติ: '+product.sku);
  return {inventoryId,sku:product.sku,name:product.name,grade:activityProductIdentity(product).grade,productModel:activityProductIdentity(product).model,category:activityProductType(product,sources.costs.items),warehouse:product.warehouse,unit:product.unit,qty,costRow:keepingCompletion?old.costRow:row?.sourceRow??null,costMode:keepingCompletion?old.costMode:manual?'manual':catalog?'catalog':line.costMode==='auto'?'auto':'sheet',unitCost,costNote:keepingCompletion?old.costNote:costNote,stockAtSave:keepingCompletion?old.stockAtSave:product.available,availableAtSave:keepingCompletion?old.availableAtSave:Math.max(0,product.available-(taken.get(inventoryId)||0))};
 });
 const coupons=status==='completed'?structuredClone(previous.coupons):input.coupons.map(c=>{
  if(!['percent','fixed'].includes(c.kind))throw actError('ประเภทส่วนลดไม่ถูกต้อง');
  const value=actNumber(c.value,'มูลค่าส่วนลด',{max:c.kind==='percent'?100:10000000}),uses=actNumber(c.uses,'จำนวนสิทธิ์',{integer:true,max:1000000}),cap=actNumber(c.cap||0,'ลดสูงสุดต่อสิทธิ์');
  if(value<=0||uses<1)throw actError('กรุณาระบุส่วนลดและจำนวนสิทธิ์ให้มากกว่า 0');
  if(c.kind==='percent'&&cap<=0&&['planned','completed'].includes(status))throw actError('ส่วนลดเปอร์เซ็นต์ต้องระบุลดสูงสุดต่อสิทธิ์ เพื่อคำนวณงบเมื่อใช้ครบ');
  const minSpend=actNumber(c.minSpend,'ยอดซื้อขั้นต่ำ',{nullable:true});
  return {kind:c.kind,value,uses,cap,minSpend,redemption:'instant',calculation:'full-redemption'};
 });
 if(!items.length&&!coupons.length)throw actError('เลือกสินค้าแจกหรือเพิ่มส่วนลดอย่างน้อย 1 รายการ');
 const start=actText(input.start,10),end=actText(input.end,10);for(const date of [start,end])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.slice(0,7)!==month||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw actError('วันจัดกิจกรรมต้องเป็นวันที่จริงภายในเดือนที่เลือก');if(start&&end&&start>end)throw actError('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
 const result={id:previous?.id||crypto.randomUUID(),name,month,status,review:status==='planned'?{decision:'approved',note:'',at:new Date().toISOString()}:previous?.review||null,branchId:branch?.id||'',branchName:branch?.name||'',type:branch?.type||type,start,end,items,coupons,budget:actNumber(input.budget||0,'งบประมาณ'),extra:actNumber(input.extra||0,'ค่าใช้จ่ายอื่น'),notes:actText(input.notes,1000),actualDiscount:actNumber(input.actualDiscount,'ส่วนลดใช้จริง',{nullable:true}),stockSettled:false,inventoryUpdatedAt:sources.inventory?.updatedAt||null,costUpdatedAt:sources.costs.source?.fetched_at||null,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(status==='completed'&&JSON.stringify({...result,status:'planned',updatedAt:null,actualDiscount:null,inventoryUpdatedAt:null,costUpdatedAt:null})!==JSON.stringify({...previous,status:'planned',updatedAt:null,actualDiscount:null,inventoryUpdatedAt:null,costUpdatedAt:null})){
  // Complete only the exact approved quantities and commercial plan.
  for(const k of ['name','month','branchId','type','start','end','budget','extra','notes','coupons'])if(JSON.stringify(result[k])!==JSON.stringify(previous[k]))throw actError('บันทึกการแก้ไขเป็นแผนก่อนกดแจกแล้ว');
  if(items.length!==previous.items.length||items.some((i,n)=>i.inventoryId!==previous.items[n].inventoryId||i.qty!==previous.items[n].qty))throw actError('จำนวนที่แจกต้องตรงกับแผนที่อนุมัติ');
 }
 const totals=activityTotals(result);if(result.budget>0&&totals.worst>result.budget&&['planned','completed'].includes(status))throw actError('ภาระสูงสุดเกินงบ กรุณาปรับแผนหรืองบประมาณก่อนอนุมัติ');
 return result;
}
export async function saveActivityWorkspace(request,env,sources,permissions){
 if(!permissions.canEdit)throw actError('สิทธิ์ดูอย่างเดียว',403);
 const text=await request.text();if(text.length>250000)throw actError('รายการใหญ่เกินไป',413);let body;try{body=JSON.parse(text);}catch{throw actError('ข้อมูลไม่ถูกต้อง');}
 const workspace=await readActivityWorkspace(env);if(body.revision!==workspace.revision)throw actError('มีผู้แก้ไขกิจกรรมแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง ข้อมูลในฟอร์มยังอยู่',409);
 const previous=body.activity?.id?workspace.items.find(a=>a.id===body.activity.id):null;if(body.activity?.id&&!previous)throw actError('ไม่พบกิจกรรม',404);
 let next;
 if(body.action==='delete'){
  if(!previous)throw actError('ไม่พบกิจกรรม',404);
  if(body.confirm!==true)throw actError('กรุณายืนยันการลบแผน');
  if(previous.status==='completed')throw actError('กิจกรรมที่แจกแล้วลบไม่ได้ เพื่อเก็บประวัติการแจกและยอดจัดสรรคลัง',409);
  if(previous.status==='planned'&&!permissions.canApprove)throw actError('ลบแผนที่อนุมัติได้เฉพาะ CEO / Trade Manager',403);
 }else if(body.action==='quantities'){
  if(!previous)throw actError('ไม่พบกิจกรรม',404);
  if(!['draft','pending','rejected','planned'].includes(previous.status))throw actError('ปรับจำนวนได้เฉพาะกิจกรรมที่ยังไม่แจกหรือยกเลิก',409);
  if(previous.status==='planned'&&!permissions.canApprove)throw actError('ปรับจำนวนแผนที่อนุมัติได้เฉพาะ CEO / Trade Manager',403);
  const removedIds=body.removedInventoryIds??[];
  if(!Array.isArray(body.quantities)||!Array.isArray(removedIds)||!body.quantities.length&&!removedIds.length||body.quantities.length+removedIds.length>200)throw actError('กรุณาระบุรายการที่ต้องการแก้ไข');
  const removed=new Set();
  for(const id of removedIds){
   if(typeof id!=='string'||!previous.items.some(i=>i.inventoryId===id)||removed.has(id))throw actError('รายการที่ต้องการลบไม่ถูกต้องหรือซ้ำ');
   removed.add(id);
  }
  const changes=new Map(),reserved=allocation(workspace.items,previous.id);
  for(const change of body.quantities){
   const id=actText(change.inventoryId),line=previous.items.find(i=>i.inventoryId===id);
   if(!line||changes.has(id)||removed.has(id))throw actError('รายการรางวัลไม่ถูกต้องหรือซ้ำ');
   const qty=actNumber(change.qty,'จำนวนรางวัล',{integer:true,max:1000000});if(qty<1)throw actError('จำนวนรางวัลต้องไม่น้อยกว่า 1');
   const product=sources.inventory?.items.find(p=>p.id===id);
   if(!product)throw actError('ไม่พบสินค้าในคลัง: '+line.sku,409);
   const available=Math.max(0,product.available-(reserved.get(id)||0));
   if(qty>available&&qty>line.qty)throw actError('สต็อกพร้อมใช้ไม่พอ: '+line.sku,409);
   changes.set(id,qty);
  }
  next={...previous,items:previous.items.filter(i=>!removed.has(i.inventoryId)).map(i=>changes.has(i.inventoryId)?{...i,qty:changes.get(i.inventoryId)}:i),updatedAt:new Date().toISOString()};
  if(!next.items.length&&!next.coupons.length)throw actError('กิจกรรมต้องมีสินค้าแจกหรือส่วนลดอย่างน้อย 1 รายการ');
  if(next.status==='planned'&&next.budget>0&&activityTotals(next).worst>next.budget)throw actError('ภาระสูงสุดเกินงบ กรุณาลดจำนวนหรือแก้ไขแผนก่อนบันทึก');
 }else if(body.action==='review'){
  if(!permissions.canApprove)throw actError('อนุมัติหรือไม่อนุมัติได้เฉพาะ CEO / Trade Manager',403);
  if(!previous||!['draft','pending'].includes(previous.status))throw actError('พิจารณาได้เฉพาะร่างกิจกรรมหรือรายการรออนุมัติ',409);
  if(!['approved','rejected'].includes(body.decision))throw actError('ผลการอนุมัติไม่ถูกต้อง');
  if(body.decision==='approved')next=validateActivity({...previous,status:'planned'},sources,previous,permissions,workspace.items);
  else next={...previous,status:'rejected',review:{decision:'rejected',note:actText(body.note,1000),at:new Date().toISOString()},updatedAt:new Date().toISOString()};
 }else if(body.action==='settle'){

  if(!permissions.canApprove)throw actError('ยืนยันตัดคลังได้เฉพาะ CEO / Trade Manager',403);
  if(!previous||previous.status!=='completed'||body.confirm!==true)throw actError('ต้องยืนยันว่าบันทึกการตัดคลังต้นทางเรียบร้อยแล้ว');
  next={...previous,stockSettled:true,updatedAt:new Date().toISOString()};
 }else if(body.activity?.status==='cancelled'){
  if(!previous||previous.status==='completed')throw actError('ยกเลิกได้เฉพาะร่างหรือแผนที่ยังไม่แจก');
  if(previous.status==='planned'&&!permissions.canApprove)throw actError('ยกเลิกแผนที่อนุมัติได้เฉพาะ CEO / Trade Manager',403);
  next={...previous,status:'cancelled',updatedAt:new Date().toISOString()};
 }else next=validateActivity(body.activity,sources,previous,permissions,workspace.items);
 const items=body.action==='delete'?workspace.items.filter(a=>a.id!==previous.id):previous?workspace.items.map(a=>a.id===previous.id?next:a):[...workspace.items,next];if(items.length>2000)throw actError('รายการกิจกรรมเกินขนาดที่รองรับ');
 const revision=crypto.randomUUID();
 // One atomic compare-and-swap protects every SKU allocation across concurrent edits.
 const saved=await env.DB.prepare('INSERT INTO activity_workspace (id, payload, revision) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, revision = excluded.revision WHERE activity_workspace.revision = ? RETURNING revision').bind('main',JSON.stringify(items),revision,workspace.revision).first();
 if(!saved)throw actError('มีผู้บันทึกกิจกรรมพร้อมกัน กรุณาโหลดข้อมูลล่าสุดแล้วตรวจจำนวนอีกครั้ง',409);
 return {items,revision,...(body.action==='delete'?{deletedId:previous.id}:{savedId:next.id})};
}
