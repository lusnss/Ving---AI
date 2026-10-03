import {escapeHtml as e} from './api.mjs';
export const staffNames=['Nat','Not','Tom'];
// Content identity prevents a row insertion/reordering in Sheets moving assignments to another job.
export const staffKey=item=>JSON.stringify([item.place||item.name,item.type||'',item.setupDate||'',item.startDate||'',item.endDate||'',item.kind]);
export const assignedStaff=(item,state)=>state.staff?.items?.[staffKey(item)]?.names||[];
export function staffSummary(model,state){
 const count=name=>state.staff?.error?'—':model.selected.filter(item=>name==='unassigned'?!assignedStaff(item,state).length:assignedStaff(item,state).includes(name)).length;
 return `<section class="ev-staff-summary" aria-label="สรุปกำลังคน"><div><h3>ใครไปงานไหน</h3><p>เลือกชื่อในแต่ละงานได้หลายคน · บันทึกอัตโนมัติ</p></div><div class="ev-staff-filters">${[['all','ทุกงาน',model.selected.length],...staffNames.map(name=>[name,name,count(name)]),['unassigned','ยังไม่ได้จัดคน',count('unassigned')]].map(([key,label,n])=>`<button type="button" data-staff-filter="${key}" aria-pressed="${(state.staffFilter||'all')===key}">${label} <b>${n}</b></button>`).join('')}</div><p role="status" aria-live="polite">${e(state.staffMessage||state.staff?.error||(state.staff?.canEdit===false?'บัญชีนี้ดูแผนกำลังคนได้อย่างเดียว':''))}</p>${state.staff?.error?'<button type="button" data-staff-retry>ลองโหลดแผนอีกครั้ง</button>':''}</section>`;
}
export function staffList(items,state){
 return `<div class="ev-staff-list">${items.length?items.map(item=>{
 const names=assignedStaff(item,state),id=staffKey(item);
 const duplicates=items.filter(other=>staffKey(other)===id).length>1;
 const clashes=names.filter(name=>item.range&&state.staffAllItems?.some(other=>staffKey(other)!==id&&other.range?.start===item.range.start&&assignedStaff(other,state).includes(name)));
 return `<article class="ev-staff-row"><div class="ev-staff-date">${item.range?e(new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(item.range.start+'T12:00:00Z'))):'รอยืนยันวัน'}<small>${e(item.time||'ยังไม่ระบุเวลา')}</small></div><div><span class="ev-action-label action-${item.kind}">${item.kind==='setup'?'Set up':'เก็บกลับ'}</span><button type="button" class="ev-staff-title" data-schedule-detail="${e(item.key)}">${e(item.name)}</button>${clashes.length?`<small class="ev-staff-warning">${e(clashes.join(', '))} มีงานอื่นวันเดียวกัน · ตรวจเวลาเดินทาง</small>`:''}${duplicates?'<small class="ev-staff-warning">พบรายการซ้ำในชีต กรุณาแยกข้อมูลก่อนจัดคน</small>':''}</div><div class="ev-staff-choice"><span>${state.staff?.error?'ยังยืนยันแผนล่าสุดไม่ได้':names.length?'ผู้ไปงาน: '+e(names.join(', ')):'ยังไม่ได้จัดคน'}</span><div role="group" aria-label="ผู้ไปงาน ${e(item.name)} ${item.kind==='setup'?'Set up':'เก็บกลับ'}">${staffNames.map(name=>`<button type="button" data-staff-key="${e(id)}" data-staff-name="${name}" aria-pressed="${names.includes(name)}" ${state.staff?.error||!state.staff?.canEdit||state.staffBusy||duplicates?'disabled':''}>${names.includes(name)?'✓ ':''}${name}</button>`).join('')}</div></div></article>`;
 }).join(''):'<p class="ev-empty">ไม่พบงานตามตัวกรองที่เลือก</p>'}</div>`;
}

