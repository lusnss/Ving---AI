import assert from 'node:assert/strict';
import test from 'node:test';
import {branchTableRows, columnChoice, columnChoices, selectedColumnValues, selectedColumnFilter, buildSalesReportModel, tableMarkup, summaryMarkup} from './out/assets/daily-sales.mjs';

const today = '2026-09-17';
const period = {key:'2026-09',year:2026,month:9,latest_date:'2026-09-15'};
const names = rows => rows.map(row => row.branch);
const sort = (rows,key,direction='asc',extra={}) => branchTableRows(rows,{sort:{key,direction},period,today,...extra});

test('searching for another choice retains previous selections and reopening expands the choice list',()=>{
  const rows=[{branch:'ลาดพร้าว'},{branch:'บางกะปิ'},{branch:'พระราม9'}];
  const options=columnChoices(rows,'branch');
  // Migrate an old search filter to its actual checked values, then add another search result.
  const chosen=selectedColumnValues(options,{query:'ลาดพร้าว',values:null});
  assert.deepEqual([...chosen],['ลาดพร้าว']);
  chosen.add('บางกะปิ');
  const filter=selectedColumnFilter(options,chosen);
  assert.equal(filter.query,'');
  assert.deepEqual(names(branchTableRows(rows,{filters:{branch:filter}})),['ลาดพร้าว','บางกะปิ']);
  assert.equal(columnChoices(rows,'branch',{filters:{branch:filter}}).length,3);
  assert.deepEqual([...selectedColumnValues(options,filter)].sort(),[...chosen].sort());
  chosen.clear();
  assert.equal(branchTableRows(rows,{filters:{branch:selectedColumnFilter(options,chosen)}}).length,0);
  options.forEach(option=>chosen.add(option.id));
  assert.equal(selectedColumnFilter(options,chosen).values,null);
});

test('numeric sorting preserves negatives, zero, stable ties and unavailable values at the end',() => {
  const rows = [{branch:'high',total:1200},{branch:'missing',total:null},{branch:'zero',total:0},{branch:'negative',total:-20},{branch:'tie',total:0},{branch:'pending',total:9999,notStarted:true}];
  const original = structuredClone(rows);
  assert.deepEqual(names(sort(rows,'total')),['negative','zero','tie','high','missing','pending']);
  assert.deepEqual(names(sort(rows,'total','desc')),['high','zero','tie','negative','missing','pending']);
  assert.deepEqual(rows,original);
  assert.deepEqual(names(sort(rows,'total','desc',{period:{...period,projected:true}})),names(rows));
});

test('branch search supports Thai, case-insensitive English, trimming, no results and clearing',() => {
  const rows = [{branch:'บางแค'},{branch:'บางกะปิ'},{branch:'The Crystal Park'},{branch:'Branch 10'},{branch:'Branch 2'}];
  assert.deepEqual(names(branchTableRows(rows,{query:' บาง '})),['บางแค','บางกะปิ']);
  assert.deepEqual(names(branchTableRows(rows,{query:' CRYSTAL '})),['The Crystal Park']);
  assert.equal(branchTableRows(rows,{query:'not found'}).length,0);
  assert.deepEqual(names(branchTableRows(rows,{query:'  '})),names(rows));
  assert.deepEqual(names(branchTableRows(rows,{query:'branch',sort:{key:'branch',direction:'asc'}})),['Branch 2','Branch 10']);
});

test('daily sorting distinguishes implicit zero from pre-opening and outside-Event blanks',() => {
  const rows = [
    {branch:'missing',type:'CDS',daily_sales:{}},
    {branch:'implicit zero',type:'CDS',first_sale_date:'2026-08-01',daily_sales:{}},
    {branch:'sold',type:'CDS',daily_sales:{'2026-09-15':150}},
    {branch:'return',type:'CDS',daily_sales:{'2026-09-15':-10}},
    {branch:'ended event',type:'Event',total:100,event_schedule:{start:'2026-09-01',end:'2026-09-10'},daily_sales:{'2026-09-15':500}},
  ];
  assert.deepEqual(names(sort(rows,'day:15')),['return','implicit zero','sold','missing','ended event']);
  assert.deepEqual(names(sort(rows,'day:15','desc')),['sold','implicit zero','return','missing','ended event']);
  assert.deepEqual(names(sort(rows,'day:30','desc')),names(rows));
});

