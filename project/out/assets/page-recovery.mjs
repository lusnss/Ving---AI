export function installPageRecovery(app,onRetry){
 const panel=document.createElement('section');panel.className='page-recovery';panel.hidden=true;
 panel.setAttribute('aria-label','สถานะการโหลดข้อมูล');
 panel.innerHTML='<div role="status" aria-live="polite"><h2></h2><p></p></div><button type="button" data-page-retry>ลองใหม่</button>';
 app.before(panel);
 const heading=panel.querySelector('h2'),detail=panel.querySelector('p'),button=panel.querySelector('button');let loginRequired=false;
 button.addEventListener('click',async()=>{if(button.disabled)return;if(loginRequired){location.assign('/login?next='+encodeURIComponent(location.pathname));return;}button.disabled=true;button.textContent='กำลังลองใหม่…';panel.setAttribute('aria-busy','true');try{await onRetry();}finally{button.disabled=false;button.textContent=loginRequired?'เข้าสู่ระบบ':'ลองใหม่';panel.removeAttribute('aria-busy');}});
 return {
  show({error,stale=false,at=null,readonly=false}={}){
   heading.textContent=stale?'ยังอัปเดตข้อมูลไม่ได้':'ยังโหลดข้อมูลไม่สำเร็จ';
   const time=at&&Number.isFinite(Date.parse(at))?new Date(at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):null;
   detail.textContent=stale?'แสดงข้อมูลที่โหลดสำเร็จล่าสุด'+(time?' · '+time:'')+(readonly?' · ดูข้อมูลได้ แต่ต้องเชื่อมต่อสำเร็จก่อนแก้ไขหรืออนุมัติ':''):'การเชื่อมต่อใช้เวลานานหรือขัดข้อง กด “ลองใหม่” เพื่อโหลดอีกครั้ง';
   if(error?.status===401)detail.textContent='การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
   if(error?.status===403)detail.textContent='บัญชีนี้ไม่มีสิทธิ์เปิดข้อมูล กรุณาตรวจสอบบัญชีที่ใช้งาน';
   loginRequired=error?.status===401;if(!button.disabled)button.textContent=loginRequired?'เข้าสู่ระบบ':'ลองใหม่';
   panel.hidden=false;
  },
  clear(){panel.hidden=true;loginRequired=false;}
 };
}
