import {escapeHtml as e} from './api.mjs';
if(typeof document!=='undefined'){const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/action-dialog.css';document.head.append(css);}
let pending=false;
export function confirmAction({title,description='',detail='',confirmLabel='ยืนยัน',danger=false}){
 if(pending)return Promise.resolve(false);pending=true;
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='ving-confirm';dialog.setAttribute('aria-labelledby','ving-confirm-title');dialog.setAttribute('aria-describedby','ving-confirm-description');
 dialog.innerHTML=`<form method="dialog"><div class="confirm-symbol" aria-hidden="true">${danger?'!':'✓'}</div><span class="confirm-eyebrow">VING / CONFIRMATION</span><h2 id="ving-confirm-title">${e(title)}</h2><p id="ving-confirm-description">${e(description)}</p>${detail?`<div class="confirm-detail">${e(detail)}</div>`:''}<footer><button value="cancel" class="confirm-cancel" autofocus>ยกเลิก</button><button value="confirm" class="confirm-submit ${danger?'is-danger':''}">${e(confirmLabel)}</button></footer></form>`;
 document.body.append(dialog);dialog.showModal();
 return new Promise(resolve=>{dialog.addEventListener('close',()=>{pending=false;const confirmed=dialog.returnValue==='confirm';dialog.remove();trigger?.focus?.({preventScroll:true});resolve(confirmed);},{once:true});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close('cancel');}});});
}
