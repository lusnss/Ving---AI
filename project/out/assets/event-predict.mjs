import {startDraftProtection} from './workspace-drafts.mjs';
import {createImageEditor} from './event-images.mjs';
import {ensureRequiredMobilePush} from './iphone-push-gate.mjs';
import {accessForRole} from './access-permissions.mjs';
import {eventFloors,eventTypes,validEventMonth,proposalScenarios,proposalScenarioIndex,pcShiftHours} from './event-planning-fields.mjs';
import {baselinePickerMarkup,baselineEventsMarkup} from './event-baseline.mjs';
import {costStatement} from './event-cost-statement.mjs';
import {compensationDefaults,compensationContext,compensationVenue,compensationVenues} from './event-compensation.mjs';
import {compensationPanelMarkup,compensationResultsMarkup} from './event-compensation-ui.mjs';
import {historyFor,defaultsFor,forecast,identifyVenue,identifyForecastVenue,baselineSelectionLabel,baselineMonthLabel,historicalTarget,historySignature,selectedDays,targetGoalsFor,targetGoalLabel} from './event-predict-model.mjs';
const e=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fmt=v=>v===null||v===undefined?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(v);
const pct=v=>v===null||v===undefined?'—':v.toLocaleString('th-TH',{maximumFractionDigits:1})+'%';
const labels={roiPercent:'เป้า ROI',pcPercent:'สัดส่วนค่าแรง PC',rateProfile:'รอบงานอ้างอิง',wageProfile:'เรทค่าแรงอ้างอิง',wageMode:'วิธีคิดค่าแรง',incentiveMode:'วิธีคิดค่าคอม',incentiveAmount:'ค่าคอมและโบนัสรวม',commissionMethod:'สมมติฐานค่าคอม',baselineMonth:'เดือนสำหรับ Baseline',days:'จำนวนวันขาย',cogs:'ต้นทุนสินค้า',rent:'ค่าเช่ารวม',gp:'GP',pc:'ค่า PC ต่อวัน',area:'ขนาดพื้นที่',pcCount:'จำนวน PC',pcCostMode:'วิธีคิดค่า PC',shipping:'ค่าขนส่งรวม',other:'ค่าใช้จ่ายอื่นรวม',expectedSales:'ยอดขายประมาณการ',downside:'ต่ำกว่าคาดการณ์',upside:'สูงกว่าคาดการณ์',channel:'รูปแบบพื้นที่'};
const canEdit=typeof document!=='undefined'&&accessForRole(document.body.dataset.accessRole).canEdit;
let venueTimer;
const knownVenues=()=>[...new Map([{id:'baan-suan',label:'บ้านและสวน',special:true},...compensationVenues(),...data.records.map(r=>identifyForecastVenue(r)).filter(v=>!v.unmapped)].map(v=>[v.id,v])).values()];
let data={records:[],source:{}},rows=[],input={},venue='',place='',mode='history',oldTarget=null,requestId=null,sending=false,manualCalculated=false,editing=null,loading=true,root;
let drafts,imageProposalId=crypto.randomUUID(),draftSubmitted=false,imageSaveTimer;
const imageEditor=createImageEditor(()=>{requestId=null;clearTimeout(imageSaveTimer);imageSaveTimer=setTimeout(saveDraftImages,0);});
async function saveDraftImages(){
 if(imageEditor.busy){imageSaveTimer=setTimeout(saveDraftImages,150);return;}
 try{await imageEditor.upload(editing?.id||imageProposalId,{set textContent(value){const node=root?.querySelector('.ei-status');if(node)node.textContent=value;}});drafts?.capture();const saved=await drafts?.flush();const node=root?.querySelector('.ei-status');if(node)node.textContent=saved?'บันทึกรูปในร่างแล้ว':'อัปโหลดรูปแล้ว · รอเก็บร่างในฐานข้อมูล';}
 catch(error){const node=root?.querySelector('.ei-status');if(node)node.textContent=error.message+' · กรุณาเปิดหน้านี้ไว้';}
}

