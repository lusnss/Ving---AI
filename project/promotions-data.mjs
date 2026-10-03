import {promotionSchedule,promotionScheduleError} from './out/assets/promotion-schedule.mjs';
import {summaryIdentity,summaryItemCost} from './out/assets/stock-summary-model.mjs';
import {applyPromotionHistory} from './promotion-forecast-data.mjs';
import {promotionChannels,defaultPromotionPolicy,validatePromotionPolicy,promotionBranchFamily,recommendedDiscount,promotionTotals,promotionIdentityKey,groupPromotionModels,promotionPricing,promotionPricingError} from './out/assets/promotion-model.mjs';
const promotionError=(message,status=400)=>Object.assign(Error(message),{status});
const promotionText=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function readPromotionPlans(env){const result=await env.DB.prepare('SELECT payload FROM promotion_plans ORDER BY created_at DESC LIMIT 300').all();return result.results.map(r=>JSON.parse(r.payload));}
export async function changePromotionPlan(request,env,permissions,action){
 if(!permissions.canEdit||action==='approve'&&!permissions.canApprove)throw promotionError(action==='approve'?'อนุมัติงานได้เฉพาะ CEO / Trade Manager':'สิทธิ์ดูอย่างเดียว',403);
 if(!['approve','delete'].includes(action))throw promotionError('คำสั่งไม่ถูกต้อง');
 const raw=await request.text();if(raw.length>2000)throw promotionError('ข้อมูลมีขนาดใหญ่เกินไป',413);
 let input;try{input=JSON.parse(raw);}catch{throw promotionError('ข้อมูลไม่ถูกต้อง');}
 if(!input||typeof input.id!=='string'||!input.id||input.id.length>100||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1)throw promotionError('รหัสหรือรุ่นของข้อเสนอไม่ถูกต้อง');
 const record=await env.DB.prepare('SELECT payload FROM promotion_plans WHERE id = ?').bind(input.id).first();
 if(!record)throw promotionError('ไม่พบข้อเสนอนี้ อาจถูกลบแล้ว',404);
 const plan=JSON.parse(record.payload);
 if(input.expectedVersion!==(plan.revision||1))throw promotionError('ข้อเสนอนี้เปลี่ยนแปลงแล้ว กรุณาตรวจข้อมูลล่าสุดแล้วลองอีกครั้ง',409);
 let result;
 if(action==='approve'){
  if(!['draft','proposed'].includes(plan.status)||plan.approval!=='unapproved')throw promotionError('ข้อเสนอนี้อนุมัติแล้วหรือไม่อยู่ในสถานะที่อนุมัติได้',409);
  const now=new Date().toISOString();Object.assign(plan,{status:'approved',approval:'approved',approvedAt:now,updatedAt:now,revision:(plan.revision||1)+1});
  result=await env.DB.prepare('UPDATE promotion_plans SET payload = ? WHERE id = ? AND payload = ?').bind(JSON.stringify(plan),plan.id,record.payload).run();
 }else result=await env.DB.prepare('DELETE FROM promotion_plans WHERE id = ? AND payload = ?').bind(plan.id,record.payload).run();
 if(Number(result.meta?.changes??result.changes)!==1)throw promotionError('ข้อเสนอนี้เปลี่ยนแปลงแล้ว กรุณาตรวจข้อมูลล่าสุดแล้วลองอีกครั้ง',409);
 return action==='approve'?{plan}:{deletedId:plan.id};
}
export async function promotionStock(context,channel,branchId=''){
 const config=Object.hasOwn(promotionChannels,channel)?promotionChannels[channel]:null;if(!config)throw promotionError('ประเภทโปรโมชั่นไม่ถูกต้อง');
 const sources=await context.sources(),priceByIdentity=new Map(),prices=new Map();
 for(const item of sources.inventory.items){if(!(item.fullPrice>0))continue;for(const [map,key] of [[prices,item.sku],[priceByIdentity,promotionIdentityKey(summaryIdentity(item))]]){const set=map.get(key)||new Set();set.add(item.fullPrice);map.set(key,set);}}
 const finance=p=>{const identity=summaryIdentity(p),priceSet=prices.get(p.sku)||priceByIdentity.get(promotionIdentityKey(identity)),cost=summaryItemCost({...p,...identity},sources.costs?.items||[]);return {...identity,fullPrice:priceSet?.size===1?[...priceSet][0]:null,unitCost:!cost.costMissing&&Number.isFinite(cost.unitCostMin)&&Number.isFinite(cost.unitCostMax)?Math.round((cost.unitCostMin+cost.unitCostMax)*50)/100:null,costMin:cost.unitCostMin,costMax:cost.unitCostMax,costRows:cost.costRows};};
 let rows=[],branches=[],manifest,failedBranches=[],sourceLabel,sourceTimes,sourceCount=1;
 if(config.stock==='warehouse'){
  if(branchId&&!sources.branches.some(b=>b.id===branchId))throw promotionError('ไม่พบสาขาปลายทาง');
  const taken=new Map();for(const activity of await context.activities()){if(!['planned','completed'].includes(activity.status)||activity.stockSettled)continue;for(const line of activity.items)taken.set(line.inventoryId,(taken.get(line.inventoryId)||0)+line.qty);}
  rows=sources.inventory.items.filter(p=>p.productType!=='FREE').map(p=>({...finance(p),key:'warehouse:'+p.id,inventoryId:p.id,sku:p.sku,branchId:'',branchName:'คลังรวม',source:p.source,sourceCount:1,available:Math.max(0,Math.floor(p.available-(taken.get(p.id)||0))),hold:0,updatedAt:sources.inventory.sources.find(s=>s.source===p.source)?.updatedAt||null}));
  branches=sources.branches;sourceLabel='คลังรวม · Scaleup + PIVOT';sourceTimes=sources.inventory.sources;
  try{manifest=await context.manifest();}catch{manifest={period:context.period,branches:[],products:[]};}
 }else{
  // Use the identical adapter and normal quantities as the Stock สาขา tab.
  const catalog=await context.branchStock('');branches=catalog.branches.filter(b=>promotionBranchFamily(b)===config.family);
  if(branchId&&!branches.some(b=>b.id===branchId))throw promotionError('สาขานี้ไม่ตรงกับประเภทโปรโมชั่น');
  const selected=branches.filter(b=>!branchId||b.id===branchId),ids=selected.map(b=>b.id);sourceCount=selected.length;
  const data=ids.length?await context.branchStock(ids.join(',')):{skuTotals:[],lastUpdatedAt:catalog.lastUpdatedAt};
  rows=data.skuTotals.map(p=>({...finance(p),key:'branch:'+ids.slice().sort().join(',')+':'+p.sku,sku:p.sku,branchId,branchName:branchId?selected[0].name:'รวม '+config.label,source:'branch',sourceCount:Math.max(1,sourceCount),available:Math.max(0,Math.floor(p.normal)),hold:Math.max(0,p.hold),updatedAt:data.lastUpdatedAt}));
  manifest={period:context.period,branches:selected,products:catalog.products||[]};
  sourceLabel=channel==='event_gp'?'แท็บสต็อกสาขา · Department ต้นทาง':'แท็บสต็อกสาขา · '+config.label;sourceTimes=[{label:'Stock สาขา',updatedAt:data.lastUpdatedAt}];
 }
 const history=await context.history(manifest.period),forecast=applyPromotionHistory(rows,manifest,history,manifest.branches.map(b=>b.id));
 if(config.stock==='warehouse')forecast.basis='DOH คลังเทียบอัตราขายรวมทุกสาขา · ไม่ใช่ประวัติขายของ Event';
 return {channel,branchId,rows:groupPromotionModels(rows),branches,sourceLabel,sources:sourceTimes,sourceCount,failedBranches,forecast,fetchedAt:new Date().toISOString(),granularity:'model',costBasis:'ต้นทุนรวม VAT จากแท็บต้นทุนสินค้า · ใช้ค่าเฉลี่ยช่วงต่ำสุด–สูงสุดเมื่อมีหลายต้นทุน'};
}
export async function savePromotionPlan(request,env,context,permissions){
 if(!permissions.canEdit)throw promotionError('สิทธิ์ดูอย่างเดียว',403);
 const raw=await request.text();if(raw.length>150000)throw promotionError('ข้อเสนอมีขนาดใหญ่เกินไป',413);let input;try{input=JSON.parse(raw);}catch{throw promotionError('ข้อมูลไม่ถูกต้อง');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw promotionError('ข้อมูลไม่ถูกต้อง');
 let existing=null,previousPayload=null;
 if(input.id!==undefined){
  if(typeof input.id!=='string'||!input.id||input.id.length>100)throw promotionError('รหัสข้อเสนอไม่ถูกต้อง');
  const record=await env.DB.prepare('SELECT payload FROM promotion_plans WHERE id = ?').bind(input.id).first();
  if(!record)throw promotionError('ไม่พบข้อเสนอที่ต้องการแก้ไข',404);
  previousPayload=record.payload;existing=JSON.parse(previousPayload);
  if(!['draft','proposed'].includes(existing.status)||existing.approval!=='unapproved')throw promotionError('แก้ไขได้เฉพาะร่างหรือข้อเสนอที่ยังไม่อนุมัติ',409);
  if(input.expectedVersion!==(existing.revision||1))throw promotionError('ข้อเสนอนี้มีการแก้ไขแล้ว กรุณาเปิดข้อมูลล่าสุดก่อนบันทึก',409);
 }
 const rawConditions=input.conditions===undefined?(existing?.conditions||''):input.conditions;
 if(typeof rawConditions!=='string'||rawConditions.length>2000)throw promotionError('เงื่อนไขโปรโมชั่น / ของแถม ต้องเป็นข้อความไม่เกิน 2,000 ตัวอักษร');
 const conditions=rawConditions.trim();
 let name=promotionText(input.name,160);
 const month=promotionText(input.month,7),channel=promotionText(input.channel),branchId=promotionText(input.branchId),scope=input.scope;
 if(!name||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||!Object.hasOwn(promotionChannels,channel)||!['all','branch'].includes(scope)||scope==='branch'&&!branchId||scope==='all'&&branchId)throw promotionError('กรุณาระบุชื่อ เดือน และขอบเขตให้ครบ');
 if(!['draft','proposed'].includes(input.status))throw promotionError('สถานะข้อเสนอไม่ถูกต้อง');
 let policy;try{policy=validatePromotionPolicy(input.policy);}catch(e){throw promotionError(e.message);}
 if(input.policyConfirmed!==true)throw promotionError('กรุณายืนยันว่าได้ตรวจเกณฑ์จำลองสำหรับข้อเสนอนี้');
 const gp=input.gp===null||input.gp===''?null:input.gp;if(gp!==null&&(typeof gp!=='number'||!Number.isFinite(gp)||gp<0||gp>100))throw promotionError('GP ต้องอยู่ระหว่าง 0–100%');
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>200)throw promotionError('เลือกสินค้า 1–200 รายการ');
 const scheduleInput={month,promotionType:input.promotionType??existing?.promotionType??'general',startDate:input.startDate??existing?.startDate??'',endDate:input.endDate??existing?.endDate??'',eventId:input.eventId??existing?.event?.id??'',eventVersion:input.eventVersion};
 const scheduleError=promotionScheduleError(scheduleInput);if(scheduleError)throw promotionError(scheduleError);
 const event=scheduleInput.promotionType==='event'?await context.event(scheduleInput.eventId):null;
 const schedule=promotionSchedule(scheduleInput,event);
 if(event)name=promotionText(event.name,240);
 const stock=await promotionStock(context,channel,branchId);if(stock.failedBranches.length)throw promotionError('สต็อกบางสาขายังอ่านไม่ครบ กรุณาโหลดใหม่ก่อนบันทึก',409);
 const catalog=new Map(stock.rows.map(r=>[r.key,r])),seen=new Set();
 const lines=input.lines.map(line=>{const item=catalog.get(line.key);if(!item||seen.has(line.key))throw promotionError('สินค้าไม่มีในขอบเขตหรือเลือกซ้ำ');seen.add(line.key);if(!Number.isInteger(line.qty)||line.qty<1||line.qty>item.available)throw promotionError('สต็อกปัจจุบันไม่พอสำหรับ '+item.model+' กรุณาปรับจำนวน',409);const ceiling=recommendedDiscount(item,channel,policy);const error=promotionPricingError(line);if(error)throw promotionError(error+': '+item.model,409);return {...item,qty:line.qty,...promotionPricing(line),recommended:ceiling};});
 const now=new Date().toISOString(),plan={...schedule,id:existing?.id||crypto.randomUUID(),name,conditions,month,channel,scope,branchId,branchName:stock.branches.find(b=>b.id===branchId)?.name||'',status:input.status,policy,policyConfirmed:true,gp:['department','event_gp'].includes(channel)?gp:0,lines,sourceLabel:stock.sourceLabel,sources:stock.sources,createdAt:existing?.createdAt||now,updatedAt:now,revision:existing?(existing.revision||1)+1:1,approval:'unapproved',schemaVersion:2,forecast:stock.forecast,granularity:'model'};
 plan.totals=promotionTotals(lines,plan.gp);
 if(JSON.stringify(plan).length>1800000)throw promotionError('ข้อเสนอใหญ่เกินไป กรุณาแยกรุ่นหรือสาขา',413);
 if(existing){
  const result=await env.DB.prepare('UPDATE promotion_plans SET month = ?, payload = ? WHERE id = ? AND payload = ?').bind(month,JSON.stringify(plan),plan.id,previousPayload).run();
  if(Number(result.meta?.changes??result.changes)!==1)throw promotionError('ข้อเสนอนี้มีการแก้ไขแล้ว กรุณาเปิดข้อมูลล่าสุดก่อนบันทึก',409);
 }else await env.DB.prepare('INSERT INTO promotion_plans (id, month, created_at, payload) VALUES (?, ?, ?, ?)').bind(plan.id,month,now,JSON.stringify(plan)).run();
 return {plan};
}
