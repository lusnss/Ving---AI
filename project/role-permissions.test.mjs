import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {requesterMarkup} from './out/assets/notifications.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {proposalsMarkup} from './out/assets/event-proposals.mjs';
import {render as renderSettings} from './out/assets/settings.mjs';

// Capture offline loaders so permission tests never contact the source sheets.
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('Offline permission fixture');};
const {default:worker}=await import('./dist/server/index.js?role-permissions');
globalThis.fetch=originalFetch;
const snapshot={data:{'/api/contracts':{items:[{branch:'สาขาทดสอบ',term:'1 ปี',starts_on:'2026-01-01',ends_on:'2026-12-31',renewed:false,status:'ปกติ'}],summary:{},source:{}}}};
const auth={BUSINESS_DEVELOPMENT_PASSWORD:'test-business-development',SESSION_SECRET:'permission-tests-session-secret',ADMIN_PASSWORD:'test-admin',VIEWER_PASSWORD:'test-viewer',ASSISTANT_PASSWORD_1:'test-assistant-one',ASSISTANT_PASSWORD_2:'test-assistant-two',ASSISTANT_PASSWORD_3:'test-assistant-three',ASSISTANT_NAME_1:'ผู้ใช้ทดสอบ ก',ASSISTANT_NAME_2:'ผู้ใช้ทดสอบ ข',ASSISTANT_NAME_3:'ผู้ใช้ทดสอบ ค'};
const env=()=>({...auth,DB:previewDatabase(),BUCKET:{get:async key=>{
 const value=key==='snapshot.json'?snapshot:key==='event-predict-v3.json'?{version:3,records:[],source:{}}:key==='event-proposals.json'?{version:1,source:{status:'online',fetched_at:new Date().toISOString()},items:[{place:'พื้นที่จากชีต',dates:'1-3.10.26',trade:'รออนุมัติ',ceo:''}]}:null;
 return value?{json:async()=>structuredClone(value)}:null;
}}});
const request=(path,cookie,method='GET',body,origin='https://example.test')=>new Request('https://example.test'+path,{method,headers:{cookie:cookie||'',origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const call=(e,path,cookie,method='GET',body,origin)=>worker.fetch(request(path,cookie,method,body,origin),e);
async function login(e,password){const response=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),e);assert.equal(response.status,303);return response.headers.get('set-cookie')?.split(';')[0];}
async function get(e,path,cookie){const response=await call(e,path,cookie);assert.equal(response.status,200);return response.json();}
const proposal=()=>({id:crypto.randomUUID(),place:'พื้นที่ทดสอบสิทธิ์',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-03',trade:'อนุมัติ',ceo:'อนุมัติ',input:{mode:'manual',salesMode:'cost-target',channel:'direct',days:3,cogs:20,rent:3000,gp:0,pc:500,shipping:100,other:0,targetMode:'roi',target:'',expectedSales:'',downside:10,upside:10,area:12,pcCount:2,pcCostMode:'person',proposalDate:'2026-09-23',confirmBy:'2026-09-30',floor:'G',eventTypes:['Sports Mall'],eventMonth:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ'}});

