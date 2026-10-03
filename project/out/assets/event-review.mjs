import {imageGalleryMarkup,bindImageGallery} from './event-images.mjs';
import {eventMonthLabel,proposalScenarios,proposalScenarioIndex,pcShiftHours} from './event-planning-fields.mjs';
import {escapeHtml as e} from './api.mjs';
import {numeric,baselineMonthLabel,targetGoalsFor,targetGoalLabel} from './event-predict-model.mjs';
import {costStatement} from './event-cost-statement.mjs';
import {reviewHistoryMarkup,renderReviewHistory} from './event-review-history.mjs';

const number=v=>numeric(v);
const money=v=>number(v)===null?'—':new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number(v));
const count=v=>number(v)===null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(number(v));
const baht=v=>number(v)===null?'—':'฿'+money(v);
const percent=v=>number(v)===null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(number(v))+'%';
const tone=v=>number(v)!==null&&number(v)<0?'er-negative':'';
const stamp=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่ระบุเวลา';
const titles=['Downside · ต่ำกว่าคาดการณ์','Base case · ตามคาดการณ์','Upside · สูงกว่าคาดการณ์'];
const caseTitles=model=>model.costTarget?['ต่ำกว่าเป้า ','เป้ายอดขาย ','สูงกว่าเป้า '].map(label=>label+targetGoalLabel(model.input)):titles;
const emptyCase=()=>({sales:null,profit:null,costs:null,roi:null,cogs:null,space:null,pc:null});

