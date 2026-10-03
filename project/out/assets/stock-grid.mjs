import {escapeHtml as esc} from './api.mjs';
const grades={normal:'สินค้าปกติ',grade_b_plus:'Grade B+',grade_b:'Grade B'};
const metrics={normal:'สต็อกปกติ',hold:'On-Hold',total:'รวมทั้งหมด'};
// Follow the source dashboard's SKU naming rules, including TORANI and grade suffixes.
export function stockGridIdentity(item){
 const [base,fallbackSize='-']=String(item.sku||'').replace(/^VING-/,'').split('#');
 const parts=base.split('-'),torani=parts[0]==='TORANI'&&parts.length>=3;
 const model=torani?parts.slice(0,2).join(' '):parts[0]||item.model||'ไม่ระบุรุ่น';
 const tokens=model.split('_'),suffix=tokens.at(-1);
 const grade=suffix==='BB'?'grade_b_plus':suffix==='B'?'grade_b':'normal';
 const section=(grade==='normal'?model:tokens.slice(0,-1).join('_')).replaceAll('_',' ');
 const color=(parts.slice(torani?2:1).join('-')||item.color||'ไม่ระบุสี').replaceAll('_',' ');
 return {grade,section,rowName:section+' - '+color,size:String(item.size||fallbackSize||'-')};
}
export function sortStockSizes(sizes){
 const ranks=new Map([['XS',1],['S',2],['M',3],['L',4],['XL',5],['2XL',6],['3XL',7],['FREESIZE',99],['N/A',100],['-',101]]);
 const rank=s=>{const clean=s.toUpperCase().replace(/\s/g,'');const n=Number.parseInt(clean,10);return Number.isNaN(n)?ranks.get(clean)||1000:n;};
 return [...sizes].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b,'th',{numeric:true}));
}
export function buildStockGrid(items,metric='normal',products=[]){
 if(!Object.hasOwn(metrics,metric))metric='normal';
 const catalog=new Map(),groups=new Map();
 for(const item of [...products,...items]){const id=stockGridIdentity(item),key=JSON.stringify([id.grade,id.section]);if(!catalog.has(key))catalog.set(key,new Set());catalog.get(key).add(id.size);}
 for(const item of items){
  const value=item[metric];if(typeof value!=='number'||!Number.isFinite(value)||value===0)continue;
  const id=stockGridIdentity(item);if(!groups.has(id.grade))groups.set(id.grade,new Map());const sections=groups.get(id.grade);
  if(!sections.has(id.section))sections.set(id.section,{section:id.section,rows:new Map(),sizes:sortStockSizes(catalog.get(JSON.stringify([id.grade,id.section]))||[])});
  const section=sections.get(id.section);if(!section.rows.has(id.rowName))section.rows.set(id.rowName,new Map());const cells=section.rows.get(id.rowName);
  cells.set(id.size,(cells.get(id.size)||0)+value);
 }
 return Object.entries(grades).filter(([grade])=>groups.has(grade)).map(([grade,label])=>{
  const sections=[...groups.get(grade).values()].sort((a,b)=>a.section.localeCompare(b.section,'th',{numeric:true})).map(section=>{
   const rows=[...section.rows].sort(([a],[b])=>a.localeCompare(b,'th',{numeric:true})).map(([name,cells])=>({name,cells,total:[...cells.values()].reduce((a,b)=>a+b,0)}));
   const totals=section.sizes.map(size=>rows.reduce((sum,row)=>sum+(row.cells.get(size)||0),0));
   return {...section,rows,totals,total:totals.reduce((a,b)=>a+b,0)};
  });return {grade,label,sections,total:sections.reduce((a,s)=>a+s.total,0)};
 });
}
const number=value=>value.toLocaleString('th-TH');
const queryKey=value=>String(value||'').toLocaleLowerCase().replace(/[\s_-]+/g,'');
export function filterStockItems(items,{query='',grade='all',model=''}={}){
 const q=queryKey(query);return items.filter(item=>{const id=stockGridIdentity(item);return (grade==='all'||id.grade===grade)&&(!model||id.section===model)&&(!q||queryKey(id.section).includes(q));});
}
function sectionHTML(group,section,metric,index,expand='default'){
 const max=Math.max(1,...section.rows.flatMap(row=>[...row.cells.values()]));
 const open=expand==='all'||expand==='default'&&index<3;
 return `<details class="sg-model-card" ${open?'open':''} data-model-card><summary><span class="sg-chevron" aria-hidden="true">›</span><span class="sg-model-title">${esc(section.section)}<small>${esc(group.label)} · ${number(section.rows.length)} สี · ${number(section.sizes.length)} ไซซ์</small></span><span class="sg-model-total">${number(section.total)}<small>${esc(metrics[metric])}</small></span></summary><div class="stock-grid-scroll" tabindex="0" role="region" aria-label="สต็อก ${esc(section.section)} แยกไซซ์"><table class="stock-grid-table" style="min-width:${200+(section.sizes.length+1)*70}px"><thead><tr><th scope="col">สี / ไซซ์</th>${section.sizes.map(size=>`<th scope="col">${esc(size)}</th>`).join('')}<th scope="col">รวม</th></tr></thead><tbody>${section.rows.map(row=>`<tr><th scope="row" title="${esc(row.name)}">${esc(row.name.startsWith(section.section+' - ')?row.name.slice(section.section.length+3):row.name)}</th>${section.sizes.map(size=>{const value=row.cells.get(size)||0;return `<td class="sg-cell ${value===0?'stock-grid-zero':''}" style="--sg-heat:${Math.max(0,value)/max}" title="${esc(row.name)} · ไซซ์ ${esc(size)} · ${esc(metrics[metric])} ${number(value)}">${value===0?'<span aria-label="0">—</span>':number(value)}</td>`;}).join('')}<td class="stock-grid-total">${number(row.total)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">รวม</th>${section.totals.map(value=>`<td>${number(value)}</td>`).join('')}<td>${number(section.total)}</td></tr></tfoot></table></div></details>`;
}
export function stockGridHTML(items,metric='normal',products=[],options={}){
 const groups=buildStockGrid(items,metric,products);
 const sections=groups.flatMap(group=>group.sections.map(section=>({group,section})));
 if(options.sort==='quantity')sections.sort((a,b)=>b.section.total-a.section.total||a.section.section.localeCompare(b.section.section,'th'));
 if(!sections.length)return '<div class="stock-grid-empty"><strong>ไม่พบสต็อกตามตัวกรอง</strong><p>ลองเปลี่ยนรุ่น เกรด หรือประเภทจำนวนสต็อก</p></div>';
 return sections.map(({group,section},index)=>sectionHTML(group,section,metric,index,options.expand)).join('');
}
export function mountStockGrid(container,items,products=[],initialMetric='normal',onMetric=()=>{},context={},preferences={}){
 let exporting=false;
 const state=Object.assign(preferences,{metric:Object.hasOwn(metrics,initialMetric)?initialMetric:'normal',query:preferences.query||'',grade:preferences.grade||'all',model:preferences.model||'',sort:preferences.sort||'quantity',heat:preferences.heat!==false,compact:preferences.compact!==false,expand:preferences.expand||'default',exportFormat:preferences.exportFormat==='promotion'?'promotion':'table'});
 if(!document.querySelector('link[data-stock-explorer-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/stock-explorer.css';css.dataset.stockExplorerStyle='';document.head.append(css);}
 container.classList.add('sg-workspace');
 container.innerHTML=`<div class="stock-grid-heading"><div><span class="sg-eyebrow">STOCK EXPLORER</span><h2>สต็อกแยกรุ่น / สี / ไซซ์</h2><p>เลือกรุ่นเพื่อเทียบจำนวนแต่ละสีและไซซ์</p></div><div class="sg-export-controls"><label>รูปแบบ Excel<select data-stock-grid-export-format><option value="table" ${state.exportFormat==='table'?'selected':''}>แบบตารางเดิม</option><option value="promotion" ${state.exportFormat==='promotion'?'selected':''}>แบบคิดโปรโมชั่น</option></select></label><button type="button" class="sg-export" data-stock-grid-export>ดาวน์โหลด Excel <span aria-hidden="true">↓</span></button></div></div><div class="sg-toolbar"><div class="stock-grid-modes" role="group" aria-label="ประเภทจำนวนสต็อก">${Object.entries(metrics).map(([key,label])=>`<button type="button" data-stock-grid-metric="${key}" aria-pressed="${state.metric===key}">${label}</button>`).join('')}</div><div class="sg-view-controls"><button type="button" data-stock-grid-heat aria-pressed="${state.heat}">ไฮไลต์จำนวน</button><button type="button" data-stock-grid-compact aria-pressed="${state.compact}">มุมมองกระชับ</button></div></div><div class="sg-layout"><aside class="sg-sidebar" aria-label="เลือกรุ่นสินค้า"><label class="sg-search-label" for="stock-model-search">ค้นหารุ่น</label><div class="sg-search-wrap"><span aria-hidden="true">⌕</span><input id="stock-model-search" type="search" value="${esc(state.query)}" placeholder="เช่น Vari, Torani, Jarix" autocomplete="off"><button type="button" data-stock-grid-clear aria-label="ล้างคำค้นหารุ่น">×</button></div><label class="sg-grade-label">เกรดสินค้า<select data-stock-grid-grade><option value="all">ทุกเกรด</option>${Object.entries(grades).map(([key,label])=>`<option value="${key}" ${state.grade===key?'selected':''}>${label}</option>`).join('')}</select></label><div class="sg-model-nav" role="group" aria-label="รายการรุ่น"></div></aside><div class="sg-main"><div class="sg-results-bar"><div><strong data-stock-grid-count></strong><span data-stock-grid-scope></span></div><label>เรียงตาม<select data-stock-grid-sort><option value="quantity" ${state.sort==='quantity'?'selected':''}>จำนวนมาก → น้อย</option><option value="name" ${state.sort==='name'?'selected':''}>ชื่อรุ่น A–Z</option></select></label></div><div class="sg-secondary-bar"><p class="sg-legend">สีเข้มขึ้น = จำนวนมากขึ้นในรุ่นนั้น <span>— = 0</span></p><div><button type="button" data-stock-grid-expand>ขยายทั้งหมด</button><button type="button" data-stock-grid-collapse>ย่อทั้งหมด</button></div></div><div class="stock-grid-content"></div></div></div><p class="sg-export-status" role="status" aria-live="polite"></p>`;
 const content=container.querySelector('.stock-grid-content'),nav=container.querySelector('.sg-model-nav'),search=container.querySelector('#stock-model-search'),exportButton=container.querySelector('[data-stock-grid-export]'),exportFormat=container.querySelector('[data-stock-grid-export-format]');
 const filtered=()=>filterStockItems(items,state);
 function draw(){
  const base=filterStockItems(items,{query:state.query,grade:state.grade});
  const models=new Map();for(const g of buildStockGrid(base,state.metric,products))for(const s of g.sections)models.set(s.section,(models.get(s.section)||0)+s.total);
  if(state.model&&!models.has(state.model))state.model='';
  nav.innerHTML=`<button type="button" data-stock-grid-model="" aria-pressed="${!state.model}"><span>ทุกรุ่น</span><b>${number(models.size)}</b></button>`+[...models].sort(([a],[b])=>a.localeCompare(b,'th',{numeric:true})).map(([model,total])=>`<button type="button" data-stock-grid-model="${esc(model)}" aria-pressed="${state.model===model}"><span>${esc(model)}</span><b>${number(total)}</b></button>`).join('');
  const rows=filtered(),groups=buildStockGrid(rows,state.metric,products),modelCount=new Set(groups.flatMap(g=>g.sections.map(s=>s.section))).size,total=groups.reduce((a,g)=>a+g.total,0);
  container.querySelector('[data-stock-grid-count]').textContent=`${number(modelCount)} รุ่น · ${number(total)} ${metrics[state.metric]}`;
  container.querySelector('[data-stock-grid-scope]').textContent=(context.branch||'รวมทุกสาขา')+(state.model?' · '+state.model:'');
  container.dataset.heat=String(state.heat);container.dataset.compact=String(state.compact);
  context.onFilter?.(rows,state);
  content.innerHTML=stockGridHTML(rows,state.metric,products,state);exportButton.disabled=exporting||!canExport();
  container.querySelector('[data-stock-grid-clear]').hidden=!state.query;
  container.querySelectorAll('[data-stock-grid-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stockGridMetric===state.metric)));
  container.querySelector('[data-stock-grid-heat]').setAttribute('aria-pressed',String(state.heat));container.querySelector('[data-stock-grid-compact]').setAttribute('aria-pressed',String(state.compact));
 }
 search.addEventListener('input',()=>{state.query=search.value;state.model='';draw();});
 container.querySelector('[data-stock-grid-clear]').addEventListener('click',()=>{state.query='';state.model='';search.value='';draw();search.focus();});
 nav.addEventListener('click',event=>{const button=event.target.closest('[data-stock-grid-model]');if(!button)return;state.model=button.dataset.stockGridModel;state.expand='default';draw();nav.querySelector(`[data-stock-grid-model="${CSS.escape(state.model)}"]`)?.focus({preventScroll:true});content.scrollTop=0;});
 container.querySelector('[data-stock-grid-grade]').addEventListener('change',event=>{state.grade=event.target.value;state.model='';draw();});
 container.querySelector('[data-stock-grid-sort]').addEventListener('change',event=>{state.sort=event.target.value;draw();});
 container.querySelectorAll('[data-stock-grid-metric]').forEach(button=>button.addEventListener('click',()=>{state.metric=button.dataset.stockGridMetric;onMetric(state.metric);draw();}));
 for(const name of ['heat','compact'])container.querySelector('[data-stock-grid-'+name+']').addEventListener('click',()=>{state[name]=!state[name];container.dataset[name]=String(state[name]);container.querySelector('[data-stock-grid-'+name+']').setAttribute('aria-pressed',String(state[name]));});
 for(const [control,value] of [['expand','all'],['collapse','none']])container.querySelector('[data-stock-grid-'+control+']').addEventListener('click',()=>{state.expand=value;content.querySelectorAll('details').forEach(d=>{d.open=value==='all';});});
 function canExport(){return state.exportFormat==='promotion'?buildStockGrid(filtered(),state.metric,products).length>0:filtered().length>0;}
 exportFormat.addEventListener('change',()=>{state.exportFormat=exportFormat.value;exportButton.disabled=exporting||!canExport();container.querySelector('.sg-export-status').textContent='';});
 exportButton.addEventListener('click',async()=>{
  if(exporting||!canExport())return;
  const status=container.querySelector('.sg-export-status'),rows=filtered(),options={...state,...context},format=state.exportFormat;
  exporting=true;exportButton.disabled=true;exportFormat.disabled=true;status.textContent='กำลังสร้างไฟล์ Excel…';
  try{
   if(format==='promotion'){
    status.textContent='กำลังอ่านต้นทุน ราคา และประวัติขายสำหรับคิดโปรโมชั่น…';
    const {downloadStockPromotionExcel}=await import('./stock-promotion-excel.mjs');
    const response=await fetch('/api/stock-summary?includeSales=1',{cache:'no-store',signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('Promotion reference unavailable');
    const reference=await response.json();
    if(!Array.isArray(reference.models)||!Array.isArray(reference.grades)||!reference.sources)throw Error('Invalid promotion reference');
    if(!container.isConnected)return;
    downloadStockPromotionExcel(rows,products,reference,options);
    status.textContent='ดาวน์โหลดแบบคิดโปรโมชั่นแล้ว · สรุปเฉพาะรุ่น พร้อมสูตรส่วนลดและกำไร';
   }else{
    const {downloadStockExcel}=await import('./stock-excel.mjs');
    if(!container.isConnected)return;
    downloadStockExcel(rows,products,options);status.textContent='ดาวน์โหลดแบบตารางเดิมแล้ว · สรุป, ตารางไซซ์แยกรุ่น และรายการ SKU';
   }
  }catch{status.textContent='ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง';}
  finally{exporting=false;exportFormat.disabled=false;exportButton.disabled=!canExport();}
 });
 draw();
}