test('all six credentials have the requested capabilities and position labels',async()=>{
 const e=env();try{
 for(const [key,role,label,canEdit,canApprove] of [
  ['ADMIN_PASSWORD','admin','Trade Manager',true,true],
  ['VIEWER_PASSWORD','viewer','บุคคลทั่วไป',false,false],
  ['BUSINESS_DEVELOPMENT_PASSWORD','assistant','Business Development',true,false],
  ...[1,2,3].map(i=>['ASSISTANT_PASSWORD_'+i,'assistant','Assistant Trade Manager',true,false])
 ]){
  const cookie=await login(e,e[key]);assert.ok(cookie);
  assert.deepEqual(await get(e,'/api/session',cookie),{role,label,team:key.startsWith('ASSISTANT_')?'ทีมห้าง':null,userId:key==='BUSINESS_DEVELOPMENT_PASSWORD'?'business-development-1':role==='assistant'?'assistant-'+key.slice(-1):role,userName:key.startsWith('ASSISTANT_')?e['ASSISTANT_NAME_'+key.slice(-1)]:label,canEdit,canApprove});
  const data=await get(e,'/api/event-proposals',cookie);
  assert.deepEqual(data.permissions,{canEdit,canApprove});
  const markup=proposalsMarkup(data);
  assert.equal(markup.includes('data-delete-proposal='),canEdit);
  assert.equal(markup.includes('data-approve-proposal='),canApprove);
  assert.equal((await get(e,'/api/contracts',cookie)).permissions.canEdit,canEdit);
  const html=await(await call(e,'/settings',cookie)).text();
  assert.ok(html.includes('data-access-role="'+role+'"'));assert.ok(html.includes(label));if(key.startsWith('ASSISTANT_'))assert.ok(html.includes('ทีมห้าง'));
  for(const [key,secret] of Object.entries(auth))if(!key.includes('_NAME_'))assert.ok(!html.includes(secret));
  const previousDocument=globalThis.document;try{globalThis.document={body:{dataset:{accessRole:role,accessPosition:label,accessTeam:key.startsWith('ASSISTANT_')?'ทีมห้าง':''}}};const root={};await renderSettings(root);assert.ok(root.innerHTML.includes(label));}finally{globalThis.document=previousDocument;}
 }
 }finally{e.DB.close();}
});

for(const account of ['ASSISTANT_PASSWORD_1','BUSINESS_DEVELOPMENT_PASSWORD']){
test(account+': assistant creates, edits and deletes events; cannot decide either approval column or notification',async()=>{
 const e=env();try{
 const assistant=await login(e,e[account]),admin=await login(e,auth.ADMIN_PASSWORD),viewer=await login(e,auth.VIEWER_PASSWORD),body=proposal();
 const created=await call(e,'/api/event-requests',assistant,'POST',body);assert.equal(created.status,201,await created.text());
 const key='web:'+body.id;
 let detail=await get(e,'/api/event-proposals/detail?key='+encodeURIComponent(key),assistant);
 assert.equal(detail.item.trade,'รออนุมัติ');assert.equal(detail.item.ceo,'รออนุมัติ');
 assert.deepEqual(detail.permissions,{canEdit:true,canApprove:false});
 assert.equal(detail.item.submittedBy.userId,account==='BUSINESS_DEVELOPMENT_PASSWORD'?'business-development-1':'assistant-1');
 assert.equal((await call(e,'/api/promotions/approval',assistant,'POST',{id:'test',expectedVersion:1})).status,403);
 for(const field of ['trade','ceo'])for(const status of ['อนุมัติ','ไม่อนุมัติ','รออนุมัติ']){
  for(const candidateKey of [key,(await get(e,'/api/event-proposals',assistant)).items.find(row=>row.source!=='web').deletionKey]){
   assert.equal((await call(e,'/api/event-proposals/approval',assistant,'PATCH',{key:candidateKey,field,status,role:'admin',canApprove:true})).status,403);
  }
 }
 assert.equal((await call(e,'/api/event-proposals/approval',assistant,'DELETE',{})).status,403);
 const notice=(await get(e,'/api/notifications',assistant)).items[0];assert.equal(notice.status,'pending');
 assert.equal((await get(e,'/api/notifications',assistant)).canApprove,false);
 assert.equal((await call(e,'/api/notifications/decision',assistant,'PATCH',{id:notice.id,status:'approved'})).status,403);
 assert.equal((await get(e,'/api/notifications',viewer)).items.length,0);
 for(const field of ['trade','ceo'])assert.equal((await call(e,'/api/event-proposals/approval',admin,'PATCH',{key,field,status:'อนุมัติ',revision:detail.item.createdAt})).status,200);
 const edit={...body,revision:detail.item.createdAt,editToken:crypto.randomUUID(),input:{...body.input,rent:6000}};
 assert.equal((await call(e,'/api/event-requests',assistant,'PATCH',edit,'https://elsewhere.test')).status,403);
 const edited=await call(e,'/api/event-requests',assistant,'PATCH',edit);assert.equal(edited.status,200,await edited.text());
 detail=await get(e,'/api/event-proposals/detail?key='+encodeURIComponent(key),assistant);
 assert.equal(detail.item.input.rent,6000);assert.equal(detail.item.trade,'รออนุมัติ');assert.equal(detail.item.ceo,'รออนุมัติ');
 assert.equal(await e.DB.prepare('SELECT id FROM event_proposal_approvals WHERE id=?').bind(key).first(),null);
 assert.equal((await call(e,'/api/event-proposals/'+key,assistant,'DELETE')).status,200);
 assert.equal((await call(e,'/api/event-proposals/detail?key='+encodeURIComponent(key),assistant)).status,404);
 }finally{e.DB.close();}
});
}

