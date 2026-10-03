import test from 'node:test';
import assert from 'node:assert/strict';
import { previewDatabase } from './preview-db.mjs';
import { proposalKey, visibleProposals, deleteEventProposal } from './event-proposal-deletions.mjs';
import { proposalsMarkup, summarizeProposals } from './out/assets/event-proposals.mjs';
import worker from './dist/server/index.js';
const id='11111111-1111-4111-8111-111111111111';
const row={id,source:'web',place:'สถานที่ทดสอบ',dates:'2026-10-01 ถึง 2026-10-02',sales:'100',profit:'20'};
const request=(key,origin='https://example.test')=>new Request('https://example.test/api/event-proposals/'+encodeURIComponent(key),{method:'DELETE',headers:{origin}});
test('deletion persists, is idempotent, excludes totals and leaves original records intact',async()=>{
 const DB=previewDatabase();const env={DB};
 try{
 await DB.prepare('INSERT INTO event_requests VALUES (?, ?, ?)').bind(id,new Date().toISOString(),JSON.stringify(row)).run();
 const before=await visibleProposals(env,[row]);const key=before[0].deletionKey;
 assert.match(proposalsMarkup({items:before,permissions:{canEdit:true}}),/data-delete-proposal="web:/);
 await assert.rejects(deleteEventProposal(request(key,'https://other.test'),env,key),{status:403});
 assert.equal((await visibleProposals(env,[row])).length,1);
 await deleteEventProposal(request(key),env,key);await deleteEventProposal(request(key),env,key);
 assert.deepEqual(await visibleProposals(env,[row]),[]);assert.equal(summarizeProposals(await visibleProposals(env,[row])).total,0);
 assert.ok(await DB.prepare('SELECT id FROM event_requests WHERE id=?').bind(id).first());
 await assert.rejects(deleteEventProposal(request('bad'),env,'bad'),{status:400});
 await assert.rejects(deleteEventProposal(request('web:22222222-2222-4222-8222-222222222222'),env,'web:22222222-2222-4222-8222-222222222222'),{status:404});
 }finally{DB.close();}
});
test('sheet identity survives reordered rows and changed approvals or amounts; other dates remain',async()=>{
 const DB=previewDatabase();try{
 const sheet={place:'ทดสอบ',name:'Event A',dates:'01-02.10.26',month:'ตุลาคม'};
 const key=await proposalKey(sheet);assert.equal(await proposalKey({...sheet,trade:'อนุมัติ',sales:'200'}),key);
 await DB.prepare('INSERT INTO event_proposal_deletions VALUES (?, ?)').bind(key,new Date().toISOString()).run();
 const items=await visibleProposals({DB},[{...sheet,dates:'03-04.10.26'},{...sheet,sales:'200'}]);assert.equal(items.length,1);assert.equal(items[0].dates,'03-04.10.26');
 }finally{DB.close();}
 await assert.rejects(visibleProposals({},[row]),{status:503});
});
test('worker requires login and same origin, deletes and refreshes list through real routes',async()=>{
 const DB=previewDatabase();const env={SESSION_SECRET:'test-signing-secret',VIEWER_PASSWORD:'test-viewer',ADMIN_PASSWORD:'test-admin',DB,BUCKET:{get:async key=>key==='event-proposals.json'?{json:async()=>({version:1,source:{status:'online',fetched_at:new Date().toISOString()},items:[]})}:null}};
 try{
 await DB.prepare('INSERT INTO event_requests VALUES (?, ?, ?)').bind(id,new Date().toISOString(),JSON.stringify(row)).run();
 const key=await proposalKey(row);
 assert.equal((await worker.fetch(request(key),env)).status,401);
 const login=await worker.fetch(new Request('https://example.test/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=test-admin'}),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const signed=(path,options={})=>new Request('https://example.test'+path,{...options,headers:{cookie,...options.headers}});
 assert.equal((await worker.fetch(signed('/api/event-proposals/'+encodeURIComponent(key),{method:'DELETE'}),env)).status,403);
 assert.equal((await worker.fetch(signed('/api/event-proposals/'+encodeURIComponent(key),{method:'DELETE',headers:{origin:'https://example.test'}}),env)).status,200);
 const res=await worker.fetch(signed('/api/event-proposals'),env);assert.equal(res.status,200);assert.deepEqual((await res.json()).items,[]);
 }finally{DB.close();}
});
