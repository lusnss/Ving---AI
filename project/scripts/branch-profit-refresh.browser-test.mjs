import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {handleBranchProfit} from '../branch-profit-data.mjs';
import {previewDatabase} from '../preview-db.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const today=new Date(Date.now()+7*3600000).toISOString().slice(0,7),year=today.slice(0,4),month=today.slice(5),priorYear=String(Number(year)-1);
const initial={month:priorYear+'-09',updatedAt:priorYear+'-09-30T00:00:00Z',asOf:priorYear+'-09-30',products:{7:{sku:'TEST',product:'Test product'}},branches:{3:{erp:'Test branch'}},totals:{order_id:1},rows:[[priorYear+'-09-01',3,7,1,107,0,107,1,1]]};
const seed={rawMonths:{[initial.month]:initial},productMap:{7:{key:'TEST',status:'actual',unitCost:40}},branches:{3:{display:'Test branch',type:'Test type'}}};
const DB=previewDatabase(),env={DB,ODOO_LOGIN:'test',ODOO_PASSWORD:'test',ODOO_DATABASE:'test'},posts=[],domains=[],errors=[];
let releaseRefresh,holdRefresh=false,failRefresh=false,sales=214;
const fetcher=async(url,options)=>{
 if(failRefresh)throw Error('test connection failure');
 if(url.endsWith('/authenticate'))return Response.json({result:{uid:1}},{headers:{'set-cookie':'session_id=test; Path=/'}});
 const q=JSON.parse(options.body).params.kwargs;domains.push(q.domain);
 const metric={product_qty:1,price_sub_total:sales,total_discount:0,price_total:sales,order_id:1,__count:1};
 return Response.json({result:[{...metric,...(q.groupby.length?{config_id:[3,'Test branch'],product_id:[7,'[TEST] Test product'],__range:{date:{from:q.domain[0][2]}}}:{})}]});
};
const server=http.createServer(async(req,res)=>{try{
 const origin='http://127.0.0.1:'+server.address().port;
 if(req.url.startsWith('/api/branch-profit')){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString();
  if(req.method==='POST'){posts.push(JSON.parse(body).period);if(holdRefresh)await new Promise(resolve=>{releaseRefresh=resolve;});}
  const response=await handleBranchProfit(new Request(origin+req.url,{method:req.method,headers:req.headers,...(body?{body}:{})}),env,seed,fetcher);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(req.url==='/'){
  res.setHeader('content-type','text/html');res.end('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/branch-profit.css"><body class="gp-theme"><main class="gp-page" id="app"></main><script type="module">import {render} from "/assets/branch-profit.mjs";render(document.querySelector("main"));</script>');return;
 }
 res.setHeader('content-type',req.url.endsWith('.mjs')?'text/javascript':'text/css');res.end(await fs.readFile(new URL('../out'+req.url,import.meta.url)));
}catch(error){res.writeHead(500);res.end(error.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('#gp-year').selectOption(year);await page.locator('#gp-month').selectOption(month);
 const before=posts.length;holdRefresh=true;
 await page.locator('#gp-sync').click();
 await page.waitForFunction(()=>document.querySelector('#gp-sync').disabled);
 assert.equal(await page.locator('#gp-year').isDisabled(),true);assert.equal(await page.locator('#gp-month').isDisabled(),true);
 assert.match(await page.locator('#gp-sync').textContent(),new RegExp(year));
 // Repeated clicks cannot enqueue a second request while this month is loading.
 await page.locator('#gp-sync').evaluate(button=>{button.click();button.click();});
 const releaseDeadline=Date.now()+5000;
 while(!releaseRefresh&&Date.now()<releaseDeadline)await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(releaseRefresh,'Refresh POST must reach the backend within 5 seconds');
 holdRefresh=false;releaseRefresh();
 await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);
 assert.deepEqual(posts.slice(before),[today]);
 assert.equal(await page.locator('#gp-year').isDisabled(),false);assert.equal(await page.locator('#gp-month').isDisabled(),false);
 assert.equal(await page.locator('.gp-grid .gp-number').first().textContent(),'200.00');
 assert.match(await page.locator('#gp-message').textContent(),/สำเร็จ/);
 assert.ok(domains.every(domain=>domain[0][2]===new Date(Date.UTC(Number(year),Number(month)-1,1,-7)).toISOString().slice(0,19).replace('T',' ')));

 // Preserve day/type/branch display filters while refreshing the selected month.
 await page.locator('#gp-day').selectOption(today+'-01');await page.locator('#gp-type').selectOption('Test type');
 await page.locator('#gp-branch').fill('Test branch');await page.locator('[role="option"]').first().click();
 sales=321;await page.locator('#gp-sync').click();await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);
 assert.equal(posts.at(-1),today);assert.equal(await page.locator('#gp-day').inputValue(),today+'-01');
 assert.equal(await page.locator('#gp-type').inputValue(),'Test type');assert.equal(await page.locator('#gp-branch').inputValue(),'Test branch');
 assert.equal(await page.locator('.gp-grid .gp-number').first().textContent(),'300.00');

 failRefresh=true;await page.locator('#gp-sync').click();await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);
 assert.match(await page.locator('#gp-message').textContent(),/ไม่สำเร็จ/);assert.equal(await page.locator('.gp-grid .gp-number').first().textContent(),'300.00');
 assert.equal(await page.locator('#gp-month').isDisabled(),false);
 failRefresh=false;await page.locator('#gp-sync').click();await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);assert.equal(posts.at(-1),today);

 await page.locator('#gp-year').selectOption(priorYear);await page.locator('#gp-month').selectOption('02');
 assert.equal(await page.locator('#gp-message').isHidden(),true);
 await page.locator('#gp-sync').click();await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);
 assert.equal(posts.at(-1),priorYear+'-02');assert.equal(await page.locator('#gp-year').inputValue(),priorYear);assert.equal(await page.locator('#gp-month').inputValue(),'02');

 // Read the values visible at click time even before a change event is delivered.
 await page.locator('#gp-month').evaluate(select=>{select.value='03';});
 await page.locator('#gp-sync').click();await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);
 assert.equal(posts.at(-1),priorYear+'-03');assert.equal(await page.locator('#gp-month').inputValue(),'03');

 await page.locator('#gp-year').selectOption(year);await page.locator('#gp-month').selectOption('');const annualStart=posts.length;
 await page.locator('#gp-sync').click();await page.waitForFunction(()=>!document.querySelector('#gp-sync').disabled);
 assert.deepEqual(posts.slice(annualStart),Array.from({length:Number(month)},(_,i)=>year+'-'+String(i+1).padStart(2,'0')));
 if(Number(month)<12){
  await page.locator('#gp-month').selectOption(String(Number(month)+1).padStart(2,'0'));const futureStart=posts.length;
  await page.locator('#gp-sync').click();await page.waitForFunction(()=>document.querySelector('#gp-message').textContent.includes('ยังไม่ถึงช่วงเวลาที่เลือก'));
  assert.equal(posts.length,futureStart);
 }
 const stored=await handleBranchProfit(new Request('https://test.site/api/branch-profit'),env,seed);
 assert.equal((await stored.json()).rawMonths.find(item=>item.month===initial.month).rows[0][6],107);
 assert.deepEqual(errors,[]);
 console.log('PASS: selected month/year, visible selection at click, period lock, duplicate clicks, updated totals, display filters, failure/retry, annual bounds, future month and untouched cached months');
}finally{releaseRefresh?.();await browser?.close();server.close();DB.close();}