export function staffDropdown(item,state){
 const names=assignedStaff(item,state),disabled=!!state.staff?.error||!state.staff?.canEdit;
 return `<section class="ev-staff-editor" data-staff-editor data-draft-view aria-label="จัดกำลังคน"><h3>ผู้ไป${item.kind==='setup'?' Set up':'เก็บกลับ'}</h3><details class="ev-staff-dropdown"><summary><span data-staff-selection>${e(names.join(', ')||'เลือกผู้ไปงาน')}</span><span aria-hidden="true">▾</span></summary><fieldset ${disabled?'disabled':''}><legend>เลือกได้มากกว่า 1 คน</legend>${staffNames.map(name=>`<label><input type="checkbox" data-staff-option value="${name}" ${names.includes(name)?'checked':''}><span>${name}</span></label>`).join('')}</fieldset></details><p class="ev-staff-help">ติ๊กได้หลายชื่อ · เอาเครื่องหมายออกเพื่อยกเลิก</p><div class="ev-staff-editor-actions"><button type="button" data-staff-save ${disabled?'disabled':''}>บันทึกกำลังคน</button><button type="button" data-staff-reload ${state.staff?.error?'':'hidden'}>โหลดแผนล่าสุด</button></div><p role="status" aria-live="polite" data-staff-feedback>${e(state.staff?.error||(!state.staff?.canEdit?'บัญชีนี้ดูแผนได้อย่างเดียว':''))}</p></section>`;
}

export function bindStaffDropdown(editor,item,state,{api,onSaving,onSaved,onFinished}){
 if(!editor)return;
 const key=staffKey(item),fields=[...editor.querySelectorAll('[data-staff-option]')],save=editor.querySelector('[data-staff-save]'),reload=editor.querySelector('[data-staff-reload]'),feedback=editor.querySelector('[data-staff-feedback]'),summary=editor.querySelector('[data-staff-selection]');
 let busy=false,revision=state.staff?.items?.[key]?.revision||null;
 const selection=()=>fields.filter(field=>field.checked).map(field=>field.value);
 const label=()=>{summary.textContent=selection().join(', ')||'เลือกผู้ไปงาน';};
 fields.forEach(field=>field.addEventListener('change',()=>{label();feedback.textContent='ยังไม่ได้บันทึก';}));
 save.addEventListener('click',async()=>{
  if(busy||!state.staff?.canEdit||state.staff?.error)return;
  busy=true;save.disabled=true;fields.forEach(field=>field.disabled=true);feedback.textContent='กำลังบันทึก…';onSaving?.();
  try{
   const value=await api('/api/events/staff',{method:'PUT',body:JSON.stringify({key,names:selection(),revision})});
   state.staff.items[key]=value;revision=value.revision;state.staffMessage='บันทึกแล้ว';feedback.textContent='บันทึกกำลังคนแล้ว';editor.querySelector('details').open=false;onSaved?.();
  }catch(error){feedback.textContent=error.message+' · ยังไม่ได้บันทึก ชื่อที่เลือกยังอยู่';reload.hidden=false;}
  finally{busy=false;save.disabled=false;fields.forEach(field=>field.disabled=false);onFinished?.();}
 });
 reload.addEventListener('click',async()=>{
  if(busy)return;busy=true;reload.disabled=true;save.disabled=true;feedback.textContent='กำลังโหลดแผนล่าสุด…';
  try{state.staff=await api('/api/events/staff');const value=state.staff.items[key]||{names:[],revision:null};revision=value.revision;fields.forEach(field=>{field.checked=value.names.includes(field.value);field.disabled=!state.staff.canEdit;});editor.querySelector('fieldset').disabled=!state.staff.canEdit;label();reload.hidden=true;feedback.textContent='โหลดแผนล่าสุดแล้ว';onSaved?.();}
  catch(error){feedback.textContent=error.message;}
  finally{busy=false;reload.disabled=false;save.disabled=!state.staff?.canEdit||!!state.staff?.error;}
 });
}
