import {escapeHtml as e} from './api.mjs';
import {baselineFor,historyFor,identifyForecastVenue,identifyVenue,numeric} from './event-predict-model.mjs';

const fmt=value=>numeric(value)===null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(numeric(value));
const money=value=>numeric(value)===null?'—':'฿'+new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(numeric(value));
const compact=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const nameOf=row=>row.originalName||row.name||'ไม่ระบุชื่อ Event';
const channelLabel=value=>value==='gp'?'ลานโปร · GP':value==='direct'?'เก็บเงินเอง':'ยังไม่ระบุรูปแบบ';

// Brand changes suggest comparable history; they never merge venues or alter a proposal.
export function reviewLocationQuery(value){
 return identifyVenue(value).label.replace(/^(?:(?:event|อีเวนท์|อีเว้นท์|ลานโปร|บูธ|rbs|cds|robinson|central|โรบินสัน|เซ็นทรัล|เซนทรัล|the\s*mall|เดอะมอลล์)\s*)+/i,'').replace(/\s*ชั้น.*$/,'').replace(/[()]/g,'').trim();
}
export function reviewHistoryQuery(row){
 return row.input?.eventSeries==='baan-suan'?'บ้านและสวน':reviewLocationQuery(row.place||row.input?.eventLocation||row.name||'');
}
export function reviewHistoryRows(records,today=new Date(Date.now()+7*3600000).toISOString().slice(0,10)){
 const groups=new Map();
 for(const record of records){const id=identifyForecastVenue(record).id;const group=groups.get(id)||[];group.push({...record,net:numeric(record.net),days:numeric(record.days)});groups.set(id,group);}
 return [...groups].flatMap(([id,rows])=>historyFor(rows,id,null,today))
  .filter(row=>!row.range||row.range.end<today)
  .map(row=>({...row,daily:row.days>0&&row.net!==null&&row.net>=0?row.net/row.days:null}))
  .sort((a,b)=>(b.range?.start||'').localeCompare(a.range?.start||'')||nameOf(a).localeCompare(nameOf(b),'th'));
}
export function filterReviewHistory(rows,query=''){
 const exact=compact(query),area=compact(reviewLocationQuery(query));
 if(!exact)return rows;
 return rows.filter(row=>{
  const names=[row.name,row.originalName,row.venue?.label].map(compact);
  return names.some(name=>name.includes(exact)||(area.length>=2&&name.includes(area)));
 });
}
export function reviewHistoryResults(rows,query='',source={}){
 const selected=filterReviewHistory(rows,query),baseline=baselineFor(selected);
 const hasBaseline=baseline.observations>0;
 const sources=source.sources||[];
 const stale=source.status==='stale'||sources.some(s=>s.status==='stale');
 const range=row=>row.range?`${e(row.range.start)}<span class="er-history-date-end">ถึง ${e(row.range.end)}</span>`:'รอยืนยันวันที่';
 return `<div class="er-history-summary" aria-live="polite"><div><span>Event ที่พบ</span><strong>${fmt(selected.length)} <small>งาน</small></strong></div><div class="er-history-rate"><span>Baseline · ยอดขายต่อวัน</span><strong>${money(baseline.rate)}</strong></div><div><span>ยอดขายที่ใช้คำนวณ</span><strong>${money(hasBaseline?baseline.sales:null)}</strong></div><div><span>วันขายที่ใช้คำนวณ</span><strong>${hasBaseline?fmt(baseline.days):'—'} <small>วัน</small></strong></div></div>
 <p class="fp-hint">${query?'ผลค้นหา “'+e(query)+'” · รวมชื่อพื้นที่ใกล้เคียงข้าม RBS / CDS':'ประวัติ Event ทั้งหมด'} · ใช้คำนวณได้ ${baseline.observations} จาก ${selected.length} งาน${source.fetched_at?' · ข้อมูล ณ '+e(new Date(source.fetched_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})):''}</p>
 ${stale?'<p class="fp-warning">ใช้ประวัติล่าสุดที่อ่านได้ บางแหล่งข้อมูลยังอัปเดตไม่สำเร็จ</p>':''}
 <div class="er-history-scroll" tabindex="0" role="region" aria-label="ตารางประวัติ Event เลื่อนดูได้"><table class="er-history-table"><caption>ประวัติ Event และยอดขายต่อวัน</caption><thead><tr><th scope="col">Event / สถานที่</th><th scope="col">วันที่จัด</th><th scope="col">จำนวนวัน</th><th scope="col">ยอดขายรวม</th><th scope="col">ยอดขาย / วัน</th><th scope="col">ใช้ใน Baseline</th></tr></thead><tbody>${selected.map(row=>`<tr><th scope="row">${e(nameOf(row))}<small>${e(row.venue?.label||'')} · ${channelLabel(row.channel)}</small></th><td>${range(row)}</td><td class="er-history-number">${row.days>0?fmt(row.days):'—'}</td><td class="er-history-number">${money(row.net)}</td><td class="er-history-number er-history-daily">${money(row.daily)}</td><td><span class="er-history-eligibility ${row.usable?'is-usable':''}">${row.usable?'✓ ใช้คำนวณ':e(row.reason||'รอข้อมูล')}</span></td></tr>`).join('')||`<tr><td colspan="6" class="er-history-empty">${rows.length?'ไม่พบประวัติที่ตรงกับคำค้น ลองค้นเฉพาะชื่อพื้นที่ เช่น “บางรัก” หรือเลือก Event ทั้งหมด':'ยังไม่มีประวัติ Event ที่สิ้นสุดแล้วในข้อมูลชุดนี้'}</td></tr>`}</tbody></table></div>
 <p class="fp-hint er-history-rule">Baseline = ยอดขายรวม ÷ วันขายรวม ของงานที่สิ้นสุดแล้วและข้อมูลครบ · แสดงทุกครั้งที่พบ ไม่จำกัดเดือน · งานข้ามเดือนนับครั้งเดียว · รายการที่วันหรือยอดขายไม่ครบแสดง — และไม่นำมาคำนวณ</p>`;
}
export function reviewHistoryMarkup(row){
 const query=reviewHistoryQuery(row);
 return `<section id="er-history" class="er-history" aria-labelledby="er-history-title"><div class="er-section-title"><h2 id="er-history-title">Baseline · ประวัติ Event ที่เคยจัด</h2><span>ยอดขายจริงสำหรับเทียบข้อเสนอ</span></div><p class="fp-hint">ค้นหาชื่อ Event หรือพื้นที่ใกล้เคียงได้ แม้เปลี่ยนจาก RBS เป็น CDS · ข้อมูลส่วนนี้ไม่เปลี่ยนตัวเลขที่เสนออนุมัติไว้</p><div class="er-history-controls"><label for="er-history-query">ค้นหา Event / พื้นที่<input id="er-history-query" type="search" value="${e(query)}" placeholder="เช่น บางรัก, RBS บางรัก, บ้านและสวน" maxlength="180" autocomplete="off"></label><div class="er-history-actions" role="group" aria-label="เลือกประวัติ Event"><button type="button" data-history-scope="related" aria-pressed="${!!query}" ${query?'':'disabled'}>พื้นที่นี้ / ใกล้เคียง</button><button type="button" data-history-scope="all" aria-pressed="${!query}">Event ทั้งหมด</button></div></div><div id="er-history-results" aria-busy="true"><p class="fp-hint" role="status">กำลังอ่านประวัติ Event…</p></div></section>`;
}
export async function renderReviewHistory(root,row){
 const section=root.querySelector('#er-history'),results=section.querySelector('#er-history-results'),input=section.querySelector('#er-history-query');
 const suggested=reviewHistoryQuery(row);let rows=[],source={},ready=false;
 const render=()=>{if(ready)results.innerHTML=reviewHistoryResults(rows,input.value.trim(),source);for(const button of section.querySelectorAll('[data-history-scope]'))button.setAttribute('aria-pressed',String(button.dataset.historyScope==='all'?!input.value.trim():!!suggested&&input.value.trim()===suggested));};
 input.oninput=render;
 for(const button of section.querySelectorAll('[data-history-scope]'))button.onclick=()=>{input.value=button.dataset.historyScope==='all'?'':suggested;render();};
 const load=async()=>{
  results.setAttribute('aria-busy','true');results.innerHTML='<p class="fp-hint" role="status">กำลังอ่านประวัติ Event…</p>';
  try{
   const response=await fetch('/api/event-predict',{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error(response.status===401?'กรุณาเข้าสู่ระบบอีกครั้งเพื่ออ่านประวัติ':'ยังอ่านประวัติ Event ไม่สำเร็จ');
   const data=await response.json();if(!Array.isArray(data.records)||data.source?.status==='unavailable')throw Error('ยังไม่มีประวัติพร้อมใช้งาน');
   rows=reviewHistoryRows(data.records);source=data.source||{};ready=true;render();
  }catch(error){ready=false;results.innerHTML=`<p class="fp-warning" role="alert">${e(error.name==='TimeoutError'?'อ่านประวัตินานกว่าปกติ กรุณาลองใหม่':error.message)}</p><button type="button" data-history-retry>ลองโหลดประวัติอีกครั้ง</button>`;results.querySelector('[data-history-retry]').onclick=load;}
  finally{results.setAttribute('aria-busy','false');}
 };
 await load();
}
