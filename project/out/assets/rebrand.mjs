import {escapeHtml as e} from './api.mjs';
const sourceUrl='https://docs.google.com/spreadsheets/d/1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4/edit?gid=268411880#gid=268411880';
const nf=new Intl.NumberFormat('th-TH',{maximumFractionDigits:2});
const stages=[['vm','VM ออกแบบ'],['contractor','ประสานผู้รับเหมา'],['marketing','การตลาดสื่อสาร']];
const statusNames={active:'กำลังดำเนินการ',done:'เสร็จแล้ว',waiting:'ยังไม่เริ่ม',missing:'ยังไม่ระบุ',other:'สถานะอื่น'};
export function statusKind(value){
 const text=String(value||'').trim();if(!text)return 'missing';
 if(['เสร็จแล้ว','เสร็จสิ้น','เสร็จ','ดำเนินการแล้ว','รีโนเวทเสร็จแล้ว','completed','done'].includes(text.toLowerCase()))return 'done';
 if(['กำลังก่อสร้าง','กำลังดำเนินการ','อยู่ระหว่างดำเนินการ','กำลังรีโนเวท','in progress'].includes(text.toLowerCase()))return 'active';
 if(['ยังไม่เริ่ม','รอดำเนินการ','not started'].includes(text.toLowerCase()))return 'waiting';return 'other';
}
export function budgetNumber(value){const text=String(value??'').trim().replaceAll(',','');return /^\d+(\.\d+)?$/.test(text)&&Number.isFinite(Number(text))?Number(text):null;}
export function parseRebrandDate(value){
 const match=String(value||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!match)return null;
 const [,d,m,y]=match.map(Number),year=y>2400?y-543:y,date=new Date(Date.UTC(year,m-1,d));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date:null;
}
function dateText(value){const date=parseRebrandDate(value);return date?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(date):value||'—';}
export function summarizeRebrand(items){
 const budgets=items.map(row=>budgetNumber(row.budget)).filter(value=>value!==null);
 const counts=Object.fromEntries(Object.keys(statusNames).map(key=>[key,items.filter(row=>statusKind(row.status)===key).length]));
 return {total:items.length,...counts,budget:budgets.length?budgets.reduce((a,b)=>a+b,0):null,budgetCount:budgets.length,channels:[...new Set(items.map(row=>row.channel||'ยังไม่ระบุ'))].map(label=>({label,count:items.filter(row=>(row.channel||'ยังไม่ระบุ')===label).length})),stages:stages.map(([key,label])=>({key,label,...Object.fromEntries(Object.keys(statusNames).map(kind=>[kind,items.filter(row=>statusKind(row[key])===kind).length]))}))};
}
export function filterRebrand(items,{query='',channel='',status=''}={}){return items.filter(row=>(!channel||row.channel===channel)&&(!status||statusKind(row.status)===status)&&(!query||`${row.branch} ${row.channel}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));}
export function rebrandFreshness(data){
 const source=data.source||{},time=source.fetched_at?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(source.fetched_at)):null;
 return (source.status==='online'?'Google Sheets · ตรวจข้อมูลทุก 15 วินาที':source.status==='stale'?'เชื่อมต้นทางไม่ได้ · แสดงข้อมูลที่ดึงสำเร็จล่าสุด':'ยังเชื่อมต่อชีตไม่ได้ · กำลังลองใหม่อัตโนมัติ')+(time?' · ดึงล่าสุด '+time:'');
}
const icon=(name)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{branches:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2m-6 6v4m4-4v4"/>',active:'<path d="m14 4 6 6M4 20l5-1L20 8l-4-4L5 15l-1 5Z"/>',done:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',budget:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18m-6 5h3M7 5V3h11"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>'}[name]}</svg>`;
function badge(value){const kind=statusKind(value);return `<span class="rb-status ${kind}"><i aria-hidden="true"></i>${e(value||'ยังไม่ระบุ')}</span>`;}
function dashboard(data){
 const items=data.items||[],s=summarizeRebrand(items),available=data.source?.status!=='unavailable',val=n=>available?nf.format(n):'—';
 const stats=[['branches','สาขาในแผน',val(s.total),'สาขา',s.channels.map(c=>`${e(c.label)} ${c.count}`).join(' · ')],['active','กำลังดำเนินการ',val(s.active),'สาขา',`ยังไม่ระบุสถานะ ${val(s.missing)} สาขา`],['done','รีโนเวทเสร็จแล้ว',val(s.done),'สาขา','นับจากสถานะที่ระบุในชีต'],['budget','งบประมาณที่บันทึก',s.budget===null?'—':nf.format(s.budget),'บาท',`มีข้อมูลงบ ${val(s.budgetCount)} / ${val(s.total)} สาขา`]];
 const scheduled=items.filter(row=>parseRebrandDate(row.end)&&statusKind(row.status)!=='done').sort((a,b)=>parseRebrandDate(a.end)-parseRebrandDate(b.end));
 const focus=scheduled[0];
 return `<div class="rb-kpis">${stats.map(([key,label,value,unit,note])=>`<article class="rb-kpi ${key==='budget'?'rb-budget':''}"><div class="rb-kpi-label"><span>${label}</span><span class="rb-icon">${icon(key)}</span></div><div class="rb-value">${value}<small>${unit}</small></div><p>${note}</p></article>`).join('')}</div>
 <div class="rb-insights"><section class="rb-panel rb-workstreams"><header><div><p class="rb-overline">WORKSTREAMS</p><h2>ความคืบหน้าแต่ละทีม</h2></div><span class="rb-caption">ทุกสาขาในแผน</span></header><div class="rb-stage-grid">${s.stages.map((stage,i)=>`<article><div class="rb-stage-title"><span>0${i+1}</span><h3>${stage.label}</h3></div><p class="rb-stage-count"><strong>${val(stage.done)}</strong><span> / ${val(s.total)} สาขาเสร็จแล้ว</span></p><div class="rb-meter" role="img" aria-label="${e(stage.label)}: เสร็จแล้ว ${stage.done} กำลังดำเนินการ ${stage.active} ยังไม่เริ่ม ${stage.waiting} ยังไม่ระบุ ${stage.missing} สถานะอื่น ${stage.other}">${['done','active','waiting','other','missing'].map(kind=>`<span class="${kind}" style="width:${s.total?stage[kind]/s.total*100:0}%"></span>`).join('')}</div><p class="rb-stage-note">กำลังทำ ${val(stage.active)} · ยังไม่เริ่ม ${val(stage.waiting)}<br>ยังไม่ระบุ ${val(stage.missing)}${stage.other?` · สถานะอื่น ${stage.other}`:''}</p></article>`).join('')}</div></section>
 <section class="rb-panel rb-milestone"><p class="rb-overline">RENOVATION FOCUS</p><div class="rb-focus-title"><h2>${focus?e(focus.branch):available?'รอระบุแผนรีโนเวท':'รอเชื่อมต่อข้อมูล'}</h2>${focus?badge(focus.status):''}</div>${focus?`<div class="rb-dates"><div><small>เริ่มรีโนเวท</small><strong>${e(dateText(focus.start))}</strong></div><span>${icon('arrow')}</span><div><small>แผนเสร็จ</small><strong>${e(dateText(focus.end))}</strong></div></div><p class="rb-focus-note">กำหนดเสร็จเร็วที่สุดในสาขาที่ยังไม่ระบุว่าเสร็จแล้ว</p>`:'<p class="rb-focus-note">เมื่อชีตระบุวันสิ้นสุด จะแสดงกำหนดการที่นี่</p>'}</section></div>
 ${available&&s.total&&s.budgetCount<s.total?`<p class="rb-data-note"><span aria-hidden="true">ⓘ</span> รอข้อมูลงบประมาณอีก <strong>${s.total-s.budgetCount} สาขา</strong> · ยอดรวมข้างต้นรวมเฉพาะตัวเลขที่บันทึก ไม่ใช่งบรวมครบทั้งโครงการ</p>`:''}`;
}
function table(data,filters){
 const items=filterRebrand(data.items||[],filters);
 return `<table class="rb-table"><thead><tr><th scope="col">สาขา / รูปแบบขาย</th><th scope="col">สถานะรีโนเวท</th><th scope="col" class="rb-num">งบประมาณ (บาท)</th><th scope="col">เริ่มรีโนเวท</th><th scope="col">แผนเสร็จ</th><th scope="col">VM ออกแบบ</th><th scope="col">ประสานผู้รับเหมา</th><th scope="col">การตลาดสื่อสาร</th></tr></thead><tbody>${items.map((row,i)=>`<tr><th scope="row"><div class="rb-branch"><span class="rb-row-no">${String(i+1).padStart(2,'0')}</span><div><strong>${e(row.branch)}</strong><small>${e(row.channel||'ยังไม่ระบุ')}</small></div></div></th><td>${badge(row.status)}</td><td class="rb-num">${budgetNumber(row.budget)===null?`<span class="rb-muted">${e(row.budget||'—')}</span>`:nf.format(budgetNumber(row.budget))}</td><td class="rb-date">${e(dateText(row.start))}</td><td class="rb-date">${e(dateText(row.end))}</td>${stages.map(([key])=>`<td>${badge(row[key])}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="8" class="rb-empty">${data.source?.status==='unavailable'?'ยังโหลดข้อมูลไม่ได้ กำลังรอเชื่อมต่อชีต':(data.items||[]).length?'ไม่พบสาขาที่ตรงกับตัวกรอง':'ยังไม่มีรายการสาขาในชีต'}</td></tr>`}</tbody></table>`;
}
function channelOptions(data,selected){return `<option value="">ทุกรูปแบบขาย</option>${[...new Set((data.items||[]).map(row=>row.channel).filter(Boolean))].map(value=>`<option value="${e(value)}" ${selected===value?'selected':''}>${e(value)}</option>`).join('')}`;}
export function rebrandMarkup(data){
 return `<section class="rb-hero"><div><p class="rb-overline">VING / RETAIL TRANSFORMATION</p><h1>Rebrand<span class="rb-title-dot">.</span></h1><p>ทุกสาขา สู่ประสบการณ์ใหม่ของ VING</p><span class="rb-hero-sub">ติดตามแผนรีโนเวท งบประมาณ และความพร้อมของแต่ละทีม</span></div><div class="rb-hero-side"><span class="rb-year">2026</span><span>BRANCH RENOVATION</span></div></section>
 <div data-rb-dashboard>${dashboard(data)}</div>
 <section class="rb-panel rb-register"><header class="rb-table-heading"><div><p class="rb-overline">BRANCH REGISTER</p><h2>แผนรีโนเวทรายสาขา <span data-rb-count>${(data.items||[]).length}</span></h2></div><span class="rb-connection"><i></i><span data-rb-connection></span></span></header>
 <div class="rb-filters"><label class="rb-search"><span class="rb-sr-only">ค้นหาสาขา</span>${icon('search')}<input type="search" placeholder="ค้นหาชื่อสาขา…" aria-label="ค้นหาสาขา"></label><label><span class="rb-sr-only">รูปแบบขาย</span><select aria-label="รูปแบบขาย" data-rb-channel>${channelOptions(data,'')}</select></label><label><span class="rb-sr-only">สถานะรีโนเวท</span><select aria-label="สถานะรีโนเวท" data-rb-status><option value="">ทุกสถานะรีโนเวท</option>${Object.entries(statusNames).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><button type="button" data-rb-reset>ล้างตัวกรอง</button><p data-rb-results role="status" aria-live="polite"></p></div>
 <div class="rb-scroll" role="region" tabindex="0" aria-label="ตารางแผนรีโนเวท เลื่อนเพื่อดูทุกคอลัมน์">${table(data,{})}</div><footer class="rb-footer"><p>Dashboard สรุปทุกสาขา · ตัวกรองใช้กับตารางเท่านั้น · ช่องว่างในชีตแสดง — หรือ “ยังไม่ระบุ”</p><p class="rb-freshness" role="status">${e(rebrandFreshness(data))}</p></footer></section>`;
}
const states=new WeakMap();
function updateTable(root,state){const scroll=root.querySelector('.rb-scroll'),left=scroll.scrollLeft,top=scroll.scrollTop;scroll.innerHTML=table(state.data,state.filters);scroll.scrollLeft=left;scroll.scrollTop=top;root.querySelector('[data-rb-results]').textContent=`แสดง ${filterRebrand(state.data.items||[],state.filters).length} จาก ${(state.data.items||[]).length} สาขา`;}
export async function render(root,services){
 document.body.classList.add('rebrand-theme');document.title='Rebrand · VING';
 const data=services.rebrand||await services.api('/api/rebrand');let state=states.get(root);
 if(!state){
  state={data,filters:{query:'',channel:'',status:''}};states.set(root,state);root.innerHTML=rebrandMarkup(data);
  root.querySelector('input[type="search"]').addEventListener('input',event=>{state.filters.query=event.target.value;updateTable(root,state);});
  root.querySelector('[data-rb-channel]').addEventListener('change',event=>{state.filters.channel=event.target.value;updateTable(root,state);});
  root.querySelector('[data-rb-status]').addEventListener('change',event=>{state.filters.status=event.target.value;updateTable(root,state);});
  root.querySelector('[data-rb-reset]').addEventListener('click',()=>{state.filters={query:'',channel:'',status:''};root.querySelector('input').value='';root.querySelectorAll('select').forEach(select=>select.value='');updateTable(root,state);});
 }else{
  state.data=data;root.querySelector('[data-rb-dashboard]').innerHTML=dashboard(data);root.querySelector('[data-rb-count]').textContent=(data.items||[]).length;
  const select=root.querySelector('[data-rb-channel]');select.innerHTML=channelOptions(data,state.filters.channel);if(select.value!==state.filters.channel){state.filters.channel='';select.value='';}
 }
 updateTable(root,state);root.querySelector('.rb-freshness').textContent=rebrandFreshness(data);
 const online=data.source?.status==='online',status=root.querySelector('.rb-connection');status.classList.toggle('is-offline',!online);root.querySelector('[data-rb-connection]').textContent=online?'เชื่อมต่อ Google Sheets':data.source?.status==='stale'?'ข้อมูลที่ดึงสำเร็จล่าสุด':'รอเชื่อมต่อข้อมูล';
}
