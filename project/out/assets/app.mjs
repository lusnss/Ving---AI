import {eventPageForPath} from './event-pages.mjs';
import {retainSchedule} from './event-logistics.mjs';
import {accessForRole} from './access-permissions.mjs';
import {startDraftProtection} from './workspace-drafts.mjs';
import './screen-capture.mjs';
import {installDataRefresh} from './data-refresh.mjs';
import { installSources } from './sources.mjs';
import { api, escapeHtml, refreshSnapshot } from './api.mjs';
import { salesFreshnessText } from './sales-freshness.mjs';
import {ensureRequiredMobilePush} from './iphone-push-gate.mjs';
import {installPageRecovery} from './page-recovery.mjs';
await ensureRequiredMobilePush();
const pageDrafts=startDraftProtection();

const app = document.querySelector('#app');
const PRODUCT_LABEL = 'หน้าหลัก';
document.title = PRODUCT_LABEL;
const toastNode = document.querySelector('#app-toast');
const dialog = document.querySelector('#app-dialog');
let dialogTrigger = null;

export function toast(message, error = false) {
  toastNode.textContent = message;
  toastNode.className = error ? 'error-box' : 'success-box';
  toastNode.hidden = false;
  toastNode.style.position = 'fixed';
  toastNode.style.right = '1rem';
  toastNode.style.bottom = '1rem';
  toastNode.style.zIndex = '80';
  window.setTimeout(() => { toastNode.hidden = true; }, 3500);
}

export function showDialog(html) {
  dialogTrigger = document.activeElement;
  document.querySelector('#app-dialog-body').innerHTML = html;
  dialog.showModal();
  dialog.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
}

dialog.addEventListener('click', (event) => { if (event.target.matches('[data-close-dialog]')) dialog.close(); });
dialog.addEventListener('close', () => { dialogTrigger?.focus?.(); dialogTrigger = null; });

import { installNotifications } from './notifications.mjs';
const updateNotifications=installNotifications({api,showDialog,toast});

installSources({showDialog});

const routes = [
  {test:path=>path==='/branch-profit',nav:'branch-profit',module:'./branch-profit.mjs'},
  { test: path => path === '/promotions', nav: 'activities', module: './promotions.mjs' },
  { test: path => path === '/stock-summary', nav: 'stock-summary', module: './stock-summary.mjs' },
  { test: path => path === '/activities', nav: 'activities', module: './activities.mjs' },
  { test: path => path === '/inventory', nav: 'inventory', module: './inventory.mjs' },
  { test: path => path === '/analysis', nav: 'analysis', module: './analysis.mjs' },
  { test: path => path === '/stock-report', nav: 'stock-report', module: './stock-report.mjs' },
  { test: path => path === '/stock-forecast', nav: 'stock-forecast', module: './stock-forecast.mjs' },
  { test: path => path === '/warehouse', nav: 'warehouse', module: './warehouse.mjs' },
  { test: path => path === '/branch-stock', nav: 'branch-stock', module: './branch-stock.mjs' },
  { test: (path) => path === '/' || path === '/content', nav: 'content', module: './content.mjs' },
  { test: (path) => path === '/news-desk', nav: 'news', module: './news.mjs' },
  { test: (path) => path === '/intel', nav: 'intel', module: './intel.mjs' },
  { test: (path) => path === '/profit-loss', nav: 'profit-loss', module: './profit-loss.mjs' },
  { test: (path) => path === '/sales' || path === '/summary', nav: 'summary', module: './summary.mjs' },
  { test: (path) => path === '/daily-sales', nav: 'daily-sales', module: './daily-sales.mjs' },
  { test: (path) => path === '/daily-comparison', nav: 'daily-comparison', live: 'comparison', module: './daily-comparison.mjs' },
  { test: (path) => path === '/contracts', nav: 'others', live: 'contracts', module: './contracts.mjs' },
  { test: (path) => path === '/product-costs', nav: 'others', live: 'product-costs', module: './product-costs.mjs' },
  { test: (path) => path === '/rebrand', nav: 'others', live: 'rebrand', module: './rebrand.mjs' },
  { test: (path) => !!eventPageForPath(path), nav: 'events', live: 'events', module: './events.mjs' },
  { test: (path) => path === '/event-proposals', nav: 'events', live: 'proposals', module: './event-proposals.mjs' },
  { test: (path) => path === '/jobs', nav: null, utility: 'jobs', module: './jobs.mjs' },
  { test: (path) => path === '/settings', nav: null, utility: 'settings', module: './settings.mjs' },
  { test: (path) => path === '/card', nav: null, module: './card.mjs' }
];

