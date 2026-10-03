import { sanitizeDailySales } from './sanitize.mjs';
import { applyOnlineSales } from './online-sales.mjs';

const CLOUD_REPORT_KEY = 'daily-sales-cloud.json';
const cloudJson = (body, status=200) => Response.json(body, {status, headers:{'cache-control':'no-store'}});
const bangkokDate = (now) => new Date(now + 7*3600000).toISOString().slice(0,10);
async function cloudAuthorized(request, secret) {
  const enc=new TextEncoder();
  const [actual,expected]=await Promise.all([request.headers.get('authorization')||'','Bearer '+secret].map(s=>crypto.subtle.digest('SHA-256',enc.encode(s))));
  const a=new Uint8Array(actual),b=new Uint8Array(expected);let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}

export function validateCloudSales(input, now=Date.now()) {
  const stamp=Date.parse(input?.exportedAt);
  if(!Number.isFinite(stamp)||Math.abs(now-stamp)>15*60000)throw Error('Invalid export timestamp');
  const keys=Object.keys(input?.periods||{});
  if(keys.length!==1||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(keys[0]))throw Error('Expected one report month');
  const key=keys[0], raw=input.periods[key];
  if(!Array.isArray(raw?.branches)||!raw.branches.length||raw.branches.length>1000)throw Error('Invalid branches');
  const report=sanitizeDailySales(input), period=report.periods[key];
  if(!period||!period.branches.length||period.branches.length!==raw.branches.length)throw Error('Invalid report');
  for(const branch of raw.branches){
    if(typeof branch.branch!=='string'||!branch.branch.trim())throw Error('Missing branch name');
    for(const value of [branch.month_to_date,branch.target])if(typeof value!=='number'||!Number.isFinite(value))throw Error('Invalid total');
    for(const [date,value] of Object.entries(branch.daily_sales||{})){
      if(!period.dates.includes(date)||!(value===null||typeof value==='number'&&Number.isFinite(value)))throw Error('Invalid daily amount');
      if(date>bangkokDate(now)&&value!==null)throw Error('Future sales must be blank');
    }
  }
  const latest=raw.latest_date;
  if(!latest||latest!==period.latest_date||latest>bangkokDate(now)||!period.branches.some(b=>b.daily_sales[latest]!=null))throw Error('Missing latest reported day');
  period.source={as_of_date:latest,fetched_at:new Date(stamp).toISOString()};
  report.source={...period.source};
  return {key,report,stamp};
}

export async function receiveCloudSales(request, env) {
  if(request.method!=='PUT')return cloudJson({error:'Method not allowed'},405);
  if(!env.CLOUD_SALES_TOKEN)return cloudJson({error:'Cloud connection is not configured'},503);
  // This credential can update sales only; it cannot replace the whole site snapshot.
  if(!await cloudAuthorized(request,env.CLOUD_SALES_TOKEN))return cloudJson({error:'Unauthorized'},401);
  let input;
  try {
    if(Number(request.headers.get('content-length'))>2_000_000)return cloudJson({error:'Too large'},413);
    const body=await request.text();
    if(new TextEncoder().encode(body).length>2_000_000)return cloudJson({error:'Too large'},413);
    input=validateCloudSales(JSON.parse(body));
  } catch {return cloudJson({error:'Invalid sales report; previous data was kept'},400);}
  try {
    const previous=await env.BUCKET.get(CLOUD_REPORT_KEY);
    const saved=previous?sanitizeDailySales(await previous.json()):{version:2,periods:{}};
    const old=saved.periods[input.key];
    if(old&&(Date.parse(old.source.fetched_at)>input.stamp||old.latest_date>input.report.periods[input.key].latest_date))return cloudJson({error:'Older report rejected'},409);
    saved.periods[input.key]=input.report.periods[input.key];
    saved.source=Object.values(saved.periods).map(p=>p.source).sort((a,b)=>Date.parse(b.fetched_at)-Date.parse(a.fetched_at))[0];
    const result=await env.BUCKET.put(CLOUD_REPORT_KEY,JSON.stringify(saved),{
      httpMetadata:{contentType:'application/json'},
      onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'}
    });
    if(!result)return cloudJson({error:'Concurrent update; retry this report'},409);
    return cloudJson({ok:true,period:input.key,latestDate:input.report.periods[input.key].latest_date,importedAt:new Date().toISOString()});
  } catch {return cloudJson({error:'Unable to save sales report'},503);}
}

export async function applyCloudSales(snapshot, env, ctx) {
  const object=await env.BUCKET.get(CLOUD_REPORT_KEY);
  if(!object)return applyOnlineSales(snapshot,env,ctx);
  const cloud=sanitizeDailySales(await object.json());
  if(!Object.keys(cloud.periods).length)return applyOnlineSales(snapshot,env,ctx);
  const local=sanitizeDailySales(snapshot.data['/api/daily-sales']);
  // Stored separately from snapshot.json so the Mac cannot overwrite cloud reports.
  const daily={version:2,source:cloud.source,periods:{...local.periods,...cloud.periods}};
  return applyOnlineSales({...snapshot,data:{...snapshot.data,'/api/daily-sales':daily},salesSync:{mode:'cloud',periodKeys:Object.keys(cloud.periods),fetchedAt:cloud.source.fetched_at,asOfDate:Object.values(cloud.periods).map(p=>p.latest_date).filter(Boolean).sort().at(-1)}},env,ctx);
}
