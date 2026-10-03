import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker from './dist/server/index.js';
import {CLOUD_TABLES,handleCloudData} from './cloud-data.mjs';

const origin='https://example.test';
const env={SESSION_SECRET:'synthetic-session-key',CLOUD_MIGRATION_TOKEN:'synthetic-migration-key',BUCKET:{
 objects:new Map(),counter:0,
 async get(key){const v=this.objects.get(key);return v?{etag:v.etag,json:async()=>JSON.parse(v.body)}:null;},
 async put(key,body,options={}){const old=this.objects.get(key),condition=options.onlyIf;
  if(condition?.etagMatches&&old?.etag!==condition.etagMatches||condition?.etagDoesNotMatch==='*'&&old)return null;
  const v={body:String(body),etag:String(++this.counter)};this.objects.set(key,v);return v;
 }
}};
function cookie(role){const text=`v4.${role}.${role}.${Math.floor(Date.now()/1000)+600}`;return 'ving_session='+text+'.'+createHmac('sha256',env.SESSION_SECRET).update(text).digest('base64url');}
const send=(path,{method='GET',body,role,token,revision,sameOrigin=true}={})=>worker.fetch(new Request(origin+path,{method,headers:{...(role?{cookie:cookie(role)}:{}),...(token?{authorization:'Bearer '+token}:{}),...(revision?{'if-match':revision}:{}),...(method==='GET'?{}:{'content-type':'application/json',...(sameOrigin?{origin}:{})})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
test('built Worker retires migration, routes cloud CRUD, blocks stale edits and secures page scripts',async()=>{
 assert.equal((await send('/api/content_items')).status,401);
 for(const path of ['/api/cloud-workspace/import','/api/cloud-workspace/import-status']){
  for(const role of [undefined,'admin'])for(const method of ['GET','POST']){
   assert.equal((await send(path,{role,method,token:env.CLOUD_MIGRATION_TOKEN})).status,410);
  }
 }
 assert.equal(env.BUCKET.objects.size,0);
 const tables=Object.fromEntries(CLOUD_TABLES.map(t=>[t,{version:1,items:[]}])) ;
 // Seed the in-memory fixture through the internal storage module. Production
 // HTTP routes can no longer invoke this one-time importer.
 const imported=await handleCloudData(new Request(origin+'/api/cloud-workspace/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({tables})}),env,{role:'admin',importAuthorized:true});
 assert.equal(imported.status,201,await imported.clone().text());
 const check=await send('/api/cloud-workspace/status',{role:'admin'});assert.equal(check.status,200);
 const list=await send('/api/content_items',{role:'admin'});assert.equal(list.status,200);const revision=list.headers.get('etag');
 const idea={content_id:'TEST-1',title:'Synthetic',funnel_stage:'top',pillar_bucket:'ai_in_business',angle_type:'how_to',acid_test:'pending',source_type:'webapp',idea_status:'captured',created_at:new Date().toISOString()};
 assert.equal((await send('/api/content_items',{role:'viewer',method:'POST',body:idea,revision})).status,403);
 assert.equal((await send('/api/content_items',{role:'admin',method:'POST',body:idea,revision,sameOrigin:false})).status,403);
 const created=await send('/api/content_items',{role:'admin',method:'POST',body:idea,revision});assert.equal(created.status,201,await created.clone().text());
 assert.equal((await send('/api/content_items/TEST-1',{role:'admin',method:'PATCH',body:{title:'stale'},revision})).status,409);
 const reloaded=await send('/api/content_items',{role:'viewer'});assert.equal((await reloaded.json()).items[0].title,'Synthetic');
 assert.equal((await send('/api/cloud-workspace/raw/content_items',{role:'admin'})).status,404);
 const page=await send('/content',{role:'admin'});assert.equal(page.status,200);const html=await page.text(),policy=page.headers.get('content-security-policy');
 assert.match(policy,/script-src 'self' 'nonce-/);assert(!policy.includes('unsafe-inline'));const nonce=/nonce-([^']+)/.exec(policy)[1];
 for(const script of html.matchAll(/<script\b[^>]*>/g))assert(script[0].includes('nonce="'+nonce+'"'));
 env.CLOUD_MIGRATION_TOKEN=undefined;assert.equal((await send('/api/cloud-workspace/import-status',{token:'synthetic-migration-key'})).status,410);
});
