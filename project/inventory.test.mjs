import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import {handleInventory,fetchScaleupInventory,normalizeInventory} from './inventory-data.mjs';
import worker from './dist/server/index.js';
const db=new DatabaseSync(':memory:');db.exec(await fs.readFile('drizzle/0005_inventory_snapshots.sql','utf8'));
const DB={prepare(sql){return{bind(...values){const stmt=db.prepare(sql);return{async first(){return stmt.get(...values)||null;},async run(){return stmt.run(...values);}};}}}};
const env={DB,SCALEUP_USERNAME:'test-account',SCALEUP_PASSWORD:'test-secret',SESSION_SECRET:'local-secret',VIEWER_PASSWORD:'viewer',ADMIN_PASSWORD:'admin'};
const row=(id)=>({inventory_id:id,sku:'SKU-'+id,barcode:'00123',product_name:'Test product',product_type:'NORMAL',unit:'pcs',quantity:10,normal:10,sellable_reserved:3,sellable_available:7,reserved:1,available:9,on_hold:0,shelf_life_hold:0,pending_destruction:0,defect:0,quarantine:0,expired:0,email:'must-not-leak',warehouse:{name:'Test warehouse'}});
const summary={total_on_hand:20,total_normal:20,total_sellable_reserved:6,total_sellable_available:14,total_on_hold:0,total_shelf_life_hold:0,total_pending_destruction:0,total_defect:0,total_quarantine:0,total_expired:0};
const calls=[];
async function fetcher(url,opts){assert.equal(new URL(url).origin,'https://api-app.scaleup-fulfilment.com');assert.equal(opts.redirect,'manual');calls.push(String(url));if(url.endsWith('/auth/login')){assert.deepEqual(JSON.parse(opts.body),{email:'test-account',password:'test-secret'});return Response.json({token:'private-token',console_access:[{is_active:true,organization_id:993,oms_console_id:1222}]});}assert.equal(opts.method,'GET');assert.equal(opts.headers.authorization,'Bearer private-token');const page=Number(new URL(url).searchParams.get('page'));return Response.json({ok:true,data:{items:[row(page)],summary,total:2,page,hasNextPage:page<2}});}
const req=(path='/api/inventory',opts={})=>new Request('https://example.test'+path,opts);
const post=()=>req('/api/inventory/refresh',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({source:'scaleup'})});
let response=await handleInventory(req(),env,null,fetcher);assert.equal(response.status,200);assert.equal((await response.json()).snapshot,null);assert.equal(calls.length,0);
response=await handleInventory(post(),env,null,fetcher);assert.equal(response.status,200);const first=(await response.json()).snapshot;assert.equal(first.items.length,2);assert.equal(first.summary.reserved,6);assert.equal(first.summary.available,14);assert.equal(first.items[0].barcode,'00123');assert.doesNotMatch(JSON.stringify(first),/must-not-leak|private-token|test-secret/);assert.equal(calls.length,3);
const saved=(await (await handleInventory(req(),env,null,()=>{throw Error('GET must not fetch');})).json()).snapshot;assert.deepEqual(saved,first);
response=await handleInventory(post(),env,null,async(url,opts)=>url.includes('/reports/inventory?')?Response.json({ok:true,data:{items:[row(1)],summary,total:2,page:1,hasNextPage:false}}):fetcher(url,opts));assert.equal(response.status,502);assert.deepEqual((await (await handleInventory(req(),env,null,fetcher)).json()).snapshot,first);
// A redirect must fail before following it or replacing the saved snapshot.
for(const status of [301,302,303,307,308]){
 for(const redirectAt of ['login','report']){
  let redirectCalls=0;
  response=await handleInventory(post(),env,null,async(url,opts)=>{
   redirectCalls++;
   if(redirectAt==='login'||url.includes('/reports/inventory?')){
    assert.equal(opts.redirect,'manual');
    return new Response(null,{status,headers:{location:'https://untrusted.example/collect'}});
   }
   return fetcher(url,opts);
  });
  assert.equal(response.status,502);
  assert.match((await response.json()).error,/เปลี่ยนเส้นทาง/);
  assert.equal(redirectCalls,redirectAt==='login'?1:2);
  assert.deepEqual((await (await handleInventory(req(),env,null,fetcher)).json()).snapshot,first);
 }
}
assert.throws(()=>normalizeInventory([row(1),row(1)],summary,new Date().toISOString()),/ซ้ำ/);
assert.equal(normalizeInventory([row(1),{...row(2),sellable_reserved:4}],summary,new Date().toISOString()).summary.reserved,7);
// A refresh must persist fresh rows even when the source summary disagrees.
response=await handleInventory(post(),env,null,async(url,opts)=>{
 const result=await fetcher(url,opts);
 if(!url.includes('/reports/inventory?'))return result;
 assert.equal(new URL(url).searchParams.get('includeSummary'),'false');
 const body=await result.json();body.data.items=body.data.items.map(item=>({...item,quantity:12,normal:12,sellable_available:9}));
 return Response.json(body);
});
assert.equal(response.status,200);
const refreshed=(await response.json()).snapshot;assert.equal(refreshed.summary.onHand,24);assert.equal(refreshed.summary.available,18);
assert.deepEqual((await (await handleInventory(req(),env,null,fetcher)).json()).snapshot,refreshed);
assert.equal(normalizeInventory([row(1)],null,new Date().toISOString()).summary.onHand,10);
assert.throws(()=>normalizeInventory([{...row(1),normal:null}],summary,new Date().toISOString()),/จำนวน/);
response=await handleInventory(req('/api/inventory/refresh',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}),env,null,fetcher);assert.equal(response.status,403);
response=await handleInventory(req('/api/inventory/refresh',{method:'GET'}),env,null,fetcher);assert.equal(response.status,405);
let resolveLogin;const held=new Promise(resolve=>resolveLogin=resolve);
const slow=handleInventory(post(),env,null,async(url,opts)=>{if(url.endsWith('/auth/login'))await held;return fetcher(url,opts);});await new Promise(resolve=>setTimeout(resolve,5));assert.equal((await handleInventory(post(),env,null,fetcher)).status,409);resolveLogin();assert.equal((await slow).status,200);
assert.equal((await worker.fetch(req('/api/inventory'),env)).status,401);assert.equal((await worker.fetch(post(),env)).status,401);
const login=await worker.fetch(req('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=viewer&next=%2Finventory'}),env);const cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await worker.fetch(req('/inventory',{headers:{cookie}}),env)).status,200);assert.equal((await worker.fetch(req('/api/inventory',{headers:{cookie}}),env)).status,200);
const original=globalThis.fetch;try{globalThis.fetch=fetcher;const signed=post();signed.headers.set('cookie',cookie);assert.equal((await worker.fetch(signed,env)).status,200);signed.headers.set('origin','https://evil.test');assert.equal((await worker.fetch(signed,env)).status,403);}finally{globalThis.fetch=original;}
console.log('Passed: complete pagination, sellable quantities, privacy allowlist, saved-only GET, durable snapshot, failed-refresh preservation, schema checks, concurrency lease, login gate, viewer refresh and CSRF rejection.');