for(const account of ['ASSISTANT_PASSWORD_2','BUSINESS_DEVELOPMENT_PASSWORD']){
test(account+': assistant contract edits queue approval; only CEO can approve or reject them',async()=>{
 const e=env();try{
 const assistant=await login(e,e[account]),admin=await login(e,auth.ADMIN_PASSWORD),viewer=await login(e,auth.VIEWER_PASSWORD);
 const item=(await get(e,'/api/contracts',assistant)).items[0];
 const values=Object.fromEntries(['branch','term','starts_on','ends_on','renewed','status'].map(key=>[key,item[key]]));
 const body={key:item.key,revision:item.revision,sourceHash:item.sourceHash,changeId:crypto.randomUUID().replaceAll('-',''),values:{...values,term:'2 ปี',ends_on:'2027-12-31'}};
 assert.equal((await call(e,'/api/contracts',viewer,'PATCH',body)).status,403);
 const result=await call(e,'/api/contracts',assistant,'PATCH',body);assert.equal(result.status,200,await result.text());
 assert.equal((await get(e,'/api/contracts',assistant)).items[0].term,'2 ปี');
 const notices=await get(e,'/api/notifications',assistant),notice=notices.items[0];
 assert.equal(notice.kind,'contract_updated');assert.equal(notice.status,'pending');assert.ok(notice.before);assert.equal(notice.after.term,'2 ปี');
 assert.equal((await call(e,'/api/notifications/read',assistant,'POST',{items:[{id:notice.id,version:notice.version}]})).status,200);
 assert.equal((await get(e,'/api/notifications',assistant)).unread,0);
 for(const status of ['approved','rejected'])assert.equal((await call(e,'/api/notifications/decision',assistant,'PATCH',{id:notice.id,status})).status,403);
 assert.equal((await call(e,'/api/notifications/decision',admin,'PATCH',{id:notice.id,status:'approved'})).status,200);
 assert.equal((await get(e,'/api/notifications',viewer)).items[0].status,'approved');
 }finally{e.DB.close();}
});
}

test('viewer cannot mutate shared data; assistant cannot forge admin; old and expired sessions rejected',async()=>{
 const e=env();try{
 const viewer=await login(e,auth.VIEWER_PASSWORD),assistant=await login(e,auth.ASSISTANT_PASSWORD_3);
 for(const [path,method] of [['/api/event-requests','POST'],['/api/event-requests','PATCH'],['/api/contracts','PATCH'],['/api/event-proposals/web:'+crypto.randomUUID(),'DELETE'],['/api/event-proposals/approval','PATCH'],['/api/notifications/decision','PATCH']]){
  assert.equal((await call(e,path,viewer,method,{})).status,403);
  assert.equal((await call(e,path,'',method,{})).status,401);
 }
 assert.equal((await call(e,'/api/session',assistant.replace('.assistant.','.admin.'))).status,401);
 const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(e.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 for(const payload of ['v2.admin.'+(Math.floor(Date.now()/1000)+3600),'v3.admin.'+(Math.floor(Date.now()/1000)+3600),'v4.assistant.assistant-1.'+(Math.floor(Date.now()/1000)-1),'v4.admin.assistant-1.'+(Math.floor(Date.now()/1000)+3600),'v4.owner.owner.'+(Math.floor(Date.now()/1000)+3600)]){
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(payload))).toString('base64url');
  assert.equal((await call(e,'/api/session','ving_session='+payload+'.'+signature)).status,401);
 }
 for(const password of ['', 'wrong-password'])assert.equal(await login(e,password),undefined);
 assert.equal(await login({...e,ASSISTANT_PASSWORD_1:e.ADMIN_PASSWORD},e.ADMIN_PASSWORD),undefined);
 const withoutAssistants={...e,ASSISTANT_PASSWORD_1:undefined,ASSISTANT_PASSWORD_2:undefined,ASSISTANT_PASSWORD_3:undefined};
 assert.equal(await login(withoutAssistants,''),undefined);assert.ok(await login(withoutAssistants,e.ADMIN_PASSWORD));
 assert.equal((await call(e,'/logout',assistant,'POST')).status,303);
 }finally{e.DB.close();}
});

