import {compensationContext,compensationProfilesFor} from './event-compensation.mjs';
const ce=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cash=value=>value===null||value===undefined?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(value);
export function compensationPanelMarkup(input,place) {
 const context=compensationContext(input),profiles=compensationProfilesFor(place,input.eventLocation),p=context.profile,w=context.wageProfile;
 const active=context.active;
 const missing=!profiles.length;
 const fallback=p&&w&&p.id!==w.id;
 const rule=p?.commission;
 const notes=[...(p?.notes||[]),...(w&&w!==p?w.notes||[]:[])];
 if(context.wage?.range?.min!==context.wage?.range?.max&&w?.wage?.kind==='range')notes.push(`ต้นฉบับระบุ ${cash(context.wage.range.min)}–${cash(context.wage.range.max)} บาท/วัน · ตั้งงบด้วยเรทสูงสุด ปรับเองได้`);
 if(context.wage?.calendarEstimated)notes.push('ยังไม่เลือกช่วงวันที่ · ตั้งงบด้วยเรทสูงสุดก่อน เลือกวันที่เพื่อแยกเรทรายวัน');
 if(w?.wage.issue)notes.push(w.wage.issue);
 if(rule?.kind==='excess')notes.push('ช่วงแรกเริ่ม 150,001 บาท และยอด 200,000 พอดีใช้ 1% เป็นสมมติฐานคาดการณ์ [ต้องถามเจ้าของ]');
 if(['tiers','large-event','bonus-person'].includes(rule?.kind))notes.push('ประมาณการใช้อัตราขั้นสูงสุดที่ยอดถึงเพียงขั้นเดียว ไม่บวกสะสมหลายขั้น');
 return `<section class="fp-compensation-panel" aria-label="ค่าแรงและ Incentive ตามสถานที่"><div class="fp-compensation-head"><h3>ค่าแรงและ Incentive</h3><span>${active?'อ้างอิง เรทEvent.xlsx':'เงื่อนไขที่บันทึกไว้เดิม'}</span></div>${!active?'<p>ข้อเสนอเดิมยังใช้ค่า PC ที่บันทึกไว้</p><button type="button" id="fp-use-rate-catalog" class="fp-secondary">ใช้เรทจากสถานที่</button>':`
 ${missing?`<p class="fp-rate-notice">${input.eventSeries==='baan-suan'&&!input.eventLocation?'ระบุสถานที่จัดบ้านและสวน เพื่อเลือกเรทของไบเทคหรือเมืองทอง':'ยังไม่มีเกณฑ์ของสถานที่นี้ในไฟล์ · กรอกค่าแรงและค่าคอมเอง [ต้องถามเจ้าของ]'}</p>`:`<label for="fp-rate-profile">รอบงานที่ใช้อ้างอิง<select id="fp-rate-profile">${profiles.map(profile=>`<option value="${ce(profile.id)}" ${profile.id===input.rateProfile?'selected':''}>${ce(profile.dates||profile.source.sheet)} · ${ce(profile.name)}</option>`).join('')}</select></label>`}
 <div class="fp-rate-number"><div><span>${input.wageMode==='source'?'ค่าแรงตั้งต้น / คน / วัน':'ค่าแรงที่ปรับเอง'}</span><strong>${input.wageMode==='source'&&context.wage?.daily!=null?'฿'+cash(context.wage.daily):input.pc!==''?'฿'+cash(Number(input.pc)):'รอระบุค่าแรง'}</strong></div><button type="button" id="fp-wage-reset" class="fp-secondary" ${!w?'disabled':''}>ใช้เรทอ้างอิง</button></div>
 ${w?`<p class="fp-hint">${ce(w.rateText)}${w.wage?.kind==='calendar'?'<br>คำนวณตามวันจริงเมื่อเลือกวันเริ่ม–สิ้นสุด':''}<br>${ce(w.source.sheet+'!'+w.source.rateCell)} · ${ce(w.dates)}</p>`:''}
 ${fallback?'<p class="fp-rate-notice">รอบที่เลือกไม่มีค่าแรงครบ ใช้เรทจากรอบที่มีข้อมูลล่าสุดด้านบนเพื่อประมาณการ [ต้องถามเจ้าของ]</p>':''}
 ${p&&!w?'<p class="fp-rate-notice">ไฟล์ยังไม่ระบุค่าแรงครบสำหรับสถานที่นี้ กรุณากรอกค่าแรงเอง [ต้องถามเจ้าของ]</p>':''}
 <label for="fp-incentive-mode">วิธีคาดการณ์ค่าคอม<select id="fp-incentive-mode"><option value="source" ${input.incentiveMode==='source'?'selected':''} ${!rule?'disabled':''}>ตามเกณฑ์รอบงาน</option><option value="manual" ${input.incentiveMode==='manual'?'selected':''}>ระบุค่าคอมและโบนัสรวมเอง</option></select></label>
 ${input.incentiveMode==='manual'?`<label for="fp-incentive-amount">ค่าคอม + โบนัสรวมทั้งทีม / งาน<input id="fp-incentive-amount" type="number" min="0" max="10000000000" step="any" value="${ce(input.incentiveAmount)}" placeholder="ระบุจำนวนเงิน"><small>กรอก 0 เมื่อยืนยันว่าไม่มีค่าคอมและโบนัส</small></label>`:''}
 ${rule?.kind==='excess'&&input.incentiveMode==='source'?`<label for="fp-commission-method">สมมติฐานเมื่อยอดเกิน 200,000<select id="fp-commission-method"><option value="excess" ${input.commissionMethod!=='cumulative'?'selected':''}>1.5% เฉพาะส่วนเกิน + โบนัสตามเกณฑ์</option><option value="cumulative" ${input.commissionMethod==='cumulative'?'selected':''}>บวก 1% ของ 200,000 แรกด้วย</option></select><small>ไฟล์ยังไม่ชัดเรื่องการสะสม เลือกสมมติฐานสำหรับงานนี้</small></label>`:''}
 ${p?.commissionText?`<details class="fp-rate-rule"><summary>ดูเกณฑ์ค่าคอมและโบนัส</summary><p>${ce(p.commissionText).replaceAll('\n','<br>')}</p><small>${ce(p.source.sheet+'!'+p.source.ruleCell)}</small></details>`:''}
 ${notes.length?`<details class="fp-rate-rule fp-rate-notes"><summary>ข้อสังเกตของเรทนี้ (${notes.length})</summary>${[...new Set(notes)].map(note=>`<p>${ce(note)}</p>`).join('')}</details>`:''}
 <p class="fp-hint">ค่าแรง ค่าคอม และโบนัสรวมเป็นต้นทุนก่อนหัก 3% · อัตรานี้ใช้คาดการณ์และปรับได้ตามงาน</p>`}</section>`;
}
export function compensationResultsMarkup(result,input,ready=true) {
 if(input.compensationMode!=='catalog')return '';
 const base=result.base,amount=n=>ready&&n!==null&&n!==undefined?'฿'+cash(n):'—';
 return `<section class="fp-compensation-results" aria-label="คาดการณ์ค่าแรงและค่าคอม"><h3>ค่าแรงและค่าคอมคาดการณ์</h3><div class="fp-compensation-totals"><div><span>ค่าแรงทั้งทีม / งาน</span><strong data-compensation="wages">${amount(base.pc)}</strong></div><div><span>ค่าคอม + โบนัสทั้งทีม</span><strong data-compensation="incentive">${amount(base.incentive)}</strong></div><div><span>ค่าคอม + โบนัส / คน</span><strong data-compensation="per-person">${amount(base.incentivePerPerson)}</strong></div></div><p class="fp-hint">หารเท่าตามจำนวน PC ${ce(input.pcCount||'—')} คน · รวมในต้นทุน กำไร และ ROI แล้วเมื่อข้อมูลครบ</p><div class="fp-statement-scroll"><table class="fp-statement-table"><thead><tr><th scope="col">กรณี</th><th scope="col">คอมทีม</th><th scope="col">โบนัสทีม</th><th scope="col">ค่าแรง + Incentive</th></tr></thead><tbody>${result.scenarios.map(s=>`<tr><th scope="row">${ce(s.label)}</th><td>${amount(s.commission)}</td><td>${amount(s.bonus)}</td><td>${amount(s.staffTotal)}</td></tr>`).join('')}</tbody></table></div><p class="fp-hint">ยอดขายที่ใช้คิดค่าคอมเป็นยอดคาดการณ์หลังส่วนลดของงานนี้ · ยังไม่รวมยอดสะสมของรอบอื่น</p></section>`;
}
