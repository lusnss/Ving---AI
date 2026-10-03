import assert from 'node:assert/strict';
import {parseOnlineSales} from './online-sales-parser.mjs';
import {createOnlineSales,handleOnlineSales} from './online-sales.mjs';
import {salesFreshnessText} from './out/assets/sales-freshness.mjs';
import worker from './dist/server/index.js';

const origin='https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site';
let clock=Date.parse('2026-09-25T03:00:00Z');
const fixture=(total=125,day=20)=>({name:'ยอดขาย กันยายน',values:[
  ['ลำดับ','ประเภท','รหัสสาขา','สาขา','เป้าหมาย','ยอดขายปัจจุบัน','ผู้รับผิดชอบ',...Array.from({length:30},(_,i)=>`${i+1}/9/2569`)],
  [1,'CDS','VC-999','สาขาทดสอบ',1000,total,'PRIVATE_METADATA',...Array.from({length:30},(_,i)=>i===0?total:i===day-1?0:i>24?999:'')]
]});
const parsed=parseOnlineSales([fixture()],new Date(clock).toISOString());
assert.equal(parsed.periods['2026-09'].latest_date,'2026-09-20');
assert.equal(parsed.periods['2026-09'].branches[0].daily_sales['2026-09-26'],null);
assert.equal(parsed.periods['2026-09'].branches[0].daily_sales['2026-09-02'],null);
assert.equal(parsed.periods['2026-09'].branches[0].daily_sales['2026-09-20'],0);
assert(!JSON.stringify(parsed).includes('PRIVATE_METADATA'));
const invalid=fixture();invalid.values[1][7]='#VALUE!';assert.throws(()=>parseOnlineSales([invalid]),/invalid_cells/);
const incomplete=fixture();incomplete.values[0].pop();assert.throws(()=>parseOnlineSales([incomplete]),/invalid_layout/);
assert.throws(()=>parseOnlineSales([fixture(),fixture()]),/duplicate_month/);
const serial=fixture();serial.values[0][7]=(Date.UTC(2026,8,1)-Date.UTC(1899,11,30))/86400000;
assert.equal(parseOnlineSales([serial]).periods['2026-09'].dates[0],'2026-09-01');