test('requester identity is signed, cannot be spoofed, survives reload, and follows each resubmission',async()=>{
 const directory=mkdtempSync(path.join(os.tmpdir(),'ving-requester-'));
 const e=env();e.DB.close();e.DB=previewDatabase(path.join(directory,'requests.sqlite'),{includeSeedData:false});
 try{
  const admin=await login(e,e.ADMIN_PASSWORD),cookies=[],bodies=[];
  for(let index=1;index<=3;index++){
   const cookie=await login(e,e['ASSISTANT_PASSWORD_'+index]);cookies.push(cookie);
   const actor={userId:'assistant-'+index,name:e['ASSISTANT_NAME_'+index],role:'assistant'};
   const body={...proposal(),submittedBy:{userId:'admin',name:'forged',role:'admin'},createdBy:{name:'forged'},userName:'forged'};bodies.push(body);
   const response=await call(e,'/api/event-requests',cookie,'POST',body);assert.equal(response.status,201,await response.text());
   const item=(await get(e,'/api/event-proposals/detail?key='+encodeURIComponent('web:'+body.id),admin)).item;
   assert.deepEqual(item.submittedBy,actor);assert.deepEqual(item.createdBy,actor);
   const notice=(await get(e,'/api/notifications',admin)).items.find(row=>row.entity==='web:'+body.id);
   assert.deepEqual(notice.submittedBy,actor);assert.ok(requesterMarkup(notice).includes(actor.name));
   assert.ok(!proposalsMarkup({items:[item],permissions:{canEdit:true,canApprove:true}}).includes(actor.name));
   assert.ok(reviewMarkup(item).includes(actor.name));
   const html=await(await call(e,'/settings',cookie)).text();assert.ok(html.includes('data-access-user-name="'+actor.name+'"'));
   assert.equal((await call(e,'/api/session',cookie.replace('.assistant-'+index+'.','.assistant-'+(index===3?1:3)+'.'))).status,401);
  }
  const key='web:'+bodies[0].id;
  let item=(await get(e,'/api/event-proposals/detail?key='+encodeURIComponent(key),admin)).item;
  const edited=await call(e,'/api/event-requests',cookies[1],'PATCH',{...bodies[0],revision:item.createdAt,editToken:crypto.randomUUID(),input:{...bodies[0].input,rent:5000}});
  assert.equal(edited.status,200,await edited.text());
  item=(await get(e,'/api/event-proposals/detail?key='+encodeURIComponent(key),admin)).item;
  assert.equal(item.createdBy.name,e.ASSISTANT_NAME_1);assert.equal(item.submittedBy.name,e.ASSISTANT_NAME_2);
  const latest=(await get(e,'/api/notifications',admin)).items.find(row=>row.entity===key&&row.kind==='proposal_updated');
  assert.equal(latest.submittedBy.name,e.ASSISTANT_NAME_2);assert.equal(latest.before.submittedBy.name,e.ASSISTANT_NAME_1);
  // One assistant reading on a shared browser does not mark another assistant's inbox read.
  assert.equal((await call(e,'/api/notifications/read',cookies[0],'POST',{items:[{id:latest.id,version:latest.version}]})).status,200);
  assert.equal((await get(e,'/api/notifications',cookies[0])).items.find(row=>row.id===latest.id).read,true);
  assert.equal((await get(e,'/api/notifications',cookies[1])).items.find(row=>row.id===latest.id).read,false);
  e.DB.close();e.DB=previewDatabase(path.join(directory,'requests.sqlite'),{includeSeedData:false});
  item=(await get(e,'/api/event-proposals/detail?key='+encodeURIComponent(key),admin)).item;
  assert.equal(item.submittedBy.name,e.ASSISTANT_NAME_2);
  assert.equal((await get({...e,ASSISTANT_NAME_2:'ชื่อใหม่'},'/api/event-proposals/detail?key='+encodeURIComponent(key),admin)).item.submittedBy.name,e.ASSISTANT_NAME_2);
  assert.equal((await call(e,'/api/event-proposals/'+key,cookies[2],'DELETE')).status,200);
  assert.equal((await call(e,'/api/event-proposals/'+key,cookies[1],'DELETE')).status,200);
  const deleted=(await get(e,'/api/notifications',admin)).items.find(row=>row.entity===key&&row.kind==='proposal_deleted');
  assert.equal(deleted.submittedBy.name,e.ASSISTANT_NAME_3);
 }finally{e.DB.close();rmSync(directory,{recursive:true,force:true});}
});

