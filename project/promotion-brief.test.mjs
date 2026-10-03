import test from 'node:test';
import assert from 'node:assert/strict';
import {promotionBriefSheets, promotionBriefWorkbook, renderPromotionBrief} from './out/assets/promotion-brief.mjs';
import {promotionTotals} from './out/assets/promotion-model.mjs';

const line = {model: '=1+1 <sample>', grade: 'A', qty: 3, discount: 10.1, sizes: ['40', '41'], members: [
  {key: 'a', color: 'Black', size: '40', available: 2, fullPrice: 1000, unitCost: 300},
  {key: 'b', color: 'White', size: '41', available: 4, fullPrice: 1500, unitCost: 400}
]};
const brief = {name: 'ข้อเสนอทดสอบ', month: '2026-09', channel: 'department', gp: 25, lines: [line]};
test('fixed prices stay distinct in the brief and Excel, and do not show a stale percentage',()=>{
 const fixed={...line,pricingMode:'price',salePrice:499.99,discount:10.1};
 const mixed={...brief,lines:[fixed,{...line,model:'Percent model'}]};
 const html=renderPromotionBrief(mixed),[summary,models,sizes]=promotionBriefSheets(mixed);
 assert.match(html,/ราคาขาย ฿499.99/);assert.match(html,/10.1%/);
 assert.ok(summary.rows.some(r=>r.values[0]==='ราคาขาย ฿499.99'));
 assert.equal(models.rows[1].values[5],null);assert.deepEqual(models.rows[1].values.slice(6,8),[499.99,499.99]);
 assert.equal(models.rows[1].values[10],1499.97);
 assert.ok(sizes.rows.slice(1,3).every(r=>r.values[10]===499.99));
 const missing={...brief,lines:[{...fixed,members:[{key:'a',available:3,fullPrice:null,unitCost:300}]}]};
 const sheets=promotionBriefSheets(missing);
 assert.equal(sheets[0].rows[3].values[3],null);assert.equal(sheets[0].rows[3].values[4],1499.97);
 assert.match(sheets[1].rows[1].values.at(-1),/ราคาเต็มไม่ครบ/);
 assert.match(new TextDecoder().decode(promotionBriefWorkbook(mixed)),/ราคาขาย ฿499.99/);
});
test('conditions appear in the brief and Excel as safe multiline text with the calculation basis', () => {
  const conditions = 'คู่แรกลด 30%\nซื้อ 2 คู่ ลด 40%\n<img src=x onerror=alert(1)>\n=1+1';
  const withConditions = {...brief, conditions};
  const html = renderPromotionBrief(withConditions);
  assert.match(html, /คู่แรกลด 30%\nซื้อ 2 คู่ ลด 40%/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /ยังไม่รวมเงื่อนไขหรือของแถม/);
  const summary = promotionBriefSheets(withConditions)[0];
  for(const text of conditions.split('\n'))assert.ok(summary.rows.some(r=>r.values[0]===text));
  assert.deepEqual(summary.rows[3],promotionBriefSheets(brief)[0].rows[3]);
  const xml = new TextDecoder().decode(promotionBriefWorkbook(withConditions));
  assert.match(xml, /t="inlineStr"><is><t xml:space="preserve">=1\+1/);
  assert.doesNotMatch(xml, /<f>/);
  assert.doesNotMatch(renderPromotionBrief(brief), /class="pm-brief-conditions"/);
});
test('Excel preserves numeric precision and matches weighted, allocated promotion totals', () => {
  const [summary, models, sizes] = promotionBriefSheets(brief), total = promotionTotals(brief.lines, 25);
  assert.equal(summary.fitToHeight, 1);
  assert.equal(summary.rows[3].values[4], total.net);
  assert.equal(summary.rows[3].values[7], total.grossMargin / 100);
  assert.equal(models.rows[1].values[5], 0.10099999999999999);
  assert.deepEqual(models.rows[1].values.slice(6, 8), [899, 1348.5]);
  assert.equal(sizes.rows.slice(1).reduce((sum, row) => sum + row.values[6], 0), 3);
  assert.equal(sizes.rows.slice(1).reduce((sum, row) => sum + row.values[11], 0), total.net);
  assert.equal(models.rows[1].values[15], total.afterGp);
});
test('Missing GP, price, and cost stay unknown with explicit completeness notes', () => {
  const unknown = {...brief, gp: null, lines: [{...line, members: [{key: 'a', size: '40', available: 3, fullPrice: null, unitCost: null}]}]};
  const [summary, models, sizes] = promotionBriefSheets(unknown);
  assert.equal(summary.rows[5].values[0], null);
  assert.equal(models.rows[1].values[6], null);
  assert.equal(models.rows[1].values[13], null);
  assert.equal(models.rows[1].values[15], null);
  assert.equal(sizes.rows[1].values[11], null);
  assert.match(models.rows[1].values.at(-1), /ต้องถามเจ้าของ/);
});
test('Brief exports every line, keeps discount grouping distinct, and escapes user text', () => {
  const lines = Array.from({length: 200}, (_, i) => ({...line, model: 'Model ' + i, discount: i % 2 ? 10 : 10.1}));
  const sheets = promotionBriefSheets({...brief, lines});
  assert.equal(sheets[1].rows.length, 201);
  assert.equal(sheets[2].rows.length, 401);
  const html = renderPromotionBrief(brief);
  assert.match(html, /=1\+1 &lt;sample&gt;/);
  assert.match(html, /<details class="pm-brief-more">/);
  assert.doesNotMatch(html, /<details[^>]*open/);
  assert.match(html, /<th scope="col">โปรโมชั่น<\/th><th scope="col">จำนวนรุ่น<\/th><th scope="col">รุ่น/);
  assert.match(html, /data-action="edit-brief"/);
  const bytes = promotionBriefWorkbook(brief), xml = new TextDecoder().decode(bytes);
  assert.deepEqual([...bytes.slice(0, 4)], [80, 75, 3, 4]);
  assert.match(xml, /fitToHeight="1"/);
  assert.match(xml, /t="inlineStr"><is><t xml:space="preserve">=1\+1 &lt;sample&gt;/);
  assert.doesNotMatch(xml, /<f>/);
});
