import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildRebrand,createRebrandLoader,rebrandHeaders} from './rebrand-data.mjs';
import {summarizeRebrand,filterRebrand,parseRebrandDate,rebrandMarkup,statusKind} from './out/assets/rebrand.mjs';
const csv=(rows=[])=>[rebrandHeaders,...rows].map(row=>row.map(cell=>'"'+String(cell??'').replaceAll('"','""')+'"').join(',')).join('\n');
const fixture=csv([['Stand alone','สนามเทพหัสดิน','500,000','07/09/2026','15/10/2026','กำลังก่อสร้าง','เสร็จแล้ว ','กำลังดำเนินการ','ยังไม่เริ่ม'],['Department store','สาขา B'],['Stand alone','สาขา C','0','','','เสร็จแล้ว']]);
test('reads header-mapped source fields and preserves missing data without inferring progress',()=>{
 const data=buildRebrand(fixture),s=summarizeRebrand(data.items);
 assert.equal(s.total,3);assert.equal(s.active,1);assert.equal(s.done,1);assert.equal(s.missing,1);assert.equal(s.budget,500000);assert.equal(s.budgetCount,2);assert.equal(s.stages[0].done,1);assert.equal(s.stages[1].active,1);assert.equal(s.stages[2].waiting,1);assert.equal(data.items[1].budget,'');assert.equal(summarizeRebrand([data.items[1]]).budget,null);
 assert.deepEqual(s.channels,[{label:'Stand alone',count:2},{label:'Department store',count:1}]);
});
test('matches exact statuses, valid Thai/AD dates and search/filter intersections',()=>{
 const data=buildRebrand(fixture);assert.equal(statusKind('ยังไม่เสร็จ'),'other');assert.equal(statusKind(''),'missing');assert.equal(parseRebrandDate('31/02/2026'),null);assert.equal(parseRebrandDate('15/10/2569').toISOString(),'2026-10-15T00:00:00.000Z');
 assert.equal(filterRebrand(data.items,{channel:'Stand alone',status:'active',query:'สนาม'}).length,1);assert.equal(filterRebrand(data.items,{channel:'Department store',status:'active'}).length,0);
});
test('rejects changed, duplicate or truncated headers and incomplete records',()=>{
 assert.throws(()=>buildRebrand('<html>Login</html>'));assert.throws(()=>buildRebrand(fixture.replace('สถานะ','สาขา')));assert.throws(()=>buildRebrand(fixture+'\n"broken'));assert.throws(()=>buildRebrand(csv([['Stand alone','','100']])));assert.deepEqual(buildRebrand(csv()).items,[]);
});
test('escapes source content and distinguishes unavailable from a genuinely empty sheet',()=>{
 const data=buildRebrand(csv([['Stand alone','<script>alert(1)</script>','?']]));const markup=rebrandMarkup(data);assert.ok(!markup.includes('<script>'));assert.ok(markup.includes('&lt;script&gt;'));assert.match(markup,/รอข้อมูลงบประมาณอีก/);assert.match(rebrandMarkup({source:{status:'unavailable'},items:[]}),/ยังโหลดข้อมูลไม่ได้/);assert.match(rebrandMarkup(buildRebrand(csv())),/ยังไม่มีรายการสาขาในชีต/);
});
test('cloud refresh, coalesced reads, last-good fallback, recovery and intentional clearing',async()=>{
 let tick=Date.parse('2026-09-20T08:00:00Z'),body=fixture,calls=0,offline=false;const stored=new Map(),env={BUCKET:{get:async key=>stored.has(key)?{json:async()=>JSON.parse(stored.get(key))}:null,put:async(key,value)=>stored.set(key,value)}};
 const fetchImpl=async url=>{calls++;assert.equal(new URL(url).searchParams.get('gid'),'268411880');assert.equal(new URL(url).searchParams.get('range'),'A1:I1000');if(offline)throw Error('offline');return new Response(body);};
 const load=createRebrandLoader({fetchImpl,now:()=>tick});const [a,b]=await Promise.all([load(env),load(env)]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal((await load(env)).source.status,'online');assert.equal(calls,1);
 tick+=16000;offline=true;const stale=await load(env);assert.equal(stale.source.status,'stale');assert.equal(stale.items.length,3);assert.equal(stale.source.fetched_at,a.source.fetched_at);
 tick+=16000;offline=false;body='<html>wrong</html>';assert.equal((await load(env)).items.length,3);
 tick+=16000;body=csv();const cleared=await load(env);assert.equal(cleared.source.status,'online');assert.equal(cleared.items.length,0);
 const freshLoader=createRebrandLoader({fetchImpl,now:()=>tick});assert.deepEqual(await freshLoader(env),cleared);assert.equal(calls,4);
 const failed=createRebrandLoader({fetchImpl:async()=>{throw Error();}});assert.equal((await failed({BUCKET:{get:async()=>null}})).source.status,'unavailable');
});
test('every HTML navigation includes Rebrand and worker remains authenticated/read-only',async()=>{
 for(const name of await fs.readdir('out'))if(name.endsWith('.html'))assert.match(await fs.readFile('out/'+name,'utf8'),/href="\/rebrand"/);
 const {default:worker}=await import('./dist/server/index.js');const env={BUCKET:{get:async key=>key==='rebrand.json'?{json:async()=>buildRebrand(fixture)}:null}};const unauthorized=await worker.fetch(new Request('https://local.test/api/rebrand'),env);assert.equal(unauthorized.status,401);
 const source=await fs.readFile('worker.mjs','utf8'),password=source.match(/const ACCESS_PASSWORD='([^']+)'/)[1];
 const auth=await worker.fetch(new Request('https://local.test/login',{method:'POST',body:new URLSearchParams({password,next:'/rebrand'})}),env);const cookie=auth.headers.get('set-cookie').split(';')[0];
 assert.equal((await worker.fetch(new Request('https://local.test/rebrand',{headers:{cookie}}),env)).status,200);
 assert.equal((await worker.fetch(new Request('https://local.test/api/rebrand',{method:'POST',headers:{cookie}}),env)).status,405);
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(fixture);try{const response=await worker.fetch(new Request('https://local.test/api/rebrand',{headers:{cookie}}),env);assert.equal(response.status,200);assert.equal((await response.json()).items.length,3);}finally{globalThis.fetch=originalFetch;}
});