test('contract approval requester is the signed user; old records remain unattributed and names are escaped',async()=>{
 const e=env();try{
  const assistant=await login(e,e.ASSISTANT_PASSWORD_3),admin=await login(e,e.ADMIN_PASSWORD);
  const item=(await get(e,'/api/contracts',assistant)).items[0];
  const values=Object.fromEntries(['branch','term','starts_on','ends_on','renewed','status'].map(key=>[key,item[key]]));
  const body={key:item.key,revision:item.revision,sourceHash:item.sourceHash,changeId:crypto.randomUUID().replaceAll('-',''),values:{...values,term:'2 ปี'},submittedBy:{name:'forged'}};
  const response=await call(e,'/api/contracts',assistant,'PATCH',body);assert.equal(response.status,200,await response.text());
  const notice=(await get(e,'/api/notifications',admin)).items.find(row=>row.entity===item.key);
  assert.equal(notice.submittedBy.name,e.ASSISTANT_NAME_3);assert.equal(notice.after.submittedBy.userId,'assistant-3');
  assert.equal((await call(e,'/api/notifications/decision',assistant,'PATCH',{id:notice.id,status:'approved'})).status,403);
  const oldId=crypto.randomUUID();await e.DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind(oldId,new Date().toISOString(),JSON.stringify({id:oldId,source:'web',place:'ข้อเสนอเดิม'})).run();
  const old=(await get(e,'/api/notifications',admin)).items.find(row=>row.entity==='web:'+oldId);
  assert.equal(old.submittedBy,null);assert.ok(requesterMarkup(old).includes('ไม่ได้บันทึกชื่อ'));
  const hostile='<img src=x onerror=alert(1)>';
  assert.ok(requesterMarkup({kind:'proposal_created',submittedBy:{name:hostile}}).includes('&lt;img'));assert.ok(!requesterMarkup({kind:'proposal_created',submittedBy:{name:hostile}}).includes('<img'));
  const hostileEnv={...e,ASSISTANT_NAME_3:hostile};
  const html=await(await call(hostileEnv,'/settings',assistant)).text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes(hostile));
 }finally{e.DB.close();}
});

test('Business Development has separate drafts and signed identity, and cannot impersonate the department team',async()=>{
 const e=env();try{
  const business=await login(e,e.BUSINESS_DEVELOPMENT_PASSWORD),department=await login(e,e.ASSISTANT_PASSWORD_1);
  assert.equal((await call(e,'/api/session',business.replace('.business-development-1.','.assistant-1.'))).status,401);
  assert.equal((await call(e,'/api/session',business.replace('.assistant.','.admin.'))).status,401);
  const endpoint='/api/workspace-drafts?scope=%2Fevent-predict';
  const saved=await call(e,endpoint,business,'PUT',{saveId:crypto.randomUUID(),revision:null,payload:{version:1,place:'ร่างของฝ่ายพัฒนาธุรกิจ'}});
  assert.equal(saved.status,200,await saved.text());
  assert.equal((await get(e,endpoint,business)).draft.payload.place,'ร่างของฝ่ายพัฒนาธุรกิจ');
  assert.equal((await get(e,endpoint,department)).draft,null);
  assert.equal(await login({...e,BUSINESS_DEVELOPMENT_PASSWORD:undefined},e.BUSINESS_DEVELOPMENT_PASSWORD),undefined);
  assert.equal(await login({...e,BUSINESS_DEVELOPMENT_PASSWORD:e.ASSISTANT_PASSWORD_1},e.ASSISTANT_PASSWORD_1),undefined);
 }finally{e.DB.close();}
});
