import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {proposalExcelWorkbook,proposalsMarkup} from './out/assets/event-proposals.mjs';
const unpack=bytes=>{const view=new DataView(bytes.buffer),files={};let pos=0;while(view.getUint32(pos,true)===0x04034b50){const size=view.getUint32(pos+18,true),len=view.getUint16(pos+26,true),start=pos+30+len+view.getUint16(pos+28,true);files[new TextDecoder().decode(bytes.slice(pos+30,pos+30+len))]=new TextDecoder().decode(bytes.slice(start,start+size));pos=start+size;}return files;};
test('one download contains 5 history and 4 new rows in one worksheet, typed amounts, blanks and safe text',()=>{
 const items=[...Array.from({length:5},(_,i)=>({place:'พื้นที่เดิม '+i,name:'=1+1 & <งาน>',sales:i?100.25:0,profit:i?-20:'',margin:'46%',trade:'อนุมัติ',ceo:i?'อนุมัติ':'ไม่อนุมัติ'})),...Array.from({length:4},(_,i)=>({place:'พื้นที่ใหม่ '+i,input:{mode:'manual'},target:i?300:null,profit:''}))];
 const before=JSON.stringify(items),bytes=proposalExcelWorkbook(items),files=unpack(bytes);
 assert.equal(Object.keys(files).filter(n=>n.startsWith('xl/worksheets/')).length,1);assert.match(files['xl/worksheets/sheet1.xml'],/พื้นที่ที่มีข้อมูลแล้ว · 5 งาน/);assert.match(files['xl/worksheets/sheet1.xml'],/พื้นที่ใหม่ · 4 งาน/);
 assert.match(files['xl/worksheets/sheet1.xml'],/dimension ref="A1:U14"/);
 assert.match(files['xl/worksheets/sheet1.xml'],/<v>0<\/v>/);assert.match(files['xl/worksheets/sheet1.xml'],/<v>-20<\/v>/);assert.match(files['xl/worksheets/sheet1.xml'],/<v>46<\/v>/);
 assert.match(files['xl/worksheets/sheet1.xml'],/=1\+1 &amp; &lt;งาน&gt;/);assert.doesNotMatch(files['xl/worksheets/sheet1.xml'],/<f[ >]/);
 assert.match(files['xl/worksheets/sheet1.xml'],/<c r="K11" s="3"\/>/);assert.match(files['xl/worksheets/sheet1.xml'],/ยอดขายที่ตั้งเป้า/);
 assert.equal(JSON.stringify(items),before);assert.match(proposalsMarkup({items}),/data-proposal-export/);
 fs.writeFileSync('/private/tmp/ving-proposal-export-test.xlsx',bytes);
});
test('empty groups retain both section headings in one worksheet',()=>{const files=unpack(proposalExcelWorkbook([]));assert.match(files['xl/worksheets/sheet1.xml'],/A1:U5/);assert.match(files['xl/worksheets/sheet1.xml'],/พื้นที่ใหม่ · 0 งาน/);});
test('export keeps cancellation status and safely encodes its note alongside unchanged approvals',()=>{
 const files=unpack(proposalExcelWorkbook([{place:'งานที่ยกเลิก',trade:'อนุมัติ',ceo:'อนุมัติ',workflow:{status:'cancelled',note:'=สถานที่ & <เหตุผล>'}}]));
 const xml=files['xl/worksheets/sheet1.xml'];
 assert.match(xml,/สถานะงาน/);assert.match(xml,/หมายเหตุยกเลิก/);assert.match(xml,/>ยกเลิก</);assert.match(xml,/=สถานที่ &amp; &lt;เหตุผล&gt;/);assert.doesNotMatch(xml,/<f[ >]/);
});
