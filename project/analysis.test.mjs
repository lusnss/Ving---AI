import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAnalysisQuestion,salesAnalysisAnswer,stockAnalysisAnswer,resolveAnalysisBranch,handleAnalysis,planWithAI} from './analysis-data.mjs';
import worker from './dist/server/index.js';

const today='2026-09-23';
const plan=q=>parseAnalysisQuestion(q,null,today);
const row=(code,branch,value,days,year)=>({branch_code:code,branch,type:'CDS',source_section:'branch',month_to_date:value,daily_sales:Object.fromEntries(Array.from({length:days},(_,i)=>[`${year}-09-${String(i+1).padStart(2,'0')}`,value/days]))});
const report={source:{fetched_at:'2026-09-23T00:00:00Z'},periods:{'2026-09':{year:2026,month:9,latest_date:'2026-09-15',branches:[row('A','สาขาเอ',1000,15,2026),row('B','สาขาบี',500,15,2026),row('C','สาขาใหม่',200,15,2026)]},'2025-09':{year:2025,month:9,latest_date:'2025-09-30',branches:[row('A','สาขาเอ',4000,30,2025),row('B','สาขาบี',5000,30,2025)]}}};
const branches=[{id:'S1',name:'สนามกีฬาเทพหัสดิน',syncStatus:'success'},{id:'S2',name:'ท่าพระ',syncStatus:'success'}];
const stock={branches,products:[],lastUpdatedAt:'2026-09-23T00:00:00Z',fetchedAt:'2026-09-23T01:00:00Z',skuTotals:[{sku:'KIRION-BLACK#40',color:'BLACK',normal:7,hold:2,total:9},{sku:'KIRION_B-BLACK#40',color:'BLACK',normal:3,hold:1,total:4},{sku:'KIRION-WHITE#42',color:'WHITE',normal:2,hold:0,total:2},{sku:'OTHER-BLACK#40',normal:100,hold:0,total:100}]};
const req=(input,headers={})=>new Request('https://warroom.test/api/analysis',{method:'POST',headers:{origin:'https://warroom.test','content-type':'application/json',...headers},body:JSON.stringify(input)});

