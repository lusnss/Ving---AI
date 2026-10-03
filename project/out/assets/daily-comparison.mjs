import {reportData as fallbackData} from './daily-comparison-data.mjs';
import {groups,months,fullMonths,createOverview,filterOverview,trendSeries,overviewCsv} from './daily-comparison-model.mjs';
let reportData=fallbackData;
let refreshView,needsRefresh=false;
export async function refreshComparison(api){
 try{const next=await api('/api/daily-comparison');if(!Array.isArray(next.records)||!next.sources)throw Error('Invalid report');
 const changed=JSON.stringify(next.records)!==JSON.stringify(reportData.records);reportData=next;
 needsRefresh||=changed;if(needsRefresh&&refreshView)needsRefresh=refreshView()===false;
 }catch{reportData={...reportData,live:{status:'stale'}};}
 document.querySelectorAll('[data-comparison-freshness]').forEach(el=>{el.textContent=comparisonFreshness();});
}
const colors=['#fde412','#6ea8cc','#bbd5d5','#ef7023'];
const money=n=>n===null?'—':new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const million=n=>n===null?'—':(n/1e6).toFixed(2);
const percent=n=>n===null?'—':`${n>0?'+':''}${n.toFixed(1)}%`;
const signed=n=>n===null?'—':`${n>0?'+':''}${money(n)}`;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const direction=n=>n===null?'':n>0?'is-positive':n<0?'is-negative':'';
const periodText=(s,y)=>`1 ${months[s.firstMonth-1]} – ${s.endDay} ${months[s.endMonth-1]} ${y}`;
const icon=(name)=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',print:'<path d="M6 8V3h12v5M6 18H3V9h18v9h-3M6 14h12v7H6z"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',line:'<path d="M3 4v17h18M5 15l5-7 5 4 6-8"/>',bars:'<path d="M3 21h18M6 17v-6m6 6V4m6 13V8"/>'}[name]||''}</svg>`;
export function comparisonFreshness(){return `Daily report · ${reportData.live?.status==='online'?'ตรวจชีตอัตโนมัติทุก 5 วินาที':reportData.live?.status==='refreshing'?'แสดงข้อมูลที่บันทึกไว้ · กำลังตรวจยอดใหม่':'เชื่อมต้นทางไม่ได้ — แสดงข้อมูลที่ดึงสำเร็จล่าสุด'} · ข้อมูลล่าสุด ${new Date(reportData.extractedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'medium'})}`;}
function sparkline(rows,color){
 const v=rows.map(r=>r.current.amount),max=Math.max(1,...v.filter(n=>n!==null));
 const points=v.map((n,i)=>n===null?null:[i*12,36-n/max*32]).filter(Boolean);
 return `<svg class="dr-spark" viewBox="0 0 132 40" aria-hidden="true"><polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function chartMarkup(o,mode,type,short=false){
 const rows=trendSeries(o,mode),ceiling=Math.ceil(Math.max(1,...rows.flatMap(r=>[r.current||0,r.previous||0]))/1e6)*1e6;
 const bottom=short?106:172;
 const x=i=>62+i*70, y=n=>bottom-n/ceiling*(bottom-22);
 const lines=Array.from({length:5},(_,i)=>{const n=ceiling*i/4;return `<line x1="40" x2="865" y1="${y(n)}" y2="${y(n)}" stroke="#363636" stroke-dasharray="3 6"/><text x="28" y="${y(n)+4}" text-anchor="end">${(n/1e6).toFixed(ceiling<5e6?1:0)}</text>`;}).join('');
 let series='';
 for(const [key,color] of [['previous','#6ea8cc'],['current','#fde412']]){
  if(type==='bars')series+=rows.map((r,i)=>r[key]===null?'':`<rect x="${x(i)+(key==='current'?-17:2)}" y="${y(r[key])}" width="15" height="${bottom-y(r[key])}" rx="3" fill="${color}" opacity="${key==='current'?1:.6}"/>`).join('');
  else {
   let path='',active=false;for(let i=0;i<rows.length;i++){const n=rows[i][key];if(n===null){active=false;continue;}path+=`${active?'L':'M'}${x(i)},${y(n)} `;active=true;}
   series+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="${key==='current'?3:2}" ${key==='previous'?'stroke-dasharray="6 6"':''} stroke-linejoin="round"/>`;
   series+=rows.map((r,i)=>r[key]===null?'':`<circle cx="${x(i)}" cy="${y(r[key])}" r="${key==='current'?4:3}" fill="#181818" stroke="${color}" stroke-width="2"/>`).join('');
  }
 }
 return `<div class="dr-chart" data-chart><svg viewBox="0 0 900 ${bottom+46}" role="img" aria-label="แนวโน้มยอดขายสองปี หน่วยล้านบาท ดูตัวเลขได้ในตารางรายเดือน"><text x="40" y="12">ล้านบาท</text>${lines}${series}${months.map((m,i)=>`<text x="${x(i)}" y="${bottom+32}" text-anchor="middle" class="${o.scope.firstMonth<=i+1&&o.scope.endMonth>=i+1?'selected':''}">${m}${rows[i].partial?'*':''}</text>`).join('')}</svg><div class="dr-chart-hits">${rows.map((r,i)=>`<button type="button" data-chart-month="${i+1}" aria-label="${fullMonths[i]} ${mode==='cumulative'?'ยอดสะสม':''}: 2569 ${money(r.current)} บาท, 2568 ${money(r.previous)} บาท; เลือกเดือน"><span class="dr-sr">${months[i]}</span></button>`).join('')}</div><div class="dr-tooltip" role="status" hidden></div></div>`;
}
function donutMarkup(o,selected=null){
 const current=selected?o.reports.find(r=>r.group.id===selected):null;
 let offset=0;
 const rings=o.reports.map((r,i)=>{const share=o.current.amount>0?(r.current.amount||0)/o.current.amount*100:0;const start=offset;offset+=share;return `<circle class="dr-ring" data-ring="${r.group.id}" cx="110" cy="110" r="83" fill="none" stroke="${selected&&selected!==r.group.id?'#383838':colors[i]}" stroke-width="19" pathLength="100" stroke-dasharray="${Math.max(0,share-.7)} ${100-Math.max(0,share-.7)}" stroke-dashoffset="${-start}" transform="rotate(-90 110 110)"/>`;}).join('');
 return `<div class="dr-donut"><svg viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="83" fill="none" stroke="#2f2f2f" stroke-width="19"/>${o.current.amount>0?rings:''}</svg><div><span>${current?.group.name||'ยอดรวม 2569'}</span><strong>${million(current?current.current.amount:o.current.amount)}</strong><small>ล้านบาท</small></div></div><div class="dr-mix-list">${o.reports.map((r,i)=>`<button type="button" aria-pressed="${selected===r.group.id}" data-channel="${r.group.id}" data-mix="${r.group.id}"><span><i style="background:${colors[i]}"></i>${r.group.name}</span><strong>${o.current.amount>0?((r.current.amount||0)/o.current.amount*100).toFixed(1)+'%':'—'}</strong></button>`).join('')}</div>`;
}
function values(r){return `<td class="dr-current">${money(r.current.amount)}</td><td>${money(r.previous.amount)}${r.previous.amount!==null&&!r.previous.complete?'<small>ข้อมูลไม่ครบ</small>':''}</td><td class="${direction(r.delta)}">${signed(r.delta)}</td><td><span class="dr-change ${direction(r.growth)}">${percent(r.growth)}</span></td>`;}
export async function render(app,{api}={}){
 if(api)await refreshComparison(api);
 document.body.classList.add('daily-comparison-page');app.classList.add('dr-root');
 document.title='ภาพรวมยอดขาย · 2569 เทียบ 2568 | VING';
 const params=new URLSearchParams(location.search);
 let period=/^(matched|ytd|[1-9]|1[0-2])$/.test(params.get('period')||'')?params.get('period'):String(createOverview(reportData).scope.latest.month);
 let mode='monthly',type='line',search='',sort='sales',captureMode=false,captureScroll=0;
 let channel=groups.some(g=>g.id===params.get('channel'))?params.get('channel'):'all';
 const expanded=new Set();
 let overview,allOverview;
 function saveSelection(){const url=new URL(location.href);url.searchParams.set('period',period);if(channel==='all')url.searchParams.delete('channel');else url.searchParams.set('channel',channel);history.replaceState(null,'',url);}
 function selectChannel(value,focus){const top=scrollY;channel=value;search='';saveSelection();paint();window.scrollTo({top,behavior:'instant'});app.querySelector(focus)?.focus({preventScroll:true});}
 function setCapture(active,restoreScroll=true){
  if(active&&!captureMode)captureScroll=window.scrollY;
  captureMode=active;document.body.classList.toggle('dr-capture',active);
  refreshChart();
  const button=app.querySelector('[data-capture]');
  button.setAttribute('aria-pressed',String(active));
  button.textContent=active?'กลับมุมมองปกติ · Esc':'แคป 1 หน้า';
  window.scrollTo({top:active?0:restoreScroll?captureScroll:window.scrollY,behavior:'instant'});
  if(!active)button.focus({preventScroll:true});
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&captureMode){e.preventDefault();setCapture(false);}});
 matchMedia('(min-width:1000px)').addEventListener('change',e=>{if(!e.matches&&captureMode)setCapture(false);});
 window.addEventListener('resize',()=>{if(captureMode)refreshChart();});
 function selectPeriod(value,focus){period=value;saveSelection();paint();if(focus)app.querySelector(focus)?.focus({preventScroll:true});}
 function detailsMarkup(){
  return overview.reports.map((r,i)=>{
   let channels=r.channels.filter(c=>`${r.group.name} ${c.name}`.toLowerCase().includes(search.toLowerCase()));
   channels.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'th'):sort==='growth'?(a,b)=>(b.growth??-Infinity)-(a.growth??-Infinity):(a,b)=>(b.current.amount??-1)-(a.current.amount??-1));
   const open=expanded.has(r.group.id)||!!search;
   return `<tbody id="detail-${r.group.id}" class="dr-group"><tr class="dr-group-row"><th scope="row"><button type="button" data-expand="${r.group.id}" aria-expanded="${open}" aria-controls="branches-${r.group.id}"><span class="dr-chevron">${open?'−':'+'}</span><i style="background:${colors[groups.findIndex(g=>g.id===r.group.id)]}"></i><span>${r.group.name}<small>${channels.length} ช่องทางย่อย</small></span></button></th>${values(r)}</tr></tbody><tbody id="branches-${r.group.id}" ${open?'':'hidden'}>${channels.map(c=>`<tr class="dr-branch"><th scope="row">${esc(c.name)}</th>${values(c)}</tr>`).join('')||'<tr><td colspan="5" class="dr-empty">ไม่พบช่องทางย่อยที่ตรงกับคำค้น</td></tr>'}</tbody>`;
  }).join('');
 }
 function refreshDetails(){app.querySelector('[data-detail-body]').innerHTML=`<table class="dr-table dr-detail-table"><thead><tr><th scope="col">ช่องทาง / สาขา</th><th scope="col">2569 · บาท</th><th scope="col">2568 · บาท</th><th scope="col">ผลต่าง · บาท</th><th scope="col">เปลี่ยนแปลง</th></tr></thead>${detailsMarkup()}<tfoot><tr><th scope="row">${overview.selectedGroup?.name||'รวม 4 ช่องทาง'}</th>${values(overview)}</tr></tfoot></table>`;}
 function refreshChart(){
  app.querySelector('[data-chart-slot]').innerHTML=chartMarkup(overview,mode,type,captureMode&&innerHeight<820);
  app.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  app.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===type)));
  const hasGaps=overview.monthly.slice(0,overview.scope.latest.month).some(m=>!m.previous.complete);
  app.querySelector('[data-chart-note]').textContent=mode==='cumulative'?`ยอดสะสมเริ่ม 1 ม.ค. · ${months[overview.scope.latest.month-1]} สะสมถึงวันที่ ${overview.scope.latest.day}${hasGaps?' · ปี 2568 บางเดือนข้อมูลไม่ครบ':''}`:`กราฟแสดงทั้งปี · * ${months[overview.scope.latest.month-1]} เทียบวันที่ 1–${overview.scope.latest.day} ทั้งสองปี${hasGaps?' · ปี 2568 บางเดือนข้อมูลไม่ครบ':''}`;
  const rows=trendSeries(overview,mode),tooltip=app.querySelector('.dr-tooltip');
  for(const b of app.querySelectorAll('[data-chart-month]')){
   const show=()=>{const m=Number(b.dataset.chartMonth),r=rows[m-1];tooltip.innerHTML=`<strong>${fullMonths[m-1]}${mode==='cumulative'?' · สะสมตั้งแต่ต้นปี':''}${r.partial?` · ถึงวันที่ ${overview.scope.latest.day}`:''}</strong><span><i class="dr-dot"></i>2569 <b>${money(r.current)}</b></span><span><i class="dr-dot prior"></i>2568 <b>${money(r.previous)}</b></span>${hasGaps&&(m<=2||mode==='cumulative')?'<small>2568: ม.ค.–ก.พ. ข้อมูลบางกลุ่มไม่ครบ</small>':''}`;tooltip.hidden=false;tooltip.style.left=`${Math.min(67,Math.max(1,(m-1)*7))}%`;b.classList.add('hovered');};
   const hide=()=>{tooltip.hidden=true;b.classList.remove('hovered');};b.addEventListener('pointerenter',show);b.addEventListener('focus',show);b.addEventListener('pointerleave',hide);b.addEventListener('blur',hide);b.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  }
 }
 function paint(){
  allOverview=createOverview(reportData,period);overview=filterOverview(allOverview,channel);const o=overview,q=o.matched||o,label=o.selectedGroup?.name||'รวมทุกช่องทาง',range=periodText(o.scope,2569),share=allOverview.current.amount>0&&o.largest?.current.amount!==null?(o.largest.current.amount/allOverview.current.amount*100):null;
  app.innerHTML=`<div class="dr-page"><div class="dr-overview">
   <header class="dr-heading"><div><p class="dr-eyebrow"><span></span> VING INTELLIGENCE / DAILY REPORT</p><h1>ภาพรวมยอดขาย <span>2569 <em>เทียบ</em> 2568</span></h1><p class="dr-subtitle">Stand Alone · EVENT · EVENT นอก · Department Stores</p></div><div class="dr-actions"><button type="button" class="dr-button dr-capture-button" data-capture aria-pressed="${captureMode}">${captureMode?'กลับมุมมองปกติ · Esc':'แคป 1 หน้า'}</button><button type="button" class="dr-button" data-export>${icon('download')}<span>ดาวน์โหลด CSV</span></button><button type="button" class="dr-button dr-icon" data-print aria-label="พิมพ์รายงาน">${icon('print')}</button></div></header>
   <section class="dr-toolbar" aria-label="เลือกช่วงรายงาน"><div class="dr-range-label"><span class="dr-eyebrow">COMPARISON PERIOD</span><strong>${range} · <span data-selection-label>${label}</span></strong><small>ยอดล่าสุดที่บันทึกก่อนหักคืนเงิน · การ์ด YOY ใช้ช่วงวันที่ร่วมกัน</small></div><div class="dr-filter-controls"><button type="button" class="dr-button dr-all" data-all aria-pressed="${channel==='all'}">รวมทุกช่องทาง</button><label class="dr-select-label">ช่วงรายงาน<select id="dr-period"><option value="matched" ${period==='matched'?'selected':''}>สะสมจากเดือนที่เทียบได้</option><option value="ytd" ${period==='ytd'?'selected':''}>สะสมตั้งแต่ต้นปี</option>${fullMonths.map((m,i)=>`<option value="${i+1}" ${period===String(i+1)?'selected':''}>${m}${i+1>o.scope.latest.month?' · ยังไม่มี 2569':''}</option>`).join('')}</select></label></div></section>
   <div class="dr-months" aria-label="เลือกเดือน">${months.map((m,i)=>`<button type="button" data-month="${i+1}" aria-pressed="${period===String(i+1)}" class="${i+1>o.scope.latest.month?'future':''}"><span>${String(i+1).padStart(2,'0')}</span>${m}${i+1===o.scope.latest.month?'<i aria-hidden="true"></i>':''}</button>`).join('')}</div>
   <div class="dr-context ${!o.current.complete||!o.previous.complete?'warning':''}" role="status"><span class="dr-context-dot"></span><p>${period==='matched'?`ยอดล่าสุด: ${range} · การ์ด YOY แยกใช้ช่วงวันที่ร่วมกัน`:!o.current.complete||!o.previous.complete?'ยอดล่าสุดรวมทุกวันที่บันทึกแล้ว · วันที่แต่ละช่องทางอาจต่างกัน · การ์ด YOY แยกเทียบถึงวันร่วมกัน':'ข้อมูลรายวันครบระดับกลุ่มช่องทางทั้งสองปีในช่วงที่เลือก'}</p><button type="button" data-method>วิธีคำนวณ ↗</button></div>
   <section class="dr-kpis" aria-label="สรุปยอดขาย"><article class="dr-kpi dr-kpi-gold"><div class="dr-kpi-label">ยอดล่าสุด 2569 <span>${channel==='all'?'4 CHANNELS':'1 CHANNEL'}</span></div><strong>${million(o.current.amount)}<small>ล้านบาท</small></strong><div class="dr-kpi-bottom"><b data-total-current>${money(o.current.amount)} บาท</b><span>${o.current.complete?'ตามช่วงที่เลือก':'ยอดที่มีการบันทึก'}</span></div></article><article class="dr-kpi"><div class="dr-kpi-label">2568 · ช่วงเทียบ YOY <span>PREVIOUS YEAR</span></div><strong>${million(q.previous.amount)}<small>ล้านบาท</small></strong><div class="dr-kpi-bottom"><b>${money(q.previous.amount)} บาท</b><span>${q.previous.complete?`1–${q.scope.endDay} ${months[q.scope.endMonth-1]} · ช่วงเทียบ`:'ข้อมูลบางกลุ่มยังไม่ครบ'}</span></div></article><article class="dr-kpi"><div class="dr-kpi-label">เปลี่ยนแปลงจากปีก่อน <span>YOY</span></div><strong class="${direction(q.growth)}">${percent(q.growth)}</strong><div class="dr-kpi-bottom"><b class="${direction(q.delta)}">${signed(q.delta)}${q.delta===null?'':' บาท'}</b><span>${q.growth===null?'ข้อมูลยังไม่พอสำหรับเทียบ':`2569 ช่วงเทียบ ${money(q.current.amount)} บาท · ถึง ${q.scope.endDay} ${months[q.scope.endMonth-1]}`}</span></div></article><article class="dr-kpi dr-kpi-leader"><div class="dr-kpi-label">${channel==='all'?'ช่องทางยอดขายสูงสุด':'สัดส่วนของช่องทางที่เลือก'} <span>${channel==='all'?'TOP CHANNEL':'CHANNEL SHARE'}</span></div><strong>${share===null?'—':share.toFixed(1)+'%'}<small>ของยอดรวม 4 ช่องทาง</small></strong><div class="dr-kpi-bottom"><b>${o.largest?.group.name||'ยังไม่มีข้อมูล'}</b><span>${money(o.largest?.current.amount??null)} บาท</span></div></article></section>
   <section class="dr-channel-section" aria-labelledby="dr-channel-title"><div class="dr-section-heading"><h2 id="dr-channel-title">ทุกช่องทาง ในมุมมองเดียว</h2><span>คลิกการ์ดเพื่อกรองยอดสรุปและกราฟ</span></div><div class="dr-channels">${allOverview.reports.map((r,i)=>`<button type="button" class="dr-channel" data-channel="${r.group.id}" aria-pressed="${channel===r.group.id}" style="--channel:${colors[i]}"><div class="dr-channel-head"><span><i></i>${r.group.name}</span><span class="dr-channel-number">0${i+1}</span></div><div class="dr-channel-value"><strong>${million(r.current.amount)}<small>ล้าน</small></strong><span class="dr-change ${direction(r.growth)}">${percent(r.growth)}</span></div><p>${money(r.current.amount)} บาท</p><p>${r.recordedThrough?`บันทึกถึง ${r.recordedThrough.day} ${months[r.recordedThrough.month-1]}`:'ยังไม่มียอดบันทึก'}</p><div class="dr-channel-baseline"><span>2568 <b>${money(r.previous.amount)}</b></span>${sparkline(r.monthly,colors[i])}</div><div class="dr-share-track"><i style="width:${allOverview.current.amount>0?(r.current.amount||0)/allOverview.current.amount*100:0}%"></i></div><div class="dr-channel-foot"><span>${allOverview.current.amount>0?((r.current.amount||0)/allOverview.current.amount*100).toFixed(1)+'% ของยอดรวม':'ไม่มีข้อมูลในช่วงนี้'}</span>${icon('arrow')}</div></button>`).join('')}</div></section>
   <div class="dr-chart-grid"><section class="dr-panel dr-trend"><div class="dr-panel-heading"><div><p class="dr-eyebrow">SALES TREND</p><h2>จังหวะการเติบโต · ${label}</h2></div><div class="dr-chart-controls"><div class="dr-segment" aria-label="รูปแบบยอดขาย"><button type="button" data-mode="monthly" aria-pressed="${mode==='monthly'}">รายเดือน</button><button type="button" data-mode="cumulative" aria-pressed="${mode==='cumulative'}">สะสม</button></div><div class="dr-segment"><button type="button" data-type="line" aria-pressed="${type==='line'}" aria-label="กราฟเส้น">${icon('line')}</button><button type="button" data-type="bars" aria-pressed="${type==='bars'}" aria-label="กราฟแท่ง">${icon('bars')}</button></div></div></div><div class="dr-legend"><span><i class="dr-dot"></i>2569</span><span><i class="dr-dot prior"></i>2568</span><small>ชี้เพื่อดูยอด · เลือกเพื่อดูรายเดือน</small></div><div data-chart-slot></div><p class="dr-footnote" data-chart-note></p></section><section class="dr-panel dr-mix"><div class="dr-panel-heading"><div><p class="dr-eyebrow">CHANNEL MIX / 2569</p><h2>${channel==='all'?'สัดส่วนยอดขาย':'สัดส่วนจากยอดรวมทุกช่องทาง'}</h2></div><span class="dr-tag">4 ช่องทาง</span></div>${donutMarkup(allOverview,channel==='all'?null:channel)}</section></div>
   </div>
   <section class="dr-panel dr-monthly"><div class="dr-panel-heading"><div><p class="dr-eyebrow">MONTHLY PERFORMANCE</p><h2>ยอดขายรายเดือน · ${label}</h2></div><span class="dr-tag">หน่วย: บาท</span></div><div class="dr-table-scroll"><table class="dr-table"><thead><tr><th scope="col">เดือน</th>${o.reports.map(r=>r.group).map((g,i)=>`<th scope="col"><i class="dr-table-dot" style="background:${colors[groups.findIndex(x=>x.id===g.id)]}"></i>${g.name}<small>2569</small></th>`).join('')}<th scope="col">รวม 2569</th><th scope="col">รวม 2568</th><th scope="col">YoY</th></tr></thead><tbody>${o.monthly.map(m=>`<tr class="${m.month>=o.scope.firstMonth&&m.month<=o.scope.endMonth?'in-range':''} ${period===String(m.month)?'selected':''}"><th scope="row"><button type="button" data-month="${m.month}">${months[m.month-1]}${m.partial?'*':''}</button>${m.partial?`<small>1–${o.scope.latest.day} ${months[m.month-1]}</small>`:''}</th>${m.byGroup.map(g=>`<td>${money(g.current.amount)}</td>`).join('')}<td class="dr-current">${money(m.current.amount)}</td><td>${money(m.previous.amount)}${!m.previous.complete?'<small>ข้อมูลไม่ครบ</small>':''}</td><td><span class="dr-change ${direction(m.growth)}">${percent(m.growth)}</span></td></tr>`).join('')}</tbody></table></div><p class="dr-footnote">${months[o.scope.latest.month-1]} เทียบวันที่ 1–${o.scope.latest.day} ทั้งสองปี · — หมายถึงไม่มีข้อมูลหรือข้อมูลยังไม่พอสำหรับเทียบ · เดือนที่ไฮไลต์คือช่วงรายงานที่เลือก</p></section>
   <section id="dr-details" class="dr-panel dr-details"><div class="dr-panel-heading"><div><p class="dr-eyebrow">CHANNEL EXPLORER</p><h2>เจาะลึกช่องทางและสาขา</h2><p class="dr-detail-range">${range} · ${label}</p></div><div class="dr-detail-controls"><label class="dr-search">${icon('search')}<span class="dr-sr">ค้นหาสาขาหรือช่องทาง</span><input id="dr-search" type="search" placeholder="ค้นหาสาขาหรือช่องทาง" value="${esc(search)}"></label><label><span class="dr-sr">เรียงลำดับช่องทางย่อย</span><select id="dr-sort"><option value="sales" ${sort==='sales'?'selected':''}>ยอดขายสูงสุด</option><option value="growth" ${sort==='growth'?'selected':''}>เติบโตสูงสุด</option><option value="name" ${sort==='name'?'selected':''}>ชื่อช่องทาง</option></select></label></div></div><div class="dr-table-scroll" data-detail-body></div><p class="dr-footnote">กด + เพื่อขยายรายละเอียด · เปอร์เซ็นต์แสดงเมื่อข้อมูลครบในช่วงเดียวกัน · สาขาที่ไม่มีตัวเลขทุกวันจะยังไม่คำนวณ YoY</p></section>
   <details class="dr-method" id="dr-method"><summary><span>ที่มาข้อมูลและวิธีคำนวณ</span><span>DATA NOTES +</span></summary><div class="dr-method-content"><div><h3>ข้อมูลที่ใช้</h3><p>ปี 2569: ชีต Daily report ของ Work Load VING 2569</p><p>ปี 2568: ไฟล์ salse 2025.xlsx · Sheet1 ที่คุณส่งให้</p><p>รวมเฉพาะ Stand Alone, EVENT, EVENT นอก และ Department Stores ตามกลุ่มในคอลัมน์ C ไม่รวม Online, Offline Owner หรือ Premium Outlet และไม่รวมแถวสรุปซ้ำ</p><button type="button" class="dr-button" data-open-sources>ดูแหล่งที่มา ↗</button></div><div><h3>อ่านตัวเลขอย่างไร</h3><p>ยอดล่าสุดรวมตัวเลขรายวันก่อนหักคืนเงินทุกวันที่บันทึกแล้ว แต่ละช่องทางอาจบันทึกถึงคนละวัน กราฟและตารางใช้กรอบวันที่ถึง ${o.scope.latest.day} ${months[o.scope.latest.month-1]} ส่วนการ์ด YOY แยกเทียบช่วงร่วมกันถึง ${q.scope.endDay} ${months[q.scope.endMonth-1]} ทั้งสองปี</p><p>ช่องว่างและขีดไม่แทนด้วยศูนย์ หากวันใดไม่มีตัวเลขทุกแถวของกลุ่ม จะไม่คำนวณผลต่างและ YoY ของกลุ่มนั้น ยอดรวมยังเป็นยอดที่บันทึกได้ ไม่ใช่การยืนยันยอดปิดบัญชี</p><p>ปี 2568 ไม่มีแถว EVENT เดือน ม.ค. และ EVENT นอก เดือน ก.พ. มีช่องว่าง ช่วงสะสมที่เลือกเทียบได้จึงเริ่มจาก ${months[o.scope.matchedFirst-1]}–${o.scope.latest.day} ${months[o.scope.latest.month-1]} เลือกสะสมตั้งแต่ต้นปีได้จากตัวเลือกด้านบน</p><p>รวมชื่อ Thaphra : VING+ เข้ากับ Thaphra : VING ตามตำแหน่งช่องทาง ส่วน Ngamwongwan ที่ไม่มีแบรนด์กำกับแสดงแยกไว้ ชื่อผู้รับผิดชอบไม่แสดงในรายงาน</p></div></div><p class="dr-footnote" data-comparison-freshness>${comparisonFreshness()}</p></details>
   <footer class="dr-footer"><strong>VING<span> DAILY REPORT</span></strong><span>4 ช่องทาง · ตัวเลขจากต้นทาง · 2569 / 2568</span></footer><div class="dr-sr" aria-live="polite">รายงาน ${range} ${label} ยอดรวม 2569 ${money(o.current.amount)} บาท</div>
  </div>`;
  refreshDetails();refreshChart();
  for(const table of app.querySelectorAll('.dr-table-scroll')){table.tabIndex=0;table.setAttribute('role','region');table.setAttribute('aria-label','ตารางรายงาน เลื่อนแนวนอนเพื่อดูทุกคอลัมน์');const hint=document.createElement('p');hint.className='dr-scroll-hint';hint.textContent='เลื่อนตารางซ้าย–ขวาเพื่อดูทุกคอลัมน์ ↔';table.before(hint);}
  const banner=document.querySelector('.readonly-banner');if(banner)banner.textContent=comparisonFreshness();
  for(const b of app.querySelectorAll('[data-mix]')){b.addEventListener('pointerenter',()=>app.querySelectorAll('.dr-ring').forEach(r=>r.classList.toggle('dim',r.dataset.ring!==b.dataset.mix)));b.addEventListener('pointerleave',()=>app.querySelectorAll('.dr-ring').forEach(r=>r.classList.remove('dim')));}
 }
 app.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.channel){selectChannel(channel===b.dataset.channel?'all':b.dataset.channel,`.dr-channel[data-channel="${b.dataset.channel}"]`);return;}
  if(b.hasAttribute('data-all')){selectChannel('all','[data-all]');return;}
  if(b.hasAttribute('data-capture')){setCapture(!captureMode);return;}
  if(captureMode&&(b.dataset.drill||b.hasAttribute('data-method')))setCapture(false,false);
  if(b.dataset.month){selectPeriod(b.dataset.month,`.dr-months [data-month="${b.dataset.month}"]`);return;}
  if(b.dataset.chartMonth){selectPeriod(b.dataset.chartMonth,`.dr-months [data-month="${b.dataset.chartMonth}"]`);return;}
  if(b.dataset.mode){mode=b.dataset.mode;refreshChart();return;}
  if(b.dataset.type){type=b.dataset.type;refreshChart();return;}
  if(b.dataset.expand){const id=b.dataset.expand;expanded.has(id)?expanded.delete(id):expanded.add(id);refreshDetails();app.querySelector(`[data-expand="${id}"]`).focus({preventScroll:true});return;}
  if(b.dataset.drill){const id=b.dataset.drill;search='';app.querySelector('#dr-search').value='';expanded.add(id);refreshDetails();app.querySelector(`#detail-${id}`).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});app.querySelector(`[data-expand="${id}"]`).focus({preventScroll:true});return;}
  if(b.hasAttribute('data-method')){const d=app.querySelector('#dr-method');d.open=true;d.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});return;}
  if(b.hasAttribute('data-export')){const blob=new Blob([overviewCsv(overview)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`VING-Daily-2569-vs-2568-${channel}-${period}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
  if(b.hasAttribute('data-print'))window.print();
 });
 app.addEventListener('change',e=>{if(e.target.id==='dr-period')selectPeriod(e.target.value,'#dr-period');if(e.target.id==='dr-sort'){sort=e.target.value;refreshDetails();}});
 app.addEventListener('input',e=>{if(e.target.id==='dr-search'){search=e.target.value;refreshDetails();}});
 refreshView=()=>{if(document.body.dataset.captureBusy||document.body.dataset.captureSelecting||captureMode)return false;const y=scrollY,active=document.activeElement,id=active?.id,start=active?.selectionStart,end=active?.selectionEnd;paint();window.scrollTo({top:y,behavior:'instant'});if(id){const el=document.getElementById(id);el?.focus({preventScroll:true});if(el?.setSelectionRange&&start!=null)el.setSelectionRange(start,end);}};
 paint();
}
