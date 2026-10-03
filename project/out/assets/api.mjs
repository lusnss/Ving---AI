import {accessForRole} from './access-permissions.mjs';
import {recoverableRead} from './read-recovery.mjs';
let snapshot; let pending;
const cloudTables=new Set(['ca_sources','ca_news_items','ca_candidates','ca_post_log','content_items','content_variants','publications','analytics_snapshots','intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','intel_scripts','wr_jobs','agent_requests']);
const cloudRevisions=new Map();
async function cloudRequest(url,options={}){
 const method=(options.method||'GET').toUpperCase();
 const pathname=new URL(url,location.origin).pathname;
 const write=!['GET','HEAD'].includes(method)&&pathname!=='/api/similar';
 const table=cloudTables.has(pathname.split('/')[2])?pathname.split('/')[2]:'workspace';
 if(write&&!accessForRole(document.body.dataset.accessRole).canEdit)throw Error('สิทธิ์ดูอย่างเดียว');
 if(write&&!cloudRevisions.has(table)){
  await cloudRequest(table==='workspace'?'/api/cloud-workspace/status':'/api/'+table);
 }
 // A dialog can contain data from several collections. Preserve the oldest
 // read revision until a successful CAS write or a full page reload.
 const pins=[...cloudRevisions.values()].filter(value=>/^"cloud-workspace-\d+"$/.test(value));
 const revision=write&&pins.length?pins.reduce((a,b)=>Number(a.match(/\d+/)[0])<Number(b.match(/\d+/)[0])?a:b):cloudRevisions.get(table);
 const headers=new Headers(options.headers);headers.set('content-type','application/json');
 if(write&&revision)headers.set('if-match',revision);
 const body=options.body!==undefined&&typeof options.body!=='string'?JSON.stringify(options.body):options.body;
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),...options,method,headers,...(body!==undefined?{body}:{})});
 const result=response.status===204?{}:await response.json();
 if(!response.ok){
  if(response.status===409||response.status===412)throw Error('มีคนแก้ข้อมูลระหว่างนี้ กรุณารีเฟรชหน้าเว็บก่อนบันทึกอีกครั้ง');
  throw Error(result.error||'ยังบันทึกข้อมูลบนคลาวด์ไม่ได้');
 }
 const next=response.headers.get('etag');
 if(next){
  if(write)for(const [key,value]of cloudRevisions)if(value===revision)cloudRevisions.set(key,next);
  if(write||!cloudRevisions.has(table))cloudRevisions.set(table,next);
 }
 if(write)snapshot=undefined;
 return result;
}
export async function refreshSnapshot(){
 if(pending)return pending;
 pending=recoverableRead('/api/snapshot',{fallback:true,validate:next=>!!next.data}).then(next=>{snapshot=Promise.resolve(next);return next;}).finally(()=>{pending=null;});return pending;
}
export async function api(url, options={}) {
 const pathname=new URL(url,location.origin).pathname;
 if(cloudTables.has(pathname.split('/')[2])||['/api/similar','/api/write-md','/api/cloud-workspace/status'].includes(pathname))return cloudRequest(url,options);
 if(['/api/events/staff','/api/events/schedule','/api/product-costs','/api/daily-comparison','/api/notifications','/api/notifications/read','/api/notifications/decision','/api/contracts'].includes(new URL(url,location.origin).pathname)){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000),...options,headers:{'content-type':'application/json',...options.headers}});const result=await response.json();if(!response.ok)throw Error(result.error||'โหลดข้อมูลไม่สำเร็จ');return result;
 }
 if(new URL(url,location.origin).pathname==='/api/events/approved')return recoverableRead('/api/events/approved',{validate:data=>Array.isArray(data.items)&&!data.unavailable});
 if(options.method && !['GET','HEAD'].includes(options.method.toUpperCase())){if(!accessForRole(document.body.dataset.accessRole).canEdit)throw new Error('สิทธิ์ดูอย่างเดียว');const response=await fetch(url,{...options,headers:{'content-type':'application/json',...options.headers}});const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');if(pathname.startsWith('/api/summary/'))recoverableRead.invalidate('/api/summary');return result;}
 if(new URL(url,location.origin).pathname==='/api/summary')return recoverableRead('/api/summary',{fallback:true,validate:data=>!!data.report&&!!data.comparison&&Array.isArray(data.deletedSummaryEvents)});
 if(new URL(url,location.origin).pathname==='/api/rebrand'){const response=await fetch('/api/rebrand',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('อ่านข้อมูล Rebrand ไม่สำเร็จ');return response.json();}
 if(new URL(url,location.origin).pathname==='/api/event-proposals')return recoverableRead('/api/event-proposals',{fallback:true,validate:data=>Array.isArray(data.items)&&data.web?.status!=='unavailable'&&(data.source?.status!=='unavailable'||data.items.length>0)});
 if(new URL(url,location.origin).pathname==='/api/profit-loss'){const response=await fetch('/api/profit-loss',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('อ่านข้อมูลต้นทุนไม่สำเร็จ');return response.json();}
 if(!snapshot||new URL(url,location.origin).searchParams.get('refresh')==='1')await refreshSnapshot();
 const data=(await snapshot).data; const u=new URL(url,location.origin);
 if(!(u.pathname in data))throw new Error('ข้อมูลนี้ไม่เปิดเผยในเวอร์ชันสาธารณะ');
 let result=structuredClone(data[u.pathname]);
 if(result.items){const {order,limit,...filters}=Object.fromEntries(u.searchParams);result.items=result.items.filter(x=>Object.entries(filters).every(([k,v])=>String(x[k])===v.replace(/^eq\./,'')));if(order){const [key,dir]=order.split('.');result.items.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(dir==='desc'?-1:1));}if(limit)result.items=result.items.slice(0,Number(limit));}
 return result;
}
export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export async function copyText(text) {
  await navigator.clipboard.writeText(String(text));
}
