import test from 'node:test';
import assert from 'node:assert/strict';
import {historyFor,baselineFor,baselineEventKey,forecast,historySignature,isBaanSuan,identifyForecastVenue} from './out/assets/event-predict-model.mjs';
import {baselinePickerMarkup} from './out/assets/event-baseline.mjs';
import {eventTypes,pcShiftHours} from './out/assets/event-planning-fields.mjs';
import {prepareEventRequest,createEventRequest,updateEventRequest,listEventRequests} from './event-requests.mjs';
import {reviewModel,reviewMarkup} from './out/assets/event-review.mjs';
import {proposalDisplayRow} from './out/assets/event-proposals.mjs';
import {previewDatabase} from './preview-db.mjs';
const records=[
 {id:'fair-a',name:'บ้านและสวน ไบเทค 1-5/06/69',range:{start:'2026-06-01',end:'2026-06-05'},channel:'direct',days:5,net:100000,cogs:20000,space:10000,pc:5000,shipping:0,other:0},
 {id:'fair-b',name:'IMPACT เมืองทองธานี',originalName:'บ้านและสวน Living Festival',range:{start:'2025-10-01',end:'2025-10-10'},channel:'direct',days:10,net:300000,cogs:60000,space:20000,pc:10000,shipping:0,other:0},
 {id:'fair-c',name:'Baanlaesuan Fair เชียงใหม่ 10-14/06/69',range:{start:'2026-06-10',end:'2026-06-14'},channel:'direct',days:5,net:150000,cogs:30000,space:10000,pc:5000,shipping:0,other:0},
 {id:'other',name:'Money Expo อิมแพ็ค 1-4/05/69',range:{start:'2026-05-01',end:'2026-05-04'},channel:'direct',days:4,net:999999},
 {id:'future',name:'บ้านและสวน อิมแพ็ค 1-10/12/69',range:{start:'2026-12-01',end:'2026-12-10'},channel:'direct',days:10,net:1000000}
];
const data={records,source:{status:'online',fetched_at:'2026-09-22T00:00:00Z'}};
const history=historyFor(records,'baan-suan',null,'2026-09-22');
const input={mode:'history',eventSeries:'baan-suan',eventLocation:'ไบเทค บางนา',channel:'direct',baselineMonth:'all',days:10,cogs:20,rent:10000,pc:500,pcCostMode:'total',shipping:1000,other:0,targetMode:'roi',downside:10,upside:20,proposalScenario:'base',pcStartTime:'10:00',pcEndTime:'21:00',proposalDate:'2026-09-22',confirmBy:'2026-09-30',floor:'',eventTypes:[],eventMonth:'2026-10'};
const body=overrides=>({id:crypto.randomUUID(),place:'บ้านและสวน',startDate:'2026-10-01',endDate:'2026-10-10',referenceKey:historySignature(history),input:{...input,...overrides}});
const request=(payload,method='POST')=>new Request('https://site.test/api/event-requests',{method,headers:{origin:'https://site.test','content-type':'application/json'},body:JSON.stringify(payload)});

