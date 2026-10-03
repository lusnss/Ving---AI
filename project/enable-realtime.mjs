import fs from 'node:fs/promises';
const p=new URL('./out/',import.meta.url);
let api=await fs.readFile(new URL('assets/api.mjs',p),'utf8');
api=api.replace('let snapshot;',`let snapshot; let pending;
export async function refreshSnapshot(){
 if(pending)return pending;
 pending=fetch('/api/snapshot',{cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('โหลดข้อมูลล่าสุดไม่สำเร็จ');const next=await r.json();if(!next.data)throw Error('ข้อมูลไม่สมบูรณ์');snapshot=Promise.resolve(next);return next;}).finally(()=>{pending=null;});return pending;
}`);
api=api.replace("snapshot ||= fetch('/snapshot.json').then(r=>{if(!r.ok)throw new Error('โหลดข้อมูลไม่สำเร็จ');return r.json();});","if(!snapshot)await refreshSnapshot();");
await fs.writeFile(new URL('assets/api.mjs',p),api);
for(const name of ['content','news','intel'])await fs.appendFile(new URL('assets/'+name+'.mjs',p),'\nexport async function refreshReadonly(root,incoming){services=incoming;await reload(root);}\n');
let app=await fs.readFile(new URL('assets/app.mjs',p),'utf8');app=app.replace("import { api, escapeHtml }","import { api, escapeHtml, refreshSnapshot }");
app+=`
let currentSignature=null;let updating=false;
const relevant={content:['content_items','content_variants','publications','analytics_snapshots','wr_jobs'],news:['ca_candidates','wr_jobs','ca_sources','ca_post_log','ca_news_items'],intel:['intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','intel_scripts','wr_jobs'],sales:['mall-sales'],others:location.pathname.includes('events')?['events']:['contracts']};
function stable(value){return JSON.stringify(value,(key,v)=>['fetched_at','last_attempt_at','as_of'].includes(key)?undefined:v);}
async function updateLive(){if(updating||document.visibilityState==='hidden')return;updating=true;const banner=document.querySelector('.readonly-banner');try{
 const snapshot=await refreshSnapshot();const stamp=snapshot.syncedAt;const fresh=stamp&&Date.now()-Date.parse(stamp)<120000;
 banner.textContent='ดูอย่างเดียว · '+(fresh?'อัปเดตอัตโนมัติ':'ต้นทางยังไม่ซิงก์ — แสดงข้อมูลล่าสุด')+' · ล่าสุด '+new Date(stamp||snapshot.exportedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 const keys=relevant[route.nav]||['wr_jobs'];const signature=stable(keys.map(k=>snapshot.data['/api/'+k]));
 if(currentSignature!==null&&signature!==currentSignature){if(document.querySelector('dialog[open]')||app.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea'))return;const module=await import(route.module);const y=scrollY;await (module.refreshReadonly||module.render)(app,{api,toast,showDialog});window.scrollTo({top:y});}
 currentSignature=signature;await updateNotifications();
 }catch{banner.textContent='ดูอย่างเดียว · เชื่อมต่อข้อมูลล่าสุดไม่ได้ — แสดงข้อมูลที่โหลดไว้';}finally{updating=false;}}
await updateLive();setInterval(updateLive,15000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateLive();});
`;
await fs.writeFile(new URL('assets/app.mjs',p),app);
for(const name of await fs.readdir(p))if(name.endsWith('.html')){const file=new URL(name,p);let html=await fs.readFile(file,'utf8');html=html.replace(/<aside class="readonly-banner">.*?<\/aside>/,'<aside class="readonly-banner" role="status">ดูอย่างเดียว · กำลังตรวจสอบการซิงก์ล่าสุด…</aside>');await fs.writeFile(file,html);}
const hostingUrl=new URL('./.openai/hosting.json',import.meta.url);const hosting=JSON.parse(await fs.readFile(hostingUrl));delete hosting.static;hosting.r2='BUCKET';await fs.writeFile(hostingUrl,JSON.stringify(hosting,null,2));
