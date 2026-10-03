import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {previewDatabase} from './preview-db.mjs';
import {listEventRequests} from './event-requests.mjs';
import {proposalsMarkup,proposalDisplayRow} from './out/assets/event-proposals.mjs';
import {reviewMarkup} from './out/assets/event-review.mjs';
test('October proposals preserve blanks, estimates and user logistics; seed is idempotent',async()=>{
 const DB=previewDatabase(':memory:',{includeSeedData:true});
 try{
 const sql=fs.readFileSync('drizzle/0004_october_event_proposals.sql','utf8');
 for(const statement of sql.split('--> statement-breakpoint'))await DB.prepare(statement).run();
 const {items}=await listEventRequests({DB});assert.equal(items.length,2);
 for(const row of items){
  assert.equal(row.input.rent,'');assert.equal(row.profit,'');assert.equal(row.calculation.base.profit,null);assert.equal(row.calculation.base.roi,null);
  assert.equal(Number(proposalDisplayRow(row).sales),Number(row.sales));
  const html=reviewMarkup(row);assert.ok(html.includes('เป็นเวลาคาดการณ์'));assert.ok(html.includes('ค่าเช่าเว้นว่าง'));
  const table=proposalsMarkup({items:[row],source:{status:'online'}});assert.ok(table.includes('เป็นเวลาคาดการณ์'));
 }
 const fair=items.find(x=>x.name.includes('บ้านและสวน')),lhb=items.find(x=>x.name.includes('LHB'));
 assert.deepEqual([fair.days,fair.pc,fair.input.shipping,fair.sales,fair.pcHoursPerDay],['10','2',4000,'900000',10]);
 assert.deepEqual([lhb.days,lhb.pc,lhb.input.shipping,lhb.sales,lhb.pcHoursPerDay],['1','1',3000,'10000',9]);
 }finally{DB.close();}
});