const route = routes.find((item) => item.test(location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/')) || routes[0];
if (route.nav) document.querySelector(`[data-nav="${route.nav}"]`)?.setAttribute('aria-current', 'page');
if (['stock-summary','inventory','warehouse','branch-stock','stock-forecast','stock-report'].includes(route.nav)) document.querySelector('[data-nav="stock"]')?.setAttribute('aria-current','page');
if (route.utility) document.querySelector(`[data-utility="${route.utility}"]`)?.setAttribute('aria-current', 'page');
for(const menu of document.querySelectorAll('.nav-menu')){
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
 document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
}
let pageReady=false,pageLoading=false,lastSuccessAt=null,currentSignature=null,updating=false;
const recovery=installPageRecovery(app,async()=>{if(pageLoading||updating)return;if(!pageReady)await renderPage();else{currentSignature=null;await updateLive(true);}});
function readStatus(data){
 if(data?.recovery?.stale||['stale','unavailable'].includes(data?.source?.status))recovery.show({stale:true,at:data.recovery?.lastSuccessAt||data.source?.fetched_at,readonly:!!data.recovery?.stale});
 else{lastSuccessAt=new Date().toISOString();recovery.clear();}
}
async function renderPage(){
 if(pageLoading)return;pageLoading=true;app.setAttribute('aria-busy','true');
 try {
  await pageDrafts.ready;
  const module = await import(route.module);
  const data=route.live==='proposals'?await api('/api/event-proposals'):null;
  const rendered=await module.render(app, { api, toast, showDialog,...(data?{proposals:data}:{}) });
  pageReady=true;readStatus(data||rendered);
  app.focus({ preventScroll: true });
  await updateNotifications().catch(()=>{});
 } catch (error) {
  if(error?.status===401||error?.status===403){app.replaceChildren();pageReady=false;}
  if(!pageReady&&app.textContent.trim()==='กำลังเปิดห้อง…')app.replaceChildren();
  recovery.show({error,stale:pageReady,at:lastSuccessAt});
 }finally{pageLoading=false;app.removeAttribute('aria-busy');}
}
await renderPage();

const relevant={content:['content_items','content_variants','publications','analytics_snapshots','wr_jobs'],news:['ca_candidates','wr_jobs','ca_sources','ca_post_log','ca_news_items'],intel:['intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','intel_scripts','wr_jobs'],summary:['daily-sales','events'],sales:['mall-sales'],'daily-sales':['daily-sales'],events:['events','daily-sales'],others:['contracts']};
function stable(value){return JSON.stringify(value,(key,v)=>['fetched_at','last_attempt_at','as_of'].includes(key)?undefined:v);}
async function updateLive(force=false){if(updating||pageLoading||(!force&&document.visibilityState==='hidden')||document.body.dataset.captureBusy||document.body.dataset.captureSelecting)return;if(!pageReady){await renderPage();return;}if(['branch-profit','stock-summary','activities','inventory','analysis','branch-stock','warehouse','stock-forecast','stock-report'].includes(route.nav)){if(force)await renderPage();return;}updating=true;const banner=document.querySelector('.readonly-banner');try{
 if(route.live==='contracts'){const data=await api('/api/contracts');readStatus(data);const signature=stable([data,new Date(Date.now()+7*3600000).toISOString().slice(0,10)]);banner.textContent=(data.permissions.canEdit?'จัดการสัญญาผ่านเว็บ':'สัญญาห้าง · ดูอย่างเดียว')+' · แก้ไขบนเว็บแล้ว '+data.web.edited+' สัญญา';if((force||currentSignature!==null)&&signature!==currentSignature){if(document.querySelector('dialog[open]')||app.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea'))return;const module=await import(route.module);const y=scrollY;await module.render(app,{api,toast,showDialog});window.scrollTo({top:y});}currentSignature=signature;return;}
 if(route.live==='comparison'){
  const module=await import(route.module);await module.refreshComparison(api);banner.textContent=module.comparisonFreshness();recovery.clear();return;
 }
 if(route.live==='events'){
  if(app.dataset.staffSaving)return;
  const [snapshot,approved,scheduleResponse]=await Promise.all([refreshSnapshot(),api('/api/events/approved'),api('/api/events/schedule').catch(()=>({items:app._eventSchedule?.items||[],source:{...app._eventSchedule?.source,status:app._eventSchedule?'stale':'unavailable'}}))]);
  const schedule=retainSchedule(scheduleResponse,app._eventSchedule);
  if(schedule.source?.status==='online')app._eventSchedule=schedule;
  const stampNode=app.querySelector('[data-schedule-source-stamp]');if(stampNode&&schedule.source?.fetched_at)stampNode.textContent='โหลดสำเร็จล่าสุด '+new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(schedule.source.fetched_at));
  readStatus(snapshot.recovery?.stale?snapshot:approved.failures?.length?{source:{status:'stale'}}:snapshot);
  const events=snapshot.data['/api/events'];
  const signature=stable([events,{items:approved.items,cancelled:approved.cancelled,failures:approved.failures},schedule,new Date(Date.now()+7*3600000).toISOString().slice(0,10)]);
  banner.textContent='Event · Timeline จากรายงานและงานอนุมัติ · วางแผนคนสำหรับ Set up / เก็บกลับ';
  if(signature!==currentSignature){
   if(document.querySelector('dialog[open]')||app.contains(document.activeElement)&&document.activeElement.matches('input,textarea'))return;
   const module=await import(route.module),y=scrollY,focus=document.activeElement;
   const focusKey=['scheduleMode','scheduleMonthButton','scheduleView','scheduleDay','scheduleDetail','scheduleStep','scheduleMonth','scheduleStatus','eventYear','eventMonth'].find(key=>focus?.dataset?.[key]!==undefined);
   const focusValue=focusKey?focus.dataset[focusKey]:null;
   if(app.dataset.staffSaving)return;
   await module.render(app,{api,events,approved,schedule,toast,showDialog});window.scrollTo({top:y});
   if(focusKey)[...app.querySelectorAll('button,select')].find(button=>button.dataset[focusKey]===focusValue)?.focus({preventScroll:true});
  }
  currentSignature=signature;return;
 }
 if(route.nav==='summary'){
  const data=await api('/api/summary');readStatus(data);const {extractedAt,live,...comparison}=data.comparison||{};const signature=stable([{...data,comparison:{...comparison,live:{status:live?.status}}},new Date(Date.now()+7*3600000).toISOString().slice(0,10)]);
  banner.textContent='Summary · ยอดขายจาก Daily report เทียบปี · Department จาก Sales Report · งบกำไร–ขาดทุน · Event';
  if(signature!==currentSignature){
   if(document.querySelector('dialog[open]')||app.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea'))return;
   const module=await import(route.module);const y=scrollY;await module.render(app,{api,summary:data,showDialog,toast});window.scrollTo({top:y});
  }
  currentSignature=signature;return;
 }
 if(route.live==='product-costs'){
  const data=await api('/api/product-costs'),module=await import(route.module);
  readStatus(data);banner.textContent=module.costFreshness(data);
  const signature=stable(data);
  if(signature!==currentSignature){const y=scrollY;await module.render(app,{api,showDialog,productCosts:data});window.scrollTo({top:y});}
  else {const status=app.querySelector('.pc-freshness');if(status)status.textContent=module.costFreshness(data);}
  currentSignature=signature;return;
 }
 if(route.live==='rebrand'){
  const data=await api('/api/rebrand');const module=await import(route.module);
  readStatus(data);banner.textContent='ดูอย่างเดียว · '+module.rebrandFreshness(data);
  const signature=stable(data);
  if(signature!==currentSignature){const y=scrollY;await module.render(app,{api,rebrand:data});window.scrollTo({top:y});}
  else {const status=app.querySelector('.rb-freshness');if(status)status.textContent=module.rebrandFreshness(data);}
  currentSignature=signature;return;
 }
 if(route.live==='proposals'){
  const data=await api('/api/event-proposals');const module=await import(route.module);
  if(data.recovery?.stale)readStatus(data);
  if(data.recovery?.stale)module.markUnavailable(app,data.recovery);
  banner.textContent='รายการเสนอ Event · '+module.proposalFreshness(data);
  const signature=stable(data);
  if(signature!==currentSignature){const y=scrollY;const applied=await module.render(app,{api,proposals:data});window.scrollTo({top:y});if(applied===false)return;}
  else {const status=app.querySelector('.proposal-freshness');if(status)status.textContent=module.proposalFreshness(data);}
  readStatus(data);
  currentSignature=signature;return;
 }
 const snapshot=await refreshSnapshot();readStatus(snapshot);const stamp=snapshot.syncedAt;const fresh=!snapshot.recovery?.stale&&stamp&&Date.now()-Date.parse(stamp)<120000;
 banner.textContent='ดูอย่างเดียว · '+(fresh?'อัปเดตอัตโนมัติ':'ต้นทางยังไม่ซิงก์ — แสดงข้อมูลล่าสุด')+' · ล่าสุด '+new Date(stamp||snapshot.exportedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 if(route.nav==='daily-sales')banner.textContent=salesFreshnessText(snapshot);
 const keys=relevant[route.nav]||['wr_jobs'];const values=route.nav==='profit-loss'?[await api('/api/profit-loss')]:keys.map(k=>snapshot.data['/api/'+k]);if(route.nav==='profit-loss'){const source=values[0].source;banner.textContent='ดูอย่างเดียว · งบกำไร–ขาดทุน · '+(source.status==='stale'?'เชื่อมต้นทางไม่ได้ — แสดงข้อมูลที่ดึงสำเร็จล่าสุด':'เชื่อมข้อมูลต้นทุนออนไลน์')+' · ดึงข้อมูล '+new Date(source.fetched_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});}
 const approvedSales=route.nav==='daily-sales'?await api('/api/events/approved').catch(()=>({items:[],unavailable:true})):null;
 if(approvedSales)values.push({items:approvedSales.items,cancelled:approvedSales.cancelled,unavailable:approvedSales.unavailable});
 const signature=route.nav==='daily-sales'?JSON.stringify([values,new Date(Date.now()+7*3600000).toISOString().slice(0,10)]):stable(values);
 if(currentSignature!==null&&signature!==currentSignature){if(document.querySelector('dialog[open],.daily-column-menu:popover-open')||app.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea'))return;const module=await import(route.module);const y=scrollY;await (module.refreshReadonly||module.render)(app,{api,toast,showDialog,approved:approvedSales});window.scrollTo({top:y});}
 currentSignature=signature;await updateNotifications();
 }catch(error){if(error?.status===401||error?.status===403){app.replaceChildren();pageReady=false;recovery.show({error});return;}recovery.show({error,stale:pageReady,at:lastSuccessAt,readonly:route.live==='proposals'});if(route.live==='proposals'){const module=await import(route.module);module.markUnavailable(app,{stale:true,lastSuccessAt});currentSignature=null;}if(route.nav==='summary'){const status=app.querySelector('.sum-live-status');if(status){status.classList.add('is-stale');status.textContent='เชื่อมต่อไม่ได้ · แสดงข้อมูลล่าสุดที่โหลดสำเร็จ';}currentSignature=null;}banner.textContent='ดูอย่างเดียว · เชื่อมต่อข้อมูลล่าสุดไม่ได้ — แสดงข้อมูลที่โหลดไว้';}finally{if(accessForRole(document.body.dataset.accessRole).canEdit)banner.textContent=banner.textContent.replace(/^ดูอย่างเดียว · /,(document.body.dataset.accessPosition||accessForRole(document.body.dataset.accessRole).label)+' · ');updating=false;}}
installDataRefresh({toast,onComplete:async()=>{
 await refreshSnapshot();currentSignature=null;
 await pageDrafts.checkpoint();
 if(pageDrafts.hasPending||document.querySelector('#app-dialog[open]')||app.querySelector('dialog[open],form')){toast('ข้อมูลต้นทางอัพเดทแล้ว กลับเข้าแท็บนี้หลังแก้ไขเสร็จเพื่อแสดงข้อมูลล่าสุด');return;}
 const y=scrollY,module=await import(route.module);
 if(module.refreshAfterData)await module.refreshAfterData(app,{api,toast,showDialog});
 else if(module.refreshReadonly)await module.refreshReadonly(app,{api,toast,showDialog});
 else await renderPage();
 window.scrollTo({top:y});
}});
if(pageReady)await updateLive();setInterval(()=>{if(!document.body.dataset.refreshBusy)updateLive();},route.live==='comparison'||route.nav==='summary'?5000:15000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!document.body.dataset.refreshBusy)updateLive();});
