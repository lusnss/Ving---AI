import {eventDateRange} from './event-forecast.mjs';

const monthNames=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const monthShort=['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'];
export const validPromotionDate=value=>/^20\d{2}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export const validPromotionMonth=value=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(value||'');
const yearValue=value=>Number(value)>2400?Number(value)-543:Number(value);
function eventMonth(value,year){
 const text=String(value||'').trim(),iso=text.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
 if(iso){const result=yearValue(iso[1])+'-'+iso[2];return validPromotionMonth(result)?result:'';}
 const m=monthNames.indexOf(text)+1||monthShort.indexOf(text.replace(/[.\s]/g,''))+1||Number(text);
 return year>=2000&&year<=2099&&Number.isInteger(m)&&m>=1&&m<=12?`${year}-${String(m).padStart(2,'0')}`:'';
}
export function promotionEventOption(row){
 if(!row?.deletionKey||row.workflow?.status==='cancelled')return null;
 const rawMonth=row.input?.eventMonth||row.month,year=yearValue(row.sourceYear||(/^\d{4}-\d{2}$/.test(rawMonth||'')?String(rawMonth).slice(0,4):row.createdAt?.slice(0,4)));
 const recordedMonth=eventMonth(rawMonth,year),text=String(row.dates||row.date||'').trim().replace(/[–—]/g,'-').replace(/(\d)\.(?=\d)/g,'$1/');
 const iso=text.match(/^(20\d{2}-\d{2}-\d{2})(?:\s*(?:ถึง|-)\s*(20\d{2}-\d{2}-\d{2}))?$/);
 let range=row.startDate||row.endDate?{start:row.startDate,end:row.endDate}:iso?{start:iso[1],end:iso[2]||iso[1]}:/[,;]|และ/.test(text)?null:eventDateRange(text,year);
 if(!range&&recordedMonth&&/^\d{1,2}(?:\s*-\s*\d{1,2})?$/.test(text.trim()))range=eventDateRange(text.trim()+'/'+Number(recordedMonth.slice(5))+'/'+recordedMonth.slice(0,4),year);
 if(!validPromotionDate(range?.start)||!validPromotionDate(range?.end)||range.start>range.end)range=null;
 const category=['gp','direct'].includes(row.input?.channel)?row.input.channel:['gp','direct'].includes(row.category)?row.category:'';
 return {id:row.deletionKey,name:String(row.name||row.place||'Event').slice(0,240),place:String(row.place||'').slice(0,240),category,month:recordedMonth||range?.start.slice(0,7)||'',startDate:range?.start||'',endDate:range?.end||'',status:row.trade==='อนุมัติ'&&row.ceo==='อนุมัติ'?'อนุมัติแล้ว':row.trade==='ไม่อนุมัติ'||row.ceo==='ไม่อนุมัติ'?'ไม่อนุมัติ':'รออนุมัติ'};
}
export const promotionEventVersion=event=>JSON.stringify([event?.id,event?.month,event?.startDate,event?.endDate]);
export function promotionEventInMonth(event,month){
 if(!event||!validPromotionMonth(month))return false;
 return event.month===month||validPromotionDate(event.startDate)&&validPromotionDate(event.endDate)&&event.startDate<=event.endDate&&event.startDate.slice(0,7)<=month&&month<=event.endDate.slice(0,7);
}
export function promotionScheduleError({month,startDate='',endDate='',promotionType='general',eventId=''}){
 if(!validPromotionMonth(month))return 'กรุณาเลือกเดือนที่จัดโปรโมชั่น';
 if(!['general','event'].includes(promotionType))return 'หมวดโปรโมชั่นไม่ถูกต้อง';
 if(promotionType==='event'&&!eventId)return 'กรุณาเลือก Event ที่จัดโปรโมชั่น';
 if(!startDate&&!endDate)return '';
 if(!validPromotionDate(startDate)||!validPromotionDate(endDate))return 'กรุณาระบุวันที่เริ่มและสิ้นสุดให้ครบและถูกต้อง';
 if(startDate>endDate)return 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม';
 if(month<startDate.slice(0,7)||month>endDate.slice(0,7))return 'เดือนที่จัดต้องอยู่ในช่วงวันที่โปรโมชั่น';
 return '';
}
export function promotionSchedule(input,event=null){
 const data={month:input.month,promotionType:input.promotionType||'general',startDate:input.startDate||'',endDate:input.endDate||'',eventId:input.eventId||''};
 const error=promotionScheduleError(data);if(error)throw Object.assign(Error(error),{status:400});
 if(data.promotionType==='event'&&(!event||event.id!==data.eventId))throw Object.assign(Error('ไม่พบ Event นี้ กรุณาเลือก Event ใหม่'),{status:409});
 if(event&&input.eventVersion&&input.eventVersion!==promotionEventVersion(event))throw Object.assign(Error('กำหนดการ Event เปลี่ยนแล้ว กรุณากดดึงวันที่จาก Event อีกครั้ง'),{status:409,code:'event_schedule_changed'});
 if(data.promotionType==='event'&&!promotionEventInMonth(event,data.month))throw Object.assign(Error('Event นี้ไม่ได้จัดในเดือนที่เลือก กรุณาเลือก Event ใหม่'),{status:409});
 return {promotionType:data.promotionType,startDate:data.startDate,endDate:data.endDate,event:data.promotionType==='event'?event:null,scheduleSource:data.promotionType==='event'&&data.startDate===event.startDate&&data.endDate===event.endDate?'event':'manual'};
}
export function promotionScheduleText(plan){
 const date=value=>validPromotionDate(value)?new Date(value+'T00:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit',timeZone:'Asia/Bangkok'}):'';
 const range=plan.startDate&&plan.endDate?date(plan.startDate)+(plan.startDate===plan.endDate?'':' – '+date(plan.endDate)):'ยังไม่ระบุวันที่';
 return [plan.promotionType==='event'?'Event: '+(plan.event?.name||'ยังไม่ระบุงาน'):'โปรโมชั่นทั่วไป',range].join(' · ');
}
