// Run with a Playwright installation; set PLAYWRIGHT_MODULE when it is supplied by the host.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.CAPTURE_BROWSER==='webkit'?webkit:chromium;
const root=fileURLToPath(new URL('../out/',import.meta.url));
const fixture=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>
body{margin:0;background:#17212b;color:white;font:20px sans-serif}main{height:2000px;padding:24px}
select{background:#26333e url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='%23d6bc82'/%3E%3C/svg%3E") no-repeat right center;color:white;width:250px;height:50px;appearance:none}
.marker{position:absolute;left:80px;top:320px;width:300px;height:160px;background:#dc4632}
</style><main><h1>ทดสอบภาพรายงาน VING</h1><select><option>กันยายน 2569</option></select><p>ยอดขาย 1,234.56 บาท</p><svg width="50" height="30" viewBox="0 0 50 30"><path d="M0 25L20 5L50 15" stroke="white" fill="none"/></svg><div class="marker"></div></main><script type="module">import {enableCapture} from '/assets/screen-capture.mjs';enableCapture();</script>`;
const server=http.createServer(async(req,res)=>{try{
 if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end(fixture);return;}
 const pathname=new URL(req.url,'http://test').pathname;
 if(!/^\/assets\/[\w.-]+\.(mjs|css)$/.test(pathname)){res.writeHead(404);res.end();return;}
 res.setHeader('content-type',pathname.endsWith('.mjs')?'text/javascript':'text/css');res.end(await fs.readFile(root+pathname));
}catch{res.writeHead(500);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chromium'}:{})});
 const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const originalBackground=await page.locator('select').evaluate(el=>getComputedStyle(el).backgroundImage);
 async function download(action,expected){
  const pending=page.waitForEvent('download',{timeout:30000});await action();const file=await pending;
  assert.equal(await file.failure(),null);const png=await fs.readFile(await file.path());
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);assert.ok(width>0&&height>0);
  if(expected)assert.deepEqual({width,height},expected);
  // Decode the real download and confirm the selected red report marker survived rendering.
  const red=await page.evaluate(async base64=>{
   const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]<100&&pixels[i+2]<90)count++;
   canvas.width=canvas.height=0;return count;
  },png.toString('base64'));assert.ok(red>1000,'Report content must be present in the PNG');
  await page.waitForFunction(()=>!document.body.dataset.captureBusy);
  assert.match(await page.locator('.capture-bar [role=status]').textContent(),/ดาวน์โหลดภาพ PNG แล้ว/);
  assert.equal(await page.locator('.html2canvas-container').count(),0);
  console.log(engine.name(),expected?'selected area':'full page',width,height,'PNG verified');
 }
 await download(()=>page.getByRole('button',{name:'แคปทั้งหน้า',exact:true}).click());
 await page.evaluate(()=>window.scrollTo(0,200));
 await download(async()=>{
  await page.getByRole('button',{name:'ลากเลือกพื้นที่',exact:true}).click();
  await page.mouse.move(50,100);await page.mouse.down();await page.mouse.move(450,400);await page.mouse.up();
 },{width:400,height:300});
 // A second full capture after scrolling catches stale selection/busy state and canvas reuse.
 await download(()=>page.getByRole('button',{name:'แคปทั้งหน้า',exact:true}).click());
 assert.equal(await page.locator('select').evaluate(el=>getComputedStyle(el).backgroundImage),originalBackground);
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
