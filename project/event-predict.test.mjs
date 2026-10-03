import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {forecast,defaultsFor,historyFor,identifyVenue,baselineFor,historicalTarget,selectedDays} from './out/assets/event-predict-model.mjs';
import {createPredictLoader} from './event-predict-data.mjs';
import {prepareEventRequest,createEventRequest,listEventRequests} from './event-requests.mjs';
import {previewDatabase} from './preview-db.mjs';
const rows=[{usable:true,net:10000,days:10,cogs:2000,space:1000,pc:1000,shipping:100,other:0}];
const base={mode:'history',days:10,cogs:20,rent:1000,gp:30,pc:100,shipping:100,other:0,channel:'direct',targetMode:'manual',target:10000,downside:20,upside:20};
const dataset=JSON.parse(fs.readFileSync('event-predict.snapshot.json'));
test('rent fixed, GP variable, ROI on total costs, 40% ROI targets rounded upward',()=>{
 const d=forecast(rows,base),g=forecast(rows,{...base,channel:'gp'});
 assert.equal(d.base.profit,5900);assert.equal(d.breakEven,2625);assert(Math.abs(d.base.roi-5900/4100*100)<1e-8);assert.equal(d.roiTarget,5000);
 assert.equal(g.base.profit,3900);assert.equal(g.breakEven,2200);assert.equal(g.roiTarget,10000);
 assert.deepEqual(d.scenarios.map(s=>s.sales),[8000,10000,12000]);
 assert.deepEqual(d.scenarios.map(s=>s.space),[1000,1000,1000]);assert.deepEqual(g.scenarios.map(s=>s.space),[2400,3000,3600]);
 const withTarget=forecast(rows,{...base,targetMode:'roi'});assert(withTarget.target.roi>=40);assert.equal(withTarget.target.sales,5000);
});
test('weighted average pools same venue while cost defaults and targets use selected channel',()=>{
 const r={name:'Fashion Island 1-10/01/69',venue:identifyVenue('Fashion Island'),channel:'direct',days:1,net:1000,target:8000,row:5};
 const g={...r,name:'Fashion Island 1-10/02/69',channel:'gp',days:9,net:18000,target:19000,row:9};
 const history=historyFor([r,g],r.venue.id,null,'2026-09-20');assert.equal(baselineFor(history).rate,1900);assert.equal(historicalTarget(history,'direct').value,8000);
 assert.equal(forecast(history,{...base,days:10}).base.sales,19000);
});
test('missing and invalid costs block financial metrics, zero cost ROI undefined, impossible ROI has no target',()=>{
 assert.equal(forecast(rows,{...base,other:''}).base.profit,null);assert.equal(forecast(rows,{...base,other:''}).base.sales,10000);
 assert.equal(forecast(rows,{...base,days:0}).base.sales,null);assert.equal(forecast(rows,{...base,days:1.5}).base.sales,null);
 assert.equal(forecast(rows,{...base,gp:101,channel:'gp'}).base.profit,null);
 assert.equal(forecast(rows,{...base,cogs:80,targetMode:'roi'}).roiTargetStatus,'unreachable');
 const free=forecast(rows,{...base,cogs:0,rent:0,pc:0,shipping:0});assert.equal(free.base.roi,null);assert.equal(free.roiTarget,null);
 assert.equal(defaultsFor([{...rows[0],cogs:0}]).cogs,null);
});
test('manual location has no baseline, can calculate target and ROI',()=>{
 const r=forecast([],{...base,mode:'manual',expectedSales:16373,cogs:20.84,gp:33,pc:500.86,shipping:0,channel:'gp',targetMode:'roi'});
 assert.equal(r.baseline.rate,null);assert.equal(r.roiTarget,30000);assert(Math.abs(r.base.roi-18.44048)<.001);assert(r.target.roi>=40);
});
test('future, invalid dates and duplicate rows excluded; venue labels contain no dates',()=>{
 const r={...rows[0],name:'Fashion Island 1-10/01/69',venue:identifyVenue('Fashion Island'),channel:'direct'};
 assert.equal(historyFor([r],r.venue.id,null,'2026-09-20')[0].usable,true);assert(historyFor([r,r],r.venue.id,null,'2026-09-20').every(r=>!r.usable));
 assert.equal(historyFor([{...r,name:'Fashion Island 1-10/11/69'}],r.venue.id,null,'2026-09-20')[0].usable,false);
 assert.equal(historyFor([{...r,name:'Fashion Island 30/06-12/06/69'}],r.venue.id,null,'2026-09-20')[0].usable,false);
 assert.equal(identifyVenue('ลานโปร CDS Ladprao (ลาดพร้าว) 20/08-02/09/69').id,identifyVenue('ลานโปรเซ็นทรัลลาดพร้าว ชั้น2 19/08-02/09/69').id);
 assert(identifyVenue('Outdoor fest 2026 21-24/05/69').unmapped);assert(dataset.records.filter(r=>r.target>0).length>50);
});
test('offline fallback remains explicitly stale',async()=>{
 const v=await createPredictLoader({fetchImpl:async()=>{throw Error('offline')}})({BUCKET:{get:async()=>null}},dataset);assert.equal(v.source.status,'stale');
});
const makeBody=()=>({id:crypto.randomUUID(),place:'พื้นที่ใหม่ทดสอบ',referenceKey:'manual',startDate:'2026-10-01',endDate:'2026-10-10',input:{...base,mode:'manual',expectedSales:10000,proposalDate:'2026-09-20',confirmBy:'2026-09-25'}});
const request=body=>new Request('https://example.test/api/event-requests',{method:'POST',headers:{'origin':'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});
test('durable proposal write/read is idempotent and recomputes ROI instead of trusting browser',async()=>{
 const env={DB:previewDatabase()},body=makeBody();body.profit=999999;body.trade='อนุมัติ';
 const a=await createEventRequest(request(body),env,dataset),b=await createEventRequest(request(body),env,dataset);assert.equal(a.id,b.id);
 const records=await listEventRequests(env);assert.equal(records.items.length,1);assert.equal(records.items[0].profit,'5900');assert.equal(records.items[0].trade,'รออนุมัติ');assert.equal(records.items[0].roi,'143.90%');
 await assert.rejects(()=>createEventRequest(request({...body,input:{...body.input,target:25000}}),env,dataset),e=>e.status===409);env.DB.close();
});
test('reject missing dates, impossible days, missing target, personal data, cross-origin posts',async()=>{
 const body=makeBody();assert.throws(()=>prepareEventRequest({...body,startDate:''},dataset));assert.throws(()=>prepareEventRequest({...body,endDate:'2026-10-02'},dataset));assert.doesNotThrow(()=>prepareEventRequest({...body,input:{...body.input,target:''}},dataset));assert.throws(()=>prepareEventRequest({...body,place:'x@example.test'},dataset));
 const req=request(body);req.headers.set('origin','https://evil.test');await assert.rejects(()=>createEventRequest(req,{DB:previewDatabase()},dataset),e=>e.status===403);
});

test('every known venue resolves its own display label',()=>{for(const r of dataset.records){const v=identifyVenue(r.name);if(!v.unmapped)assert.equal(identifyVenue(v.label).id,v.id,v.label);}});
test('historical request uses reviewed baseline and retries survive source changes',async()=>{
 const now=new Date('2026-09-20T12:00:00Z'),venue=identifyVenue('Fashion Island'),history=historyFor(dataset.records,venue.id,null,'2026-09-20');
 const {historySignature}=await import('./out/assets/event-predict-model.mjs');
 const body={...makeBody(),place:venue.label,referenceKey:historySignature(history),input:{...base,mode:'history',proposalDate:'2026-09-20',confirmBy:'2026-09-25'}};
 const prepared=prepareEventRequest(body,dataset,now);assert.equal(prepared.calculation.base.sales,baselineFor(history).rate*10);
 assert.throws(()=>prepareEventRequest({...body,referenceKey:'old'},dataset,now),e=>e.code==='history_changed');
 const env={DB:previewDatabase()};await createEventRequest(request(body),env,dataset);const retry=await createEventRequest(request(body),env,{records:[],source:{}});assert.equal(retry.id,body.id);assert.equal((await listEventRequests(env)).items.length,1);env.DB.close();
});

test('selected dates govern forecast and scenarios ignore target',()=>{
 assert.equal(selectedDays('2026-09-30','2026-10-02'),3);
 assert.equal(selectedDays('2028-02-28','2028-03-01'),3);
 assert.equal(selectedDays('2026-10-01','2026-10-01'),1);
 assert.equal(selectedDays('2026-10-02','2026-10-01'),null);
 const r=forecast(rows,{...base,startDate:'2026-10-01',endDate:'2026-10-03',target:999999,downside:10,upside:10});
 assert.deepEqual(r.scenarios.map(s=>s.sales),[2700,3000,3300.0000000000005]);
 assert.equal(r.base.fixed,1400);assert.equal(r.base.profit,1000);assert.equal(r.base.roi,50);
 assert.equal(forecast(rows,{...base,startDate:'2026-10-01',endDate:''}).base.sales,null);
 const m=forecast([],{...base,mode:'manual',expectedSales:5000,target:'',downside:10,upside:10});
 assert.deepEqual(m.scenarios.map(s=>s.sales),[4500,5000,5500]);
});
test('proposal dates persist and invalid deadlines are rejected',()=>{
 const body=makeBody(),record=prepareEventRequest(body,dataset);
 assert.equal(record.proposalDate,'2026-09-20');assert.equal(record.confirmBy,'2026-09-25');
 assert.throws(()=>prepareEventRequest({...body,input:{...body.input,confirmBy:'2026-09-19'}},dataset));
 assert.throws(()=>prepareEventRequest({...body,input:{...body.input,proposalDate:''}},dataset));
});

test('stalled storage and upstream cannot block the fallback or leave pending requests stuck',async()=>{
 const never=()=>new Promise(()=>{}),now=Date.now();
 const loader=createPredictLoader({fetchImpl:never,readMs:15,fetchMs:20});
 const env={BUCKET:{get:never,put:never}};
 const [a,b]=await Promise.all([loader(env,dataset),loader(env,dataset)]);
 assert.equal(a.source.status,'stale');assert.equal(a.records.length,dataset.records.length);assert.deepEqual(a,b);
 assert(Date.now()-now<1000);assert.equal((await loader(env,dataset)).records.length,dataset.records.length);
});
