// Notification-only worker: authenticated pages and reports are never cached.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let message={};try{message=event.data?.json()||{};}catch{}
 let url='/daily-sales?notifications=1';
 try{const candidate=new URL(message.url,self.location.origin);if(candidate.origin===self.location.origin&&['/daily-sales','/event-proposals','/contracts'].includes(candidate.pathname))url=candidate.pathname+candidate.search;}catch{}
 event.waitUntil(self.registration.showNotification('VING Warroom',{
  body:typeof message.body==='string'?message.body.slice(0,240):'มีรายการแจ้งเตือนใหม่ แตะเพื่อดูรายละเอียด',
  icon:'/assets/push-icon-192.png',badge:'/assets/push-icon-192.png',
  tag:typeof message.tag==='string'?message.tag:'ving-warroom',data:{url},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  let target=new URL('/daily-sales?notifications=1',self.location.origin);
  try{const candidate=new URL(event.notification.data?.url,self.location.origin);if(candidate.origin===self.location.origin&&['/daily-sales','/event-proposals','/contracts'].includes(candidate.pathname))target=candidate;}catch{}
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
   if(new URL(client.url).origin===self.location.origin&&'navigate' in client){await client.navigate(target.href);return client.focus();}
  }
  return self.clients.openWindow(target.href);
 })());
});
