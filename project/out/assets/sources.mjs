import {eventPageForPath} from './event-pages.mjs';
import { escapeHtml as e } from './api.mjs';
const book = 'สรุปต้นทุนห้าง 2569';
const base = 'https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/edit';
const sheet = (tab, purpose, gid, range='') => ({file:book, tab, purpose, range, url:gid ? `${base}#gid=${gid}${range ? '&range='+encodeURIComponent(range) : ''}` : `${base}#range=${encodeURIComponent("'"+tab+"'!"+(range||'A1'))}`});
const financial = [sheet('Consign','ยอดขาย ต้นทุน และค่าใช้จ่ายฝากขาย'),sheet('Stand alone','ยอดขาย ต้นทุน และค่าใช้จ่ายร้านเดี่ยว; งวดอ้างอิง C5:N6'),sheet('Event เก็บเงินเอง','รายได้ ต้นทุน และกำไร Event เก็บเงินเอง'),sheet('Event จ่าย GP','รายได้ ต้นทุน และกำไร Event จ่าย GP','2066169026')];
const sales = {file:'Sales Report 2026 PC VING.xlsx',tab:'[ต้องถามเจ้าของ: ชื่อ Tab ของแต่ละเดือน]',purpose:'ยอดขายรายวัน ยอดสะสม และเป้าหมายจาก Excel Online; ตัวนำเข้าค้นหา Tab ที่มีคำว่า “ยอดขาย” และวันที่ตรงกับเดือนรายงาน',url:'https://vingrun-my.sharepoint.com/:x:/r/personal/anchalee_ving_run/_layouts/15/doc2.aspx?sourcedoc=%7B4683C9CE-44C2-4D99-93C7-575CFFEFC84B%7D&file=Sales%20Report%202026%20PC%20VING.xlsx&action=default',linkLabel:'เปิด Excel Online ต้นฉบับ ↗'};
const historical = {file:'Sales Report ปีก่อน',tab:'[ต้องถามเจ้าของ: ชื่อ Sheet และ Tab ต้นฉบับ]',purpose:'ยอดเทียบปีก่อนจากข้อมูลรายเดือนที่นำเข้าไว้ในระบบ',note:'ลิงก์ต้นฉบับ: [ต้องถามเจ้าของ]'};
const eventCatalog = year => year==='2025' ? [sheet('Event 2025','รายชื่อ จำนวนงาน และยอดขายปี 2568','1054560136')] : [sheet('Event เก็บเงินเอง','รายชื่อและกำหนดจัดงานปี 2569'),sheet('Event จ่าย GP','รายชื่อและกำหนดจัดงานปี 2569','2066169026'),sales];
const internal = {
 '/':['รายการคอนเทนต์','รูปแบบคอนเทนต์','การเผยแพร่','ผลวิเคราะห์'], '/content':['รายการคอนเทนต์','รูปแบบคอนเทนต์','การเผยแพร่','ผลวิเคราะห์'],
 '/news-desk':['รายการข่าว','แหล่งข่าว','คิวข่าวและประวัติการเผยแพร่'], '/intel':['คลังข้อมูลสืบค้น','เป้าหมายการสืบค้น','รายงานและบทพูด'],
 '/jobs':['คิวงานในระบบ'], '/settings':['การตั้งค่าของระบบ'], '/card':['รายการคอนเทนต์และรูปแบบคอนเทนต์ของการ์ดที่เลือก']
};
export function pageSources(path, {year='2026'}={}) {
 path=path.replace(/\.html$/, '').replace(/\/$/, '')||'/';
 if(eventPageForPath(path))path='/events';
 switch(path){
 case '/inventory': return [{file:'Scaleup Fulfilment · V-ING',tab:'Inventory Report · ทุกคลัง',purpose:'สต็อกคงเหลือ ยอดจอง และสต็อกพร้อมขาย · ดึงจาก Scaleup เมื่อกดอัปเดต Stock',url:'https://app.scaleup-fulfilment.com/v2/oms/reports/inventory',linkLabel:'เปิดรายงาน Scaleup ↗'},{file:'Pivot_คลังสินค้า.xlsx',tab:'Summary',range:'A1:O695',purpose:'คลัง PIVOT แยก SKU และเกรด · ราคาเต็มจากคอลัมน์ K · พร้อมขายจากคอลัมน์ L',note:'นำเข้าจากไฟล์ Excel ที่แนบ · ยอดตามไฟล์ที่นำเข้า'}];
 case '/summary': case '/sales': return [sales,historical,...financial,...eventCatalog('2025'),...eventCatalog('2026').filter(x=>x!==sales)];
 case '/daily-sales': return [sales,historical];
 case '/daily-comparison': return [
  {file:'Work Load VING 2569',tab:'Daily report',range:'C:AP · ทุกเดือน อัปเดตอัตโนมัติ',purpose:'ยอดขายปี 2569 ของ Stand Alone, EVENT, EVENT นอก และ Department Stores',url:'https://docs.google.com/spreadsheets/d/1z9Xs0JJWQHbBP2J54NLfUSDQcaNBmgTi/edit?gid=657843391#gid=657843391'},
  {file:'salse 2025.xlsx',tab:'Sheet1',purpose:'ยอดขายปี 2568 ของทั้ง 4 ช่องทางจากไฟล์ Excel ที่นำเข้า',note:'ไฟล์ที่ผู้ใช้ส่งให้ · ม.ค. ไม่มีแถว EVENT และ ก.พ. EVENT นอก มีช่องว่างในบางวัน'}
 ];
 case '/profit-loss': return financial;
 case '/contracts': return [sheet('สรุปสัญญา','ข้อมูลสัญญาห้าง','1504066538')];
 case '/product-costs': return [{file:'Cost Production 250669',tab:'ต้นทุนขายล่าสุด_230726',range:'A:AG · เฉพาะแถวสินค้า',purpose:'ต้นทุนผลิต บรรจุภัณฑ์ ค่านำเข้าคลัง และ VAT ตามชีต',url:'https://docs.google.com/spreadsheets/d/1fjLNGxGyraxmKRMVignkpcySJ9rSCFlfHTfsU4r5I-E/edit?gid=0#gid=0'}];
 case '/rebrand': return [sheet('สาขาที่รีโนเวท2026','แผนรีโนเวท งบประมาณ และความคืบหน้า','268411880','A1:I1000')];
 case '/event-proposals': return [sheet('เสนอ Event','รายการเสนอ Event','560515462','B:AA')];
 case '/events': return eventCatalog(year);
 default: return [{file:'ข้อมูลภายใน VING Warroom',tab:'ไม่มี — หน้านี้ไม่ได้อ่านจาก Sheet',purpose:(internal[path]||['ข้อมูลภายในระบบ']).join(' · '),note:'ไม่มีลิงก์ Sheet ต้นฉบับสำหรับหน้านี้'}];
 }
}
export function sourceMarkup(sources, context='') {
 return `<h2 id="source-title">แหล่งที่มา</h2>${context?`<p>${e(context)}</p>`:''}<div class="source-list">${sources.map(s=>`<article class="source-item"><h3>${e(s.purpose)}</h3><dl><dt>Sheet / ไฟล์</dt><dd>${e(s.file)}</dd><dt>Tab</dt><dd>${e(s.tab)}</dd>${s.range?`<dt>ตำแหน่ง</dt><dd>${e(s.range)}</dd>`:''}<dt>ลิงก์ต้นฉบับ</dt><dd>${s.url?`<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.linkLabel||'เปิด Sheet ต้นฉบับ ↗')}</a><small>${e(s.url)}</small>`:e(s.note)}</dd></dl></article>`).join('')}</div>`;
}
export function installSources({showDialog}) {
 const bar=document.createElement('div');bar.className='page-sources';
 const button=document.createElement('button');button.type='button';button.className='source-trigger';button.textContent='แหล่งที่มา';button.setAttribute('aria-haspopup','dialog');
 bar.append(button);document.querySelector('#app').before(bar);
 const open=()=>{
  const year=document.querySelector('select[data-event-year]')?.value||'2026';
  const selected=[...document.querySelectorAll('[data-event-year], [data-daily-sales-year], [data-daily-sales-month]')].map(s=>s.selectedOptions?.[0]?.textContent).filter(Boolean).join(' · ');
  showDialog(sourceMarkup(pageSources(location.pathname,{year}),selected?`มุมมองปัจจุบัน: ${selected}`:''));
 };
 button.addEventListener('click',open);
 document.addEventListener('click',event=>{if(event.target.closest('[data-open-sources]'))open();});
}
