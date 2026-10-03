import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildStockSummary, summaryIdentity} from './out/assets/stock-summary-model.mjs';
import {loadStockSummary} from './stock-summary-data.mjs';
import {previewDatabase} from './preview-db.mjs';
import worker from './dist/server/index.js';

const snapshot = items => ({items, updatedAt: '2026-09-24T00:00:00Z'});
const scaleup = snapshot([
  {sku: 'VING-Jarix1.5-Onyx_Black#40', available: 7, reserved: 3, onHand: 10},
  {sku: 'VING-Jarix1.5_BB-Onyx_Black#40', available: 2},
  {sku: 'VING-Jarix1.5-Onyx_Black#40', available: 4, warehouse: 'second warehouse'},
  {sku: 'VING-Brochure-Productguide_V1#A5', available: 5, productType: 'FREE'}
]);
const pivot = snapshot([
  {sku: 'VING-Jarix1.5-Onyx_Black#40', model: 'Jarix1.5', grade: 'A', color: 'Onyx Black', size: '40', available: 8},
  {sku: 'VING-Jarix1.5_BB-Onyx_Black#40', grade: 'C', color: 'Onyx Black', size: '40', available: 3},
  {sku: 'VING-Jarix1.5_B-Onyx_Black#40', grade: 'A', color: 'Onyx Black', size: '40', available: 1},
  {sku: 'VING-PivotOnly-Green#37', grade: 'D', available: 6}
]);
const report = buildStockSummary(scaleup, pivot);
assert.deepEqual(report.totals, {scaleup: 18, pivot: 18, total: 36});
assert.deepEqual(report.models.find(row => row.model === 'Jarix1.5'), {unitCostMin: null, unitCostMax: null, costMissing: true, costRows: [], fullPriceMin: null, fullPriceMax: null, priceMissing: true, model: 'Jarix1.5', scaleup: 13, pivot: 12, total: 25});
assert.deepEqual(report.variants.find(row => row.grade === 'A' && row.model === 'Jarix1.5'), {unitCostMin: null, unitCostMax: null, costMissing: true, costRows: [], fullPriceMin: null, fullPriceMax: null, priceMissing: true, model: 'Jarix1.5', grade: 'A', color: 'Onyx Black', size: '40', scaleup: 11, pivot: 9, total: 20});
assert.equal(report.grades.find(row => row.grade === 'C').scaleup, 0);
assert.equal(report.grades.find(row => row.grade === 'B+').pivot, 0);
assert.equal(summaryIdentity({sku: 'TORANI-Uma-Jam_Orange#11'}).model, 'TORANI Uma');
assert.equal(summaryIdentity({sku: 'VING-Vari_V1.0-Jet_Black#37'}).model, 'Vari V1.0');
assert.equal(summaryIdentity({sku: 'VING-Vix_BB-Pearl_White#41/42'}).size, '41/42');
assert.equal(summaryIdentity({sku: 'VING-Flexstraps-white', color: 'White', size: 'ไม่มี'}).size, 'ไม่ระบุไซซ์');
const partial = buildStockSummary(scaleup, null);
assert.equal(partial.totals.scaleup, 18); assert.equal(partial.totals.pivot, null); assert.equal(partial.totals.total, null);
assert.ok(partial.models.every(row => row.pivot === null && row.total === null));
assert.equal(buildStockSummary(scaleup, snapshot([{available: null}])).sources.pivot.ready, false);
assert.equal(buildStockSummary(snapshot([]), snapshot([])).totals.total, 0);
assert.equal(buildStockSummary(snapshot([{sku: 'VING-Vix-Black#40', available: -2}]), snapshot([])).totals.total, -2);
const designs = buildStockSummary(snapshot([]), snapshot([
  {sku: 'VING-JBRK-M1', model: 'Jibbiz Reka Model 1', color: 'ไม่มี', productType: 'Accessories', available: 1},
  {sku: 'VING-JBRK-M2', model: 'Jibbiz Reka Model 2', color: 'ไม่มี', productType: 'Accessories', available: 2}
]));
assert.equal(designs.models.length, 2); assert.ok(designs.variants.every(row => row.color === 'ไม่ระบุสี'));

const realScaleup = JSON.parse(await fs.readFile('inventory-initial.json', 'utf8'));
const realPivot = JSON.parse(await fs.readFile('pivot-inventory.snapshot.json', 'utf8'));
const actual = buildStockSummary(realScaleup, realPivot);
for (const level of ['models', 'grades', 'variants']) {
  assert.equal(actual[level].reduce((n, row) => n + row.scaleup, 0), realScaleup.summary.available);
  assert.equal(actual[level].reduce((n, row) => n + row.pivot, 0), realPivot.summary.available);
  assert.equal(actual[level].reduce((n, row) => n + row.total, 0), realScaleup.summary.available + realPivot.summary.available);
}
assert.ok(!JSON.stringify(actual).includes('"sku"'));
assert.ok(!JSON.stringify(actual).includes('"barcode"'));
assert.equal(actual.models.find(row => row.model === 'Jarix1.5').fullPriceMin, 2350);
assert.equal(actual.models.find(row => row.model === 'Jarix').fullPriceMax, 2350);

const DB = previewDatabase(':memory:');
const env = {DB, SESSION_SECRET: 'local-test', VIEWER_PASSWORD: 'viewer', ADMIN_PASSWORD: 'admin'};
await DB.prepare('INSERT INTO inventory_snapshots (source,payload,updated_at) VALUES (?,?,?)').bind('scaleup', JSON.stringify(scaleup), scaleup.updatedAt).run();
const newerPivot = {...pivot, updatedAt: '2099-01-01T00:00:00Z'};
await DB.prepare('INSERT INTO inventory_snapshots (source,payload,updated_at) VALUES (?,?,?)').bind('pivot', JSON.stringify(newerPivot), newerPivot.updatedAt).run();
assert.deepEqual((await loadStockSummary(env, realScaleup)).totals, report.totals);
const broken = {DB: {prepare(){return {bind(source){return {async first(){if(source === 'pivot') throw Error('unavailable');return {payload: JSON.stringify(scaleup)};}};}};}}};
assert.equal((await loadStockSummary(broken, realScaleup)).totals.total, null);
const request = (path, options) => new Request('https://example.test' + path, options);
assert.equal((await worker.fetch(request('/api/stock-summary'), env)).status, 401);
const login = await worker.fetch(request('/login', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: 'password=viewer&next=%2Fstock-summary'}), env);
const cookie = login.headers.get('set-cookie').split(';')[0];
assert.equal((await worker.fetch(request('/stock-summary', {headers: {cookie}}), env)).status, 200);
const response = await worker.fetch(request('/api/stock-summary', {headers: {cookie}}), env);
assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
assert.deepEqual((await response.json()).totals, report.totals);
assert.equal((await worker.fetch(request('/api/stock-summary', {method: 'POST', headers: {cookie}}), env)).status, 405);
DB.close();
console.log('PASS: totals reconcile at all 3 levels; source grades, model grouping, duplicate warehouse rows, saved snapshots, missing data, no SKU exposure, login and viewer access.');
console.log(JSON.stringify({models: actual.models.length, grades: actual.grades.length, variants: actual.variants.length, totals: actual.totals}));