export function freshness(v){return (v.source.status==='online'?'ข้อมูล Google Sheets':'ใช้ข้อมูลล่าสุดที่อ่านได้')+(v.source.fetched_at?' · '+new Date(v.source.fetched_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):' · ยังไม่มีข้อมูล');}
export async function render(app){
 await ensureRequiredMobilePush();
 drafts=startDraftProtection();await drafts.ready;app.dataset.draftManaged='';
 if(new URLSearchParams(location.search).has('proposal')){const {renderEventReview}=await import('./event-review.mjs');return renderEventReview(app);}
 root=app;editing=null;loading=true;imageEditor.load();document.title='คาดการณ์ Event · VING';
 app.dataset.mode=mode;
 app.innerHTML=`<div class="fp-heading"><div><p class="fp-eyebrow">VING / EVENT PLANNING</p><h1>คาดการณ์ Event</h1><p>วางแผนต้นทุน เห็นยอดขาย กำไร และ ROI ก่อนเสนอพื้นที่</p></div><a href="/event-proposals">รายการเสนอ Event <span aria-hidden="true">↗</span></a></div>
 <nav class="fp-step-nav" aria-label="ขั้นตอนวางแผน"><a href="#fp-search"><b>01</b> เลือกสถานที่</a><a href="#fp-assumptions" data-workspace-link aria-disabled="true"><b>02</b> ปรับแผนงาน</a><a href="#fp-results" data-workspace-link aria-disabled="true"><b>03</b> ดูผลคาดการณ์</a></nav>
 <section id="fp-search" class="fp-search"><div class="fp-search-top"><div class="fp-search-title"><span>01 /</span> เริ่มจากสถานที่จัดงาน</div><div class="fp-mode" role="group" aria-label="ฐานข้อมูลสถานที่"><button type="button" data-mode="history" aria-pressed="${mode==='history'}">สถานที่ที่มีประวัติ</button><button type="button" data-mode="manual" aria-pressed="${mode==='manual'}">พื้นที่ใหม่ · คำนวณเอง</button><button type="button" id="fp-baan-suan" aria-pressed="false">บ้านและสวน <span>Event พิเศษ</span></button></div></div><label for="fp-venue">สถานที่จัด Event</label><div class="fp-search-row"><input id="fp-venue" type="search" list="fp-venues" placeholder="ค้นหาชื่อห้างหรือสถานที่…" autocomplete="off" maxlength="120" aria-describedby="fp-venue-hint"><datalist id="fp-venues"></datalist><button id="fp-calculate" type="button">คำนวณ <span aria-hidden="true">→</span></button></div><p id="fp-venue-hint" role="status">พิมพ์ชื่อแล้วเลือกจากรายการ หรือกด Enter เพื่อคำนวณ</p><div id="fp-suggestions" class="fp-suggestions"></div><details class="fp-source-strip"><summary><span id="fp-source" role="status">กำลังอ่านข้อมูล…</span><span>แหล่งข้อมูล</span></summary><div id="fp-data-sources"></div></details></section>
 <div id="fp-workspace">${welcomeMarkup()}</div>`;
 const headingActions=document.createElement('div');headingActions.className='fp-heading-actions';headingActions.append(app.querySelector('.fp-heading>a'),app.querySelector('.fp-step-nav'));app.querySelector('.fp-heading').append(headingActions);
 for(const link of app.querySelectorAll('[data-workspace-link]'))link.onclick=ev=>{if(!root.querySelector(link.hash)){ev.preventDefault();root.querySelector('#fp-venue').focus();}};
 app.querySelector('#fp-venue').addEventListener('input',()=>{const field=app.querySelector('#fp-venue');field.removeAttribute('aria-invalid');clearTimeout(venueTimer);venueTimer=setTimeout(()=>{const query=field.value.trim();if(!editing&&query!==place&&knownVenues().some(v=>v.label.toLowerCase()===query.toLowerCase()))selectVenue();},250);});
 app.addEventListener('input',()=>{const status=app.querySelector('#fp-submit-status');if(!sending&&status?.classList.contains('fp-submit-error')){status.textContent='';status.classList.remove('fp-submit-error');}});
 app.querySelector('#fp-baan-suan').onclick=()=>{if(sending)return;mode='history';root.dataset.mode=mode;root.querySelector('#fp-venue').value='บ้านและสวน';selectVenue();};
 app.querySelector('#fp-calculate').onclick=selectVenue;
 app.querySelector('#fp-venue').addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();selectVenue();}});
 app.querySelector('#fp-venue').addEventListener('change',selectVenue);
 for(const button of app.querySelectorAll('[data-mode]'))button.onclick=()=>{if(sending)return;if(input.eventSeries==='baan-suan'){root.querySelector('#fp-venue').value='';input={};place='';venue='';}root.querySelector('#fp-baan-suan').setAttribute('aria-pressed','false');mode=button.dataset.mode;root.dataset.mode=mode;root.querySelector('#fp-suggestions').hidden=mode==='manual';root.querySelector('#fp-venue-hint').textContent=mode==='manual'?'กรอกชื่อพื้นที่ แล้วเริ่มวางแผนต้นทุนของงาน':'พิมพ์ชื่อแล้วเลือกจากรายการ หรือกด Enter เพื่อคำนวณ';for(const b of app.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b===button));const venueInput=app.querySelector('#fp-venue');venueInput.type=mode==='manual'?'text':'search';root.querySelector('#fp-calculate').textContent=mode==='manual'?'คาดการณ์':'คำนวณ';if(mode==='manual')venueInput.removeAttribute('list');else venueInput.setAttribute('list','fp-venues');venueInput.placeholder=mode==='manual'?'กรอกชื่อพื้นที่ใหม่':'เช่น เมกาบางนา, เซ็นทรัล ลาดพร้าว';if(app.querySelector('#fp-venue').value.trim())selectVenue();else {app.querySelector('#fp-workspace').innerHTML=welcomeMarkup();syncWorkspaceLinks();}};
 try{const r=await fetch('/api/event-predict',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('load');data=await r.json();const venues=knownVenues().sort((a,b)=>a.label.localeCompare(b.label,'th'));app.querySelector('#fp-venues').innerHTML=venues.map(v=>`<option value="${e(v.label)}"></option>`).join('');app.querySelector('#fp-source').textContent='ฐานสถานที่จากต้นทุนและ Sales Report · ค่าแรงจาก เรทEvent.xlsx';renderSources();renderSuggestions(venues);loading=false;if(root.querySelector('#fp-venue').value.trim()&&!new URLSearchParams(location.search).has('edit'))selectVenue();}catch{loading=false;app.querySelector('#fp-calculate').textContent='คำนวณ →';app.querySelector('#fp-source').textContent='ยังอ่านประวัติไม่ได้ · ใช้โหมดพื้นที่ใหม่ได้';app.querySelector('#fp-data-sources').innerHTML='<p>ลองอ่านข้อมูลอีกครั้ง หรือคำนวณพื้นที่ใหม่จากต้นทุนของคุณ</p><button id="fp-retry" type="button">ลองอ่านข้อมูลใหม่</button>';app.querySelector('#fp-retry').onclick=()=>render(app);app.querySelector('.fp-source-strip').open=true;}
 const editId=new URLSearchParams(location.search).get('edit');if(editId)await loadEditing(editId);
 await drafts.register('event-plan',{capture:()=>draftSubmitted?null:{input,venue,place,mode,oldTarget,requestId,manualCalculated,editing,imageProposalId,search:root.querySelector('#fp-venue').value,images:imageEditor.snapshot()},pending:()=>imageEditor.busy||imageEditor.hasPending,retry:()=>{if(!imageEditor.busy&&imageEditor.hasPending)saveDraftImages();},restore:saved=>{
  if(!saved)return;draftSubmitted=false;
  input=saved.input||{};venue=saved.venue||'';place=saved.place||'';mode=saved.mode||'history';oldTarget=saved.oldTarget;requestId=saved.requestId;manualCalculated=!!saved.manualCalculated;
  editing=saved.editing;imageProposalId=saved.imageProposalId||crypto.randomUUID();imageEditor.restore(saved.images||[]);
  rows=mode==='manual'?[]:historyFor(data.records,venue,null,new Date(Date.now()+7*3600000).toISOString().slice(0,10));
  root.dataset.mode=mode;syncSearchMode();root.querySelector('#fp-venue').value=saved.search||place;
  if(place)renderWorkspace();
 }});
}
function welcomeMarkup(){return `<section class="fp-welcome"><div><p class="fp-eyebrow">PLAN WITH CONFIDENCE</p><h2>${mode==='manual'?'เริ่มวางแผนพื้นที่ใหม่':'พื้นที่นี้ คุ้มค่าที่จะไปไหม?'}</h2><p>${mode==='manual'?'กรอกชื่อพื้นที่และต้นทุน แล้วเลือกเป้าหมาย ROI หรือค่าแรง PC':'เลือกสถานที่เพื่อใช้ยอดขายจากประวัติ แล้วปรับต้นทุนให้ตรงกับงานที่กำลังจะจัด'}</p></div><ol><li><div><strong>เลือกข้อมูลตั้งต้น</strong><span>ใช้ประวัติสถานที่ หรือคำนวณพื้นที่ใหม่</span></div></li><li><div><strong>กำหนดวันและต้นทุน</strong><span>ปรับค่าเช่า / GP ทีม PC และค่าใช้จ่าย</span></div></li><li><div><strong>ดูผลก่อนเสนออนุมัติ</strong><span>ยอดขาย กำไร ROI และจุดคุ้มทุน</span></div></li></ol></section>`;}
function syncWorkspaceLinks(){for(const link of root.querySelectorAll('[data-workspace-link]'))link.setAttribute('aria-disabled',String(!root.querySelector(link.hash)));}
function renderSuggestions(venues){
 const counts=new Map();for(const row of data.records){const v=identifyForecastVenue(row);counts.set(v.id,(counts.get(v.id)||0)+1);}
 const popular=[...venues].sort((a,b)=>(counts.get(b.id)||0)-(counts.get(a.id)||0)).slice(0,4);
 const container=root.querySelector('#fp-suggestions');container.hidden=mode==='manual';
 container.innerHTML=popular.length?'<span>เลือกจากประวัติ</span>'+popular.map(v=>`<button type="button" data-venue="${e(v.label)}">${e(v.label)}</button>`).join(''):'';
 for(const button of container.querySelectorAll('[data-venue]'))button.onclick=()=>{root.querySelector('#fp-venue').value=button.dataset.venue;selectVenue();};
}
function submitError(message,selector){
 const status=root.querySelector('#fp-submit-status');status.textContent=message;status.classList.add('fp-submit-error');
 const field=selector&&root.querySelector(selector);if(field){const panel=field.closest('.fp-form-panel');if(panel?.hidden)root.querySelector('[aria-controls="'+panel.id+'"]').click();field.setAttribute('aria-invalid','true');field.focus({preventScroll:true});field.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}
}

