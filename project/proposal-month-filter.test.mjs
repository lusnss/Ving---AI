import test from 'node:test';
import assert from 'node:assert/strict';
import {proposalMonth,proposalMonthLabel,proposalMonthOptions,filterProposalMonth} from './out/assets/proposal-months.mjs';
import {proposalsMarkup,filterProposals,summarizeProposals} from './out/assets/event-proposals.mjs';

test('month filter recognizes saved months and Thai sheet dates without inventing missing years',()=>{
 for(const [row,expected] of [
  [{input:{eventMonth:'2026-10'},month:'กันยายน'},'2026-10'],
  [{month:'ตุลาคม 2569'},'2026-10'],
  [{month:'ตุลาคม',dates:'01-08.10.26'},'2026-10'],
  [{month:'มกราคม',dates:'24.12.26-07.01.27'},'2027-01'],
  [{month:'พ.ย.',startDate:'2026-11-01'},'2026-11'],
  [{dates:'2026-09-01 ถึง 2026-09-05'},'2026-09'],
  [{month:'กันยายน',sourceYear:2026},'2026-09'],
  [{month:'กันยายน'},'month-09'],
  [{month:'2569-10'},'2026-10'],
  [{},'unknown']
 ])assert.equal(proposalMonth(row),expected,JSON.stringify(row));
 assert.equal(proposalMonthLabel('2026-10'),'ตุลาคม 2569');
 assert.equal(proposalMonthLabel('month-09'),'กันยายน (ไม่ระบุปี)');
});

const rows=[
 {place:'ตุลาคมที่อนุมัติ',month:'2026-10',trade:'อนุมัติ',ceo:'อนุมัติ',sales:100,profit:10},
 {place:'ตุลาคมที่ยกเลิก',month:'ตุลาคม 2569',trade:'อนุมัติ',ceo:'อนุมัติ',sales:200,profit:20,workflow:{status:'cancelled',note:'ยกเลิกพื้นที่'}},
 {place:'ตุลาคมที่รอ',month:'2026-10',trade:'อนุมัติ',ceo:'รออนุมัติ',sales:300,profit:30},
 {place:'พฤศจิกายน',month:'2026-11',trade:'ไม่อนุมัติ',ceo:'รออนุมัติ',sales:900,profit:90},
 {place:'ยังไม่ระบุเดือน',sales:50}
];
test('cancellation is a distinct count and status filter within each month',()=>{
 const before=JSON.stringify(rows),oct=filterProposalMonth(rows,'2026-10'),summary=summarizeProposals(oct);
 assert.equal(oct.length,3);assert.equal(summary.approved,1);assert.equal(summary.cancelled,1);assert.equal(summary.pending,1);assert.equal(summary.rejected,0);
 assert.equal(summary.approved+summary.cancelled+summary.pending+summary.rejected,summary.total);
 assert.equal(summary.sales.value,600);assert.equal(summary.profit.value,60);
 assert.deepEqual(filterProposals(oct,'cancelled'),[rows[1]]);assert.deepEqual(filterProposals(oct,'approved'),[rows[0]]);
 assert.equal(filterProposalMonth(rows,'all'),rows);assert.deepEqual(filterProposalMonth(rows,'unknown'),[rows[4]]);
 assert.equal(JSON.stringify(rows),before);
});
test('month selection scopes both dashboard and tables, keeps other months selectable, and handles empty months',()=>{
 const html=proposalsMarkup({items:rows},undefined,'2026-10');
 assert.match(html,/data-proposal-filter="cancelled"/);
 assert.match(html,/data-proposal-number="1" data-metric-key="count-cancelled"/);
 assert.match(html,/data-proposal-number="600" data-metric-key="sales-history"/);
 assert.match(html,/<option value="2026-10" selected>ตุลาคม 2569/);
 assert.match(html,/<option value="2026-11"/);
 const tables=html.slice(html.indexOf('<div data-proposal-tables>'));
 assert.match(tables,/ตุลาคมที่ยกเลิก/);assert.doesNotMatch(tables,/พฤศจิกายน|ยังไม่ระบุเดือน/);
 const empty=proposalsMarkup({items:rows},undefined,'2027-01');
 assert.match(empty,/data-proposal-total>0/);assert.doesNotMatch(empty,/NaN|Infinity/);
 assert.ok(proposalMonthOptions([], '2027-01').some(option=>option.value==='2027-01'));
});
