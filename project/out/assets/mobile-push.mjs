import {isIPhoneHomeScreen} from './mobile-push-policy.mjs';
const pushState={config:null,registration:null,error:'',loading:true,working:false,verified:false};
let pushInitialization=null;
export function mobilePushReadyOnDevice(){return pushState.verified&&pushState.config?.enabled===true&&typeof Notification!=='undefined'&&Notification.permission==='granted';}
export function mobilePushBusy(){return pushState.working;}
const pushSupported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const iphoneNeedsInstall=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)&&!navigator.standalone&&!matchMedia('(display-mode: standalone)').matches;
async function pushApi(path='',options={}){
 const response=await fetch('/api/mobile-push'+path,{cache:'no-store',signal:AbortSignal.timeout(15000),...options,headers:{'content-type':'application/json'}});
 const result=await response.json();if(!response.ok)throw Error(result.error||'ยังเชื่อมต่อไม่ได้ กรุณาลองใหม่');return result;
}
function pushKey(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));}
function drawPushSettings(){
 for(const host of document.querySelectorAll('[data-mobile-push]'))drawPushHost(host);
 window.dispatchEvent(new CustomEvent('ving:mobile-push-state'));
}
function drawPushHost(host){
 host.replaceChildren();
 const title=document.createElement('h3');title.textContent='แจ้งเตือนบนมือถือ';host.append(title);
 const p=document.createElement('p');host.append(p);
 const enabled=mobilePushReadyOnDevice(),required=isIPhoneHomeScreen();
 const note=text=>{p.textContent=text;};
 if(iphoneNeedsInstall()){
  note('ตั้งค่าครั้งแรกบน iPhone (iOS 16.4 ขึ้นไป)');
  const steps=document.createElement('ol');for(const text of ['เปิดเว็บนี้ใน Safari แล้วแตะปุ่มแชร์','เลือก “เพิ่มไปยังหน้าจอโฮม” และเปิดเป็นเว็บแอป','เปิด VING Warroom จากไอคอนใหม่ เข้าสู่ระบบ แล้วกดกระดิ่งเพื่อเปิดแจ้งเตือน']){const li=document.createElement('li');li.textContent=text;steps.append(li);}host.append(steps);return;
 }
 if(!pushSupported()){note('เบราว์เซอร์นี้ยังรับแจ้งเตือนไม่ได้ บน iPhone ให้อัปเดต iOS และเปิดเว็บจากไอคอนบนหน้าจอโฮม');return;}
 if(Notification.permission==='denied')note('การแจ้งเตือนถูกปิดอยู่ ไปที่การตั้งค่า iPhone → การแจ้งเตือน → VING Warroom แล้วอนุญาต จากนั้นกลับมาเปิดใช้งานที่นี่');
 else note(enabled?'เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว รับการเปลี่ยนแปลง Event และสัญญาตามสิทธิ์บัญชี':required?'กดเปิดแจ้งเตือน แล้วเลือก “อนุญาต” เพื่อเข้าใช้งาน':'รับแจ้งเตือน Event และสัญญาที่เกิดขึ้นใหม่ แม้ไม่ได้เปิดหน้าเว็บ');
 const actions=document.createElement('div');actions.className='mobile-push-actions';host.append(actions);
 function button(label,action,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled||pushState.working;b.dataset.pushAction=action;actions.append(b);}
 if(pushState.loading)button('กำลังตรวจสอบ…','retry',true);
 else if(!pushState.config?.configured||!pushState.registration){note(pushState.config?.configured===false?'ระบบแจ้งเตือนยังไม่พร้อม กรุณาลองใหม่':p.textContent);button('ลองอีกครั้ง','retry');}
 else if(enabled){button('ทดสอบแจ้งเตือน','test');if(!required)button('ปิดบนอุปกรณ์นี้','disable');}
 else if(Notification.permission==='denied')button('ตรวจสอบอีกครั้ง','retry');
 else button('เปิดแจ้งเตือนบนอุปกรณ์นี้','enable');
 const feedback=document.createElement('p');feedback.className='mobile-push-feedback';feedback.setAttribute('role','status');feedback.textContent=pushState.error;host.append(feedback);
 host.onclick=async event=>{
  const action=event.target.closest('[data-push-action]')?.dataset.pushAction;if(!action||pushState.working)return;
  event.stopPropagation();pushState.error='';pushState.working=true;
  // iOS requires this call in the tap handler, before any asynchronous work.
  try{
   const permission=action==='enable'?Notification.requestPermission():null;
   drawPushSettings();
   if(action==='retry')await initializeMobilePush();
   if(action==='enable'){
    if(await permission!=='granted')throw Error('ยังไม่ได้อนุญาตการแจ้งเตือน');
    let subscription=await pushState.registration.pushManager.getSubscription();
    const key=pushKey(pushState.config.publicKey),old=subscription?.options?.applicationServerKey;
    if(subscription&&old&&String(new Uint8Array(old))!==String(key)){await subscription.unsubscribe();subscription=null;}
    subscription=subscription||await pushState.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await pushApi('',{method:'POST',body:JSON.stringify({subscription:subscription.toJSON()})});
    pushState.config.enabled=true;pushState.verified=true;pushState.error='เปิดแล้ว กดทดสอบเพื่อเช็กการแจ้งเตือนบน iPhone';
   }
   if(action==='disable'){
    if(required)throw Error('ต้องเปิดแจ้งเตือนเพื่อใช้งานจากหน้าจอโฮมบน iPhone');
    await pushApi('',{method:'DELETE'});pushState.config.enabled=false;
    const sub=await pushState.registration.pushManager.getSubscription();if(sub)await sub.unsubscribe();
    pushState.error='ปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว';
   }
   if(action==='test'){await pushApi('/test',{method:'POST',body:'{}'});pushState.error='ส่งทดสอบแล้ว หากไม่เห็นให้ตรวจการตั้งค่าแจ้งเตือนและโหมดโฟกัสของ iPhone';}
  }catch(error){pushState.error=error.message||'ยังตั้งค่าไม่สำเร็จ กรุณาลองใหม่';}
  finally{pushState.working=false;drawPushSettings();}
 };
}
export function mountMobilePush(host){if(!host)return;host.dataset.mobilePush='';drawPushSettings();}
export function initializeMobilePush(){
 if(!pushInitialization)pushInitialization=checkMobilePush().finally(()=>{pushInitialization=null;});
 return pushInitialization;
}
async function checkMobilePush(){
 pushState.verified=false;pushState.error='';
 if(!pushSupported()||iphoneNeedsInstall()){pushState.loading=false;drawPushSettings();return;}
 pushState.loading=true;
 try{
  let timer;
  const registrationReady=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ยังเตรียมการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่')),12000);})])).finally(()=>clearTimeout(timer));
  const [config,registration]=await Promise.all([pushApi(),registrationReady]);
  pushState.config=config;pushState.registration=registration;
  const subscription=await registration.pushManager.getSubscription();
  if(!subscription||Notification.permission!=='granted')config.enabled=false;
  // Renew an already enrolled device, never opt in a different account silently.
  if(config.enabled&&subscription)await pushApi('',{method:'POST',body:JSON.stringify({subscription:subscription.toJSON()})});
  pushState.verified=true;
 }catch(error){pushState.error=error.message||'ยังเชื่อมต่อการแจ้งเตือนไม่ได้';}
 finally{pushState.loading=false;drawPushSettings();}
}
