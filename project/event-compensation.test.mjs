import test from 'node:test';
import assert from 'node:assert/strict';
import {compensationDefaults,compensationProfile,compensationProfilesFor,compensationVenue,compensationWage,estimateCompensation} from './out/assets/event-compensation.mjs';
import {eventCompensationProfiles} from './out/assets/event-compensation-data.mjs';
import {forecast} from './out/assets/event-predict-model.mjs';
import {compensationPanelMarkup} from './out/assets/event-compensation-ui.mjs';
import {prepareEventRequest,createEventRequest,updateEventRequest,listEventRequests} from './event-requests.mjs';
import {previewDatabase} from './preview-db.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';
const base={mode:'manual',salesMode:'',expectedSales:300000,channel:'direct',days:10,cogs:20,rent:10000,gp:0,shipping:1000,other:0,targetMode:'roi-pc',target:'',downside:10,upside:10};
const plan=(place,profile='')=>({...base,...compensationDefaults(place,'',profile),pcCount:2});
const inputFor=profile=>plan(profile.name,profile.id);

test('venues resolve separately, source defaults have provenance, and unknown wages stay unknown',()=>{
 assert.equal(compensationDefaults('เมกาบางนา').pc,650);
 assert.equal(compensationDefaults('เมกาบางนา').pcCostMode,'person');
 const bangkhae=compensationDefaults('เดอะมอลล์ บางแค');
 assert.equal(bangkhae.rateProfile,'October2026-C2');assert.equal(bangkhae.wageProfile,'September2026-C9');assert.equal(bangkhae.pc,700);
 assert.equal(compensationDefaults('Seacon').pc,'');
 assert.equal(compensationDefaults('พื้นที่ที่ไม่มีข้อมูล').incentiveAmount,'');
 assert.equal(compensationVenue('เทอมินอล21 พระราม3').id,'terminal-rama3');
 assert.equal(compensationVenue('ตึกสินสาธร').id,'sinsathorn');
 assert(compensationProfilesFor('บ้านและสวน','ไบเทค').every(p=>p.name.includes('ไบเทค')));
 assert(compensationProfilesFor('บ้านและสวน','เมืองทอง').every(p=>p.name.includes('เมืองทอง')));
 assert.deepEqual(compensationProfilesFor('บ้านและสวน'),[]);
 assert.match(compensationPanelMarkup(bangkhae,'เดอะมอลล์ บางแค'),/รอบที่เลือกไม่มีค่าแรงครบ/);
 assert.doesNotThrow(()=>compensationPanelMarkup({...bangkhae,wageProfile:'',wageMode:'source'},'บางแค'));
 assert.equal(eventCompensationProfiles.length,142);
 for(const p of eventCompensationProfiles){assert(p.source.sheet);assert(p.source.file==='เรทEvent.xlsx');assert(!p.wage||['flat','calendar','range'].includes(p.wage.kind));}
});

test('daily wages include allowances once and follow weekdays and dated holiday overrides',()=>{
 const mega=eventCompensationProfiles.find(p=>p.id==='January2026-F3');
 assert.equal(mega.wage.amount,750);
 const east=compensationProfilesFor('เซ็นทรัล อีสต์วิลล์').find(p=>p.wage?.kind==='calendar');
 const w=compensationWage(east,{startDate:'2026-10-02',endDate:'2026-10-04',days:99});
 assert.equal(w.totalPerPerson,1900);assert.equal(w.daily,1900/3);
 const calendarPlan={...inputFor(east),startDate:'2026-10-02',endDate:'2026-10-04',days:99};
 assert.equal(forecast([],calendarPlan).base.pc,3800);
 const holiday=compensationProfile('December2025-C3');
 assert.equal(compensationWage(holiday,{startDate:'2025-12-31',endDate:'2026-01-01'}).totalPerPerson,1600);
 assert.equal(compensationWage(holiday,{startDate:'2026-12-31',endDate:'2027-01-01'}).totalPerPerson,holiday.wage.amount*2);
});

test('commission brackets, strict thresholds, excess-sales choices and team bonuses match source terms',()=>{
 const threshold=plan('เดอะมอลล์ บางแค');
 assert.equal(estimateCompensation(80000,threshold).total,0);
 assert.equal(estimateCompensation(80001,threshold).commission,800.01);
 const mega=plan('เมกาบางนา');
 for(const [sales,expected] of [[199999,0],[200000,1000],[300000,3000],[400000,6000],[500000,10000]])assert.equal(estimateCompensation(sales,mega).total,expected);
 const excess=inputFor(eventCompensationProfiles.find(p=>p.commission?.kind==='excess'));
 assert.equal(estimateCompensation(199999,excess).commission,1999.99);
 assert.equal(estimateCompensation(200000,excess).commission,2000);
 assert.equal(estimateCompensation(250000,excess).commission,750);
 assert.equal(estimateCompensation(250000,{...excess,commissionMethod:'cumulative'}).commission,2750);
 assert.equal(estimateCompensation(300000,excess).bonus,0);
 assert.equal(estimateCompensation(300001,excess).bonus,1000);
 const house=plan('บ้านและสวน เมืองทอง');
 assert.equal(estimateCompensation(700000,house).total,1000);
 assert.equal(estimateCompensation(700000,house).perPerson,500);
 assert.equal(estimateCompensation(1000000,house).total,5000);
 const full=plan('บ้านและสวน ไบเทค','August2025-C4');
 const weekend=plan('บ้านและสวน ไบเทค','August2025-C11');
 assert.equal(estimateCompensation(2500000,full).bonus,3000);
 assert.equal(estimateCompensation(2500000,weekend).bonus,1200);
});

