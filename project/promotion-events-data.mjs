import {loadEventProposals} from './event-proposals-data.mjs';
import {listEventRequests} from './event-requests.mjs';
import {visibleProposals,eventProposalDetail} from './event-proposal-deletions.mjs';
import {promotionEventOption} from './out/assets/promotion-schedule.mjs';

export async function loadPromotionEvents(env){
 const [sheet,web]=await Promise.allSettled([loadEventProposals(env),listEventRequests(env)]),warnings=[];
 let rows=[];
 if(sheet.status==='fulfilled'){
  rows.push(...sheet.value.items.map(row=>({...row,sourceYear:2026})));
  if(sheet.value.source.status!=='online')warnings.push('ข้อมูล Event จากชีตอาจยังไม่ล่าสุด');
 }else warnings.push('ยังอ่าน Event จากชีตไม่ได้');
 if(web.status==='fulfilled'){
  rows.push(...web.value.items);
  if(web.value.status!=='online')warnings.push('ยังอ่าน Event ที่บันทึกในเว็บไม่ได้');
  if(web.value.truncated)warnings.push('แสดง Event จากเว็บล่าสุด 500 รายการ');
 }else warnings.push('ยังอ่าน Event ที่บันทึกในเว็บไม่ได้');
 rows=await visibleProposals(env,rows);
 const items=rows.map(promotionEventOption).filter(Boolean).sort((a,b)=>(b.month||'').localeCompare(a.month||'')||a.name.localeCompare(b.name,'th'));
 return {items,warnings};
}
export async function promotionEventDetail(env,id){
 const {item,source}=await eventProposalDetail(env,id);
 if(['stale','unavailable'].includes(source?.status))throw Object.assign(Error('ยังตรวจสอบกำหนดการ Event ล่าสุดไม่ได้ กรุณาลองอีกครั้ง'),{status:503});
 const event=promotionEventOption({...item,...(id.startsWith('sheet:')?{sourceYear:2026}:{})});
 if(!event)throw Object.assign(Error('Event นี้ยกเลิกแล้ว กรุณาเลือก Event ใหม่'),{status:409});
 return event;
}
