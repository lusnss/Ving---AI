import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import worker from './dist/server/index.js';
const stored=new Map();
const env={SESSION_SECRET:'test-signing-secret',VIEWER_PASSWORD:'test-viewer',ADMIN_PASSWORD:'test-admin',SYNC_TOKEN:'test-only-secret',BUCKET:{async put(key,value){stored.set(key,value);},async get(key){const value=stored.get(key);return value?{json:async()=>JSON.parse(value)}:null;}}};
const req=(url,options={})=>new Request('https://example.test'+url,options);
assert.equal((await worker.fetch(req('/api/sync',{method:'PUT',body:'{}'}),env)).status,401);
assert.equal((await worker.fetch(req('/api/content_items',{method:'POST',body:'{}'}),env)).status,401);
assert.equal((await worker.fetch(req('/api/event-proposals'),env)).status,401);
const locked=await worker.fetch(req('/sales'),env);assert.equal(locked.status,303);assert.match(locked.headers.get('location'),/\/login\?next=%2Fsales$/);
const lockedDaily=await worker.fetch(req('/daily-sales'),env);assert.equal(lockedDaily.status,303);assert.match(lockedDaily.headers.get('location'),/\/login\?next=%2Fdaily-sales$/);
const loginBackground=await worker.fetch(req('/assets/login-hero.png'),env);assert.equal(loginBackground.status,200);assert.equal(loginBackground.headers.get('content-type'),'image/png');
const rejected=await worker.fetch(req('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=wrong&next=%2Fsales'}),env);assert.equal(rejected.status,303);assert.match(rejected.headers.get('location'),/error=1.*next=%2Fsales/);
const loggedIn=await worker.fetch(req('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=test-viewer&next=%2Fsales'}),env);assert.equal(loggedIn.status,303);assert.equal(loggedIn.headers.get('location'),'/sales');const cookie=loggedIn.headers.get('set-cookie').split(';')[0];
const signedReq=(url,options={})=>req(url,{...options,headers:{...options.headers,cookie}});
assert.equal((await worker.fetch(signedReq('/api/content_items',{method:'POST',body:'{}'}),env)).status,403);
assert.equal((await worker.fetch(signedReq('/api/event-proposals',{method:'POST'}),env)).status,403);
assert.equal((await worker.fetch(signedReq('/event-proposals'),env)).status,200);
const initial=await (await worker.fetch(signedReq('/api/snapshot'),env)).json();assert(initial.data);
const input=JSON.parse(await fs.readFile(new URL('./out/snapshot.json',import.meta.url)));
input.exportedAt=new Date().toISOString();input.data['/api/content_items'].items[0].title='sync test A';
input.data['/api/company/config.json']={password:'do not publish'};
input.data['/api/daily-sales']={
  version:2,
  source:{url:'https://example.sharepoint.com/private-report.xlsx',fetched_at:'2026-09-15T09:00:00.000Z',responsible:'excluded'},
  periods:{
    '2025-12':{
      source:{url:'https://example.sharepoint.com/private-2025.xlsx',as_of_date:'2025-12-31',fetched_at:'2026-09-15T09:00:00.000Z',responsible:'excluded'},
      dates:['2025-12-01','2025-12-02'],latest_date:'2025-12-02',
      branches:[{branch_code:'V001',branch:'สาขาทดสอบ',type:'ห้าง',month_to_date:1200,target:2000,forecast:null,daily_sales:{'2025-12-01':300,'2025-12-02':null},responsible:'excluded',email:'owner@example.test'}]
    },
    '2026-09':{
      source:{url:'https://example.sharepoint.com/private-2026.xlsx',as_of_date:'2026-09-15',fetched_at:'2026-09-15T09:00:00.000Z'},
      dates:['2026-09-15'],latest_date:'2026-09-15',
      branches:[{branch_code:'V002',branch:'สาขาสอง',type:'ห้าง',month_to_date:900,target:1000,forecast:1250,daily_sales:{'2026-09-15':400,'2025-12-01':999},responsible:'excluded'}]
    },
    '2026-13':{dates:['2026-13-01'],branches:[{branch:'ต้องไม่ผ่าน'}]}
  }
};
const push=()=>worker.fetch(req('/api/sync',{method:'PUT',headers:{authorization:'Bearer test-only-secret'},body:JSON.stringify(input)}),env);
assert.equal((await push()).status,200);
let result=await (await worker.fetch(signedReq('/api/snapshot'),env)).json();assert.equal(result.data['/api/content_items'].items[0].title,'sync test A');assert(result.syncedAt);assert(!result.data['/api/company/config.json']);
const daily=result.data['/api/daily-sales'];assert.equal(daily.version,2);assert.deepEqual(Object.keys(daily.periods),['2025-12','2026-09']);assert.equal(daily.source.url,undefined);assert.equal(daily.source.responsible,undefined);
const december=daily.periods['2025-12'];assert.equal(december.year,2025);assert.equal(december.month,12);assert.equal(december.source.url,undefined);assert.equal(december.branches[0].responsible,undefined);assert.equal(december.branches[0].email,undefined);assert.equal(december.branches[0].daily_sales['2025-12-01'],300);assert.equal(december.branches[0].daily_sales['2025-12-02'],null);
const september=daily.periods['2026-09'];assert.equal(september.year,2026);assert.equal(september.month,9);assert.equal(september.branches[0].forecast,1250);assert.equal(september.branches[0].daily_sales['2025-12-01'],undefined);assert.doesNotMatch(JSON.stringify(daily),/sharepoint|owner@example|excluded/);
input.data['/api/content_items'].items[0].title='sync test B';assert.equal((await push()).status,200);
result=await (await worker.fetch(signedReq('/api/snapshot'),env)).json();assert.equal(result.data['/api/content_items'].items[0].title,'sync test B');
const home=await worker.fetch(signedReq('/'),env);assert.equal(home.status,302);assert.equal(home.headers.get('location'),'/daily-sales');
assert.equal((await worker.fetch(req('/api/event-predict'),env)).status,401);
assert.equal((await worker.fetch(signedReq('/api/event-predict',{method:'POST'}),env)).status,403);
for(const route of ['/content','/news-desk','/intel','/sales','/daily-sales','/contracts','/events','/event-predict','/jobs','/settings','/assets/app.mjs','/assets/daily-sales.mjs'])assert.equal((await worker.fetch(signedReq(route),env)).status,200,route);
for(const f of await fs.readdir(new URL('./out/assets/',import.meta.url)))if(f.endsWith('.mjs'))assert.equal(spawnSync(process.execPath,['--check',fileURLToPath(new URL('./out/assets/'+f,import.meta.url))]).status,0,f);
console.log('Passed: login gate, authenticated sync, two sequential data updates, durable snapshot reads, public writes blocked, private settings and daily-report PII excluded, 10 routes and browser module syntax.');
// Production regression: stalled R2 reads and Sheets fetches must not exceed
// the page's 15-second load timeout or hide the bundled venue history.
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=()=>new Promise(()=>{});
 // Load after replacing fetch: the data loaders capture fetch at module setup.
 const {default:stalledWorker}=await import('./dist/server/index.js?stalled-dependencies');
 const stalledEnv={...env,BUCKET:{get:()=>new Promise(()=>{}),put:()=>new Promise(()=>{})}};
 const started=Date.now();
 const response=await stalledWorker.fetch(signedReq('/api/event-predict'),stalledEnv);
 const history=await response.json();
 assert.equal(response.status,200);assert(history.records.length>100);
 assert.equal(history.source.status,'stale');
 assert(history.source.sources.some(s=>s.id==='sales-2025'&&s.months.length===12));
 assert(Date.now()-started<7000);
 console.log('Passed: stalled production dependencies return usable venue history within 7 seconds');
}finally{globalThis.fetch=originalFetch;}
