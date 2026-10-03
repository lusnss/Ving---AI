import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSalesReportModel, reportType} from './out/assets/daily-sales.mjs';

const today = '2026-09-16';
const branch = (branch_code, type, month_to_date, extra = {}) => ({
  branch_code, branch:branch_code, type, month_to_date, target:1000, daily_sales:{}, ...extra
});
const period = (key, branches, latest_date) => ({
  year:Number(key.slice(0,4)), month:Number(key.slice(5)), branches, dates:[],
  latest_date:latest_date || `${key}-${key === '2026-09' ? '15' : new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5)),0)).getUTCDate()}`
});
const build = (current, prior, extra = {}, state = {year:2026,month:'2026-09'}, date = today) => buildSalesReportModel({periods:{
  '2026-09':period('2026-09',current), ...(prior ? {'2025-09':period('2025-09',prior)} : {}), ...extra
}},state,date);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test('summary adds scheduled Event forecasts and labels actual-only contributions for missing schedules', () => {
  const current = [branch('S','Stand alone',100), branch('C','CDS',80), branch('R','RBS',60), branch('T','TM',40),
    branch('Unknown','Event',25), branch('Sports','Sports Mall',15),
    branch('Scheduled','Event',50,{branch:'Sale 01-30/09/69',daily_sales:{'2026-09-15':50}}), branch('Pending','Event',0)];
  const prior = [branch('S','Stand alone',120), branch('C','CDS',180), branch('R','RBS',100), branch('T','TM',80),
    branch('Old event','14 วัน',60), branch('Other event','Sports Mall',40)];
  const m = build(current,prior);
  assert.equal(m.summary.forecast,700);
  assert.equal(m.totals.forecast,700);
  assert.equal(m.summary.branchForecast,560);
  assert.equal(m.summary.eventActual,90);
  assert.equal(m.summary.forecastBasis,'branch-and-event-forecast');
  assert.equal(m.summary.unknownEventSchedules,2);
  assert.equal(m.totals.rows.find(row => row.branch_code === 'Scheduled').forecast,100);
  assert.equal(m.totals.rows.find(row => row.branch_code === 'Unknown').forecast,null);
  assert.equal(m.totals.rows.find(row => row.branch_code === 'Pending').forecast,null);
  assert.equal(m.channels.find(channel => channel.name === 'Event').forecast,140);
  assert.equal(m.pendingEvents,1);
  assert.equal(m.channels.reduce((sum,channel) => sum + channel.forecast,0),m.summary.forecast);
  assert.equal(m.summary.yoySummary.actual,580);
  assert.equal(m.summary.yoySummary.delta,120);
  close(m.summary.yoySummary.percent,120/580);
  assert.deepEqual(m.channels.map(channel => [channel.name,channel.yoySummary.actual,channel.yoySummary.delta]),[
    ['Stand alone',120,80],['CDS',180,-20],['RBS',100,20],['TM',80,0],['Event',100,40]
  ]);
  assert.deepEqual(m.summary.yoyCounts,{up:2,down:1,equal:1,new:0,unknown:0,eligible:4});
  assert.equal(m.channels.find(channel => channel.name === 'Event').yoyCounts.eligible,0);
  assert.equal(m.channels.find(channel => channel.name === 'Event').yoySummary.basis,'event-forecast');
});

test('channel comparison sums every outlet in that channel instead of only matched branches', () => {
  const m = build([branch('Retained','CDS',100),branch('New','CDS',50)],
    [branch('Retained','CDS',100),branch('Closed','CDS',250)]);
  assert.equal(m.summary.yoyCounts.up,1);
  assert.equal(m.summary.yoyCounts.new,1);
  assert.equal(m.channels.find(channel => channel.name === 'CDS').yoySummary.actual,350);
  assert.equal(m.channels.find(channel => channel.name === 'CDS').yoySummary.delta,-50);
});

test('missing and incomplete prior months do not produce totals or growth percentages', () => {
  for (const m of [build([branch('A','CDS',50)],null),
    build([branch('A','CDS',50)],[],{'2025-09':period('2025-09',[branch('A','CDS',100)],'2025-09-15')}),
    build([branch('A','CDS',50)],[branch('A','CDS',null)]),
    build([branch('A','CDS',50)],[branch('A','CDS',100),branch('E','Event','')])]) {
    assert.equal(m.summary.yoySummary.status,'unknown');
    assert.equal(m.summary.yoySummary.actual,null);
    assert.equal(m.summary.yoySummary.delta,null);
    assert.equal(m.summary.yoySummary.percent,null);
  }
});

test('a missing prior channel is unknown, and missing Event data does not hide valid branch comparisons', () => {
  const m = build([branch('A','CDS',50),branch('E','Event',20)],[branch('A','CDS',100),branch('E','Event',null)]);
  assert.equal(m.summary.yoySummary.status,'unknown');
  assert.equal(m.channels.find(channel => channel.name === 'CDS').yoySummary.actual,100);
  assert.equal(m.channels.find(channel => channel.name === 'CDS').yoySummary.status,'equal');
  assert.equal(m.channels.find(channel => channel.name === 'Event').yoySummary.actual,null);
  assert.equal(m.channels.find(channel => channel.name === 'TM').yoySummary.actual,null);
});

