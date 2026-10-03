import {sectionTableExcelWorkbook,downloadExcelWorkbook} from './event-excel.mjs';
import {filterProposalMonth,proposalMonthOptions,proposalMonthLabel} from './proposal-months.mjs';
import {eventWorkflowStatus,workflowLabels} from './event-workflow.mjs';
import {openWorkflowDialog,openProposalDetails} from './event-workflow-dialog.mjs';
import {confirmAction} from './confirm-action.mjs';
import {installProposalMotion,animateProposalMetrics} from './event-proposals-motion.mjs';
import {eventMonthLabel,proposalScenarios,proposalScenarioIndex} from './event-planning-fields.mjs';
import {escapeHtml as e} from './api.mjs';
export const proposalColumns=[['trade','Trade approve'],['ceo','CEO approve'],['place','สถานที่'],['approvals','การอนุมัติ'],['workflow','สถานะงาน'],['slide','สไลด์ผู้บริหาร'],['name','ชื่อ Event'],['floor','ชั้นที่จัด'],['eventTypes','ประเภท'],['month','เดือนที่จัด'],['dates','วันที่จัด'],['proposalDate','วันที่เสนอ'],['confirmBy','คอนเฟิร์มภายใน'],['sales','คาดการณ์ยอดขาย'],['breakEven','ยอดขายคุ้มทุน'],['profit','คาดการณ์กำไร'],['margin','กำไรสุทธิ %'],['roi','ROI %'],['target','ยอดขายที่ตั้งเป้า'],['area','ขนาด (ตร.ม.)'],['days','จำนวนวัน'],['pc','จำนวน PC'],['actions','จัดการ']];
export const defaultProposalColumns=['place','approvals','workflow','month','sales','breakEven','profit','margin','actions'];
const storageKey='ving.event-proposals.columns.v5';
const numeric=new Set(['sales','profit','margin','roi','target','breakEven','area','days','pc']);
const number=value=>{
 const text=String(value??'').trim().replaceAll(',','');
 return /^-?\d+(\.\d+)?$/.test(text)&&Number.isFinite(Number(text))?Number(text):null;
};
const money=value=>value===null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(value);
export const proposalGroup=row=>row.input?.mode==='manual'||(!row.input?.mode&&[row.sales,row.profit].some(v=>String(v||'').trim()==='พื้นที่ใหม่'))?'new':'history';
const financialCase=row=>row.calculation?.proposed|| (proposalGroup(row)==='new'?(row.input?.salesMode==='cost-target'?row.calculation?.base:row.calculation?.target):row.calculation?.base);
export function proposalDisplayRow(row){
 if(row.calculation?.proposed)return row;
 if(proposalGroup(row)!=='new')return row;
 const financials=financialCase(row),sales=number(financials?.sales??row.target);
 return {...row,sales,profit:number(financials?.profit),margin:sales>0&&number(financials?.profit)!==null?financials.profit/sales*100:null,roi:number(financials?.roi),target:sales};
}
export function formatProposalValue(value,key){
 const percent=['margin','roi'].includes(key),raw=percent?String(value??'').trim().replace(/%$/,''):value;
 const n=number(raw);
 if(n===null)return String(value??'').trim()||'—';
 return money(['target','breakEven'].includes(key)?Math.ceil(n):n)+(percent?'%':'');
}
export function proposalBreakEven(row){
 const n=number(row.calculation?.breakEven);
 return n!==null&&n>=0?Math.ceil(n):null;
}
export function normalizeProposalColumns(value){
 const selected=Array.isArray(value)?value:defaultProposalColumns;
 return proposalColumns.map(([key])=>key).filter(key=>key==='place'||key==='workflow'||key==='actions'||selected.includes(key));
}
export function proposalFreshness(data) {
 if(data.recovery?.stale)return 'ยังอัปเดตข้อมูลไม่ได้ · แสดงรายการและสถานะที่โหลดสำเร็จล่าสุด · ดูอย่างเดียวจนกว่าจะเชื่อมต่อได้';
 const source=data.source||{};
 const time=source.fetched_at?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(source.fetched_at)):null;
 return (source.status==='online'?'เชื่อมต่อ Google Sheets · ตรวจข้อมูลทุก 15 วินาที':source.status==='stale'?'เชื่อมต้นทางไม่ได้ · แสดงข้อมูลที่ดึงสำเร็จล่าสุด':'ยังเชื่อมต่อชีตไม่ได้ · จะลองใหม่อัตโนมัติ')+(time?' · ดึงล่าสุด '+time:'');
}
export function summarizeProposals(items){
 const number=value=>{const s=String(value??'').trim().replaceAll(',','');return /^-?\d+(\.\d+)?$/.test(s)?Number(s):null;};
 const sum=key=>{const values=items.map(row=>number(row[key])).filter(v=>v!==null&&Number.isFinite(v));return {value:values.length?values.reduce((a,b)=>a+b,0):null,count:values.length};};
 const approved=items.filter(row=>proposalStatus(row)==='approved').length;
 const cancelled=items.filter(row=>proposalStatus(row)==='cancelled').length;
 const rejected=items.filter(row=>proposalStatus(row)==='rejected').length;
 return {total:items.length,approved,rejected,cancelled,pending:items.length-approved-rejected-cancelled,trade:items.filter(row=>row.workflow?.status!=='cancelled'&&row.trade==='อนุมัติ').length,ceo:items.filter(row=>row.workflow?.status!=='cancelled'&&row.ceo==='อนุมัติ').length,sales:sum('sales'),profit:sum('profit')};
}
export function summarizeProposalOutlook(items){
 const sum=values=>{const known=values.map(number).filter(value=>value!==null);return {value:known.length?known.reduce((total,value)=>total+value,0):null,count:known.length};};
 const group=key=>{
  // Classify the saved row before normalizing away legacy “พื้นที่ใหม่” markers.
  const rows=items.filter(row=>proposalGroup(row)===key);
  return {...sum(rows.map(row=>proposalDisplayRow(row).sales)),total:rows.length};
 };
 // A proposal's selected scenario is a forecast, while its target stays separate.
 const targets=items.map(row=>number(row.calculation?.target?.sales??row.target));
 return {new:group('new'),history:group('history'),target:{...sum(targets.map(value=>value===null?null:Math.ceil(value))),total:items.length}};
}
function approval(value,row,field,canApprove){
 const kind=value==='อนุมัติ'?'approved':value==='ไม่อนุมัติ'?'rejected':'pending';
 const badge=`<span class="proposal-status ${kind}"><span aria-hidden="true">${kind==='approved'?'✓':kind==='rejected'?'×':'○'}</span>${e(value||'ยังไม่ระบุ')}</span>`;
 if(!canApprove||!row?.deletionKey)return badge;
 return `<details class="proposal-approval-menu"><summary aria-label="เปลี่ยนสถานะ ${field==='trade'?'Trade':'CEO'} ${e(row.place)}">${badge}<span aria-hidden="true"> ▾</span></summary><div class="proposal-approval-options">${['อนุมัติ','ไม่อนุมัติ','รออนุมัติ'].map(status=>`<button type="button" data-approve-proposal="${e(row.deletionKey)}" data-field="${field}" data-status="${status}" ${status===value?'disabled':''}>${status}</button>`).join('')}</div></details>`;
}
const proposalIcons={
 all:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
 cancelled:'<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>',
 approved:'<path d="m6 12 4 4 8-8"/>',pending:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',rejected:'<path d="m7 7 10 10M17 7 7 17"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>'
};
const icon=key=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${proposalIcons[key]||proposalIcons.arrow}</svg>`;
const metric=(n,key)=>n===null?'—':`<span data-proposal-number="${n}" data-metric-key="${key}">${money(n)}</span>`;
export const proposalStatus=row=>row.workflow?.status==='cancelled'?'cancelled':row.trade==='ไม่อนุมัติ'||row.ceo==='ไม่อนุมัติ'?'rejected':row.trade==='อนุมัติ'&&row.ceo==='อนุมัติ'?'approved':'pending';
export const filterProposals=(items,status='all')=>status==='all'?items:items.filter(row=>proposalStatus(row)===status);
const statusLabels={cancelled:'ยกเลิก',all:'ทั้งหมด',approved:'อนุมัติครบแล้ว',pending:'รออนุมัติครบ',rejected:'ไม่อนุมัติ'};
function dashboard(data,active='all'){
 const s=summarizeProposals((data.items||[]).map(proposalDisplayRow)),available=data.source?.status!=='unavailable'||data.items?.length>0;
 const outlook=summarizeProposalOutlook(data.items||[]);
 const value=n=>available?n:null;
 const percent=n=>s.total?n/s.total*100:0;
 const rate=s.total?Math.round(percent(s.approved)):null;
 return `<div class="proposal-command">
 <section class="proposal-capital proposal-surface" aria-label="คาดการณ์รวม" data-proposal-light>
  <div class="proposal-panel-top"><span class="proposal-eyebrow">PORTFOLIO OUTLOOK</span><span class="proposal-data-tag">คาดการณ์ / ตั้งเป้า</span></div>
  <div class="proposal-capital-main"><h2>ยอดขายคาดการณ์แยกตามพื้นที่</h2><div class="proposal-outlook-grid">
   ${[['new','พื้นที่ใหม่','ยอดตั้งเป้า / กรณีที่เสนอ'],['history','พื้นที่ที่มีข้อมูล','คาดการณ์จากข้อมูลที่มี']].map(([key,label,note])=>`<section class="proposal-outlook-card" data-outlook="${key}" aria-label="${label}"><h3>${label}</h3><span class="proposal-outlook-note">${note}</span><strong class="proposal-capital-value"><small>฿</small>${metric(outlook[key].value,'sales-'+key)}</strong><p>มีตัวเลข <b>${outlook[key].count}</b> จาก ${outlook[key].total} งาน</p></section>`).join('')}
   <section class="proposal-outlook-card proposal-outlook-target" data-outlook="target" aria-label="เป้าหมายรวมทั้งหมด"><h3>เป้าหมายรวมทั้งหมด</h3><span class="proposal-outlook-note">รวมยอดตั้งเป้าของทั้งสองกลุ่ม</span><strong class="proposal-capital-value"><small>฿</small>${metric(outlook.target.value,'target-total')}</strong><p>มีเป้าหมาย <b>${outlook.target.count}</b> จาก ${outlook.target.total} งาน${outlook.target.count<outlook.target.total?` · ยังไม่มีเป้าหมาย ${outlook.target.total-outlook.target.count} งาน`:''}</p></section>
  </div></div>
  <div class="proposal-capital-bottom"><div><span>กำไรคาดการณ์ / เมื่อถึงเป้ารวม</span><strong class="${s.profit.value!==null&&s.profit.value<0?'is-loss':''}"><small>฿</small>${metric(s.profit.value,'profit')}</strong><p>มีตัวเลข ${s.profit.count} จาก ${s.total} งาน</p></div><div class="proposal-capital-note">รวมทุกสถานะ<span>ตามข้อเสนอที่บันทึก</span></div></div>
  <details class="proposal-basis"><summary>วิธีอ่านตัวเลข <span aria-hidden="true">+</span></summary><p>พื้นที่ที่มีข้อมูลใช้ยอดคาดการณ์ · พื้นที่ใหม่ใช้ยอดตั้งเป้าหรือกรณีที่เสนอ · เป้าหมายรวมทั้งหมดรวมยอดตั้งเป้าของแต่ละงานจากทั้งสองกลุ่ม โดยปัดขึ้นเป็นบาทเช่นเดียวกับตาราง · ทุกกล่องรวมทุกสถานะตามเดือนที่เลือก · รายการที่ยังไม่มีตัวเลขไม่ถูกนับเป็น 0 และไม่ใช้ยอดคาดการณ์แทนเป้าหมายที่ยังไม่มี</p></details>
 </section>
 <section class="proposal-approval-panel proposal-surface" aria-label="ภาพรวมการอนุมัติ" data-proposal-light>
  <div class="proposal-panel-top"><span class="proposal-eyebrow">APPROVAL PULSE</span><span class="proposal-panel-mark" aria-hidden="true">${icon('spark')}</span></div>
  <div class="proposal-approval-main"><div class="proposal-ring" role="img" aria-label="อนุมัติครบแล้ว ${available?s.approved:'ยังไม่มีข้อมูล'} จาก ${available?s.total:'ยังไม่มีข้อมูล'} งาน">
   <svg viewBox="0 0 160 160" aria-hidden="true"><circle class="proposal-ring-track" cx="80" cy="80" r="66"/><circle class="proposal-ring-segment approved" cx="80" cy="80" r="66" pathLength="100" stroke-dasharray="${percent(s.approved)} 100"/><circle class="proposal-ring-segment pending" cx="80" cy="80" r="66" pathLength="100" stroke-dasharray="${percent(s.pending)} 100" stroke-dashoffset="${-percent(s.approved)}"/><circle class="proposal-ring-segment rejected" cx="80" cy="80" r="66" pathLength="100" stroke-dasharray="${percent(s.rejected)} 100" stroke-dashoffset="${-percent(s.approved+s.pending)}"/><circle class="proposal-ring-segment cancelled" cx="80" cy="80" r="66" pathLength="100" stroke-dasharray="${percent(s.cancelled)} 100" stroke-dashoffset="${-percent(s.approved+s.pending+s.rejected)}"/></svg>
   <div><strong>${metric(rate,'rate')}${rate===null?'':'<small>%</small>'}</strong><span>อนุมัติครบแล้ว</span></div></div>
   <div class="proposal-approval-caption"><h2>อนุมัติครบ 2 คน</h2><strong>${metric(value(s.approved),'ready')}<small> / ${available?s.total:'—'} งาน</small></strong><p>Trade และ CEO อนุมัติทั้งคู่<br>ไม่รวมงานยกเลิก</p></div></div>
  <div class="proposal-stage">${[['Trade',s.trade],['CEO',s.ceo]].map(([label,count])=>`<div class="proposal-stage-line"><span>${label} อนุมัติ</span><strong>${available?count:'—'} <small>/ ${available?s.total:'—'}</small></strong></div><div class="proposal-meter" role="img" aria-label="${label} อนุมัติ ${count} จาก ${s.total} งาน"><span style="width:${percent(count)}%"></span></div>`).join('')}</div>
 </section></div>
 <section class="proposal-dashboard" aria-label="กรองรายการตามสถานะ">
 ${[['all',s.total,'รายการเสนอทั้งหมด','จากชีตและคำขอผ่านเว็บ'],['approved',s.approved,'อนุมัติครบแล้ว','Trade และ CEO อนุมัติทั้งคู่'],['pending',s.pending,'รออนุมัติครบ','ยังอนุมัติไม่ครบ และไม่มีผู้ไม่อนุมัติ'],['rejected',s.rejected,'ไม่อนุมัติ','Trade หรือ CEO ไม่อนุมัติ'],['cancelled',s.cancelled,'ยกเลิก','เปิดดูรายการและเหตุผลที่ยกเลิก']].map(([key,count,label,note])=>`<button type="button" class="proposal-kpi proposal-filter-tile ${key}" data-proposal-filter="${key}" aria-pressed="${active===key}" aria-controls="proposal-results" data-proposal-light><span class="proposal-tile-top"><span class="proposal-kpi-icon ${key}">${icon(key)}</span><span class="proposal-tile-arrow">${icon('arrow')}</span></span><span class="proposal-tile-label">${label}</span><strong>${metric(value(count),'count-'+key)}<small>งาน</small></strong><span class="proposal-tile-note">${note}</span><span class="proposal-tile-track" aria-hidden="true"><i style="width:${key==='all'?(s.total?100:0):percent(count)}%"></i></span></button>`).join('')}
 </section>`;
}
function webDetails(row){
 const input=row.input||{},display=proposalDisplayRow(row),financials=financialCase(row);
 const n=v=>e(formatProposalValue(v,'money')),pct=v=>e(formatProposalValue(v,'roi'));
 const basis=proposalGroup(row)==='new'?(input.salesMode==='cost-target'?'พื้นที่ใหม่ · ยอดขายตั้งเป้าเพื่อ ROI 40%':'พื้นที่ใหม่ · ยอดขายที่ผู้เสนอตั้งเป้า'):'Baseline ฿'+n(row.calculation?.baseline?.rate)+'/วัน';
 return `<small class="proposal-web-tag">คำขอจากเว็บ</small>${row.attachments?.length?`<a class="proposal-web-tag" href="/event-predict?proposal=${encodeURIComponent('web:'+row.id)}#event-images">ดูรูปประกอบ ${row.attachments.length} รูป ↗</a>`:''}<details class="proposal-request-details"><summary>เงื่อนไขที่เสนอ</summary>${(row.planningNotes||[]).map(note=>`<p class="fp-warning">${e(note)}</p>`).join('')}<p>${basis}</p>${input.proposalScenario?`<p>กรณีที่เสนอ: ${e(proposalScenarios[proposalScenarioIndex(input.proposalScenario)]?.label||input.proposalScenario)}</p>`:''}${input.eventSeries==='baan-suan'?`<p>บ้านและสวน · ${e(input.eventLocation)}</p>`:''}${input.pcStartTime&&input.pcEndTime?`<p>เวลาทำงาน PC ${e(input.pcStartTime)}–${e(input.pcEndTime)} · ${n(input.pcHoursPerDay)} ชม. / วัน</p>`:''}<p>รูปแบบ: ${input.channel==='gp'?'ลานโปร GP':'เก็บเงินเอง'} · ${n(input.days)} วัน</p><p>${input.channel==='gp'?'GP '+pct(input.gp):'ค่าเช่า ฿'+n(input.rent)} · ต้นทุนสินค้า ${pct(input.cogs)}</p><p>ชั้น ${e(input.floor||'—')} · ${e((input.eventTypes||[]).join(', ')||'—')} · ${e(eventMonthLabel(input.eventMonth||row.month))}</p><p>พื้นที่ ${n(input.area)} ตร.ม. · PC ${n(input.pcCount)} คน</p><p>PC ฿${n(input.pc)}/${input.pcCostMode==='person'?'คน/วัน':'วัน รวมทุกคน'} · ขนส่ง ฿${n(input.shipping)} · อื่น ๆ ฿${n(input.other)}</p><p>ต้นทุนรวม ฿${n(financials?.costs)} · ROI ${pct(display.roi)} · ยอดขายที่ตั้งเป้า ฿${e(formatProposalValue(display.target,'target'))}</p><p>ยอดขายคุ้มทุน ${proposalBreakEven(row)===null?'—':'฿'+n(proposalBreakEven(row))}</p>${proposalGroup(row)==='new'?'':`<p>ต่ำ/สูง ${pct(input.downside)} / ${pct(input.upside)} ${row.calculation?.base?.label==='ตามคาดการณ์'?'เทียบยอดคาดการณ์':'เทียบเป้า (คำขอเดิม)'}</p>`}<p>วันที่เสนอ ${e(row.proposalDate||'—')} · คอนเฟิร์มภายใน ${e(row.confirmBy||'—')}</p><p>${row.updatedAt?'แก้ไขล่าสุด':'บันทึกเมื่อ'} ${e(new Date(row.updatedAt||row.createdAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))}</p></details>`;
}
function forecastLink(row,label){
 const text=e(label||row.place||'ดูคาดการณ์');
 return row.deletionKey?`<a class="proposal-forecast-link" href="/event-predict?proposal=${encodeURIComponent(row.deletionKey)}" aria-label="ดูคาดการณ์และงบกำไรขาดทุน ${e(row.place)} ${e(row.dates)}">${text}<span aria-hidden="true"> ↗</span></a>`:text;
}
function approvalSummary(row,canApprove){
 const count=[row.trade,row.ceo].filter(value=>value==='อนุมัติ').length;
 return `<div class="proposal-approvals-compact"><small>อนุมัติ ${count}/2 คน</small><div>${['trade','ceo'].map(field=>`<div class="proposal-approval-person"><span>${field==='trade'?'Trade':'CEO'}</span>${approval(row[field],row,field,canApprove)}</div>`).join('')}</div></div>`;
}
function workflowCell(row,canEdit){
 const status=eventWorkflowStatus(row),label=workflowLabels[status];
 const badge=`<span class="proposal-workflow-badge ${status}">${e(label)}</span>`;
 const control=canEdit&&row.deletionKey?`<button class="proposal-workflow-button" type="button" data-update-workflow="${e(row.deletionKey)}" aria-label="อัปเดตสถานะงาน ${e(row.place)}">${badge}<span aria-hidden="true">⌄</span></button>`:badge;
 return control+(row.workflow?.note?`<small class="proposal-cancel-note" title="${e(row.workflow.note)}">${e(row.workflow.note)}</small>`:status==='scheduled'?'<small class="proposal-workflow-help">อนุมัติครบ 2 คนแล้ว</small>':'');
}
function rowActions(row,data){
 const key=e(row.deletionKey||row.id||'');
 return `<div class="proposal-actions"><button type="button" data-proposal-details="${key}">รายละเอียด</button><button type="button" class="proposal-slide-button" data-event-slide="${key}" aria-label="สร้างสไลด์ผู้บริหาร ${e(row.place)}">สไลด์</button>${data.permissions?.canEdit&&row.deletionKey?`<details class="proposal-row-menu"><summary aria-label="เมนู Event ${e(row.place)}">•••</summary><div class="proposal-row-menu-panel">${row.source==='web'?`<a class="proposal-edit" href="/event-predict?edit=${encodeURIComponent(row.id)}">แก้ไขข้อเสนอ</a>`:''}<button type="button" class="proposal-delete" data-delete-proposal="${key}" aria-label="ลบ Event ${e(row.place)}">ลบ Event</button></div></details>`:''}</div>`;
}
function table(data,selected,group){
 const newArea=group==='new';
 const columns=proposalColumns.filter(([key])=>selected.includes(key)&&!(selected.includes('approvals')&&['trade','ceo'].includes(key))&&!(newArea&&key==='target'&&selected.includes('sales'))).map(([key,label])=>[key,newArea?({sales:'ยอดขายที่ตั้งเป้า',profit:'กำไรเมื่อขายถึงเป้า',margin:'กำไรต่อยอดขาย %',roi:'ROI เมื่อถึงเป้า %'}[key]||label):label]);
 const items=data.items||[];
 return `<table class="proposal-table proposal-table-compact"><thead><tr>${columns.map(([key,label])=>`<th scope="col" data-column="${key}" class="${numeric.has(key)?'proposal-number':''}">${e(label)}</th>`).join('')}</tr></thead><tbody>${items.map(row=>`<tr id="${row.id?'request-'+e(row.id):''}" data-workflow="${eventWorkflowStatus(row)}" class="${row.id&&new URLSearchParams(typeof location==='undefined'?'':location.search).get('request')===row.id?'proposal-highlight':''}">${columns.map(([key,label])=>`<td data-column="${key}" data-label="${e(label)}" class="${numeric.has(key)?'proposal-number':''}">${['trade','ceo'].includes(key)?approval(row[key],row,key,data.permissions?.canApprove):key==='approvals'?approvalSummary(row,data.permissions?.canApprove):key==='workflow'?workflowCell(row,data.permissions?.canEdit):key==='actions'?rowActions(row,data):key==='place'?`<strong>${forecastLink(row,row[key])}</strong><small class="proposal-place-meta">${e(row.dates||row.name||'ยังไม่ระบุวันจัด')}${row.attachments?.length?` · ${row.attachments.length} รูป`:''}</small>`:key==='slide'?`<button type="button" class="proposal-slide-button" data-event-slide="${e(row.deletionKey||row.id||'')}" aria-label="สร้างสไลด์ผู้บริหาร ${e(row.place)}">สร้างสไลด์</button>`:key==='name'?forecastLink(row,row[key]):proposalCell(row,key,newArea)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${columns.length}" class="proposal-empty">${data.source?.status==='unavailable'?'ยังโหลดรายการไม่ได้ กำลังรอเชื่อมต่อชีต':data.filterStatus&&data.filterStatus!=='all'?'ไม่มีรายการในสถานะนี้':'ยังไม่มีรายการเสนอ Event'}</td></tr>`}</tbody></table>`;
}
function workflowFilters(data,active='all'){
 const items=data.items||[];
 return `<span>สถานะงาน</span>${[['all','ทั้งหมด'],...Object.entries(workflowLabels)].map(([key,label])=>`<button type="button" data-workflow-filter="${key}" aria-pressed="${active===key}">${label}<span>${key==='all'?items.length:items.filter(row=>eventWorkflowStatus(row)===key).length}</span></button>`).join('')}`;
}
function proposalCell(row,key,newArea){
 if(key==='floor')return e(row.floor||row.input?.floor||'—');
 if(key==='eventTypes')return e((row.eventTypes||row.input?.eventTypes||[]).join(', ')||'—');
 if(key==='month')return e(eventMonthLabel(row.input?.eventMonth||row.month));
 if(key==='breakEven')return row.calculation?.noBreakEven?'ไม่ถึงจุดคุ้มทุน':proposalBreakEven(row)===null?'<span title="ยังไม่มีข้อมูลต้นทุนครบ">—</span>':money(proposalBreakEven(row));
 const display=proposalDisplayRow(row),value=display[key];
 if(!numeric.has(key))return e(value??'—');
 const text=e(formatProposalValue(value,newArea&&key==='sales'?'target':key));
 return text+(newArea&&['sales','target'].includes(key)&&number(value)!==null?`<small class="proposal-value-note">${row.calculation?.proposed?'กรณีที่เสนอ: '+e(proposalScenarios[proposalScenarioIndex(row.input.proposalScenario)].label):row.input?.salesMode==='cost-target'?'เป้า ROI 40%':'ยอดขายที่ตั้งเป้า'}</small>`:'');
}
function groupedTables(data,selected){
 return ['history','new'].map(group=>{
  const items=(data.items||[]).filter(row=>proposalGroup(row)===group),newArea=group==='new';
  return `<section class="proposal-group" data-proposal-group="${group}" aria-label="${newArea?'พื้นที่ใหม่':'พื้นที่ที่มีข้อมูลแล้ว'}"><header class="proposal-group-heading"><h3>${newArea?'พื้นที่ใหม่':'พื้นที่ที่มีข้อมูลแล้ว'} <span>${money(items.length)} งาน</span></h3><p>${newArea?'ยอดขายเป็นเป้าที่ตั้งไว้ · กำไรและ ROI แสดงเมื่อขายถึงเป้า · เป้า ROI 40% คือกำไร 40% ของต้นทุนรวม':'ยอดขายคาดการณ์จากข้อมูลที่มี · แสดงเป้าหมายและยอดคุ้มทุนแยกกัน'}</p></header><div class="table-wrap proposal-scroll" tabindex="0" role="region" data-proposal-scroll="${group}" aria-label="${newArea?'ตารางพื้นที่ใหม่':'ตารางพื้นที่ที่มีข้อมูลแล้ว'} เลื่อนเพื่อดูทุกคอลัมน์">${table({...data,items},selected,group)}</div></section>`;
 }).join('');
}
function updateTables(root,data,selected,status='all'){
 const month=rootStates.get(root)?.month||'all';
 data={...data,items:filterProposalMonth(data.items||[],month)};
 root.querySelector('[data-proposal-total]').textContent=data.items.length;
 const workflow=rootStates.get(root)?.workflowFilter||'all';
 const filterRoot=root.querySelector('[data-workflow-filters]');
 if(filterRoot)filterRoot.innerHTML=workflowFilters(data,workflow);
 const offsets=new Map([...root.querySelectorAll('[data-proposal-scroll]')].map(el=>[el.dataset.proposalScroll,el.scrollLeft]));
 const items=filterProposals(data.items||[],status).filter(row=>workflow==='all'||eventWorkflowStatus(row)===workflow);
 root.querySelector('[data-proposal-tables]').innerHTML=groupedTables({...data,items,filterStatus:workflow!=='all'?workflow:status},selected);
 const caption=root.querySelector('[data-proposal-filter-caption]');
 caption.hidden=status==='all'&&workflow==='all'&&month==='all';
 caption.querySelector('span').textContent=`${proposalMonthLabel(month)} · ${statusLabels[status]}${workflow==='all'?'':' · '+workflowLabels[workflow]} · ${items.length} จาก ${(data.items||[]).length} งาน`;
 for(const tile of root.querySelectorAll('[data-proposal-filter]'))tile.setAttribute('aria-pressed',String(tile.dataset.proposalFilter===status));
 for(const el of root.querySelectorAll('[data-proposal-scroll]'))el.scrollLeft=offsets.get(el.dataset.proposalScroll)||0;
}
function controls(selected){
 return `<details class="proposal-column-picker"><summary aria-label="เลือกข้อมูลที่แสดง"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M9 4v16M15 4v16" stroke="currentColor" stroke-width="1.6"/></svg>เลือกข้อมูลที่แสดง <span data-column-count>${selected.length}/${proposalColumns.length}</span><span aria-hidden="true">⌄</span></summary><div class="proposal-column-panel"><div class="proposal-column-panel-head"><strong>คอลัมน์ที่แสดง</strong><button type="button" data-close-columns aria-label="ปิดตัวเลือกคอลัมน์">×</button></div><p>เลือกข้อมูลสำหรับทั้งสองตาราง · พื้นที่ใหม่แสดงยอดตั้งเป้าแทนยอดคาดการณ์</p><div class="proposal-column-options">${proposalColumns.map(([key,label])=>`<label><input type="checkbox" data-report-column data-proposal-column="${key}" ${selected.includes(key)?'checked':''} ${['place','workflow','actions'].includes(key)?'disabled':''}><span>${e(label)}${['place','workflow','actions'].includes(key)?'<small>แสดงเสมอ</small>':''}</span></label>`).join('')}</div><div class="proposal-column-actions"><button type="button" data-all-columns>แสดงทั้งหมด</button><button type="button" data-default-columns>ค่าตั้งต้น</button></div></div></details>`;
}
export function proposalExcelWorkbook(items=[]){
 return sectionTableExcelWorkbook(['history','new'].map(group=>{
  const fresh=group==='new';
  const columns=[...proposalColumns.filter(([key])=>key!=='workflow'),['workflow','สถานะงาน'],['cancellationNote','หมายเหตุยกเลิก']].filter(([key])=>!['slide','actions','approvals'].includes(key)&&!(fresh&&key==='target')).map(([key,label])=>[key,fresh?({sales:'ยอดขายที่ตั้งเป้า',profit:'กำไรเมื่อขายถึงเป้า',margin:'กำไรต่อยอดขาย %',roi:'ROI เมื่อถึงเป้า %'}[key]||label):label]);
  const data=items.filter(row=>proposalGroup(row)===group).map(row=>{
   const display=proposalDisplayRow(row);
   return columns.map(([key])=>{
    if(key==='workflow')return workflowLabels[eventWorkflowStatus(row)];
    if(key==='cancellationNote')return row.workflow?.note||'';
    if(key==='month')return eventMonthLabel(row.input?.eventMonth||row.month);
    if(key==='floor')return row.floor||row.input?.floor||'';
    if(key==='eventTypes')return (row.eventTypes||row.input?.eventTypes||[]).join(', ');
    if(key==='breakEven')return row.calculation?.noBreakEven?'ไม่ถึงจุดคุ้มทุน':proposalBreakEven(row);
    if(numeric.has(key))return number(['margin','roi'].includes(key)?String(display[key]??'').replace(/%$/,''):display[key]);
    return display[key]??'';
   });
  });
  return {name:fresh?'พื้นที่ใหม่':'พื้นที่ที่มีข้อมูลแล้ว',columns:columns.map(([,label])=>label),data,widths:columns.map(([key])=>['place','name'].includes(key)?40:key==='dates'?32:22),numericStyles:Object.fromEntries(columns.map(([key],i)=>[i,numeric.has(key)?(['days','pc'].includes(key)?2:3):0]))};
 }));
}
function monthControl(items,selected='all'){
 return `<label class="proposal-month-picker"><span>เดือนที่จัด</span><select data-proposal-month aria-label="กรองตามเดือนที่จัด"><option value="all" ${selected==='all'?'selected':''}>ทุกเดือน</option>${proposalMonthOptions(items,selected).map(option=>`<option value="${e(option.value)}" ${option.value===selected?'selected':''}>${e(option.label)}</option>`).join('')}</select></label>`;
}
function updateDashboard(root,state){
 const scoped={...state.data,items:filterProposalMonth(state.data.items||[],state.month)};
 const next=dashboard(scoped,state.filter),target=root.querySelector('[data-proposal-dashboard]');
 if(next!==state.dashboardMarkup){
  const focused=root.contains(document.activeElement)?document.activeElement?.dataset.proposalFilter:null;
  const basisOpen=root.querySelector('.proposal-basis')?.open;
  target.innerHTML=next;target.classList.add('proposal-refreshed');
  if(basisOpen)root.querySelector('.proposal-basis').open=true;
  if(focused)root.querySelector(`[data-proposal-filter="${focused}"]`)?.focus({preventScroll:true});
  animateProposalMetrics(target,state.metrics);
 }
 state.dashboardMarkup=next;
}
export function proposalsMarkup(data,selection,month='all'){
 const allItems=data.items||[];
 data={...data,items:filterProposalMonth(allItems,month)};
 const selected=normalizeProposalColumns(selection);
 return `<section class="proposal-heading"><div><p class="proposal-eyebrow"><span class="proposal-heading-rule" aria-hidden="true"></span> EVENT / PROPOSALS</p><h1>เสนอ <span>Event</span><span class="proposal-title-dot" aria-hidden="true">.</span></h1><p>ภาพรวมการอนุมัติและคาดการณ์ผลตอบแทน</p></div><div class="proposal-heading-controls"><div data-proposal-month-control>${monthControl(allItems,month)}</div><span class="proposal-connection ${data.source?.status==='online'?'online':'offline'}"><i aria-hidden="true"></i>${data.source?.status==='online'?'เชื่อมต่อข้อมูลอัตโนมัติ':'กำลังเชื่อมต่อข้อมูล'}</span></div></section>
 ${data.web?.status==='unavailable'?'<p class="error-box">ยังอ่านคำขอจากเว็บไม่ได้ แสดงเฉพาะข้อมูลชีต</p>':''}${data.web?.truncated?'<p class="error-box">แสดงคำขอผ่านเว็บล่าสุด 500 รายการ</p>':''}<div data-proposal-dashboard>${dashboard(data)}</div>
 <section class="proposal-card" id="proposal-results"><header class="proposal-table-toolbar"><div><h2>รายการเสนอ Event <span data-proposal-total>${(data.items||[]).length}</span></h2><p>คลิกสถานะเพื่ออัปเดตงาน · เปิดรายละเอียดเพื่อดูเงื่อนไขและรูปประกอบ</p></div><div class="proposal-toolbar-actions"><button type="button" class="proposal-export" data-proposal-export title="ดาวน์โหลดทุกสถานะและทุกคอลัมน์ของเดือนที่เลือก รวมในชีตเดียว">Export Excel ทั้ง 2 ตาราง</button>${controls(selected)}</div></header>
 <div class="proposal-workflow-filters" data-workflow-filters aria-label="กรองตามสถานะงาน">${workflowFilters(data)}</div><p class="proposal-export-message" role="status" aria-live="polite"></p><div class="proposal-filter-caption" data-proposal-filter-caption hidden><span role="status" aria-live="polite"></span><button type="button" data-reset-proposal-filter>ล้างตัวกรองสถานะ</button></div><p class="proposal-delete-message" role="status" aria-live="polite"></p><div data-proposal-tables>${groupedTables(data,selected)}</div>
 <footer class="proposal-table-footer"><p>แสดงตัวเลขไม่มีทศนิยม · ยอดตั้งเป้าและคุ้มทุนปัดขึ้น · “—” คือยังไม่มีข้อมูล · ยอดคุ้มทุนคำนวณได้เมื่อต้นทุนครบ · สถานะอนุมัติ สถานะงาน และหมายเหตุบันทึกในเว็บ</p><p class="proposal-freshness" role="status">${e(proposalFreshness(data))}</p></footer></section>`;
}
const rootStates=new WeakMap();
export function markUnavailable(root,recovery={stale:true}){
 const state=rootStates.get(root);if(!state)return;
 state.data={...state.data,recovery,permissions:{...state.data.permissions,canEdit:false,canApprove:false}};
 updateTables(root,state.data,state.selected,state.filter);
 const freshness=root.querySelector('.proposal-freshness');if(freshness)freshness.textContent=proposalFreshness(state.data);
 const status=root.querySelector('.proposal-connection');if(status){status.className='proposal-connection offline';status.textContent='แสดงข้อมูลล่าสุดที่โหลดสำเร็จ';}
}
function loadSelection(){try{return normalizeProposalColumns(JSON.parse(localStorage.getItem(storageKey)));}catch{return normalizeProposalColumns();}}
export async function render(root,services){
 document.title='เสนอ Event · VING Warroom';
 let state=rootStates.get(root);
 if(services.proposals?.recovery?.stale)markUnavailable(root,services.proposals.recovery);
 if(state?.modal||state?.deleting||(!services.mutation&&state?.lastChange&&Date.now()-state.lastChange<2000)||(!services.mutation&&root.querySelector('.proposal-approval-menu[open],.proposal-row-menu[open]')))return false;
 const generation=state?.generation||0;
 let data=services.proposals||await services.api('/api/event-proposals');
 if(state&&(state.modal||state.deleting||state.generation!==generation))return false;
 if(state)data={...data,items:(data.items||[]).filter(row=>!state.deleted.has(row.deletionKey))};
 if(!state){
  state={data,selected:loadSelection(),filter:'all',workflowFilter:'all',month:'all',generation:0,deleted:new Set(),metrics:new Map()};rootStates.set(root,state);root.innerHTML=proposalsMarkup(data,state.selected);
  root.addEventListener('click',event=>{
   if(!event.target.closest('[data-proposal-export]'))return;
   const message=root.querySelector('.proposal-export-message'),items=filterProposalMonth(state.data.items||[],state.month);
   if(!items.length){message.textContent='ยังไม่มีรายการให้ส่งออก';return;}
   try{downloadExcelWorkbook(proposalExcelWorkbook(items),`VING-Event-Proposals-${new Date().toISOString().slice(0,10)}.xlsx`);message.textContent=`ดาวน์โหลดทั้ง 2 ตาราง รวม ${items.length} งาน ทุกคอลัมน์และทุกสถานะ · ${proposalMonthLabel(state.month)}แล้ว`;}
   catch{message.textContent='ยังดาวน์โหลดไม่ได้ กรุณาลองอีกครั้ง';}
  });
  root.addEventListener('click',async event=>{
   const button=event.target.closest('[data-event-slide]');if(!button||button.disabled)return;
   const row=state.data.items.find(item=>(item.deletionKey||item.id||'')===button.dataset.eventSlide);if(!row)return;
   button.disabled=true;
   try{const {openEventSlide}=await import('./event-slide.mjs');await openEventSlide(row,state.data.source,button,{canEdit:state.data.permissions?.canEdit,canMutate:()=>!!state.data.permissions?.canEdit,onSaved:async()=>{const proposals=await services.api('/api/event-proposals');await render(root,{...services,proposals,mutation:true});}});}
   catch{root.querySelector('.proposal-export-message').textContent='ยังเปิดสไลด์ไม่ได้ กรุณาลองอีกครั้ง';}
   finally{button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
   const statusButton=event.target.closest('[data-update-workflow]'),detailsButton=event.target.closest('[data-proposal-details]');
   if((!statusButton&&!detailsButton)||state.modal||state.deleting)return;
   const key=statusButton?.dataset.updateWorkflow||detailsButton?.dataset.proposalDetails;
   const row=state.data.items.find(item=>(item.deletionKey||item.id||'')===key);if(!row)return;
   state.modal=true;state.generation++;
   try{
    if(detailsButton){await openProposalDetails(row,webDetails(row));return;}
    if(!state.data.permissions?.canEdit)return;
    const workflow=await openWorkflowDialog(row,{canMutate:()=>!!state.data.permissions?.canEdit});
    if(!workflow)return;
    state.lastChange=Date.now();
    const next={...state.data,items:state.data.items.map(item=>item.deletionKey===key?{...item,workflow}:item)};
    state.modal=false;await render(root,{...services,proposals:next,mutation:true});
    root.querySelector('.proposal-delete-message').textContent=`บันทึกสถานะงาน: ${workflowLabels[workflow.status]}แล้ว`;
    window.dispatchEvent(new Event('ving:changed'));
   }finally{state.modal=false;}
  });
  root.addEventListener('click',event=>{
   const button=event.target.closest('[data-workflow-filter]');if(!button)return;
   state.workflowFilter=button.dataset.workflowFilter;
   state.filter='all';
   updateTables(root,state.data,state.selected,state.filter);
   root.querySelector(`[data-workflow-filter="${state.workflowFilter}"]`)?.focus({preventScroll:true});
  });
  root.addEventListener('change',event=>{
   if(!event.target.matches('[data-proposal-month]'))return;
   state.month=event.target.value;
   updateDashboard(root,state);
   updateTables(root,state.data,state.selected,state.filter);
   root.querySelector('.proposal-export-message').textContent='';
  });
  installProposalMotion(root);
  animateProposalMetrics(root,state.metrics);
  root.addEventListener('click',event=>{
   const tile=event.target.closest('[data-proposal-filter]'),reset=event.target.closest('[data-reset-proposal-filter]');
   if(!tile&&!reset)return;
   state.filter=tile?.dataset.proposalFilter||'all';
   state.workflowFilter='all';
   updateTables(root,state.data,state.selected,state.filter);
   if(reset)root.querySelector('[data-proposal-filter="all"]').focus({preventScroll:true});
  });
  root.addEventListener('click',async event=>{
   const button=event.target.closest('[data-delete-proposal]');if(!button||state.deleting||!state.data.permissions?.canEdit)return;
   const key=button.dataset.deleteProposal,row=state.data.items.find(item=>item.deletionKey===key);if(!row)return;
   if(!await confirmAction({title:'ยืนยันการลบ Event',description:`รายการนี้จะถูกลบออกจากเว็บและยอดสรุปของทุกคน${row.source==='web'?'':' โดยข้อมูลต้นฉบับใน Google Sheets ยังอยู่'}`,detail:`${row.place}\n${row.dates||''}`,confirmLabel:'ลบ Event',danger:true}))return;
   if(!state.data.permissions?.canEdit)return;
   state.deleting=true;state.generation++;button.disabled=true;button.textContent='กำลังลบ…';
   const message=root.querySelector('.proposal-delete-message');message.textContent='';
   try{
    const response=await fetch('/api/event-proposals/'+encodeURIComponent(key),{method:'DELETE',signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'ลบไม่สำเร็จ กรุณาลองใหม่');
    state.deleted.add(key);state.lastChange=Date.now();
    const next={...state.data,items:state.data.items.filter(item=>item.deletionKey!==key)};
    state.deleting=false;await render(root,{...services,proposals:next,mutation:true});
    message.textContent='ลบ Event แล้ว';root.querySelector('[data-delete-proposal]')?.focus({preventScroll:true});
   }catch(error){message.textContent=error.name==='TimeoutError'?'ยังยืนยันผลการลบไม่ได้ กรุณารีเฟรชหรือลองใหม่':error.message;button.disabled=false;button.textContent='ลบ Event';}
   finally{state.deleting=false;}
  });
  root.addEventListener('click',async event=>{
   const button=event.target.closest('[data-approve-proposal]');if(!button||state.deleting||!state.data.permissions?.canApprove)return;
   const key=button.dataset.approveProposal,field=button.dataset.field,status=button.dataset.status;
   const row=state.data.items.find(item=>item.deletionKey===key);if(!row)return;
   if(!await confirmAction({title:'ยืนยันการเปลี่ยนสถานะ',description:`${field==='trade'?'Trade':'CEO'} · ${status}`,detail:`${row.place}\n${row.dates||''}`,confirmLabel:`ยืนยัน${status}`,danger:status==='ไม่อนุมัติ'}))return;
   if(!state.data.permissions?.canApprove)return;
   state.deleting=true;state.generation++;button.disabled=true;
   const message=root.querySelector('.proposal-delete-message');message.textContent='กำลังบันทึกสถานะ…';
   try{
    const response=await fetch('/api/event-proposals/approval',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({key,field,status,revision:row.updatedAt||row.createdAt||null}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');
    const next={...state.data,items:state.data.items.map(item=>item.deletionKey===key?{...item,[field]:status}:item)};
    state.lastChange=Date.now();state.deleting=false;await render(root,{...services,proposals:next,mutation:true});
    window.dispatchEvent(new Event('ving:changed'));
    message.textContent=`บันทึกสถานะ ${field==='trade'?'Trade':'CEO'}: ${status} แล้ว`;
   }catch(error){message.textContent=error.name==='TimeoutError'?'ยังยืนยันผลการบันทึกไม่ได้ กรุณารีเฟรชหรือลองใหม่':error.message;button.disabled=false;}
   finally{state.deleting=false;}
  });
  root.addEventListener('click',event=>{const selected=event.target.closest('.proposal-row-menu');for(const menu of root.querySelectorAll('.proposal-row-menu[open]'))if(menu!==selected)menu.open=false;});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=event.target.closest('.proposal-row-menu[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();}}});
  document.addEventListener('click',event=>{if(!root.contains(event.target))for(const menu of root.querySelectorAll('.proposal-row-menu[open]'))menu.open=false;});
  const picker=root.querySelector('.proposal-column-picker');
  const close=()=>{picker.open=false;picker.querySelector('summary').focus({preventScroll:true});};
  const updateSelection=selected=>{
   state.selected=normalizeProposalColumns(selected);try{localStorage.setItem(storageKey,JSON.stringify(state.selected));}catch{}
   for(const input of picker.querySelectorAll('[data-proposal-column]'))input.checked=state.selected.includes(input.dataset.proposalColumn);
   picker.querySelector('[data-column-count]').textContent=`${state.selected.length}/${proposalColumns.length}`;
   updateTables(root,state.data,state.selected,state.filter);
  };
  picker.addEventListener('change',event=>{if(event.target.matches('[data-proposal-column]'))updateSelection([...picker.querySelectorAll('[data-proposal-column]:checked')].map(input=>input.dataset.proposalColumn));});
  picker.querySelector('[data-all-columns]').addEventListener('click',()=>updateSelection(proposalColumns.map(([key])=>key)));
  picker.querySelector('[data-default-columns]').addEventListener('click',()=>updateSelection(defaultProposalColumns));
  picker.querySelector('[data-close-columns]').addEventListener('click',close);
  picker.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  document.addEventListener('click',event=>{if(!picker.contains(event.target))picker.open=false;});
 }else{
  state.data=data;
  updateDashboard(root,state);
  const monthRoot=root.querySelector('[data-proposal-month-control]');
  if(!monthRoot.contains(document.activeElement))monthRoot.innerHTML=monthControl(data.items||[],state.month);
  root.querySelector('[data-proposal-total]').textContent=(data.items||[]).length;
  updateTables(root,data,state.selected,state.filter);
  root.querySelector('.proposal-freshness').textContent=proposalFreshness(data);
  const status=root.querySelector('.proposal-connection');status.className='proposal-connection '+(data.source?.status==='online'?'online':'offline');status.innerHTML='<i aria-hidden="true"></i>'+(data.source?.status==='online'?'เชื่อมต่อข้อมูลอัตโนมัติ':'กำลังเชื่อมต่อข้อมูล');
 }
 state.dashboardMarkup=dashboard({...data,items:filterProposalMonth(data.items||[],state.month)},state.filter);
 if(data.recovery?.stale)markUnavailable(root,data.recovery);
 return true;
}
export const refreshReadonly=render;
