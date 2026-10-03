import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const seed=JSON.parse(await fs.readFile(new URL('../branch-profit.snapshot.json',import.meta.url)));
const server=http.createServer(async(req,res)=>{try{
 if(req.url==='/api/branch-profit'){res.setHeader('content-type','application/json');res.end(JSON.stringify({...seed,rawMonths:Object.values(seed.rawMonths)}));return;}
 if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/branch-profit.css"><body class="gp-theme"><main class="gp-page" id="app"></main><script type="module">import {render} from "/assets/branch-profit.mjs";render(document.querySelector("main"));</script>');return;}
 res.setHeader('content-type',req.url.endsWith('.mjs')?'text/javascript':'text/css');res.end(await fs.readFile(new URL('../out'+req.url,import.meta.url)));
 }catch(e){res.writeHead(500);res.end(e.message);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
if(process.argv.includes('--serve')){console.log('http://127.0.0.1:'+server.address().port);await new Promise(()=>{});}
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#gp-branch').waitFor();
 await page.locator('#gp-month').selectOption('09');
 assert.equal(await page.locator('.gp-cost-ratio strong').textContent(),'26.81%');
 const input=page.locator('#gp-branch');await input.fill('westgate');
 assert.ok(await page.getByRole('option').count()>0);
 await page.getByRole('option').first().click();
 assert.match(await input.inputValue(),/westgate/i);assert.equal(await input.getAttribute('aria-expanded'),'false');
 const branchRatio=await page.locator('.gp-cost-ratio strong').textContent();assert.notEqual(branchRatio,'—');
 assert.equal(await page.locator('.gp-table tbody tr').count(),1);
 const selected=await input.inputValue();await input.fill('ไม่มีสาขานี้แน่นอน');assert.equal(await page.getByRole('option').count(),0);
 await input.press('Escape');assert.equal(await input.inputValue(),selected);
 await input.fill('ทุกสาขา');await input.press('ArrowDown');await input.press('Enter');
 assert.equal(await input.inputValue(),'ทุกสาขา');assert.equal(await page.locator('.gp-cost-ratio strong').textContent(),'26.81%');
 await input.fill('ขอนแก่น');assert.ok(await page.getByRole('option').count()>0);await input.press('ArrowDown');await input.press('Enter');assert.match(await input.inputValue(),/ขอนแก่น/);
 await input.fill('123notfound');await page.locator('h1').click();assert.match(await input.inputValue(),/ขอนแก่น/);
 await input.fill('ทุกสาขา');await input.press('Enter');
 await page.locator('#gp-year').selectOption('2025');assert.equal(await page.locator('.gp-cost-ratio strong').textContent(),'—');
 await page.locator('#gp-year').selectOption('2026');
 await page.screenshot({path:'/tmp/branch-profit-desktop.png'});
 await page.setViewportSize({width:390,height:844});await input.fill('CDS');
 assert.ok(await page.getByRole('option').count()>0);
 const box=await page.getByRole('listbox').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/branch-profit-mobile.png'});
 await page.getByRole('option').first().click();assert.equal(await input.getAttribute('aria-expanded'),'false');
 assert.deepEqual(errors,[]);console.log('PASS: English/Thai search, mouse/keyboard selection, no matches, cancel, reset, filters, percentage, empty data and mobile layout');
}finally{await browser?.close();server.close();}
