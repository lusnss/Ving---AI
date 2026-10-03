import test from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from './preview-db.mjs';
import {saveActivityWorkspace,readActivityWorkspace} from './activities-data.mjs';
import {allocation,activityRewards} from './out/assets/activity-model.mjs';
const owner={canEdit:true,canApprove:true},editor={canEdit:true,canApprove:false};
const sources={inventory:{items:[{id:'stock',available:10,fullPrice:200},{id:'unknown',available:20,fullPrice:null}]}};
const plan=(id,status='pending')=>({id,name:'Test',status,month:'2026-10',items:[{inventoryId:'stock',sku:'STOCK',qty:3,unitCost:20},{inventoryId:'unknown',sku:'UNKNOWN',qty:2,unitCost:10}],coupons:[{kind:'fixed',value:50,uses:4}],budget:1000,extra:5,notes:'Keep',review:null});
const request=(revision='initial',quantities=[{inventoryId:'stock',qty:5}],extra={})=>new Request('https://local/api/activities',{method:'POST',body:JSON.stringify({action:'quantities',activity:{id:'edit'},revision,quantities,...extra})});
async function fixture(items,fn){const DB=previewDatabase();try{await DB.prepare('INSERT INTO activity_workspace (id,payload,revision) VALUES (?,?,?)').bind('main',JSON.stringify(items),'initial').run();await fn({DB});}finally{DB.close();}}
test('quantity edits persist and preserve prices, costs, coupons, status and unrelated plans',async()=>{
 const original=plan('edit');await fixture([original,plan('other')],async env=>{
  const result=await saveActivityWorkspace(request('initial',undefined,{activity:{id:'edit',status:'planned',budget:90000,items:[]}}),env,sources,editor);
  const saved=await readActivityWorkspace(env),changed=saved.items[0];
  assert.equal(changed.items[0].qty,5);assert.equal(changed.status,'pending');assert.equal(changed.budget,1000);
  assert.deepEqual(changed.coupons,original.coupons);assert.deepEqual(changed.items[1],original.items[1]);assert.deepEqual(saved.items[1],plan('other'));
  assert.equal(changed.items[0].unitCost,20);assert.equal(activityRewards(changed,sources.inventory.items).value,1200);
  assert.equal(saved.revision,result.revision);assert.notEqual(saved.revision,'initial');
  await assert.rejects(()=>saveActivityWorkspace(request(),env,sources,editor),e=>e.status===409);
 });
});
test('quantity edits enforce access, locked statuses, stock allocation, integer limits and budget',async()=>{
 for(const status of ['completed','cancelled'])await fixture([plan('edit',status)],async env=>{await assert.rejects(()=>saveActivityWorkspace(request(),env,sources,owner),e=>e.status===409);});
 await fixture([plan('edit','planned'),plan('other','planned')],async env=>{
  await assert.rejects(()=>saveActivityWorkspace(request(),env,sources,{canEdit:false}),e=>e.status===403);
  await assert.rejects(()=>saveActivityWorkspace(request(),env,sources,editor),e=>e.status===403);
  await assert.rejects(()=>saveActivityWorkspace(request('initial',[{inventoryId:'stock',qty:8}]),env,sources,owner),/สต็อก/);
  await saveActivityWorkspace(request('initial',[{inventoryId:'stock',qty:7}]),env,sources,owner);
  assert.equal(allocation((await readActivityWorkspace(env)).items).get('stock'),10);
 });
 await fixture([{...plan('edit','planned'),budget:300}],async env=>{await assert.rejects(()=>saveActivityWorkspace(request(),env,sources,owner),/เกินงบ/);assert.equal((await readActivityWorkspace(env)).items[0].items[0].qty,3);});
 await fixture([plan('edit')],async env=>{
  for(const qty of [0,-1,1.5,1000001,'5'])await assert.rejects(()=>saveActivityWorkspace(request('initial',[{inventoryId:'stock',qty}]),env,sources,editor));
  await assert.rejects(()=>saveActivityWorkspace(request('initial',[{inventoryId:'missing',qty:1}]),env,sources,editor));
  await assert.rejects(()=>saveActivityWorkspace(request('initial',[{inventoryId:'stock',qty:1},{inventoryId:'stock',qty:2}]),env,sources,editor));
  assert.equal((await readActivityWorkspace(env)).revision,'initial');
 });
});
test('simultaneous quantity saves cannot overwrite each other',async()=>{
 await fixture([plan('edit')],async env=>{
  const results=await Promise.allSettled([saveActivityWorkspace(request(),env,sources,editor),saveActivityWorkspace(request('initial',[{inventoryId:'stock',qty:6}]),env,sources,editor)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 });
});
test('summary removal persists, releases allocations, and preserves the remaining plan',async()=>{
 const original=plan('edit','planned'),other=plan('other','planned');
 await fixture([original,other],async env=>{
  const result=await saveActivityWorkspace(request('initial',[],{removedInventoryIds:['stock']}),env,sources,owner);
  const saved=await readActivityWorkspace(env),changed=saved.items[0];
  assert.deepEqual(changed.items,[original.items[1]]);
  for(const key of ['name','status','budget','coupons','extra','notes','review'])assert.deepEqual(changed[key],original[key]);
  assert.deepEqual(saved.items[1],other);assert.equal(allocation(saved.items).get('stock'),3);
  assert.equal(saved.revision,result.revision);
  await assert.rejects(()=>saveActivityWorkspace(request('initial',[],{removedInventoryIds:['unknown']}),env,sources,owner),e=>e.status===409);
 });
});
test('summary removal combines with quantity edits and permits a coupon-only plan',async()=>{
 await fixture([plan('edit')],async env=>{
  const result=await saveActivityWorkspace(request('initial',[{inventoryId:'unknown',qty:4}],{removedInventoryIds:['stock']}),env,sources,editor);
  assert.equal(result.items[0].items.length,1);assert.equal(result.items[0].items[0].qty,4);
  const next=await saveActivityWorkspace(request(result.revision,[],{removedInventoryIds:['unknown']}),env,sources,editor);
  assert.deepEqual(next.items[0].items,[]);assert.deepEqual(next.items[0].coupons,plan('edit').coupons);
 });
});
test('summary removal rejects unauthorized, invalid and empty-plan changes atomically',async()=>{
 for(const status of ['completed','cancelled'])await fixture([plan('edit',status)],async env=>{
  await assert.rejects(()=>saveActivityWorkspace(request('initial',[],{removedInventoryIds:['stock']}),env,sources,owner),e=>e.status===409);
 });
 await fixture([plan('edit','planned')],async env=>{
  for(const permission of [editor,{canEdit:false}])await assert.rejects(()=>saveActivityWorkspace(request('initial',[],{removedInventoryIds:['stock']}),env,sources,permission),e=>e.status===403);
 });
 await fixture([{...plan('edit'),coupons:[]}],async env=>{
  for(const removedInventoryIds of [['missing'],['stock','stock'],['stock','unknown'],'stock',[null]]){
   await assert.rejects(()=>saveActivityWorkspace(request('initial',[],{removedInventoryIds}),env,sources,editor));
  }
  await assert.rejects(()=>saveActivityWorkspace(request('initial',[{inventoryId:'stock',qty:4}],{removedInventoryIds:['stock']}),env,sources,editor));
  assert.equal((await readActivityWorkspace(env)).revision,'initial');
 });
});
