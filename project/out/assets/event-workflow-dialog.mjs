import {escapeHtml as e} from './api.mjs';
import {eventWorkflowStatus,workflowLabels,fullyApproved} from './event-workflow.mjs';

function mountDialog(title,content){
 const trigger=document.activeElement,dialog=document.createElement('dialog');
 dialog.className='ving-confirm proposal-workflow-dialog';
 dialog.setAttribute('aria-labelledby','proposal-dialog-title');
 dialog.innerHTML=`<h2 id="proposal-dialog-title">${e(title)}</h2>${content}`;
 document.body.append(dialog);dialog.showModal();
 dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus?.({preventScroll:true});},{once:true});
 return dialog;
}
export function openProposalDetails(row,details){
 const status=eventWorkflowStatus(row);
 const dialog=mountDialog(row.place||'รายละเอียด Event',`<p>${e(row.dates||'ยังไม่ระบุวันจัด')}</p><div class="proposal-detail-status"><span class="proposal-workflow-badge ${status}">${e(workflowLabels[status])}</span><span>Trade: ${e(row.trade||'รออนุมัติ')} · CEO: ${e(row.ceo||'รออนุมัติ')}</span></div>${row.workflow?.note?`<div class="proposal-note-full"><strong>เหตุผลที่ยกเลิก</strong><p>${e(row.workflow.note)}</p></div>`:''}${row.workflow?.updatedAt?`<p class="proposal-update-time">อัปเดตสถานะ ${e(new Date(row.workflow.updatedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))}</p>`:''}${row.source==='web'?details:`<p>ชื่อ Event: ${e(row.name||'—')}</p><p>ชั้น: ${e(row.floor||'—')} · จำนวนวัน: ${e(row.days||'—')}</p><p>วันที่เสนอ: ${e(row.proposalDate||'—')} · คอนเฟิร์มภายใน: ${e(row.confirmBy||'—')}</p>`}<footer><button type="button" class="confirm-cancel" data-close-dialog autofocus>ปิด</button></footer>`);
 const terms=dialog.querySelector('.proposal-request-details');if(terms)terms.open=true;
 dialog.querySelector('[data-close-dialog]').onclick=()=>dialog.close();
 return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(),{once:true}));
}
export function openWorkflowDialog(row,{canMutate=()=>true}={}){
 const current=eventWorkflowStatus(row),approved=fullyApproved(row);
 const initial=['scheduled','completed','cancelled'].includes(current)?current:'cancelled';
 const dialog=mountDialog('อัปเดตสถานะงาน',`<p>${e(row.place)}${row.dates?' · '+e(row.dates):''}</p><form><div class="proposal-detail-status"><span>Trade: ${e(row.trade||'รออนุมัติ')} · CEO: ${e(row.ceo||'รออนุมัติ')}</span></div><label for="proposal-workflow-select">สถานะงาน</label><select id="proposal-workflow-select" name="status" autofocus>${['scheduled','completed','cancelled'].map(status=>`<option value="${status}" ${status===initial?'selected':''} ${status!=='cancelled'&&!approved?'disabled':''}>${workflowLabels[status]}</option>`).join('')}</select>${!approved?'<p class="proposal-workflow-hint">รออนุมัติครบ 2 คนก่อนจัดงาน</p>':''}<div data-note-field><label for="proposal-cancel-note">เหตุผลที่ยกเลิก <span>จำเป็น</span></label><textarea id="proposal-cancel-note" name="note" rows="4" maxlength="1000" placeholder="ระบุเหตุผลหรือข้อมูลที่ทีมควรทราบ">${e(row.workflow?.note||'')}</textarea><small>ไม่เกิน 1,000 ตัวอักษร</small></div><p class="proposal-workflow-error" role="alert" aria-live="polite"></p><footer><button type="button" class="confirm-cancel" data-close-dialog>กลับ</button><button type="submit" class="confirm-submit">บันทึกสถานะ</button></footer></form>`);
 const form=dialog.querySelector('form'),select=form.elements.status,note=form.elements.note,submit=form.querySelector('[type=submit]'),close=form.querySelector('[data-close-dialog]'),error=form.querySelector('[role=alert]');
 form.dataset.draftContext=row.deletionKey;
 let saving=false,result=null;
 const update=()=>{const cancelled=select.value==='cancelled';form.querySelector('[data-note-field]').hidden=!cancelled;note.required=cancelled;submit.classList.toggle('is-danger',cancelled);error.textContent='';};
 select.addEventListener('change',update);update();
 note.addEventListener('input',()=>note.setCustomValidity(''));
 close.onclick=()=>{if(!saving)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  if(!canMutate()){error.textContent='ยังอัปเดตข้อมูลไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก';return;}
  if(select.value==='cancelled'&&!note.value.trim()){note.setCustomValidity('กรุณาระบุเหตุผลที่ยกเลิก');note.reportValidity();return;}
  saving=true;submit.disabled=true;close.disabled=true;select.disabled=true;note.disabled=true;submit.textContent='กำลังบันทึก…';error.textContent='';
  try{
   const response=await fetch('/api/event-proposals/status',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({key:row.deletionKey,status:select.value,note:note.value,revision:row.workflow?.revision||null,proposalRevision:row.updatedAt||row.createdAt||null}),signal:AbortSignal.timeout(15000)});
   const body=await response.json();if(!response.ok)throw Error(body.error||'บันทึกไม่สำเร็จ กรุณาลองใหม่');
   result=body.workflow;dialog.close();
  }catch(err){error.textContent=err.name==='TimeoutError'?'ยังยืนยันผลการบันทึกไม่ได้ กรุณาปิดหน้าต่างแล้วโหลดข้อมูลล่าสุดก่อนลองอีกครั้ง':err.message;}
  finally{saving=false;submit.disabled=false;close.disabled=false;select.disabled=false;note.disabled=false;submit.textContent='บันทึกสถานะ';}
 });
 return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(result),{once:true}));
}
