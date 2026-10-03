import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewHistoryRows,reviewLocationQuery,reviewHistoryQuery,filterReviewHistory,reviewHistoryResults,reviewHistoryMarkup} from './out/assets/event-review-history.mjs';
import {baselineFor} from './out/assets/event-predict-model.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';

const record=(id,name,net,days,extra={})=>({id,databaseKey:id,name,net,days,channel:'gp',range:{start:'2026-06-01',end:'2026-06-10'},...extra});
test('new CDS venue finds all historical RBS events by area without mixing other areas',()=>{
 const rows=reviewHistoryRows([record('a','RBS บางรัก',10000,10),record('b','โรบินสัน บางรัก',20000,5),record('c','RBS บางนา',50000,10)],'2026-09-23');
 assert.equal(reviewHistoryQuery({place:'เซ็นทรัล บางรัก'}),'บางรัก');
 for(const query of ['CDS บางรัก','เซ็นทรัลบางรัก','บางรัก','RBS บางรัก'])assert.deepEqual(filterReviewHistory(rows,query).map(r=>r.id).sort(),['a','b']);
 assert.equal(filterReviewHistory(rows,'').length,3);
 assert.equal(filterReviewHistory(rows,'ไม่มีสถานที่นี้').length,0);
 assert.equal(reviewLocationQuery('CDS พระราม 2'),'พระราม 2');
 assert.equal(filterReviewHistory(reviewHistoryRows([record('rama3','CDS พระราม 3',500,1)]),'CDS พระราม 2').length,0);
 assert.equal(reviewHistoryQuery({place:'IMPACT',input:{eventSeries:'baan-suan'}}),'บ้านและสวน');
});
test('daily sales and weighted baseline retain zero, exclude missing, duplicate, ongoing and future records',()=>{
 const rows=reviewHistoryRows([
  record('a','RBS บางรัก',10000,10),record('b','RBS บางรัก',20000,5),record('zero','RBS บางรัก',0,2),
  record('missing','RBS บางรัก',null,10),record('no-days','RBS บางรัก',3000,null),
  record('duplicate','RBS บางรัก',90000,2),record('duplicate','RBS บางรัก',90000,2),
  record('ongoing','RBS บางรัก',1000,2,{range:{start:'2026-09-20',end:'2026-09-23'}}),
  record('future','RBS บางรัก',1000,2,{range:{start:'2026-10-01',end:'2026-10-02'}}),
  record('unconfirmed','RBS บางรัก',7000,7,{range:null})
 ],'2026-09-23');
 const baseline=baselineFor(rows);
 assert.deepEqual(baseline,{rate:30000/17,days:17,sales:30000,observations:3});
 assert.equal(rows.find(r=>r.id==='a').daily,1000);assert.equal(rows.find(r=>r.id==='b').daily,4000);
 assert.equal(rows.find(r=>r.id==='zero').daily,0);assert.equal(rows.find(r=>r.id==='missing').daily,null);assert.equal(rows.find(r=>r.id==='no-days').daily,null);
 assert.ok(rows.filter(r=>r.id==='duplicate').every(r=>!r.usable));assert.ok(!rows.some(r=>['ongoing','future'].includes(r.id)));
 assert.equal(rows.find(r=>r.id==='unconfirmed').usable,false);
 assert.match(reviewHistoryResults(rows,'บางรัก'),/1,764.71/);
});
test('search preserves every occurrence, original event names, stale state, escaping, and empty states',()=>{
 const records=Array.from({length:35},(_,i)=>record(String(i),'เซ็นทรัล บางนา',1000+i,1,{originalName:'CDS Bangna ครั้งที่ '+(i+1)}));
 const rows=reviewHistoryRows(records,'2026-09-23');
 assert.equal(filterReviewHistory(rows,'CDS Bangna').length,35);
 assert.equal((reviewHistoryResults(rows).match(/scope="row"/g)||[]).length,35);
 assert.match(reviewHistoryResults(rows,'',{status:'stale'}),/ยังอัปเดตไม่สำเร็จ/);
 const html=reviewHistoryResults(reviewHistoryRows([record('unsafe','<img src=x onerror=alert(1)>',1,1)]),'');
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
 assert.match(reviewHistoryResults(rows,'unknown'),/ไม่พบประวัติ/);assert.match(reviewHistoryResults([]),/ยังไม่มีประวัติ/);
 assert.doesNotMatch(reviewHistoryMarkup({place:'"><img src=x>'}),/<img/);
});
test('right-hand conditions show saved and sheet event duration without inventing missing values',()=>{
 assert.match(reviewMarkup({days:'29'}),/<dt>จำนวนวันจัด<\/dt><dd>29 วัน<\/dd>/);
 assert.match(reviewMarkup({}),/<dt>จำนวนวันจัด<\/dt><dd>ยังไม่ระบุ<\/dd>/);
});
