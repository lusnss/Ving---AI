// One-shot local handoff: Excel Online output -> validated sales-only endpoint.
// No workbook downloads or Microsoft credentials are used by this process.
import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {validateCloudSales} from '../cloud-sales.mjs';

const origin='http://127.0.0.1:8768';
const destination='https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site/api/sync/daily-sales';
const token=(await fs.readFile(new URL('../.sites-runtime/cloud-sales-secret',import.meta.url),'utf8')).trim();
const nonce=crypto.randomBytes(24).toString('hex');
let uploading=false;
const server=http.createServer(async(req,res)=>{
  const send=(status,body,type='text/html; charset=utf-8')=>{
    res.writeHead(status,{'content-type':type,'cache-control':'no-store','content-security-policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(body);
  };
  if(req.headers.host!=='127.0.0.1:8768')return send(403,'Forbidden');
  if(req.method==='GET'&&req.url==='/')return send(200,`<!doctype html><html lang="th"><meta charset="utf-8"><title>VING Online Sales</title><h1>ส่งยอดจาก Excel ออนไลน์เข้าเว็บ VING</h1><p>รับเฉพาะข้อมูลยอดขายจากสคริปต์ VING Export Sales Report</p><form method="post" action="/sync"><input type="hidden" name="nonce" value="${nonce}"><label for="payload">ข้อมูลยอดขายออนไลน์</label><br><textarea id="payload" name="payload" rows="12" cols="70" required></textarea><br><button type="submit">ตรวจสอบและส่งยอดเข้าเว็บ</button></form></html>`);
  if(req.method!=='POST'||req.url!=='/sync')return send(404,'Not found');
  if(req.headers.origin!==origin||uploading)return send(403,'Forbidden');
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw Error('Payload too large');chunks.push(chunk);}
    const fields=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    if(fields.get('nonce')!==nonce)return send(403,'Forbidden');
    const input=JSON.parse(fields.get('payload'));
    const {key,report}=validateCloudSales(input);
    // Send only the sanitizer's allow-listed fields and original export timestamp.
    const payload={...report,exportedAt:input.exportedAt};
    uploading=true;
    const response=await fetch(destination,{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('Website rejected update (HTTP '+response.status+')');
    const result=await response.json();
    const p=report.periods[key];
    const summary={...result,branches:p.branches.length,dailyTotal:p.branches.reduce((sum,b)=>sum+(b.daily_sales[p.latest_date]??0),0),monthToDate:p.branches.reduce((sum,b)=>sum+b.month_to_date,0)};
    console.log(JSON.stringify(summary));
    send(200,'<!doctype html><meta charset="utf-8"><title>VING อัปเดตสำเร็จ</title><h1>อัปเดตยอดขายออนไลน์สำเร็จ</h1><pre>'+JSON.stringify(summary,null,2)+'</pre><a href="https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site/daily-sales">ตรวจยอดบนเว็บ VING</a>');
    server.close();
  }catch(error){uploading=false;console.error(error.message);send(400,'ตรวจสอบหรือส่งข้อมูลไม่สำเร็จ กรุณารันสคริปต์ใหม่ แล้วลองอีกครั้ง');}
});
server.listen(8768,'127.0.0.1',()=>console.log('Ready: '+origin));
setTimeout(()=>server.close(),15*60*1000).unref();
