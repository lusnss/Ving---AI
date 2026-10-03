import {bindStaffDropdown} from './event-staff.mjs';
import {eventPage,eventPageForPath} from './event-pages.mjs';
import {bindEventNavigation,syncEventNavigationLinks} from './event-navigation.mjs';
import {retainSchedule} from './event-logistics.mjs';
import {monthlyPnlMarkup} from './event-pnl-monthly.mjs';
import {eventPnlDetail} from './event-pnl.mjs';
import {escapeHtml as e} from './api.mjs';
import { overviewMarkup } from './events-overview.mjs';
import { monthlyEventChart } from './event-charts.mjs';
import { eventSalesMetrics } from './event-metrics.mjs';
import { normalizeEventMonth } from './event-months.mjs';
import {eventListMarkup,downloadDirectoryExcel,eventDirectoryModel} from './event-directory.mjs';
import {visibleEventCatalog} from './event-visibility.mjs';
import {approvedSchedule,combinedSchedule,scheduleHistory, scheduleMarkup, scheduleDetail, scheduleMonth, bangkokToday, scheduleModel} from './event-schedule.mjs';
const money=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2});
const amount=value=>value==null?'—':money.format(value);
function yearFor(data,year){return data.years?.[year]?String(year):Object.keys(data.years||{}).sort().at(-1);}
function topEventRows(items,year,asOf){return items.map((item,i)=>{
 const {days,dailySales}=eventSalesMetrics(item,year,year==='2026'?(asOf||''):null);
 return `<tr><td data-label="#">${i+1}</td><td data-label="Event"><strong>${e(item.name)}</strong>${item.venue?`<small>${e(item.venue)}</small>`:''}</td><td data-label="ยอดขาย">${amount(item.sales)}</td><td data-label="จำนวนวัน">${days??'—'}</td><td data-label="ยอดต่อวัน">${amount(dailySales)}</td></tr>`;
}).join('');}
function catalogYears(data,approval={},selectedYear){
 data=visibleEventCatalog(data,[...(approval.cancelled||[]),...(approval.items||[])]);
 const years={...data.years};
 for(const row of approval.schedule?.items||[])for(const date of [row.setupDate,row.startDate,row.endDate])if(date)years[date.slice(0,4)]??={items:[],summary:{},months:[],status_message:'ยังไม่มีข้อมูลยอดขายของปีนี้'};
 for(const item of approvedSchedule(approval.items||[])){
  if(!item.year)continue;
  const last=item.range?Number(item.range.end.slice(0,4)):item.year;
  for(let year=item.year;year<=last;year++)years[year]??={items:[],summary:{},months:[],status_message:'ยังไม่มีข้อมูลยอดขายของปีนี้'};
 }
 if(/^\d{4}$/.test(String(selectedYear))&&Number(selectedYear)>=2000&&Number(selectedYear)<=2100)years[selectedYear]??={items:[],summary:{},months:[],status_message:'ยังไม่มีข้อมูลยอดขายของปีนี้'};
 return {...data,years};
}
export function directoryItems(data,approval,year){
 return combinedSchedule([...(approval.items||[]),...(approval.cancelled||[])],scheduleHistory(data),year).filter(item=>item.range?item.range.start<=`${year}-12-31`&&item.range.end>=`${year}-01-01`:item.year===Number(year));
}
export function eventsMarkup(data,state={},approval={},pnl={}){
 data=catalogYears(data,approval,state.year);
 const year=yearFor(data,state.year),current=data.years?.[year];
 if(!current)return '<section class="card"><h1>Event</h1><p>ยังไม่มีข้อมูล Event</p></section>';
 return overviewMarkup({data,state,year,current,approval,monthlyPnl:monthlyPnlMarkup(eventDirectoryModel(directoryItems(data,approval,year),year).rows,year,pnl),topRows:topEventRows(current.top_events||[],year,current.as_of),list:eventListMarkup(directoryItems(data,approval,year),year,state,pnl)});
}
export async function render(root,services){
 if(root.dataset.staffSaving)return;
 const staffEpoch=root._staffEpoch;
 const openDetails=[...(root.querySelectorAll?.('[data-event-detail][open]')||[])].map(node=>node.dataset.eventDetail);
 const listScroll=root.querySelector?.('.event-list .table-wrap');
 const savedScroll={top:listScroll?.scrollTop||0,left:listScroll?.scrollLeft||0};
 const params=new URLSearchParams(globalThis.location?.search||'');
 let state={page:eventPageForPath(globalThis.location?.pathname)?.key||'overview',year:root.dataset.eventYear||params.get('year')||String(bangkokToday().slice(0,4)),month:normalizeEventMonth(root.dataset.eventMonth||params.get('eventMonth')),metric:root.dataset.eventMetric||params.get('metric')||'sales',scheduleMode:root.dataset.scheduleMode||params.get('schedule')||'timeline',scheduleMonth:scheduleMonth(root.dataset.scheduleMonth||params.get('month')),view:root.dataset.scheduleView||params.get('view')||'calendar',status:root.dataset.scheduleStatus||params.get('scheduleStatus')||'all',query:root.dataset.scheduleQuery||params.get('scheduleQuery')||'',day:root.dataset.scheduleDay||params.get('scheduleDay')||'',listQuery:root.dataset.eventListQuery||params.get('eventQuery')||'',listType:root.dataset.eventListType||params.get('eventType')||'all',listPlace:root.dataset.eventListPlace||params.get('eventPlace')||'all',listStatus:root.dataset.eventListStatus||params.get('eventStatus')||'all'};
 const [catalog,approvalResponse,pnl,scheduleResponse]=await Promise.all([services.events||services.api('/api/events'),services.approved||services.api('/api/events/approved').catch(()=>({items:[],unavailable:true,failures:['ยังตรวจสถานะอนุมัติไม่ได้ กรุณาลองอีกครั้ง']})),services.pnl||services.api('/api/profit-loss').catch(()=>({unavailable:true})),services.schedule||services.api('/api/events/schedule').catch(()=>({items:root._eventSchedule?.items||[],source:{...root._eventSchedule?.source,status:root._eventSchedule?'stale':'unavailable'}}))]);
 state.staffFilter=root.dataset.staffFilter||'all';
 state.staff=state.page==='calendar'?await services.api('/api/events/staff').catch(()=>({error:'โหลดแผนกำลังคนไม่สำเร็จ กรุณาลองใหม่'})):{};
 if(root.dataset.staffSaving||root._staffEpoch!==staffEpoch)return;
 const schedule=retainSchedule(scheduleResponse,root._eventSchedule);
 if(schedule.source?.status==='online')root._eventSchedule=schedule;
 let approval={...approvalResponse,schedule};
 if(approval.unavailable&&root._eventApproval){approval={...approval,items:root._eventApproval.items,cancelled:root._eventApproval.cancelled,retained:true};}
 else if(!approval.unavailable)root._eventApproval=approval;
 let data=catalogYears(catalog,approval,state.year);
 if(globalThis.document)document.title=eventPage(state.page).title+' · VING';
 function updateUrl(){const url=new URL(location.href);if(state.scheduleMode==='logistics')url.searchParams.set('schedule','logistics');else url.searchParams.delete('schedule');url.searchParams.set('year',state.year);if(state.month==='all')url.searchParams.delete('eventMonth');else url.searchParams.set('eventMonth',state.month);url.searchParams.set('month',state.scheduleMonth);if(state.view==='list')url.searchParams.set('view','list');else url.searchParams.delete('view');for(const [key,value] of Object.entries({eventQuery:state.listQuery,eventType:state.listType,eventPlace:state.listPlace,eventStatus:state.listStatus})){if(!value||value==='all')url.searchParams.delete(key);else url.searchParams.set(key,value);}for(const [key,value] of Object.entries({scheduleStatus:state.status,scheduleQuery:state.query,scheduleDay:state.day,metric:state.metric})){if(!value||value==='all'||key==='metric'&&value==='sales')url.searchParams.delete(key);else url.searchParams.set(key,value);}history.replaceState(null,'',url);syncEventNavigationLinks(root,state);}
 function remember(){root.dataset.staffFilter=state.staffFilter;root.dataset.scheduleMode=state.scheduleMode;root.dataset.eventListQuery=state.listQuery;root.dataset.eventListType=state.listType;root.dataset.eventListPlace=state.listPlace;root.dataset.eventListStatus=state.listStatus;root.dataset.scheduleMonth=state.scheduleMonth;root.dataset.scheduleView=state.view;root.dataset.scheduleStatus=state.status;root.dataset.scheduleQuery=state.query;root.dataset.scheduleDay=state.day;}
 function updatePlanner(focusSelector){
  remember();updateUrl();
  root.querySelector('.ev-planner').outerHTML=scheduleMarkup(approval,state,undefined,scheduleHistory(data));
  bindPlanner();
  if(focusSelector)root.querySelector(focusSelector)?.focus({preventScroll:true});
 }
 function changeScheduleMonth(month){state.scheduleMonth=scheduleMonth(month);state.day='';updatePlanner(`[data-schedule-month-button="${state.scheduleMonth}"]`);}
 function bindPlanner(){
  if(!root.querySelectorAll)return;
  root.querySelectorAll('[data-staff-filter]').forEach(button=>button.addEventListener('click',()=>{state.staffFilter=button.dataset.staffFilter;updatePlanner('[data-staff-filter="'+state.staffFilter+'"]');}));
  root.querySelector('[data-staff-retry]')?.addEventListener('click',async()=>{state.staff=await services.api('/api/events/staff').catch(()=>({error:'โหลดแผนกำลังคนไม่สำเร็จ กรุณาลองใหม่'}));state.staffMessage='';updatePlanner();});
  root.querySelectorAll('[data-staff-key]').forEach(button=>button.addEventListener('click',async()=>{
   if(state.staffBusy)return;
   const key=button.dataset.staffKey,name=button.dataset.staffName,previous=state.staff.items[key]||{names:[],revision:null};
   const names=previous.names.includes(name)?previous.names.filter(n=>n!==name):[...previous.names,name];
   root._staffEpoch=(root._staffEpoch||0)+1;root.dataset.staffSaving='true';state.staffBusy=true;state.staffMessage='กำลังบันทึก…';updatePlanner();
   try{const saved=await services.api('/api/events/staff',{method:'PUT',body:JSON.stringify({key,names,revision:previous.revision})});state.staff.items[key]=saved;state.staffMessage='บันทึกแล้ว';}
   catch(error){state.staffMessage=error.message+' · ยังไม่ได้บันทึกการเลือกครั้งนี้';state.staff.error='กรุณาโหลดแผนล่าสุดก่อนเลือกอีกครั้ง';}
   finally{delete root.dataset.staffSaving;state.staffBusy=false;updatePlanner();}
  }));
  root.querySelector('[data-schedule-mode]')?.addEventListener('change',event=>{state.scheduleMode=event.target.value;if(state.scheduleMode==='logistics')state.view='list';state.day='';state.status='all';updatePlanner('[data-schedule-mode]');});
  root.querySelectorAll('[data-schedule-month-button]').forEach(button=>button.addEventListener('click',()=>changeScheduleMonth(button.dataset.scheduleMonthButton)));
  root.querySelector('[data-schedule-month]')?.addEventListener('change',event=>{state.scheduleMonth=event.target.value;state.day='';updatePlanner('[data-schedule-month]');});
  root.querySelectorAll('[data-schedule-view]').forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.scheduleView;if(state.view==='calendar')state.day='';updatePlanner(`[data-schedule-view="${state.view}"]`);}));
  root.querySelector('[data-schedule-status]')?.addEventListener('change',event=>{state.status=event.target.value;updatePlanner('[data-schedule-status]');});
  root.querySelector('[data-schedule-search]')?.addEventListener('input',event=>{state.query=event.target.value;const start=event.target.selectionStart;updatePlanner('[data-schedule-search]');const input=root.querySelector('[data-schedule-search]');try{input.setSelectionRange(start,start);}catch{}});
  root.querySelectorAll('[data-schedule-day]').forEach(button=>button.addEventListener('click',()=>{state.day=button.dataset.scheduleDay;state.view='list';updatePlanner('[data-schedule-view="list"]');}));
  root.querySelector('[data-schedule-clear-day]')?.addEventListener('click',()=>{state.day='';updatePlanner('[data-schedule-month]');});
  root.querySelector('[data-schedule-reset]')?.addEventListener('click',()=>{state.query='';state.day='';state.status='all';updatePlanner('[data-schedule-search]');});
  root.querySelectorAll('[data-schedule-detail]').forEach(button=>button.addEventListener('click',()=>{const item=scheduleModel([...(approval.items||[]),...(approval.cancelled||[])],state,undefined,scheduleHistory(data),approval.schedule).items.find(item=>item.key===button.dataset.scheduleDetail);if(item){services.showDialog?.(scheduleDetail(item,undefined,state));bindStaffDropdown(document.querySelector('#app-dialog-body [data-staff-editor]'),item,state,{api:services.api,onSaving:()=>{root._staffEpoch=(root._staffEpoch||0)+1;root.dataset.staffSaving='true';},onSaved:()=>updatePlanner(),onFinished:()=>{delete root.dataset.staffSaving;}});}}));
  root.querySelectorAll('[data-schedule-step]').forEach(button=>button.addEventListener('click',()=>{
   const date=new Date(Date.UTC(Number(state.year),Number(state.scheduleMonth)-1+Number(button.dataset.scheduleStep),1));
   if(date.getUTCFullYear()<2000||date.getUTCFullYear()>2100)return;
   state.year=String(date.getUTCFullYear());state.scheduleMonth=String(date.getUTCMonth()+1);state.day='';state.month='all';data=catalogYears(catalog,approval,state.year);remember();updateUrl();paint();root.querySelector(`[data-schedule-step="${button.dataset.scheduleStep}"]`)?.focus({preventScroll:true});
  }));
  root.querySelector('[data-schedule-today]')?.addEventListener('click',()=>{const today=bangkokToday();state.year=today.slice(0,4);state.scheduleMonth=String(Number(today.slice(5,7)));state.day='';state.month='all';state.status='all';state.query='';data=catalogYears(catalog,approval,state.year);remember();updateUrl();paint();root.querySelector('[data-schedule-today]')?.focus({preventScroll:true});});
  root.querySelector('[data-schedule-retry]')?.addEventListener('click',async event=>{event.target.disabled=true;try{await render(root,{...services,approved:undefined,schedule:undefined});}catch{event.target.disabled=false;}});
 }
 function bindMonth(){
  root.querySelectorAll?.('[data-event-pnl]').forEach(button=>button.addEventListener('click',()=>{const item=eventDirectoryModel(directoryItems(data,approval,state.year),state.year,state).rows.find(item=>item.key===button.dataset.eventPnl);if(item)services.showDialog?.(eventPnlDetail(item,state.year,pnl));}));
  const repaintList=selector=>{remember();root.dataset.eventMonth=state.month;updateUrl();const current=data.years[state.year];root.querySelector('.event-list').outerHTML=eventListMarkup(directoryItems(data,approval,state.year),state.year,state,pnl);bindMonth();root.querySelector(selector)?.focus({preventScroll:true});};
  for(const [selector,key] of [['[data-event-month]','month'],['[data-event-list-type]','listType'],['[data-event-list-place]','listPlace'],['[data-event-list-status]','listStatus']])root.querySelector(selector)?.addEventListener('change',event=>{state[key]=event.target.value;repaintList(selector);});
  root.querySelector('[data-event-list-search]')?.addEventListener('input',event=>{state.listQuery=event.target.value;const start=event.target.selectionStart;repaintList('[data-event-list-search]');try{root.querySelector('[data-event-list-search]').setSelectionRange(start,start);}catch{}});
  root.querySelector('[data-event-list-reset]')?.addEventListener('click',()=>{state.month='all';state.listQuery='';state.listType='all';state.listPlace='all';state.listStatus='all';repaintList('[data-event-list-search]');});
  root.querySelector('[data-event-export]')?.addEventListener('click',()=>{const message=root.querySelector('[data-event-export-message]');try{const current=data.years[state.year];downloadDirectoryExcel(directoryItems(data,approval,state.year),state.year,state,pnl);message.textContent='ดาวน์โหลด Excel ตามตัวกรองที่เลือกแล้ว';}catch{message.textContent='ยังดาวน์โหลดไม่ได้ กรุณาลองอีกครั้ง';}});
 }
 function paint(focus=false){
  state.year=yearFor(data,state.year);root.dataset.eventYear=state.year;root.dataset.eventMonth=state.month;remember();root.innerHTML=eventsMarkup(data,state,approval,pnl);
  bindMonth();
  bindPlanner();
  bindEventNavigation(root);
  root.querySelectorAll?.('[data-event-metric]').forEach(button=>button.addEventListener('click',()=>{
   state.metric=button.dataset.eventMetric;root.dataset.eventMetric=state.metric;updateUrl();
   root.querySelector('[data-event-chart]').innerHTML=monthlyEventChart(data.years[state.year],state.metric);
   root.querySelectorAll('[data-event-metric]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventMetric===state.metric)));
  }));
  const select=root.querySelector('[data-event-year]');
  select?.addEventListener('change',()=>{state.year=select.value;state.month='all';state.day='';state.listPlace='all';updateUrl();paint(true);});
  if(focus)root.querySelector('[data-event-year]')?.focus();
 }
 paint();
 for(const key of openDetails){const detail=root.querySelector(`[data-event-detail="${key}"]`);if(detail)detail.open=true;}
 const listTable=root.querySelector('.event-list .table-wrap');if(listTable){listTable.scrollTop=savedScroll.top;listTable.scrollLeft=savedScroll.left;}
}
export const refreshReadonly=render;
