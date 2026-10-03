import test from 'node:test';
import assert from 'node:assert/strict';
import {eventExcelColumns,eventExcelRows,eventExcelWorkbook,downloadEventExcel} from './out/assets/event-excel.mjs';
import {buildSummaryModel,visibleSummaryEvents,summaryMarkup} from './out/assets/summary.mjs';
const state={year:2026,month:10,basis:'all',eventStatus:'upcoming'};
const proposal={source:'web',id:'test',deletionKey:'web:test',name:'=1+1 & <งาน>',place:'สถานที่ทดสอบ',startDate:'2026-09-28',endDate:'2026-10-11',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',days:'14',pc:'99',input:{eventTypes:['CDS RBS','Sports Mall'],pcCount:2,pc:500,shipping:0,other:1200.5}};
test('Excel uses the eight requested columns, original proposal costs and full cross-month dates',()=>{
 assert.deepEqual(eventExcelColumns,['ประเภท','สถานที่','ชื่อ','ช่วงวันที่จัด','จำนวนวันที่จัด','จำนวน PC','ค่าขนส่ง','ค่าใช้จ่ายอื่นๆ']);
 const model=buildSummaryModel({approvedProposals:[proposal]},state,'2026-09-21');
 const items=visibleSummaryEvents(model,state);
 assert.deepEqual(eventExcelRows(items),[['CDS RBS, Sports Mall','สถานที่ทดสอบ','=1+1 & <งาน>','28/09/2026 – 11/10/2026',14,2,0,1200.5]]);
 assert.equal(visibleSummaryEvents(model,{...state,eventStatus:'completed'}).length,0);
 assert.equal(visibleSummaryEvents(buildSummaryModel({approvedProposals:[proposal]},{...state,month:11},'2026-09-21'),state).length,0);
 assert.deepEqual(eventExcelRows([{name:'ไม่มีข้อมูล'}])[0],['','','ไม่มีข้อมูล','',null,null,null,null]);
 assert.match(summaryMarkup({approvedProposals:[proposal]},state,'2026-09-21'),/Export Excel/);
});
test('xlsx is a ZIP with typed numbers, literal text instead of formulas, filters and frozen headings',()=>{
 const bytes=eventExcelWorkbook([{name:'=1+1 & <งาน>',pcCount:2,shipping:0,other:12.5}]),view=new DataView(bytes.buffer);
 const files={};let offset=0;
 while(view.getUint32(offset,true)===0x04034b50){
  const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  const name=new TextDecoder().decode(bytes.slice(offset+30,offset+30+nameLength)),start=offset+30+nameLength+extra;
  files[name]=new TextDecoder().decode(bytes.slice(start,start+size));offset=start+size;
 }
 assert.equal(Object.keys(files).length,6);assert.equal(view.getUint32(offset,true),0x02014b50);
 const xml=files['xl/worksheets/sheet1.xml'];
 assert.match(xml,/=1\+1 &amp; &lt;งาน&gt;/);assert.doesNotMatch(xml,/<f[ >]/);
 assert.match(xml,/<c r="F2" s="2"><v>2<\/v>/);assert.match(xml,/<c r="G2" s="3"><v>0<\/v>/);
 assert.match(xml,/state="frozen"/);assert.match(xml,/autoFilter ref="A1:H2"/);
});
test('download creates an actual xlsx Blob and names it for the active filters',()=>{
 const original={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timer:globalThis.setTimeout};
 let clicked=false,removed=false,blob,filename;
 globalThis.document={createElement:()=>({set download(value){filename=value;},click(){clicked=true;},remove(){removed=true;}}),body:{append(){}}};
 URL.createObjectURL=value=>{blob=value;return 'blob:test';};URL.revokeObjectURL=()=>{};globalThis.setTimeout=fn=>fn();
 try{downloadEventExcel([{name:'Event'}],2026,10,'upcoming');assert.equal(filename,'VING-Events-2026-10-upcoming.xlsx');assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.ok(blob.size>1000);assert.ok(clicked&&removed);}
 finally{globalThis.document=original.document;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;globalThis.setTimeout=original.timer;}
});

test('approved GP proposals retain their channel in Excel even with retail type selections',()=>{
 for(const eventTypes of [[],['CDS RBS']]){
  const row={...proposal,input:{...proposal.input,channel:'gp',eventTypes}};
  const model=buildSummaryModel({approvedProposals:[row]},state,'2026-09-21');
  assert.equal(eventExcelRows(visibleSummaryEvents(model,state))[0][0],'Event จ่าย GP');
 }
 assert.equal(eventExcelRows([{category:'direct'}])[0][0],'Event เก็บเงินเอง');
});
