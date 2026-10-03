import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSalesReportModel,reportType,tableMarkup,summaryMarkup} from './out/assets/daily-sales.mjs';
import {reconcileEvents} from './events-data.mjs';
const row=(branch,type,month_to_date,branch_code='')=>({branch,type,month_to_date,branch_code,target:100000,daily_sales:{'2026-09-01':month_to_date}});
// Event amounts from the supplied September 17 workbook screenshot.
const branches=[row('Mega Bangna','CDS',38797.5,'VC-050'),row('ลาดพร้าว','CDS',40000),row('พิษณุโลก','RBS',54690,'VC-014'),
 row('ลาดพร้าว','CDS',11622.5),row('เมกา บางนา','CDS',60005),row('Kelly Fashion Island','ลานโปร',61850),row('พิษณุโลก','RBS',22125),row('The Crystal Park','Sport World',130532),row('Pinklao','CDS PK',48017.5),row('ลานโปร TM บางแค 10-16/09/26','Sports Mall',168156),
 row('Event เมกาบางนา','',212105),row('Event MRT Metro Mall จตุจักร','',17529),row('Seacon Square','',1260),row('รังสิต','Stand alone',100,'VA-002'),row('อุดรธานี','Pop up Store',48238,'VA-012')];
const data={periods:{'2026-09':{year:2026,month:9,dates:['2026-09-01'],latest_date:'2026-09-17',branches}}};
const build=(month='2026-09')=>buildSalesReportModel(data,{year:2026,month},'2026-09-20');
const channel=(model,name)=>model.channels.find(c=>c.name===name);
test('mall-labelled Event enters the Event card, VA store leaves it, confirmed counter exceptions remain',()=>{
 const m=build(),events=channel(m,'Event');
 assert.equal(events.total,699454.5);assert.equal(events.branches,8);
 assert(events.rows.some(r=>r.branch==='เมกา บางนา'));
 assert(!events.rows.some(r=>r.branch==='อุดรธานี'||r.branch==='ลาดพร้าว'||r.branch==='พิษณุโลก'));
 assert.equal(channel(m,'Stand alone').rows.find(r=>r.branch==='อุดรธานี').total,48238);
 assert.equal(channel(m,'CDS').rows.find(r=>r.branch==='Mega Bangna').total,38797.5);
 assert.equal(channel(m,'CDS').rows.find(r=>r.branch==='ลาดพร้าว').total,51622.5);
 assert.equal(channel(m,'RBS').rows.find(r=>r.branch==='พิษณุโลก').total,54690);
 const before=687687.5;assert.equal(events.total,before+60005-48238);
 const workbook=733202;assert.equal(workbook-events.total,11622.5+22125);
 assert.equal(m.eventReconciliation.sourceTotal,workbook);assert.deepEqual(m.eventReconciliation.excluded,[{name:'ลาดพร้าว',amount:11622.5},{name:'พิษณุโลก',amount:22125}]);
 assert.match(summaryMarkup(m),/733,202.00/);assert.match(summaryMarkup(m),/11,622.50/);
 assert.equal(m.summary.total,m.channels.reduce((s,c)=>s+c.total,0),'no duplicated sales between channels');
 assert.equal(m.summary.total,branches.reduce((s,r)=>s+r.month_to_date,0)-22125,'keep the established duplicate exclusion');
 const catalog={catalog_version:1,years:{2026:{items:[]}}};
 const overview=reconcileEvents(catalog,data).years[2026];
 assert.equal(overview.summary.sales,events.total,'Sales Report agrees with Event overview');
 assert.match(tableMarkup(m,{columns:['type','total']},'2026-09-20'),/ส่วน Event ในรายงาน · Event/);
});
test('section-aware grouping applies to annual rows and future months without carrying events forward',()=>{
 assert.equal(channel(build('all'),'Event').total,699454.5);
 const future=build('2026-10');assert(!future.totals.rows.some(r=>r.branch==='เมกา บางนา'));
 assert(future.totals.rows.some(r=>r.branch==='อุดรธานี'));
 assert.equal(reportType({type:'CDS',source_section:'event'}),'Event');
 assert.equal(reportType({type:'RBS',source_section:'event'}),'Event');
 assert.equal(reportType({type:'Pop up Store',source_section:'branch',branch_code:'VA-012'}),'Stand alone');
 assert.equal(reportType('CDS'),'CDS');
});
