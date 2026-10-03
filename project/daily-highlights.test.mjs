import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSalesReportModel, tableMarkup, topSalesDays} from './out/assets/daily-sales.mjs';

const today = '2026-09-16';
const period = {year:2026, month:9, latest_date:'2026-09-15'};
const row = (type, values) => ({type, branch:type || 'Event เมกาบางนา', branch_code:type || 'EVENT-1', month_to_date:10000,
  daily_sales:Object.fromEntries(values.map((value,i) => [`2026-09-${String(i+1).padStart(2,'0')}`,value]))});
function render(branches, extra = {}) {
  const data = {periods:{'2026-09':{...period,dates:Object.keys(branches[0].daily_sales),branches},...extra}};
  return tableMarkup(buildSalesReportModel(data,{year:2026,month:'2026-09'},today),{columns:['daily']},today);
}
const cells = (html) => [...html.matchAll(/<td class="([^"]*daily-cell-[^"]*)" title="([^"]*)">([^<]*)<\/td>/g)]
  .map(([,classes,title,text])=>({classes,title,text}));

test('each branch gets three ranked selling days and Event gets one, including tied values', () => {
  const sales = [9000,10000,9000,9000,2400,2399,0];
  assert.deepEqual([...topSalesDays(row('CDS',sales),period,today).keys()],['2026-09-02','2026-09-01','2026-09-03']);
  for (const type of ['Event',' event ','']) {
    assert.deepEqual([...topSalesDays(row(type,sales),period,today).keys()],['2026-09-02']);
  }
  const html = render([row('CDS',sales),row('RBS',[2400,2401,2500,10000]),row('Event',sales)]);
  assert.equal(cells(html).filter(cell=>cell.classes.includes('daily-cell-top')).length,7);
});

test('red threshold is strict and can coexist with a green best-day background', () => {
  const actual = cells(render([row('CDS',[2399,2400,2401,0,-10])]));
  for (const text of ['2,399','0','-10']) assert.ok(actual.find(cell=>cell.text===text).classes.includes('daily-cell-low'));
  for (const text of ['2,400','2,401']) assert.ok(!actual.find(cell=>cell.text===text).classes.includes('daily-cell-low'));
  const overlapping = actual.find(cell=>cell.text==='2,399');
  assert.ok(overlapping.classes.includes('daily-cell-top'));
  assert.match(overlapping.title,/ต่ำกว่า 2,400.*อันดับ 3/);
});

test('missing, invalid, future, unreported, zero and negative days never become best selling days', () => {
  const branch = row('CDS',[0,-1,null,'',Number.NaN,Infinity,'invalid',500]);
  branch.daily_sales['2026-08-31'] = 99999;
  branch.daily_sales['2026-09-16'] = 99999;
  branch.daily_sales['2026-09-17'] = 99999;
  assert.deepEqual([...topSalesDays(branch,period,today).keys()],['2026-09-08']);
  assert.equal(topSalesDays({...branch,notStarted:true},period,today).size,0);
  const missingCells = cells(render([branch])).filter(cell=>cell.text==='—');
  assert.ok(missingCells.every(cell=>!cell.classes.includes('daily-cell-top')&&!cell.classes.includes('daily-cell-low')));
});

test('annual daily tables rank each month separately', () => {
  const branches = [row('CDS',[1000,2000,3000,4000]),row('Event',[5000,6000,7000,8000])];
  const august = {...period,month:8,latest_date:'2026-08-31',branches:branches.map(branch=>({...branch,
    daily_sales:Object.fromEntries(Object.entries(branch.daily_sales).map(([date,value])=>[date.replace('-09-','-08-'),value*10]))}))};
  const data={periods:{'2026-08':august,'2026-09':{...period,branches}}};
  const html=tableMarkup(buildSalesReportModel(data,{year:2026,month:'all'},today),{columns:['daily']},today);
  const months=html.split('<section class="daily-month-section">').slice(1);
  assert.equal(months.length,2);
  for (const month of months) assert.equal(cells(month).filter(cell=>cell.classes.includes('daily-cell-top')).length,4);
});
