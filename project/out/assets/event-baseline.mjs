import {escapeHtml as e} from './api.mjs';
import {baselineFor,baselineMonths,baselineMonthLabel,rowsForBaseline,baselineEventKey,baselineSelectionLabel,isBaanSuan,identifyVenue} from './event-predict-model.mjs';

const number=v=>v===null||v===undefined?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(v);
const date=v=>v?Number(v.slice(8))+' '+baselineMonthLabel(v.slice(0,7)):'—';
const eventName=row=>String(row.originalName||row.name||'').trim();
const eventType=channel=>channel==='direct'?'เก็บเงินเอง':channel==='gp'?'หัก GP':'[ต้องถามเจ้าของ]';
const eventDetails=rows=>`<span class="fp-baseline-events">${rows.map(row=>`<span class="fp-baseline-event">${eventName(row)?`<span class="fp-baseline-event-name">${e(eventName(row))}</span>`:''}<span class="fp-baseline-event-type">ประเภท: ${eventType(row.channel)}</span></span>`).join('')}</span>`;
const eventTypes=rows=>`<span class="fp-baseline-events">${[...new Set(rows.map(row=>row.channel))].map(channel=>`<span class="fp-baseline-event-type">${eventType(channel)} · ${rows.filter(row=>row.channel===channel).length} Event</span>`).join('')}</span>`;
export function baselinePickerMarkup(rows,month='all',place=''){
 if(place==='บ้านและสวน'||rows.some(isBaanSuan))return specialBaselineMarkup(rows,month);
 const months=baselineMonths(rows),all=baselineFor(rows);
 const options=[{month:'all',...all,total:rows.length,excluded:rows.length-all.observations},...months];
 return `<section class="fp-baseline-picker" aria-labelledby="fp-baseline-title">
  <div class="fp-panel-head"><h2 id="fp-baseline-title">เลือก Baseline ของห้าง</h2><span>${e(place)}</span></div>
  <p class="fp-history-count">พบ <b>${rows.length} Event</b> · ${months.length} เดือนที่มีประวัติ · ใช้คำนวณได้ <b>${all.observations} Event / ${number(all.days)} วันขาย</b></p>
  <p class="fp-hint">คลิกเดือนที่ต้องการ หรือใช้ค่าเฉลี่ยทั้งหมด ยอดขายคาดการณ์ กำไร และทั้ง 3 กรณีจะเปลี่ยนตาม Baseline ที่เลือก</p>
  <div class="fp-baseline-options" role="group" aria-label="เลือกเดือนสำหรับ Baseline">${options.map(o=>`<button type="button" data-baseline-month="${o.month}" aria-pressed="${o.month===month}" ${!o.observations?'disabled':''}>
   <strong>${baselineMonthLabel(o.month)}</strong><span>${o.total} Event · ${number(o.days)} วันขายที่ใช้</span><b>฿${number(o.rate)} / วัน</b><small>${o.month===month?'✓ กำลังใช้':o.observations?'เลือกใช้ Baseline นี้':'ยังไม่มีงานที่ใช้คำนวณได้'}${o.excluded?' · ใช้ได้ '+o.observations+'/'+o.total+' Event':''}</small>${o.month==='all'?eventTypes(rows):eventDetails(rowsForBaseline(rows,o.month))}
  </button>`).join('')}</div>
  <p class="fp-baseline-rule">จัดกลุ่มตามเดือนเริ่มงาน · งานข้ามเดือนนับครั้งเดียว ใช้ยอดและจำนวนวันของทั้งงาน · เฉลี่ยจากยอดขายรวม ÷ วันขายรวม เฉพาะงานที่สิ้นสุดแล้วและข้อมูลครบ</p>
 </section>`;
}
export function baselineEventsMarkup(rows,month='all'){
 const selected=rowsForBaseline(rows,month).slice().sort((a,b)=>(b.range?.start||'').localeCompare(a.range?.start||''));
 const baseline=baselineFor(selected);
 return `<div class="fp-panel-head"><h2>Event ที่ใช้อ้างอิง · ${e(baselineSelectionLabel(rows,month))}</h2></div>
 <p class="fp-hint">ใช้ ${baseline.observations} Event · ${number(baseline.days)} วันขาย · ยอดรวม ฿${number(baseline.sales)} · เฉลี่ย ฿${number(baseline.rate)} / วัน</p>
 <div class="fp-table-wrap fp-history-events"><table><caption>ประวัติ Event พร้อมเดือนและจำนวนวันขาย</caption><thead><tr><th>ชื่อ Event / ประเภท Event</th><th>เดือนเริ่มงาน</th><th>ช่วงวันที่จัด</th><th>วันขาย</th><th>ยอดขาย</th><th>ใช้ใน Baseline</th></tr></thead><tbody>${selected.map(r=>`<tr><th scope="row">${e(eventName(r))||'—'}<small>ประเภท: ${eventType(r.channel)}</small></th><td>${r.range?baselineMonthLabel(r.range.start.slice(0,7)):'รอยืนยัน'}</td><td>${r.range?date(r.range.start)+' – '+date(r.range.end):'รอยืนยันวันที่'}</td><td>${number(r.days)}</td><td>${number(r.net)}</td><td>${r.usable?'✓ ใช้คำนวณ':e(r.reason||'รอข้อมูล')}</td></tr>`).join('')||'<tr><td colspan="6">ยังไม่มี Event ที่ใช้คำนวณในเดือนนี้ กรุณาเลือกเดือนอื่น</td></tr>'}</tbody></table></div>
 <p class="fp-hint">วันขายรวมเป็นผลรวมจำนวนวันของแต่ละ Event · ค่าเริ่มต้นของต้นทุนและเป้าหมายอ้างอิงประวัติรูปแบบเดียวกับงานใหม่ การเปลี่ยนเดือนจะคงเงื่อนไขของงานที่กรอกไว้</p>`;
}

