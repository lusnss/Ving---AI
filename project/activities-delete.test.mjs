import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {saveActivityWorkspace,readActivityWorkspace} from './activities-data.mjs';
import {allocation,monthlyActivities} from './out/assets/activity-model.mjs';

const owner={canEdit:true,canApprove:true},editor={canEdit:true,canApprove:false};
const plan=(id,status='draft')=>({id,name:'Test '+id,status,month:'2026-10',items:[{inventoryId:'stock',qty:3,unitCost:100}],coupons:[],budget:1000,extra:0});
const request=(id,revision='initial',extra={})=>new Request('https://local/api/activities',{method:'POST',body:JSON.stringify({action:'delete',activity:{id},revision,confirm:true,...extra})});
async function fixture(items,fn){const DB=previewDatabase();try{await DB.prepare('INSERT INTO activity_workspace (id,payload,revision) VALUES (?,?,?)').bind('main',JSON.stringify(items),'initial').run();await fn({DB});}finally{DB.close();}}

test('delete persists only the selected plan and removes its budget and stock allocation',async()=>{
 await fixture([plan('remove','planned'),plan('keep','planned')],async env=>{
  const result=await saveActivityWorkspace(request('remove'),env,{},owner);
  assert.equal(result.deletedId,'remove');assert.notEqual(result.revision,'initial');
  const saved=await readActivityWorkspace(env);assert.deepEqual(saved.items,[plan('keep','planned')]);
  assert.equal(allocation(saved.items).get('stock'),3);
  assert.equal(monthlyActivities(saved.items,'2026')[9].gift,300);
  await assert.rejects(()=>saveActivityWorkspace(request('remove',saved.revision),env,{},owner),e=>e.status===404);
 });
});
test('editors can delete draft, pending, rejected and cancelled plans, including the last plan',async()=>{
 for(const status of ['draft','pending','rejected','cancelled'])await fixture([plan('remove',status)],async env=>{
  await saveActivityWorkspace(request('remove'),env,{},editor);
  assert.deepEqual((await readActivityWorkspace(env)).items,[]);
 });
});
test('deletion enforces confirmation, view-only access and approved plan permissions',async()=>{
 await fixture([plan('remove','planned')],async env=>{
  await assert.rejects(()=>saveActivityWorkspace(request('remove'),env,{},editor),e=>e.status===403);
  await assert.rejects(()=>saveActivityWorkspace(request('remove'),env,{},{}),e=>e.status===403);
  await assert.rejects(()=>saveActivityWorkspace(request('remove','initial',{confirm:false}),env,{},owner),e=>e.status===400);
  await assert.rejects(()=>saveActivityWorkspace(request('','initial'),env,{},owner),e=>e.status===404);
  assert.deepEqual((await readActivityWorkspace(env)).items,[plan('remove','planned')]);
 });
});
test('completed activities cannot be deleted even after stock settlement',async()=>{
 for(const stockSettled of [false,true])await fixture([{...plan('done','completed'),stockSettled}],async env=>{
  await assert.rejects(()=>saveActivityWorkspace(request('done'),env,{},owner),e=>e.status===409);
  assert.equal((await readActivityWorkspace(env)).items.length,1);
 });
});
test('stale and concurrent deletes never overwrite another update',async()=>{
 await fixture([plan('a'),plan('b')],async env=>{
  await assert.rejects(()=>saveActivityWorkspace(request('a','stale'),env,{},owner),e=>e.status===409);
  const results=await Promise.allSettled(['a','b'].map(id=>saveActivityWorkspace(request(id),env,{},owner)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  assert.equal((await readActivityWorkspace(env)).items.length,1);
 });
});