test('zero and negative prior totals keep the baht difference without inventing a growth percentage', () => {
  for (const baseline of [0,-10]) {
    const yoy = build([branch('A','CDS',50)],[branch('A','CDS',baseline)]).summary.yoySummary;
    assert.equal(yoy.actual,baseline);
    assert.equal(yoy.current,100);
    assert.equal(yoy.delta,100-baseline);
    assert.equal(yoy.status,'up');
    assert.equal(yoy.percent,null);
    assert.match(yoy.reason,/คำนวณ % ไม่ได้/);
  }
});

test('the prior full-month actual remains available when the current forecast cannot be computed', () => {
  const m = build([branch('A','CDS',50)],[branch('A','CDS',100)],{},undefined,'2026-09-01');
  assert.equal(m.summary.forecast,null);
  assert.equal(m.summary.yoySummary.actual,100);
  assert.equal(m.summary.yoySummary.current,null);
  assert.equal(m.summary.yoySummary.delta,null);
  assert.equal(m.summary.yoySummary.percent,null);
});

test('historical months compare actuals and do not create a past month forecast', () => {
  const m = build([branch('A','CDS',50)],[branch('A','CDS',100)],
    {'2024-09':period('2024-09',[branch('A','CDS',80)])},{year:2025,month:'2025-09'});
  assert.equal(m.summary.forecast,null);
  assert.equal(m.summary.yoySummary.basis,'actual');
  assert.equal(m.summary.yoySummary.current,100);
  assert.equal(m.summary.yoySummary.actual,80);
  assert.equal(m.summary.yoySummary.delta,20);
});

test('annual actual comparison uses the same imported months and never a partial set of prior months', () => {
  const extra = {'2026-08':period('2026-08',[branch('A','CDS',70),branch('E','Event',10)]),
    '2025-08':period('2025-08',[branch('A','CDS',60),branch('Old E','10 วัน',15)]),
    '2025-01':period('2025-01',[branch('A','CDS',999)])};
  const m = build([branch('A','CDS',50),branch('E','Event',20)],
    [branch('A','CDS',100),branch('Old E','14 วัน',25)],extra,{year:2026,month:'all'});
  assert.equal(m.summary.forecast,null);
  assert.equal(m.summary.yoySummary.current,150);
  assert.equal(m.summary.yoySummary.actual,200);
  assert.equal(m.summary.yoySummary.delta,-50);
  assert.deepEqual(m.summary.yoySummary.priorKeys,['2025-08','2025-09']);
  assert.equal(m.summary.yoySummary.basis,'actual');
  assert.equal(m.summary.yoySummary.priorKey,null);
  delete extra['2025-08'];
  const missing = build([branch('A','CDS',50)],[branch('A','CDS',100)],extra,{year:2026,month:'all'});
  assert.equal(missing.summary.yoySummary.actual,null);
  assert.equal(missing.summary.yoySummary.percent,null);
});

test('future month comparisons use that prior month and do not carry Event actuals forward', () => {
  const m = build([branch('A','CDS',50),branch('E','Event',25)],[branch('A','CDS',300)],
    {'2025-10':period('2025-10',[branch('A','CDS',100),branch('Old E','14 วัน',50)])},{year:2026,month:'2026-10'});
  assert.equal(m.selectedPeriod.projected,true);
  close(m.summary.forecast,50/15*31);
  assert.equal(m.summary.eventActual,0);
  assert.equal(m.summary.yoySummary.actual,150);
  assert.equal(m.summary.yoySummary.priorKey,'2025-10');
  assert.equal(m.channels.find(channel => channel.name === 'Event').yoySummary.current,null);
  assert.equal(m.channels.find(channel => channel.name === 'Event').yoySummary.actual,50);
});

test('pending-only and unselected summaries stay empty', () => {
  const m = build([branch('Pending','Event',0)],[branch('E','Event',100)]);
  assert.equal(m.summary.forecast,null);
  assert.equal(m.summary.yoySummary.current,null);
  assert.equal(m.summary.yoySummary.actual,100);
  assert.equal(m.summary.yoySummary.delta,null);
  const empty = build([branch('A','CDS',100)],null,{},{});
  assert.equal(empty.summary.yoySummary.actual,null);
  assert.equal(empty.summary.yoySummary.percent,null);
});

test('September snapshot includes every Event type in current forecast and prior-year actual', () => {
  const snapshot = JSON.parse(fs.readFileSync(new URL('./out/snapshot.json',import.meta.url)));
  const data = snapshot.data['/api/daily-sales'];
  const m = buildSalesReportModel(data,{year:2026,month:'2026-09'},today);
  const prior = data.periods['2025-09'].branches;
  const priorEvent = prior.filter(row => reportType(row.type) === 'Event' && row.branch_code !== 'VA-007').reduce((sum,row) => sum + Number(row.month_to_date),0);
  const branches = m.summary.rows.filter(row => reportType(row) !== 'Event');
  const events = m.channels.find(channel => channel.name === 'Event');
  close(m.summary.forecast,branches.reduce((sum,row) => sum + row.forecast,0)+events.forecast);
  close(m.summary.yoySummary.actual,prior.reduce((sum,row) => sum + Number(row.month_to_date),0));
  close(events.yoySummary.actual,priorEvent);
  close(m.channels.reduce((sum,channel) => sum + channel.yoySummary.actual,0),m.summary.yoySummary.actual);
  assert.deepEqual(m.summary.yoyCounts,{up:19,down:20,equal:0,new:9,unknown:0,eligible:48});
});
