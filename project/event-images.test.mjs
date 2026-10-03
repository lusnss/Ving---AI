import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {createEventRequest, updateEventRequest, listEventRequests} from './event-requests.mjs';
import {uploadEventImage, readEventImage, resolveEventImages, eventImageIds} from './event-images.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';
import {proposalsMarkup} from './out/assets/event-proposals.mjs';
import worker from './dist/server/index.js';

const origin = 'https://example.test';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
const dataset = {records:[],source:{}};
function bucket() {
 const objects = new Map();
 return {
  async put(key, bytes, options) { objects.set(key, {bytes:bytes.slice(),size:bytes.length,...options}); },
  async head(key) { return objects.get(key) || null; },
  async get(key) { const value = objects.get(key); return value ? {...value,body:value.bytes.slice()} : null; },
 };
}
const makeEnv = () => ({DB:previewDatabase(), BUCKET:bucket(),SESSION_SECRET:'local-test-secret',ADMIN_PASSWORD:'admin-test',VIEWER_PASSWORD:'viewer-test',ASSISTANT_PASSWORD_1:'assistant-test'});
const makeBody = () => ({id:crypto.randomUUID(),place:'พื้นที่ทดสอบรูป',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-03',input:{mode:'manual',salesMode:'cost-target',channel:'direct',days:3,cogs:20,rent:3000,gp:0,pc:500,shipping:100,other:0,targetMode:'roi',target:'',expectedSales:'',downside:10,upside:10,area:12,pcCount:2,pcCostMode:'person',proposalDate:'2026-09-21',confirmBy:'2026-09-30',floor:'G',eventTypes:['Sports Mall'],eventMonth:'2026-10'}});
const imageRequest = (id, body=png, type='image/png', cookie='', from=origin) => new Request(origin+'/api/event-images/'+id, {method:'POST',headers:{origin:from,'content-type':type,cookie},body});
const proposalRequest = (body,method='POST') => new Request(origin+'/api/event-requests',{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const savedRecord = async env => (await listEventRequests(env)).items[0];
async function login(env,password) { const res=await worker.fetch(new Request(origin+'/login',{method:'POST',body:new URLSearchParams({password})}),env);return res.headers.get('set-cookie').split(';')[0]; }

test('images persist across create, reload, edit and retry; edits reset approvals; removed images cannot be read', async () => {
 const env=makeEnv();
 try {
  const body=makeBody(), first=await uploadEventImage(imageRequest(body.id),env,body.id);
  await assert.rejects(()=>readEventImage(env,body.id,first.id),{status:404});
  body.attachments=[first.id];
  await createEventRequest(proposalRequest(body),env,dataset);
  let row=await savedRecord(env);
  assert.deepEqual(row.attachments,[first]);
  assert.match(reviewMarkup(row),/รูปประกอบการพิจารณา/);
  assert.match(proposalsMarkup({items:[row]}),/1 รูป/);assert.match(proposalsMarkup({items:[row]}),/data-proposal-details/);
  const image=await readEventImage(env,body.id,first.id);
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
  assert.equal(image.headers.get('cache-control'),'private, no-store');
  assert.equal(image.headers.get('x-content-type-options'),'nosniff');
  await createEventRequest(proposalRequest(body),env,dataset);
  await assert.rejects(()=>createEventRequest(proposalRequest({...body,attachments:[]}),env,dataset),{status:409});
  const second=await uploadEventImage(imageRequest(body.id),env,body.id);
  await env.DB.prepare('INSERT INTO event_proposal_approvals (id,trade,ceo,updated_at) VALUES (?,?,?,?)').bind('web:'+body.id,'อนุมัติ','อนุมัติ',row.createdAt).run();
  const edit={...body,attachments:[second.id],revision:row.createdAt,editToken:crypto.randomUUID()};
  await updateEventRequest(proposalRequest(edit,'PATCH'),env,dataset);
  row=await savedRecord(env);
  assert.deepEqual(row.attachments,[second]);
  assert.equal(await env.DB.prepare('SELECT id FROM event_proposal_approvals WHERE id=?').bind('web:'+body.id).first(),null);
  await assert.rejects(()=>readEventImage(env,body.id,first.id),{status:404});
  assert.equal((await readEventImage(env,body.id,second.id,'HEAD')).body,null);
  await updateEventRequest(proposalRequest(edit,'PATCH'),env,dataset);
  await assert.rejects(()=>updateEventRequest(proposalRequest({...edit,attachments:[]},'PATCH'),env,dataset),{status:409});
  const legacyEdit={...body,revision:row.updatedAt,editToken:crypto.randomUUID()};delete legacyEdit.attachments;
  await updateEventRequest(proposalRequest(legacyEdit,'PATCH'),env,dataset);
  assert.deepEqual((await savedRecord(env)).attachments,[second]);
  row=await savedRecord(env);
  await updateEventRequest(proposalRequest({...body,attachments:[],revision:row.updatedAt,editToken:crypto.randomUUID()},'PATCH'),env,dataset);
  assert.deepEqual((await savedRecord(env)).attachments,[]);
  assert.equal((await listEventRequests(env)).items.length,1);
 } finally {env.DB.close();}
});

test('unuploaded, cross-proposal, duplicate and excessive attachment references are rejected', async () => {
 const env=makeEnv();
 try {
  const body=makeBody(), image=await uploadEventImage(imageRequest(body.id),env,body.id);
  for (const attachments of [[crypto.randomUUID()],Array(7).fill(image.id),[image.id,image.id],['../../snapshot.json'],null]) {
   await assert.rejects(()=>createEventRequest(proposalRequest({...body,attachments}),env,dataset),{status:400});
  }
  await assert.rejects(()=>resolveEventImages(env,crypto.randomUUID(),[image.id]),{status:400});
  assert.equal((await listEventRequests(env)).items.length,0);
  assert.deepEqual(eventImageIds(),[]);
 } finally {env.DB.close();}
});

test('invalid MIME, spoofed images, empty and oversized bodies fail before storage', async () => {
 const env=makeEnv(),id=crypto.randomUUID();
 try {
  for (const request of [imageRequest(id,'<svg/>','image/svg+xml'),imageRequest(id,'<html/>'),imageRequest(id,new Uint8Array())]) await assert.rejects(()=>uploadEventImage(request,env,id),{status:415});
  await assert.rejects(()=>uploadEventImage(imageRequest(id,new Uint8Array(5*1024*1024+1)),env,id),{status:413});
  await assert.rejects(()=>uploadEventImage(imageRequest(id,png,'image/png','','https://attacker.test'),env,id),{status:403});
 } finally {env.DB.close();}
});

test('storage failures do not alter a saved proposal or approvals', async () => {
 const env=makeEnv();
 try {
  const body=makeBody();await createEventRequest(proposalRequest(body),env,dataset);
  const row=await savedRecord(env);
  env.BUCKET.head=async()=>{throw Error('storage unavailable');};
  await assert.rejects(()=>updateEventRequest(proposalRequest({...body,attachments:[crypto.randomUUID()],revision:row.createdAt,editToken:crypto.randomUUID()},'PATCH'),env,dataset));
  assert.deepEqual(await savedRecord(env),row);
 } finally {env.DB.close();}
});

test('worker restricts uploading to editors and image reading to authenticated users and saved, undeleted proposals', async () => {
 const env=makeEnv();
 try {
  const body=makeBody(),admin=await login(env,'admin-test'),viewer=await login(env,'viewer-test'),assistant=await login(env,'assistant-test');
  assert.equal((await worker.fetch(imageRequest(body.id),env)).status,401);
  assert.equal((await worker.fetch(imageRequest(body.id,png,'image/png',viewer),env)).status,403);
  assert.equal((await worker.fetch(imageRequest(body.id,png,'image/png',admin,'https://attacker.test'),env)).status,403);
  const upload=await worker.fetch(imageRequest(body.id,png,'image/png',assistant),env);assert.equal(upload.status,201);
  const image=await upload.json();body.attachments=[image.id];
  await createEventRequest(proposalRequest(body),env,dataset);
  const path=origin+'/api/event-images/'+body.id+'/'+image.id;
  assert.equal((await worker.fetch(new Request(path),env)).status,401);
  assert.equal((await worker.fetch(new Request(path,{headers:{cookie:viewer}}),env)).status,200);
  assert.equal((await worker.fetch(new Request(path,{method:'PUT',headers:{cookie:admin,origin}}),env)).status,404);
  await env.DB.prepare('INSERT INTO event_proposal_deletions VALUES (?,?)').bind('web:'+body.id,new Date().toISOString()).run();
  assert.equal((await worker.fetch(new Request(path,{headers:{cookie:viewer}}),env)).status,404);
  assert.equal((await worker.fetch(imageRequest(body.id,png,'image/png',admin),env)).status,404);
 } finally {env.DB.close();}
});