async function loadEditing(id){
 const searchControls=[...root.querySelectorAll('.fp-search input,.fp-search button')];searchControls.forEach(el=>el.disabled=true);
 root.querySelector('#fp-workspace').innerHTML='<section class="fp-empty" role="status">กำลังเปิดข้อเสนอเดิม…</section>';
 try{
  const response=await fetch('/api/event-proposals/detail?key='+encodeURIComponent('web:'+id),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'ยังเปิดข้อเสนอไม่ได้');
  if(!canEdit||!result.permissions?.canEdit)throw Error('บทบาทนี้ไม่มีสิทธิ์แก้ไขข้อเสนอ');
  const saved=result.item;if(saved.source!=='web'||!saved.input)throw Error('รายการนี้ไม่มีข้อมูลสำหรับแก้ไข');
  imageEditor.load(saved.attachments||[],saved.id);
  editing={id:saved.id,revision:saved.updatedAt||saved.createdAt};place=saved.forecastPlace||saved.place;venue=identifyForecastVenue(place).id;mode=saved.input.mode;root.dataset.mode=mode;root.querySelector('#fp-suggestions').hidden=mode==='manual';
  input={...saved.input,roiPercent:saved.input.roiPercent??40,pcPercent:saved.input.pcPercent??14,targetMode:saved.input.targetMode==='roi-pc'?'roi':saved.input.targetMode,targetInitialized:true,startDate:saved.startDate,endDate:saved.endDate,floor:saved.input.floor||'',eventTypes:(saved.input.eventTypes||[]).filter(value=>eventTypes.includes(value)),eventMonth:saved.input.eventMonth||saved.month||saved.startDate?.slice(0,7)||''};
  rows=mode==='manual'?[]:historyFor(data.records,venue,null,new Date(Date.now()+7*3600000).toISOString().slice(0,10));
  oldTarget=historicalTarget(rows,input.channel)||(input.targetMode==='history'?{value:Number(input.target),days:input.days,row:'ข้อเสนอเดิม'}:null);requestId=null;manualCalculated=true;
  syncSearchMode();
  root.querySelector('.fp-heading h1').textContent='แก้ไขข้อเสนอ Event';root.querySelector('#fp-venue').value=place;
  renderWorkspace();if((saved.input.eventTypes||[]).includes('CDS RBS')){root.querySelector('.fp-event-types').insertAdjacentHTML('beforeend','<p class="fp-hint">ประเภทเดิมระบุ CDS RBS รวมกัน กรุณาเลือก CDS และ/หรือ RBS ให้ตรงกับงานนี้</p>');}searchControls.forEach(el=>el.disabled=false);
 }catch(error){root.querySelector('#fp-workspace').innerHTML=`<section class="fp-empty" role="alert"><h2>ยังเปิดข้อเสนอไม่ได้</h2><p>${e(error.message)}</p><button id="fp-edit-retry" type="button">ลองใหม่</button><a href="/event-proposals">กลับรายการเสนอ Event</a></section>`;root.querySelector('#fp-edit-retry').onclick=()=>loadEditing(id);}
}
function selectVenue(){
 if(sending)return;
 const query=root.querySelector('#fp-venue').value.trim();if(!query){root.querySelector('#fp-venue-hint').textContent='กรุณาเลือกหรือกรอกชื่อสถานที่ก่อนคำนวณ';root.querySelector('#fp-venue').setAttribute('aria-invalid','true');root.querySelector('#fp-venue').focus();return;}const previousPlace=place,previousMode=input.mode;if(identifyForecastVenue(query).special)mode='history';
 if(mode==='history'){
  if(loading){root.querySelector('#fp-calculate').textContent='กำลังอ่านข้อมูล…';return;}
  const known=knownVenues();const alias=compensationVenue(query)||identifyForecastVenue(query);const exact=known.find(v=>v.label.toLowerCase()===query.toLowerCase()||v.id===alias.id),matches=exact?[exact]:known.filter(v=>v.label.toLowerCase().includes(query.toLowerCase()));
  if(matches.length!==1){root.querySelector('#fp-venue').setAttribute('aria-invalid','true');root.querySelector('#fp-venue-hint').textContent=matches.length?'พบหลายสถานที่ กรุณาเลือกชื่อเต็มจากรายการ':'ยังไม่มีประวัติของสถานที่นี้';root.querySelector('#fp-workspace').innerHTML=`<section class="fp-empty" role="status"><h2>${matches.length?'เลือกสถานที่ให้ตรงกับงาน':'ยังไม่มีประวัติของสถานที่นี้'}</h2><p>${matches.length?'เลือกชื่อเต็มจากรายการแนะนำเพื่อคำนวณ':'คุณยังวางแผนงานได้ โดยกรอกต้นทุนของพื้นที่ใหม่'}</p><button type="button" id="fp-use-manual">คำนวณเป็นพื้นที่ใหม่ →</button></section>`;root.querySelector('#fp-use-manual').onclick=()=>root.querySelector('[data-mode="manual"]').click();syncWorkspaceLinks();return;}
  root.querySelector('#fp-venue').removeAttribute('aria-invalid');root.querySelector('#fp-venue-hint').textContent='ปรับวันและต้นทุนด้านล่าง ผลคาดการณ์จะคำนวณตามข้อมูลที่กรอก';
  venue=matches[0].id;place=matches[0].label;if(venue!=='baan-suan'&&!historyFor(data.records,venue,null,new Date(Date.now()+7*3600000).toISOString().slice(0,10)).some(r=>r.usable)){mode='manual';root.querySelector('#fp-venue-hint').textContent='มีเกณฑ์ค่าแรงจากไฟล์ แต่ยังไม่มีประวัติยอดขายที่ใช้ได้ · กรอกต้นทุนเพื่อคาดการณ์';}
 }else{place=query;venue=identifyForecastVenue(query).id;}
 root.querySelector('#fp-venue').value=place;
 if(previousPlace===place&&previousMode===mode&&root.querySelector('#fp-results')){if(mode==='manual')calculateManual();else renderResults();return;}
 const channels=data.records.filter(r=>identifyForecastVenue(r).id===venue).map(r=>r.channel);input={mode,eventName:'',eventSeries:venue==='baan-suan'?'baan-suan':'',eventLocation:'',pcStartTime:'',pcEndTime:'',proposalScenario:'base',floor:'',eventTypes:[],eventMonth:'',baselineMonth:'all',salesMode:mode==='manual'?'cost-target':'',channel:channels.includes('direct')?'direct':channels.includes('gp')?'gp':'direct',targetMode:'roi',roiPercent:40,pcPercent:13,cogs:22.5,gp:33,target:'',expectedSales:'',downside:10,upside:10,startDate:'',endDate:'',proposalDate:'',confirmBy:'',area:'',pcCount:'',pcCostMode:'total'};requestId=null;manualCalculated=false;setupDefaults();applyCompensation();syncSearchMode();renderWorkspace();if(matchMedia('(min-width: 861px)').matches)root.querySelector('#fp-assumptions').scrollIntoView({block:'start',behavior:'auto'});
}
function applyCompensation(profileId=''){
 const next=compensationDefaults(place,input.eventLocation,profileId);input={...input,...next};requestId=null;manualCalculated=false;syncCompensationWage();
}
function syncCompensationWage(){
 const context=compensationContext(input);
 if(context.active&&input.wageMode==='source'&&context.wage?.daily!=null){input.pc=context.wage.daily;input.pcCostMode='person';const field=root.querySelector('[data-fp-field="pc"]');if(field)field.value=input.pc;const select=root.querySelector('#fp-pc-mode');if(select)select.value='person';}
}
function renderCompensationPanel(){
 const panel=root.querySelector('#fp-compensation');if(!panel)return;
 panel.innerHTML=compensationPanelMarkup(input,place);
 const update=()=>{requestId=null;manualCalculated=false;syncCompensationWage();renderCompensationPanel();renderResults();};
 const upgrade=panel.querySelector('#fp-use-rate-catalog');if(upgrade)upgrade.onclick=()=>{applyCompensation();renderWorkspace();};
 const profile=panel.querySelector('#fp-rate-profile');if(profile)profile.onchange=()=>{const count=input.pcCount;applyCompensation(profile.value);if(count!=='')input.pcCount=count;renderWorkspace();};
 const reset=panel.querySelector('#fp-wage-reset');if(reset)reset.onclick=()=>{input.wageMode='source';input.pcCostMode='person';syncCompensationWage();requestId=null;manualCalculated=false;renderWorkspace();};
 const modeField=panel.querySelector('#fp-incentive-mode');if(modeField)modeField.onchange=()=>{input.incentiveMode=modeField.value;update();};
 const amount=panel.querySelector('#fp-incentive-amount');if(amount)amount.oninput=()=>{input.incentiveAmount=amount.value;requestId=null;manualCalculated=false;renderResults();};
 const method=panel.querySelector('#fp-commission-method');if(method)method.onchange=()=>{input.commissionMethod=method.value;update();};
}
function syncSearchMode(){
 const special=input.eventSeries==='baan-suan';root.dataset.mode=mode;
 for(const button of root.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(!special&&button.dataset.mode===mode));
 root.querySelector('#fp-baan-suan').setAttribute('aria-pressed',String(special));
 const field=root.querySelector('#fp-venue');field.type=mode==='manual'?'text':'search';if(mode==='manual')field.removeAttribute('list');else field.setAttribute('list','fp-venues');
 root.querySelector('#fp-calculate').textContent=mode==='manual'?'เริ่มวางแผน':'คำนวณ →';
}
function renderPcShift(){
 const output=root.querySelector('#fp-pc-hours');if(!output)return;
 const hours=pcShiftHours(input.pcStartTime,input.pcEndTime);input.pcHoursPerDay=hours;
 output.textContent=hours===null?(input.pcStartTime||input.pcEndTime?'ระบุเวลาเริ่มและเลิกงานให้ครบ และไม่เป็นเวลาเดียวกัน':'ระบุเวลาทำงานของทีม PC ต่อวัน'):new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(hours)+' ชั่วโมง / วัน'+(input.pcEndTime<input.pcStartTime?' · เลิกงานวันถัดไป':'');
}
function renderProposalChoice(r){
 const container=root.querySelector('#fp-proposal-choice');if(!container)return;
 const ready=r.costReady&&r.base.sales!==null,index=proposalScenarioIndex(input.proposalScenario),selected=r.scenarios[index];
 container.innerHTML=`<fieldset><legend>เลือกกรณีที่ใช้เสนออนุมัติ</legend><div class="fp-proposal-cases">${proposalScenarios.map((s,i)=>`<label><input type="radio" name="proposal-scenario" value="${s.id}" ${i===index?'checked':''}><span>${mode==='manual'&&input.salesMode==='cost-target'?['ต่ำกว่าเป้า ','เป้า ','สูงกว่าเป้า '][i]+targetGoalLabel(input):s.label}<b>${ready&&r.scenarios[i].sales!==null?'฿'+fmt(r.scenarios[i].sales):'—'}</b></span></label>`).join('')}</div></fieldset><p class="fp-hint">กรณีที่เลือกจะเป็นยอดหลักในรายการเสนอและหน้าอนุมัติ · เก็บทั้ง 3 กรณีไว้เปรียบเทียบ</p><div class="fp-proposal-preview"><span>ยอดที่จะเสนอ <strong>${ready&&selected?.sales!==null?'฿'+fmt(selected.sales):'—'}</strong></span><span>กำไร <strong>${ready&&selected?.profit!==null?'฿'+fmt(selected.profit):'—'}</strong></span><span>ROI <strong>${ready?pct(selected?.roi):'—'}</strong></span></div>`;
 for(const radio of container.querySelectorAll('input'))radio.onchange=()=>{input.proposalScenario=radio.value;requestId=null;renderResults();root.querySelector('input[name="proposal-scenario"]:checked').focus({preventScroll:true});};
 for(const card of root.querySelectorAll('[data-scenario-card]'))card.classList.toggle('fp-proposed',Number(card.dataset.scenarioCard)===index);
}

