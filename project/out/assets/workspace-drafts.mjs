// Database-backed drafts, with a device outbox only while a save is pending.
// Never replay submit/click actions or restore approval confirmations.
let singleton;
const clone=value=>JSON.parse(JSON.stringify(value));
const stable=value=>JSON.stringify(value);
const stamp=value=>new Date(value).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
const safeField=node=>!node.closest('[data-draft-view]')&&node.matches('input,select,textarea')&&!node.matches('[type=password],[type=file],[type=hidden],[type=email],[type=tel],[autocomplete=current-password],[autocomplete=new-password]')&&!/password|token|secret|phone|email|confirmed|approve/i.test([node.name,node.id,...Object.keys(node.dataset)].join(' '));
function fieldKey(node){
 const container=node.closest('form,dialog')||document.querySelector('#app');
 if(!container)return null;
 const attrs=el=>[...el.attributes].filter(a=>a.name==='id'||a.name==='name'||a.name.startsWith('data-')&&!/operation|empty|busy|^data-draft-(ui|managed|control)$/.test(a.name)).map(a=>[a.name,a.value]).sort();
 const identity=attrs(node);if(!identity.length)return null;
 const context=attrs(container),heading=container.closest('dialog')?.querySelector('h1,h2,h3')?.textContent||'';
 return stable([context,heading,identity,node.type==='radio'?node.value:'']);
}
export function startDraftProtection(){
 if(singleton)return singleton;
 singleton=createProtection();return singleton;
}
function createProtection(){
 const scope=(location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/')+(new URLSearchParams(location.search).get('edit')?'?edit='+encodeURIComponent(new URLSearchParams(location.search).get('edit')):'');
 let url='/api/workspace-drafts?scope='+encodeURIComponent(scope);const adapters=new Map();
 let activated=false,enabled=['admin','assistant'].includes(document.body.dataset.accessRole),ready=false,revision=null,loaded=null,fields={},last='',pending=null,inflight=null,timer,applying=false,conflict=null,outboxKey='',outboxPrefix='',savedAt=null,loadFailed=false,localDurable=true;
 const bar=document.createElement('aside');bar.className='wd-bar';bar.dataset.draftUi='';bar.hidden=true;
 bar.innerHTML='<span role="status" aria-live="polite"></span><button type="button" data-draft-control data-wd-save>บันทึกอีกครั้ง</button><button type="button" data-draft-control data-wd-history>ประวัติร่าง</button>';
 const style=document.createElement('style');style.textContent='.wd-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 20px;border-bottom:1px solid #77777755;background:#222222;color:#fde412;font:14px/1.5 system-ui}.wd-bar[hidden]{display:none}.wd-bar button,.wd-history button{font:inherit;padding:6px 12px;border:1px solid #fde412;border-radius:6px;background:#282828;color:#fde412;cursor:pointer}.wd-bar span{flex:1}.wd-bar[data-error="true"]{background:#38242a}.wd-history{max-width:620px;width:calc(100% - 40px);max-height:80vh;overflow:auto;background:#222222;color:#fde412;border:1px solid #fde412;border-radius:12px;padding:24px;font:16px/1.5 system-ui}.wd-history::backdrop{background:#00000099}.wd-history li{margin:12px 0}.wd-history button{margin:4px}.wd-history pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:35vh;overflow:auto}.wd-history h2{font-size:20px}';document.head.append(style);
 const anchor=document.querySelector('.access-bar');if(anchor)anchor.after(bar);else document.body.prepend(bar);
 function status(text,error=false){for(const node of document.querySelectorAll('.wd-bar')){node.hidden=!enabled||!error;node.dataset.error=String(error);node.querySelector('[role=status]').textContent=text;node.querySelector('[data-wd-save]').hidden=!error;}}
 function mirrorStatus(){for(const dialog of document.querySelectorAll('dialog[open]:not([data-draft-ui])')){if(dialog.querySelector('[data-wd-mirror]'))continue;const mirror=bar.cloneNode(true);mirror.dataset.wdMirror='';dialog.prepend(mirror);mirror.querySelector('[data-wd-save]').onclick=()=>bar.querySelector('[data-wd-save]').click();mirror.querySelector('[data-wd-history]').onclick=history;}}
 function snapshot(){const data={...(loaded?.payload?.adapters||{})};for(const [name,a]of adapters)data[name]=a.capture();return {version:1,adapters:data,fields};}
 function localDrafts(){try{return Object.keys(localStorage).filter(key=>outboxPrefix&&key.startsWith(outboxPrefix)).map(key=>({key,...JSON.parse(localStorage.getItem(key))})).filter(item=>item.payload?.version===1).sort((a,b)=>(b.localAt||0)-(a.localAt||0));}catch{return [];}}
 function localWrite(){if(!outboxKey||!pending)return;try{localStorage.setItem(outboxKey,stable({...pending,localAt:Date.now()}));localDurable=true;}catch{localDurable=false;status('ยังบันทึกไม่ได้ กรุณาเปิดหน้านี้ไว้แล้วลองอีกครั้ง',true);}}
 function localClear(saveId){try{const value=JSON.parse(localStorage.getItem(outboxKey)||'null');if(value?.saveId===saveId)localStorage.removeItem(outboxKey);}catch{}}
 async function readJSON(target,options={}){const response=await fetch(target,{cache:'no-store',credentials:'same-origin',...options,signal:AbortSignal.timeout(15000)});let data;try{data=await response.json();}catch{data={error:'กรุณาเข้าสู่ระบบอีกครั้งเพื่อบันทึกร่าง'};}if(!response.ok)throw Object.assign(Error(data.error||'ยังเชื่อมต่อฐานข้อมูลร่างไม่ได้'),{status:response.status,data});return data;}
 const initialized=(async()=>{
  try{
   const session=await readJSON('/api/session');enabled=!!session.canEdit;if(!enabled)return;
   url+='&account='+encodeURIComponent(session.userId);
   outboxPrefix='ving-draft-outbox:'+session.userId+':'+scope+':';let tabId;try{tabId=sessionStorage.getItem('ving-draft-tab');if(!tabId){tabId=crypto.randomUUID();sessionStorage.setItem('ving-draft-tab',tabId);}}catch{tabId=crypto.randomUUID();}outboxKey=outboxPrefix+tabId;
   status('กำลังตรวจร่างที่บันทึกไว้…');
   const result=await readJSON(url);loaded=result.draft;revision=loaded?.revision||null;savedAt=loaded?.updatedAt;
   let local;try{local=JSON.parse(localStorage.getItem(outboxKey)||'null');}catch{}
   if(local?.payload?.version===1){
    if(local.saveId===revision){localClear(local.saveId);}
    else if(local.revision===revision){pending=local;loaded={payload:local.payload};}
    else {conflict={draft:loaded,local};loaded={payload:local.payload};status('ร่างในเครื่องต่างจากฐานข้อมูล เลือกฉบับในประวัติร่างก่อนบันทึกต่อ',true);}
   }
   fields=loaded?.payload?.fields||{};ready=true;
   if(!conflict)status(pending?'มีร่างในเครื่องรอส่งเข้าฐานข้อมูล':loaded?'กู้คืนร่างล่าสุดแล้ว · '+(savedAt?stamp(savedAt):'รอเชื่อมต่อ'):'บันทึกร่างอัตโนมัติเมื่อแก้ไข');
  }catch{loadFailed=true;ready=enabled;
   if(outboxKey){try{pending=JSON.parse(localStorage.getItem(outboxKey)||'null');if(pending?.payload?.version===1){loaded={payload:pending.payload};fields=pending.payload.fields||{};revision=pending.revision;}}catch{}}
   status('ยังอ่านร่างเดิมไม่ได้ เก็บงานในเครื่องไว้ก่อน · กรุณาลองอีกครั้ง',true);
  }
 })();
 function capture(){
  if(!activated||!enabled||!ready||applying)return;
  let payload;try{payload=snapshot();}catch{return;}
  const current=stable(payload);if(current===last)return;last=current;
  pending={saveId:crypto.randomUUID(),revision,payload:clone(payload)};localWrite();
  status(loadFailed?'เก็บงานในเครื่องแล้ว · ยังอ่านฐานข้อมูลไม่ได้':conflict?'มีร่างจากอีกแท็บ เลือกฉบับในประวัติร่างก่อนบันทึกต่อ':'กำลังบันทึกร่าง…',!!conflict||loadFailed);
  clearTimeout(timer);timer=setTimeout(()=>flush(),450);
 }
 async function flush(){
  capture();clearTimeout(timer);if(!enabled)return true;if(!ready||conflict||loadFailed)return false;
  if(inflight){const ok=await inflight;if(!ok)return false;return flush();}
  if([...adapters.values()].some(a=>a.pending?.())){status('รูปแนบยังบันทึกไม่ครบ กรุณาเปิดหน้านี้ไว้จนบันทึกสำเร็จ',true);for(const a of adapters.values())if(a.pending?.())a.retry?.();return false;}
  if(!pending)return true;
  const saving=pending;saving.revision=revision;localWrite();
  inflight=(async()=>{
   try{
    const result=await readJSON(url,{method:'PUT',headers:{'content-type':'application/json'},body:stable(saving)});
    revision=result.draft.revision;savedAt=result.draft.updatedAt;loaded=result.draft;
    if(pending?.saveId===saving.saveId){pending=null;localClear(saving.saveId);status([...adapters.values()].some(a=>a.pending?.())?'บันทึกข้อความแล้ว · รูปแนบยังบันทึกไม่ครบ':'บันทึกร่างแล้ว · '+stamp(savedAt));}
    else if(pending){pending.revision=revision;localWrite();}
    return true;
   }catch(error){
    if(error.status===409){conflict={draft:error.data.draft,local:pending};status('มีร่างจากอีกแท็บ เลือกฉบับในประวัติร่างก่อนบันทึกต่อ',true);}
    else status(!localDurable?'ยังบันทึกไม่ได้ทั้งในเครื่องและฐานข้อมูล กรุณาเปิดหน้านี้ไว้แล้วลองอีกครั้ง':error.status===401?'กรุณาเข้าสู่ระบบอีกครั้ง · เก็บร่างรอส่งในเครื่องแล้ว':'ยังส่งร่างเข้าฐานข้อมูลไม่ได้ · เก็บร่างรอส่งในเครื่องแล้ว',true);
    return false;
   }
  })();
  const ok=await inflight;inflight=null;
  if(ok&&pending)return flush();return ok;
 }
 async function apply(payload){
  applying=true;
  try{fields=clone(payload.fields||{});for(const [name,adapter]of adapters)if(Object.hasOwn(payload.adapters||{},name))await adapter.restore(clone(payload.adapters[name]));restoreFields();}
  finally{applying=false;}
 }
 const restoredNodes=new WeakMap();
 function restoreFields(){
  for(const node of document.querySelectorAll('input,select,textarea')){
   if(!safeField(node)||node.closest('[data-draft-managed],[data-draft-ui]'))continue;
   const key=fieldKey(node),value=fields[key];if(value===undefined||restoredNodes.get(node)===value)continue;
   if(node.type==='checkbox'||node.type==='radio')node.checked=value;else node.value=value;
   restoredNodes.set(node,value);
   // Form values are restored without invoking business actions.
  }
 }
 async function history(){
  const dialog=document.createElement('dialog');dialog.className='wd-history';dialog.dataset.draftUi='';dialog.setAttribute('aria-label','ประวัติร่าง');
  dialog.innerHTML='<h2>ประวัติร่างหน้านี้</h2><p>เก็บล่าสุด 30 ฉบับ · กู้คืนเพื่อแก้ไขต่อ ยังไม่ใช่การส่งหรืออนุมัติงาน</p><div data-wd-list>กำลังโหลด…</div><button type="button" data-draft-control data-wd-close>ปิด</button>';
  document.body.append(dialog);dialog.querySelector('[data-wd-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();
  const list=dialog.querySelector('[data-wd-list]');
  try{
   const result=await readJSON(url+'&history=1');list.textContent='';
   if(!result.items.length)list.textContent='ยังไม่มีร่างที่บันทึกในฐานข้อมูล';
   const restoreButton=(label,record)=>{const button=document.createElement('button');button.type='button';button.dataset.draftControl='';button.textContent=label;button.dataset.wdRevision=record.revision||'local';list.append(button);button.onclick=async()=>{
    button.disabled=true;
    try{
     // Preserve pending work before replacing it. Conflicts require an explicit choice.
     if(!conflict){capture();if(!await flush()){button.disabled=false;return;}}
     const latest=await readJSON(url);revision=latest.draft?.revision||null;conflict=null;
     await apply(record.payload);last='';capture();await flush();dialog.close();
    }catch{status('ยังกู้คืนร่างไม่ได้ กรุณาลองอีกครั้ง',true);button.disabled=false;}
   };};
   if(conflict)restoreButton('ใช้ร่างที่กำลังแก้ไขในเครื่องนี้',{payload:snapshot()});
   for(const local of localDrafts())if(local.key!==outboxKey)restoreButton('กู้คืนร่างในเครื่อง · '+stamp(local.localAt||Date.now()),local);
   for(const record of result.items){const a=record.payload.adapters||{},title=a.promotion?.work?.name||a.activities?.draft?.name||a['event-plan']?.place||a.contracts?.values?.branch||'ร่างหน้านี้';restoreButton('กู้คืน '+stamp(record.updatedAt)+' · '+title,record);}
  }catch(error){list.textContent=error.message;}
 }
 bar.querySelector('[data-wd-save]').onclick=async()=>{
  if(conflict)return history();
  if(loadFailed){
   try{const result=await readJSON(url);loadFailed=false;
    if(pending&&(result.draft?.revision||null)!==pending.revision){conflict={draft:result.draft,local:pending};return history();}
    revision=result.draft?.revision||null;
    if(!pending&&result.draft){loaded=result.draft;await apply(loaded.payload);last=stable(snapshot());status('กู้คืนร่างล่าสุดแล้ว');}
   }catch{status('ยังเชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง',true);return;}
  }
  capture();await flush();
 };
 bar.querySelector('[data-wd-history]').onclick=history;
 const replaying=new WeakSet();
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button||button.disabled||button.closest('[data-draft-ui]')||!enabled||applying)return;
  if(replaying.has(button)){replaying.delete(button);return;}
  const replacesWork=/^(clear|reset|cancel-edit|reset-filters)$/.test(button.dataset.action||'')||button.matches('[data-close],[data-ac-close],[data-ac-new],[data-ac-edit],[data-ct-edit-cancel],[data-mode],[data-channel],[data-scope],[data-venue],#fp-calculate,#fp-baan-suan');
  if(!replacesWork)return;
  capture();if(!pending&&!inflight)return;
  event.preventDefault();event.stopImmediatePropagation();
  flush().then(ok=>{if(ok&&button.isConnected){replaying.add(button);button.click();}});
 },true);
 for(const type of ['input','change','click'])document.addEventListener(type,event=>{
  if(applying||event.target.closest?.('[data-draft-ui],[data-draft-view]'))return;
  activated=true;
  if(type!=='click'&&safeField(event.target)&&!event.target.closest('[data-draft-managed]')){const key=fieldKey(event.target);if(key){fields[key]=event.target.type==='checkbox'||event.target.type==='radio'?event.target.checked:event.target.value;restoredNodes.set(event.target,fields[key]);}}
  setTimeout(capture,0);
 },true);
 document.addEventListener('reset',event=>{
  if(applying||!enabled)return;event.preventDefault();capture();flush().then(ok=>{if(ok){applying=true;for(const node of event.target.querySelectorAll('input,select,textarea'))delete fields[fieldKey(node)];event.target.reset();applying=false;capture();status('เก็บร่างก่อนรีเซทแล้ว · ใช้ประวัติร่างเพื่อกู้คืน');}});
 },true);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){capture();flush();}});
 window.addEventListener('online',()=>flush());
 window.addEventListener('beforeunload',event=>{capture();if(enabled&&(pending||inflight||loadFailed||[...adapters.values()].some(a=>a.pending?.()))){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',()=>{capture();localWrite();if(pending&&!inflight&&!conflict){const body=stable(pending);if(new TextEncoder().encode(body).length<60000)fetch(url,{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});}});
 new MutationObserver(()=>{mirrorStatus();if(ready&&!applying)restoreFields();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 setInterval(()=>{capture();if(pending&&!conflict&&!inflight)flush();},3000);
 return {
  ready:initialized,
  async register(name,adapter){await initialized;adapters.set(name,adapter);if(ready&&Object.hasOwn(loaded?.payload?.adapters||{},name)){applying=true;try{await adapter.restore(clone(loaded.payload.adapters[name]));}finally{applying=false;}}activated=true;last=stable(snapshot());restoreFields();if(pending&&!conflict)flush();},
  capture,flush,history,
  async checkpoint(){capture();return flush();},
  get hasPending(){return !!pending||!!inflight;},
 };
}
