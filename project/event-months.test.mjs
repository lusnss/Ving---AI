import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {eventMonths} from './out/assets/event-months.mjs';
import {eventsMarkup} from './out/assets/events.mjs';
import {applyEventSales} from './events-data.mjs';

test('active months span dates, clip to selected year, and retain explicit catalog fallback',()=>{
  for(const [name,month,expected] of [
    ['Mega 21/1-4/2/69',1,[1,2]],
    ['บ้านและสวน 31/07-09/08/69',8,[7,8]],
    ['CDS PK 24/12-07/01/70',12,[12]],
    ['CDS 24/12/68-07/01/69',12,[1]],
    ['ผิดวันที่ 30/06-12/06/69',6,[6]],
    ['ยังไม่มีวันที่',7,[7]],
    ['ไม่ระบุ',0,[]],
    ['ผิดวันที่ 31/02/69',null,[]],
    ['ปีอื่น 1-3/01/70',1,[]]
  ]) assert.deepEqual(eventMonths({name,month},2026),expected,name);
});

test('snapshot filters include cross-month events without changing annual or top sales',async()=>{
  const data=applyEventSales(JSON.parse(await fs.readFile(new URL('./out/snapshot.json',import.meta.url)))).data['/api/events'];
  const baseline=JSON.stringify(data),all=eventsMarkup(data,{page:'directory',year:'2026'});
  const counts=[7,9,3,8,10,14,17,14,10,2,3,2];
  assert.equal((all.match(/data-label="เดือนที่จัด"/g)||[]).length,76);
  counts.forEach((count,i)=>{
    const html=eventsMarkup(data,{page:'directory',year:'2026',month:String(i+1)});
    assert.equal((html.match(/data-label="เดือนที่จัด"/g)||[]).length,count);
    assert.match(html,new RegExp(`แสดง ${count} จาก 76 งาน`));
    for(const page of ['overview','ranking'])assert.equal(eventsMarkup(data,{page,year:'2026',month:String(i+1)}).split('<div class="ev-workspace-content">')[1],eventsMarkup(data,{page,year:'2026'}).split('<div class="ev-workspace-content">')[1]);
  });
  assert.equal(JSON.stringify(data),baseline);
  assert.match(eventsMarkup(data,{page:'directory',year:'2025',month:'9'}),/data-event-month/);
  assert.equal(eventsMarkup(data,{page:'directory',year:'2026',month:'invalid'}).split('<div class="ev-workspace-content">')[1],all.split('<div class="ev-workspace-content">')[1]);
});

test('empty and unknown month states stay usable',()=>{
  const data={years:{'2026':{items:[{name:'รอกำหนดวัน',sales:null}],summary:{count:1}}}};
  const empty=eventsMarkup(data,{page:'directory',year:'2026',month:'2'});
  assert.match(empty,/แสดง 0 จาก 1 งาน/);
  assert.match(empty,/colspan="10"[^>]*>ไม่พบ Event ตามตัวกรองที่เลือก/);
  assert.match(empty,/<option value="unknown"/);
  const unknown=eventsMarkup(data,{page:'directory',year:'2026',month:'unknown'});
  assert.match(unknown,/แสดง 1 จาก 1 งาน/);
  assert.match(unknown,/data-label="เดือนที่จัด">ไม่ระบุเดือน/);
});
