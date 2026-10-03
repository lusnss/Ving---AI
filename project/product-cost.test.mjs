import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildProductCosts,productCostItems,productCostSource,createProductCostLoader,costNumber} from './product-cost-data.mjs';
import {filterCosts,costStatus,productCostMarkup} from './out/assets/product-costs.mjs';
const snapshot=JSON.parse(await fs.readFile(new URL('./product-cost.snapshot.json',import.meta.url)));
const fallback={version:1,source:{...productCostSource,fetched_at:snapshot.importedAt,status:'saved'},items:productCostItems(snapshot.rows)};
const header=Array(33).fill('');Object.assign(header,{0:'MODEL',1:'GRADE',2:'TYPE',4:'FACTORY',18:'EXTRA',19:'TOTAL PKG',26:'MAX',27:'MIN',28:'FG EX.VAT',29:'ค่านำสินค้าเข้าคลัง',30:'VAT7%',31:'FG INC.VAT'});
const csv=rows=>[[],header,[],[],['รุ่น'],...rows].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
test('all 95 imported rows preserve source costs, factories, grades, zeroes and missing cells',()=>{
 const data=buildProductCosts(csv(snapshot.rows));assert.equal(data.items.length,95);
 for(const [i,r] of data.items.entries()){
  const input=snapshot.rows[i];assert.equal(r.model,input[0]);assert.equal(r.sourceRow,i+6);
  for(const [field,index] of Object.entries({beforeVat:28,warehouse:29,vat:30,includingVat:31}))assert.equal(r[field],costNumber(input[index]));
 }
 const torani=data.items.filter(r=>r.model==='TORANI');assert.equal(torani.length,2);assert.deepEqual(torani.map(r=>r.includingVat),[176.55,164.81]);
 const wet=data.items.at(-1);assert.equal(wet.includingVat,null);assert.equal(wet.vat,0);assert.equal(costStatus(wet),'review');
 const zero=data.items.find(r=>r.model==='TORANI_B'&&r.factory==='GTR');assert.equal(zero.beforeVat,0);assert.equal(zero.includingVat,5.35);assert.equal(costStatus(zero),'review');
 assert.equal(productCostItems([...snapshot.rows,['TAIXIN','Grade',null,'Cost']]).length,95);
});
test('rejects schema changes and malformed costs; supports intersected filters and escaped source text',()=>{
 assert.throws(()=>buildProductCosts('<html>Login</html>'));assert.throws(()=>buildProductCosts(csv(snapshot.rows).replace('FG INC.VAT','WRONG')));assert.throws(()=>costNumber('#REF!'));
 assert.equal(filterCosts(fallback.items,{query:'TORANI',grade:'A',factory:'GTR'}).length,1);
 assert.equal(filterCosts(fallback.items,{type:'Apparel'}).length,9);
 const markup=productCostMarkup({...fallback,items:[{...fallback.items[0],model:'<script>bad()</script>'}]});assert.ok(!markup.includes('<script>'));assert.ok(markup.includes('&lt;script&gt;'));
});
test('refresh coalesces; source errors retain last success; recovery and empty sheet are explicit',async()=>{
 let clock=Date.now(),offline=false,body=csv(snapshot.rows),calls=0;const values=new Map();const env={BUCKET:{get:async k=>values.has(k)?{json:async()=>JSON.parse(values.get(k))}:null,put:async(k,v)=>values.set(k,v)}};
 const loader=createProductCostLoader({now:()=>clock,fetchImpl:async url=>{assert.equal(new URL(url).searchParams.get('gid'),'0');calls++;if(offline)throw Error();return new Response(body);}});
 const [a,b]=await Promise.all([loader(env,fallback),loader(env,fallback)]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.source.status,'online');
 clock+=61000;offline=true;const stale=await loader(env,fallback);assert.equal(stale.items.length,95);assert.equal(stale.source.fetched_at,a.source.fetched_at);assert.equal(stale.source.status,'stale');
 clock+=61000;offline=false;body='<html>Login</html>';assert.equal((await loader(env,fallback)).items.length,95);
 clock+=61000;body=csv([]);assert.equal((await loader(env,fallback)).items.length,0);
 assert.equal((await createProductCostLoader({fetchImpl:async()=>{throw Error();}})({},fallback)).items.length,95);
});
test('authenticated route, API and assets load; costs cannot be modified',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(csv(snapshot.rows));
 const {default:worker}=await import('./dist/server/index.js?cost-tests');globalThis.fetch=original;
 const env={SESSION_SECRET:'local-cost-test-secret',ADMIN_PASSWORD:'test-cost-admin',VIEWER_PASSWORD:'test-cost-viewer',BUCKET:{get:async()=>null,put:async()=>{}}};
 const request=(path,cookie,method='GET')=>new Request('https://local.test'+path,{method,headers:{cookie:cookie||'',origin:'https://local.test'}});
 assert.equal((await worker.fetch(request('/api/product-costs'),env)).status,401);
 assert.equal((await worker.fetch(request('/product-costs'),env)).status,303);
 for(const password of [env.ADMIN_PASSWORD,env.VIEWER_PASSWORD]){
  const auth=await worker.fetch(new Request('https://local.test/login',{method:'POST',body:new URLSearchParams({password})}),env);const cookie=auth.headers.get('set-cookie').split(';')[0];
  for(const path of ['/product-costs','/assets/product-costs.mjs','/assets/product-costs.css'])assert.equal((await worker.fetch(request(path,cookie),env)).status,200);
  const data=await(await worker.fetch(request('/api/product-costs',cookie),env)).json();assert.equal(data.items.length,95);
  assert.equal((await worker.fetch(request('/api/product-costs',cookie,'POST'),env)).status,password===env.ADMIN_PASSWORD?405:403);
 }
 for(const file of await fs.readdir('out'))if(file.endsWith('.html'))assert.match(await fs.readFile('out/'+file,'utf8'),/href="\/product-costs"/);
});
