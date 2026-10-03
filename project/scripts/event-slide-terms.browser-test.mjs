import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {prepareEventRequest} from '../event-requests.mjs';
const body={id:'10000000-0000-4000-8000-000000000000',place:'พื้นที่ทดสอบ',startDate:'2026-10-01',endDate:'2026-10-07',referenceKey:'manual',input:{mode:'manual',salesMode:'cost-target',channel:'direct',days:7,cogs:22.5,rent:31500,gp:0,pc:700,pcCount:1,pcCostMode:'person',shipping:3000,other:0,targetMode:'roi',roiPercent:40,expectedSales:'',target:'',downside:10,upside:10,proposalDate:'2026-09-27',confirmBy:'2026-09-30',proposalScenario:'base'}};
let row={...prepareEventRequest(body,{records:[]}),deletionKey:'web:'+body.id},patches=0;
const server=http.createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/')){
  res.setHeader('content-type','application/json');
  if(req.method==='PATCH'){const chunks=[];for await(const c of req)chunks.push(c);const edit=JSON.parse(Buffer.concat(chunks));assert.equal(edit.revision,row.updatedAt||row.createdAt);row={...prepareEventRequest(edit,{records:[]}),deletionKey:row.deletionKey,updatedAt:new Date().toISOString()};patches++;res.end('{"ok":true}');}
  else res.end(JSON.stringify({item:row,source:{}}));return;
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/event-slide.css"><script type="module">import {openEventSlide} from "/assets/event-slide.mjs";window.openSlide=async(canEdit=true)=>openEventSlide((await (await fetch("/api/detail")).json()).item,{},null,{canEdit,onSaved:()=>window.refreshed=true});await openSlide();</script>');return;}
 res.setHeader('content-type',req.url.endsWith('.mjs')?'text/javascript':'text/css');res.end(await fs.readFile(new URL('../out'+req.url,import.meta.url)));
}catch(e){res.writeHead(500);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('[data-term=rent]').waitFor();
 await page.locator('[data-term=rent]').fill('40000');await page.locator('[data-term=pc]').fill('800');
 await page.locator('.event-slide-forecast-input').fill('85000');
 assert.match(await page.locator('.event-slide-status').textContent(),/48,600/);
 await page.locator('[data-slide-save]').click();await page.waitForFunction(()=>window.refreshed);
 assert.equal(patches,1);assert.equal(row.calculation.fixedCosts,48600);assert.equal(row.input.rent,'40000');
 await page.locator('[data-term=cogs]').fill('101');assert.equal(await page.locator('[data-slide-save]').isDisabled(),true);
 await page.locator('[data-slide-reset]').click();assert.equal(await page.locator('[data-term=cogs]').inputValue(),'22.5');
 await page.screenshot({path:'/tmp/event-slide-terms.png'});
 await page.locator('[data-slide-close]').click();await page.evaluate(()=>openSlide(false));assert.equal(await page.locator('.event-slide-terms-editor').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: inline edit, recalculation, save, reload, invalid values, reset, read-only');
}finally{await browser?.close();server.close();}
