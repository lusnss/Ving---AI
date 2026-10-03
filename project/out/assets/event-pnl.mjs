import {escapeHtml as e} from './api.mjs';
const valid=v=>typeof v==='number'&&Number.isFinite(v);
const money=v=>valid(v)?new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(v):'—';
const identity=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const costs={rent:'ค่าเช่า / GP',electricity:'ค่าไฟ',pc:'ค่าพนักงาน PC',shipping:'ค่าขนส่ง',depreciation:'ค่าเสื่อม / ตกแต่ง',interest:'ดอกเบี้ย',landTax:'ภาษีที่ดิน',mallDeduction:'ค่าห้างหัก',marketing:'การตลาด',misc:'ค่าใช้จ่ายอื่น'};
const optionalCosts=new Set(['mallDeduction','marketing','misc']);
// Only these three blank cost cells mean zero; every recorded amount still counts.
const costValue=(key,value)=>optionalCosts.has(key)&&(value===null||value===undefined||typeof value==='string'&&!value.trim())?0:value;
export function eventPnl(item,year,data={}){
 const names=[item.catalogName,item.name].filter(Boolean).map(identity);
 const categories=item.categories?.length?item.categories:[item.category];
 const records=(data.records||[]).filter(r=>Number(r.year)===Number(year)&&r.basis==='ACT'&&['event-direct','event-gp'].includes(r.channel)&&names.includes(identity(r.name))&&(!categories.some(c=>['direct','gp'].includes(c))||categories.includes(r.channel.slice(6))));
 const seen=new Set();let ambiguous=false;
 for(const r of records){const key=[r.year,r.month,r.channel].join('|');if(seen.has(key))ambiguous=true;seen.add(key);}
 const sum=fn=>records.length&&records.every(r=>valid(fn(r)))?records.reduce((s,r)=>s+fn(r),0):null;
 const fields=Object.keys(costs).filter(k=>records.some(r=>Object.hasOwn(r.costs||{},k)));
 const totals=Object.fromEntries(['gross','discount','net','cogs'].map(k=>[k,sum(r=>r[k])]));
 totals.opex=sum(r=>{const values=Object.entries(r.costs||{}).map(([key,value])=>costValue(key,value));return values.length&&values.every(valid)?values.reduce((s,v)=>s+v,0):null;});
 totals.grossProfit=valid(totals.net)&&valid(totals.cogs)?totals.net-totals.cogs:null;
 totals.profit=!ambiguous&&valid(totals.grossProfit)&&valid(totals.opex)?totals.grossProfit-totals.opex:null;
 const status=data.unavailable?'unavailable':ambiguous?'ambiguous':!records.length?'pending':!valid(totals.profit)?'incomplete':Math.abs(totals.profit)<0.005?'even':totals.profit>0?'profit':'loss';
 const label={unavailable:'โหลดงบไม่ได้',ambiguous:'รอตรวจสอบงบซ้ำ',pending:'ยังไม่มีงบ',incomplete:'ข้อมูลต้นทุนไม่ครบ',even:'เท่าทุน',profit:'กำไร',loss:'ขาดทุน'}[status];
 return {records,totals,fields,status,label,source:data.source,costTotals:Object.fromEntries(fields.map(k=>[k,sum(r=>Object.hasOwn(r.costs||{},k)?costValue(k,r.costs[k]):0)]))};
}
export function eventPnlBadge(item,year,data){const p=eventPnl(item,year,data);return `<span class="event-pnl-status ${p.status}">${e(p.label)}</span>${valid(p.totals.profit)&&['profit','loss','even'].includes(p.status)?`<small>${money(p.totals.profit)}</small>`:''}`;}
export function eventPnlDetail(item,year,data){
 const p=eventPnl(item,year,data),t=p.totals;
 const rows=[['ยอดขายก่อนส่วนลด',t.gross],['หัก ส่วนลด',t.discount],['ยอดขายสุทธิ',t.net],['หัก ต้นทุนสินค้า',t.cogs],['กำไรขั้นต้น',t.grossProfit],...p.fields.map(k=>['หัก '+costs[k],p.costTotals[k]]),['รวมค่าใช้จ่ายดำเนินงาน',t.opex],['กำไร / ขาดทุน',t.profit]];
 return `<section class="event-pnl-detail"><p class="event-eyebrow">งบกำไร–ขาดทุน Event · ${Number(year)+543}</p><h2>${e(item.name)}</h2>${eventPnlBadge(item,year,data)}<p>${e(item.range?item.range.start+' – '+item.range.end:'รอยืนยันวันจัดงาน')}</p>${p.status==='ambiguous'?'<p>พบรายการซ้ำในเดือนและช่องทางเดียวกัน ต้องตรวจสอบก่อนสรุปงบ</p>':`<div class="table-wrap" tabindex="0"><table><thead><tr><th>รายการ</th><th>จำนวนเงิน</th></tr></thead><tbody>${rows.map(([label,value])=>`<tr><th scope="row">${e(label)}</th><td>${money(value)}</td></tr>`).join('')}</tbody></table></div>`}<p class="help">${p.records.length?'คำนวณจากยอดขายสุทธิและต้นทุนในงบ Event · รวมรายการที่บันทึกของงานนี้ในปีที่เลือก':'ยังไม่มีงบที่จับคู่กับงานนี้ได้'} · ค่าห้างหัก การตลาด และค่าใช้จ่ายอื่นที่ว่างคิดเป็น 0 · ต้นทุนรายการอื่นที่ว่างยังถือว่าข้อมูลไม่ครบ</p><p class="help">ยอดขายในงบอาจต่างจาก Sales Report · งบเบื้องต้นก่อนค่าใช้จ่ายส่วนกลางและภาษีเงินได้</p>${p.source?`<p class="help">แหล่งข้อมูล: ${e(p.source.file||'สรุปต้นทุนห้าง')}${p.source.fetched_at?' · ข้อมูล ณ '+e(p.source.fetched_at):''}${p.source.status==='stale'?' · ใช้ข้อมูลที่บันทึกล่าสุด':''}</p>`:''}${p.status==='unavailable'?'<p>ยังโหลดงบไม่ได้ กรุณาลองอีกครั้ง</p>':''}</section>`;
}
