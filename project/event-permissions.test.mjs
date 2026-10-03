import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './dist/server/index.js';
import {previewDatabase} from './preview-db.mjs';
import {proposalsMarkup} from './out/assets/event-proposals.mjs';
const id='11111111-1111-4111-8111-111111111111',key='web:'+id;
const row={id,source:'web',place:'สถานที่ทดสอบ',dates:'2026-10-01',trade:'รออนุมัติ',ceo:'รออนุมัติ'};
const sheet={place:'สถานที่จากชีต',name:'Event',dates:'1-2.10.26',month:'ตุลาคม',trade:'รออนุมัติ',ceo:''};
export const testEnv=()=>({SESSION_SECRET:'test-random-session-secret-not-either-password',VIEWER_PASSWORD:'test-viewer',ADMIN_PASSWORD:'test-admin',DB:previewDatabase(),BUCKET:{get:async k=>k==='event-proposals.json'?{json:async()=>({version:1,source:{status:'online',fetched_at:new Date().toISOString()},items:[sheet]})}:null}});
const req=(path,cookie='',method='GET',body,origin='https://example.test')=>new Request('https://example.test'+path,{method,headers:{cookie,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
async function login(env,password){const r=await worker.fetch(new Request('https://example.test/login',{method:'POST',body:new URLSearchParams({password})}),env);assert.equal(r.status,303);return r.headers.get('set-cookie')?.split(';')[0];}
test('viewer cannot mutate; role tampering, old tokens, expiry and forged password-signed sessions rejected',async()=>{
 const env=testEnv();try{
 const cookie=await login(env,'test-viewer');assert.ok(cookie);
 for(const [path,method] of [['/api/event-requests','POST'],['/api/event-proposals/'+key,'DELETE'],['/api/event-proposals/approval','PATCH'],['/api/anything','PUT']])assert.equal((await worker.fetch(req(path,cookie,method,{key,field:'trade',status:'อนุมัติ'}),env)).status,403);
 assert.equal((await worker.fetch(req('/api/session',cookie.replace('.viewer.','.admin.')),env)).status,401);
 assert.equal((await worker.fetch(req('/api/session','ving_session=9999999999.oldsignature'),env)).status,401);
 const expires=String(Math.floor(Date.now()/1000)+5000),payload='v2.admin.'+expires;
 const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-viewer'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode(payload))).toString('base64url');
 assert.equal((await worker.fetch(req('/api/session','ving_session='+payload+'.'+sig),env)).status,401);
 const data=await(await worker.fetch(req('/api/event-proposals',cookie),env)).json();assert.equal(data.permissions.canEdit,false);assert.doesNotMatch(proposalsMarkup(data),/data-delete-proposal=|data-approve-proposal=/);
 const html=await(await worker.fetch(req('/event-proposals',cookie),env)).text();assert.match(html,/data-access-role="viewer"/);assert.doesNotMatch(html,/test-admin|test-random-session/);
 }finally{env.DB.close();}
});
test('admin approves both columns independently, persists sheet overrides and deletes; validates origin and status',async()=>{
 const env=testEnv();try{
 await env.DB.prepare('INSERT INTO event_requests VALUES (?, ?, ?)').bind(id,new Date().toISOString(),JSON.stringify(row)).run();
 const admin=await login(env,'test-admin'),viewer=await login(env,'test-viewer');
 const patch=(field,status,k=key,origin='https://example.test')=>worker.fetch(req('/api/event-proposals/approval',admin,'PATCH',{key:k,field,status},origin),env);
 assert.equal((await patch('trade','อนุมัติ',key,'https://attacker.test')).status,403);
 assert.equal((await patch('bad','อนุมัติ')).status,400);assert.equal((await patch('trade','bad')).status,400);
 assert.equal((await patch('trade','อนุมัติ')).status,200);assert.equal((await patch('ceo','อนุมัติ')).status,200);
 let data=await(await worker.fetch(req('/api/event-proposals',viewer),env)).json();assert.equal(data.items[0].trade,'อนุมัติ');assert.equal(data.items[0].ceo,'อนุมัติ');
 const sheetKey=data.items[1].deletionKey;assert.equal((await patch('trade','อนุมัติ',sheetKey)).status,200);
 data=await(await worker.fetch(req('/api/event-proposals',admin),env)).json();assert.equal(data.items[1].trade,'อนุมัติ');assert.equal(data.items[1].ceo,'');assert.match(proposalsMarkup(data),/data-approve-proposal=/);
 assert.equal((await worker.fetch(req('/api/event-proposals/'+key,admin,'DELETE'),env)).status,200);
 assert.equal((await patch('ceo','รออนุมัติ')).status,409);
 assert.equal((await worker.fetch(req('/logout',viewer,'POST'),env)).status,303);
 }finally{env.DB.close();}
});