test('all scenarios reconcile wages and incentives into profit; unknown incentive never becomes zero',()=>{
 const r=forecast([],plan('เมกาบางนา'));
 assert.deepEqual(r.errors,[]);
 assert.deepEqual(r.scenarios.map(s=>s.commission),[1350,3000,3300]);
 assert.equal(r.base.pc,13000);assert.equal(r.base.costs,87000);assert.equal(r.base.profit,213000);
 assert.equal(r.base.incentivePerPerson,1500);
 for(const s of r.scenarios){assert.equal(s.costs,s.cogs+s.space+s.staffTotal+1000);assert.equal(s.profit,s.sales-s.costs);}
 const missing={...base,...compensationDefaults('พื้นที่ใหม่'),pc:650,pcCount:2};
 assert(forecast([],missing).errors.includes('incentiveAmount'));assert.equal(forecast([],missing).base.costs,null);
 assert.equal(forecast([],{...missing,incentiveAmount:0}).base.incentive,0);
 assert(forecast([],{...missing,incentiveAmount:1e12}).errors.includes('incentiveAmount'));
 const manual=forecast([],{...plan('เมกาบางนา'),wageMode:'manual',pcCostMode:'total',pc:999,incentiveMode:'manual',incentiveAmount:555});
 assert.equal(manual.base.pc,9990);assert.equal(manual.base.incentive,555);
});

test('ROI, staff targets and break-even account for incentive discontinuities',()=>{
 for(const place of ['เมกาบางนา','เดอะมอลล์ บางแค','เซ็นทรัล อีสต์วิลล์','บ้านและสวน เมืองทอง'])for(const rent of [1000,64000,150000,420000])for(const goal of ['roi','pc','roi-pc']){
  const input={...plan(place),rent,days:100,targetMode:goal,salesMode:'cost-target'},r=forecast([],input),sales=r.base.sales;
  assert(sales>0);assert.deepEqual(r.errors,[]);
  if(goal!=='pc')assert(r.base.roi>=40-1e-8,`${place} ROI at ${sales}`);
  if(goal!=='roi')assert(r.base.staffTotal/sales<=.13+1e-10);
  const lower=forecast([],{...input,salesMode:'',expectedSales:sales-5000}).base;
  assert((goal!=='pc'&&lower.roi<40)||(goal!=='roi'&&lower.staffTotal/(sales-5000)>.13));
  const even=forecast([],{...input,salesMode:'',expectedSales:r.breakEven}).base;
  const before=forecast([],{...input,salesMode:'',expectedSales:r.breakEven-1}).base;
  assert(even.profit>=0);assert(before.profit<0);
 }
});

test('server recomputes calendar costs, validates venue profiles and preserves saved terms through edit and retry',async()=>{
 const env={DB:previewDatabase()},dataset={records:[],source:{}};
 const request=(body,method='POST')=>new Request('https://example.test/api/event-requests',{method,headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify(body)});
 const selected=compensationProfilesFor('เซ็นทรัล อีสต์วิลล์').find(p=>p.wage?.kind==='calendar');
 const body={id:crypto.randomUUID(),place:'เซ็นทรัล อีสต์วิลล์',startDate:'2026-10-02',endDate:'2026-10-04',referenceKey:'manual',input:{...inputFor(selected),days:3,pc:0,proposalDate:'2026-09-23',confirmBy:'2026-09-30'}};
 try{
  const prepared=prepareEventRequest(body,dataset);assert.equal(prepared.calculation.base.pc,3800);
  assert.throws(()=>prepareEventRequest({...body,input:{...body.input,rateProfile:'September2026-F9'}},dataset),/เรทอ้างอิงไม่ตรง/);
  await createEventRequest(request(body),env,dataset);await createEventRequest(request(body),env,dataset);
  let saved=(await listEventRequests(env)).items[0];assert.equal(saved.input.rateProfile,selected.id);
  const html=reviewMarkup(saved);assert.match(html,/เรทEvent.xlsx/);assert.match(html,/คอมมิชชั่น PC คาดการณ์/);
  const edit={...body,revision:saved.createdAt,editToken:crypto.randomUUID(),input:{...body.input,wageMode:'manual',pc:800,incentiveMode:'manual',incentiveAmount:444}};
  await updateEventRequest(request(edit,'PATCH'),env,dataset);await updateEventRequest(request(edit,'PATCH'),env,dataset);
  const items=(await listEventRequests(env)).items;saved=items[0];assert.equal(items.length,1);
  assert.equal(saved.calculation.base.pc,4800);assert.equal(saved.calculation.base.incentive,444);assert.equal(saved.input.incentiveAmount,444);
 }finally{env.DB.close();}
});
