import {eventPnlBadge} from './event-pnl.mjs';
import {escapeHtml as e} from './api.mjs';
import {eventMonths,eventMonthNames as months,normalizeEventMonth,eventCatalogRange} from './event-months.mjs';
import {identifyVenue} from './event-predict-model.mjs';
import {tableExcelWorkbook,downloadExcelWorkbook} from './event-excel.mjs';

export const eventTypeLabels={direct:'Event เก็บเงินเอง',gp:'Event จ่าย GP',unknown:'ไม่ระบุประเภท'};
export const eventStatusLabels={upcoming:'กำลังจะจัด',live:'กำลังจัด',ended:'จบแล้ว',undated:'รอยืนยันวัน'};
const money=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2});
const dateLabel=value=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const todayInBangkok=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const directoryStatus=(item,today=todayInBangkok())=>!item.range?'undated':item.range.start>today?'upcoming':item.range.end<today?'ended':'live';
export function catalogEvent(item,year,index=0){
 const range=item.range||eventCatalogRange(item,year),knownPlace=item.place||(!Object.values(eventTypeLabels).includes(item.venue)?item.venue:'');
 const venue=identifyVenue(knownPlace||item.name||'');
 // Only the existing, curated venue aliases may resolve a place from an event title.
 const place=knownPlace||(!venue.unmapped?venue.label:'');
 const categories=[...new Set([...(item.categories||[]),item.category].filter(value=>['direct','gp'].includes(value)))];
 return {...item,year:Number(year),key:`history-${year}-${index}`,range,place,venueId:place?identifyVenue(place).id:'',categories,category:categories[0]||'unknown',months:range?Array.from({length:12},(_,i)=>i+1).filter(m=>range.start<=`${year}-${String(m).padStart(2,'0')}-${new Date(Date.UTC(Number(year),m,0)).getUTCDate()}`&&range.end>=`${year}-${String(m).padStart(2,'0')}-01`):eventMonths(item,year),days:range?(Date.parse(range.end)-Date.parse(range.start))/86400000+1:null,source:'catalog',eventTypes:[]};
}
export const catalogEvents=(items,year)=>items.map((item,index)=>catalogEvent(item,year,index));
export function eventDirectoryModel(items,year,state={},today=todayInBangkok()){
 const rows=catalogEvents(items,year),month=normalizeEventMonth(state.month),query=String(state.listQuery||'').trim().toLocaleLowerCase('th');
 const visible=rows.filter(item=>(month==='all'||(month==='unknown'?!item.months.length:item.months.includes(Number(month))))&&(!query||[item.name,item.place].join(' ').toLocaleLowerCase('th').includes(query))&&(!state.listType||state.listType==='all'||(state.listType==='unknown'?!item.categories.length:item.categories.includes(state.listType)))&&(!state.listPlace||state.listPlace==='all'||(state.listPlace==='unknown'?!item.place:item.place===state.listPlace))&&(!state.listStatus||state.listStatus==='all'||directoryStatus(item,today)===state.listStatus));
 const places=[...new Set(rows.map(item=>item.place).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
 return {rows,visible,month,places};
}
const selectOptions=(options,value)=>(Array.isArray(options)?options:Object.entries(options)).map(([key,label])=>`<option value="${e(key)}" ${key===value?'selected':''}>${e(label)}</option>`).join('');
const typeLabel=item=>item.categories.map(c=>eventTypeLabels[c]).join(' · ')||eventTypeLabels.unknown;
export const directoryDateLabel=item=>item.range?`${dateLabel(item.range.start)} – ${dateLabel(item.range.end)}`:'รอยืนยันวัน';
export function eventListMarkup(items,year,state={},pnl={}){
 const {visible,rows,month,places}=eventDirectoryModel(items,year,state),active=month!=='all'||state.listQuery||[state.listType,state.listPlace,state.listStatus].some(v=>v&&v!=='all');
 return `<section class="card section-gap event-list" aria-labelledby="event-list-title"><div class="event-list-head"><div><h2 id="event-list-title">รายชื่อ Event ปี ${Number(year)+543}</h2><p class="help" role="status" aria-live="polite">${active?`แสดง ${visible.length} จาก ${rows.length} งาน`:`${rows.length} งาน`} · ${year==='2026'?'รายงาน Event และงานที่อนุมัติแล้ว':'ชื่อจาก Event '+e(year)}</p></div><button type="button" class="ev-propose event-export" data-event-export ${visible.length?'':'disabled'}>Export Excel <span>${visible.length} งาน</span></button></div>
 <div class="event-directory-filters"><label class="event-directory-search">ค้นหาชื่องานหรือสถานที่<input type="search" data-event-list-search value="${e(state.listQuery||'')}" placeholder="พิมพ์ชื่องานหรือสถานที่…" autocomplete="off"></label><label>เดือนที่จัด<select data-event-month>${selectOptions([['all','ทุกเดือน'],...months.map((m,i)=>[String(i+1),m]),['unknown','ไม่ระบุเดือน']],month)}</select></label><label>ประเภท<select data-event-list-type>${selectOptions({all:'ทุกประเภท',...eventTypeLabels},state.listType||'all')}</select></label><label>สถานที่จัด<select data-event-list-place>${selectOptions({all:'ทุกสถานที่',...Object.fromEntries(places.map(p=>[p,p])),unknown:'ยังไม่ระบุสถานที่'},state.listPlace||'all')}</select></label><label>สถานะ<select data-event-list-status>${selectOptions({all:'ทุกสถานะ',...eventStatusLabels},state.listStatus||'all')}</select></label><button type="button" class="ev-text-button" data-event-list-reset ${active?'':'disabled'}>ล้างตัวกรอง</button></div>
 <p class="help event-month-help">งานข้ามเดือนแสดงในทุกเดือนที่จัด · จำนวนวันนับรวมวันเริ่ม–สิ้นสุดทั้งงาน · Export ตามตัวกรองที่เลือก · ยอดขายเป็นยอดรวมของงาน</p>
 <div class="table-wrap section-gap" tabindex="0" aria-label="รายชื่อ Event เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table><thead><tr><th>#</th><th>รายชื่อ Event</th><th>สถานที่จัด</th><th>ช่วงวันที่จัด</th><th>จำนวนวัน</th><th>เดือนที่จัด</th><th>ประเภท</th><th>สถานะ</th><th>ยอดขาย${year==='2026'?'จาก Sales Report':''}</th>${Number(year)===2026?'<th>กำไร / ขาดทุน</th>':''}</tr></thead><tbody>${visible.map((item,i)=>`<tr><td data-label="#">${i+1}</td><td data-label="Event">${Number(year)===2026?`<button type="button" class="event-pnl-name" data-event-pnl="${e(item.key)}"><strong>${e(item.name)}</strong></button>`:`<strong>${e(item.name)}</strong>`}</td><td data-label="สถานที่จัด">${e(item.place||'[ต้องถามเจ้าของ]')}</td><td data-label="ช่วงวันที่จัด">${e(directoryDateLabel(item))}</td><td data-label="จำนวนวัน">${item.days??'—'}</td><td data-label="เดือนที่จัด">${e(item.months.map(m=>months[m-1]).join(' · ')||'ไม่ระบุเดือน')}</td><td data-label="ประเภท">${e(typeLabel(item))}</td><td data-label="สถานะ">${eventStatusLabels[directoryStatus(item)]}</td><td data-label="ยอดขาย">${item.sales==null?'—':money.format(item.sales)}</td>${Number(year)===2026?`<td data-label="กำไร / ขาดทุน">${eventPnlBadge(item,year,pnl)}</td>`:''}</tr>`).join('')||`<tr><td colspan="${Number(year)===2026?10:9}" class="event-list-empty">ไม่พบ Event ตามตัวกรองที่เลือก</td></tr>`}</tbody></table></div><p class="help" data-event-export-message aria-live="polite"></p></section>`;
}
export const directoryExcelColumns=['ลำดับ','รายชื่อ Event','สถานที่จัด','วันเริ่ม','วันสิ้นสุด','จำนวนวัน','เดือนที่จัด','ประเภท','สถานะ','ยอดขาย'];
export function directoryExcelWorkbook(items,year,state={},today=todayInBangkok()){
 const {visible}=eventDirectoryModel(items,year,state,today);
 const rows=visible.map((item,i)=>[i+1,item.name,item.place||'[ต้องถามเจ้าของ]',item.range?.start||'',item.range?.end||'',item.days,item.months.map(m=>months[m-1]).join(' · ')||'ไม่ระบุเดือน',typeLabel(item),eventStatusLabels[directoryStatus(item,today)],item.sales??null]);
 return tableExcelWorkbook(directoryExcelColumns,rows,[10,60,32,16,16,14,28,25,20,22],{0:2,5:2,9:3});
}
export function downloadDirectoryExcel(items,year,state={}){downloadExcelWorkbook(directoryExcelWorkbook(items,year,state),`VING-Event-List-${Number(year)+543}-${normalizeEventMonth(state.month)}.xlsx`);}
