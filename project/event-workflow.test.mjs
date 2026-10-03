import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {updateEventWorkflow,visibleProposals,summaryApprovedProposals} from './event-proposal-deletions.mjs';
import {eventWorkflowStatus} from './out/assets/event-workflow.mjs';
import {proposalsMarkup} from './out/assets/event-proposals.mjs';
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('offline test');};
const {default:worker}=await import('./dist/server/index.js?workflow');
globalThis.fetch=originalFetch;
const id='11111111-1111-4111-8111-111111111111',key='web:'+id;
const base={id,source:'web',place:'พื้นที่ทดสอบสถานะ',trade:'อนุมัติ',ceo:'อนุมัติ',createdAt:'2026-09-24T00:00:00.000Z',sales:100};
const patch=(values,origin='https://example.test')=>new Request('https://example.test/api/event-proposals/status',{method:'PATCH',headers:{origin,'content-type':'application/json'},body:JSON.stringify({key,status:'cancelled',note:'สถานที่ไม่พร้อม',proposalRevision:base.createdAt,...values})});
async function setup(row=base){const DB=previewDatabase();await DB.prepare('INSERT INTO event_requests VALUES (?,?,?)').bind(id,base.createdAt,JSON.stringify(row)).run();return {DB,BUCKET:{get:async()=>({json:async()=>({version:1,items:[],source:{status:'online'}})})}};}