function specialBaselineMarkup(rows,selected){
 const all=baselineFor(rows),events=[...rows].sort((a,b)=>Number(b.usable)-Number(a.usable)||(b.range?.start||'').localeCompare(a.range?.start||''));
 const options=[{key:'all',label:'ค่าเฉลี่ยบ้านและสวนทุกครั้ง',meta:all.observations+' งาน · '+number(all.days)+' วันขาย',rate:all.rate,usable:all.observations>0},...events.map(row=>({key:baselineEventKey(row),label:eventName(row),meta:(row.range?date(row.range.start)+' – '+date(row.range.end):'รอยืนยันวันที่')+' · '+identifyVenue(row.name).label,rate:row.usable?row.net/row.days:null,usable:row.usable,reason:row.reason}))];
 return `<section class="fp-baseline-picker fp-special-baseline" aria-labelledby="fp-baseline-title"><div class="fp-panel-head"><h2 id="fp-baseline-title">ประวัติบ้านและสวน · ทุกสถานที่</h2><span>${all.observations} / ${rows.length} งานใช้คำนวณได้</span></div><p class="fp-hint">เลือกค่าเฉลี่ยรวม หรือเลือกครั้งที่เคยจัด · งานอื่นในสถานที่เดียวกันไม่นำมารวม</p><div class="fp-baseline-options" role="group" aria-label="เลือกประวัติบ้านและสวน">${options.map(o=>`<button type="button" data-baseline-month="${e(o.key)}" aria-pressed="${selected===o.key}" ${o.usable?'':'disabled'} title="${e(o.label+' · '+o.meta)}"><strong>${e(o.label)}</strong><span class="fp-baseline-meta">${e(o.meta)}</span><b>฿${number(o.rate)} / วัน</b><small>${selected===o.key?'✓ กำลังใช้':o.usable?'เลือกใช้ Baseline นี้':e(o.reason||'ยังไม่มีข้อมูลที่ใช้คำนวณได้')}</small></button>`).join('')}</div><p class="fp-baseline-rule">เฉลี่ยจากยอดขายรวม ÷ วันขายรวม · ใช้เฉพาะงานที่จบแล้วและข้อมูลครบ</p></section>`;
}
