import {isIPhoneHomeScreen} from './mobile-push-policy.mjs';
import {initializeMobilePush,mountMobilePush,mobilePushReadyOnDevice,mobilePushBusy} from './mobile-push.mjs';
let enrollmentPromise=null,resume=null,dialog=null,listening=false;
function enrollmentComplete(){
 if(!mobilePushReadyOnDevice()||!dialog)return;
 const completed=dialog;dialog=null;
 document.documentElement.removeAttribute('data-iphone-push-gated');
 completed.close();completed.remove();
 const next=resume;resume=null;enrollmentPromise=null;next?.();
}
async function recheck(){
 if(document.visibilityState==='hidden'||mobilePushBusy())return;
 await ensureRequiredMobilePush();
}
export function ensureRequiredMobilePush(){
 if(!isIPhoneHomeScreen())return Promise.resolve();
 if(!listening){
  listening=true;
  window.addEventListener('ving:mobile-push-state',enrollmentComplete);
  document.addEventListener('visibilitychange',recheck);
  window.addEventListener('pageshow',event=>{if(event.persisted)recheck();});
 }
 if(enrollmentPromise){initializeMobilePush();return enrollmentPromise;}
 enrollmentPromise=new Promise(resolve=>{resume=resolve;});
 const pending=enrollmentPromise;
 document.documentElement.setAttribute('data-iphone-push-gated','');
 for(const open of document.querySelectorAll('dialog[open]'))open.close();
 dialog=document.createElement('dialog');dialog.id='iphone-push-gate';dialog.setAttribute('aria-labelledby','iphone-push-title');
 dialog.innerHTML='<div class="iphone-push-brand">VING WARROOM</div><h1 id="iphone-push-title">เปิดแจ้งเตือนก่อนเข้าใช้งาน</h1><p class="iphone-push-intro">ทุกบัญชีที่ใช้งานผ่านไอคอนหน้าจอโฮมบน iPhone ต้องลงทะเบียนรับแจ้งเตือนบนอุปกรณ์นี้ให้เรียบร้อย</p><section class="mobile-push" data-mobile-push></section><p class="iphone-push-footnote">เมื่ออนุญาตและลงทะเบียนสำเร็จ เว็บจะเปิดให้ใช้งานต่อโดยอัตโนมัติ</p><form method="post" action="/logout" data-session-form><button class="iphone-push-signout" type="submit">ออกจากระบบ</button></form>';
 document.body.append(dialog);
 dialog.addEventListener('cancel',event=>event.preventDefault());
 dialog.addEventListener('close',()=>{if(dialog&&!mobilePushReadyOnDevice())dialog.showModal();});
 // Verify both browser permission and saved enrollment before releasing the gate.
 dialog.showModal();
 initializeMobilePush();mountMobilePush(dialog.querySelector('[data-mobile-push]'));
 return pending;
}
