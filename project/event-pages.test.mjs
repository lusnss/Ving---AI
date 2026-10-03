import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {eventPages,eventPageForPath,eventPageHref} from './out/assets/event-pages.mjs';
import {eventsMarkup} from './out/assets/events.mjs';
import {pageSources} from './out/assets/sources.mjs';
import worker from './dist/server/index.js';

const data={years:{2025:{items:[],summary:{count:0},months:[]},2026:{items:[],summary:{count:0},months:[],unmatched:[{name:'รายการทดสอบ',month:'มกราคม',sales:100,reason:'รอจับคู่'}]}}};
const markers={overview:'id="event-overview"','monthly-pnl':'id="event-monthly-pnl-title"',calendar:'id="event-schedule"',directory:'id="event-list-title"',performance:'id="event-performance"',ranking:'id="event-top-sales"',reconciliation:'id="event-reconciliation"',sources:'id="event-sources"'};

test('each Event URL renders only its own content with one selected sidebar page',()=>{
 for(const page of eventPages){
  const html=eventsMarkup(data,{page:page.key,year:'2026'});
  assert.ok(html.includes(markers[page.key]),page.key);
  for(const [key,marker] of Object.entries(markers))if(key!==page.key)assert.ok(!html.includes(marker),`${page.key} must not contain ${key}`);
  assert.match(html,new RegExp(`data-event-page="${page.key}" aria-current="page"`));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.equal((html.match(/data-event-page=/g)||[]).length,eventPages.length);
  assert.doesNotMatch(html,/href="#event-/);
 }
});

test('navigation retains selected year and filters across separate URLs',()=>{
 const state={year:'2025',scheduleMonth:'2',scheduleMode:'logistics',month:'unknown',listQuery:'งาน & <ทดสอบ>',listType:'direct',listPlace:'สถานที่ ก',listStatus:'ended',view:'list',metric:'count',status:'ended',query:'ค้นหางาน',day:'2025-02-04'};
 for(const page of eventPages){
  const url=new URL(eventPageHref(page.key,state),'https://example.test');
  assert.equal(url.pathname,page.path);assert.equal(url.searchParams.get('year'),'2025');
  assert.equal(url.searchParams.get('eventQuery'),state.listQuery);assert.equal(url.searchParams.get('eventMonth'),'unknown');
  assert.equal(url.searchParams.get('schedule'),'logistics');assert.equal(url.searchParams.get('metric'),'count');assert.equal(url.searchParams.get('scheduleQuery'),state.query);assert.equal(url.searchParams.get('scheduleDay'),state.day);assert.equal(url.hash,'');
  assert.equal(eventPageForPath(page.path+'.html').key,page.key);
  assert.equal(eventPageForPath(page.path+'/').key,page.key);
  assert.deepEqual(pageSources(page.path,{year:'2025'}),pageSources('/events',{year:'2025'}));
 }
 assert.equal(eventPageForPath('/events/not-a-page'),undefined);
 const empty=eventsMarkup(data,{page:'reconciliation',year:'2025'});
 assert.match(empty,/ไม่มีรายการรอจับคู่ในปีนี้/);
 assert.match(empty,/data-event-page="reconciliation" aria-current="page"/);
});

test('every separate URL loads directly with the original top tabs and existing login protection',async()=>{
 const env={SESSION_SECRET:'local-event-page-test'},payload='v4.viewer.viewer.'+(Math.floor(Date.now()/1000)+600);
 const cookie='ving_session='+payload+'.'+createHmac('sha256',env.SESSION_SECRET).update(payload).digest('base64url');
 let header;
 for(const page of eventPages){
  const url='https://example.test'+page.path+'?year=2025';
  const denied=await worker.fetch(new Request(url),env);
  assert.equal(denied.status,303);
  assert.equal(new URL(denied.headers.get('location')).searchParams.get('next'),page.path+'?year=2025');
  const response=await worker.fetch(new Request(url,{headers:{cookie}}),env);
  assert.equal(response.status,200,page.path);
  const html=await response.text(),tabs=html.split('<header class="app-header">')[1].split('</header>')[0];
  header??=tabs;assert.equal(tabs,header,page.path);
  assert.match(html,/id="app"/);assert.match(html,/event-navigation.css/);
 }
 assert.equal((await worker.fetch(new Request('https://example.test/events/not-a-page',{headers:{cookie}}),env)).status,404);
});