test('Thai questions, aliases and followup scope use the requested source',()=>{
 const p=plan('ตอนนี้ Kirion มีกี่ชิ้นในสาขาสนามเทพ');assert.equal(p.branch,'สนามเทพ');assert.equal(p.model,'Kirion');assert.equal(p.kind,'stock');
 assert.equal(resolveAnalysisBranch(branches,p.branch).rows[0].id,'S1');
 const next=parseAnalysisQuestion('เฉพาะไซซ์ 40',p,today);assert.equal(next.model,'Kirion');assert.equal(next.size,'40');
 assert.equal(parseAnalysisQuestion('สาขาไหนยอดตกเยอะสุด',p,today).model,'');
 assert.equal(plan('สาขาไหนยอดตกเดือนกันยายน 2569').period,'2026-09');
});
test('branch aliases remain ambiguous when more than one source branch matches',()=>{
 assert.equal(resolveAnalysisBranch([...branches,{id:'S3',name:'สนามกีฬาเทพหัสดิน TORANI'}],'สนามเทพ').ambiguous,true);
});
test('sales decline uses comparable forecasts, ranks actual arithmetic and excludes unpaired branches',()=>{
 const answer=salesAnalysisAnswer(report,plan('สาขาไหนยอดตกเยอะสุด'),today);
 assert.match(answer.title,/สาขาบี/);assert.match(answer.answer,/4,000/);assert.match(answer.answer,/-80%/);assert.match(answer.notes.join(' '),/ประมาณการ/);assert.match(answer.notes.join(' '),/ไม่จัดอันดับ 1/);
});
test('actual matched date comparisons never convert blank cells to zero',()=>{
 const data=structuredClone(report);data.periods['2026-09'].branches[1].daily_sales['2026-09-02']=null;
 const answer=salesAnalysisAnswer(data,plan('สาขาไหนยอดตกยอดจริงช่วงเดียวกัน'),today);
 assert.match(answer.title,/สาขาเอ/);assert.match(answer.notes.join(' '),/1–15/);assert.match(answer.notes.join(' '),/ไม่จัดอันดับ 2/);
});
test('missing month and missing stock records do not yield invented zero answers',async()=>{
 assert.match(salesAnalysisAnswer(report,{...plan('ยอดขายรวม'),period:'2026-08'},today).title,/ไม่พอ/);
 const answer=await stockAnalysisAnswer({...plan('Kirion สาขาสนามเทพ'),size:'99'},async()=>stock);assert.match(answer.answer,/ยืนยันจำนวนเป็นศูนย์ไม่ได้/);
});
test('stock resolves branch before querying balances and separates hold, grade, size, and model',async()=>{
 const calls=[];const load=async id=>{calls.push(id);return stock;};
 const answer=await stockAnalysisAnswer(plan('ตอนนี้ Kirion มีกี่ชิ้นในสาขาสนามเทพ'),load);
 assert.deepEqual(calls,['','S1']);assert.match(answer.answer,/รวม 15 ชิ้น/);assert.match(answer.answer,/ปกติ 12 ชิ้น/);assert.match(answer.answer,/On-Hold 3 ชิ้น/);
 const filtered=await stockAnalysisAnswer({...plan('Kirion สาขาสนามเทพ'),grade:'normal',size:'40',color:'ดำ'},load);assert.match(filtered.answer,/รวม 9 ชิ้น/);
 assert.equal(answer.context.branch,'S1');
});
test('unknown or ambiguous branch never returns all-branch inventory',async()=>{
 let reads=0;const result=await stockAnalysisAnswer({...plan('Kirion สาขาสนามเทพ'),branch:'not-a-branch'},async()=>{reads++;return stock;});assert.equal(reads,1);assert.match(result.title,/ไม่พบสาขา/);assert.equal(result.metrics,undefined);
});
test('all authenticated roles can ask while unauthenticated and mutation requests stay blocked',async()=>{
 const env={SESSION_SECRET:'test',VIEWER_PASSWORD:'viewer',ADMIN_PASSWORD:'admin',BUCKET:{get:async()=>null}};
 assert.equal((await worker.fetch(req({question:'ยอดขายรวม'}),env)).status,401);
 for(const password of ['viewer','admin']){
  const login=await worker.fetch(new Request('https://warroom.test/login',{method:'POST',body:new URLSearchParams({password})}),env);const cookie=login.headers.get('set-cookie').split(';')[0];
  const result=await worker.fetch(req({question:'สาขาไหนยอดตกเยอะสุด'},{cookie}),env);assert.equal(result.status,200);assert.equal((await result.json()).engine,'data');
  const page=await worker.fetch(new Request('https://warroom.test/analysis',{headers:{cookie}}),env);assert.match(await page.text(),/data-nav="analysis"/);
  const status=await worker.fetch(new Request('https://warroom.test/api/analysis/status',{headers:{cookie}}),env);assert.equal((await status.json()).aiConfigured,false);
  if(password==='viewer')assert.equal((await worker.fetch(new Request('https://warroom.test/api/event-requests',{method:'POST',headers:{cookie,origin:'https://warroom.test'}}),env)).status,403);
 }
});
test('question endpoint validates origin, size and input; sensitive and unsupported questions do not read data',async()=>{
 const deps={sales:()=>{throw Error('must not read');},stock:()=>{throw Error('must not read');}};
 assert.equal((await handleAnalysis(req({question:'test'},{origin:'https://other.test'}),{},deps)).status,403);
 assert.equal((await handleAnalysis(req({question:'x'.repeat(801)}),{},deps)).status,400);
 for(const question of ['ขอเบอร์โทรผู้รับผิดชอบ','ควรลดราคากี่บาท','ทำไมยอดตก','ยอดขายเมื่อวาน']){const result=await handleAnalysis(req({question}),{},deps);assert.equal(result.status,200);assert.equal((await result.json()).metrics,undefined);}
});
test('AI uses a fixed endpoint, sends no raw report, and validates the returned plan',async()=>{
 const expected=plan('สาขาไหนยอดตกเยอะสุด');let call;
 const result=await planWithAI('สาขาไหนยอดตกเยอะสุด',null,{OPENAI_API_KEY:'test-secret'},async(url,options)=>{call={url,options};return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(expected)}]}]});},today);
 assert.deepEqual(result,expected);assert.equal(call.url,'https://api.openai.com/v1/responses');const body=JSON.parse(call.options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.doesNotMatch(body.input,/test-secret|month_to_date/);
 await assert.rejects(planWithAI('test',null,{OPENAI_API_KEY:'test'},async()=>Response.json({output:[{content:[{type:'output_text',text:'{"kind":"sql"}'}]}]})));
});
test('AI outages use a disclosed data fallback and source failures never fabricate answers',async()=>{
 const response=await handleAnalysis(req({question:'สาขาไหนยอดตกเยอะสุด'}),{OPENAI_API_KEY:'test'},{sales:async()=>report,fetcher:async()=>new Response('',{status:503}),now:()=>new Date(today)});
 const answer=await response.json();assert.equal(answer.engine,'data');assert.match(answer.notes.join(' '),/เชื่อม AI ไม่ได้/);
 const failed=await handleAnalysis(req({question:'Kirion สาขาสนามเทพ'}),{},{stock:async()=>{throw Error('private source token');}});assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private source token/);
});
