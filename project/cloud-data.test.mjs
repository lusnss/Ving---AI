import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CLOUD_TABLES,handleCloudData,mergeCloudSnapshot,isLegacyCloudPath,cloudDataInternals as internal} from './cloud-data.mjs';

class MemoryBucket {
 constructor(){this.objects=new Map();this.writes=[];this.sequence=0;this.onHeadPut=null;this.failKey=null;}
 async get(key){const object=this.objects.get(key);if(!object)return null;return {etag:object.etag,json:async()=>JSON.parse(object.body),text:async()=>object.body};}
 async put(key,body,options={}){
  if(this.failKey?.(key))throw new Error('synthetic storage failure');
  if(key===internal.HEAD&&this.onHeadPut){const hook=this.onHeadPut;this.onHeadPut=null;await hook();}
  const current=this.objects.get(key),condition=options.onlyIf;
  this.writes.push({key,options});
  if(condition?.etagDoesNotMatch==='*'&&current)return null;
  if(condition?.etagMatches&&current?.etag!==condition.etagMatches)return null;
  const etag='r2-'+(++this.sequence);this.objects.set(key,{body:String(body),etag});return {etag};
 }
}
const origin='https://workspace.example';
const empty=()=>Object.fromEntries(CLOUD_TABLES.map(table=>[table,{version:1,items:[]} ]));
const idea=(id='IDEA-1',title='Synthetic draft')=>({content_id:id,title,funnel_stage:'top',pillar_bucket:'ai_in_business',angle_type:'how_to',acid_test:'pending',source_type:'webapp',idea_status:'captured',created_at:'2026-10-03T00:00:00Z'});
const source=(id='SRC-1')=>({id,url:'https://example.test/rss',topic:'test',tags:[],type:'rss',active:true,added_at:'2026-10-03T00:00:00Z'});
function request(path,{method='GET',body,revision,headers={},sameOrigin=true}={}){
 return new Request(origin+path,{method,headers:{...(method==='GET'||method==='HEAD'?{}:{'content-type':'application/json',...(sameOrigin?{origin}:{})}),...(revision==null?{}:{'if-match':internal.etag(revision)}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
}
async function call(env,path,options={},access={role:'admin'}){return handleCloudData(request(path,options),env,access);}
async function imported(tables=empty()){
 const env={BUCKET:new MemoryBucket()};const result=await call(env,'/api/cloud-workspace/import',{method:'POST',body:{tables},sameOrigin:false},{role:'admin',importAuthorized:true});
 assert.equal(result.status,201,await result.clone().text());return env;
}
async function table(env,name,role='viewer'){const r=await call(env,'/api/'+name,{}, {role});assert.equal(r.status,200);return r.json();}
async function status(env){const r=await call(env,'/api/cloud-workspace/status');assert.equal(r.status,200);return r.json();}
// Test-only storage inspection; no application route exposes original records.
async function storedTable(env,table){const head=await (await env.BUCKET.get(internal.HEAD)).json(),manifest=await (await env.BUCKET.get(head.manifestKey)).json();return (await (await env.BUCKET.get(manifest.tables[table].key)).json()).data;}

test('route ownership is exact and does not shadow existing live notifications',async()=>{
 for(const path of ['/api/content_items','/api/content_items/IDEA-1','/api/cloud-workspace/tables/notifications'])assert.equal(isLegacyCloudPath(path),true,path);
 for(const path of ['/api/notifications','/api/notifications/read','/api/contracts','/api/snapshot','/api/content_items/a/b'])assert.equal(isLegacyCloudPath(path),false,path);
 const env={BUCKET:new MemoryBucket()};assert.equal(await call(env,'/api/notifications'),null);
 assert.equal(await call(env,'/api/contracts'),null);
 assert.equal((await call(env,'/api/cloud-workspace/arbitrary')).status,404);
 assert.equal((await call(env,'/api/cloud-workspace/tables/not_a_table')).status,404);
});

test('authentication, absence of raw-data routes and import scope are enforced',async()=>{
 const env=await imported();
 assert.equal((await call(env,'/api/content_items',{},{})).status,401);
 for(const role of ['admin','assistant','viewer'])assert.equal((await call(env,'/api/cloud-workspace/raw/content_items',{}, {role})).status,404);
 assert.equal((await call(env,'/api/cloud-workspace/history',{}, {role:'viewer'})).status,403);
 assert.equal((await call(env,'/api/content_items',{method:'POST',body:idea(),revision:1},{role:'viewer'})).status,403);
 assert.equal((await call(env,'/api/cloud-workspace/import',{method:'POST',body:{tables:empty()},revision:1},{role:'admin'})).status,403);
 assert.equal((await call(env,'/api/content_items',{}, {role:'admin',importAuthorized:true})).status,403);
 assert.equal((await call(env,'/api/cloud-workspace/import-status',{}, {role:'admin'})).status,403);
 assert.equal((await call(env,'/api/content_items',{method:'POST',body:idea(),revision:1,sameOrigin:false})).status,403);
});

test('payload limit, dangerous fields and unknown routes are rejected before mutation',async()=>{
 const env=await imported(),before=await status(env),writes=env.BUCKET.writes.length;
 const tooLarge=await call(env,'/api/content_items',{method:'POST',body:idea(),revision:1,headers:{'content-length':String(internal.MAX_BODY+1)}});assert.equal(tooLarge.status,413);
 const streamed=await call(env,'/api/content_items',{method:'POST',body:JSON.stringify({x:'x'.repeat(internal.MAX_BODY)}),revision:1});assert.equal(streamed.status,413);
 const polluted=await call(env,'/api/content_items',{method:'POST',body:'{"__proto__":{"poison":true}}',revision:1});assert.equal(polluted.status,400);
 assert.equal((await call(env,'/api/content_items/%2Fetc',{method:'PATCH',body:{title:'test'},revision:1})).status,400);
 assert.equal((await call(env,'/api/write-md',{method:'POST',body:{path:'output/content/../../private.md',content:'test'},revision:1})).status,400);
 assert.equal((await status(env)).revision,before.revision);assert.equal(env.BUCKET.writes.length,writes);
});

test('import is complete, retains raw fields privately, and exposes exact hashes only to migration verification',async()=>{
 const tables=empty();tables.content_items.items=[{...idea(),unlisted_private_field:'private-value',private_email:'private@example.invalid'}];
 tables.agent_requests.items=[{id:'REQ-1',prompt:'private prompt',status:'open',title:'Synthetic request',newsroom_job_id:'JOB-1',created_at:'2026-10-03'}];
 const env=await imported(tables);
 const view=await table(env,'content_items');assert.equal(view.items[0].unlisted_private_field,undefined);assert.equal(view.items[0].private_email,undefined);
 const raw=await storedTable(env,'content_items');assert.deepEqual(raw,tables.content_items);
 const projected=await table(env,'agent_requests');assert.equal(projected.items[0].prompt,null);
 const check=await (await call(env,'/api/cloud-workspace/import-status',{}, {role:'admin',importAuthorized:true})).json();
 for(const name of CLOUD_TABLES){assert.equal(check.tables[name].count,tables[name].items.length);assert.equal(check.tables[name].sha256,createHash('sha256').update(JSON.stringify(tables[name])).digest('hex'));}
 const incomplete=empty();delete incomplete.wr_jobs;
 const before=env.BUCKET.writes.length;
 assert.equal((await call(env,'/api/cloud-workspace/import',{method:'POST',body:{tables:incomplete},revision:1},{role:'admin',importAuthorized:true})).status,400);
 assert.equal(env.BUCKET.writes.length,before);
});

test('legacy imports may retain historic empty fields; new rows validate and PATCH preserves unknown fields',async()=>{
 const tables=empty();tables.content_items.items=[{content_id:'OLD-1',title:'',legacy_extension:'keep'}];const env=await imported(tables);
 const patch=await call(env,'/api/content_items/OLD-1',{method:'PATCH',body:{title:'Revised'},revision:1},{role:'assistant'});assert.equal(patch.status,200);
 const raw=await storedTable(env,'content_items');assert.equal(raw.items[0].legacy_extension,'keep');
 assert.equal((await call(env,'/api/content_items',{method:'POST',body:{content_id:'NEW-1'},revision:2})).status,400);
 assert.equal((await call(env,'/api/content_items/OLD-1',{method:'PATCH',body:{another_private_field:'not allowed'},revision:2})).status,400);
});

test('migration verification hashes persisted objects again and rejects corruption',async()=>{
 const tables=empty();tables.content_items.items=[idea()];const env=await imported(tables);
 const head=await (await env.BUCKET.get(internal.HEAD)).json(),manifest=await (await env.BUCKET.get(head.manifestKey)).json();
 const key=manifest.tables.content_items.key,stored=env.BUCKET.objects.get(key),payload=JSON.parse(stored.body);
 payload.data.items[0].title='synthetic corruption';stored.body=JSON.stringify(payload);
 const checked=await call(env,'/api/cloud-workspace/import-status',{}, {role:'admin',importAuthorized:true});assert.equal(checked.status,503);assert.equal((await checked.json()).code,'INTEGRITY_ERROR');
});

test('duplicate IDs cannot replace records during import or CRUD',async()=>{
 const tables=empty();tables.content_items.items=[idea()];const env=await imported(tables);
 const duplicate=await call(env,'/api/content_items',{method:'POST',body:idea('IDEA-1','overwrite attempt'),revision:1});assert.equal(duplicate.status,409);
 assert.equal((await table(env,'content_items')).items[0].title,'Synthetic draft');
 const importedDuplicate=empty();importedDuplicate.ca_sources.items=[source(),source()];
 const before=env.BUCKET.writes.length;
 assert.equal((await call(env,'/api/cloud-workspace/import',{method:'POST',body:{tables:importedDuplicate},revision:1},{role:'admin',importAuthorized:true})).status,409);
 assert.equal(env.BUCKET.writes.length,before);assert.equal((await status(env)).revision,1);
});

test('every successful write supplies the next global ETag and stale or missing revisions never overwrite',async()=>{
 const env=await imported();
 assert.equal((await call(env,'/api/content_items',{method:'POST',body:idea()})).status,428);
 const made=await call(env,'/api/content_items',{method:'POST',body:idea(),revision:1});assert.equal(made.status,201);assert.equal(made.headers.get('etag'),internal.etag(2));
 const stale=await call(env,'/api/content_items/IDEA-1',{method:'PATCH',body:{title:'stale'},revision:1});assert.equal(stale.status,409);
 const update=await call(env,'/api/content_items/IDEA-1',{method:'PATCH',body:{title:'fresh'},revision:2});assert.equal(update.status,200);assert.equal(update.headers.get('etag'),internal.etag(3));
 assert.equal((await table(env,'content_items')).items[0].title,'fresh');
 const deleted=await call(env,'/api/content_items/IDEA-1',{method:'DELETE',revision:3});assert.equal(deleted.status,204);assert.equal(await deleted.text(),'');assert.equal(deleted.headers.get('etag'),internal.etag(4));
 assert.equal((await table(env,'content_items')).items.length,0);
 for(const write of env.BUCKET.writes){assert.ok(write.options.onlyIf);if(write.key!==internal.HEAD)assert.equal(write.options.onlyIf.etagDoesNotMatch,'*');}
});

test('an R2 ETag race returns conflict and cannot erase the concurrent winning update',async()=>{
 const tables=empty();tables.content_items.items=[idea()];const env=await imported(tables);let winner;
 env.BUCKET.onHeadPut=async()=>{winner=await call(env,'/api/ca_sources',{method:'POST',body:source(),revision:1});assert.equal(winner.status,201);};
 const loser=await call(env,'/api/content_items/IDEA-1',{method:'PATCH',body:{title:'must not win'},revision:1});assert.equal(loser.status,409);
 assert.equal((await table(env,'content_items')).items[0].title,'Synthetic draft');assert.equal((await table(env,'ca_sources')).items.length,1);
 assert.equal((await status(env)).revision,2);
});

test('failed multipart import cannot publish any partial collection',async()=>{
 const original=empty();original.content_items.items=[idea()];const env=await imported(original);
 env.BUCKET.failKey=key=>key.startsWith(internal.PREFIX+'tables/agent_requests/');
 const next=empty();next.content_items.items=[idea('NEXT-1','next version')];
 const response=await call(env,'/api/cloud-workspace/import',{method:'POST',body:{tables:next},revision:1},{role:'admin',importAuthorized:true});assert.equal(response.status,503);
 assert.equal((await status(env)).revision,1);assert.equal((await table(env,'content_items')).items[0].content_id,'IDEA-1');
});

test('history is immutable and rollback atomically restores tables and documents',async()=>{
 const tables=empty();tables.content_items.items=[idea()];const env=await imported(tables);
 const headV1=JSON.parse((await env.BUCKET.get(internal.HEAD)).json?await (await env.BUCKET.get(internal.HEAD)).text():'{}');
 const manifestV1=await (await env.BUCKET.get(headV1.manifestKey)).text();
 assert.equal((await call(env,'/api/content_items/IDEA-1',{method:'PATCH',body:{title:'changed'},revision:1})).status,200);
 assert.equal((await call(env,'/api/write-md',{method:'POST',body:{path:'output/content/test.md',content:'# Synthetic draft'},revision:2})).status,200);
 const document=await call(env,'/api/cloud-workspace/document?path=output%2Fcontent%2Ftest.md');assert.equal(await document.text(),'# Synthetic draft');
 const rollback=await call(env,'/api/cloud-workspace/rollback',{method:'POST',body:{revision:1},revision:3});assert.equal(rollback.status,200);assert.equal(rollback.headers.get('etag'),internal.etag(4));
 assert.equal((await table(env,'content_items')).items[0].title,'Synthetic draft');
 assert.equal((await call(env,'/api/cloud-workspace/document?path=output%2Fcontent%2Ftest.md')).status,404);
 assert.equal(await (await env.BUCKET.get(headV1.manifestKey)).text(),manifestV1);
 const history=await (await call(env,'/api/cloud-workspace/history')).json();assert.deepEqual(history.items.map(x=>x.revision),[4,3,2,1]);assert.equal(history.items[0].restoreRevision,1);
});

test('snapshot overlays empty cloud collections, leaves financial feeds alone, and cannot resurrect local records',async()=>{
 const tables=empty();tables.content_items.items=[idea()];const env=await imported(tables);
 const snapshot={syncedAt:'old timestamp',data:{'/api/content_items':{items:[idea('LOCAL-1')]},'/api/daily-sales':{financial:'unchanged'}}};
 let merged=await mergeCloudSnapshot(snapshot,env,{role:'viewer'});assert.equal(merged.data['/api/content_items'].items[0].content_id,'IDEA-1');assert.equal(merged.syncedAt,'old timestamp');assert.deepEqual(merged.data['/api/daily-sales'],snapshot.data['/api/daily-sales']);
 await call(env,'/api/content_items/IDEA-1',{method:'DELETE',revision:1});merged=await mergeCloudSnapshot(snapshot,env,{role:'viewer'});assert.deepEqual(merged.data['/api/content_items'].items,[]);assert.equal(merged.cloudWorkspace.revision,2);
 await assert.rejects(()=>mergeCloudSnapshot(snapshot,env,{}),/Login required/);
 const pointer=await (await env.BUCKET.get(internal.HEAD)).json();env.BUCKET.objects.delete(pointer.manifestKey);
 await assert.rejects(()=>mergeCloudSnapshot(snapshot,env,{role:'viewer'}),/manifest is unavailable/);
});

test('existing Intel fields and queued job lifecycle survive migration without claiming a worker is running',async()=>{
 const tables=empty();tables.intel_targets.items=[{id:'TGT-1',name:'Synthetic company',handle_suggestions:[],legacy_extension:'retained'}];const env=await imported(tables);
 const patch=await call(env,'/api/intel_targets/TGT-1',{method:'PATCH',body:{handles:[],handle_suggestions:[{platform:'web',url:'https://example.test'}],handles_enriched_at:'2026-10-03'},revision:1});assert.equal(patch.status,200);
 const job={id:'JOB-1',kind:'web',target:'TGT-1',status:'queued',created_at:'2026-10-03',updated_at:'2026-10-03',target_id:'TGT-1',lane:'web',result:{},attempts:0,batch_id:'BATCH-1',scout_job_id:null,item_id:null,note:''};
 assert.equal((await call(env,'/api/newsroom_jobs',{method:'POST',body:job,revision:2})).status,201);
 const jobs=await table(env,'newsroom_jobs');assert.equal(jobs.items[0].status,'queued');assert.equal(jobs.items[0].batch_id,'BATCH-1');assert.equal(jobs.items[0].target,'[ข้อมูลภายใน]');
 assert.equal((await call(env,'/api/newsroom_jobs/JOB-1',{method:'PATCH',body:{status:'queued',attempts:1,error:null},revision:3})).status,200);
});

test('similarity uses durable records and projections preserve non-personal UI fields',async()=>{
 const tables=empty();tables.content_items.items=[idea('IDEA-1','Synthetic shoes')];tables.content_variants.items=[{variant_id:'VAR-1',target_platforms:['website']}];const env=await imported(tables);
 const result=await call(env,'/api/similar',{method:'POST',body:{query:'Synthetic shoes',items:[idea('FAKE-1')],threshold:.2}});assert.equal(result.status,200);assert.equal((await result.json()).items[0].content_id,'IDEA-1');
 assert.deepEqual((await table(env,'content_variants')).items[0].target_platforms,['website']);
});

test('sensitive identity and health keys are projected out while a company target name remains usable',async()=>{
 const tables=empty();tables.intel_targets.items=[{id:'TGT-1',name:'Synthetic Company',handles:[{platform:'web',ref:'https://example.test',full_name:'private',owner_name:'private',national_id:'private',health_history:'private',firstName:'private'}]}];
 const env=await imported(tables),result=(await table(env,'intel_targets')).items[0];assert.equal(result.name,'Synthetic Company');
 for(const key of ['full_name','owner_name','national_id','health_history','firstName'])assert.equal(result.handles[0][key],null);
 const bad=await call(env,'/api/intel_targets/TGT-1',{method:'PATCH',body:{role:['arbitrary_admin']},revision:1});assert.equal(bad.status,400);
 assert.equal((await call(env,'/api/intel_targets/TGT-1',{method:'PATCH',body:{role:['competitor','context']},revision:1})).status,200);
});

test('typed PATCH and POST reject UI-breaking arrays, objects and metrics without publishing',async()=>{
 const tables=empty();
 for(const [name,key]of [['intel_targets','id'],['ca_candidates','id'],['ca_sources','id'],['newsroom_items','id'],['wr_jobs','id'],['newsroom_jobs','id'],['intel_scripts','id'],['intel_snapshots','id'],['content_variants','variant_id']])tables[name].items=[{[key]:'EXISTING-1'}];
 const env=await imported(tables),writes=env.BUCKET.writes.length;
 const invalid=[
  ['intel_targets',{handles:null}],['intel_targets',{role:'competitor'}],['intel_targets',{aliases:'text'}],['intel_targets',{triggers:[null]}],['intel_targets',{handle_suggestions:{}}],['intel_targets',{triggers:[{keywords:'text'}]}],['intel_targets',{reach:{bad:'type'}}],
  ['content_variants',{target_platforms:null}],['ca_candidates',{hooks:null}],['ca_candidates',{images:['not an object']}],['ca_candidates',{comment_thread:'text'}],['ca_sources',{tags:{}}],['newsroom_items',{media:{}}],['newsroom_items',{tags:null}],['newsroom_items',{score:'<unsafe>'}],
  ['wr_jobs',{payload:[]}],['wr_jobs',{result:null}],['newsroom_jobs',{result:'text'}],['intel_scripts',{brief:[]}],['intel_snapshots',{metrics:null}],['intel_snapshots',{metrics:{followers:'not a number'}}]
 ];
 for(const [tableName,body]of invalid){const result=await call(env,'/api/'+tableName+'/EXISTING-1',{method:'PATCH',body,revision:1});assert.equal(result.status,400,tableName+' '+JSON.stringify(body));}
 const newJob={id:'JOB-NEW',job_type:'ai_improve',payload:'not an object',status:'queued',result:{},created_at:'2026-10-03'};
 assert.equal((await call(env,'/api/wr_jobs',{method:'POST',body:newJob,revision:1})).status,400);
 assert.equal(env.BUCKET.writes.length,writes);assert.equal((await status(env)).revision,1);
 assert.equal((await call(env,'/api/ca_candidates/EXISTING-1',{method:'PATCH',body:{edited_article_md:'Saved',comment_thread:[{role:'article',text:'Synthetic text'}]},revision:1})).status,200);
});

test('legacy malformed shapes normalize only in the read projection and original records are retained',async()=>{
 const tables=empty();tables.intel_targets.items=[{id:'TGT-1',name:'Synthetic Company',aliases:null,role:'competitor',handles:[null,{}],triggers:[{keywords:'text'}],handle_suggestions:null,reach:{unknown:true}}];
 tables.ca_candidates.items=[{id:'CAND-1',hooks:'text',images:null,comment_thread:'old text'}];tables.content_variants.items=[{variant_id:'VAR-1',target_platforms:'website'}];tables.wr_jobs.items=[{id:'JOB-1',payload:null,result:[]}];tables.intel_snapshots.items=[{id:'SNAP-1',metrics:{followers:'invalid'}}];tables.newsroom_items.items=[{id:'NEWS-1',media:{},tags:null,score:'<unsafe>'}];
 const env=await imported(tables),target=(await table(env,'intel_targets')).items[0];
 assert.deepEqual(target.aliases,[]);assert.deepEqual(target.role,[]);assert.deepEqual(target.handles,[{}]);assert.deepEqual(target.triggers[0].keywords,[]);assert.deepEqual(target.handle_suggestions,[]);assert.equal(target.reach,null);
 const candidate=(await table(env,'ca_candidates')).items[0];for(const key of ['hooks','images','comment_thread'])assert.deepEqual(candidate[key],[]);
 assert.deepEqual((await table(env,'content_variants')).items[0].target_platforms,[]);
 const job=(await table(env,'wr_jobs')).items[0];assert.deepEqual(job.payload,{});assert.deepEqual(job.result,{});
 assert.equal((await table(env,'intel_snapshots')).items[0].metrics.followers,null);assert.equal((await table(env,'newsroom_items')).items[0].score,null);
 for(const name of CLOUD_TABLES)assert.deepEqual(await storedTable(env,name),tables[name]);
});

test('timestamp-bearing technical IDs, relationships and constrained document references survive projection and PATCH',async()=>{
 const contentId='CNT-1791040123456-abc123',variantId=contentId+'-RL',newsId='NR-1791040123456-def456',tables=empty();
 tables.content_items.items=[{...idea(contentId),source_ref:'intel:'+newsId}];
 tables.content_variants.items=[{variant_id:variantId,content_id:contentId,target_platforms:['website'],markdown_path:'output/content/reels/'+variantId+'--draft.md'}];
 tables.newsroom_items.items=[{id:newsId,job_id:'JOB-1791040123456-aaa111',target_id:'TGT-1791040123456-bbb222',media:[],tags:[],report_md:'# Synthetic report',report_path:'wiki/intel/scout/'+newsId+'.md',cover_path:'newsroom/'+newsId+'/cover.png'}];
 const env=await imported(tables),content=(await table(env,'content_items')).items[0],variant=(await table(env,'content_variants')).items[0],news=(await table(env,'newsroom_items')).items[0];
 assert.equal(content.content_id,contentId);assert.equal(content.source_ref,'intel:'+newsId);assert.equal(variant.variant_id,variantId);assert.equal(variant.content_id,contentId);assert.equal(variant.markdown_path,tables.content_variants.items[0].markdown_path);
 for(const field of ['id','job_id','target_id','report_md','report_path','cover_path'])assert.equal(news[field],tables.newsroom_items.items[0][field]);
 const patched=await call(env,'/api/content_items/'+contentId,{method:'PATCH',body:{title:'Synthetic revised title'},revision:1});assert.equal(patched.status,200);assert.equal((await patched.json()).content_id,contentId);
 const refetched=(await table(env,'content_variants')).items[0];assert.equal(refetched.content_id,contentId);
 const malicious=await call(env,'/api/newsroom_items/'+newsId,{method:'PATCH',body:{report_path:'javascript:alert(1)',cover_path:'newsroom/../../private.png'},revision:2});assert.equal(malicious.status,200);const projected=await malicious.json();assert.equal(projected.report_path,'[ลิงก์ไม่ปลอดภัย]');assert.equal(projected.cover_path,null);
});
