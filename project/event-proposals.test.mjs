import test from 'node:test';
import assert from 'node:assert/strict';
import {proposalHeaders,buildEventProposals,createProposalLoader} from './event-proposals-data.mjs';
import {proposalsMarkup,summarizeProposals,normalizeProposalColumns,defaultProposalColumns,proposalGroup,proposalDisplayRow,formatProposalValue,proposalBreakEven,filterProposals} from './out/assets/event-proposals.mjs';
const csv=rows=>[proposalHeaders,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
const sample=(sales='19,065')=>csv([['สถานที่ทดสอบ','Event, "A"\nใหม่','?','ตุลาคม','01-08.10.26','8',sales,'1,033.17','5.42%','อนุมัติ','']]);
test('preserves mixed forecasts, punctuation and unknowns; excludes owner and escapes HTML',()=>{
 const data=buildEventProposals(sample('พื้นที่ใหม่'));
 assert.equal(data.items[0].sales,'พื้นที่ใหม่');assert.equal(data.items[0].area,'?');assert.equal(data.items[0].ceo,'');assert.equal(data.items[0].name,'Event, "A"\nใหม่');
 assert.throws(()=>buildEventProposals('bad headers'),/หัวคอลัมน์/);
 data.items[0].name='<img src=x onerror=alert(1)>';
 const html=proposalsMarkup(data,[...defaultProposalColumns,'name']);assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('ยังไม่ระบุ'));
 assert.equal(buildEventProposals(sample()).items[0].sales,'19,065');
 assert.equal(buildEventProposals(csv([])).items.length,0);
});
test('refreshes changed data with independent requests, preserves last good data on failure, recovers and accepts deletion',async()=>{
 let clock=Date.parse('2026-09-20T06:00:00Z'),calls=0,body=sample(),offline=false;
 const objects=new Map();const env={BUCKET:{get:async key=>objects.has(key)?{json:async()=>JSON.parse(objects.get(key))}:null,put:async(key,value)=>objects.set(key,value)}};
 const load=createProposalLoader({now:()=>clock,fetchImpl:async url=>{calls++;assert.equal(new URL(url).searchParams.get('range'),'B:AA');if(offline)throw Error('offline');return new Response(body);}});
 const [a,b]=await Promise.all([load(env),load(env)]);assert.equal(calls,2);assert.deepEqual(a,b);
 body=sample('20,000');clock+=14999;assert.equal((await load(env)).items[0].sales,'19,065');
 clock+=1;assert.equal((await load(env)).items[0].sales,'20,000');assert.equal(calls,3);
 offline=true;clock+=15000;const stale=await load(env);assert.equal(stale.source.status,'stale');assert.equal(stale.items[0].sales,'20,000');assert.equal(stale.source.fetched_at,'2026-09-20T06:00:15.000Z');
 offline=false;body='bad headers';clock+=15000;assert.equal((await load(env)).source.status,'stale');
 body=csv([]);clock+=15000;const empty=await load(env);assert.equal(empty.source.status,'online');assert.equal(empty.items.length,0);
 assert(!objects.get('event-proposals.json').includes('OWNER'));
});
test('cold start failure reports unavailable and retries',async()=>{
 let clock=0,offline=true;
 const load=createProposalLoader({now:()=>clock,fetchImpl:async()=>{if(offline)throw Error('offline');return new Response(sample());}});
 const env={BUCKET:{get:async()=>null,put:async()=>{}}};
 assert.equal((await load(env)).source.status,'unavailable');clock=15000;assert.equal((await load(env)).source.status,'unavailable');offline=false;clock=30000;
 assert.equal((await load(env)).items.length,1);
});
test('inserted PC or private columns and reordered headers do not shift approvals or financial values',()=>{
 const [head,row]=sample().split('\r\n');
 const data=buildEventProposals('จำนวน PC,OWNER,'+head+'\r\n2,PRIVATE-PERSON,'+row);
 assert.equal(data.items[0].pc,'2');assert.equal(data.items[0].trade,'อนุมัติ');assert.equal(data.items[0].sales,'19,065');
 assert(!JSON.stringify(data).includes('PRIVATE-PERSON'));assert(proposalsMarkup(data).includes('จำนวน PC'));
});
test('dashboard distinguishes both approvals, rejection and incomplete approval; totals exclude unknowns, retain zero and losses',()=>{
 const summary=summarizeProposals([
  {trade:'อนุมัติ',ceo:'อนุมัติ',sales:'19,065',profit:'1,033.17'},
  {trade:'อนุมัติ',ceo:'',sales:'พื้นที่ใหม่',profit:''},
  {trade:'ไม่อนุมัติ',ceo:'อนุมัติ',sales:'0',profit:'-100'},
  {trade:'',ceo:'',sales:'?',profit:'0'}
 ]);
 assert.deepEqual(summary,{total:4,approved:1,rejected:1,cancelled:0,pending:2,trade:2,ceo:2,sales:{value:19065,count:2},profit:{value:933.1700000000001,count:3}});
 assert.deepEqual(summarizeProposals([]).sales,{value:null,count:0});
 assert.deepEqual(summarizeProposals([{sales:'พื้นที่ใหม่'}]).sales,{value:null,count:0});
});
test('column choices retain identity, canonical approval-first order and escape table values',()=>{
 assert.deepEqual(normalizeProposalColumns(null),defaultProposalColumns);
 assert.deepEqual(normalizeProposalColumns(['sales','trade','unknown','sales']),['trade','place','workflow','sales','actions']);
 const html=proposalsMarkup(buildEventProposals(sample()),['trade','ceo','place']);
 const head=html.match(/<thead>(.*?)<\/thead>/s)[1];
 assert(head.indexOf('Trade approve')<head.indexOf('CEO approve'));assert(head.indexOf('CEO approve')<head.indexOf('สถานที่'));
 assert(!head.includes('คาดการณ์ยอดขาย'));assert(html.includes('data-proposal-column="sales"'));assert(html.includes('เลือกข้อมูลที่แสดง'));
});
test('proposal numbers use thousands separators and whole numbers, with targets rounded upward',()=>{
 assert.equal(formatProposalValue('114723','sales'),'114,723');
 assert.equal(formatProposalValue('32,778.4','profit'),'32,778');
 assert.equal(formatProposalValue('28.57%','margin'),'29%');
 assert.equal(formatProposalValue('2.00','pc'),'2');
 assert.equal(formatProposalValue('-1000.75','profit'),'-1,001');
 assert.equal(formatProposalValue('1000.01','target'),'1,001');
 assert.equal(formatProposalValue('','sales'),'—');
 assert.equal(formatProposalValue('0','sales'),'0');
 assert.equal(formatProposalValue('?','area'),'?');
});
test('explicit manual proposals and new-area sheet rows are separated without changing saved inputs',()=>{
 const historical={place:'พื้นที่มีข้อมูล',input:{mode:'history'},sales:'10000',profit:'1000'};
 const manual={place:'พื้นที่ใหม่จากเว็บ',input:{mode:'manual',salesMode:'cost-target'},sales:'114723',profit:'32778.4',target:'114723',calculation:{base:{sales:114723,profit:32778.4,roi:40},breakEven:75000.25}};
 const sheet={place:'พื้นที่ใหม่จากชีต',sales:'พื้นที่ใหม่',profit:'พื้นที่ใหม่'};
 assert.equal(proposalGroup(historical),'history');assert.equal(proposalGroup(manual),'new');assert.equal(proposalGroup(sheet),'new');
 assert.equal(proposalBreakEven(manual),75001);assert.equal(proposalBreakEven(sheet),null);
 const before=JSON.stringify([historical,manual,sheet]);
 const html=proposalsMarkup({items:[historical,manual,sheet]},['place','sales','profit','margin','target','breakEven']);
 const groups=[...html.matchAll(/<section class="proposal-group"[^>]*>(.*?)<\/section>/gs)].map(m=>m[1]);
 assert.equal(groups.length,2);assert.match(groups[0],/พื้นที่มีข้อมูล/);assert.doesNotMatch(groups[0],/พื้นที่ใหม่จากเว็บ/);
 assert.match(groups[1],/พื้นที่ใหม่จากเว็บ/);assert.match(groups[1],/พื้นที่ใหม่จากชีต/);
 assert.match(groups[1],/ยอดขายที่ตั้งเป้า/);assert.match(groups[1],/กำไรเมื่อขายถึงเป้า/);assert.match(groups[1],/เป้า ROI 40%/);
 assert.match(groups[1],/114,723/);assert.match(groups[1],/32,778/);assert.match(groups[1],/75,001/);
 assert.equal((groups[1].match(/<th[^>]+data-column="target"/g)||[]).length,0);
 assert.equal(JSON.stringify([historical,manual,sheet]),before);
});
test('legacy manual target uses matching target profit instead of estimated-sales profit, unknown targets stay unknown',()=>{
 const row={input:{mode:'manual'},sales:'40000',profit:'12500',target:'60000',calculation:{base:{sales:40000,profit:12500},target:{sales:60000,profit:22500,roi:60}}};
 const display=proposalDisplayRow(row);assert.equal(display.sales,60000);assert.equal(display.profit,22500);assert.equal(display.margin,37.5);assert.equal(display.roi,60);
 const unknown=proposalDisplayRow({input:{mode:'manual'},sales:'40000',profit:'12500'});assert.equal(unknown.sales,null);assert.equal(unknown.profit,null);
 const zero=proposalDisplayRow({input:{mode:'manual'},calculation:{target:{sales:0,profit:-100,roi:-100}}});assert.equal(zero.sales,0);assert.equal(zero.profit,-100);assert.equal(zero.margin,null);
 assert.equal(proposalBreakEven({calculation:{breakEven:0}}),0);
});


