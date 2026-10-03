import test from 'node:test';
import assert from 'node:assert/strict';
import {activityInventory,activitySources,validateActivity,saveActivityWorkspace,readActivityWorkspace} from './activities-data.mjs';
import {allocation,activityRewards,activityProductType} from './out/assets/activity-model.mjs';
import {previewDatabase} from './preview-db.mjs';
const sku='VING-Kirion1.5-Onyx_Black#41/42';
const scaleup={source:'scaleup',updatedAt:'2026-09-24T02:00:00Z',items:[{id:'legacy-123',sku,barcode:'123',name:'VING Sandals Kirion1.5',warehouse:'Scale Up Fulfilment',available:5,onHand:6,unit:'pcs'}]};
const pivot={source:'pivot',updatedAt:'2026-09-24T02:30:00Z',sourceFile:{name:'Pivot.xlsx',sheet:'Summary'},items:[{id:'pivot:123:A',sku,barcode:'123',name:'Kirion1.5 · Onyx Black · 41/42',model:'Kirion1.5',grade:'A',productType:'Sandals',available:7,fullPrice:1800,unit:'คู่',sourceRow:2}]};
const costs={items:[{sourceRow:12,model:'KIRION1.5',grade:'A',type:'SHOES',beforeVat:300,includingVat:321}]};
const sources=()=>({inventory:activityInventory(scaleup,pivot),costs,branches:[]});
const permissions={canEdit:true,canApprove:true};
const input=(id='pivot:123:A',qty=2)=>({name:'Warehouse test',month:'2026-10',status:'planned',items:[{inventoryId:id,qty,costMode:'auto'}],coupons:[]});
const request=body=>new Request('https://local/api/activities',{method:'POST',body:JSON.stringify(body)});

test('same SKU remains two stocks with stable IDs, prices and individual source dates',()=>{
 const original=structuredClone({scaleup,pivot}),inventory=activityInventory(scaleup,pivot);
 assert.deepEqual(inventory.items.map(p=>[p.id,p.source,p.available]),[['legacy-123','scaleup',5],['pivot:123:A','pivot',7]]);
 assert.deepEqual(inventory.sources.map(s=>[s.source,s.updatedAt]),[['scaleup',scaleup.updatedAt],['pivot',pivot.updatedAt]]);
 assert.equal(inventory.items[0].fullPrice,1800);assert.equal(inventory.items[1].fullPrice,1800);
 assert.equal(inventory.items[1].warehouse,'PIVOT');assert.equal(inventory.items[1].onHand,undefined);
 assert.deepEqual(inventory.items[1].priceReference.rows,[2]);assert.deepEqual({scaleup,pivot},original);
});

test('PIVOT-only and zero-stock rows remain available to search; price is from the exact source row',()=>{
 const extra={...pivot.items[0],id:'pivot:only:B',sku:'PIVOT-ONLY',grade:'B',fullPrice:400,available:0,sourceRow:3};
 const duplicate={...pivot.items[0],id:'pivot:other:A',fullPrice:1700,sourceRow:4};
 const inventory=activityInventory(scaleup,{...pivot,items:[...pivot.items,extra,duplicate]});
 assert.equal(inventory.items.find(p=>p.id==='pivot:only:B').available,0);
 assert.equal(inventory.items.find(p=>p.id==='pivot:123:A').fullPrice,1800);
 assert.equal(inventory.items.find(p=>p.id==='pivot:other:A').fullPrice,1700);
 assert.equal(activityProductType(pivot.items[0]),'SHOES');
 assert.equal(activityProductType({productType:'Sneakers',sku:'unknown'}),'SHOES');
});

test('old Scaleup reservations do not consume PIVOT and each source rejects excess quantity',()=>{
 const src=sources(),old={id:'old',status:'planned',items:[{inventoryId:'legacy-123',qty:5}]};
 const next=validateActivity(input('pivot:123:A',7),src,null,permissions,[old]);
 assert.equal(next.items[0].availableAtSave,7);assert.equal(next.items[0].warehouse,'PIVOT');
 assert.throws(()=>validateActivity(input('pivot:123:A',8),src,null,permissions,[old]),/สต็อก/);
 assert.throws(()=>validateActivity(input('legacy-123',1),src,null,permissions,[old]),/สต็อก/);
 assert.equal(allocation([old,next]).get('legacy-123'),5);assert.equal(allocation([old,next]).get('pivot:123:A'),7);
 assert.equal(allocation([old,next],next.id).has('pivot:123:A'),false);
});

test('a mixed-warehouse plan persists both lines and quantity edits reserve only the chosen warehouse',async()=>{
 const DB=previewDatabase(),env={DB},src=sources();
 try{
  const activity={...input(),items:[...input('legacy-123',2).items,...input('pivot:123:A',3).items]};
  let saved=await saveActivityWorkspace(request({revision:'0',activity}),env,src,permissions);
  const id=saved.savedId;
  saved=await saveActivityWorkspace(request({revision:saved.revision,action:'quantities',activity:{id},quantities:[{inventoryId:'pivot:123:A',qty:4}]}),env,src,permissions);
  const plan=(await readActivityWorkspace(env)).items[0];
  assert.deepEqual(plan.items.map(i=>[i.inventoryId,i.qty,i.warehouse]),[['legacy-123',2,'Scale Up Fulfilment'],['pivot:123:A',4,'PIVOT']]);
  assert.equal(activityRewards(plan,src.inventory.items).productValue,10800);
  const next=validateActivity(input('legacy-123',3),src,null,permissions,[plan]);assert.equal(next.items[0].availableAtSave,3);
  assert.throws(()=>validateActivity(input('pivot:123:A',4),src,null,permissions,[plan]),/สต็อก/);
  await assert.rejects(()=>saveActivityWorkspace(request({revision:saved.revision,action:'quantities',activity:{id},quantities:[{inventoryId:'pivot:123:A',qty:8}]}),env,src,permissions),/สต็อก/);
 }finally{DB.close();}
});

test('activity sources read saved Scaleup and PIVOT snapshots and preserve legacy IDs',async()=>{
 const DB=previewDatabase(),env={DB},newer={...pivot,updatedAt:'2099-01-01T00:00:00Z'};
 try{
  for(const [source,snapshot]of [['scaleup',scaleup],['pivot',newer]])await DB.prepare('INSERT INTO inventory_snapshots(source,payload,updated_at) VALUES (?,?,?)').bind(source,JSON.stringify(snapshot),snapshot.updatedAt).run();
  const loaded=await activitySources(env,{...scaleup,items:[]},{},async()=>costs);
  assert.deepEqual(loaded.inventory.items.map(i=>i.id),['legacy-123','pivot:123:A']);
  assert.equal(loaded.inventory.sources.find(s=>s.source==='pivot').updatedAt,newer.updatedAt);
 }finally{DB.close();}
});
