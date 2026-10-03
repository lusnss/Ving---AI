import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {statementRecords,selectRecords,summarize} from './out/assets/profit-loss.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./profit-loss.snapshot.json',import.meta.url)));
test('current and cumulative statement periods, filters, and year boundaries',()=>{
 const state={month:'9',channel:'all',basis:'all'};
 const current=statementRecords(data,{...state,salesMode:'current'});
 assert.deepEqual(current,selectRecords(data,state));
 const cumulative=statementRecords(data,{...state,salesMode:'cumulative'});
 assert.deepEqual(cumulative,selectRecords(data,{...state,month:'all'}).filter(r=>r.month<=9));
 const monthlyTotal=Array.from({length:9},(_,i)=>summarize(selectRecords(data,{...state,month:String(i+1)})).net??0).reduce((a,b)=>a+b,0);
 assert(Math.abs(summarize(cumulative).net-monthlyTotal)<0.01);
 const filtered=statementRecords(data,{...state,salesMode:'cumulative',channel:'consign',basis:'FCT'});
 assert(filtered.length);assert(filtered.every(r=>r.channel==='consign'&&r.basis==='FCT'&&r.month<=9));
 for(const month of ['1','all'])assert.deepEqual(statementRecords(data,{...state,month,salesMode:'cumulative'}),statementRecords(data,{...state,month,salesMode:'current'}));
 assert.deepEqual(statementRecords({...data,records:[...data.records,{...current[0],year:data.year-1}]},{...state,salesMode:'cumulative'}),cumulative);
});
