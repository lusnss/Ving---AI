import assert from 'node:assert/strict';
import {loadBranchStock,normalizeBranchStock} from './branch-stock.mjs';
import worker from './dist/server/index.js';
const req=q=>new Request('https://warroom.test/api/branch-stock'+q);
let called=0;
const missing=await loadBranchStock(req(''),{},()=>{called++;});assert.equal(missing.status,503);assert.equal((await missing.json()).status,'not_configured');assert.equal(called,0);
const fixture={ok:true,lastUpdatedAt:'2026-09-22T01:00:00Z',branches:[{id:'B01',name:'Test branch',normal:7,hold:2,lastSync:{status:'success',privateField:'excluded'},privateField:'excluded'}],skuTotals:[{sku:'TEST#40',normal:7,hold:2,total:9,branchCount:1,privateField:'excluded'}],privateField:'excluded'};
const data=normalizeBranchStock(fixture);assert.equal(data.skuTotals[0].total,9);assert.doesNotMatch(JSON.stringify(data),/excluded|privateField/);assert.throws(()=>normalizeBranchStock({...fixture,skuTotals:[{sku:'bad',normal:null,hold:0,total:0}]}));
const result=await loadBranchStock(req('?branchIds=B01&q=TEST&url=https://untrusted.test'),{BRANCH_STOCK_API_TOKEN:'test-secret'},async(url,opts)=>{assert.equal(url.origin,'https://ving-branch-stock.vercel.app');assert.equal(url.searchParams.get('branchIds'),'B01');assert.equal(url.searchParams.get('q'),'TEST');assert.equal(url.searchParams.has('url'),false);assert.equal(opts.headers['x-admin-token'],'test-secret');assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');return Response.json(fixture);});
assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');const body=await result.text();assert.doesNotMatch(body,/test-secret|excluded/);
for(const code of [401,403,500]){const response=await loadBranchStock(req(''),{BRANCH_STOCK_API_TOKEN:'test-secret'},async()=>new Response('sensitive upstream error',{status:code}));assert.equal(response.status,code===500?502:503);assert.doesNotMatch(await response.text(),/sensitive|test-secret/);}
const invalid=await loadBranchStock(req('?q='+ 'a'.repeat(121)),{BRANCH_STOCK_API_TOKEN:'test-secret'},()=>{throw Error('should not fetch')});assert.equal(invalid.status,400);
const env={SESSION_SECRET:'test',VIEWER_PASSWORD:'viewer',ADMIN_PASSWORD:'admin'};
assert.equal((await worker.fetch(req(''),env)).status,401);
const login=await worker.fetch(new Request('https://warroom.test/login',{method:'POST',body:new URLSearchParams({password:'viewer'})}),env);
const cookie=login.headers.get('set-cookie').split(';')[0];
const page=await worker.fetch(new Request('https://warroom.test/branch-stock',{headers:{cookie}}),env);assert.equal(page.status,200);assert.match(await page.text(),/data-nav="branch-stock"/);
const authorized=await worker.fetch(new Request('https://warroom.test/api/branch-stock',{headers:{cookie}}),env);assert.equal((await authorized.json()).status,'not_configured');
const mutation=await worker.fetch(new Request('https://warroom.test/api/branch-stock',{method:'POST',headers:{cookie}}),env);assert.equal(mutation.status,403);
console.log('Passed: stock setup state, schema, field allowlist, fixed upstream, secret isolation, upstream failures, query limits, session gate, viewer access and write rejection.');
// Account login must complete before reading, including source branch selection.
const accountEnv={BRANCH_STOCK_ACCOUNT_EMAIL:'test-account@example.test'};
let calls=[];
const accountResult=await loadBranchStock(req('?branchIds=B01'),accountEnv,async(url,opts)=>{
 calls.push({url:String(url),opts});
 if(String(url).endsWith('/api/auth/login')){const body=JSON.parse(opts.body);assert.equal(body.email,accountEnv.BRANCH_STOCK_ACCOUNT_EMAIL);return Response.json(body.branchId?{user:{email:body.email,role:'admin'}}:{requiresBranchSelection:true,branches:[{id:'B01'}]});}
 assert.equal(opts.headers['x-actor-email'],accountEnv.BRANCH_STOCK_ACCOUNT_EMAIL);return Response.json(fixture);
});assert.equal(accountResult.status,200);assert.equal(calls.length,3);assert.doesNotMatch(await accountResult.text(),/test-account|example.test/);
for(const role of ['staff','pc',null]){let reads=0;const denied=await loadBranchStock(req(''),accountEnv,async(url)=>{if(String(url).endsWith('/api/auth/login'))return Response.json({user:{email:accountEnv.BRANCH_STOCK_ACCOUNT_EMAIL,role}});reads++;return Response.json(fixture);});assert.equal(denied.status,503);assert.equal(reads,0);}
console.log('Passed: authorized account login, required branch selection, response privacy and denied-role rejection before stock fetch.');
// Cloudflare Workers accepts manual/follow, but throws before I/O for redirect:error.
let workerCalls=0;
const workerCompatible=await loadBranchStock(req(''),accountEnv,async(url,opts)=>{
 if(!['manual','follow'].includes(opts.redirect))throw new TypeError('Invalid redirect value');
 workerCalls++;
 if(String(url).endsWith('/api/auth/login'))return Response.json({user:{email:accountEnv.BRANCH_STOCK_ACCOUNT_EMAIL,role:'admin'}});
 return Response.json(fixture);
});assert.equal(workerCompatible.status,200);assert.equal(workerCalls,2);
let redirectedCalls=0;
const redirected=await loadBranchStock(req(''),accountEnv,async(url,opts)=>{redirectedCalls++;assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.test/'}});});assert.equal(redirected.status,502);assert.equal(redirectedCalls,1);
console.log('Passed: Worker-compatible redirect mode and blocked cross-origin redirects.');