test('YoY sorts percent, target zero stays unavailable and gap sorts signed amounts',() => {
  const rows = [
    {branch:'up',yoy:{status:'up',percent:.1},target:200,gap:100},
    {branch:'new',yoy:{status:'new',percent:null},target:0,gap:null},
    {branch:'down',yoy:{status:'down',percent:-.2},target:100,gap:-50},
    {branch:'equal',yoy:{status:'equal',percent:0},target:300,gap:0},
  ];
  assert.deepEqual(names(sort(rows,'yoy')),['down','equal','up','new']);
  assert.deepEqual(names(sort(rows,'yoy','desc')),['up','equal','down','new']);
  assert.deepEqual(names(sort(rows,'target')),['down','up','equal','new']);
  assert.deepEqual(names(sort(rows,'gap')),['down','equal','up','new']);
});

test('selected-day and zero-day sort use rendered numbers; text codes sort naturally',() => {
  const rows = [
    {branch:'A',branch_code:'VC-10',daily:100,type:'CDS',daily_sales:{'2026-09-15':100}},
    {branch:'B',branch_code:'VC-2',daily:0,type:'CDS',first_sale_date:'2026-08-01',daily_sales:{}},
    {branch:'C',branch_code:'',daily:null,type:'Event',notStarted:true,daily_sales:{}},
  ];
  assert.deepEqual(names(sort(rows,'selectedDay','asc',{selectedDate:'2026-09-15'})),['B','A','C']);
  assert.deepEqual(names(sort(rows,'zeroDays','desc')),['B','A','C']);
  assert.deepEqual(names(sort(rows,'code')),['B','A','C']);
});

test('table filtering/sorting leaves report summaries intact and annual tables use independent sorts',() => {
  const month = {...period,dates:['2026-09-15'],branches:[
    {branch:'Alpha',type:'CDS',month_to_date:100,target:200,daily_sales:{'2026-09-15':100}},
    {branch:'Beta',type:'CDS',month_to_date:200,target:300,daily_sales:{'2026-09-15':200}}
  ]};
  const data = {periods:{'2026-09':month}};
  const model = buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
  const before = summaryMarkup(model);
  const state = {branchQuery:'Alpha',tableSorts:{main:{key:'total',direction:'asc'}}};
  const html = tableMarkup(model,state,today);
  assert.match(html,/พบ 1 จาก 2 รายการ/);
  assert.doesNotMatch(html,/>Beta</);
  assert.match(html,/aria-sort="ascending"[^]*?data-column-key="total"/);
  assert.equal(summaryMarkup(model),before);
  assert.match(tableMarkup(model,{branchQuery:'absent'},today),/ไม่พบสาขาที่ตรงกับคำค้น/);
  const annual = buildSalesReportModel(data,{year:2026,month:'all'},today);
  const yearlyHtml = tableMarkup(annual,{tableSorts:{'2026-09':{key:'day:15',direction:'asc'}}},today);
  const subtable = yearlyHtml.split('<section class="daily-month-section">')[1];
  assert.ok(subtable.indexOf('>Alpha<') < subtable.indexOf('>Beta<'));
  assert.match(subtable,/data-column-key="day:15" data-table-id="2026-09"/);
  assert.match(tableMarkup(model,{branchQuery:'<img src=x>'},today),/&lt;img src=x&gt;/);
});

test('multiple column filters combine search, exact selections, numeric values and empty selections',() => {
  const rows = [
    {branch:'บางแค',type:'CDS',branch_code:'VC-2',total:1200},
    {branch:'บางกะปิ',type:'RBS',branch_code:'VC-10',total:1200},
    {branch:'The Crystal Park',type:'Event',branch_code:'',total:0},
    {branch:'บางนา',type:'CDS',branch_code:'VC-3',total:-20}
  ];
  const before=structuredClone(rows);
  const filters={branch:{query:' บาง '},type:{values:['CDS']},total:{values:['1,200']}};
  assert.deepEqual(names(branchTableRows(rows,{filters})),['บางแค']);
  assert.deepEqual(names(branchTableRows(rows,{filters:{total:{query:'1200'}}})),['บางแค','บางกะปิ']);
  assert.deepEqual(names(branchTableRows(rows,{filters:{total:{query:'฿1,200'}}})),['บางแค','บางกะปิ']);
  assert.deepEqual(names(branchTableRows(rows,{filters:{code:{query:'vc-1'}}})),['บางกะปิ']);
  assert.deepEqual(branchTableRows(rows,{filters:{type:{values:[]}}}),[]);
  assert.deepEqual(names(branchTableRows(rows,{filters:{total:{values:['0']}}})),['The Crystal Park']);
  assert.deepEqual(rows,before);
  assert.deepEqual(names(branchTableRows(rows,{filters:{}})),names(rows));
});