test('status drill-down keeps incomplete approvals and rejections distinct without changing portfolio totals',()=>{
 const rows=[{trade:'อนุมัติ',ceo:'อนุมัติ',sales:'100'}, {trade:'อนุมัติ',ceo:'',sales:'200'}, {trade:'ไม่อนุมัติ',ceo:'อนุมัติ',sales:'300'}, {trade:'รออนุมัติ',ceo:'ไม่อนุมัติ',sales:'400'}];
 const before=JSON.stringify(rows);
 assert.deepEqual(filterProposals(rows,'approved'),[rows[0]]);
 assert.deepEqual(filterProposals(rows,'pending'),[rows[1]]);
 assert.deepEqual(filterProposals(rows,'rejected'),[rows[2],rows[3]]);
 assert.equal(filterProposals(rows,'all'),rows);
 assert.deepEqual(filterProposals([],'pending'),[]);
 assert.equal(summarizeProposals(rows).sales.value,1000);
 assert.equal(JSON.stringify(rows),before);
});
test('premium overview retains missing and zero values, including unavailable data and losses',()=>{
 const empty=proposalsMarkup({source:{status:'unavailable'},items:[]});
 assert(!empty.includes('NaN'));assert(!empty.includes('Infinity'));
 assert(!empty.includes('data-metric-key="rate"'));
 const html=proposalsMarkup({items:[{sales:'0',profit:'-100',trade:'อนุมัติ',ceo:'อนุมัติ'}]});
 assert(html.includes('data-proposal-number="0" data-metric-key="sales-history"'));
 assert(html.includes('data-proposal-number="-100" data-metric-key="profit"'));
 assert(html.includes('class="is-loss"'));
 assert(html.includes('data-proposal-number="100" data-metric-key="rate"'));
});
