/**
 * Standalone R2 persistence for the legacy Content / News / Intel workspace.
 * Integration: authenticate first, then call handleCloudData(request, env, {role}).
 * Return its Response when non-null. A null response means this module does not
 * own the route. Import additionally requires importAuthorized:true, which the
 * caller must set only after checking its short-lived migration credential.
 *
 * All table versions and manifests are immutable. One conditional R2 head write
 * atomically publishes an import, edit, or rollback. A failed CAS leaves harmless
 * unreachable versions; it NEVER retries against or overwrites a newer head.
 * Do not delete versions reachable through manifest history. No AI worker runs
 * here: queued jobs remain queued until a separate worker processes them.
 */

export const CLOUD_TABLES = Object.freeze(['ca_sources','ca_news_items','ca_candidates','ca_post_log','content_items','content_variants','publications','analytics_snapshots','intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','intel_scripts','wr_jobs','notifications','agent_requests']);
const PREFIX = 'cloud-workspace/v1/';
const HEAD = PREFIX + 'head.json';
const MAX_BODY = 2_000_000;
const MAX_ROWS = 10_000;
const MAX_HISTORY = 100;
const roles = new Set(['admin','assistant','viewer']);
const ids = {content_items:'content_id',content_variants:'variant_id',publications:'publication_id',analytics_snapshots:'snapshot_id'};
const fieldLists = {
 ca_sources:'id url name topic tags type active added_at',
 ca_news_items:'id source_id url title summary published_at fetched_at status content_hash',
 ca_candidates:'id news_item_id article_md edited_article_md hooks images status post_to_ig created_at comment_thread glance_line scene_prompt scene_field selected_hook selected_image scheduled_at posted_at',
 ca_post_log:'id candidate_id platform post_id permalink error posted_at',
 content_items:'content_id title canonical_angle topic_cluster funnel_stage pillar_bucket angle_type acid_test offer_link source_type source_ref idea_status freshness_score similarity_group decision_label created_at last_used_at',
 content_variants:'variant_id content_id format target_platforms working_title markdown_path variant_status cta_keyword editorial_status publish_target_at published_at created_at status_changed_at script_draft ai_result ai_result_at',
 publications:'publication_id variant_id platform post_url post_id published_at caption_path first_comment utm_campaign status decision_label created_at',
 analytics_snapshots:'snapshot_id publication_id captured_at source views reach watch_time_avg completion_rate likes comments shares saves profile_visits follows keyword_comments dm_count line_adds leads_created notes',
 intel_targets:'id slug name aliases role threat section handles handle_suggestions handles_enriched_at reach sells icp why_watch triggers cadence_days created_at updated_at last_scouted_at next_scout_at deep_dive avatar_path',
 intel_snapshots:'id target_id item_id lane metrics created_at',
 newsroom_items:'id job_id kind platform source_url title summary score media tags created_at target_id note transcript text evidence channel verdict views duration_s cover_path report_md report_path scraped_at',
 newsroom_jobs:'id kind target status created_at updated_at target_id lane result attempts note error claim_token claimed_at started_at finished_at batch_id scout_job_id item_id',
 intel_scripts:'id item_id title brief script_md created_at content_id',
 wr_jobs:'id job_type payload status result created_at error started_at finished_at',
 notifications:'id title body read created_at',
 agent_requests:'id newsroom_job_id title prompt status created_at'
};
const fields = Object.fromEntries(Object.entries(fieldLists).map(([table,list])=>[table,new Set(list.split(' '))]));
const requiredLists = {
 ca_sources:'id url topic tags type active added_at',ca_news_items:'id source_id url title summary published_at fetched_at status content_hash',
 ca_candidates:'id news_item_id article_md hooks images status post_to_ig created_at comment_thread glance_line scene_prompt scene_field',
 ca_post_log:'id candidate_id platform posted_at',content_items:'content_id title funnel_stage pillar_bucket angle_type acid_test source_type idea_status created_at',
 content_variants:'variant_id content_id format target_platforms working_title markdown_path variant_status created_at status_changed_at',
 publications:'publication_id variant_id platform published_at status created_at',analytics_snapshots:'snapshot_id publication_id captured_at source',
 intel_targets:'id slug name aliases role threat section handles reach sells icp why_watch triggers cadence_days created_at updated_at',
 intel_snapshots:'id target_id item_id lane metrics created_at',newsroom_items:'id job_id kind platform source_url title summary score media tags created_at target_id',
 newsroom_jobs:'id kind target status created_at updated_at target_id lane result attempts',intel_scripts:'id item_id title brief script_md created_at',
 wr_jobs:'id job_type payload status result created_at',notifications:'id title body read created_at',agent_requests:'id newsroom_job_id title prompt status created_at'
};
const arrayTypes={
 ca_sources:{tags:'string'},ca_candidates:{hooks:'object',images:'object',comment_thread:'object'},
 content_variants:{target_platforms:'string'},intel_targets:{aliases:'string',role:'string',handles:'object',triggers:'object',handle_suggestions:'object'},
 newsroom_items:{media:'media',tags:'string'}
};
const objectTypes={wr_jobs:['payload','result'],newsroom_jobs:['result'],intel_snapshots:['metrics'],intel_scripts:['brief']};
const numericTypes={
 ca_candidates:['selected_hook','selected_image'],intel_targets:['cadence_days'],newsroom_items:['score','views','duration_s'],newsroom_jobs:['attempts'],
 analytics_snapshots:['views','reach','watch_time_avg','completion_rate','likes','comments','shares','saves','profile_visits','follows','keyword_comments','dm_count','line_adds','leads_created']
};
const stringTypes={intel_targets:['name','slug','sells','icp','why_watch'],content_items:['title'],content_variants:['working_title','script_draft'],intel_scripts:['title','script_md'],ca_candidates:['article_md','edited_article_md']};
const states = {
 ca_sources:{type:['scrape','rss']},
 ca_candidates:{status:['pending_review','scheduled','approved','posted','rejected']},
 content_items:{idea_status:['captured','triaged','selected','active','published','repurpose_candidate','archived'],funnel_stage:['top','middle','bottom','retain'],pillar_bucket:['ai_in_business','sales_team','intersection','persona'],angle_type:['problem_first','insider_demo','how_to','proof','wedge'],acid_test:['pending','passed','failed'],source_type:['telegram','webapp','file_import','transcript','field_note','analytics']},
 content_variants:{variant_status:['draft','ai_improved','ready_to_record','recorded','editing','edited','scheduled','posted','analyzed','repurposed'],format:['reel','carousel','article','line_broadcast','website_article','ad','email']},
 publications:{status:['scheduled','posted','failed','deleted'],platform:['tiktok','instagram','facebook','line_oa','linkedin','website','youtube'],decision_label:['kill','iterate','repurpose','boost','pillar','sales_asset']},
 intel_targets:{threat:['red','orange','yellow','green','na'],section:['competitor','benchmark','mentor'],role:['competitor','benchmark','mentor','context']},
 newsroom_items:{kind:['clip','page','ads','web','shot','paste'],platform:['tiktok','youtube','instagram','facebook','meta-ads','web','upload']},
 newsroom_jobs:{status:['queued','submitted','running','done','failed','preflight_failed'],lane:['page','ads','web']},
 wr_jobs:{status:['queued','running','done','error'],job_type:['render_card','ai_improve','rewrite_copy','render_text_card','rewrite_reel']},
 agent_requests:{status:['open','resolved','dismissed']}
};
const secretKey = /token|password|secret|api[_-]?key|email|phone|contact|personal[_-]?id|national[_-]?id|citizen[_-]?id|passport|social[_-]?security|ssn|full[_-]?name|first[_-]?name|last[_-]?name|given[_-]?name|family[_-]?name|owner|author[_-]?name|assignee|staff[_-]?name|employee[_-]?name|customer[_-]?name|health|medical|diagnos|treatment|birth|ผู้ติดต่อ|ผู้รับผิดชอบ|responsible|เบอร์|อีเมล|เลขบัตร|เลขประจำตัว|วันเกิด|ประวัติสุขภาพ|ชื่อบุคคล/i;
const privateKey = /(?:^|_)(?:prompt|source_url|error)(?:$|_)/i;
const dangerous = new Set(['__proto__','prototype','constructor']);
const owns = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const fail = (status,message,code) => Object.assign(new Error(message),{status,code});
const tableOK = table => CLOUD_TABLES.includes(table);
const clone = value => structuredClone(value);
const etag = revision => '"cloud-workspace-' + revision + '"';
const headers = revision => ({'cache-control':'no-store','x-content-type-options':'nosniff',...(revision==null?{}:{etag:etag(revision),'x-cloud-revision':String(revision)})});
function reply(body,status=200,revision) {return new Response(status===204?null:JSON.stringify(body),{status,headers:{...headers(revision),'content-type':'application/json; charset=utf-8'}});}
function requireAdmin(role) {if(role!=='admin')throw fail(403,'Administrator access required','FORBIDDEN');}
function requireEditor(role) {if(role!=='admin'&&role!=='assistant')throw fail(403,'Read-only access','FORBIDDEN');}
function isObject(value) {return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function inspect(value,depth=0) {
 if(depth>40)throw fail(400,'Data is too deeply nested','INVALID_DATA');
 if(typeof value==='number'&&!Number.isFinite(value))throw fail(400,'Non-finite number','INVALID_DATA');
 if(Array.isArray(value)){if(value.length>MAX_ROWS)throw fail(400,'Too many array entries','INVALID_DATA');for(const item of value)inspect(item,depth+1);}
 else if(isObject(value))for(const [key,item]of Object.entries(value)){if(dangerous.has(key))throw fail(400,'Unsafe field name','INVALID_DATA');inspect(item,depth+1);}
}
async function bodyOf(request) {
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw fail(415,'JSON required','CONTENT_TYPE');
 const stated=request.headers.get('content-length');
 if(stated!==null&&(!/^\d+$/.test(stated)||Number(stated)>MAX_BODY))throw fail(413,'Payload is too large','PAYLOAD_LIMIT');
 const reader=request.body?.getReader();if(!reader)throw fail(400,'JSON body required','INVALID_JSON');
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw fail(413,'Payload is too large','PAYLOAD_LIMIT');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fail(400,'Invalid JSON','INVALID_JSON');}
 if(!isObject(value))throw fail(400,'JSON object required','INVALID_DATA');inspect(value);return value;
}
function redactText(value) {
 return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]')
  .replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]')
  // A timestamp embedded in CNT-/JOB-/REQ-style technical IDs is not an ID
  // card number. Only standalone digit sequences are treated as personal IDs.
  .replace(/(?<![\p{L}\p{N}_.:/-])\d(?:[ -]?\d){12}(?![\p{L}\p{N}_.:/-])/gu,'[ปกปิด]')
  .replace(/https:\/\/(?:docs\.google\.com|[^\s"<>]*sharepoint\.com)\/[^\s"<>]+/gi,'[แหล่งข้อมูลภายใน]')
  .replace(/\/Users\/[^\s"<>]+/g,'[ไฟล์ภายใน]');
}
function safeValue(value,key='') {
 if(secretKey.test(key)||privateKey.test(key))return null;
 if(typeof value==='string'){
  // Technical keys must retain exact identity across CRUD paths and joins.
  // Sensitive keys (national_id, contact_id, etc.) were rejected above.
  if(/^(?:id|[a-z][a-z0-9_]*_id)$/i.test(key))return /^[A-Za-z0-9._:-]{1,200}$/.test(value)?value:null;
  if(/^\s*(?:javascript|data|vbscript):/i.test(value))return '[ลิงก์ไม่ปลอดภัย]';
  if(/(?:url|href|deep_dive|_path|ref)$/.test(key)&&/[<>"'`\x00-\x1f]/.test(value))return '[ลิงก์ไม่ปลอดภัย]';
  if(['markdown_path','report_path','cover_path'].includes(key)&&value){
   const allowed=key==='markdown_path'?value.startsWith('output/content/')&&value.endsWith('.md'):key==='report_path'?value.startsWith('wiki/')&&value.endsWith('.md'):value.startsWith('newsroom/');
   if(!allowed||/[\\%\x00-\x1f]/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..'))return null;
  }
  return redactText(value);
 }
 if(Array.isArray(value))return value.map(v=>safeValue(v));
 if(isObject(value))return Object.fromEntries(Object.entries(value).filter(([k])=>!dangerous.has(k)).map(([k,v])=>[k,safeValue(v,k)]));
 return value;
}
export function projectCloudRecord(table,item) {
 if(!tableOK(table))throw fail(404,'Unknown table','NOT_FOUND');
 const result=Object.fromEntries(Object.entries(item).filter(([key])=>fields[table].has(key)).map(([key,value])=>[key,safeValue(value,key)]));
 normalizeReadTypes(table,result);
 if(table==='newsroom_jobs'){result.target='[ข้อมูลภายใน]';result.note='';result.result={};}
 return result;
}
function validateId(id) {if(typeof id!=='string'||!/^[A-Za-z0-9._:-]{1,200}$/.test(id))throw fail(400,'Invalid record ID','INVALID_ID');}
function validateRecord(table,item,{editable=false,strict=true}={}) {
 if(!isObject(item))throw fail(400,'Record must be an object','INVALID_RECORD');
 inspect(item);validateId(item[ids[table]||'id']);
 if(new TextEncoder().encode(JSON.stringify(item)).length>256_000)throw fail(413,'Record is too large','PAYLOAD_LIMIT');
 if(strict)for(const field of requiredLists[table].split(' '))if(!owns(item,field)||item[field]===undefined||item[field]==='')throw fail(400,'Missing required field: '+field,'INVALID_RECORD');
 if(editable)for(const key of Object.keys(item))if(!fields[table].has(key))throw fail(400,'Field is not editable: '+key,'INVALID_FIELD');
 if(strict){validateStates(table,item);validateWriteTypes(table,item);}
 return item;
}
function validateStates(table,item){for(const [field,allowed]of Object.entries(states[table]||{}))if(item[field]!=null){if(Array.isArray(item[field])&&!(table==='intel_targets'&&field==='role'))throw fail(400,'Invalid '+field,'INVALID_STATE');const values=Array.isArray(item[field])?item[field]:[item[field]];if(values.some(value=>!allowed.includes(value)))throw fail(400,'Invalid '+field,'INVALID_STATE');}}
function arrayItemOK(value,type){return type==='object'?isObject(value):type==='media'?typeof value==='string'||isObject(value):typeof value==='string';}
function validateWriteTypes(table,item){
 for(const [field,type]of Object.entries(arrayTypes[table]||{}))if(owns(item,field)&&(!Array.isArray(item[field])||item[field].some(value=>!arrayItemOK(value,type))))throw fail(400,'Invalid array field: '+field,'INVALID_TYPE');
 for(const field of objectTypes[table]||[])if(owns(item,field)&&!isObject(item[field]))throw fail(400,'Invalid object field: '+field,'INVALID_TYPE');
 for(const field of numericTypes[table]||[])if(owns(item,field)&&item[field]!==null&&(typeof item[field]!=='number'||!Number.isFinite(item[field])))throw fail(400,'Invalid numeric field: '+field,'INVALID_TYPE');
 for(const field of stringTypes[table]||[])if(owns(item,field)&&typeof item[field]!=='string')throw fail(400,'Invalid text field: '+field,'INVALID_TYPE');
 if(table==='intel_targets'){
  if(owns(item,'reach')&&typeof item.reach!=='string'&&!(typeof item.reach==='number'&&Number.isFinite(item.reach)))throw fail(400,'Invalid reach field','INVALID_TYPE');
  for(const trigger of item.triggers||[])if(owns(trigger,'keywords')&&(!Array.isArray(trigger.keywords)||trigger.keywords.some(value=>typeof value!=='string')))throw fail(400,'Invalid trigger keywords','INVALID_TYPE');
 }
 if(table==='intel_snapshots'&&isObject(item.metrics))for(const value of Object.values(item.metrics))if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw fail(400,'Invalid numeric metric','INVALID_TYPE');
}
function normalizeReadTypes(table,item){
 // Legacy imports remain byte-for-byte intact in R2. Only the projection gets
 // safe shapes for fields the existing interface calls map/join/includes on.
 for(const [field,type]of Object.entries(arrayTypes[table]||{}))item[field]=Array.isArray(item[field])?item[field].filter(value=>arrayItemOK(value,type)):[];
 for(const field of objectTypes[table]||[])if(!isObject(item[field]))item[field]={};
 for(const field of numericTypes[table]||[])if(owns(item,field)&&!(typeof item[field]==='number'&&Number.isFinite(item[field])))item[field]=null;
 for(const field of stringTypes[table]||[])if(owns(item,field)&&typeof item[field]!=='string')item[field]='';
 if(table==='intel_targets'){
  for(const trigger of item.triggers)trigger.keywords=Array.isArray(trigger.keywords)?trigger.keywords.filter(value=>typeof value==='string'):[];
  if(owns(item,'reach')&&typeof item.reach!=='string'&&!(typeof item.reach==='number'&&Number.isFinite(item.reach)))item.reach=null;
 }
 if(table==='intel_snapshots')for(const [key,value]of Object.entries(item.metrics))if(!(typeof value==='number'&&Number.isFinite(value)))item.metrics[key]=null;
}
function tableEnvelope(table,value) {
 const items=Array.isArray(value)?value:value?.version===1?value.items:null;
 if(!Array.isArray(items)||items.length>MAX_ROWS)throw fail(400,'Invalid table: '+table,'INVALID_TABLE');
 const seen=new Set();for(const item of items){validateRecord(table,item,{strict:false});const id=item[ids[table]||'id'];if(seen.has(id))throw fail(409,'Duplicate record ID','DUPLICATE_ID');seen.add(id);}
 return {version:1,items:clone(items)};
}
async function getJson(bucket,key) {const object=await bucket.get(key);if(!object)return null;return {object,value:await object.json()};}
async function stateOf(bucket) {
 const head=await getJson(bucket,HEAD);
 if(!head)return {etag:null,manifest:{format:1,revision:0,previous:null,tables:{},documents:{},updatedAt:null},manifestKey:null};
 const pointer=head.value;
 if(!Number.isInteger(pointer.revision)||pointer.revision<1||typeof pointer.manifestKey!=='string'||!pointer.manifestKey.startsWith(PREFIX+'manifests/'))throw fail(503,'Cloud workspace head is invalid','STORAGE_ERROR');
 const saved=await getJson(bucket,pointer.manifestKey);
 if(!saved||saved.value.revision!==pointer.revision||saved.value.format!==1)throw fail(503,'Cloud workspace manifest is unavailable','STORAGE_ERROR');
 return {etag:head.object.etag,manifest:saved.value,manifestKey:pointer.manifestKey};
}
function checkRevision(request,state,{allowInitial=false}={}) {
 const supplied=request.headers.get('if-match');
 if(allowInitial&&!state.manifestKey&&supplied===null)return;
 if(supplied===null)throw fail(428,'Reload before saving; If-Match is required','REVISION_REQUIRED');
 if(supplied!==etag(state.manifest.revision))throw fail(409,'The workspace changed; reload before saving','REVISION_CONFLICT');
}
async function tableOf(bucket,state,table) {
 const ref=state.manifest.tables[table];if(!ref)return null;
 if(typeof ref.key!=='string'||!ref.key.startsWith(PREFIX+'tables/'+table+'/'))throw fail(503,'Invalid table reference','STORAGE_ERROR');
 const saved=await getJson(bucket,ref.key);
 if(!saved||saved.value.table!==table||saved.value.format!==1)throw fail(503,'Saved table is unavailable','STORAGE_ERROR');
 return saved.value.data;
}
async function immutablePut(bucket,key,value) {
 const result=await bucket.put(key,JSON.stringify(value),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!result)throw fail(503,'Immutable storage write failed','STORAGE_ERROR');
 return key;
}
async function publish(bucket,state,{tables=state.manifest.tables,documents=state.manifest.documents,action,restoreRevision=null}) {
 const manifest={format:1,revision:state.manifest.revision+1,previous:state.manifestKey,tables,documents,updatedAt:new Date().toISOString(),action,...(restoreRevision==null?{}:{restoreRevision})};
 const key=PREFIX+'manifests/'+crypto.randomUUID()+'.json';await immutablePut(bucket,key,manifest);
 const result=await bucket.put(HEAD,JSON.stringify({revision:manifest.revision,manifestKey:key}),{onlyIf:state.etag?{etagMatches:state.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!result)throw fail(409,'Another update won the race; reload before saving','REVISION_CONFLICT');
 return {etag:result.etag,manifest,manifestKey:key};
}
async function newTable(bucket,table,data) {
 const serialized=JSON.stringify(data),bytes=new TextEncoder().encode(serialized);
 if(bytes.length>MAX_BODY)throw fail(413,'Table data is too large','PAYLOAD_LIMIT');
 const sha256=await hashBytes(bytes);
 const key=PREFIX+'tables/'+table+'/'+crypto.randomUUID()+'.json';
 await immutablePut(bucket,key,{format:1,table,data});return {key,count:data.items.length,sha256};
}
async function hashBytes(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function metadata(state) {return {mode:state.manifestKey?'cloud':'not_imported',revision:state.manifest.revision,updatedAt:state.manifest.updatedAt,tables:Object.fromEntries(Object.entries(state.manifest.tables).map(([name,ref])=>[name,{count:ref.count}]))};}
function queryTable(items,search) {
 const {order,limit,...where}=Object.fromEntries(search);
 let selected=items.filter(item=>Object.entries(where).every(([key,raw])=>{
  if(dangerous.has(key))return false;
  const value=item[key],wanted=String(raw).replace(/^eq\./,''),inValues=String(raw).match(/^in\.\((.*)\)$/)?.[1].split(',');
  if(inValues)return inValues.includes(String(value??''));
  if(Array.isArray(value))return value.map(String).includes(wanted);
  return String(value??'')===wanted;
 }));
 if(order){const [field,direction]=order.split('.');selected=[...selected].sort((a,b)=>String(a[field]??'').localeCompare(String(b[field]??''))*(direction==='desc'?-1:1));}
 if(limit!==undefined){if(!/^\d+$/.test(limit))throw fail(400,'Invalid limit','INVALID_QUERY');selected=selected.slice(0,Math.min(Number(limit),MAX_ROWS));}
 return selected;
}
function pathOf(value) {
 if(typeof value!=='string'||value.length>500)throw fail(400,'Invalid document path','INVALID_PATH');
 let path;try{path=decodeURIComponent(value);}catch{throw fail(400,'Invalid document path','INVALID_PATH');}
 if(!path.startsWith('output/content/')||!path.endsWith('.md')||/[\\%\x00-\x1f]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw fail(400,'Document path is outside the permitted area','INVALID_PATH');
 return path;
}
function recognized(url) {
 if(url.pathname==='/api/similar'||url.pathname==='/api/write-md'||url.pathname.startsWith('/api/cloud-workspace'))return true;
 const table=url.pathname.match(/^\/api\/([a-z_]+)(?:\/[^/]+)?$/)?.[1];
 return tableOK(table)&&table!=='notifications';
}
/** True for migrated collection paths only. Excludes the live notification API.
 * Root client code can use this to direct-fetch these routes instead of reading
 * its cached /api/snapshot object. Accepts a pathname or an absolute URL.
 */
export function isLegacyCloudPath(value) {
 let pathname;try{pathname=new URL(value,'https://workspace.invalid').pathname;}catch{return false;}
 const match=pathname.match(/^\/api\/(?:cloud-workspace\/tables\/)?([a-z_]+)(?:\/[^/]+)?$/);
 return !!match&&tableOK(match[1])&&(match[1]!=='notifications'||pathname.startsWith('/api/cloud-workspace/tables/'));
}
async function historyOf(bucket,state,limit=MAX_HISTORY) {
 const list=[];let manifest=state.manifest,key=state.manifestKey;
 while(key&&list.length<limit){list.push({key,manifest});key=manifest.previous;if(key){if(!key.startsWith(PREFIX+'manifests/'))throw fail(503,'Invalid history reference','STORAGE_ERROR');const saved=await getJson(bucket,key);if(!saved)throw fail(503,'History is unavailable','STORAGE_ERROR');manifest=saved.value;}}
 return list;
}
function similar(query,items,threshold=.22) {
 const grams=value=>{const s=[...String(value).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim()];return new Set(!s.length?[]:s.length<3?[s.join('')]:s.slice(0,-2).map((_,i)=>s.slice(i,i+3).join('')));};
 const a=grams(query),score=text=>{const b=grams(text);return a.size&&b.size?[...a].filter(x=>b.has(x)).length/new Set([...a,...b]).size:0;};
 return items.map(item=>({...item,similarity:Math.max(score(item.title||''),score(item.canonical_angle||''),score((item.title||'')+' '+(item.canonical_angle||'')))})).filter(item=>item.similarity>=threshold).sort((a,b)=>b.similarity-a.similarity);
}

export async function handleCloudData(request,env,{role,importAuthorized=false}={}) {
 const url=new URL(request.url);if(!recognized(url))return null;
 try{
  if(!roles.has(role))throw fail(401,'Login required','UNAUTHENTICATED');
  if(importAuthorized&&!['/api/cloud-workspace/import','/api/cloud-workspace/import-status'].includes(url.pathname))throw fail(403,'Migration credential is scoped to import and verification','IMPORT_SCOPE');
  if(!env?.BUCKET)throw fail(503,'Cloud storage is unavailable','STORAGE_ERROR');
  const mutating=!['GET','HEAD'].includes(request.method);
  // Import tokens may be sent by a non-browser migration client. Every other
  // mutation requires a same-origin browser request; root still authenticates.
  if(mutating&&!(url.pathname==='/api/cloud-workspace/import'&&importAuthorized)&&request.headers.get('origin')!==url.origin)throw fail(403,'Same-origin request required','ORIGIN_REQUIRED');
  const bucket=env.BUCKET,state=await stateOf(bucket),revision=state.manifest.revision;
  if(url.pathname==='/api/cloud-workspace/import-status'){
   requireAdmin(role);if(!importAuthorized)throw fail(403,'Migration authorization required','IMPORT_AUTH_REQUIRED');
   if(request.method!=='GET')throw fail(405,'Method not allowed','METHOD');
   // Read the actual immutable payloads again, rather than trusting the hashes
   // recorded during upload. This endpoint verifies persisted data end to end.
   const tables={};
   for(const table of CLOUD_TABLES){
    const data=await tableOf(bucket,state,table);if(!data)continue;
    const sha256=await hashBytes(new TextEncoder().encode(JSON.stringify(data))),ref=state.manifest.tables[table];
    if(sha256!==ref.sha256||data.items.length!==ref.count)throw fail(503,'Persisted workspace data failed integrity verification','INTEGRITY_ERROR');
    tables[table]={count:data.items.length,sha256};
   }
   return reply({...metadata(state),tables},200,revision);
  }
  if(url.pathname==='/api/cloud-workspace/import'){
   requireAdmin(role);if(!importAuthorized)throw fail(403,'Migration authorization required','IMPORT_AUTH_REQUIRED');
   if(request.method!=='POST')throw fail(405,'Method not allowed','METHOD');
   const body=await bodyOf(request);checkRevision(request,state,{allowInitial:true});
   if(!isObject(body.tables)||Object.keys(body.tables).length!==CLOUD_TABLES.length||CLOUD_TABLES.some(t=>!owns(body.tables,t)))throw fail(400,'Import must contain exactly all 16 tables','INVALID_IMPORT');
   // Validate the complete import before writing even immutable candidates.
   const data=Object.fromEntries(CLOUD_TABLES.map(table=>[table,tableEnvelope(table,body.tables[table])]));
   const tables={};for(const table of CLOUD_TABLES)tables[table]=await newTable(bucket,table,data[table]);
   const next=await publish(bucket,state,{tables,action:'import'});return reply({ok:true,...metadata(next)},201,next.manifest.revision);
  }
  if(url.pathname==='/api/cloud-workspace/history'){
   requireAdmin(role);if(request.method!=='GET')throw fail(405,'Method not allowed','METHOD');
   const list=await historyOf(bucket,state);return reply({current:revision,items:list.map(({manifest:m})=>({revision:m.revision,updatedAt:m.updatedAt,action:m.action,restoreRevision:m.restoreRevision??null,tables:Object.fromEntries(Object.entries(m.tables).map(([t,r])=>[t,r.count]))}))},200,revision);
  }
  if(url.pathname==='/api/cloud-workspace/rollback'){
   requireAdmin(role);if(request.method!=='POST')throw fail(405,'Method not allowed','METHOD');
   const body=await bodyOf(request);checkRevision(request,state);
   if(!Number.isInteger(body.revision)||body.revision<1)throw fail(400,'Invalid rollback revision','INVALID_REVISION');
   const found=(await historyOf(bucket,state)).find(x=>x.manifest.revision===body.revision);
   if(!found)throw fail(404,'Revision is outside the retained history window','NOT_FOUND');
   const next=await publish(bucket,state,{tables:found.manifest.tables,documents:found.manifest.documents,action:'rollback',restoreRevision:body.revision});return reply({ok:true,...metadata(next)},200,next.manifest.revision);
  }
  if(url.pathname==='/api/cloud-workspace/status'){if(request.method!=='GET')throw fail(405,'Method not allowed','METHOD');return reply(metadata(state),200,revision);}
  if(url.pathname==='/api/write-md'){
   requireEditor(role);if(request.method!=='POST')throw fail(405,'Method not allowed','METHOD');
   const body=await bodyOf(request);checkRevision(request,state);const path=pathOf(body.path);
   if(typeof body.content!=='string'||new TextEncoder().encode(body.content).length>1_000_000)throw fail(400,'Invalid Markdown content','INVALID_DOCUMENT');
   const key=PREFIX+'documents/'+crypto.randomUUID()+'.json';await immutablePut(bucket,key,{format:1,path,content:body.content});
   const next=await publish(bucket,state,{documents:{...state.manifest.documents,[path]:{key}},action:'document'});return reply({path},200,next.manifest.revision);
  }
  if(url.pathname==='/api/cloud-workspace/document'){
   if(request.method!=='GET')throw fail(405,'Method not allowed','METHOD');const path=pathOf(url.searchParams.get('path')),ref=state.manifest.documents[path];
   if(!ref)throw fail(404,'Document not found','NOT_FOUND');const saved=await getJson(bucket,ref.key);if(!saved)throw fail(503,'Document unavailable','STORAGE_ERROR');
   return new Response(redactText(saved.value.content),{headers:{...headers(revision),'content-type':'text/markdown; charset=utf-8'}});
  }
  if(url.pathname==='/api/similar'){
   if(!['GET','POST'].includes(request.method))throw fail(405,'Method not allowed','METHOD');
   const body=request.method==='POST'?await bodyOf(request):{query:url.searchParams.get('q')||'',threshold:Number(url.searchParams.get('threshold')||'.22')};
   if(typeof body.query!=='string'||body.query.length>2000)throw fail(400,'Invalid query','INVALID_QUERY');const threshold=body.threshold??.22;
   if(typeof threshold!=='number'||!Number.isFinite(threshold)||threshold<0||threshold>1)throw fail(400,'Invalid threshold','INVALID_QUERY');
   const data=await tableOf(bucket,state,'content_items');if(!data)throw fail(503,'Workspace has not been imported','NOT_IMPORTED');
   return reply({items:similar(body.query,data.items.map(x=>projectCloudRecord('content_items',x)),threshold)},200,revision);
  }
  const match=url.pathname.match(/^\/api\/(?:cloud-workspace\/tables\/)?([a-z_]+)(?:\/([^/]+))?$/);
  if(!match||!tableOK(match[1])||match[1]==='notifications'&&!url.pathname.startsWith('/api/cloud-workspace/tables/'))throw fail(404,'Not found','NOT_FOUND');
  const table=match[1];let id=null;if(match[2]){try{id=decodeURIComponent(match[2]);}catch{throw fail(400,'Invalid ID','INVALID_ID');}validateId(id);}
  const data=await tableOf(bucket,state,table);if(!data)throw fail(503,'Table has not been imported','NOT_IMPORTED');
  if(request.method==='GET'&&!id)return reply({version:1,items:queryTable(data.items.map(x=>projectCloudRecord(table,x)),url.searchParams)},200,revision);
  requireEditor(role);checkRevision(request,state);
  if(!['POST','PUT','PATCH','DELETE'].includes(request.method)||request.method==='POST'&&id||request.method!=='POST'&&!id)throw fail(405,'Method not allowed','METHOD');
  const nextData=clone(data),idField=ids[table]||'id',index=id?nextData.items.findIndex(x=>x[idField]===id):-1;let result=null;
  if(request.method==='POST'){
   const input=await bodyOf(request);validateRecord(table,input,{editable:true});
   if(nextData.items.some(x=>x[idField]===input[idField]))throw fail(409,'Duplicate record ID','DUPLICATE_ID');
   if(nextData.items.length>=MAX_ROWS)throw fail(413,'Table is full','PAYLOAD_LIMIT');nextData.items.push(input);result=input;
  }else{
   if(index<0)throw fail(404,'Record not found','NOT_FOUND');
   if(request.method==='DELETE')nextData.items.splice(index,1);
   else{
    const input=await bodyOf(request);for(const key of Object.keys(input))if(!fields[table].has(key))throw fail(400,'Field is not editable: '+key,'INVALID_FIELD');
    if(owns(input,idField)&&input[idField]!==id)throw fail(400,'Record ID cannot change','INVALID_ID');
    // Preserve imported private fields on PATCH. PUT is explicit replacement.
    result=request.method==='PATCH'?{...nextData.items[index],...input,[idField]:id}:input;
    validateRecord(table,result,{strict:request.method==='PUT'});validateStates(table,input);validateWriteTypes(table,input);if(request.method==='PUT'&&result[idField]!==id)throw fail(400,'Record ID cannot change','INVALID_ID');nextData.items[index]=result;
   }
  }
  const ref=await newTable(bucket,table,nextData),next=await publish(bucket,state,{tables:{...state.manifest.tables,[table]:ref},action:request.method.toLowerCase()+':'+table});
  return reply(result?projectCloudRecord(table,result):null,request.method==='DELETE'?204:request.method==='POST'?201:200,next.manifest.revision);
 }catch(error){return reply({error:error.status?error.message:'Cloud storage operation failed',code:error.code||'STORAGE_ERROR'},error.status||503);}
}

/** Overlay only imported legacy collections. Existing live notification routes,
 * financial feeds, fallback snapshots, and their timestamps stay untouched.
 * Throws on missing/corrupt cloud state: never silently replace it with old Mac
 * content. Caller may display its existing recovery state on a storage failure.
 */
export async function mergeCloudSnapshot(snapshot,env,{role}={}) {
 if(!roles.has(role))throw fail(401,'Login required','UNAUTHENTICATED');
 const state=await stateOf(env.BUCKET);if(!state.manifestKey)return {...snapshot,cloudWorkspace:metadata(state)};
 const data={...snapshot.data};
 for(const table of CLOUD_TABLES){const saved=await tableOf(env.BUCKET,state,table);if(saved)data['/api/'+table]={version:1,items:saved.items.map(x=>projectCloudRecord(table,x))};}
 return {...snapshot,data,cloudWorkspace:metadata(state)};
}

export const cloudDataInternals=Object.freeze({HEAD,PREFIX,MAX_BODY,etag});
