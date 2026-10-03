import {escapeHtml as esc} from './api.mjs';
const examples=['สาขาไหนยอดตกเยอะสุด','ตอนนี้ Kirion มีกี่ชิ้นในสาขาสนามเทพ','สาขาไหนยอดโตมากที่สุด','ยอดขายรวมเดือนนี้เท่าไร'];
const stamp=value=>value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}):'ไม่ระบุ';
export async function render(app){
 document.title='วิเคราะห์ และ ถาม-ตอบ · VING Warroom';
 const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/analysis.css';document.head.append(css);
 app.classList.add('analysis-page');
 app.innerHTML=`<section class="qa-heading"><div><span class="qa-eyebrow">VING / DATA ASSISTANT</span><h1>วิเคราะห์ และ ถาม-ตอบ</h1><p>ถามยอดขายหรือสต็อก แล้วดูคำตอบพร้อมตัวเลขอ้างอิง</p></div><span class="qa-mode" role="status">กำลังตรวจการเชื่อมต่อ…</span></section><div class="qa-layout"><section class="qa-workspace" aria-label="ถามข้อมูลในเว็บ"><div class="qa-thread-head"><span>คำถามของคุณ</span><button type="button" data-qa-control data-qa-clear>เริ่มบทสนทนาใหม่</button></div><div class="qa-messages" role="log" aria-label="บทสนทนา" aria-live="polite"><div class="qa-welcome"><span class="qa-mark" aria-hidden="true">V</span><h2>อยากรู้อะไรจากข้อมูลวันนี้?</h2><p>เลือกคำถามด้านล่าง หรือพิมพ์คำถามของคุณ</p><div class="qa-examples">${examples.map((q,i)=>`<button type="button" data-qa-control data-question="${esc(q)}"><span>${i===1?'STOCK':'SALES'}</span>${esc(q)}<b aria-hidden="true">↗</b></button>`).join('')}</div></div></div><form class="qa-composer" data-qa-form><label for="qa-question">ถามข้อมูลยอดขาย / สต็อก</label><textarea id="qa-question" data-qa-control rows="2" maxlength="800" placeholder="เช่น Kirion สาขาสนามเทพมีเหลือกี่ชิ้น?" required></textarea><div class="qa-compose-actions"><span>Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่</span><button type="submit" data-qa-control>ส่งคำถาม <span aria-hidden="true">↑</span></button></div></form><p class="qa-request-status" role="status"></p></section><aside class="qa-context"><section><span class="qa-eyebrow">ข้อมูลที่ถามได้</span><h2>คำตอบที่ย้อนดูได้</h2><a href="/daily-sales"><b>ยอดขายสาขา ↗</b><span>ยอดสะสม · สาขาโต / ตก · เทียบปีก่อน</span></a><a href="/branch-stock"><b>สต็อกสาขา ↗</b><span>รุ่น · สี · ไซซ์ · ปกติ / On-Hold</span></a></section><section class="qa-notes"><h3>อ่านตัวเลขให้ตรงกัน</h3><p>“ยอดตก” เริ่มจากคาดการณ์ปิดเดือนเทียบเดือนเดียวกันปีก่อน และเรียงตามจำนวนเงินบาทที่ลดลง</p><p>ระบุ “ยอดจริงช่วงเดียวกัน” หรือ “เทียบเดือนก่อน” เพื่อเปลี่ยนฐานเทียบ</p><p>สต็อกอ้างอิงเวลาที่ต้นทางอัปเดต หากข้อมูลไม่พอ ระบบจะขอรายละเอียดเพิ่ม</p></section><p class="qa-session-note">บทสนทนาอยู่เฉพาะหน้าที่เปิดนี้</p></aside></div>`;
 const form=app.querySelector('form'),input=app.querySelector('textarea'),messages=app.querySelector('.qa-messages'),status=app.querySelector('.qa-request-status'),mode=app.querySelector('.qa-mode'),clear=app.querySelector('[data-qa-clear]');
 // Keep the question input within the first viewport and the result beneath it.
 messages.before(form,status);
 document.querySelector('.page-sources')?.remove();
 let context=null,busy=false,controller;
 try{const response=await fetch('/api/analysis/status',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();mode.textContent=data.aiConfigured?'AI พร้อมช่วยอ่านคำถาม':'ค้นหาจากข้อมูล · AI รอเชื่อมต่อ';}catch{mode.textContent='ยังตรวจการเชื่อมต่อไม่ได้';}
 const welcome=messages.innerHTML;
 const scroll=()=>messages.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'});
 function answerHTML(data){return `<div class="qa-answer-top"><span class="qa-avatar" aria-hidden="true">V</span><span>${data.engine==='ai'?'AI · วิเคราะห์ข้อมูล':'คำตอบจากข้อมูลในเว็บ'}</span></div><h2>${esc(data.title||'คำตอบ')}</h2><p class="qa-answer-text">${esc(data.answer)}</p>${data.metrics?.length?`<div class="qa-metrics">${data.metrics.map(m=>`<div><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join('')}</div>`:''}${data.table?.rows?.length?`<div class="qa-table-wrap" tabindex="0" role="region" aria-label="ตัวเลขอ้างอิง"><table><thead><tr>${data.table.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${data.table.rows.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${data.notes?.length?`<ul class="qa-answer-notes">${data.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:''}${data.sources?.length?`<div class="qa-sources">${data.sources.map(s=>`<a href="${esc(s.url)}">${esc(s.label)} ↗</a><span>${esc(s.period||'')} · ข้อมูล ${esc(stamp(s.updatedAt))}</span>`).join('')}</div>`:''}${data.suggestions?.length?`<div class="qa-followups">${data.suggestions.map(q=>`<button type="button" data-qa-control data-question="${esc(q)}">${esc(q)}</button>`).join('')}</div>`:''}`;}
 async function submit(question){
  if(busy||!question.trim())return;
  busy=true;controller=new AbortController();clear.disabled=true;form.querySelector('button').disabled=true;
  messages.querySelector('.qa-welcome')?.remove();
  const user=document.createElement('div');user.className='qa-user';user.textContent=question;messages.append(user);
  const reply=document.createElement('article');reply.className='qa-answer';reply.setAttribute('aria-busy','true');reply.innerHTML='<p class="qa-pending">กำลังอ่านข้อมูลที่เกี่ยวข้อง…</p>';messages.append(reply);input.value='';status.textContent='กำลังค้นหาคำตอบ…';scroll();
  try{
   const response=await fetch('/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,context}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
   const data=await response.json();if(!response.ok)throw Error(response.status===401?'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง':data.error||'ยังอ่านข้อมูลไม่ได้ กรุณาลองอีกครั้ง');
   reply.innerHTML=answerHTML(data);context=data.context||context;status.textContent='ตอบแล้ว · ตรวจช่วงข้อมูลได้ที่ท้ายคำตอบ';
  }catch(error){reply.innerHTML=`<h2>ยังตอบคำถามนี้ไม่ได้</h2><p>${esc(error.name==='TimeoutError'?'ต้นทางใช้เวลานาน กรุณาลองอีกครั้ง':error.message)}</p><button type="button" data-qa-control data-question="${esc(question)}">ลองอีกครั้ง</button>`;status.textContent='คำถามยังไม่สำเร็จ';}
  finally{reply.setAttribute('aria-busy','false');busy=false;clear.disabled=false;form.querySelector('button').disabled=false;scroll();input.focus({preventScroll:true});}
 }
 form.addEventListener('submit',event=>{event.preventDefault();submit(input.value.trim());});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
 app.addEventListener('click',event=>{const button=event.target.closest('[data-question]');if(button)submit(button.dataset.question);});
 clear.addEventListener('click',()=>{if(busy)return;context=null;messages.innerHTML=welcome;messages.scrollTop=0;status.textContent='';input.value='';input.focus();});
 const banner=document.querySelector('.readonly-banner');if(banner)banner.textContent='วิเคราะห์ และ ถาม-ตอบ · อ้างอิงข้อมูลใน Warroom';
}
