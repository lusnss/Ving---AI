import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareEventRequest,createEventRequest,updateEventRequest,listEventRequests} from './event-requests.mjs';
import {previewDatabase} from './preview-db.mjs';
import {eventProposalDetail} from './event-proposal-deletions.mjs';
import {proposalsMarkup} from './out/assets/event-proposals.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';
import worker from './dist/server/index.js';
const dataset={records:[],source:{}};
const makeBody=()=>({id:crypto.randomUUID(),place:'พื้นที่ทดสอบการแก้ไข',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-03',input:{mode:'manual',salesMode:'cost-target',channel:'direct',days:3,cogs:20,rent:3000,gp:0,pc:500,shipping:100,other:0,targetMode:'roi',target:'',expectedSales:'',downside:10,upside:10,area:12,pcCount:2,pcCostMode:'person',proposalDate:'2026-09-21',confirmBy:'2026-09-30',floor:'G',eventTypes:['Sports Mall','CDS RBS'],eventMonth:'2026-10'}});
const request=(body,method='PATCH',origin='https://example.test')=>new Request('https://example.test/api/event-requests',{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
test('planning fields validate choices, preserve legacy records, and survive create/reload/edit without duplicates',async()=>{
 const env={DB:previewDatabase()};try{
 const body=makeBody();await createEventRequest(request(body,'POST'),env,dataset);
 const original=(await listEventRequests(env)).items[0];assert.equal(original.floor,'G');assert.equal(original.month,'2026-10');assert.deepEqual(original.eventTypes,['CDS RBS','Sports Mall']);
 const key='web:'+body.id;
 await env.DB.prepare('INSERT INTO event_proposal_approvals (id,trade,ceo,updated_at) VALUES (?,?,?,?)').bind(key,'อนุมัติ','อนุมัติ',original.createdAt).run();
 const edit={...body,revision:original.createdAt,editToken:crypto.randomUUID(),input:{...body.input,floor:'5',eventMonth:'2026-11',eventTypes:['Sport World'],rent:6000}};
 const result=await updateEventRequest(request(edit),env,dataset);assert.equal(result.id,body.id);
 const saved=(await eventProposalDetail(env,key)).item;
 assert.equal(saved.floor,'5');assert.equal(saved.month,'2026-11');assert.deepEqual(saved.eventTypes,['Sport World']);assert.equal(saved.createdAt,original.createdAt);assert.ok(saved.updatedAt);
 assert.equal(saved.trade,'รออนุมัติ');assert.equal(saved.ceo,'รออนุมัติ');assert.notEqual(saved.sales,original.sales);
 assert.equal((await listEventRequests(env)).items.length,1);
 // An uncertain response can be retried without clearing approvals that arrived after the edit.
 await env.DB.prepare('INSERT INTO event_proposal_approvals (id,trade,updated_at) VALUES (?,?,?)').bind(key,'อนุมัติ',saved.updatedAt).run();
 assert.equal((await updateEventRequest(request(edit),env,{records:[]})).id,body.id);
 assert.equal((await eventProposalDetail(env,key)).item.trade,'อนุมัติ');
 await assert.rejects(()=>updateEventRequest(request({...edit,editToken:crypto.randomUUID(),input:{...edit.input,floor:'2'}}),env,dataset),{status:409});
 const html=proposalsMarkup({items:[saved],permissions:{canEdit:true}},['place','eventTypes','month','actions']);assert.match(html,/แก้ไขข้อเสนอ/);assert.match(html,/Sport World/);assert.match(html,/พฤศจิกายน/);
 assert.match(reviewMarkup(saved,{},1,true),/แก้ไขข้อเสนอ/);assert.doesNotMatch(reviewMarkup(saved,{},1,false),/แก้ไขข้อเสนอ/);
 }finally{env.DB.close();}
});
test('invalid metadata, deleted records and invalid revisions cannot overwrite proposals',async()=>{
 const body=makeBody();
 for(const input of [{floor:'6'},{eventMonth:'2026-13'},{eventTypes:['Other']},{eventTypes:'Sport World'}])assert.throws(()=>prepareEventRequest({...body,input:{...body.input,...input}},dataset),{status:400});
 const legacy={...body,input:{...body.input}};delete legacy.input.floor;delete legacy.input.eventTypes;delete legacy.input.eventMonth;
 assert.equal(prepareEventRequest(legacy,dataset).floor,'');
 const env={DB:previewDatabase()};try{
 await createEventRequest(request(body,'POST'),env,dataset);const original=(await listEventRequests(env)).items[0];
 const edit={...body,revision:original.createdAt,editToken:crypto.randomUUID(),input:{...body.input,floor:'2'}};
 await assert.rejects(()=>updateEventRequest(request(edit,'PATCH','https://attacker.test'),env,dataset),{status:403});
 await env.DB.prepare('INSERT INTO event_proposal_deletions VALUES (?,?)').bind('web:'+body.id,original.createdAt).run();
 await assert.rejects(()=>updateEventRequest(request(edit),env,dataset),{status:404});
 assert.equal(JSON.parse((await env.DB.prepare('SELECT payload FROM event_requests WHERE id=?').bind(body.id).first()).payload).floor,'G');
 }finally{env.DB.close();}
});
test('worker rejects anonymous and viewer edits before calculation or storage',async()=>{
 const env={SESSION_SECRET:'local-test-secret',ADMIN_PASSWORD:'local-admin',VIEWER_PASSWORD:'local-viewer'};
 assert.equal((await worker.fetch(request(makeBody()),env)).status,401);
 const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:'local-viewer'})}),env);
 const req=request(makeBody());req.headers.set('cookie',login.headers.get('set-cookie').split(';')[0]);
 assert.equal((await worker.fetch(req,env)).status,403);
});