function setupDefaults(){
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);rows=mode==='manual'?[]:historyFor(data.records,venue,null,today);
 const defaults=defaultsFor(rows.filter(r=>r.channel===input.channel));input={...input,...Object.fromEntries(Object.entries(defaults).filter(([k])=>!['cogs','gp'].includes(k)).map(([k,v])=>[k,v===null?'':Number(v.toFixed(k==='days'?0:2))]))};
 input.cogs=input.cogs??22.5;input.gp=input.gp??33;
 if(input.startDate||input.endDate)input.days=selectedDays(input.startDate,input.endDate)??'';
 oldTarget=historicalTarget(rows,input.channel);if(!input.targetInitialized){input.targetMode='roi';input.target='';input.targetInitialized=true;}
}
function targetMarkup(){
 const goals=targetGoalsFor(input);
 return `<section class="fp-target" aria-labelledby="fp-target-heading"><h2 id="fp-target-heading">เป้าหมายของ Event</h2><fieldset class="fp-target-goals"><legend>เลือกได้ครั้งละ 1 เป้าหมาย · ปรับเปอร์เซ็นต์ได้</legend>${[['roi','ROI','กำไรเทียบกับต้นทุนรวม','roiPercent',40],['pc','ค่าแรง PC',input.compensationMode==='catalog'?'ค่าแรง + ค่าคอม + โบนัส เทียบกับยอดขายหลังส่วนลด':'ค่า PC เทียบกับยอดขายหลังส่วนลด','pcPercent',13]].map(([goal,title,hint,key,initial])=>`<div class="fp-goal-card"><label><input type="radio" name="event-target-goal" data-target-goal value="${goal}" ${goals.includes(goal)?'checked':''}><span><strong>${title}</strong><small>${hint}</small></span></label><label class="fp-goal-rate">${title} %<input data-fp-field="${key}" aria-label="${labels[key]}" type="number" min="${goal==='pc'?'0.01':'0'}" max="${goal==='pc'?'100':'10000'}" step="any" value="${e(input[key]??initial)}"><small>ค่าเริ่มต้น ${initial}% · ปรับได้</small></label><b id="fp-${goal}-goal-value"></b></div>`).join('')}</fieldset><label for="fp-target">ยอดขายเป้าหมายหลังส่วนลด · บาท / งาน</label><input id="fp-target" aria-label="เป้าหมายยอดขาย" aria-describedby="fp-target-note" type="number" min="0" max="10000000000" step="5000" placeholder="เลือกเป้าหมายหรือกรอกเอง"><p id="fp-target-note" class="fp-hint" role="status"></p>${oldTarget?'<div class="fp-target-actions"><button type="button" id="fp-old-target" class="fp-secondary">ใช้เป้าเดิม</button></div>':''}</section>`;
}
function targetNote(r){
 const goals=targetGoalsFor(input);
 if(goals.includes('roi')&&r.roiTarget===null)return r.roiTargetStatus==='unreachable'?'ต้นทุนผันแปรสูงเกินไป จึงไม่มีเป้ายอดขายที่ทำให้ถึง ROI ที่เลือก':r.roiTargetStatus==='no-fixed-cost'?'ต้นทุนคงที่เป็นศูนย์ จึงไม่มีเป้า ROI ขั้นต่ำเฉพาะ กรุณากรอกเป้าเอง':'กรอกต้นทุนและเปอร์เซ็นต์ ROI ให้ครบเพื่อคำนวณเป้า';
 if(goals.includes('pc')&&r.pcTarget===null)return 'กรอกค่าแรง PC จำนวนวัน จำนวนคน (เมื่อคิดต่อคน) และเปอร์เซ็นต์ PC ให้ถูกต้อง';
 if(goals.length)return 'คำนวณตามเป้า '+targetGoalLabel(input)+' · ปัดขึ้นทีละ 5,000 บาท · พิมพ์ยอดเองเพื่อกำหนดเป้าเอง';
 if(input.targetMode==='history'&&oldTarget)return `อ้างอิงเป้าเดิม ฿${fmt(oldTarget.value)} / ${fmt(oldTarget.days)} วัน · โปรดยืนยันฐานยอดหลังส่วนลด`;
 return 'กรอกยอดขายเป้าหมายเอง หรือเลือกเงื่อนไขด้านบน';
}
function renderTargetControls(r){
 const goals=targetGoalsFor(input);
 for(const el of root.querySelectorAll('[data-target-goal]'))el.checked=goals.includes(el.value);
 for(const [id,value] of [['fp-roi-goal-value',r.roiTarget],['fp-pc-goal-value',r.pcTarget]])root.querySelector('#'+id).textContent=value===null?'ยอดขายเป้าหมาย —':'ยอดขาย ฿'+fmt(value)+' / งาน';
 const field=root.querySelector('#fp-target');if(document.activeElement!==field)field.value=r.target?r.target.sales:goals.length?'':input.target;
 root.querySelector('#fp-target-note').textContent=targetNote(r);
}
let activeFormTab='work';
function organizeForm(){
 const form=root.querySelector('#fp-assumptions'),head=form.querySelector('.fp-panel-head');
 const tabs=[['work','ข้อมูลงาน'],['cost','ต้นทุน'],['goal','เป้าหมาย'],['request','เสนออนุมัติ']];
 const nodes=[...form.children].filter(node=>node!==head);
 const nav=document.createElement('div');nav.className='fp-form-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','กรอกข้อมูล Event');
 nav.innerHTML=tabs.map(([id,label],i)=>`<button type="button" role="tab" id="fp-tab-${id}" aria-controls="fp-form-${id}" data-form-tab="${id}">${i+1}. ${label}</button>`).join('');
 head.after(nav);
 const panels=Object.fromEntries(tabs.map(([id])=>{const panel=document.createElement('div');panel.id='fp-form-'+id;panel.className='fp-form-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','fp-tab-'+id);form.append(panel);return [id,panel];}));
 let group='work',sections=0;
 for(const node of nodes){if(node.classList.contains('fp-section')&&++sections===2)group='cost';if(node.classList.contains('fp-target'))group='goal';if(node.id==='fp-images'||node.classList.contains('fp-request'))group='request';panels[group].append(node);}
 // Keep staff scheduling with its wage inputs, and keep the main form short.
 const costFields=panels.cost.querySelector('.fp-fields');
 costFields.prepend(form.querySelector('[data-fp-field="pcCount"]').closest('label'));
 costFields.append(form.querySelector('.fp-pc-shift'));
 const workFields=panels.work.querySelector('.fp-fields');
 workFields.append(form.querySelector('.fp-event-types'));
 // Put supporting images after the approval controls.
 panels.request.append(root.querySelector('#fp-images'));
 const show=id=>{activeFormTab=id;for(const [key,panel] of Object.entries(panels))panel.hidden=key!==id;for(const button of nav.children){const selected=button.dataset.formTab===id;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}};
 for(const button of nav.children){button.onclick=()=>show(button.dataset.formTab);button.onkeydown=event=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();const index=[...nav.children].indexOf(button),next=event.key==='Home'?0:event.key==='End'?3:(index+(event.key==='ArrowRight'?1:3))%4;nav.children[next].click();nav.children[next].focus();};}
 show(activeFormTab);
}
function renderWorkspace(){
 const year=input.eventMonth?.slice(0,4)||input.startDate?.slice(0,4)||String(new Date().getFullYear());
 const years=[...new Set([Number(year),...Array.from({length:5},(_,i)=>new Date().getFullYear()-1+i)])].sort((a,b)=>a-b);
 const months=Array.from({length:12},(_,i)=>({value:String(i+1).padStart(2,'0'),label:new Intl.DateTimeFormat('th-TH',{month:'long'}).format(new Date(2026,i,1))}));
 const field=(key,unit)=>`<label>${key==='pc'?(input.pcCostMode==='person'?'ค่า PC ต่อคนต่อวัน':'ค่า PC รวมต่อวัน'):labels[key]} <span>${unit}</span><input data-fp-field="${key}" aria-label="${labels[key]}" type="number" min="${key==='days'?1:0}" ${['cogs','gp'].includes(key)?'max="100"':key==='days'?'max="366"':key==='pcCount'?'max="10000"':''} step="${['days','pcCount'].includes(key)?'1':'any'}" value="${e(input[key])}" placeholder="ระบุข้อมูล"><small>${['cogs','gp'].includes(key)?'ค่าเริ่มต้น '+(key==='cogs'?'22.5':'33')+'% · ปรับได้':['area','pcCount'].includes(key)?'ระบุจากแผนของงานนี้':input[key]===''?'กรอกข้อมูลของงานนี้':mode==='manual'?'ข้อมูลที่คุณกรอก':'ปรับได้ตามงานนี้'}</small></label>`;
 root.querySelector('#fp-workspace').innerHTML=`${editing?`<div class="fp-edit-notice"><strong>กำลังแก้ไขข้อเสนอเดิม</strong><p>บันทึกแล้วสถานะ Trade และ CEO จะกลับเป็นรออนุมัติ · ยอดคาดการณ์คำนวณจากข้อมูลอ้างอิงที่แสดงด้านล่าง</p><a href="/event-proposals?request=${encodeURIComponent(editing.id)}">ยกเลิกการแก้ไข</a></div>`:''}<div id="fp-baseline-picker"></div><nav class="fp-jump" aria-label="ส่วนคาดการณ์ Event"><a href="#fp-assumptions">เงื่อนไขของงาน</a><a href="#fp-results">ดูผลคาดการณ์ ↓</a></nav><div class="fp-layout"><section id="fp-assumptions" class="fp-assumptions" tabindex="-1"><div class="fp-panel-head"><h2>02 / เงื่อนไขของงาน</h2><span>${mode==='manual'?'พื้นที่ใหม่':'ปรับได้'}</span></div>${input.eventSeries==='baan-suan'?`<div class="fp-special-location"><label for="fp-event-location">สถานที่จัดบ้านและสวน</label><input id="fp-event-location" type="text" maxlength="120" value="${e(input.eventLocation)}" placeholder="เช่น ไบเทค บางนา หรือ IMPACT เมืองทองธานี"><p class="fp-hint">ใช้ประวัติบ้านและสวนทุกสถานที่ · ระบุสถานที่ของครั้งที่จะเสนอ</p></div>`:''}<label>ชื่องาน<input id="fp-event-name" type="text" maxlength="120" value="${e(input.eventName||'')}" placeholder="ระบุชื่องาน"></label><label>รูปแบบพื้นที่<select id="fp-channel"><option value="direct" ${input.channel==='direct'?'selected':''}>Event เก็บเงินเอง · ค่าเช่า</option><option value="gp" ${input.channel==='gp'?'selected':''}>ลานโปร · หัก GP%</option></select></label><p class="fp-hint">${input.channel==='direct'?'ค่าเช่าเป็นเงินรวมต่อ Event':'GP คิดจากยอดขายหลังส่วนลด'}</p><fieldset class="fp-section"><legend>1 · พื้นที่และช่วงวันขาย</legend><div class="fp-fields"><div class="fp-planning-fields"><label>ชั้นที่จัด${input.eventSeries==='baan-suan'?' (ถ้ามี)':''}<select id="fp-floor"><option value="">เลือกชั้น</option>${eventFloors.map(value=>`<option value="${value}" ${input.floor===value?'selected':''}>${value}</option>`).join('')}</select></label><div class="fp-month-field"><label>เดือนที่จัด<select id="fp-event-month"><option value="">เลือกเดือน</option>${months.map(month=>`<option value="${month.value}" ${input.eventMonth?.slice(5)===month.value?'selected':''}>${month.label}</option>`).join('')}</select></label><label>ปี พ.ศ.<select id="fp-event-year">${years.map(value=>`<option value="${value}" ${String(value)===year?'selected':''}>${value+543}</option>`).join('')}</select></label></div></div><fieldset class="fp-event-types"><legend>ประเภท · เลือกได้มากกว่า 1${input.eventSeries==='baan-suan'?' (ถ้ามี)':''}</legend>${eventTypes.map(value=>`<label><input type="checkbox" data-event-type value="${value}" ${(input.eventTypes||[]).includes(value)?'checked':''}><span>${value}</span></label>`).join('')}</fieldset>${field('area','ตร.ม.')}${field('pcCount','คน')}<div class="fp-pc-shift"><label>เวลา PC เริ่มงาน<input id="fp-pc-start" type="time" value="${e(input.pcStartTime)}"></label><label>เวลา PC เลิกงาน<input id="fp-pc-end" type="time" value="${e(input.pcEndTime)}"></label><p id="fp-pc-hours" role="status" class="fp-hint"></p><small>ค่า PC ใช้อัตราต่อวันที่กรอก · เวลาใช้ระบุตารางทำงาน</small></div><label>วันที่เริ่ม<input id="fp-start" type="date" value="${e(input.startDate)}"></label><label>วันที่สิ้นสุด<input id="fp-end" type="date" value="${e(input.endDate)}"></label>${field('days','วัน')}</div><p class="fp-section-note">ขนาดพื้นที่ใช้ประกอบแผนงาน ไม่ปรับยอดขายอัตโนมัติ</p></fieldset><fieldset class="fp-section"><legend>2 · ค่าใช้จ่ายของงาน</legend><div id="fp-compensation"></div><div class="fp-fields">${field(input.channel==='direct'?'rent':'gp',input.channel==='direct'?'บาท / งาน':'% หลังส่วนลด')}${field('cogs','% หลังส่วนลด')}<label>วิธีคิดค่า PC<select id="fp-pc-mode"><option value="total" ${input.pcCostMode!=='person'?'selected':''}>ยอดรวมทุกคน / วัน</option><option value="person" ${input.pcCostMode==='person'?'selected':''}>ค่าแรงต่อคน / วัน</option></select></label>${field('pc',input.pcCostMode==='person'?'บาท / คน / วัน':'บาท / วัน · ทุกคน')}${field('shipping','บาท / งาน')}${field('other','บาท / งาน')}</div><p class="fp-section-note">ค่า PC จากประวัติเป็นยอดรวมทุกคน หากเลือกต่อคน ให้กรอกค่าแรงต่อคนและจำนวน PC</p><p class="fp-hint">ค่าใช้จ่ายอื่นรวมค่าห้างหัก การตลาด และเงินสดย่อย · กรอก 0 เมื่อไม่มีค่าใช้จ่าย</p></fieldset>${targetMarkup()}${mode==='manual'?`<section class="fp-manual-action">${input.salesMode==='cost-target'?'':`<div class="fp-fields">${field('expectedSales','บาท / งาน')}</div>`}<h2>3 · คาดการณ์ยอดขายที่ต้องทำ</h2><p class="fp-hint">เลือกเป้าหมายและกรอกต้นทุนครบ เพื่อคำนวณยอดขายที่ต้องทำ</p><button type="button" id="fp-cost-calculate">คาดการณ์ยอดขายที่ต้องทำ</button></section>`:`<details class="fp-options"><summary>ปรับกรณีต่ำ / สูงกว่าคาดการณ์</summary><div class="fp-fields fp-variations">${field('downside','% ต่ำกว่าคาดการณ์')}${field('upside','% สูงกว่าคาดการณ์')}</div><p class="fp-hint">กรณีต่ำ/สูงเทียบยอดขายคาดการณ์ของช่วงวันที่เลือก เปอร์เซ็นต์เป็นสมมติฐานที่ปรับได้</p></details>`}<div id="fp-images"></div><section class="fp-request"><h2>${mode==='manual'?4:3} · เสนอ Event เพื่ออนุมัติ</h2><div id="fp-proposal-choice"></div><label>วันที่เสนอ<input id="fp-proposal-date" type="date" value="${e(input.proposalDate)}"></label><label>วันสุดท้ายที่ต้องคอนเฟิร์ม<input id="fp-confirm-by" type="date" value="${e(input.confirmBy)}"></label><p class="fp-hint">บันทึกกรณีที่เลือกพร้อมต้นทุน กำไร ROI สถานที่ และเวลาทำงาน PC</p><button type="button" id="fp-submit" ${canEdit?'':'disabled'}>${canEdit?(editing?'บันทึกการแก้ไข →':'ขออนุมัติ Event →'):'สิทธิ์ดูอย่างเดียว · ไม่สามารถเสนอ Event ได้'}</button><p id="fp-submit-status" role="status" class="fp-hint"></p></section></section><section id="fp-results" aria-label="ผลคาดการณ์ Event" tabindex="0" aria-live="polite"></section></div><div id="fp-history"></div><details class="fp-method"><summary>สูตรคำนวณและที่มาของตัวเลข</summary><p>Baseline ต่อวัน = ยอดขายหลังส่วนลดรวม ÷ จำนวนวันขายรวม ของสถานที่เดียวกัน หรือเฉพาะบ้านและสวนทุกสถานที่เมื่อเลือก Event พิเศษ รวมทั้งแบบค่าเช่าและ GP เฉพาะงานที่สิ้นสุดแล้วและข้อมูลครบในเดือนที่เลือก หรือทุกเดือนเมื่อเลือกค่าเฉลี่ยทั้งหมด จำนวนวันใช้ตามชีต งานวันผิด/ชื่อซ้ำแยกออก ต้นทุนสินค้าตั้งต้น 22.5% และ GP ห้าง 33% ปรับได้ตามงาน ส่วนค่าใช้จ่ายอื่นใช้ค่ามัธยฐานจากประวัติรูปแบบเดียวกัน</p><p>ROI = กำไร ÷ ต้นทุนรวม × 100 ต้นทุนรวมประกอบด้วยสินค้า ค่าเช่าหรือ GP ค่า PC ขนส่ง และค่าใช้จ่ายอื่น ตัวเลขนี้ต่างจากอัตรากำไรต่อยอดขาย และเป็นผลตอบแทนระดับ Event ก่อนส่วนกลางและภาษีเงินได้</p>${input.compensationMode==='catalog'?'<p>เมื่อใช้เรทตามสถานที่: ต้นทุนรวมบวกค่าคอมและโบนัสตามยอดขายของแต่ละกรณี เป้า ROI และจุดคุ้มทุนคำนวณรวม Incentive ตามขั้น ส่วนเป้า PC รวมค่าแรง ค่าคอม และโบนัสของทีม</p>':''}<p>สูตรก่อนรวม Incentive: กำหนด F = ค่าใช้จ่ายคงที่ และ v = ต้นทุนสินค้า% + GP% (ถ้ามี) กำหนด r = ROI เป้าหมาย ÷ 100 เป้ายอดขาย = (1 + r) × F ÷ (1 − (1 + r) × v) เมื่อส่วนหารเป็นบวก เป้าถูกปัดขึ้นทีละ 5,000 บาท หากต้นทุนคงที่เป็นศูนย์หรือส่วนหารไม่เป็นบวก จะไม่สร้างเป้ายอดขายอัตโนมัติ</p><p>เป้าค่าแรง PC = ค่า PC รวมทุกคนตลอดงาน ÷ (เปอร์เซ็นต์ PC ÷ 100) ปัดขึ้นทีละ 5,000 บาท ค่าเริ่มต้น ROI 40% และ PC 13% เลือกใช้ครั้งละหนึ่งเป้าหมาย และปรับเปอร์เซ็นต์ได้</p><p>เป้าเดิมนำจากคอลัมน์ “เป้า” ของงานล่าสุดที่สิ้นสุดแล้วในรูปแบบเดียวกัน โปรดยืนยันว่าตัวเลขเป้าเป็นยอดหลังส่วนลด กรณีต่ำ/สูงเป็นสมมติฐานที่ปรับได้ ไม่ใช่ความน่าจะเป็นหรือยอดรับประกัน</p></details>`;
 organizeForm();
 imageEditor.mount(root.querySelector('#fp-images'),canEdit);
 root.querySelector('#fp-event-name').oninput=ev=>{input.eventName=ev.target.value;requestId=null;renderResults();};
 const locationField=root.querySelector('#fp-event-location');if(locationField)locationField.oninput=()=>{const before=compensationVenue(place+' '+input.eventLocation)?.id;input.eventLocation=locationField.value;const after=compensationVenue(place+' '+input.eventLocation)?.id;if(input.compensationMode==='catalog'&&before!==after){applyCompensation();const count=root.querySelector('[data-fp-field="pcCount"]');if(count)count.value=input.pcCount;renderCompensationPanel();}requestId=null;manualCalculated=false;locationField.removeAttribute('aria-invalid');renderResults();};
 for(const [id,key] of [['fp-pc-start','pcStartTime'],['fp-pc-end','pcEndTime']])root.querySelector('#'+id).oninput=ev=>{input[key]=ev.target.value;requestId=null;ev.target.removeAttribute('aria-invalid');renderPcShift();};renderPcShift();
 root.querySelector('#fp-floor').onchange=ev=>{input.floor=ev.target.value;requestId=null;};
 for(const id of ['fp-event-month','fp-event-year'])root.querySelector('#'+id).onchange=()=>{const month=root.querySelector('#fp-event-month').value;input.eventMonth=month?root.querySelector('#fp-event-year').value+'-'+month:'';requestId=null;};
 for(const el of root.querySelectorAll('[data-event-type]'))el.onchange=()=>{input.eventTypes=[...root.querySelectorAll('[data-event-type]:checked')].map(el=>el.value);requestId=null;};
 root.querySelector('#fp-pc-mode').onchange=ev=>{input.pcCostMode=ev.target.value;input.pc='';if(input.compensationMode==='catalog')input.wageMode='manual';requestId=null;manualCalculated=false;renderWorkspace();};
 root.querySelector('#fp-channel').onchange=ev=>{const previousPc=input.pc,previousPcMode=input.pcCostMode;input.channel=ev.target.value;input.pcCostMode='total';setupDefaults();if(input.compensationMode==='catalog'){input.pc=previousPc;input.pcCostMode=previousPcMode;syncCompensationWage();}requestId=null;manualCalculated=false;renderWorkspace();};
 for(const el of root.querySelectorAll('[data-fp-field]'))el.oninput=()=>{input[el.dataset.fpField]=el.value;if(el.dataset.fpField==='pc'&&input.compensationMode==='catalog'){input.wageMode='manual';renderCompensationPanel();}if(el.dataset.fpField==='days')renderCompensationPanel();requestId=null;manualCalculated=false;el.nextElementSibling.textContent='ข้อมูลที่คุณปรับ';renderResults();};
 if(mode==='manual')root.querySelector('#fp-cost-calculate').onclick=calculateManual;
 root.querySelector('#fp-target').oninput=ev=>{input.target=ev.target.value;input.targetMode='manual';requestId=null;manualCalculated=false;renderResults();};
 for(const radio of root.querySelectorAll('[data-target-goal]'))radio.onchange=()=>{input.targetMode=radio.value;input.target='';requestId=null;manualCalculated=false;renderResults();};
 const oldTargetButton=root.querySelector('#fp-old-target');if(oldTargetButton)oldTargetButton.onclick=()=>{input.targetMode='history';input.target=oldTarget.value;requestId=null;manualCalculated=false;renderResults();};
 const syncDates=(changed=true)=>{const days=selectedDays(input.startDate,input.endDate),el=root.querySelector('[data-fp-field="days"]');if(input.startDate||input.endDate){input.days=days??'';el.value=input.days;}el.readOnly=Boolean(input.startDate||input.endDate);el.nextElementSibling.textContent=days?'คำนวณรวมวันเริ่มและวันสิ้นสุด':'เลือกวันเริ่มและวันสิ้นสุดให้ครบและถูกต้อง';if(changed){requestId=null;manualCalculated=false;}syncCompensationWage();renderCompensationPanel();renderResults();};
 for(const [id,key] of [['fp-start','startDate'],['fp-end','endDate']])root.querySelector('#'+id).oninput=ev=>{input[key]=ev.target.value;if(!input.eventMonth&&input.startDate){input.eventMonth=input.startDate.slice(0,7);root.querySelector('#fp-event-month').value=input.eventMonth.slice(5);const yearSelect=root.querySelector('#fp-event-year');if(![...yearSelect.options].some(option=>option.value===input.eventMonth.slice(0,4)))yearSelect.add(new Option(String(Number(input.eventMonth.slice(0,4))+543),input.eventMonth.slice(0,4)));yearSelect.value=input.eventMonth.slice(0,4);}syncDates();};
 for(const [id,key] of [['fp-proposal-date','proposalDate'],['fp-confirm-by','confirmBy']])root.querySelector('#'+id).oninput=ev=>{input[key]=ev.target.value;requestId=null;};
 if(input.startDate||input.endDate)syncDates(false);
 root.querySelector('#fp-submit').onclick=submitRequest;
 renderCompensationPanel();renderResults();renderBaselinePicker();renderHistory();syncWorkspaceLinks();
}
function renderBaselinePicker(){
 const container=root.querySelector('#fp-baseline-picker');
 const baseline=forecast(rows,input).baseline;container.innerHTML=mode==='manual'?'':`<details class="fp-baseline-disclosure"><summary><span>ยอดขายอ้างอิง <strong id="fp-baseline-summary">${e(baselineSelectionLabel(rows,input.baselineMonth))} · ${baseline.observations} Event</strong></span><span>เลือก Baseline</span></summary>${baselinePickerMarkup(rows,input.baselineMonth,place)}</details>`;
 for(const button of container.querySelectorAll('[data-baseline-month]'))button.onclick=()=>{
  if(sending)return;input.baselineMonth=button.dataset.baselineMonth;requestId=null;
  for(const option of container.querySelectorAll('[data-baseline-month]')){
   const active=option===button;option.setAttribute('aria-pressed',String(active));
   const status=option.querySelector('small');status.textContent=status.textContent.replace(/^(✓ กำลังใช้|เลือกใช้ Baseline นี้)/,active?'✓ กำลังใช้':'เลือกใช้ Baseline นี้');
  }
  const selected=forecast(rows,input).baseline;root.querySelector('#fp-baseline-summary').textContent=baselineSelectionLabel(rows,input.baselineMonth)+' · '+selected.observations+' Event';renderResults();renderHistory();
 };
}
function calculateManual(){
 manualCalculated=true;requestId=null;renderResults();
 const result=root.querySelector('#fp-results');result.tabIndex=-1;result.focus({preventScroll:true});
 if(matchMedia('(max-width: 800px)').matches)result.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderManualResults(){
 const r=forecast([],input),ready=r.costReady;
 for(const el of root.querySelectorAll('[data-fp-field]'))el.setAttribute('aria-invalid',String(manualCalculated&&r.errors.includes(el.dataset.fpField)));
 const button=root.querySelector('#fp-submit');if(button)button.disabled=!canEdit||!ready||r.base.roi===null;
 const amount=v=>v===null?'—':'฿'+fmt(v);
 const breakEven=ready&&r.breakEven!==null?Math.ceil(r.breakEven):null;
 const target=ready?r.target?.sales??null:null;
 const daily=v=>v===null?'ยอดขายหลังส่วนลด / งาน':'เฉลี่ย ฿'+fmt(Math.ceil(v/Number(input.days)))+' / วัน · '+fmt(Number(input.days))+' วัน';
 let message=!r.costReady?'กรอกข้อมูลที่ถูกต้อง: '+r.errors.map(k=>labels[k]||k).join(' · '):'';
 const roiNote=targetNote(r);
 root.querySelector('#fp-results').innerHTML=`<div class="fp-results-kicker">03 / FORECAST<span>${mode==='manual'?'คำนวณจากต้นทุน':'อัปเดตตามแผนงาน'}</span></div><div class="fp-result-head"><h2>${e(place)}</h2>${input.eventName?.trim()?`<span class="fp-location-caption">ชื่องาน · ${e(input.eventName.trim())}</span>`:''}${input.eventSeries==='baan-suan'&&input.eventLocation?`<span class="fp-location-caption">${e(input.eventLocation)}</span>`:''}<span>พื้นที่ใหม่ · คำนวณจากต้นทุน</span></div><div class="fp-context"><span>${input.channel==='gp'?'ลานโปร · GP':'เก็บเงินเอง · ค่าเช่า'}</span><span>พื้นที่ ${input.area===''?'ยังไม่ระบุ':fmt(Number(input.area))+' ตร.ม.'}</span><span>PC ${input.pcCount===''?'ยังไม่ระบุ':fmt(Number(input.pcCount))+' คน'}</span></div>${message?`<p class="fp-warning">${e(message)}</p>`:''}<div class="fp-sales-targets"><article><h3>ยอดขายที่คุ้มทุน</h3><strong>${ready&&r.noBreakEven?'ไม่ถึงจุดคุ้มทุน':amount(breakEven)}</strong><p>${daily(breakEven)}</p><small>${ready&&r.noBreakEven?'ต้นทุนผันแปรเท่ากับหรือสูงกว่ายอดขาย และมีต้นทุนที่ยังไม่ครอบคลุม':breakEven===0?'ไม่มีต้นทุนคงที่ · คุ้มทุนตั้งแต่ยอดขาย 0 บาท':'ยอดขายครอบคลุมต้นทุนทั้งหมด'}</small></article><article class="fp-roi-goal"><h3>ยอดขายเป้าหมาย · ${targetGoalLabel(input)}</h3><strong>${amount(target)}</strong><p>${daily(target)}</p><small>${roiNote}</small></article></div>${ready?`<p class="fp-hint">ต้นทุนคงที่ ฿${fmt(r.fixedCosts)} / งาน · ต้นทุนผันแปร ${pct(r.variableRate*100)} ของยอดขาย</p>`:''}<p class="fp-hint">ยอดขายเป้าอัตโนมัติปัดขึ้นทีละ 5,000 บาท และยอดเฉลี่ยต่อวันปัดขึ้นเพื่อให้ถึงเป้า</p>${ready&&target!==null?`<div class="fp-profit-row fp-kpis"><div><span>กำไรเมื่อขายถึงเป้าหมาย</span><strong>฿${fmt(r.base.profit)}</strong></div><div><span>ROI · กำไรต่อต้นทุนรวม</span><strong>${pct(r.base.roi)}</strong></div><div><span>ต้นทุนรวมเมื่อขายถึงเป้า</span><strong>฿${fmt(r.base.costs)}</strong></div></div>${costStatement(r.base,input).replace('กรณีตามคาดการณ์ · % ของยอดขายหลังส่วนลด','เมื่อขายถึงเป้าหมาย · % ของยอดขายหลังส่วนลด')}`:''}<p class="fp-hint">เป็นยอดขายที่ต้องทำตามต้นทุนที่กรอก · ก่อนค่าใช้จ่ายส่วนกลางและภาษีเงินได้</p>`;
}
function renderCompensationQuickRate(){
 if(input.compensationMode!=='catalog')return;
 const context=compensationContext(input),rate=input.wageMode==='source'?context.wage?.daily:Number(input.pc);
 const text=input.pc===''||rate==null?'รอระบุค่าแรง':'฿'+new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(rate)+(input.pcCostMode==='person'?' / คน / วัน':' / วันทั้งทีม');
 root.querySelector('#fp-results .fp-context')?.insertAdjacentHTML('afterend',`<div class="fp-quick-rate"><span>ค่าแรง${input.wageMode==='source'?'ตามสถานที่':'ที่ปรับเอง'}</span><strong>${e(text)}</strong><small>${input.wageMode==='source'?'อ้างอิง เรทEvent.xlsx · ปรับได้ในแท็บต้นทุน':'กรอกในแท็บต้นทุน'}</small></div>`);
}
function renderResults(){
 syncCompensationWage();
 renderTargetControls(forecast(rows,input));
 if(mode==='manual'){renderManualResults();const result=forecast([],input);root.querySelector('#fp-results').insertAdjacentHTML('beforeend',compensationResultsMarkup(result,input,result.costReady));renderCompensationQuickRate();renderProposalChoice(result);return;}
 const r=forecast(rows,input),b=r.base,n=r.observations,target=r.target;
 for(const el of root.querySelectorAll('[data-fp-field]'))el.setAttribute('aria-invalid',String(r.errors.includes(el.dataset.fpField)));
 const dailySales=Number.isFinite(b.sales)&&Number.isFinite(Number(input.days))&&Number(input.days)>0?b.sales/Number(input.days):null;
 const main=b.sales===null?'<p class="fp-warning">'+(mode==='manual'?'กรอกยอดขายประมาณการของพื้นที่ใหม่':'ยังไม่มีประวัติที่ใช้สร้าง Baseline ได้ หรือจำนวนวันไม่ถูกต้อง')+'</p>':`<div class="fp-main-number"><span>ยอดขายคาดการณ์ · ${fmt(Number(input.days))} วัน</span><strong>฿${fmt(b.sales)}</strong><div class="fp-daily-average">เฉลี่ยต่อวัน <b>${dailySales===null?'—':new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(dailySales)}</b> บาท/วัน</div><p>ยอดขายหลังส่วนลด ${input.startDate&&input.endDate?e(input.startDate)+' ถึง '+e(input.endDate):'ตามจำนวนวันที่ระบุ'}</p></div>`;
 root.querySelector('#fp-results').innerHTML=`<div class="fp-results-kicker">03 / FORECAST<span>${mode==='manual'?'คำนวณจากต้นทุน':'อัปเดตตามแผนงาน'}</span></div><div class="fp-result-head"><h2>${e(place)}</h2>${input.eventName?.trim()?`<span class="fp-location-caption">ชื่องาน · ${e(input.eventName.trim())}</span>`:''}${input.eventSeries==='baan-suan'&&input.eventLocation?`<span class="fp-location-caption">${e(input.eventLocation)}</span>`:''}<span>${mode==='manual'?'คำนวณเอง · ไม่มีประวัติ':n+' งานอ้างอิง'}</span></div><div class="fp-context"><span>${input.channel==='gp'?'ลานโปร · GP':'เก็บเงินเอง · ค่าเช่า'}</span><span>พื้นที่ ${input.area===''?'ยังไม่ระบุ':fmt(Number(input.area))+' ตร.ม.'}</span><span>PC ${input.pcCount===''?'ยังไม่ระบุ':fmt(Number(input.pcCount))+' คน'}</span></div>${mode==='manual'?'':`<p class="fp-selected-baseline">Baseline · <strong>${e(baselineSelectionLabel(rows,input.baselineMonth))}</strong><br>${n} Event · ${fmt(r.baseline.days)} วันขาย · ยอดขายรวม ฿${fmt(r.baseline.sales)}</p>`}${main}${costStatement(b,input)}<div class="fp-profit-row fp-kpis"><div><span>กำไร · ตามคาดการณ์</span><strong class="${b.profit<0?'fp-negative':''}">${b.profit===null?'—':'฿'+fmt(b.profit)}</strong></div><div><span>ROI · กำไรต่อต้นทุนรวม</span><strong class="${b.roi<0?'fp-negative':''}">${pct(b.roi)}</strong></div><div><span>ต้นทุนรวม · ตามคาดการณ์</span><strong>${b.costs===null?'—':'฿'+fmt(b.costs)}</strong></div></div>${r.errors.length?`<p class="fp-warning">กรอกข้อมูลที่ถูกต้อง: ${r.errors.map(k=>labels[k]||k).join(' · ')} เพื่อให้คำนวณครบ</p>`:''}<div class="fp-break-even"><span>เป้าหมาย · ${e(targetGoalLabel(input))}</span><strong>${target===null?'—':'฿'+fmt(target.sales)}</strong></div><div class="fp-break-even"><span>ยอดขายคุ้มทุน</span><strong>${r.noBreakEven?'ไม่คุ้มทุน':r.breakEven===null?'—':'฿'+fmt(r.breakEven)}</strong></div><details class="fp-result-detail"><summary>เปรียบเทียบ 3 กรณี</summary><div class="fp-scenarios">${r.scenarios.map((s,i)=>`<article data-scenario-card="${i}" class="${i===1?'fp-base':''}"><h3>${s.label}</h3><small>${i===0?e(input.downside)+'% ต่ำกว่าคาดการณ์':i===2?e(input.upside)+'% สูงกว่าคาดการณ์':mode==='manual'?'ประมาณการที่กรอก':'ค่าเฉลี่ยจากประวัติ'}</small><p>ยอดขาย</p><strong>${s.sales===null?'—':'฿'+fmt(s.sales)}</strong><p>กำไร</p><b class="${s.profit<0?'fp-negative':''}">${s.profit===null?'—':'฿'+fmt(s.profit)}</b><p>ROI</p><b class="${s.roi<0?'fp-negative':''}">${pct(s.roi)}</b></article>`).join('')}</div><p class="fp-hint">ทุกกรณีใช้ช่วงวันเดียวกัน · กรณีต่ำ/สูงเทียบกับยอดขายคาดการณ์ ไม่ใช่เป้าหมาย</p></details><p class="fp-hint">กำไรและ ROI ก่อนค่าใช้จ่ายส่วนกลางและภาษีเงินได้</p>`;
 root.querySelector('#fp-results').insertAdjacentHTML('beforeend',compensationResultsMarkup(r,input));
 renderCompensationQuickRate();renderProposalChoice(r);
}
const channelLabel=channel=>channel==='direct'?'เก็บเงินเอง':channel==='gp'?'หัก GP':'ประเภท: [ต้องถามเจ้าของ]';
const sourceLabel=id=>id==='sales-2025'?'Sales Report 2568':id==='sales-2026'?'Sales Report 2569':'Google Sheets';
const sourceLinks={google:'https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/edit?gid=2066169026','sales-2026':'https://vingrun-my.sharepoint.com/:x:/r/personal/anchalee_ving_run/_layouts/15/doc2.aspx?sourcedoc=%7B4683C9CE-44C2-4D99-93C7-575CFFEFC84B%7D&file=Sales%20Report%202026%20PC%20VING.xlsx&action=default','sales-2025':'https://vingrun-my.sharepoint.com/:x:/g/personal/anchalee_ving_run/IQBdBrzBpuSESolr2v1BJmKgAd5aS4236SkVu8s5993lwtg?rtime=ri0tjd8M30g'};
function renderSources(){
 const sources=data.source.sources||[];
 root.querySelector('#fp-data-sources').innerHTML=`<div class="fp-sources">${sources.map(s=>`<div><strong><a href="${e(sourceLinks[s.id])}" target="_blank" rel="noreferrer">${e(s.label)} ↗</a></strong><small>${s.id==='google'?(s.status==='online'?'อ่านต้นทุนและกำหนดการแล้ว':'ใช้ข้อมูลล่าสุดที่อ่านได้'):(s.months?.length||0)+' เดือน · ยอดถึง '+e(s.as_of||'ยังไม่มีข้อมูล')}</small><small>${s.fetched_at?'อ่านข้อมูล '+e(new Date(s.fetched_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})):'ยังไม่ทราบเวลาอ่านข้อมูล'}${s.status==='stale'?' · ใช้ข้อมูลสำรอง':''}</small></div>`).join('')}</div><details class="fp-provenance"><summary>วิธีรวมข้อมูลและตรวจสอบต้นทาง</summary><p>${e(data.source.rule||'')}</p><p>Sales Report ใช้ข้อมูลที่นำเข้าไว้ในเว็บ และตามการอัปเดตชุดยอดขายเดิม ส่วนต้นทุนอ่านจาก Google Sheets</p><p>ไม่นับเคาน์เตอร์ประจำและ Stand alone เป็น Event · วันขายอิงกำหนดการ รวมวันยอดขายศูนย์ ไม่ใช้เฉพาะวันที่ขายได้</p><p>รายการที่จับคู่ไม่ได้ ${data.source.issues?.length||0} แถว จะแสดงเหตุผลในประวัติของสถานที่</p><p><a href="https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/edit?gid=2066169026" target="_blank" rel="noreferrer">สรุปต้นทุนห้าง ↗</a> · <a href="/daily-sales?year=2025">ดู Sales Report บนเว็บ ↗</a></p></details>`;
}
function renderHistory(){
 if(mode==='manual'){root.querySelector('#fp-history').innerHTML='';return;}
 root.querySelector('#fp-history').innerHTML=`<section class="fp-history">${baselineEventsMarkup(rows,input.baselineMonth)}<details class="fp-provenance"><summary>แหล่งอ้างอิงทั้งหมด · ยังไม่ใช้ (${rows.filter(r=>!r.usable).length})</summary>${rows.map(r=>`<div class="fp-reference"><strong>${r.range?e(r.range.start+' ถึง '+r.range.end):'รอยืนยันวันที่'} · ${channelLabel(r.channel)}</strong><p>${sourceLabel(r.salesSource)} · ${r.usable?'ใช้คำนวณ '+fmt(r.net)+' บาท / '+r.days+' วัน':e(r.reason)}</p>${r.note?`<p>${e(r.note)}</p>`:''}${r.difference?`<p>ยอดรายงานต่างจากชีต ${fmt(r.difference)} บาท · ใช้ยอดรายงานเพียงแหล่งเดียว</p>`:''}<small>${(r.sources||[]).map(s=>s.source==='google'?e(s.sheet)+' แถว '+s.row:sourceLabel(s.source)+' '+e(s.period)+' ลำดับข้อมูล '+s.row).join(' · ')}</small></div>`).join('')}</details></section>`;
}
async function submitRequest(){
 if(!canEdit||sending)return;const status=root.querySelector('#fp-submit-status'),button=root.querySelector('#fp-submit');
 if(imageEditor.busy){submitError('รอเตรียมรูปให้เสร็จก่อนบันทึก','#fp-images');return;}
 if(input.eventSeries==='baan-suan'&&!input.eventLocation.trim()){submitError('กรุณาระบุสถานที่จัดบ้านและสวน','#fp-event-location');return;}
 if((input.pcStartTime||input.pcEndTime)&&pcShiftHours(input.pcStartTime,input.pcEndTime)===null){submitError('กรุณาระบุเวลาเริ่มและเลิกงาน PC ให้ถูกต้อง',!input.pcStartTime?'#fp-pc-start':'#fp-pc-end');return;}
 const r=forecast(rows,input);if(r.errors.length||!r.costReady||r.base.sales===null||r.base.roi===null){submitError(mode==='manual'?'กรอกต้นทุนให้ครบและตรวจว่าเป้าหมายที่เลือกคำนวณได้ก่อนขออนุมัติ':'กรอกยอดขายและต้นทุนให้ครบก่อนขออนุมัติ',r.errors[0]==='incentiveAmount'?'#fp-incentive-amount':r.errors[0]?'[data-fp-field="'+r.errors[0]+'"]':'#fp-results');return;}
 const proposed=r.scenarios[proposalScenarioIndex(input.proposalScenario)];if(proposed?.sales===null||proposed?.roi===null){submitError('กรณีที่เลือกยังคำนวณไม่ครบ กรุณาเลือกกรณีอื่น','#fp-proposal-choice');return;}
 if((input.eventSeries!=='baan-suan'&&(!input.floor||!input.eventTypes?.length))||!validEventMonth(input.eventMonth)){submitError('เลือกชั้น ประเภท และเดือนที่จัดก่อนบันทึก',input.eventSeries!=='baan-suan'&&!input.floor?'#fp-floor':input.eventSeries!=='baan-suan'&&!input.eventTypes?.length?'[data-event-type]':'#fp-event-month');return;}
 if(!input.startDate||!input.endDate){submitError('ระบุวันที่เริ่มและสิ้นสุดของ Event ก่อนขออนุมัติ',!input.startDate?'#fp-start':'#fp-end');return;}
 if(!input.proposalDate||!input.confirmBy||input.confirmBy<input.proposalDate){submitError('ระบุวันที่เสนอและวันสุดท้ายที่ต้องคอนเฟิร์มให้ถูกต้อง โดยวันคอนเฟิร์มต้องไม่ก่อนวันที่เสนอ',!input.proposalDate?'#fp-proposal-date':'#fp-confirm-by');return;}
 status.classList.remove('fp-submit-error');requestId??=editing?crypto.randomUUID():imageProposalId;sending=true;button.disabled=true;status.textContent='กำลังบันทึกคำขอ…';
 const controls=[...root.querySelectorAll('input,select,button')].map(el=>({el,disabled:el===button?false:el.disabled}));controls.forEach(({el})=>el.disabled=true);
 try{const attachments=await imageEditor.upload(editing?.id||requestId,status);const response=await fetch('/api/event-requests',{method:editing?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:editing?.id||requestId,attachments,...(editing?{revision:editing.revision,editToken:requestId}:{}),place,startDate:input.startDate,endDate:input.endDate,input,referenceKey:mode==='manual'?'manual':historySignature(rows)}),signal:AbortSignal.timeout(25000)});const saved=await response.json();if(!response.ok){if(saved.code==='history_changed'){const latest=await fetch('/api/event-predict',{cache:'no-store'});if(latest.ok){data=await latest.json();rows=historyFor(data.records,venue,null,new Date(Date.now()+7*3600000).toISOString().slice(0,10));requestId=null;renderResults();renderBaselinePicker();renderHistory();}}throw Error(saved.error||'บันทึกไม่สำเร็จ');}draftSubmitted=true;drafts.capture();await drafts.flush();status.textContent='บันทึกแล้ว กำลังเปิดรายการเสนอ Event';location.assign(saved.url);}catch(error){status.textContent=error.name==='TimeoutError'?'ยังยืนยันการบันทึกไม่ได้ กดขออนุมัติซ้ำเพื่อตรวจคำขอเดิมได้โดยไม่เพิ่มรายการซ้ำ':error.message;sending=false;controls.forEach(({el,disabled})=>el.disabled=disabled);}
}