test('special fair pools only its own completed events across locations and years',()=>{
 assert.equal(history.length,4);assert.equal(baselineFor(history).observations,3);assert.equal(baselineFor(history).rate,27500);
 assert.deepEqual(historyFor(records,'impact',null,'2026-09-22').map(r=>r.id),['other']);
 assert.equal(identifyForecastVenue(records[1]).id,'baan-suan');assert.equal(isBaanSuan('บ้านเเละสวน'),true);
 assert.equal(baselineFor(history,baselineEventKey(records[2])).rate,30000);
 assert.equal(baselineFor(history,baselineEventKey(records[4])).rate,null);
 const markup=baselinePickerMarkup(history,'all','บ้านและสวน');assert.match(markup,/ค่าเฉลี่ยบ้านและสวนทุกครั้ง/);assert.match(markup,/fair-a/);assert.match(markup,/fair-b/);assert.match(markup,/fair-c/);assert.doesNotMatch(markup,/Money Expo/);
});
test('selected comparison drives saved proposal and review while all three cases remain intact',()=>{
 for(const [scenario,index] of [['downside',0],['base',1],['upside',2]]){
  const saved=prepareEventRequest(body({proposalScenario:scenario}),data,new Date('2026-09-22T00:00:00Z'));
  const expected=forecast(history,input).scenarios[index];
  assert.equal(Number(saved.sales),expected.sales);assert.equal(Number(saved.profit),expected.profit);assert.equal(saved.calculation.base.sales,275000);
  assert.equal(saved.place,'ไบเทค บางนา');assert.equal(saved.name,'บ้านและสวน');assert.equal(saved.forecastPlace,'บ้านและสวน');assert.equal(saved.input.pcHoursPerDay,11);
  const model=reviewModel(saved);assert.equal(model.base.sales,expected.sales);assert.equal(model.cases[1].sales,275000);assert.equal(model.proposalIndex,index);assert.equal(model.legacy,false);
  assert.equal(Number(proposalDisplayRow(saved).sales),expected.sales);assert.match(reviewMarkup(saved),/กรณีที่เสนอ/);assert.match(reviewMarkup(saved),/10:00–21:00/);
 }
});
test('separate CDS and RBS persist without inventing selections for legacy combined data',()=>{
 assert(eventTypes.includes('CDS'));assert(eventTypes.includes('RBS'));assert(!eventTypes.includes('CDS RBS'));
 assert.deepEqual(prepareEventRequest(body({eventTypes:['RBS','CDS']}),data).eventTypes,['CDS','RBS']);
 assert.deepEqual(prepareEventRequest(body({eventTypes:['CDS RBS']}),data).eventTypes,['CDS RBS']);
 assert.throws(()=>prepareEventRequest(body({eventTypes:['Unrecognized']}),data));
});
test('hours handle overnight shifts, never multiply daily pay, and reject invalid schedules and proposal choices',()=>{
 assert.equal(pcShiftHours('22:00','06:00'),8);assert.equal(pcShiftHours('10:00','10:00'),null);assert.equal(pcShiftHours('25:00','21:00'),null);
 const saved=prepareEventRequest(body({pcStartTime:'22:00',pcEndTime:'06:00',pcHoursPerDay:999}),data);assert.equal(saved.input.pcHoursPerDay,8);assert.equal(saved.calculation.base.pc,5000);
 for(const override of [{pcStartTime:'10:00',pcEndTime:''},{proposalScenario:'fake'},{eventLocation:''},{eventLocation:'<script>'},{eventSeries:'fake'}])assert.throws(()=>prepareEventRequest(body(override),data));
});
test('save, reload, retry and edit retain selected baseline, venue and hours without duplicate requests',async()=>{
 const env={DB:previewDatabase()};
 try{
  const payload=body({baselineMonth:baselineEventKey(records[0]),proposalScenario:'upside'});
  const first=await createEventRequest(request(payload),env,data);assert.equal((await createEventRequest(request(payload),env,data)).id,first.id);
  const stored=(await listEventRequests(env)).items[0];assert.equal(stored.reference.rows.length,1);assert.equal(stored.reference.rows[0].id,'fair-a');assert.equal(Number(stored.sales),240000);
  const edited={...payload,revision:stored.createdAt,editToken:crypto.randomUUID(),input:{...payload.input,eventLocation:'IMPACT เมืองทองธานี',pcEndTime:'20:00',proposalScenario:'downside'}};
  await updateEventRequest(request(edited,'PATCH'),env,data);await updateEventRequest(request(edited,'PATCH'),env,data);
  const all=await listEventRequests(env);assert.equal(all.items.length,1);assert.equal(all.items[0].place,'IMPACT เมืองทองธานี');assert.equal(all.items[0].input.pcHoursPerDay,10);assert.equal(Number(all.items[0].sales),180000);assert.equal(all.items[0].trade,'รออนุมัติ');assert.equal(all.items[0].ceo,'รออนุมัติ');
 }finally{env.DB.close();}
});
