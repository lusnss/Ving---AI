import test from 'node:test';
import assert from 'node:assert/strict';
import {changePromotionPlan,readPromotionPlans,savePromotionPlan} from './promotions-data.mjs';
import {previewDatabase} from './preview-db.mjs';
import {renderPromotionBrief,promotionBriefSheets} from './out/assets/promotion-brief.mjs';
import worker from './dist/server/index.js';
const admin={canEdit:true,canApprove:true},assistant={canEdit:true,canApprove:false};
const req=(id='test',expectedVersion=1)=>new Request('https://preview.invalid/api/promotions/approval',{method:'POST',body:JSON.stringify({id,expectedVersion})});
async function seed(DB,patch={}){const plan={id:'test',name:'Sample',month:'2026-09',status:'draft',approval:'unapproved',revision:1,createdAt:'2026-09-01T00:00:00Z',channel:'department',gp:20,lines:[{model:'Sample',grade:'A',size:'40',qty:2,available:5,discount:10,fullPrice:1000,unitCost:400}],...patch};await DB.prepare('INSERT INTO promotion_plans(id,month,created_at,payload) VALUES(?,?,?,?)').bind(plan.id,plan.month,plan.createdAt,JSON.stringify(plan)).run();return plan;}

test('approval persists draft and proposed states, preserves prices, and locks editing',async()=>{
 for(const status of ['draft','proposed']){const DB=previewDatabase(),env={DB};try{
  const before=await seed(DB,{status}),approved=(await changePromotionPlan(req(),env,admin,'approve')).plan;
  assert.equal(approved.status,'approved');assert.equal(approved.approval,'approved');assert.equal(approved.revision,2);assert.ok(approved.approvedAt);
  assert.deepEqual(approved.lines,before.lines);assert.equal(approved.createdAt,before.createdAt);
  assert.deepEqual((await readPromotionPlans(env))[0],approved);
  await assert.rejects(savePromotionPlan(req('test',2),env,{},admin),e=>e.status===409);
  await assert.rejects(changePromotionPlan(req('test',2),env,admin,'approve'),e=>e.status===409);
 }finally{DB.close();}}
});
test('permissions, invalid bodies, missing records and stale versions never mutate records',async()=>{
 const DB=previewDatabase(),env={DB};try{
  const before=await seed(DB);
  for(const permissions of [assistant,{canEdit:false,canApprove:false}])await assert.rejects(changePromotionPlan(req(),env,permissions,'approve'),e=>e.status===403);
  await assert.rejects(changePromotionPlan(req(),env,{canEdit:false},'delete'),e=>e.status===403);
  for(const action of ['approve','delete']){
   await assert.rejects(changePromotionPlan(req('missing'),env,admin,action),e=>e.status===404);
   await assert.rejects(changePromotionPlan(req('test',2),env,admin,action),e=>e.status===409);
   for(const body of ['null','{','{}',JSON.stringify({id:'test',expectedVersion:'1'})])await assert.rejects(changePromotionPlan(new Request('https://preview.invalid',{method:'POST',body}),env,admin,action),e=>e.status===400);
  }
  assert.deepEqual((await readPromotionPlans(env))[0],before);
 }finally{DB.close();}
});
test('approval versus deletion race has one winner; deletion removes only the selected plan',async()=>{
 const DB=previewDatabase(),env={DB};try{
  await seed(DB);const other=await seed(DB,{id:'other'});
  const result=await Promise.allSettled([changePromotionPlan(req(),env,admin,'approve'),changePromotionPlan(req(),env,assistant,'delete')]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.find(r=>r.status==='rejected').reason.status,409);
  const remaining=(await readPromotionPlans(env)).find(p=>p.id==='test');if(remaining)await changePromotionPlan(req('test',remaining.revision),env,assistant,'delete');
  assert.deepEqual(await readPromotionPlans(env),[other]);
  await assert.rejects(changePromotionPlan(req(),env,admin,'delete'),e=>e.status===404);
 }finally{DB.close();}
});
test('legacy records without a revision can be approved and approval appears in the brief and Excel',async()=>{
 const DB=previewDatabase(),env={DB};try{
  await seed(DB,{revision:undefined});const {plan}=await changePromotionPlan(req(),env,admin,'approve');
  const html=renderPromotionBrief(plan);assert.match(html,/อนุมัติราคาและส่วนลดแล้ว/);assert.doesNotMatch(html,/ยังไม่อนุมัติราคา/);
  const sheets=JSON.stringify(promotionBriefSheets(plan));assert.match(sheets,/สถานะ: อนุมัติแล้ว/);assert.doesNotMatch(sheets,/ยังไม่อนุมัติราคา/);
 }finally{DB.close();}
});
async function cookie(secret,role){const payload=`v4.${role}.${role==='assistant'?'assistant-1':role}.${Math.floor(Date.now()/1000)+1000}`;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');return `ving_session=${payload}.${sig}`;}
test('built Worker enforces session, method, origin and role, and saves actions without stock services',async()=>{
 const DB=previewDatabase(),env={DB,SESSION_SECRET:'local-test-only'},origin='https://preview.invalid';try{
  await seed(DB);
  async function call(path,role,{method='POST',requestOrigin=origin,version=1}={}){return worker.fetch(new Request(origin+path,{method,headers:{...(role?{cookie:await cookie(env.SESSION_SECRET,role)}:{}),origin:requestOrigin,'content-type':'application/json'},...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify({id:'test',expectedVersion:version})})}),env);}
  for(const path of ['/api/promotions/approval','/api/promotions/delete']){
   assert.equal((await call(path,null)).status,401);assert.equal((await call(path,'viewer')).status,403);
   assert.equal((await call(path,'admin',{requestOrigin:'https://other.invalid'})).status,403);
   assert.equal((await call(path,'admin',{method:'GET'})).status,405);
  }
  assert.equal((await call('/api/promotions/approval','assistant')).status,403);
  const approved=await call('/api/promotions/approval','admin');assert.equal(approved.status,200);assert.equal((await approved.json()).plan.status,'approved');
  assert.equal((await call('/api/promotions/delete','assistant',{version:1})).status,409);
  assert.equal((await call('/api/promotions/delete','assistant',{version:2})).status,200);
  assert.deepEqual(await readPromotionPlans(env),[]);
 }finally{DB.close();}
});