test('column options respect other filters while keeping this column available for clearing',() => {
  const rows=[{branch:'A',type:'CDS'},{branch:'B',type:'RBS'},{branch:'C',type:'CDS'}];
  const filters={branch:{values:['A']},type:{values:['CDS']}};
  assert.deepEqual(columnChoices(rows,'branch',{filters}).map(c=>c.label),['A','C']);
  assert.deepEqual(columnChoices(rows,'type',{filters}).map(c=>c.label),['CDS']);
  assert.deepEqual(columnChoices(rows,'branch').map(c=>c.label),['A','B','C']);
});

test('daily filter distinguishes zero and blank, and YoY search uses shown percentages/status',() => {
  const rows=[
    {branch:'zero',type:'CDS',first_sale_date:'2026-08-01',daily_sales:{},yoy:{status:'equal',percent:0}},
    {branch:'new',type:'CDS',daily_sales:{},yoy:{status:'new'}},
    {branch:'up',type:'CDS',daily_sales:{'2026-09-15':1000},yoy:{status:'up',percent:.1234}}
  ];
  const options={period,today};
  assert.deepEqual(names(branchTableRows(rows,{...options,filters:{'day:15':{values:['0']}}})),['zero']);
  assert.deepEqual(names(branchTableRows(rows,{...options,filters:{'day:15':{values:['—']}}})),['new']);
  assert.deepEqual(names(branchTableRows(rows,{...options,filters:{yoy:{query:'ใหม่'}}})),['new']);
  assert.deepEqual(names(branchTableRows(rows,{...options,filters:{yoy:{query:'12.34'}}})),['up']);
  assert.equal(columnChoice(rows[0],'zeroDays',options).label,'15 วัน');
  const event={branch:'Waiting Event',type:'Event',forecast:null};
  assert.equal(columnChoice(event,'forecast',options).label,'รอวันเปิดขาย');
  assert.deepEqual(names(branchTableRows([event],{...options,filters:{forecast:{query:'รอวันเปิดขาย'}}})),['Waiting Event']);
});

test('table filters have independent scopes, visible counts, and ignore hidden columns',() => {
  const month={...period,dates:['2026-09-15'],branches:[
    {branch:'Alpha',type:'CDS',month_to_date:100,target:200,daily_sales:{'2026-09-15':100}},
    {branch:'Beta',type:'RBS',month_to_date:200,target:300,daily_sales:{'2026-09-15':200}}
  ]};
  const data={periods:{'2026-09':month}};
  const model=buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
  const before=summaryMarkup(model);
  const state={tableFilters:{main:{type:{values:['CDS']}}}};
  const html=tableMarkup(model,state,today);
  assert.match(html,/พบ 1 จาก 2 รายการ/);
  assert.doesNotMatch(html,/>Beta</);
  assert.match(html,/ประเภท \(กรองอยู่\)/);
  assert.equal(summaryMarkup(model),before);
  assert.match(tableMarkup(model,{...state,columns:['total']},today),/>Beta</);
  assert.match(tableMarkup(model,{tableFilters:{main:{type:{values:[]}}}},today),/ไม่พบข้อมูลที่ตรงกับตัวกรอง/);
  const annual=buildSalesReportModel(data,{year:2026,month:'all'},today);
  const annualHtml=tableMarkup(annual,{tableFilters:{'2026-09':{branch:{query:'Alpha'}}}},today);
  const [main,subtable]=annualHtml.split('<section class="daily-month-section">');
  assert.match(main,/>Beta</);
  assert.doesNotMatch(subtable,/>Beta</);
});

test('default table sort uses the same missing-last rule as explicit descending',() => {
  const model={year:2026,month:'2026-09',selectedDate:'2026-09-15',selectedPeriod:period,totals:{rows:[
    {branch:'missing',daily:null},{branch:'negative',daily:-10},{branch:'zero',daily:0}
  ]}};
  const implicit=tableMarkup(model,{columns:['selectedDay']},today);
  const explicit=tableMarkup(model,{columns:['selectedDay'],tableSorts:{main:{key:'selectedDay',direction:'desc'}}},today);
  assert.equal(implicit,explicit);
  assert.ok(implicit.indexOf('>zero<')<implicit.indexOf('>negative<'));
  assert.ok(implicit.indexOf('>negative<')<implicit.indexOf('>missing<'));
});
