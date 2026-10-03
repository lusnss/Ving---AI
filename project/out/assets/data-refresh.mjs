// Freshness is scoped to successfully imported sources. Historical pages and
// unrelated tabs must not be invalidated by a selected refresh.
const markerKey='ving-data-refresh-sources';
let markers={};
function readMarkers(value){try{const data=JSON.parse(value||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
try{localStorage.removeItem('ving-data-refresh-after');markers=readMarkers(localStorage.getItem(markerKey));}catch{}
const currentMonth=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,7);
function sourceKey(url){
 const part=url.searchParams.get('part');
 if(['/api/stock-forecast','/api/stock-report'].includes(url.pathname)){
  if(part==='history')return url.searchParams.get('month')===currentMonth()?url.pathname+':history:'+currentMonth():null;
  return url.pathname+':'+(part||'manifest');
 }
 return url.pathname==='/api/warehouse'?url.pathname+':'+(url.searchParams.get('section')||'overview'):url.pathname;
}
const paths={comparison:'/api/daily-comparison',pnl:'/api/profit-loss',costs:'/api/product-costs',proposals:'/api/event-proposals',predict:'/api/event-predict',schedule:'/api/events/schedule',catalog:'/api/events/catalog',contracts:'/api/contracts',rebrand:'/api/rebrand','branch-stock':'/api/branch-stock',forecast:'/api/stock-forecast:manifest','stock-report':'/api/stock-report:manifest'};
function markSource(id,at){
 const key=paths[id]||(id.startsWith('warehouse:')?'/api/warehouse:'+id.slice(10):id.startsWith('balances:')?'/api/stock-forecast:stock':id.startsWith('history:')?'/api/stock-report:history:'+id.split(':')[1]:null);
 if(key)markers[key]=Math.max(Number(markers[key])||0,at);
}
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init={})=>{
 const url=new URL(input instanceof Request?input.url:input,location.href),method=String(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 const after=Number(markers[sourceKey(url)]);
 if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&(method==='GET'||url.pathname==='/api/data-refresh')&&Object.keys(markers).length){
  const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
  headers.set('x-ving-refresh-sources',JSON.stringify(markers));
  if(method==='GET'&&after>0&&after<=Date.now())headers.set('x-ving-refresh-after',String(after));
  return originalFetch(input,{...init,headers,cache:'no-store'});
 }
 return originalFetch(input,init);
};
window.addEventListener('storage',event=>{if(event.key===markerKey)markers=readMarkers(event.newValue);});
export function installDataRefresh({onComplete,toast}){
 const menu=document.querySelector('#capture-settings-menu');if(!menu)return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/data-refresh.css';document.head.append(link);
 const button=document.createElement('button');button.type='button';button.textContent='อัพเดทข้อมูล';button.dataset.refreshAll='';button.dataset.refreshControl='';menu.prepend(button);
 const panel=document.createElement('dialog');panel.className='data-refresh-dialog';panel.setAttribute('aria-labelledby','data-refresh-title');
 panel.innerHTML='<div class="data-refresh-head"><div><h2 id="data-refresh-title">อัปเดตข้อมูลจากแท็บ</h2><p data-refresh-period>อัปเดตเฉพาะเดือนปัจจุบัน</p></div><button type="button" data-refresh-close data-refresh-control aria-label="ปิด">×</button></div><div class="data-refresh-selection" hidden><label><input type="checkbox" data-refresh-all data-refresh-control> เลือกทั้งหมด</label><span data-refresh-count></span></div><p data-refresh-status role="status" aria-live="polite"></p><progress max="1" value="0" aria-label="ความคืบหน้า" hidden></progress><ul class="data-refresh-results"></ul><div class="data-refresh-footer"><p data-refresh-note></p><div class="data-refresh-actions"><button type="button" data-refresh-change data-refresh-control hidden>เปลี่ยนรายการ</button><button type="button" data-refresh-retry data-refresh-control hidden>ลองใหม่เฉพาะที่ไม่สำเร็จ</button><button type="button" data-refresh-start data-refresh-control disabled>อัปเดตที่เลือก</button></div></div>';
 document.body.append(panel);
 const list=panel.querySelector('ul'),status=panel.querySelector('[data-refresh-status]'),progress=panel.querySelector('progress'),note=panel.querySelector('[data-refresh-note]'),retry=panel.querySelector('[data-refresh-retry]'),startButton=panel.querySelector('[data-refresh-start]'),change=panel.querySelector('[data-refresh-change]'),selection=panel.querySelector('.data-refresh-selection'),all=panel.querySelector('[data-refresh-all]'),count=panel.querySelector('[data-refresh-count]');
 let running=false,loading=false,picking=false,results=[],queued=new Set(),total=0,finished=0,runError=false,plan=null,selected=new Set();
 panel.querySelector('[data-refresh-close]').onclick=()=>panel.close();
 panel.addEventListener('close',()=>button.focus());
 window.addEventListener('beforeunload',e=>{if(running){e.preventDefault();e.returnValue='';}});
 const tasks=()=>[...(plan?.tasks||[]),...(plan?.finalTasks||[])];
 function paint(){
  status.textContent=running?'กำลังอัปเดต '+finished+' / '+total+' รายการ':runError?'ยังอัปเดตไม่สำเร็จ':results.some(r=>!['success','skipped'].includes(r.status))?'อัปเดตเสร็จ · มีแหล่งที่ต้องตรวจสอบ':results.some(r=>r.status==='skipped')?'อัปเดตเสร็จ · ข้ามรายการที่ไม่ใช่เดือนปัจจุบัน':'อัปเดตข้อมูลที่เลือกครบแล้ว';
  progress.max=Math.max(total,1);progress.value=finished;
  button.textContent=running?'กำลังอัปเดต '+finished+'/'+total:'อัพเดทข้อมูล';button.setAttribute('aria-busy',String(running));
 }
 function paintSelection(){
  const size=tasks().length;
  all.checked=size>0&&selected.size===size;all.indeterminate=selected.size>0&&selected.size<size;
  count.textContent='เลือก '+selected.size+' / '+size+' รายการ';
  startButton.disabled=selected.size===0;startButton.textContent='อัปเดตที่เลือก ('+selected.size+')';
  status.textContent=selected.size?'เลือกรายการแล้วกดอัปเดตครั้งเดียว':'กรุณาเลือกอย่างน้อย 1 รายการ';
 }
 function choose(){
  picking=true;runError=false;selection.hidden=false;progress.hidden=true;retry.hidden=true;change.hidden=true;startButton.hidden=false;list.replaceChildren();
  panel.querySelector('[data-refresh-period]').textContent='เดือนปัจจุบัน · '+plan.currentMonth+' (เวลาไทย)';
  note.textContent='ข้อมูลรายเดือนอัปเดตเฉพาะเดือนปัจจุบัน เก็บข้อมูลเดือนก่อนหน้าไว้ตามเดิม';
  for(const task of tasks()){
   const li=document.createElement('li'),label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');
   li.className='data-refresh-option';input.type='checkbox';input.dataset.refreshControl='';input.dataset.refreshSource=task.id;input.checked=selected.has(task.id);name.textContent=task.label;
   input.onchange=()=>{if(input.checked)selected.add(task.id);else selected.delete(task.id);paintSelection();};
   label.append(input,name);li.append(label);list.append(li);
  }
  paintSelection();
 }
 all.onchange=()=>{selected=all.checked?new Set(tasks().map(t=>t.id)):new Set();for(const input of list.querySelectorAll('input'))input.checked=selected.has(input.dataset.refreshSource);paintSelection();};
 async function request(source){
  const response=await fetch('/api/data-refresh',{method:source?'POST':'GET',cache:'no-store',headers:{'content-type':'application/json'},...(source?{body:JSON.stringify({source})}:{}),signal:AbortSignal.timeout(source?.startsWith('gp:')?110000:65000)});
  if(response.status===401)throw Error('กรุณาเข้าสู่ระบบอีกครั้ง');if(!response.ok)throw Error('ยังเชื่อมต่อระบบอัปเดตไม่ได้');return response.json();
 }
 async function loadPlan(){
  const previous=plan,previousSelection=selected;
  plan=await request();
  selected=previous?new Set([...previousSelection].map(id=>id===('history:'+previous.currentMonth+':1')?'history:'+plan.currentMonth+':1':id).filter(id=>tasks().some(t=>t.id===id))):new Set(tasks().map(t=>t.id));
 }
 async function open(){
  menu.hidden=true;document.querySelector('.capture-settings-trigger')?.setAttribute('aria-expanded','false');if(!panel.open)panel.showModal();
  if(running||loading||plan&&!picking)return;
  loading=true;status.textContent='กำลังโหลดรายการที่เลือกได้…';startButton.hidden=true;change.hidden=true;
  try{await loadPlan();choose();}
  catch(error){status.textContent=error.message;change.hidden=false;change.textContent='โหลดรายการอีกครั้ง';}
  finally{loading=false;}
 }
 function row(task){
  const li=document.createElement('li'),name=document.createElement('strong'),detail=document.createElement('span');name.textContent=task.label;detail.textContent='รออัปเดต';li.append(name,detail);list.append(li);return {li,detail};
 }
 async function process(items,concurrency=1){
  const queue=[];
  function add(task){if(queued.has(task.id))return;queued.add(task.id);queue.push({...task,...row(task)});total++;}
  items.forEach(add);paint();
  async function work(){while(queue.length){const task=queue.shift();task.detail.textContent='กำลังดึงข้อมูล…';task.li.dataset.state='running';const requestedAt=Date.now();let result;
   try{result=await request(task.id);}catch(error){result={status:'failed',message:error.message};}
   results.push({...task,...result,requestedAt});finished++;
   task.li.dataset.state=result.status;
   const stamp=result.sourceAt&&Number.isFinite(Date.parse(result.sourceAt))?' · '+new Date(result.sourceAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'';
   task.detail.textContent=(result.message||(result.status==='success'?'อัปเดตแล้ว':'ไม่สำเร็จ'))+stamp;
   (result.nextTasks||[]).forEach(add);paint();
  }}
  await Promise.all(Array.from({length:concurrency},()=>work()));
 }
 async function start(only){
  if(running||loading||!plan||(!only&&!selected.size))return;
   const retained=only?results.filter(r=>!only.some(t=>t.id===r.id)).map(r=>({...r,text:r.detail.textContent})):[];
  running=true;picking=false;runError=false;document.body.dataset.refreshBusy='true';results=[];queued=new Set();total=finished=0;list.replaceChildren();selection.hidden=true;progress.hidden=false;retry.hidden=true;change.hidden=true;startButton.hidden=true;
  note.textContent='เปิดหน้านี้ไว้จนเสร็จ กำลังอัปเดตเฉพาะรายการที่เลือก';
  for(const previous of retained){const view=row(previous);view.li.dataset.state=previous.status;view.detail.textContent=previous.text;results.push({...previous,...view});queued.add(previous.id);total++;finished++;}
  paint();
  try{
   await loadPlan();
   panel.querySelector('[data-refresh-period]').textContent='เดือนปัจจุบัน · '+plan.currentMonth+' (เวลาไทย)';
   const wanted=only||tasks().filter(t=>selected.has(t.id));
   const finalIds=new Set(plan.finalTasks.map(t=>t.id));
   await process(wanted.filter(t=>!finalIds.has(t.id)),3);
   for(const result of results)if(result.status==='success')markSource(result.id,result.requestedAt);
   try{localStorage.setItem(markerKey,JSON.stringify(markers));}catch{}
   // Recompute only the selected reports after their selected sources finish.
   await process(wanted.filter(t=>finalIds.has(t.id)));
   note.textContent='ข้อมูลที่ดึงสำเร็จพร้อมใช้ แหล่งที่ไม่สำเร็จเก็บข้อมูลเดิมไว้';
   await onComplete();
  }catch(error){runError=true;note.textContent=error.message;toast?.(error.message,true);}
  finally{running=false;delete document.body.dataset.refreshBusy;retry.hidden=!results.some(r=>!['success','skipped'].includes(r.status)&&r.retryable!==false);change.hidden=false;change.textContent='เปลี่ยนรายการ';paint();}
 }
 button.onclick=open;startButton.onclick=()=>{if(picking)start();};
 change.onclick=()=>{picking=true;open();};
 retry.onclick=()=>start(results.filter(r=>!['success','skipped'].includes(r.status)&&r.retryable!==false).map(({id,label})=>({id,label})));
}