test('approval state drives scheduling while cancellation and completion remain explicit',()=>{
 assert.equal(eventWorkflowStatus(base),'scheduled');
 assert.equal(eventWorkflowStatus({...base,ceo:'รออนุมัติ'}),'pending');
 assert.equal(eventWorkflowStatus({...base,ceo:'ไม่อนุมัติ'}),'rejected');
 assert.equal(eventWorkflowStatus({...base,workflow:{status:'cancelled'}}),'cancelled');
 assert.equal(eventWorkflowStatus({...base,ceo:'รออนุมัติ',workflow:{status:'scheduled'}}),'pending');
 assert.equal(eventWorkflowStatus({...base,workflow:{status:'completed'}}),'completed');
});
test('cancelled state and notes survive rereads, keep original approvals, and leave approved summary',async()=>{
 const env=await setup();try{
 const saved=await updateEventWorkflow(patch({note:'  สถานที่เลื่อนงาน\nรอแจ้งวันใหม่  '}),env);
 assert.equal(saved.workflow.note,'สถานที่เลื่อนงาน\nรอแจ้งวันใหม่');
 const item=(await visibleProposals(env,[base]))[0];
 assert.equal(item.trade,'อนุมัติ');assert.equal(item.ceo,'อนุมัติ');assert.deepEqual(item.workflow,saved.workflow);
 assert.equal((await summaryApprovedProposals(env)).items.length,0);
 const restored=await updateEventWorkflow(patch({status:'scheduled',note:'',revision:saved.workflow.revision}),env);
 assert.equal(restored.workflow.note,'');assert.equal((await summaryApprovedProposals(env)).items.length,1);
 }finally{env.DB.close();}
});
test('rejects blank notes, oversized notes, invalid states and cross-origin writes',async()=>{
 const env=await setup();try{
 for(const values of [{note:''},{note:' \n '},{note:42},{note:'x'.repeat(1001)},{status:'whatever'}])await assert.rejects(updateEventWorkflow(patch(values),env),{status:400});
 await assert.rejects(updateEventWorkflow(patch({},'https://elsewhere.test'),env),{status:403});
 assert.equal((await visibleProposals(env,[base]))[0].workflow,undefined);
 }finally{env.DB.close();}
});
test('stale editor cannot overwrite cancellation or a revised proposal',async()=>{
 const env=await setup();try{
 const saved=await updateEventWorkflow(patch({}),env);
 await assert.rejects(updateEventWorkflow(patch({note:'stale'}),env),{status:409});
 await assert.rejects(updateEventWorkflow(patch({revision:saved.workflow.revision,proposalRevision:'old'}),env),{status:409});
 const changed=await updateEventWorkflow(patch({revision:saved.workflow.revision,note:'เหตุผลเพิ่มเติม'}),env);
 assert.equal(changed.workflow.note,'เหตุผลเพิ่มเติม');
 }finally{env.DB.close();}
});
test('both approvals required for scheduled and completed; pending work can be cancelled',async()=>{
 const env=await setup({...base,ceo:'รออนุมัติ'});try{
 for(const status of ['scheduled','completed'])await assert.rejects(updateEventWorkflow(patch({status,note:''}),env),{status:409});
 assert.equal((await updateEventWorkflow(patch({}),env)).workflow.status,'cancelled');
 }finally{env.DB.close();}
});
test('approval revoked during save prevents scheduling atomically',async()=>{
 const env=await setup();const prepare=env.DB.prepare.bind(env.DB);let intercepted=false;
 env.DB.prepare=sql=>{
  if(sql.startsWith('INSERT INTO event_proposal_workflow')&&!intercepted){intercepted=true;prepare("INSERT INTO event_proposal_approvals (id,ceo,updated_at) VALUES (?, 'รออนุมัติ', ?)").bind(key,base.createdAt).run();}
  return prepare(sql);
 };
 try{await assert.rejects(updateEventWorkflow(patch({status:'completed',note:''}),env),{status:409});assert.equal(await prepare('SELECT id FROM event_proposal_workflow').first(),null);}finally{env.DB.close();}
});
test('deleted or missing rows cannot be updated and note content is escaped in the table',async()=>{
 const env=await setup();try{
 const html=proposalsMarkup({items:[{...base,deletionKey:key,workflow:{status:'cancelled',note:'<img src=x onerror=alert(1)>'}}],permissions:{canEdit:false}});
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('data-update-workflow='));
 await env.DB.prepare('INSERT INTO event_proposal_deletions VALUES (?,?)').bind(key,base.createdAt).run();
 await assert.rejects(updateEventWorkflow(patch({}),env),{status:404});
 }finally{env.DB.close();}
});
test('real route requires authentication, permits editors, blocks viewers and persists across reads',async()=>{
 const env={...await setup(),SESSION_SECRET:'workflow-test-session-secret',ADMIN_PASSWORD:'test-admin',ASSISTANT_PASSWORD_1:'test-assistant',VIEWER_PASSWORD:'test-viewer'};
 try{
 assert.equal((await worker.fetch(patch({}),env)).status,401);
 for(const [password,expected] of [['test-viewer',403],['test-assistant',200]]){
  const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),env);
  const cookie=login.headers.get('set-cookie').split(';')[0],req=patch({});req.headers.set('cookie',cookie);
  const response=await worker.fetch(req,env);assert.equal(response.status,expected,await response.text());
  if(expected===200){const response=await worker.fetch(new Request('https://example.test/api/event-proposals/detail?key='+key,{headers:{cookie}}),env);const data=await response.json();assert.equal(data.item.workflow.status,'cancelled');assert.equal(data.item.workflow.note,'สถานที่ไม่พร้อม');}
 }
 }finally{env.DB.close();}
});
test('sheet proposals support the same durable cancellation without editing source approvals',async()=>{
 const sheet={place:'พื้นที่จากชีต',name:'Event ทดสอบ',dates:'1-5.10.26',month:'ตุลาคม',trade:'อนุมัติ',ceo:'อนุมัติ'};
 const env={DB:previewDatabase(),SESSION_SECRET:'sheet-workflow-test-secret',ADMIN_PASSWORD:'test-admin',VIEWER_PASSWORD:'test-viewer',BUCKET:{get:async()=>({json:async()=>({version:1,items:[sheet],source:{status:'online',fetched_at:new Date().toISOString()}})})}};
 try{
  const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password:'test-admin'})}),env);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const read=async()=>{const response=await worker.fetch(new Request('https://example.test/api/event-proposals',{headers:{cookie}}),env);assert.equal(response.status,200);return response.json();};
  const item=(await read()).items.find(row=>row.place===sheet.place);
  const request=patch({key:item.deletionKey,proposalRevision:null,note:'ยกเลิกพื้นที่จากชีต'});request.headers.set('cookie',cookie);
  const response=await worker.fetch(request,env);assert.equal(response.status,200,await response.text());
  const updated=(await read()).items.find(row=>row.deletionKey===item.deletionKey);
  assert.equal(updated.workflow.status,'cancelled');assert.equal(updated.workflow.note,'ยกเลิกพื้นที่จากชีต');assert.equal(updated.trade,'อนุมัติ');assert.equal(updated.ceo,'อนุมัติ');
 }finally{env.DB.close();}
});