export function reviewModel(row){
 const saved=row.source==='web'&&row.calculation?.base;
 const input=saved?{roiPercent:40,pcPercent:14,...row.input}:{};
 const sales=number(row.sales),profit=number(row.profit);
 const derivedCosts=sales!==null&&profit!==null&&sales-profit>=0?sales-profit:null;
 const baselineCase=saved?row.calculation.base:{...emptyCase(),sales,profit,costs:derivedCosts,roi:derivedCosts>0?profit/derivedCosts*100:null};
 const cases=saved?[row.calculation.scenarios?.[0]||emptyCase(),baselineCase,row.calculation.scenarios?.[2]||emptyCase()]:[emptyCase(),baselineCase,emptyCase()];
 const proposalIndex=proposalScenarioIndex(input.proposalScenario),base=saved&&row.calculation.proposed?row.calculation.proposed:baselineCase;
 const days=number(input.days??row.days);
 const breakEven=saved?number(row.calculation.breakEven):null;
 return {saved:Boolean(saved),costTarget:Boolean(saved&&input.salesMode==='cost-target'),input,base,cases,days,breakEven,proposalIndex,noBreakEven:Boolean(saved&&row.calculation.noBreakEven),
  daily:days>0&&number(base.sales)!==null?base.sales/days:null,
  margin:number(base.sales)>0&&number(base.profit)!==null?base.profit/base.sales*100:null,
  headroom:breakEven!==null&&number(base.sales)!==null?base.sales-breakEven:null,
  legacy:Boolean(saved&&!row.calculation.proposed&&input.salesMode!=='cost-target'&&base.label!=='ตามคาดการณ์')};
}
function status(label,value){
 const kind=value==='อนุมัติ'?'approved':value==='ไม่อนุมัติ'?'rejected':'pending';
 return `<span class="er-status ${kind}">${label} · ${e(value||'ยังไม่ระบุ')}</span>`;
}
function metric(label,value,kind=''){return `<article class="er-metric"><span>${label}</span><strong class="${kind}">${value}</strong></article>`;}
function pair(label,value){return `<div><dt>${label}</dt><dd>${value}</dd></div>`;}
function caseNote(model,index){
 if(model.costTarget)return index===1?'ยอดขายที่ต้องทำตามเป้า '+targetGoalLabel(model.input):`${percent(model.input[index===0?'downside':'upside'])} ${index===0?'ต่ำกว่า':'สูงกว่า'}เป้า ${targetGoalLabel(model.input)}`;
 if(index===1)return model.saved?(model.input.mode==='manual'?'ยอดประมาณการที่ผู้เสนอกรอก':'ยอดคาดการณ์จากประวัติ ณ วันที่เสนอ'):'ยอดคาดการณ์ในชีตเสนอ Event';
 if(!model.saved)return 'ยังไม่มีสมมติฐานในรายการนี้';
 const variation=model.input[index===0?'downside':'upside'];
 return `${percent(variation)} ${index===0?'ต่ำกว่า':'สูงกว่า'} ${model.legacy?'เป้าหมาย (คำขอเดิม)':'Base case'}`;
}
function scenarioCards(model,selected){
 return `<div class="er-scenarios" role="group" aria-label="เลือกกรณีเพื่อดูงบกำไรขาดทุน">${model.cases.map((s,i)=>`<button type="button" data-review-case="${i}" aria-pressed="${i===selected}" ${!model.saved&&i!==1?'disabled':''} class="er-case ${i===model.proposalIndex?'er-base':''}"><span class="er-case-title">${caseTitles(model)[i]}${model.saved&&i===model.proposalIndex?' · ใช้เสนออนุมัติ':''}</span><small>${e(caseNote(model,i))}</small><span class="er-case-row"><span>ยอดขาย</span><b>${baht(s.sales)}</b></span><span class="er-case-row"><span>กำไร / ขาดทุน</span><b class="${tone(s.profit)}">${baht(s.profit)}</b></span><span class="er-case-row"><span>ROI</span><b class="${tone(s.roi)}">${percent(s.roi)}</b></span>${model.saved?'<span class="er-case-action">ดูงบกรณีนี้ ↓</span>':''}</button>`).join('')}</div>`;
}
function statement(model,selected){
 return costStatement(model.cases[selected],model.input).replace('กรณีตามคาดการณ์ · % ของยอดขายหลังส่วนลด',`${caseTitles(model)[selected]} · % ของยอดขายหลังส่วนลด`)+(!model.saved?'<p class="fp-warning">ชีตมีเฉพาะยอดขายและกำไร ต้นทุนรวมคำนวณจากยอดขาย − กำไร ยังไม่มีรายละเอียดต้นทุนและสมมติฐานสำหรับ Downside / Upside · [ต้องถามเจ้าของ]</p>':'');
}
export function reviewMarkup(row,source={},selected=null,canEdit=false){
 const m=reviewModel(row),input=m.input,b=m.base;selected??=m.proposalIndex;
 const sourceNote=m.saved?'ตัวเลขและเงื่อนไขที่บันทึกตอนเสนอ Event':source.status==='stale'?'ข้อมูลชีตล่าสุดที่อ่านได้ · ยังเชื่อมต่อต้นทางไม่ได้':'ข้อมูลจากชีตเสนอ Event';
 const terms=m.saved?[
  pair('รูปแบบพื้นที่',input.channel==='gp'?'ลานโปร · GP':'เก็บเงินเอง · ค่าเช่า'),
  pair(input.channel==='gp'?'GP ต่อยอดขาย':'ค่าเช่ารวม / งาน',input.channel==='gp'?percent(input.gp):baht(input.rent)),
  pair('ต้นทุนสินค้า / ยอดขาย',percent(input.cogs)),
  pair(input.pcCostMode==='person'?'PC / คน / วัน':'PC รวมทุกคน / วัน',baht(input.wageMode==='source'?row.calculation.compensation?.wage?.daily??input.pc:input.pc)),
  ...(input.compensationMode==='catalog'?[
   pair('ค่าคอม + โบนัสทีมคาดการณ์',baht(b.incentive)),
   pair('ค่าคอม + โบนัส / คน',baht(b.incentivePerPerson)),
   pair('เรทค่าแรงอ้างอิง',input.wageMode==='manual'?'ปรับค่าแรงเอง':e((row.calculation.compensation?.wageProfile?.source?.sheet||'')+' · '+(row.calculation.compensation?.wageProfile?.dates||''))),
   pair('เกณฑ์ Incentive',input.incentiveMode==='manual'?'ระบุยอดรวมเอง':e((row.calculation.compensation?.profile?.source?.sheet||'')+' · '+(row.calculation.compensation?.profile?.dates||''))),
   ...(row.calculation.compensation?.profile?.commission?.kind==='excess'&&input.incentiveMode==='source'?[pair('สมมติฐานขั้นคอม',input.commissionMethod==='cumulative'?'เกิน 200,000 บวกคอม 2,000 แรกด้วย':'เกิน 200,000 คิดเฉพาะส่วนเกิน')]:[]),
   pair('ฐาน Incentive','เรทEvent.xlsx · ยอดงานนี้หลังส่วนลด · รวมต้นทุนก่อนหัก 3%')
  ]:[]),
  pair('ขนส่ง / งาน',baht(input.shipping)),pair('ค่าใช้จ่ายอื่น / งาน',baht(input.other)),
  pair('เป้าหมายยอดขาย',baht(row.calculation.target?.sales)),
  pair('เงื่อนไขเป้าหมาย',targetGoalsFor(input).length?e(targetGoalLabel(input))+(input.targetMode==='pc'||input.targetMode==='roi-pc'?' · ค่า PC ไม่เกิน '+e(input.pcPercent??14)+'% ของยอดขายหลังส่วนลด':''):input.targetMode==='history'?'ใช้เป้าเดิม':'กำหนดยอดขายเอง')
 ].join(''):'<p class="fp-hint">ยังไม่มีเงื่อนไขต้นทุนแยกหมวดในชีต · [ต้องถามเจ้าของ]</p>';
 const baseline=m.costTarget?`<p>พื้นที่ใหม่ · คำนวณยอดขายเป้า ${targetGoalLabel(input)} จากต้นทุนที่ผู้เสนอกรอก</p>`:m.saved?(input.mode==='manual'?'<p>พื้นที่ใหม่ · ใช้ยอดขายประมาณการที่ผู้เสนอกรอก</p>':`<p><strong>${e(row.reference?.label||baselineMonthLabel(input.baselineMonth))}</strong></p><p>Baseline ${baht(row.calculation.baseline?.rate)} / วัน จาก ${count(row.calculation.observations)} งานที่ใช้คำนวณ</p><p>ยอดรวม ${baht(row.calculation.baseline?.sales)} / ${count(row.calculation.baseline?.days)} วันขาย</p>`):'<p>ยอดคาดการณ์ตามชีต ยังไม่มีข้อมูลวิธีสร้าง Baseline ในรายการนี้</p>';
 return `<a class="er-back" href="/event-proposals${row.id?'?request='+encodeURIComponent(row.id):''}">← กลับรายการเสนอ Event</a>
 <header class="er-heading"><div><p class="fp-eyebrow">EVENT / CEO REVIEW</p><h1>${e(row.place||row.name||'Event')}</h1><p>${row.name&&row.name!==row.place?e(row.name)+' · ':''}${e(row.dates||'ยังไม่ระบุวันที่จัด')} · ${m.days===null?'ยังไม่ระบุจำนวนวัน':count(m.days)+' วันขาย'}</p></div><div class="er-statuses">${status('Trade',row.trade)}${status('CEO',row.ceo)}</div></header>
 ${canEdit&&m.saved?`<a class="er-edit" href="/event-predict?edit=${encodeURIComponent(row.id)}">แก้ไขข้อเสนอ</a>`:''}
 <p class="er-source" role="status">${sourceNote} · ${e(stamp(m.saved?(row.updatedAt||row.createdAt):source.fetched_at))}${m.saved?' · ไม่คำนวณทับด้วยประวัติใหม่':''}</p>
 ${(row.planningNotes||[]).map(note=>`<p class="fp-warning">${e(note)}</p>`).join('')}
 <section aria-label="สรุปกรณีที่เสนอ"><div class="er-section-title"><h2>${m.saved&&row.calculation.proposed?'ภาพรวม · '+caseTitles(m)[m.proposalIndex]+' · กรณีที่เสนอ':m.costTarget?'ภาพรวม · เป้า '+targetGoalLabel(input):'ภาพรวม · Base case'}</h2><span>ก่อนส่วนกลางและภาษีเงินได้</span></div><div class="er-metrics">${metric('ยอดขายหลังส่วนลด',baht(b.sales))}${metric('กำไร / ขาดทุนของ Event',baht(b.profit),tone(b.profit))}${metric('อัตรากำไรต่อยอดขาย',percent(m.margin),tone(m.margin))}${metric('ROI · กำไรต่อต้นทุน',percent(b.roi),tone(b.roi))}</div><div class="er-summary-line"><span>เฉลี่ย <b>${baht(m.daily)} / วัน</b></span><span>ต้นทุนรวม <b>${baht(b.costs)}</b></span><span>ยอดขายคุ้มทุน <b>${m.noBreakEven?'ไม่ถึงจุดคุ้มทุน':baht(m.breakEven)}</b></span>${m.headroom===null?'':`<span>${m.headroom>=0?'ยอดขายสูงกว่าคุ้มทุน':'ยอดขายยังขาดถึงคุ้มทุน'} <b class="${tone(m.headroom)}">${baht(Math.abs(m.headroom))}</b></span>`}</div></section>
 ${imageGalleryMarkup(row.attachments||[],row.id)}
 <div class="er-layout"><section class="er-financials"><div class="er-section-title"><h2>เปรียบเทียบ 3 กรณี</h2></div><p class="fp-hint">${m.saved?'เลือกกรณีเพื่อดูงบกำไรขาดทุนแยกรายการ · ใช้เงื่อนไขที่บันทึกไว้ตอนเสนอ':'Base case แสดงตัวเลขจากชีต · อีกสองกรณีรอข้อมูลสมมติฐาน'}</p><div id="er-cases">${scenarioCards(m,selected)}</div>${m.legacy?'<p class="fp-warning">คำขอเดิมใช้กรณีต่ำ/สูงเทียบเป้าหมาย จึงอาจไม่ได้อยู่ต่ำ/สูงกว่า Base case ตัวเลขคงตามชุดที่บันทึกไว้</p>':''}<div id="er-statement" aria-live="polite">${statement(m,selected)}</div><p class="fp-hint">ROI = กำไร ÷ ต้นทุนรวม · อัตรากำไร = กำไร ÷ ยอดขาย<br>ตัวเลขคาดการณ์ใช้ประกอบการพิจารณาอนุมัติ</p></section>
 <aside class="er-assumptions"><h2>เงื่อนไขของ Event</h2><dl>${pair('ผู้ขออนุมัติ',e(row.submittedBy?.name||'ไม่ได้บันทึกชื่อ'))}${input.eventSeries==='baan-suan'?pair('Event พิเศษ','บ้านและสวน')+pair('สถานที่จัด',e(input.eventLocation||row.place)):''}${pair('เวลาทำงาน PC',input.pcStartTime&&input.pcEndTime?e(input.pcStartTime+'–'+input.pcEndTime)+' · '+count(pcShiftHours(input.pcStartTime,input.pcEndTime))+' ชม. / วัน':'ยังไม่ระบุ')}${pair('ชั้นที่จัด',e(input.floor||row.floor||'—'))}${pair('ประเภท',e((input.eventTypes||row.eventTypes||[]).join(', ')||'—'))}${pair('เดือนที่จัด',e(eventMonthLabel(input.eventMonth||row.month)))}${pair('วันที่จัด',e(row.dates||'—'))}${pair('จำนวนวันจัด',m.days>0?count(m.days)+' วัน':'ยังไม่ระบุ')}${pair('พื้นที่',number(input.area??row.area)===null?'—':count(input.area??row.area)+' ตร.ม.')}${pair('จำนวน PC',number(input.pcCount??row.pc)===null?'—':count(input.pcCount??row.pc)+' คน')}${pair('วันที่เสนอ',e(row.proposalDate||input.proposalDate||'—'))}${pair('คอนเฟิร์มภายใน',e(row.confirmBy||input.confirmBy||'—'))}${terms}</dl><details class="er-reference" open><summary>ข้อมูลอ้างอิงและสมมติฐาน</summary>${baseline}<p>${m.saved?'คงผลคำนวณที่เสนอไว้ แม้ประวัติยอดขายจะอัปเดตภายหลัง':'ข้อมูลที่ยังไม่มีแสดง — และไม่ถูกนับเป็น 0'}</p></details></aside></div>`;
}
export async function renderEventReview(root){
 document.title='คาดการณ์ราย Event · VING';root.classList.add('event-review');
 const banner=document.querySelector('.readonly-banner');if(banner)banner.textContent='คาดการณ์ราย Event · ข้อมูลสำหรับพิจารณาอนุมัติ';
 root.innerHTML='<a class="er-back" href="/event-proposals">← กลับรายการเสนอ Event</a><section class="fp-empty" role="status"><h1>กำลังเปิดคาดการณ์ของ Event…</h1></section>';
 const key=new URLSearchParams(location.search).get('proposal');
 try{
  const response=await fetch('/api/event-proposals/detail?key='+encodeURIComponent(key||''),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.status===401){location.assign('/login?next='+encodeURIComponent(location.pathname+location.search));return;}
  const result=await response.json();if(!response.ok)throw Error(result.error||'ยังโหลดข้อมูล Event ไม่สำเร็จ');
  if(!result.item)throw Error('ไม่พบข้อมูล Event นี้');
  const row=result.item,model=reviewModel(row);
  document.title=(row.place||row.name)+' · คาดการณ์ Event · VING';root.innerHTML=reviewMarkup(row,result.source,model.proposalIndex,result.permissions?.canEdit)+reviewHistoryMarkup(row);
  bindImageGallery(root,row.attachments,row.id);
  root.addEventListener('click',event=>{const button=event.target.closest('[data-review-case]');if(!button||button.disabled)return;
   const selected=Number(button.dataset.reviewCase);if(![0,1,2].includes(selected))return;
   for(const el of root.querySelectorAll('[data-review-case]'))el.setAttribute('aria-pressed',String(el===button));
   root.querySelector('#er-statement').innerHTML=statement(model,selected);
  });
  await renderReviewHistory(root,row);
 }catch(error){root.innerHTML=`<a class="er-back" href="/event-proposals">← กลับรายการเสนอ Event</a><section class="fp-empty" role="alert"><h1>ยังเปิดคาดการณ์ไม่ได้</h1><p>${e(error.name==='TimeoutError'?'โหลดข้อมูลนานกว่าปกติ กรุณาลองใหม่':error.message)}</p><button type="button" id="er-retry">ลองใหม่</button></section>`;root.querySelector('#er-retry').onclick=()=>renderEventReview(root);}
}
