import { forecast, historyFor, identifyForecastVenue, historySignature, rowsForBaseline, baselineSelectionLabel } from './out/assets/event-predict-model.mjs';
import {eventFloors,eventTypes,validEventMonth,proposalScenarios,proposalScenarioIndex,pcShiftHours} from './out/assets/event-planning-fields.mjs';
import {eventImageIds,sameEventImages,resolveEventImages} from './event-images.mjs';
import {compensationProfilesFor} from './out/assets/event-compensation.mjs';
const requestError=(message,status=400)=>Object.assign(new Error(message),{status});
const safePlace=value=>{const s=String(value??'').trim();if(!s||s.length>120||/[<>\r\n]|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b|\b\d{13}\b/.test(s))throw requestError('กรุณาระบุชื่อสถานที่เท่านั้น ไม่ใส่ข้อมูลส่วนบุคคล');return s;};
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const requestFields=['mode','salesMode','channel','days','cogs','rent','gp','pc','shipping','other','targetMode','roiPercent','pcPercent','target','expectedSales','downside','upside','proposalDate','confirmBy','area','pcCount','pcCostMode','baselineMonth','eventSeries','eventName','eventLocation','pcStartTime','pcEndTime','proposalScenario','compensationMode','rateProfile','wageProfile','wageMode','incentiveMode','incentiveAmount','commissionMethod','compensationVersion'];
const requestInput=body=>{
 const input=Object.fromEntries(requestFields.map(k=>{const v=body.input?.[k]??(k==='roiPercent'?40:k==='pcPercent'?13:k==='baselineMonth'?'all':k==='proposalScenario'?'base':'');if(!['string','number'].includes(typeof v))throw requestError('รูปแบบข้อมูลไม่ถูกต้อง');return [k,v];}));
 const floor=body.input?.floor??'',month=body.input?.eventMonth??'',types=body.input?.eventTypes??[];
 if(floor!==''&&!eventFloors.includes(floor))throw requestError('กรุณาเลือกชั้น G, 1–5 หรือ Hall');
 if(month!==''&&(typeof month!=='string'||!validEventMonth(month)))throw requestError('กรุณาเลือกเดือนที่จัดให้ถูกต้อง');
 input.eventName=String(input.eventName).trim();
 if(input.eventName){try{input.eventName=safePlace(input.eventName);}catch{throw requestError('กรุณาระบุชื่องานไม่เกิน 120 ตัวอักษร โดยไม่ใส่ข้อมูลส่วนบุคคลหรือเครื่องหมาย < >');}}
 input.eventLocation=String(input.eventLocation).trim();
 const compatibleTypes=['CDS','RBS','CDS RBS',...eventTypes.filter(v=>!['CDS','RBS'].includes(v))];
 if(!Array.isArray(types)||types.length>compatibleTypes.length||types.some(value=>!compatibleTypes.includes(value)))throw requestError('กรุณาเลือกประเภทจากตัวเลือกที่กำหนด');
 if(input.eventSeries&&!['baan-suan'].includes(input.eventSeries))throw requestError('ประเภท Event พิเศษไม่ถูกต้อง');
 if(proposalScenarioIndex(input.proposalScenario)<0)throw requestError('กรุณาเลือกกรณีที่เสนออนุมัติ');
 if(input.pcStartTime||input.pcEndTime){if(pcShiftHours(input.pcStartTime,input.pcEndTime)===null)throw requestError('กรุณาระบุเวลาเริ่มและเลิกงาน PC ให้ครบและไม่เป็นเวลาเดียวกัน');}
 return {...input,proposalScenario:input.proposalScenario||'base',floor,eventMonth:month,eventTypes:compatibleTypes.filter(value=>types.includes(value))};
};
export function prepareEventRequest(body,dataset,now=new Date()) {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id||''))throw requestError('รหัสคำขอไม่ถูกต้อง');
 const place=safePlace(body.place),start=String(body.startDate||''),end=String(body.endDate||'');
 if(!validDate(start)||!validDate(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>365)throw requestError('กรุณาระบุวันเริ่มและวันสิ้นสุดของ Event ให้ถูกต้อง');
 const input=requestInput(body);
 if(!validDate(input.proposalDate)||!validDate(input.confirmBy)||input.confirmBy<input.proposalDate)throw requestError('กรุณาระบุวันที่เสนอและวันสุดท้ายที่ต้องคอนเฟิร์มให้ถูกต้อง');
 if(!['history','manual'].includes(input.mode)||!['manual','history','roi','pc','roi-pc'].includes(input.targetMode))throw requestError('รูปแบบคำนวณไม่ถูกต้อง');
 if(input.salesMode&&!(input.salesMode==='cost-target'&&input.mode==='manual'))throw requestError('รูปแบบคำนวณยอดขายไม่ถูกต้อง');
 const venue=identifyForecastVenue(place),special=venue.id==='baan-suan';
 if(input.eventSeries&&!special)throw requestError('ชื่อ Event ไม่ตรงกับประเภทบ้านและสวน');
 if(special){input.eventSeries='baan-suan';input.eventLocation=safePlace(input.eventLocation);}else if(input.eventLocation)throw requestError('ระบุสถานที่เพิ่มเติมได้เฉพาะบ้านและสวน');
 if(input.compensationMode){
  if(input.compensationMode!=='catalog')throw requestError('วิธีคิดค่าแรงและ Incentive ไม่ถูกต้อง');
  const allowed=compensationProfilesFor(place,input.eventLocation).map(p=>p.id);
  if([input.rateProfile,input.wageProfile].some(id=>id&&!allowed.includes(id)))throw requestError('เรทอ้างอิงไม่ตรงกับสถานที่จัดงาน');
  input.startDate=start;input.endDate=end;
 }
 input.pcHoursPerDay=pcShiftHours(input.pcStartTime,input.pcEndTime);
 const today=new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
 const rows=input.mode==='manual'?[]:historyFor(dataset.records,venue.id,null,today);
 const signature=input.mode==='manual'?'manual':historySignature(rows);
 if(body.referenceKey!==signature)throw Object.assign(requestError('ประวัติเปลี่ยนแล้ว กรุณาตรวจตัวเลขล่าสุดก่อนขออนุมัติอีกครั้ง',409),{code:'history_changed'});
 const result=forecast(rows,input);
 if(result.errors.length||!result.costReady||result.base.sales===null||result.base.roi===null)throw requestError('กรุณากรอกยอดขายและต้นทุนให้ครบก่อนขออนุมัติ');
 if(Number(input.days)!==(Date.parse(end)-Date.parse(start))/86400000+1)throw requestError('จำนวนวันขายต้องตรงกับช่วงวันที่จัดงาน');
 const selected=result.scenarios[proposalScenarioIndex(input.proposalScenario)];
 if(selected?.sales===null||selected?.profit===null||selected?.roi===null)throw requestError('กรณีที่เลือกยังคำนวณไม่ครบ กรุณาตรวจยอดขายและต้นทุน');
 result.proposalScenario=input.proposalScenario;result.proposed=selected;
 return {id:body.id,createdAt:now.toISOString(),source:'web',forecastPlace:place,place:special?input.eventLocation:place,name:input.eventName||(special?'บ้านและสวน':place),eventLocation:input.eventLocation,pcStartTime:input.pcStartTime,pcEndTime:input.pcEndTime,pcHoursPerDay:input.pcHoursPerDay,proposalScenario:input.proposalScenario,dates:start+' ถึง '+end,startDate:start,endDate:end,proposalDate:input.proposalDate,confirmBy:input.confirmBy,month:input.eventMonth||start.slice(0,7),floor:input.floor,eventTypes:input.eventTypes,days:String(input.days),area:String(input.area),pc:String(input.pcCount),sales:String(Math.round(selected.sales*100)/100),profit:String(Math.round(selected.profit*100)/100),margin:selected.sales>0?(selected.profit/selected.sales*100).toFixed(2)+'%':'—',roi:selected.roi.toFixed(2)+'%',target:result.target?String(Math.round(result.target.sales*100)/100):'',trade:'รออนุมัติ',ceo:'รออนุมัติ',input,calculation:result,reference:{signature,label:baselineSelectionLabel(rows,input.baselineMonth),baselineMonth:input.baselineMonth||'all',fetched_at:dataset.source?.fetched_at||null,status:dataset.source?.status||null,rows:rowsForBaseline(rows,input.baselineMonth).filter(r=>r.usable).map(r=>({id:r.id,name:r.originalName||r.name,channel:r.channel,row:r.row,days:r.days,net:r.net,salesSource:r.salesSource||'google',range:r.range,sources:r.sources||[]}))}};
}
export async function createEventRequest(request,env,dataset,actor=null) {
 const origin=request.headers.get('origin');if(origin!==new URL(request.url).origin)throw requestError('คำขอต้องมาจากเว็บนี้',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw requestError('รูปแบบคำขอไม่ถูกต้อง',415);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>12000)throw requestError('ข้อมูลคำขอเกินขนาด',413);
 let body;try{body=JSON.parse(raw);}catch{throw requestError('ข้อมูลคำขอไม่ถูกต้อง');}
 if(!body||typeof body!=='object')throw requestError('ข้อมูลคำขอไม่ถูกต้อง');
 if(!env.DB)throw requestError('ระบบรับคำขอยังไม่พร้อม กรุณาลองส่งใหม่ภายหลัง',503);
 if(!/^[0-9a-f-]{36}$/i.test(body.id||''))throw requestError('รหัสคำขอไม่ถูกต้อง');
 const existing=await env.DB.prepare('SELECT payload FROM event_requests WHERE id = ?').bind(body.id).first();
 if(existing){const saved=JSON.parse(existing.payload);if((saved.forecastPlace||saved.place)!==safePlace(body.place)||saved.startDate!==body.startDate||saved.endDate!==body.endDate||JSON.stringify(requestInput({input:saved.input}))!==JSON.stringify(requestInput(body))||saved.reference.signature!==body.referenceKey||!sameEventImages(saved.attachments,body.attachments))throw requestError('คำขอนี้เคยบันทึกด้วยข้อมูลอื่น กรุณาเริ่มคำขอใหม่',409);return {ok:true,id:saved.id,url:'/event-proposals?request='+encodeURIComponent(saved.id)};}
 const record={...prepareEventRequest(body,dataset),attachments:await resolveEventImages(env,body.id,body.attachments),createdBy:actor,submittedBy:actor};
 await env.DB.prepare('INSERT INTO event_requests (id, created_at, payload) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(record.id,record.createdAt,JSON.stringify(record)).run();
 const saved=await env.DB.prepare('SELECT payload FROM event_requests WHERE id = ?').bind(record.id).first();
 if(!saved)throw requestError('ยังบันทึกคำขอไม่สำเร็จ',503);
 const value=JSON.parse(saved.payload);
 if(value.place!==record.place||value.dates!==record.dates||JSON.stringify(value.input)!==JSON.stringify(record.input)||!sameEventImages(value.attachments,record.attachments))throw requestError('คำขอนี้เคยบันทึกด้วยข้อมูลอื่น กรุณาเริ่มคำขอใหม่',409);
 return {ok:true,id:value.id,url:'/event-proposals?request='+encodeURIComponent(value.id)};
}
export async function listEventRequests(env) {
 if(!env.DB)return {items:[],status:'unavailable'};
 try{const result=await env.DB.prepare("SELECT payload FROM event_requests WHERE NOT EXISTS (SELECT 1 FROM event_proposal_deletions WHERE event_proposal_deletions.id = 'web:' || event_requests.id) ORDER BY created_at DESC LIMIT 501").all();return {items:result.results.slice(0,500).map(r=>JSON.parse(r.payload)),status:'online',truncated:result.results.length>500};}catch{return {items:[],status:'unavailable'};}
}

export async function updateEventRequest(request,env,dataset,actor=null) {
 if(request.headers.get('origin')!==new URL(request.url).origin)throw requestError('คำขอต้องมาจากเว็บนี้',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw requestError('รูปแบบคำขอไม่ถูกต้อง',415);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>12000)throw requestError('ข้อมูลคำขอเกินขนาด',413);
 let body;try{body=JSON.parse(raw);}catch{throw requestError('ข้อมูลคำขอไม่ถูกต้อง');}
 if(!body||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id||''))throw requestError('รหัสคำขอไม่ถูกต้อง');
 if(!env.DB)throw requestError('ยังบันทึกการแก้ไขไม่ได้ กรุณาลองใหม่',503);
 const key='web:'+body.id;
 if(await env.DB.prepare('SELECT id FROM event_proposal_deletions WHERE id = ?').bind(key).first())throw requestError('Event นี้ถูกลบแล้ว',404);
 const stored=await env.DB.prepare('SELECT payload FROM event_requests WHERE id = ?').bind(body.id).first();
 if(!stored)throw requestError('ไม่พบข้อเสนอที่ต้องการแก้ไข',404);
 const saved=JSON.parse(stored.payload);
 if(!/^[0-9a-f-]{36}$/i.test(body.editToken||''))throw requestError('รหัสการแก้ไขไม่ถูกต้อง');
 const requestedImages=body.attachments===undefined?saved.attachments:body.attachments;
 eventImageIds(requestedImages);
 const same=sameEventImages(saved.attachments,requestedImages)&&(saved.forecastPlace||saved.place)===safePlace(body.place)&&saved.startDate===body.startDate&&saved.endDate===body.endDate&&JSON.stringify(requestInput({input:saved.input}))===JSON.stringify(requestInput(body))&&saved.reference.signature===body.referenceKey;
 if(saved.editToken===body.editToken&&same)return {ok:true,id:saved.id,url:'/event-proposals?request='+encodeURIComponent(saved.id)};
 if(body.revision!==(saved.updatedAt||saved.createdAt))throw requestError('รายการนี้มีการแก้ไขแล้ว กรุณาเปิดข้อเสนอใหม่เพื่อดูข้อมูลล่าสุดก่อนบันทึก',409);
 const record={...prepareEventRequest(body,dataset),attachments:await resolveEventImages(env,body.id,requestedImages),createdBy:saved.createdBy||saved.submittedBy||null,submittedBy:actor,createdAt:saved.createdAt,updatedAt:new Date(Math.max(Date.now(),Date.parse(saved.updatedAt||saved.createdAt)+1)).toISOString(),editToken:body.editToken};
 const payload=JSON.stringify(record);
 // Compare and swap plus approval reset run in one transaction. Deleted records cannot be restored by an edit.
 const results=await env.DB.batch([
  env.DB.prepare("UPDATE event_requests SET payload = ? WHERE id = ? AND payload = ? AND NOT EXISTS (SELECT 1 FROM event_proposal_deletions WHERE id = ?)").bind(payload,body.id,stored.payload,key),
  env.DB.prepare('DELETE FROM event_proposal_approvals WHERE id = ? AND EXISTS (SELECT 1 FROM event_requests WHERE id = ? AND payload = ?)').bind(key,body.id,payload)
 ]);
 if(!(results[0].meta?.changes??results[0].changes))throw requestError('รายการนี้เปลี่ยนแล้ว กรุณาเปิดข้อเสนอใหม่ก่อนบันทึก',409);
 return {ok:true,id:record.id,url:'/event-proposals?request='+encodeURIComponent(record.id)};
}