const records=new Map();let etag=0;
const env={MS_SALES_TENANT_ID:'example.onmicrosoft.com',MS_SALES_CLIENT_ID:'11111111-1111-4111-8111-111111111111',MS_SALES_CLIENT_SECRET:'test-client-secret',SESSION_SECRET:'test-session-secret',ADMIN_PASSWORD:'admin-test',VIEWER_PASSWORD:'viewer-test',BUCKET:{
  async get(key){const record=records.get(key);return record?{etag:record.etag,json:async()=>JSON.parse(record.text)}:null;},
  async put(key,text,options={}){const old=records.get(key),condition=options.onlyIf;if(condition?.etagMatches&&condition.etagMatches!==old?.etag||condition?.etagDoesNotMatch==='*'&&old)return null;const entry={etag:String(++etag),text};records.set(key,entry);return entry;}
}};
const request=(path,options={})=>new Request(origin+path,options);
const connect=()=>handleOnlineSales(request('/api/sales-online/connect',{method:'POST',headers:{origin}}),env,{role:'admin'});
assert.equal((await handleOnlineSales(request('/sales-online'),env,{role:'viewer'})).status,403);
assert.equal((await handleOnlineSales(request('/api/sales-online/connect',{method:'POST',headers:{origin:'https://evil.test'}}),env,{role:'admin'})).status,403);
const begun=await connect();assert.equal(begun.status,303);
const location=new URL(begun.headers.get('location')),state=location.searchParams.get('state');
assert.equal(location.hostname,'login.microsoftonline.com');assert.equal(location.searchParams.get('code_challenge_method'),'S256');
assert(!location.href.includes('test-client-secret'));assert.match(begun.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
const oauthCookie=begun.headers.get('set-cookie').split(';')[0];
assert.equal((await handleOnlineSales(request('/api/sales-online/callback?state='+state+'&code=abc'),env,null)).status,400);
const originalFetch=globalThis.fetch;let exchanges=0;
try {
  globalThis.fetch=async (url,options)=>{assert(String(url).startsWith('https://login.microsoftonline.com/'));assert.equal(options.method,'POST');assert(options.body.get('code_verifier'));exchanges++;return Response.json({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:86400});};
  const callback=request('/api/sales-online/callback?state='+state+'&code=abc',{headers:{cookie:oauthCookie}});
  assert.equal((await handleOnlineSales(callback,env,null)).status,200);
  assert.equal((await handleOnlineSales(callback,env,null)).status,400);
  assert.equal(exchanges,1);
}finally{globalThis.fetch=originalFetch;}
const stored=records.get('sales-online/connection.json').text;
assert(!stored.includes('test-access-token'));assert(!stored.includes('test-refresh-token'));

let total=125,fail=false,reads=0;
const source=async (url,options)=>{
  assert(String(url).startsWith('https://graph.microsoft.com/v1.0/'));
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer test-access-token');
  reads++;
  if(fail)return new Response('',{status:503});
  if(String(url).includes('/shares/'))return Response.json({id:'item-id',name:'Sales Report 2026 PC VING.xlsx',parentReference:{driveId:'drive-id'},sharepointIds:{listItemUniqueId:'4683c9ce-44c2-4d99-93c7-575cffefc84b'}});
  if(String(url).includes('usedRange'))return Response.json({values:fixture(total).values});
  return Response.json({value:[{name:'ยอดขาย กันยายน',id:'sheet-id'}]});
};
// Use the real current epoch for token expiry while retaining a deterministic
// September parser fixture. The report's imported timestamp is never fabricated.
clock=Date.now();
const loader=createOnlineSales({fetchImpl:source,now:()=>clock});
const snapshot={data:{'/api/daily-sales':{periods:{'2025-09':{branches:[]}},source:{}}}};
let jobs=[];const ctx={waitUntil:p=>jobs.push(p)};
let response=await loader.apply(snapshot,env,ctx);assert.equal(response.salesOnline.status,'waiting');
await Promise.all(jobs);assert.equal(reads,3);
response=await loader.apply(snapshot,env,ctx);
assert.equal(response.salesSync.mode,'online');assert.equal(response.data['/api/daily-sales'].periods['2026-09'].branches[0].month_to_date,125);
assert(response.data['/api/daily-sales'].periods['2025-09']);assert(!JSON.stringify(response).includes('test-access-token'));
assert(!records.get('sales-online/report.json').text.includes('PRIVATE_METADATA'));
await loader.refresh(env);assert.equal(reads,3,'do not fetch before the polling interval');
clock+=61000;total=75;jobs=[];
await loader.apply(snapshot,env,ctx);await Promise.all(jobs);
response=await loader.apply(snapshot,env);
assert.equal(response.data['/api/daily-sales'].periods['2026-09'].branches[0].month_to_date,75,'same-day downward corrections replace previous values');
const goodStamp=response.salesOnline.fetchedAt;
clock+=61000;fail=true;await loader.refresh(env);
response=await loader.apply(snapshot,env);
assert.equal(response.salesOnline.status,'stale');assert.equal(response.salesOnline.fetchedAt,goodStamp);
assert.equal(response.data['/api/daily-sales'].periods['2026-09'].branches[0].month_to_date,75);
assert.match(salesFreshnessText(response,clock),/อ่าน Excel ล่าสุดไม่ได้/);
assert.equal((await loader.apply(snapshot,{...env,MS_SALES_CLIENT_ID:undefined},ctx)).salesOnline.status,'setup_required');
clock+=61000;fail=false;
const other=createOnlineSales({fetchImpl:source,now:()=>clock}),before=reads;
await Promise.all([loader.refresh(env),other.refresh(env)]);assert.equal(reads-before,3,'R2 lease coalesces refreshes across isolates');
assert.equal(snapshot.data['/api/daily-sales'].periods['2026-09'],undefined,'caller snapshot is unchanged');
const reconnect=JSON.parse(records.get('sales-online/connection.json').text);reconnect.id='new-connection';
await env.BUCKET.put('sales-online/connection.json',JSON.stringify(reconnect));
response=await loader.apply(snapshot,env);
assert.equal(response.salesOnline.status,'waiting');
assert.equal(response.data['/api/daily-sales'].periods['2026-09'].branches[0].month_to_date,75,'keep last good sales during reconnect');
fail=true;await loader.refresh(env);response=await loader.apply(snapshot,env);
assert.equal(response.salesOnline.status,'stale');assert.equal(response.data['/api/daily-sales'].periods['2026-09'].branches[0].month_to_date,75,'a failed new connection does not erase the old good report');

// Built Worker integration: server-side administrator restriction and a working
// setup page without credentials; source access cannot be enabled by a viewer.
const bare={...env,MS_SALES_CLIENT_ID:undefined};
assert.equal((await worker.fetch(request('/sales-online'),bare)).status,303);
for(const [password,status] of [['viewer-test',403],['admin-test',200]]){
  const login=await worker.fetch(request('/login',{method:'POST',body:new URLSearchParams({password})}),bare);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const page=await worker.fetch(request('/sales-online',{headers:{cookie}}),bare);
  assert.equal(page.status,status);
  if(status===200)assert.match(await page.text(),/ยังต้องตั้งค่าการเชื่อมต่อ Microsoft/);
}
console.log('Passed: online sales parsing, privacy, OAuth PKCE/state/replay, encrypted tokens, automatic polling, corrections, failure fallback, cross-isolate lease, historical preservation and Worker permissions.');
