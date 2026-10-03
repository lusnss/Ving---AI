import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {listNotifications,readNotifications,dismissNotification} from './notifications.mjs';
import {dispatchMobilePush,handleMobilePush} from './mobile-push.mjs';
import {pushBase64} from './web-push.mjs';
import {requesterMarkup} from './out/assets/notifications.mjs';
import worker from './dist/server/index.js';
const origin='https://example.test';
const account=userId=>({userId,role:userId==='admin'?'admin':userId==='viewer'?'viewer':'assistant'});
const env=()=>({DB:previewDatabase(),SESSION_SECRET:'receipt-test-secret',ADMIN_PASSWORD:'admin-test',VIEWER_PASSWORD:'viewer-test',ASSISTANT_PASSWORD_1:'assistant-test-1',ASSISTANT_PASSWORD_2:'assistant-test-2',BUSINESS_DEVELOPMENT_PASSWORD:'business-test'});
const req=body=>new Request(origin+'/api/notifications/read',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const list=(e,user,device='a',cursor='')=>listNotifications(e,account(user).role,user+':'+device,cursor,user);
const read=(e,user,item,device='a')=>readNotifications(req({items:[{id:item.id,version:item.version}]}),e,account(user).role,user+':'+device,account(user));
async function create(e,{user='assistant-1',createdBy=user,kind='proposal_created',entity='web:receipt-test',status='pending',payload}={}){
 const id=crypto.randomUUID().replaceAll('-',''),after=payload??{place:'พื้นที่ทดสอบ',submittedBy:account(user),createdBy:account(createdBy)};
 await e.DB.prepare('INSERT INTO web_changes (id,entity,kind,title,after_json,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,entity,kind,'คำขอทดสอบ',JSON.stringify(after),status,new Date().toISOString()).run();
 return (await list(e,'admin')).items.find(i=>i.id===id);
}
const count=(e,table,where='')=>e.DB.prepare('SELECT COUNT(*) AS n FROM '+table+' '+where).first().then(r=>r.n);
const receipts=e=>count(e,'web_changes',"WHERE kind='notification_read'");
async function session(e,user){
 const password=user==='admin'?e.ADMIN_PASSWORD:user==='viewer'?e.VIEWER_PASSWORD:user==='business-development-1'?e.BUSINESS_DEVELOPMENT_PASSWORD:e['ASSISTANT_PASSWORD_'+user.slice(-1)];
 const response=await worker.fetch(new Request(origin+'/login',{method:'POST',body:new URLSearchParams({password})}),e);
 assert.equal(response.status,303);return response.headers.get('set-cookie').split(';')[0];
}
async function http(e,user,path,body,options={}){
 const cookie=await session(e,user),method=body===undefined?'GET':'POST';
 return worker.fetch(new Request(origin+path,{method,headers:{cookie:cookie+'; ving_reader=00000000-0000-4000-8000-000000000001',origin:options.origin||origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),e);
}
test('explicit read targets requester and creator; keeps approval pending and excludes unrelated accounts',async()=>{
 const e=env();try{
  const original=await create(e,{user:'business-development-1',createdBy:'assistant-1'});
  const result=await read(e,'admin',original);assert.equal(result.notified,true);
  for(const user of ['assistant-1','business-development-1']){
   const data=await list(e,user),receipt=data.items.find(i=>i.kind==='notification_read');
   assert(receipt);assert.equal(receipt.status,'acknowledged');assert.equal(receipt.receipt.readerLabel,'CEO / Trade Manager');assert.equal(receipt.after,null);assert.equal(data.unread,2);
   assert.equal(receipt.url,'/event-predict?proposal=web%3Areceipt-test');assert(!requesterMarkup(receipt).includes('ไม่ได้บันทึกชื่อ'));
  }
  assert.equal((await list(e,'assistant-2')).unread,1);assert.equal((await list(e,'viewer')).items.length,0);assert.equal((await list(e,'admin')).unread,0);
  assert.equal((await list(e,'admin')).pending,1);assert.equal((await e.DB.prepare('SELECT status FROM web_changes WHERE id=?').bind(original.id).first()).status,'pending');
  assert.equal(await count(e,'event_proposal_approvals'),0);
 }finally{e.DB.close();}
});
test('retry and second device retain one timestamp and push event; reading a receipt does not send another',async()=>{
 const e=env();try{
  const original=await create(e);await read(e,'admin',original);
  const first=(await list(e,'assistant-1')).items.find(i=>i.kind==='notification_read');
  const eventCount=await count(e,'mobile_push_events');
  assert.equal((await read(e,'admin',original)).alreadyNotified,true);await read(e,'admin',original,'second-device');
  assert.equal(await receipts(e),1);assert.equal(await count(e,'mobile_push_events'),eventCount);
  assert.equal((await list(e,'assistant-1')).items.find(i=>i.kind==='notification_read').createdAt,first.createdAt);
  const result=await read(e,'assistant-1',first);assert.equal(result.notified,false);assert.equal(await receipts(e),1);
  await dismissNotification(req({id:first.id,version:first.version}),e,'assistant','assistant-1:a','assistant-1');
  await read(e,'admin',original);assert.equal((await list(e,'assistant-1')).items.some(i=>i.kind==='notification_read'),false);
  assert.equal((await list(e,'assistant-1','second-device')).items.some(i=>i.kind==='notification_read'),true);
 }finally{e.DB.close();}
});
test('requester reads notify the approver; old records use configured request-handling accounts',async()=>{
 const e=env();try{
  const original=await create(e);await read(e,'assistant-1',original);
  assert.equal((await list(e,'admin')).items.find(i=>i.kind==='notification_read').receipt.readerLabel,'ทีมผู้ขออนุมัติ');
  assert.equal((await list(e,'assistant-1')).items.filter(i=>i.kind==='notification_read').length,0);
  const old=await create(e,{entity:'contract:legacy',kind:'contract_updated',payload:{branch:'สาขาทดสอบ'}});await read(e,'admin',old);
  for(const user of ['assistant-1','assistant-2','business-development-1'])assert((await list(e,user)).items.some(i=>i.kind==='notification_read'&&i.entity==='contract:legacy'));
  assert.equal((await list(e,'assistant-3')).items.filter(i=>i.kind==='notification_read').length,0);
 }finally{e.DB.close();}
});
test('decision and deletion receipts recover the original requester and keep valid links',async()=>{
 const e=env();try{
  await create(e);
  await create(e,{kind:'proposal_decision',payload:{trade:'รออนุมัติ'}});
  const decision=await create(e,{kind:'proposal_decision',payload:{trade:'อนุมัติ'},status:'approved'});await read(e,'admin',decision);
  assert((await list(e,'assistant-1')).items.some(i=>i.kind==='notification_read'));assert.equal((await list(e,'assistant-2')).items.filter(i=>i.kind==='notification_read').length,0);
  await create(e,{entity:'web:deleted'});
  const deletion=await create(e,{entity:'web:deleted',kind:'proposal_deleted',payload:{submittedBy:account('admin')}});await read(e,'admin',deletion);
  assert.equal((await list(e,'assistant-1')).items.find(i=>i.kind==='notification_read'&&i.entity==='web:deleted').url,'/event-proposals');
 }finally{e.DB.close();}
});
test('HTTP binds reader and recipients to session, and protects receipt read/dismiss and origin',async()=>{
 const e=env();try{
  const original=await create(e),body={items:[{id:original.id,version:original.version}],userId:'assistant-2',recipients:['viewer']};
  assert.equal((await http(e,'viewer','/api/notifications/read',body)).status,404);
  assert.equal((await http(e,'admin','/api/notifications/read',body,{origin:'https://evil.test'})).status,403);
  assert.equal((await http(e,'admin','/api/notifications/read',{items:[{id:original.id,version:'pending:stale'}]})).status,409);
  assert.equal((await http(e,'admin','/api/notifications/read',body)).status,200);
  const received=await(await http(e,'assistant-1','/api/notifications')).json(),receipt=received.items.find(i=>i.kind==='notification_read');assert(receipt);
  for(const user of ['assistant-2','viewer','admin']){
   const data=await(await http(e,user,'/api/notifications')).json();assert.equal(data.items.some(i=>i.id===receipt.id),false);
   assert.equal((await http(e,user,'/api/notifications/read',{items:[{id:receipt.id,version:receipt.version}]})).status,404);
   assert.equal((await http(e,user,'/api/notifications/dismiss',{id:receipt.id,version:receipt.version})).status,404);
  }
  assert.equal((await http(e,'assistant-1','/api/notifications/read',{items:[{id:receipt.id,version:receipt.version}]})).status,200);
  assert.equal(await receipts(e),1);
 }finally{e.DB.close();}
});
test('changed versions send a fresh receipt; stale and superseded records do not',async()=>{
 const e=env();try{
  const original=await create(e);await read(e,'admin',original);
  await e.DB.prepare("UPDATE web_changes SET status='approved',decided_at=? WHERE id=?").bind('2026-10-01T12:00:00.000Z',original.id).run();
  await assert.rejects(read(e,'admin',original),{status:409});assert.equal(await receipts(e),1);
  const updated=(await list(e,'admin')).items.find(i=>i.id===original.id);await read(e,'admin',updated);assert.equal(await receipts(e),2);
  await e.DB.prepare("UPDATE web_changes SET status='superseded' WHERE id=?").bind(original.id).run();await assert.rejects(read(e,'admin',updated),{status:404});
 }finally{e.DB.close();}
});
test('transaction failure saves neither read state nor receipt/push; racing source change returns conflict',async()=>{
 const e=env();try{
  const original=await create(e),batch=e.DB.batch.bind(e.DB),initialPush=await count(e,'mobile_push_events');
  const collision=()=>e.DB.prepare("INSERT INTO notification_reads VALUES ('collision','test','test','test')");
  e.DB.batch=queries=>batch([...queries,collision(),collision()]);
  await assert.rejects(read(e,'admin',original));assert.equal(await receipts(e),0);assert.equal(await count(e,'notification_reads'),0);assert.equal(await count(e,'mobile_push_events'),initialPush);
  e.DB.batch=async queries=>{await e.DB.prepare("UPDATE web_changes SET status='superseded' WHERE id=?").bind(original.id).run();return batch(queries);};
  const second=await create(e,{entity:'web:second'});
  await assert.rejects(readNotifications(req({items:[original,second].map(i=>({id:i.id,version:i.version}))}),e,'admin','admin:a',account('admin')),{status:409});assert.equal(await receipts(e),0);assert.equal(await count(e,'notification_reads'),0);
 }finally{e.DB.close();}
});
test('receipt pagination and unread totals use the same account audience',async()=>{
 const e=env();try{
  for(let i=0;i<27;i++){const item=await create(e);await read(e,'admin',item);}
  const first=await list(e,'assistant-1');assert.equal(first.items.length,50);assert.equal(first.unread,54);
  const second=await list(e,'assistant-1','a',first.nextCursor);assert.equal(second.items.length,4);assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,54);
  const unrelated=await list(e,'assistant-2');assert.equal(unrelated.items.length,27);assert.equal(unrelated.unread,27);assert.equal(unrelated.nextCursor,null);
 }finally{e.DB.close();}
});
test('push receipt reaches only subscribed recipients; actor, unrelated account and viewer get nothing',async()=>{
 const e=env();try{
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  Object.assign(e,{WEB_PUSH_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.privateKey)),WEB_PUSH_PUBLIC_KEY:pushBase64(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),WEB_PUSH_SUBJECT:origin});
  const original=await create(e),users=['admin','assistant-1','assistant-2','viewer'];
  for(const [i,user] of users.entries()){
   const subscription={endpoint:'https://web.push.apple.com/ReceiptTestOnly'+i,keys:{p256dh:'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',auth:'BTBZMqHH6r4Tts7J_aSIgg'}};
   const request=new Request(origin+'/api/mobile-push',{method:'POST',headers:{origin,'content-type':'application/json',cookie:'ving_reader=00000000-0000-4000-8000-00000000000'+i},body:JSON.stringify({subscription})});
   assert.equal((await handleMobilePush(request,e,account(user))).status,200);
  }
  await read(e,'admin',original);const sent=[],send=async url=>{sent.push(url);return new Response(null,{status:201});};
  await dispatchMobilePush(e,send);assert.deepEqual(sent,['https://web.push.apple.com/ReceiptTestOnly1']);
  await read(e,'admin',original,'second-device');await dispatchMobilePush(e,send);assert.equal(sent.length,1);
 }finally{e.DB.close();}
});
