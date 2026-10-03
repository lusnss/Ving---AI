import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contractPnlUrl} from './out/assets/contract-pnl.mjs';
import {selectRecords,monthlySummaries,detailComparisons,summarize} from './out/assets/profit-loss.mjs';
const data=JSON.parse(await readFile('profit-loss.snapshot.json','utf8'));
for(const branch of ['เซ็นทรัลเชียงใหม่แอร์พอร์ต','เซ็นทรัลอุดร','ฟิวเจอร์รังสิต']){
 const u=new URL(contractPnlUrl({branch}),'https://example.test'),selection=Object.fromEntries(u.searchParams),rows=selectRecords(data,selection);
 assert(rows.length>0,branch);assert(rows.every(r=>r.channel==='standalone'));assert.equal(new Set(rows.map(r=>r.name)).size,1);
 const details=detailComparisons(data,selection);assert.equal(details.length,rows.length);assert.equal(new Set(details.map(r=>r.name)).size,1);
 const net=monthlySummaries(data,selection).reduce((v,m)=>v+(m.net||0),0);assert(Math.abs(net-summarize(rows).net)<.01);
}
assert.equal(selectRecords(data,{month:'all',channel:'standalone',basis:'ACT',branch:'อีเวนท์เมกาบางนา'}).length,0);
assert(contractPnlUrl({branch:'ชื่อใหม่',sourceBranch:'เซ็นทรัลอุดร'}).includes(encodeURIComponent('เซ็นทรัลอุดร')));
console.log('PASS: branch URLs, Rangsit alias, ACT-only scope across totals/monthly charts/detail comparisons, no false Mega branch match');
