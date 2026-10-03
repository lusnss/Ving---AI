import test from 'node:test';
import {reportData} from './out/assets/daily-comparison-data.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from './dist/server/index.js';
import {previewDatabase} from './preview-db.mjs';
const auth={SESSION_SECRET:'summary-test-secret',ADMIN_PASSWORD:'summary-admin',VIEWER_PASSWORD:'summary-viewer'};
import {buildSummaryModel} from './out/assets/summary.mjs';
const snapshot=JSON.parse(fs.readFileSync('out/snapshot.json'));
const pnl=JSON.parse(fs.readFileSync('profit-loss.snapshot.json'));
const req=(path,options={})=>new Request('https://example.test'+path,options);
const login=await worker.fetch(req('/login',{method:'POST',body:new URLSearchParams({password:'summary-viewer'})}),auth);
const cookie=login.headers.get('set-cookie').split(';')[0];
test('Summary shares cached live Daily report while retaining saved financial reports',async()=>{
 const original=globalThis.fetch;let external=0,writes=0;
 globalThis.fetch=async()=>{external++;throw Error('Workbook unavailable');};
 try{
  const env={...auth,DB:previewDatabase(),BUCKET:{get:async key=>key==='daily-comparison-live.json'?{json:async()=>({...reportData,live:{status:'online',checkedAt:new Date().toISOString()}})}:key==='snapshot.json'?{json:async()=>snapshot}:key==='profit-loss.json'?{json:async()=>pnl}:null,put:async()=>{writes++;}}};
  assert.equal((await worker.fetch(req('/api/summary'),env)).status,401);
  const response=await worker.fetch(req('/api/summary',{headers:{cookie}}),env);
  assert.equal(response.status,200);const data=await response.json();
  const report=await (await worker.fetch(req('/api/snapshot',{headers:{cookie}}),env)).json();
  assert.deepEqual(data.report,report.data['/api/daily-sales']);
  assert.deepEqual(data.events,report.data['/api/events']);assert.deepEqual(data.pnl,pnl);
  const model=buildSummaryModel(data,{year:2026,month:9,basis:'all'},'2026-09-20');
  assert.ok(model.selected.actual>0);assert.ok(model.selected.events.length>0);
  assert.equal(external,0);assert.equal(data.comparison.live.status,'online');assert.equal(writes,0);
 }finally{globalThis.fetch=original;}
});
test('Summary keeps web fallback data when storage is unavailable',async()=>{
 const env={...auth,DB:previewDatabase(),BUCKET:{get:async()=>{throw Error('offline');}}};
 const data=await(await worker.fetch(req('/api/summary',{headers:{cookie}}),env)).json();
 assert.ok(Object.keys(data.report.periods).length);assert.ok(data.pnl.records.length);assert.ok(data.events.years);
});
