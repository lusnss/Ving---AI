import {prepareCaptureBackgrounds} from './screen-capture-backgrounds.mjs';
const KEY='ving-screen-capture';
let bar, overlay, box, start, end, pointer, frame, busy=false;
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/assets/screen-capture.css';document.head.append(sheet);
const active=()=>{try{return sessionStorage.getItem(KEY)==='1';}catch{return false;}};
function persist(value){try{value?sessionStorage.setItem(KEY,'1'):sessionStorage.removeItem(KEY);}catch{}}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.captureControl='';b.onclick=action;return b;}
function message(text){bar.querySelector('[role=status]').textContent=text;}
export function enableCapture(){
 persist(true);if(bar){bar.querySelector('button').focus();return;}
 bar=document.createElement('aside');bar.className='capture-bar';bar.dataset.html2canvasIgnore='true';bar.setAttribute('aria-label','แคปหน้าจอ');
 const status=document.createElement('span');status.role='status';status.textContent='โหมดแคป · ไปแท็บที่ต้องการ แล้วเลือกวิธีแคป';bar.append(status);
 bar.append(button('แคปทั้งหน้า',()=>capture()),button('ลากเลือกพื้นที่',selectArea),button('ปิดโหมดแคป',close));document.body.append(bar);
}
function clearSelection(){cancelAnimationFrame(frame);overlay?.remove();overlay=box=start=end=pointer=null;delete document.body.dataset.captureSelecting;}
function close(){if(busy)return;clearSelection();persist(false);bar?.remove();bar=null;}
function rectangle(){return {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};}
function draw(){end={x:pointer.x+scrollX,y:pointer.y+scrollY};const r=rectangle();Object.assign(box.style,{left:r.x-scrollX+'px',top:r.y-scrollY+'px',width:r.width+'px',height:r.height+'px'});}
function autoScroll(){if(!start||!pointer)return;const y=pointer.y<60?-22:pointer.y>innerHeight-70?22:0;const x=pointer.x<35?-18:pointer.x>innerWidth-35?18:0;if(x||y)scrollBy(x,y);draw();frame=requestAnimationFrame(autoScroll);}
function selectArea(){
 if(busy)return;clearSelection();document.body.dataset.captureSelecting='true';message('ลากเลือกพื้นที่ · ลากชิดขอบล่างเพื่อเลื่อนต่อ · Esc ยกเลิก');
 overlay=document.createElement('div');overlay.className='capture-overlay';overlay.dataset.html2canvasIgnore='true';box=document.createElement('div');box.className='capture-box';overlay.append(box);document.body.append(overlay);
 overlay.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();overlay.setPointerCapture(e.pointerId);pointer={x:e.clientX,y:e.clientY};start=end={x:e.clientX+scrollX,y:e.clientY+scrollY};draw();frame=requestAnimationFrame(autoScroll);};
 overlay.onpointermove=e=>{if(start){pointer={x:e.clientX,y:e.clientY};draw();}};
 overlay.onpointerup=e=>{if(!start)return;pointer={x:e.clientX,y:e.clientY};draw();const r=rectangle();clearSelection();if(r.width<12||r.height<12){message('พื้นที่เล็กเกินไป กรุณาลากเลือกใหม่');return;}capture(r);};
 overlay.onpointercancel=()=>{clearSelection();message('ยกเลิกการเลือกพื้นที่แล้ว');};
}
async function renderer(){if(window.html2canvas)return window.html2canvas;await import('./html2canvas.mjs');if(!window.html2canvas)throw Error('โหลดเครื่องมือไม่สำเร็จ');return window.html2canvas;}
async function capture(area){
 if(busy)return;busy=true;clearSelection();document.body.dataset.captureBusy='true';bar.querySelectorAll('button').forEach(b=>b.disabled=true);message('กำลังสร้างภาพยาว…');
 try{
  await document.fonts.ready;const render=await renderer();
  const r=area||{x:0,y:0,width:Math.max(document.documentElement.clientWidth,document.body.scrollWidth),height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)};
  const scale=Math.min(2,devicePixelRatio||1,16000/r.width,16000/r.height,Math.sqrt(24000000/(r.width*r.height)));
  const canvas=await render(document.body,{...r,scale,backgroundColor:getComputedStyle(document.body).backgroundColor,useCORS:true,logging:false,scrollX:0,scrollY:0,windowWidth:innerWidth,windowHeight:innerHeight,
   onclone:async doc=>{doc.querySelectorAll('.capture-bar,.capture-overlay,#app-toast').forEach(el=>el.remove());doc.querySelectorAll('details:not([open])').forEach(el=>{[...el.children].filter(child=>child.tagName!=='SUMMARY').forEach(child=>child.remove());});doc.querySelectorAll('*').forEach(el=>{const s=doc.defaultView.getComputedStyle(el);if(s.position==='sticky')el.style.position='static';});await prepareCaptureBackgrounds(doc);}
  });
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('สร้างภาพไม่สำเร็จ');
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='VING-'+(location.pathname.split('/').filter(Boolean).pop()||'summary')+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('ดาวน์โหลดภาพ PNG แล้ว · เลือกแท็บอื่นเพื่อแคปต่อได้');
 }catch(error){message('แคปไม่สำเร็จ กรุณาลองใหม่ หรือเลือกพื้นที่ให้เล็กลง');console.error('Screen capture:',error);}
 finally{busy=false;delete document.body.dataset.captureBusy;bar?.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay){clearSelection();message('ยกเลิกการเลือกพื้นที่แล้ว');}});
if(active())enableCapture();

// Settings is a compact utility menu available on every report.
const settings=document.querySelector('[data-utility="settings"]');
if(settings){
 const trigger=document.createElement('button');trigger.type='button';trigger.className='capture-settings-trigger';trigger.textContent='Settings ▾';trigger.dataset.captureControl='';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','capture-settings-menu');
 const wrapper=document.createElement('div');wrapper.className='capture-settings';settings.replaceWith(wrapper);wrapper.append(trigger);
 const menu=document.createElement('div');menu.id='capture-settings-menu';menu.className='capture-settings-menu';menu.hidden=true;menu.dataset.html2canvasIgnore='true';
 const item=button('แคปหน้าจอ',()=>{setOpen(false);enableCapture();});menu.append(item);const account=document.createElement('a');account.href='/settings';account.textContent='บัญชีและสิทธิ์';menu.append(account);wrapper.append(menu);
 function setOpen(open){menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));}
 trigger.onclick=()=>setOpen(menu.hidden);
 trigger.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);item.focus();}};
 wrapper.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);trigger.focus();}});
 document.addEventListener('click',e=>{if(!wrapper.contains(e.target))setOpen(false);});
 wrapper.addEventListener('focusout',e=>{if(!wrapper.contains(e.relatedTarget))setOpen(false);});
}
