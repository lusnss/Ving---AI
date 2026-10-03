import assert from 'node:assert/strict';
import {salesFreshnessText, reportSourceTimestamp} from './out/assets/sales-freshness.mjs';

const now = Date.parse('2026-09-17T11:10:00Z');
const snapshot = {
  syncedAt: new Date(now).toISOString(),
  data: {'/api/daily-sales': {source:{as_of_date:'2026-09-15',fetched_at:'2026-09-16T15:32:00Z'}, periods:{
    '2026-09': {latest_date:'2026-09-15', branches:[{daily_sales:{'2026-09-15':181105}}]}
  }}}
};
let label = salesFreshnessText(snapshot, now);
assert.match(label, /ยังไม่ได้เชื่อม Excel ออนไลน์/);
assert.match(label, /ยอดถึง 15 ก.ย. 2569/);
assert.match(label, /รอยอด 16 ก.ย. 2569/);
assert.match(label, /นำเข้าล่าสุด 16\/9\/2569/);
assert.doesNotMatch(label, /อัปเดตอัตโนมัติ|18:10:00/);

const current = structuredClone(snapshot);
current.salesSync = {mode:'cloud',periodKeys:['2026-09']};
current.data['/api/daily-sales'].periods['2026-09'] = {
  latest_date:'2026-09-16', source:{fetched_at:'2026-09-17T10:00:00Z'},
  branches:[{daily_sales:{'2026-09-16':0}}]
};
label = salesFreshnessText(current, now);
assert.match(label, /รับข้อมูลจาก Excel ออนไลน์/);
assert.match(label, /ยอดถึง 16 ก.ย. 2569/);
assert.match(label, /อ่านต้นทางล่าสุด 17\/9\/2569/);
assert.doesNotMatch(label, /รอยอด|ทุกวัน/);

current.data['/api/daily-sales'].periods['2026-10'] = {
  latest_date:'2026-10-31', branches:[{daily_sales:{'2026-10-31':100}}]
};
assert.match(salesFreshnessText(current, now), /ยอดถึง 16 ก.ย. 2569/);
current.syncUnavailable = true;
assert.match(salesFreshnessText(current, now), /เชื่อมข้อมูลล่าสุดไม่ได้/);
assert.match(salesFreshnessText({data:{}}, now), /ยังไม่มีข้อมูลรายวัน/);

const mixed = structuredClone(current);
delete mixed.syncUnavailable;
mixed.data['/api/daily-sales'].periods['2026-10'] = {
  latest_date:'2026-10-02', branches:[{daily_sales:{'2026-10-02':100}}]
};
label = salesFreshnessText(mixed, Date.parse('2026-10-03T11:00:00Z'));
assert.match(label, /ยังไม่ได้เชื่อม Excel ออนไลน์/);
assert.doesNotMatch(label, /อ่านต้นทางล่าสุด|นำเข้าล่าสุด/);
assert.equal(reportSourceTimestamp(mixed.data['/api/daily-sales'], {}, '2025-12'), null);

current.data['/api/daily-sales'].periods['2026-09'].source.fetched_at = '2026-09-17T11:05:00Z';
assert.match(salesFreshnessText(current, now), /18:05:00/);
console.log('Sales freshness: stale imports, online deliveries, reported zero, future dates and unavailable data passed.');
