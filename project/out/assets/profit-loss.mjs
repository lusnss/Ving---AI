import {allocateEventRecords} from './event-allocation.mjs';
import {visibleEventFinancials} from './event-visibility.mjs';
import {sameContractBranch} from './contract-pnl.mjs';
import { escapeHtml as e } from './api.mjs';
export const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
export const channels={consign:'Consign',standalone:'Stand alone','event-direct':'Event เก็บเงินเอง','event-gp':'Event จ่าย GP'};
const money=new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const percent=new Intl.NumberFormat('th-TH',{style:'percent',maximumFractionDigits:1});
const amount=v=>v===null||v===undefined?'—':money.format(v);
const sum=values=>values.some(v=>v!==null&&v!==undefined)?values.reduce((n,v)=>n+(v??0),0):null;
const tone=v=>v===null?'':v<0?'pnl-negative':'pnl-positive';
const hasValues=r=>r.gross!==null||r.net!==null||[r.cogs,r.sourceProfit,...Object.values(r.costs)].some(v=>v!==null&&v!==0);
const recordIdentity=r=>[r.channel,(r.code||r.name).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()];
const lines=[['gross','ยอดขายก่อนส่วนลด'],['discount','หัก ส่วนลด'],['net','ยอดขายสุทธิ'],['cogs','หัก ต้นทุนสินค้า'],['grossProfit','กำไรขั้นต้น'],['rent','GP / ค่าเช่า'],['electricity','ค่าไฟ'],['pc','ค่าพนักงาน PC'],['shipping','ค่าขนส่ง'],['depreciation','ค่าเสื่อม / ตกแต่ง'],['interest','ดอกเบี้ยค่ามัดจำพื้นที่'],['landTax','ภาษีที่ดิน'],['mallDeduction','ค่าห้างหัก'],['marketing','การตลาด'],['misc','ค่าใช้จ่ายอื่น'],['opex','รวมค่าใช้จ่ายดำเนินงาน'],['profit','กำไรตามต้นทุนที่บันทึก']];
export function summarize(records) {
  const pending=records.filter(r=>!hasValues(r)).length;
  records=records.filter(hasValues);
  const result={count:records.length,pending,costOnly:records.filter(r=>r.net===null).length,missingCosts:records.reduce((n,r)=>n+r.missingCosts,0),missingCore:records.filter(r=>r.net===null||r.cogs===null||r.opex===null).length,mismatches:records.filter(r=>r.difference!==null&&Math.abs(r.difference)>1).length};
  for(const [key] of lines)result[key]=sum(records.map(r=>Object.hasOwn(r,key)?r[key]:r.costs[key]));
  // Sum recorded revenue and costs, including expenses on rows awaiting revenue.
  // Missing source values stay null in the detail view and remain flagged above.
  result.grossProfit=result.net!==null&&result.cogs!==null?result.net-result.cogs:null;
  result.profit=result.grossProfit!==null&&result.opex!==null?result.grossProfit-result.opex:null;
  result.margin=result.profit!==null&&result.net>0?result.profit/result.net:null;
  return result;
}
export function selectRecords(data,state) {
  return allocateEventRecords(visibleEventFinancials(data).records).filter(r=>(!data.year||r.year===data.year)&&(!state.branch||sameContractBranch(r.name,state.branch))&&(state.month==='all'||r.month===Number(state.month))&&(state.channel==='all'||r.channel===state.channel)&&(state.basis==='all'||r.basis===state.basis));
}
export function statementRecords(data,state) {
  const records=selectRecords(data,{...state,month:'all'});
  return records.filter(r=>r.year===data.year&&(state.month==='all'||(state.salesMode==='cumulative'?r.month>=1&&r.month<=Number(state.month):r.month===Number(state.month))));
}
export function outcomeCounts(records) {
  const groups={branches:new Map(),events:new Map()};
  for(const r of records) {
    const event=r.channel.startsWith('event-');
    if(event&&!hasValues(r))continue;
    const identity=(r.code||r.name).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
    const key=JSON.stringify(event?[r.allocation?.key||r.year,r.allocation?'occurrence':r.month,r.channel,identity]:[r.channel,identity]);
    const bucket=event?groups.events:groups.branches;
    if(!bucket.has(key))bucket.set(key,[]);
    bucket.get(key).push(r);
  }
  return Object.fromEntries(Object.entries(groups).map(([kind,group])=>{
    const counts={total:group.size,profit:0,loss:0,zero:0,pending:0};
    for(const rows of group.values()) {
      const s=summarize(rows);
      if(s.profit===null||s.missingCore){counts.pending++;continue;}
      const cents=Math.round(s.profit*100);
      counts[cents>0?'profit':cents<0?'loss':'zero']++;
    }
    return [kind,counts];
  }));
}
export function monthOverMonth(current,previous) {
  if(!Number.isFinite(current)||!Number.isFinite(previous)||previous<=0)return null;
  const result=(current-previous)/previous;
  return Number.isFinite(result)?result:null;
}
export function monthlySummaries(data,selection) {
  return months.map((_,i)=>{
    const records=selectRecords(data,{...selection,month:String(i+1)});
    return {...summarize(records),records,bases:[...new Set(records.filter(hasValues).map(r=>r.basis))].sort().join('+')};
  });
}
export function profitStatus(r) {
  if(!Number.isFinite(r.profit))return 'pending';
  const cents=Math.round(r.profit*100);
  return cents>0?'profit':cents<0?'loss':'zero';
}
export function detailComparisons(data,selection,detailBasis='') {
  // Baselines ignore month/value/status filters so hiding a row cannot change MoM.
  const pool=selectRecords(data,{...selection,month:'all'}).filter(r=>!detailBasis||r.basis===detailBasis);
  const byMonth=new Map();
  for(const r of pool) {
    const key=JSON.stringify([...recordIdentity(r),r.year,r.month]);
    if(!byMonth.has(key))byMonth.set(key,[]);
    byMonth.get(key).push(r);
  }
  return selectRecords(data,selection).map(r=>{
    const previousYear=r.month===1?r.year-1:r.year,previousMonth=r.month===1?12:r.month-1;
    const candidates=byMonth.get(JSON.stringify([...recordIdentity(r),previousYear,previousMonth]))||[];
    const sameBasis=candidates.filter(candidate=>candidate.basis===r.basis);
    const matches=sameBasis.length?sameBasis:candidates;
    const previous=matches.length===1?matches[0]:null;
    const previousNote=matches.length>1?'ข้อมูลเดือนก่อนซ้ำ':previous?`${months[previous.month-1]} ${previous.basis}${previous.basis!==r.basis?' → '+r.basis:''}`:'ไม่มีรายการเดียวกันเดือนก่อน';
    return {...r,previous,previousNote,momNet:monthOverMonth(r.net,previous?.net),momProfit:monthOverMonth(r.profit,previous?.profit)};
  }).sort((a,b)=>a.channel.localeCompare(b.channel)||a.name.localeCompare(b.name,'th')||a.year-b.year||a.month-b.month||a.basis.localeCompare(b.basis));
}
const filterNumber=value=>{
  const clean=String(value??'').trim().replaceAll(',','');
  return clean!==''&&/^-?\d+(\.\d+)?$/.test(clean)?Number(clean):null;
};
export function filterDetails(records,filters={}) {
  const query=String(filters.name||'').trim().normalize('NFKC').toLowerCase();
  return records.filter(r=>{
    if(query&&!`${r.name} ${r.code} ${channels[r.channel]}`.normalize('NFKC').toLowerCase().includes(query))return false;
    if(filters.channel&&r.channel!==filters.channel)return false;
    if(filters.month&&r.month!==Number(filters.month))return false;
    if(filters.basis&&r.basis!==filters.basis)return false;
    if(filters.status&&profitStatus(r)!==filters.status)return false;
    for(const key of ['net','cogs','opex','profit','momNet','momProfit'])for(const bound of ['min','max']) {
      const value=filters[`${key}_${bound}`];
      if(value===undefined||String(value).trim()==='')continue;
      const parsed=filterNumber(value);
      if(parsed===null||!Number.isFinite(parsed)||!Number.isFinite(r[key]))return false;
      const limit=key.startsWith('mom')?parsed/100:parsed;
      if(bound==='min'?r[key]<limit:r[key]>limit)return false;
    }
    return true;
  });
}
export function filteredDetailSummary(records) {
  // Use the exact visible table rows so every active filter also applies to totals.
  const entities=[...new Map(records.map(r=>[JSON.stringify(recordIdentity(r)),{name:r.name,channel:r.channel}])).values()];
  const populated=records.filter(hasValues);
  const monthCount=basis=>new Set(populated.filter(r=>!basis||r.basis===basis).map(r=>r.month)).size;
  return {...summarize(records),records,entities,months:monthCount(),actMonths:monthCount('ACT'),fctMonths:monthCount('FCT')};
}
let state;
let detailFilters={};
function readState(data) {
  const query=new URLSearchParams(location.search);
  const current=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',month:'numeric'}).format(new Date()));
  return {salesMode:query.get('salesMode')==='cumulative'?'cumulative':'current',branch:String(query.get('branch')||'').trim().slice(0,120),month:/^(all|[1-9]|1[0-2])$/.test(query.get('month')||'')?query.get('month'):String(current),channel:Object.hasOwn(channels,query.get('channel'))?query.get('channel'):'all',basis:['ACT','FCT'].includes(query.get('basis'))?query.get('basis'):'all'};
}
function storeState(){const url=new URL(location.href);for(const [key,value] of Object.entries(state))url.searchParams.set(key,value);history.replaceState(null,'',url);}
const basisLabel=records=>{const values=[...new Set(records.map(r=>r.basis))];return values.length>1?'ยอดบันทึก + คาดการณ์ FCT':values[0]==='FCT'?'คาดการณ์ FCT':values.length?'ยอดที่บันทึก ACT':'ไม่มีข้อมูล';};
export function netSalesRatio(value,netSales) {
  if(!Number.isFinite(value)||!Number.isFinite(netSales)||netSales<=0)return null;
  const ratio=value/netSales;
  return Number.isFinite(ratio)?ratio:null;
}
function tableCell(v,profit=false,netSales=undefined){
  const ratio=netSalesRatio(v,netSales);
  const share=netSales===undefined?'':`<small class="pnl-percent" aria-label="${ratio===null?'ไม่สามารถคำนวณเปอร์เซ็นต์เทียบยอดขายสุทธิ':percent.format(ratio)+' ของยอดขายสุทธิ'}">${ratio===null?'—':percent.format(ratio)}</small>`;
  return `<td class="${profit?tone(v):''}">${amount(v)}${share}</td>`;
}
const signedPercent=new Intl.NumberFormat('th-TH',{style:'percent',maximumFractionDigits:1,signDisplay:'exceptZero'});
function momCell(current,previous,reason='') {
  const growth=monthOverMonth(current,previous);
  const explanation=reason||(!Number.isFinite(current)||!Number.isFinite(previous)?'ไม่มีข้อมูลเทียบเดือนก่อน':previous===0?'เดือนก่อนเป็นศูนย์':previous<0?'เดือนก่อนติดลบ':'');
  return `<td class="pnl-mom ${growth===null?'':tone(growth)}">${growth===null?'—':signedPercent.format(growth)}${explanation?`<small>${e(explanation)}</small>`:''}</td>`;
}
function countsCard(title,counts,unit) {
  return `<article class="pnl-outcome"><div class="pnl-outcome-heading"><h3>${title}</h3><span>${counts.total} ${unit}</span></div><dl><div><dt>กำไร</dt><dd class="pnl-positive">${counts.profit}</dd></div><div><dt>ขาดทุน</dt><dd class="pnl-negative">${counts.loss}</dd></div><div><dt>เท่าทุน</dt><dd>${counts.zero}</dd></div><div><dt>รอข้อมูล</dt><dd>${counts.pending}</dd></div></dl></article>`;
}
function detailSelect(key,label,options) {
  return `<select data-pnl-filter="${key}" aria-label="${label}"><option value="">ทั้งหมด</option>${options.map(([value,name])=>`<option value="${e(String(value))}" ${detailFilters[key]===String(value)?'selected':''}>${e(name)}</option>`).join('')}</select>`;
}
function detailRange(key,label) {
  return `<div class="pnl-range">${['min','max'].map((bound,i)=>`<input type="search" inputmode="decimal" data-pnl-filter="${key}_${bound}" aria-label="${label}${i?'สูงสุด':'ต่ำสุด'}" placeholder="${i?'ถึง':'ตั้งแต่'}" value="${e(detailFilters[key+'_'+bound]||'')}">`).join('')}</div>`;
}
const outcomeLabels={profit:'กำไร',loss:'ขาดทุน',zero:'เท่าทุน',pending:'รอข้อมูล'};
const signedMoney=new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
function detailMomCell(r,key) {
  const previous=r.previous?.[key],current=r[key];
  const growth=monthOverMonth(current,previous);
  const delta=Number.isFinite(current)&&Number.isFinite(previous)?current-previous:null;
  const reason=!r.previous?r.previousNote:!Number.isFinite(current)||!Number.isFinite(previous)?'ข้อมูลไม่ครบ':previous===0?'ฐานเดือนก่อนเป็นศูนย์':previous<0?'ฐานเดือนก่อนติดลบ':'';
  return `<td class="pnl-mom ${delta===null?'':tone(delta)}">${growth===null?'—':signedPercent.format(growth)}${delta===null?'':`<small class="pnl-mom-delta">${signedMoney.format(delta)} บาท</small>`}${reason?`<small>${e(reason)}</small>`:''}${r.previous?`<small>${e(r.previousNote)}</small>`:''}</td>`;
}
function detailRows(records) {
  return records.map(r=>`<tr><th scope="row">${e(r.name)}<small>${channels[r.channel]}${r.code?' · '+e(r.code):''}</small>${r.allocation?`<small>ยอดรวมรอบงาน · เฉลี่ย ${r.allocation.days}/${r.allocation.totalDays} วัน${r.allocation.crossMonth?' · คาบเกี่ยวเดือน':''}</small>`:r.allocationWarning?`<small>${e(r.allocationWarning)}</small>`:''}</th><td>${months[r.month-1]}</td><td><span class="pnl-tag ${r.basis==='FCT'?'pnl-fct':''}">${r.basis}</span></td>${tableCell(r.net,false,r.net)}${detailMomCell(r,'net')}${tableCell(r.cogs,false,r.net)}${tableCell(r.opex,false,r.net)}${tableCell(r.profit,true,r.net)}${detailMomCell(r,'profit')}<td><span class="pnl-outcome-tag pnl-outcome-${profitStatus(r)}">${outcomeLabels[profitStatus(r)]}</span></td></tr>`).join('')||'<tr><td colspan="10" class="pnl-empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>';
}
function filteredDetailContent(data,records) {
  const annual=filteredDetailSummary(records);
  const selected=annual.entities.length===1?`${annual.entities[0].name} · ${channels[annual.entities[0].channel]}`:annual.entities.length?`${annual.entities.length} สาขา / Event${detailFilters.name?' · ค้นหา “'+detailFilters.name.trim()+'”':''}`:'ไม่พบรายการที่ตรงกับตัวกรอง';
  const coverage=[annual.actMonths?`ACT ${annual.actMonths} เดือน`:'',annual.fctMonths?`FCT ${annual.fctMonths} เดือน`:''].filter(Boolean).join(' · ');
  const issues=[annual.pending?`รอข้อมูล ${annual.pending} รายการ`:'',annual.costOnly?`มีต้นทุนแต่รอยอดขาย ${annual.costOnly} รายการ`:'',annual.missingCosts?`ต้นทุนยังไม่ครบ ${annual.missingCosts} ช่อง`:'',annual.missingCore?'ข้อมูลหลักบางรายการยังไม่ครบ':''].filter(Boolean);
  return `<div class="pnl-annual-head"><div><h3>ยอดรวมตามตัวกรอง · ${data.year+543}</h3><p>${e(selected)}</p></div><span class="pnl-basis-badge">${e(basisLabel(annual.records))}</span></div>
    <dl class="pnl-annual-values"><div><dt>ยอดขายสุทธิ <small>บาท</small></dt><dd>${amount(annual.net)}</dd><p>${annual.records.length} รายการ · ${annual.months} เดือน${coverage?' · '+coverage:''}</p></div><div><dt>กำไร–ขาดทุน <small>บาท</small></dt><dd class="${tone(annual.profit)}">${amount(annual.profit)}</dd><p>ตามต้นทุนที่บันทึก · อัตรากำไร ${annual.margin===null?'—':percent.format(annual.margin)}</p></div></dl>
    ${issues.length?`<p class="pnl-annual-warning">กำไรเบื้องต้น · ${issues.join(' · ')} · รวมเฉพาะตัวเลขที่บันทึกแล้ว</p>`:''}
    <p class="pnl-annual-scope">รวมเฉพาะรายการที่แสดงในตาราง ตามตัวกรองทั้งหมดที่เลือก</p>`;
}
function detailsSection(data,records,title) {
  const visible=filterDetails(records,detailFilters);
  const active=Object.values(detailFilters).some(v=>String(v).trim());
  return `<section class="card section-gap" id="pnl-detail-section"><div class="pnl-section-head"><h2>รายละเอียดสาขาและ Event</h2><span>${e(title)} · <span id="pnl-detail-count" role="status" aria-live="polite">แสดง ${visible.length} จาก ${records.length} รายการ</span></span></div>
    <div class="pnl-filter-bar"><p>กรองได้ใต้หัวคอลัมน์ · ยอดรวมเปลี่ยนตามตัวกรองทั้งหมด</p><button type="button" id="pnl-clear-filters" ${active?'':'disabled'}>ล้างตัวกรองคอลัมน์</button></div>
    <div class="pnl-annual-summary" id="pnl-annual-summary" role="region" aria-label="ยอดรวมตามตัวกรอง" aria-live="polite" aria-atomic="true">${filteredDetailContent(data,visible)}</div>
    <p class="pnl-percent-note">% ใต้ยอดเงิน = เทียบยอดขายสุทธิของแถวนั้น · MoM เทียบสาขา/งานเดียวกันในช่องทางเดิมกับเดือนก่อน พร้อมส่วนต่างเป็นบาท · ฐานเดือนก่อนเป็นศูนย์หรือติดลบแสดงเฉพาะส่วนต่าง · สถานะตามกำไรที่บันทึก</p>
    <div class="pnl-table-scroll" tabindex="0" role="region" aria-label="รายละเอียดสาขาและกิจกรรม"><table class="pnl-table pnl-details"><thead><tr><th scope="col">สาขา / Event</th><th scope="col">เดือน</th><th scope="col">ประเภท</th><th scope="col">ยอดขายสุทธิ</th><th scope="col">MoM ยอดขาย</th><th scope="col">ต้นทุนสินค้า</th><th scope="col">ค่าใช้จ่าย</th><th scope="col">กำไรตามต้นทุนที่บันทึก</th><th scope="col">MoM กำไร</th><th scope="col">สถานะ</th></tr>
    <tr class="pnl-column-filters"><td><input type="search" data-pnl-filter="name" aria-label="ค้นหาสาขา Event หรือรหัส" placeholder="ค้นหาชื่อ / รหัส" value="${e(detailFilters.name||'')}">${detailSelect('channel','กรองช่องทางในรายละเอียด',Object.entries(channels))}</td><td>${detailSelect('month','กรองเดือนในรายละเอียด',months.map((m,i)=>[String(i+1),m]))}</td><td>${detailSelect('basis','กรองประเภทข้อมูลในรายละเอียด',[['ACT','ACT'],['FCT','FCT']])}</td><td>${detailRange('net','ยอดขายสุทธิ')}</td><td>${detailRange('momNet','MoM ยอดขาย (%)')}</td><td>${detailRange('cogs','ต้นทุนสินค้า')}</td><td>${detailRange('opex','ค่าใช้จ่าย')}</td><td>${detailRange('profit','กำไร')}</td><td>${detailRange('momProfit','MoM กำไร (%)')}</td><td>${detailSelect('status','กรองสถานะกำไรขาดทุน',Object.entries(outcomeLabels))}</td></tr></thead><tbody id="pnl-detail-rows">${detailRows(visible)}</tbody></table></div></section>`;
}
export function eventAllocationSection(records) {
  const events=records.filter(r=>r.channel.startsWith('event-'));
  if(!events.length)return '';
  const allocated=events.filter(r=>r.allocation);
  const count=rows=>new Set(rows.map(r=>r.allocation?.key||JSON.stringify(recordIdentity(r)))).size;
  const totals=summarize(allocated),counts=outcomeCounts(allocated).events;
  const fmtDate=date=>date.split('-').reverse().join('/');
  return `<section class="card section-gap pnl-event-allocation"><div class="pnl-section-head"><h2>Event · เฉลี่ยยอดรวมตามวันจัดงาน</h2><span>ยอดรวมรอบงาน ${count(allocated)} งาน · คาบเกี่ยวเดือน ${count(allocated.filter(r=>r.allocation.crossMonth))} งาน</span></div>
  <p class="pnl-percent-note">ยอดรวมในสรุปต้นทุนห้าง ÷ จำนวนวันจัดทั้งหมด × จำนวนวันในเดือนที่เลือก · เฉลี่ยทั้งยอดขายและต้นทุน · เป็นค่าประมาณรายวัน ไม่ใช่ยอดขายจริงรายวัน</p>
  <p>กำไร ${counts.profit} งาน · ขาดทุน ${counts.loss} งาน · เท่าทุน ${counts.zero} งาน · รอข้อมูล ${counts.pending} งาน · กำไร/ขาดทุนสุทธิที่จัดสรร ${amount(totals.profit)} บาท</p>
  <div class="pnl-table-scroll" tabindex="0" role="region" aria-label="การเฉลี่ยยอด Event"><table class="pnl-table"><thead><tr><th>Event / วันจัด</th><th>เดือนที่บันทึก</th><th>เดือนที่จัดสรร / วัน</th><th>ยอดขายรวมรอบงาน</th><th>ยอดขายเฉลี่ย/วัน</th><th>ยอดขายในเดือน</th><th>กำไร/ขาดทุนเฉลี่ย/วัน</th><th>กำไร/ขาดทุนในเดือน</th></tr></thead><tbody>${events.map(r=>{const a=r.allocation;return `<tr><th>${e(r.name)}<small>${e(channels[r.channel])}</small>${a?`<small>${fmtDate(a.range.start)} – ${fmtDate(a.range.end)}</small>`:`<small>${e(r.allocationWarning||'รอตรวจสอบ')}</small>`}</th><td>${months[(a?.sourceMonth||r.month)-1]}</td><td>${months[r.month-1]} ${r.year+543}${a?`<small>${a.days} / ${a.totalDays} วัน</small>`:''}</td>${tableCell(a?.net??null)}${tableCell(a?.dailyNet??null)}${tableCell(r.net)}${tableCell(a?.dailyProfit??null,true)}${tableCell(r.profit,true)}</tr>`;}).join('')}</tbody></table></div>
  <p class="help">ยอดรวมรอบงานเป็นยอดอ้างอิงเดิม อย่านำยอดอ้างอิงที่ซ้ำในหลายเดือนมาบวกกัน · ยอดในเดือนรวมอยู่ในงบและการ์ดด้านบนแล้ว · งานไม่มีวันที่ครบหรือมีรายการแยกเดือนจะคงยอดเดือนที่บันทึกและไม่เฉลี่ยซ้ำ</p></section>`;
}
function content(data) {
  const records=selectRecords(data,state),total=summarize(records);
  const counts=outcomeCounts(records),monthly=monthlySummaries(data,state);
  const activeChannels=Object.keys(channels).filter(key=>state.channel==='all'||key===state.channel);
  const statement=statementRecords(data,state),statementTotal=summarize(statement);
  const statementPeriod=(state.month==='all'?'มกราคม–ธันวาคม':state.salesMode==='cumulative'&&state.month!=='1'?'มกราคม–'+months[Number(state.month)-1]:months[Number(state.month)-1])+' '+(data.year+543);
  const summaries=Object.fromEntries(activeChannels.map(key=>[key,summarize(statement.filter(r=>r.channel===key))]));
  const title=(state.month==='all'?'รวมปี':months[Number(state.month)-1])+' '+(data.year+543);
  const stamp=new Date(data.source.fetched_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
  const hasForecast=records.some(r=>r.basis==='FCT');
  const kpi=(label,key,extra='')=>{const ratio=netSalesRatio(total[key],total.net);return `<article class="pnl-kpi ${key==='profit'?'pnl-kpi-profit':''}"><div class="pnl-kpi-top"><span>${label}</span><small>THB</small></div><strong class="pnl-kpi-value ${key==='profit'?tone(total[key]):''} ${key==='profit'&&total[key]===null?'is-pending':''}">${key==='profit'&&total[key]===null?(records.length?'รอข้อมูลครบ':'ยังไม่มีข้อมูล'):amount(total[key])}</strong><small class="pnl-kpi-share">${ratio===null?'—':percent.format(ratio)} ของยอดขายสุทธิ</small>${extra?`<small class="pnl-kpi-note">${extra}</small>`:''}</article>`;};
  const quality=[
    ...(total.pending?[{title:`รอข้อมูลยอดขาย ${total.pending} รายการ`,body:'รวมเฉพาะรายการที่มีตัวเลข แถวที่ยังว่างแสดง — ในรายละเอียด'}]:[]),
    ...(total.costOnly?[{title:`มีต้นทุนแล้ว แต่รอยอดขาย ${total.costOnly} รายการ`,body:'หักค่าใช้จ่ายเหล่านี้ในกำไรรวมแล้ว โดยยอดขายที่ยังว่างยังไม่รวมในรายรับ'}]:[]),
    ...(total.missingCosts?[{title:`ต้นทุนยังไม่ครบ ${total.missingCosts} ช่อง`,body:'รวมเฉพาะต้นทุนที่บันทึก ช่องว่างไม่ใช่การยืนยันว่าไม่มีค่าใช้จ่าย'}]:[])
  ];
  return `<header class="page-head pnl-heading"><div><p class="eyebrow">VING / Financial overview</p><h1>งบกำไร–ขาดทุน</h1><p class="lede">รายรับ ต้นทุน และผลประกอบการจากสรุปต้นทุนห้าง</p></div><div class="pnl-period"><small>งวดรายงาน</small><strong>${e(title)}</strong></div></header>
  ${state.branch?`<section class="pnl-branch-context"><div><small>งบรายสาขา · จากสัญญาห้าง</small><h2>${e(state.branch)}</h2><p>${records.length?'ตัวเลข กราฟ และรายละเอียดด้านล่างแสดงเฉพาะสาขานี้':'ยังไม่พบงบที่ตรงกับชื่อสาขานี้ในช่วงเวลาและช่องทางที่เลือก'}</p></div><div><a href="/contracts">← กลับสัญญาห้าง</a><a href="/profit-loss?month=all&basis=ACT">ดูงบทุกสาขา ↗</a></div></section>`:''}
  <section class="pnl-controls card" aria-label="เลือกมุมมองงบกำไรขาดทุน">
    <label>ช่วงเวลา<select id="pnl-month"><option value="all" ${state.month==='all'?'selected':''}>รวมปี ${data.year+543}</option>${months.map((m,i)=>`<option value="${i+1}" ${state.month===String(i+1)?'selected':''}>${m} ${data.year+543}</option>`).join('')}</select></label>
    <label>ช่องทาง<select id="pnl-channel"><option value="all">ทุกช่องทาง</option>${Object.entries(channels).map(([key,label])=>`<option value="${key}" ${state.channel===key?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>ประเภทข้อมูล<select id="pnl-basis"><option value="all">ACT + FCT</option><option value="ACT" ${state.basis==='ACT'?'selected':''}>ยอดที่บันทึก ACT</option><option value="FCT" ${state.basis==='FCT'?'selected':''}>คาดการณ์ FCT</option></select></label>
    <div class="pnl-source"><span class="pnl-source-status ${data.source.status==='stale'?'is-stale':''}">${data.source.status==='stale'?'ใช้ข้อมูลที่ดึงสำเร็จล่าสุด':'เชื่อมข้อมูลต้นทุนออนไลน์'}</span><small>ดึงข้อมูล ${e(stamp)}</small></div>
  </section>
  <div class="pnl-kpis">${kpi('ยอดขายสุทธิ','net')}${kpi('ต้นทุนสินค้า','cogs')}${kpi('ค่าใช้จ่ายดำเนินงาน','opex')}${kpi('ต้นทุนพนักงาน PC','pc','รวมอยู่ในค่าใช้จ่ายดำเนินงานแล้ว')}${kpi('รวมกำไรตามต้นทุนที่บันทึก','profit')}</div>
  <section class="pnl-outcomes" aria-label="สรุปจำนวนสาขาและ Event">${countsCard('สาขา',counts.branches,'สาขา')}${countsCard('Event',counts.events,'งาน')}<p class="pnl-count-note">สาขานับไม่ซ้ำตามรหัสหรือชื่อในแต่ละช่องทาง โดยรวมกำไรตลอดช่วงที่เลือก · Event นับรอบงานที่มีข้อมูล รวมงานคาบเกี่ยวตามวันจัดจริง งานเดียวกันนับครั้งเดียวในช่วงที่เลือก · กำไร/ขาดทุนตามต้นทุนที่บันทึก รายการที่ขาดยอดขายหรือต้นทุนหลักแยกเป็นรอข้อมูล</p></section>
  <div class="pnl-context"><span class="pnl-basis-badge">${e(basisLabel(records))}</span><p>${hasForecast?'รวมข้อมูลคาดการณ์ FCT · เลือก ACT เพื่อดูเฉพาะยอดที่ต้นทางบันทึกเป็นยอดจริง':'แสดงตามประเภทข้อมูลที่เลือก · กำไรระดับสาขา ก่อนส่วนกลางและภาษีเงินได้'}</p></div>
  ${quality.length?`<section class="pnl-quality" role="status" aria-label="สถานะความครบถ้วนของข้อมูล"><div class="pnl-quality-heading"><strong>ข้อมูลที่ต้องตรวจสอบ</strong><span>${total.missingCore?'กำไรเบื้องต้น · ข้อมูลยังไม่ครบ':'กำไรคำนวณตามต้นทุนที่บันทึก'}</span></div><div class="pnl-quality-items">${quality.map(item=>`<p><strong>${item.title}</strong><span>${item.body}</span></p>`).join('')}</div></section>`:''}
  <section class="card pnl-statement"><div class="pnl-section-head"><h2>งบรายช่องทาง</h2><div class="pnl-statement-controls"><label for="pnl-salesMode">รูปแบบยอดขาย<select id="pnl-salesMode"><option value="cumulative" ${state.salesMode==='cumulative'?'selected':''}>ยอดขายสะสม</option><option value="current" ${state.salesMode==='current'?'selected':''}>ยอดขายปัจจุบัน</option></select></label><span>หน่วย: บาท · ${statement.length} รายการสาขา / งาน / เดือน</span></div></div>
  <p class="pnl-statement-period" role="status">${state.salesMode==='cumulative'?'ยอดขายสะสม':'ยอดขายปัจจุบัน'} · ${e(statementPeriod)}${state.month==='all'?' · เลือกเดือนด้านบนเพื่อดูยอดถึงเดือนหรือเฉพาะเดือนที่ต้องการ':''}</p>
  <p class="pnl-percent-note">% ใต้จำนวนเงิน = เทียบยอดขายสุทธิของช่องทางนั้น · คอลัมน์รวมเทียบยอดขายสุทธิรวม</p>
  <div class="pnl-table-scroll" tabindex="0" role="region" aria-label="ตารางงบกำไรขาดทุนรายช่องทาง"><table class="pnl-table"><thead><tr><th scope="col">รายการ</th>${activeChannels.map(key=>`<th scope="col">${channels[key]}<small>${basisLabel(statement.filter(r=>r.channel===key))}</small></th>`).join('')}<th scope="col">รวม</th></tr></thead><tbody>${lines.map(([key,label])=>`<tr class="${['net','grossProfit','opex'].includes(key)?'pnl-subtotal':key==='profit'?'pnl-total':''}"><th scope="row">${label}</th>${activeChannels.map(channel=>tableCell(summaries[channel][key],key==='profit',summaries[channel].net)).join('')}${tableCell(statementTotal[key],key==='profit',statementTotal.net)}</tr>`).join('')}</tbody></table></div>
  <p class="help">— = ไม่มีข้อมูล หรือไม่มีรายการค่าใช้จ่ายหมวดนี้ในชีตช่องทางนั้น · 0.00 = ต้นทางระบุตัวเลขศูนย์ · ยอดสรุปรวมเฉพาะรายการที่มีข้อมูล · % แสดง — เมื่อไม่มีข้อมูลหรือยอดขายสุทธิไม่มากกว่าศูนย์</p></section>
  <section class="card section-gap"><div class="pnl-section-head"><h2>ภาพรวมรายเดือน ${data.year+543}</h2><span>ตามช่องทางและประเภทข้อมูลที่เลือก</span></div><p class="pnl-percent-note">% ใต้จำนวนเงิน = สัดส่วนยอดขายสุทธิ · MoM = เปลี่ยนแปลงจากเดือนก่อน · — เมื่อไม่มีข้อมูลเดือนก่อนหรือฐานเดือนก่อนไม่มากกว่าศูนย์</p><div class="pnl-table-scroll" tabindex="0" role="region" aria-label="ตารางรายเดือน"><table class="pnl-table"><thead><tr><th scope="col">เดือน</th><th scope="col">ประเภท</th><th scope="col">ยอดขายสุทธิ</th><th scope="col">MoM ยอดขาย</th><th scope="col">ต้นทุนสินค้า</th><th scope="col">ค่าใช้จ่าย</th><th scope="col">กำไรตามต้นทุนที่บันทึก</th><th scope="col">MoM กำไร</th></tr></thead><tbody>${monthly.map((s,i)=>{const previous=monthly[i-1];const change=previous&&s.bases&&previous.bases&&s.bases!==previous.bases?'ฐาน ACT/FCT ต่างกัน':'';return `<tr class="${state.month===String(i+1)?'pnl-selected':''}"><th scope="row"><button type="button" class="pnl-month-link" data-month="${i+1}">${months[i]}</button></th><td>${basisLabel(s.records)}${s.missingCosts?'<small>ต้นทุนยังไม่ครบ</small>':''}${change?`<small>${change}</small>`:''}</td>${tableCell(s.net,false,s.net)}${momCell(s.net,previous?.net,i===0?'ไม่มีเดือนก่อนในชุดข้อมูล':'')}${tableCell(s.cogs,false,s.net)}${tableCell(s.opex,false,s.net)}${tableCell(s.profit,true,s.net)}${momCell(s.profit,previous?.profit,i===0?'ไม่มีเดือนก่อนในชุดข้อมูล':'')}</tr>`;}).join('')}</tbody></table></div></section>
  ${eventAllocationSection(records)}
  ${detailsSection(data,detailComparisons(data,state,detailFilters.basis),title)}
  <details class="card section-gap pnl-method"><summary>แหล่งข้อมูลและวิธีคำนวณ${total.mismatches?' · พบยอดกำไรไม่ตรงต้นทาง '+total.mismatches+' รายการ':''}</summary><p>กำไร = ยอดขายหลังส่วนลด − ต้นทุนสินค้า − ผลรวมค่าใช้จ่ายที่บันทึกในแต่ละรายการ โดยหักต้นทุนสินค้าเพียงครั้งเดียว กำไรรวม = ยอดขายสุทธิรวม − ต้นทุนสินค้ารวม − ค่าใช้จ่ายรวม รวมค่าใช้จ่ายของรายการที่ยังรอยอดขายด้วย ช่องว่างต้นทางยังคงเป็นข้อมูลรอเติม ไม่ใช่การยืนยันยอดศูนย์ อัตรากำไร = กำไร ÷ ยอดขายสุทธิ รวมปีจากรายเดือนที่เลือก</p><p>MoM = (เดือนปัจจุบัน − เดือนก่อน) ÷ เดือนก่อน × 100 คำนวณแยกยอดขายสุทธิและกำไร โดยใช้ช่องทางและประเภทข้อมูลเดียวกับตัวกรองหลัก ไม่ข้ามเดือนที่ไม่มีข้อมูล เดือนมกราคมไม่มีฐานธันวาคมของปีก่อนในชุดข้อมูลนี้ และฐานเดือนก่อนเป็นศูนย์หรือติดลบจะแสดง —</p><p>MoM ในรายละเอียดจับคู่รหัสสาขาหรือชื่อเต็มในช่องทางเดียวกันกับเดือนก่อน โดยไม่ให้ตัวกรองเดือนหรือช่วงยอดเงินตัดฐานเปรียบเทียบออก ตัวกรอง ACT/FCT ใช้กับฐานเปรียบเทียบด้วย เมื่อเลือกทั้งสองประเภทจะแสดงป้ายหากเทียบข้าม ACT/FCT · Event จับคู่เฉพาะชื่อเต็มเดียวกัน ไม่จับคู่ต่างงานหรือตัดวันที่ในชื่อทิ้ง · รายการเดือนก่อนที่ซ้ำและจับคู่ไม่ได้จะแสดง — · ส่วนต่างบาท = ยอดเดือนนี้ − ยอดเดือนก่อน</p><p>% ในตาราง = จำนวนเงิน ÷ ยอดขายสุทธิของช่องทางหรือเดือนเดียวกัน × 100 โดยยอดขายสุทธิ = 100% ยอดขายก่อนส่วนลดอาจเกิน 100% ได้ คอลัมน์รวมคำนวณจากยอดรวม ไม่ใช่ค่าเฉลี่ยของเปอร์เซ็นต์ · % แสดง — เมื่อจำนวนเงินไม่มีข้อมูลหรือยอดขายสุทธิไม่มากกว่าศูนย์</p><p>ใช้รายละเอียดสาขาจาก Consign และ Stand alone และแถวรายการจาก Event เก็บเงินเอง / Event จ่าย GP ไม่ใช้ยอดรวมที่มีสูตรข้ามแถว ต้นทุนว่างยังแจ้งในสรุปคุณภาพข้อมูลด้านบน สถานะในรายละเอียดอ้างอิงกำไรตามต้นทุนที่บันทึก</p><p>ACT / FCT ของสาขาตามป้ายในต้นทาง · Event ที่บันทึกครั้งเดียวและมีวันจัดครบ ใช้ยอดในสรุปต้นทุนห้างเป็นยอดรวมรอบงาน เฉลี่ยยอดขายและต้นทุนทุกหมวดต่อวัน แล้วจัดสรรตามวันในแต่ละเดือน (นับวันแรกและวันสุดท้าย) เป็นค่าประมาณ ไม่ใช่ยอดขายจริงรายวัน · รายการที่แยกบันทึกหลายเดือนหรือวันที่ไม่ครบคงเดือนต้นทางและแจ้งให้ตรวจสอบ · ไม่เปลี่ยนตัวเลขในชีตต้นทาง</p><p>งบนี้เป็นกำไรเบื้องต้นระดับสาขา ก่อนส่วนกลางและภาษีเงินได้ ครอบคลุมรายการในสรุปต้นทุนห้าง ไม่รวมช่องทางออนไลน์หรือค่าใช้จ่ายส่วนกลางที่ไม่มีในแหล่งข้อมูล ชีตต้นทาง: ${e(data.source.sheets.join(' · '))} · ตรวจข้อมูลใหม่ทุก 5 นาทีเมื่อมีผู้ใช้งาน</p></details>`;
}
export async function render(root,services){
  document.body.classList.add('pnl-theme');
  root.classList.add('pnl-page');
  const data=await services.api('/api/profit-loss');
  state=state||readState(data);
  document.title='งบกำไร–ขาดทุน · VING';
  const draw=()=>{
    root.innerHTML=content(data);
    for(const key of ['month','channel','basis','salesMode'])root.querySelector('#pnl-'+key).addEventListener('change',event=>{state[key]=event.target.value;storeState();draw();root.querySelector('#pnl-'+key).focus();});
    root.querySelectorAll('[data-month]').forEach(button=>button.addEventListener('click',()=>{state.month=button.dataset.month;storeState();draw();root.scrollIntoView({behavior:'smooth'});}));
    const refreshDetails=()=>{
      const records=detailComparisons(data,state,detailFilters.basis),visible=filterDetails(records,detailFilters);
      root.querySelector('#pnl-detail-rows').innerHTML=detailRows(visible);
      root.querySelector('#pnl-annual-summary').innerHTML=filteredDetailContent(data,visible);
      root.querySelector('#pnl-detail-count').textContent=`แสดง ${visible.length} จาก ${records.length} รายการ`;
      root.querySelector('#pnl-clear-filters').disabled=!Object.values(detailFilters).some(v=>String(v).trim());
    };
    root.querySelectorAll('[data-pnl-filter]').forEach(input=>input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{detailFilters[input.dataset.pnlFilter]=input.value;refreshDetails();}));
    root.querySelector('#pnl-clear-filters').addEventListener('click',()=>{
      detailFilters={};root.querySelectorAll('[data-pnl-filter]').forEach(input=>{input.value='';});refreshDetails();root.querySelector('[data-pnl-filter="name"]').focus();
    });
  };
  draw();
}
export const refreshReadonly=render;
