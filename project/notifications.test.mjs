import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {listNotifications,readNotifications,decideNotification,loadContracts,updateContract} from './notifications.mjs';
import worker from './dist/server/index.js';
const req=(path,body,method='POST',cookie='',origin='https://example.test')=>new Request('https://example.test'+path,{method,headers:{origin,cookie,'content-type':'application/json'},...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify(body)})});
const snapshot={data:{'/api/contracts':{items:[{branch:'สาขาทดสอบ',term:'1 ปี',starts_on:'2026-01-01',ends_on:'2026-12-31',remaining_days:100,renewed:false,status:'ใช้งาน'}],summary:{},source:{}}}};
const env=()=>({DB:previewDatabase(),BUCKET:{get:async key=>key==='snapshot.json'?{json:async()=>snapshot}:null},SESSION_SECRET:'test-notification-secret',ADMIN_PASSWORD:'admin-test',VIEWER_PASSWORD:'viewer-test'});
const create=async(db,id=crypto.randomUUID())=>{const row={id,place:'พื้นที่ทดสอบ',startDate:'2026-10-01',endDate:'2026-10-03'};await db.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind(id,new Date().toISOString(),JSON.stringify(row)).run();return row;};
const login=async(e,password)=>(await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),e)).headers.get('set-cookie').split(';')[0];
test('proposal writes notify admin atomically; viewer gets only approved records; edits reset the queue',async()=>{
 const e=env();try{const row=await create(e.DB);let admin=await listNotifications(e,'admin','admin:a');assert.equal(admin.pending,1);assert.equal((await listNotifications(e,'viewer','viewer:a')).items.length,0);
 const initial=admin.items[0];await readNotifications(req('/read',{items:[{id:initial.id,version:initial.version}]}),e,'admin','admin:a');assert.equal((await listNotifications(e,'admin','admin:a')).unread,0);
 await e.DB.prepare('INSERT INTO event_proposal_approvals VALUES (?,?,?,?)').bind('web:'+row.id,'อนุมัติ',null,new Date(Date.now()+1).toISOString()).run();
 let viewer=await listNotifications(e,'viewer','viewer:a');assert.equal(viewer.items.length,1);assert.equal(viewer.items[0].status,'approved');assert.equal(viewer.items[0].after,null);assert.equal((await listNotifications(e,'admin','admin:a')).unread,1);
 await readNotifications(req('/read',{items:viewer.items.map(i=>({id:i.id,version:i.version}))}),e,'viewer','viewer:a');assert.equal((await listNotifications(e,'viewer','viewer:a')).unread,0);assert.equal((await listNotifications(e,'viewer','viewer:b')).unread,1);
 await e.DB.prepare('UPDATE event_requests SET payload=? WHERE id=?').bind(JSON.stringify({...row,place:'แก้ไขพื้นที่'}),row.id).run();assert.equal((await listNotifications(e,'admin','admin:a')).pending,1);assert.equal((await listNotifications(e,'viewer','viewer:a')).items.length,1);
 await e.DB.prepare('UPDATE event_requests SET payload=? WHERE id=?').bind(JSON.stringify({...row,place:'แก้ไขล่าสุด'}),row.id).run();assert.equal((await listNotifications(e,'admin','admin:a')).pending,1);
 const count=(await e.DB.prepare('SELECT COUNT(*) AS n FROM event_requests').first()).n;
 await assert.rejects(()=>e.DB.batch([e.DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind('rollback','now','{}'),e.DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind('rollback','now','{}')]));assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM event_requests').first()).n,count);assert.equal((await e.DB.prepare("SELECT COUNT(*) AS n FROM web_changes WHERE entity='web:rollback'").first()).n,0);
 }finally{e.DB.close();}
});
test('contract renewal persists, duplicate retry is safe, superseded approval and stale edit rejected',async()=>{
 const e=env();try{const original=(await loadContracts(e,snapshot,'admin')).items[0];const body={...original,term:'2 ปี',ends_on:'2027-12-31',renewed:true,changeId:crypto.randomUUID().replaceAll('-','')};
 await updateContract(req('/api/contracts',body,'PATCH'),e,snapshot);await updateContract(req('/api/contracts',body,'PATCH'),e,snapshot);
 const first=(await listNotifications(e,'admin','a')).items[0];assert.equal(first.kind,'contract_renewed');assert.equal(first.before.renewed,false);assert.equal((await listNotifications(e,'viewer','v')).items.length,0);
 await assert.rejects(()=>updateContract(req('/api/contracts',{...body,changeId:crypto.randomUUID().replaceAll('-','')},'PATCH'),e,snapshot),{status:409});
 const updated=(await loadContracts(e,snapshot,'admin')).items[0];assert.equal(updated.ends_on,'2027-12-31');
 await updateContract(req('/api/contracts',{...updated,status:'ต่อสัญญาแล้ว',changeId:crypto.randomUUID().replaceAll('-','')},'PATCH'),e,snapshot);
 await assert.rejects(()=>decideNotification(req('/decision',{id:first.id,status:'approved'}),e),{status:409});
 const latest=(await listNotifications(e,'admin','a')).items[0];await decideNotification(req('/decision',{id:latest.id,status:'approved'}),e);assert.equal((await listNotifications(e,'viewer','v')).items.length,1);
 await assert.rejects(()=>updateContract(req('/api/contracts',{...updated,starts_on:'2026-02-30',changeId:crypto.randomUUID().replaceAll('-','')},'PATCH'),e,snapshot));
 }finally{e.DB.close();}
});
test('HTTP authentication, viewer isolation, origin checks, per-browser reader cookie and live routes',async()=>{
 const e=env();try{await create(e.DB);const viewer=await login(e,'viewer-test'),admin=await login(e,'admin-test');
 assert.equal((await worker.fetch(req('/api/notifications',null,'GET'),e)).status,401);
 const notices=await(await worker.fetch(req('/api/notifications',null,'GET',admin),e)).json();assert.equal(notices.pending,1);
 const hidden=await(await worker.fetch(req('/api/notifications',null,'GET',viewer),e)).json();assert.deepEqual(hidden.items,[]);
 assert.equal((await worker.fetch(req('/api/notifications/decision',{id:notices.items[0].id,status:'approved'},'PATCH',viewer),e)).status,403);
 assert.equal((await worker.fetch(req('/api/contracts',{},'PATCH',viewer),e)).status,403);
 assert.equal((await worker.fetch(req('/api/notifications/read',{items:[]},'POST',viewer,'https://evil.test'),e)).status,403);
 assert.equal((await worker.fetch(req('/api/notifications/read',{items:[]},'POST',viewer),e)).status,200);
 const contracts=await(await worker.fetch(req('/api/contracts',null,'GET',admin),e)).json();assert.equal(contracts.permissions.canEdit,true);
 const page=await worker.fetch(req('/contracts',null,'GET',viewer),e);assert.match(page.headers.get('set-cookie'),/ving_reader=.*HttpOnly.*SameSite=Strict/);assert.match(await page.text(),/navigation-premium.css/);
 }finally{e.DB.close();}
});
test('notification history paginates and counts all unread; storage failure reports 503',async()=>{
 const e=env();try{for(let i=0;i<55;i++)await create(e.DB);const first=await listNotifications(e,'admin','a');assert.equal(first.items.length,50);assert.equal(first.unread,55);const second=await listNotifications(e,'admin','a',first.nextCursor);assert.equal(second.items.length,5);assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,55);
 const cookie=await login(e,'admin-test');const result=await worker.fetch(req('/api/notifications',null,'GET',cookie),{...e,DB:{prepare(){throw Error('offline');}}});assert.equal(result.status,503);
 }finally{e.DB.close();}
});
test('an approval from a stale proposal page cannot approve a newer edit',async()=>{
 const e=env();try{const row=await create(e.DB);const admin=await login(e,'admin-test');const latest={...row,updatedAt:'2026-09-22T01:00:00Z'};await e.DB.prepare('UPDATE event_requests SET payload=? WHERE id=?').bind(JSON.stringify(latest),row.id).run();
 const body={key:'web:'+row.id,field:'ceo',status:'อนุมัติ'};
 assert.equal((await worker.fetch(req('/api/event-proposals/approval',body,'PATCH',admin),e)).status,409);
 assert.equal((await listNotifications(e,'viewer','v')).items.length,0);
 assert.equal((await worker.fetch(req('/api/event-proposals/approval',{...body,revision:latest.updatedAt},'PATCH',admin),e)).status,200);
 assert.equal((await listNotifications(e,'viewer','v')).items.length,1);
 }finally{e.DB.close();}
});
test('dismiss removes only this reader and version, preserving event and other readers',async()=>{
 const {dismissNotification}=await import('./notifications.mjs');const e=env();
 try{const row=await create(e.DB);const item=(await listNotifications(e,'admin','admin:a')).items[0];
 await assert.rejects(()=>dismissNotification(req('/dismiss',{id:item.id,version:item.version}),e,'viewer','viewer:a'),{status:404});
 await dismissNotification(req('/dismiss',{id:item.id,version:item.version}),e,'admin','admin:a');
 assert.equal((await listNotifications(e,'admin','admin:a')).items.length,0);assert.equal((await listNotifications(e,'admin','admin:a')).unread,0);
 assert.equal((await listNotifications(e,'admin','admin:b')).items.length,1);assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM event_requests').first()).n,1);
 await e.DB.prepare('INSERT INTO event_proposal_approvals VALUES (?,?,?,?)').bind('web:'+row.id,'อนุมัติ',null,new Date(Date.now()+10).toISOString()).run();
 assert.equal((await listNotifications(e,'admin','admin:a')).items.length,1);
 const viewer=await login(e,'viewer-test');const approved=(await listNotifications(e,'viewer','viewer:shared')).items[0];
 assert.equal((await worker.fetch(req('/api/notifications/dismiss',{id:approved.id,version:approved.version},'POST',viewer,'https://evil.test'),e)).status,403);
 assert.equal((await worker.fetch(req('/api/notifications/dismiss',{id:approved.id,version:'stale'},'POST',viewer),e)).status,409);
 assert.equal((await worker.fetch(req('/api/notifications/dismiss',{id:approved.id,version:approved.version},'POST',viewer),e)).status,200);
 assert.equal((await listNotifications(e,'viewer','viewer:shared')).items.length,0);
 }finally{e.DB.close();}
});
