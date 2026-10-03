// Shared, pure calculations. Money rounds per unit before multiplying.
export const activityStates={draft:'ร่างกิจกรรม',pending:'รออนุมัติ',planned:'อนุมัติ / จัดสรรแล้ว',rejected:'ไม่อนุมัติ',completed:'แจกแล้ว',cancelled:'ยกเลิก'};
export const cents=n=>Math.round((Number(n)+Number.EPSILON)*100);
export const baht=n=>n/100;
export function couponCost(c){
 const missing=c.kind==='percent'&&!(Number(c.cap)>0);
 const per=missing?null:c.kind==='percent'?cents(c.cap):Math.min(cents(c.value||0),c.cap>0?cents(c.cap):Infinity);
 const maximum=per===null?null:baht(Math.max(0,per)*Math.max(0,Number(c.uses)||0));
 return {per:per===null?null:baht(per),maximum,expected:maximum,missing};
}
export function couponForecast(c){
 if(!(Number(c.minSpend)>0)||couponCost(c).missing)return null;
 const basket=cents(c.minSpend),uses=Math.max(0,Number(c.uses)||0);
 const raw=c.kind==='percent'?Math.round(basket*Number(c.value)/100):cents(c.value);
 const discount=Math.max(0,Math.min(basket,raw,c.cap>0?cents(c.cap):Infinity));
 const gross=basket*uses,discountTotal=discount*uses,net=gross-discountTotal,cogs=Math.round(basket*.22)*uses;
 return {perGross:baht(basket),perDiscount:baht(discount),perNet:baht(basket-discount),gross:baht(gross),discount:baht(discountTotal),net:baht(net),cogs:baht(cogs),profit:baht(net-cogs)};
}
export function activityForecast(a){
 const rows=(a.coupons||[]).map(couponForecast),totals=activityTotals(a);
 if(!rows.length||rows.some(r=>!r))return null;
 const sum=key=>baht(rows.reduce((s,r)=>s+cents(r[key]),0));
 const gross=sum('gross'),discount=sum('discount'),net=sum('net'),cogs=sum('cogs');
 const cashCost=baht(cents(cogs)+cents(totals.gift)+cents(totals.extra));
 return {gross,discount,net,cogs,gift:totals.gift,extra:totals.extra,totalCost:totals.missing?null:baht(cents(discount)+cents(cashCost)),cashCost:totals.missing?null:cashCost,profit:totals.missing?null:baht(cents(net)-cents(cashCost))};
}
export function activityTotals(a){let gift=0,missing=0;for(const i of a.items||[]){if(i.unitCost==null)missing++;else gift+=cents(i.unitCost)*i.qty;}const discounts=(a.coupons||[]).map(couponCost);const discount=discounts.reduce((n,c)=>n+cents(c.expected),0),maximum=discounts.reduce((n,c)=>n+cents(c.maximum),0);return {qty:(a.items||[]).reduce((n,i)=>n+i.qty,0),gift:baht(gift),discount:baht(discount),maximum:baht(maximum),extra:Number(a.extra||0),total:baht(gift+discount+cents(a.extra||0)),worst:baht(gift+maximum+cents(a.extra||0)),missing,missingCoupons:discounts.filter(c=>c.missing).length};}
export function activityRewards(a,inventory=[]){
 const prices=new Map(inventory.map(p=>[p.id,p]));
 const rows=(a.items||[]).map(item=>{
  const product=prices.get(item.inventoryId),price=product?.fullPrice;
  const fullPrice=Number.isFinite(price)&&price>=0?price:null;
  return {...item,fullPrice,priceReference:product?.priceReference,rewardValue:fullPrice==null?null:baht(cents(fullPrice)*item.qty)};
 });
 const products=rows.reduce((sum,i)=>sum+i.qty,0),couponUses=(a.coupons||[]).reduce((sum,c)=>sum+Math.max(0,Number(c.uses)||0),0);
 const discounts=(a.coupons||[]).map(couponCost),missingPrices=rows.filter(i=>i.fullPrice==null).length,missingCoupons=discounts.filter(c=>c.missing).length;
 const productValue=baht(rows.reduce((sum,i)=>sum+cents(i.rewardValue??0),0)),discountValue=baht(discounts.reduce((sum,c)=>sum+cents(c.maximum??0),0));
 return {count:products+couponUses,products,couponUses,rows,missingPrices,missingCoupons,productValue,discountValue,value:baht(cents(productValue)+cents(discountValue))};
}
export function allocation(items,exceptId=''){const map=new Map();for(const a of items){if(a.id===exceptId||!['planned','completed'].includes(a.status)||a.stockSettled)continue;for(const i of a.items)map.set(i.inventoryId,(map.get(i.inventoryId)||0)+i.qty);}return map;}
const costKey=v=>String(v||'').trim().toUpperCase().replace(/[\s_-]+/g,'');
const costGrade=v=>{const grade=String(v||'').trim().toUpperCase().replace(/^GRADE\s*/,'');return grade==='BB'?'B+':grade;};
const ungrade=v=>String(v).replace(/_(BB|B\+|A|B|C|D)$/i,'');
export function activityProductIdentity(product){
 const sku=String(product.sku||'').replace(/^VING-/i,''),[base,size='']=sku.split('#'),model=base.split('-')[0]||String(product.model||'');
 const suffix=/(?:_|\bGrade\s*)(BB|B\+|A|B|C|D)$/i.exec(model)?.[1]?.toUpperCase();
 const named=/\bGrade\s*(B\+|A|B|C|D)(?=$|[\s_-])/i.exec(product.name||'')?.[1]?.toUpperCase();
 const explicit=costGrade(product.grade);
 const grade=explicit||((suffix==='BB'?'B+':suffix)||named)||(/\b(?:sandals|shoes)\b/i.test(product.name||'')?'A':'');
 const color=base.includes('-')?base.slice(base.indexOf('-')+1):'';
 return {model:ungrade(model),grade,color,size};
}
function exactCostCandidates(product,costs,matchGrade){
 const identity=activityProductIdentity(product),sku=String(product.sku||''),name=String(product.name||'').replace(/^VING-/i,'');
 const models=new Set([costKey(identity.model),costKey(ungrade(name.split('-')[0]))]);
 return costs.filter(c=>{
  const grade=costGrade(c.grade);if(grade!==matchGrade)return false;
  if(String(c.model).includes('#'))return costKey(c.model)===costKey(sku);
  return String(c.model).split(/\s+\/\s+/).some(alias=>{const [model,size]=alias.split(/\s*:\s*/);return models.has(costKey(ungrade(model)))&&(!size||costKey(size)===costKey(identity.size));});
 });
}
const higherCostGrade={D:'C',C:'B',B:'B+','B+':'A'};
export function activityCostMatch(product,costs){const grade=activityProductIdentity(product).grade,exact=exactCostCandidates(product,costs,grade);if(exact.length)return {items:exact,productGrade:grade,costGrade:grade,fallback:false};const higher=higherCostGrade[grade],items=higher?exactCostCandidates(product,costs,higher):[];return {items,productGrade:grade,costGrade:items.length?higher:grade,fallback:items.length>0};}
export function costCandidates(product,costs){return activityCostMatch(product,costs).items;}
// Match the Product Costs tab's review status. A warehouse-only total is not a complete product cost.
export function activityCostReady(row){return !!row&&!row.note&&Number.isFinite(row.beforeVat)&&row.beforeVat>0&&Number.isFinite(row.includingVat)&&row.includingVat>=0;}
export function automaticActivityCost(product,costs){const matches=costCandidates(product,costs);if(!matches.length||matches.some(c=>!activityCostReady(c)))return null;return new Set(matches.map(c=>cents(c.includingVat))).size===1?matches[0]:null;}
// Keep an exact source reference even while its cost is awaiting an update.
export function activityCostReference(product,costs,selectedRow=null){const matches=costCandidates(product,costs);return automaticActivityCost(product,costs)||matches.find(c=>c.sourceRow===selectedRow)||(matches.length===1?matches[0]:null);}
export const activityProductTypes={SHOES:'รองเท้า',SOCKS:'ถุงเท้า',Apparel:'เสื้อ / เครื่องแต่งกาย',ACC:'อุปกรณ์',other:'อื่น ๆ / ไม่ระบุ'};
export function activityProductType(product,costs=[]){
 if(activityProductTypes[product.category])return product.category;
 const types=[...new Set(costCandidates(product,costs).map(c=>c.type).filter(t=>activityProductTypes[t]))];
 if(types.length===1)return types[0];
 const sourceType={sandals:'SHOES',sneakers:'SHOES',shoes:'SHOES',socks:'SOCKS',apparel:'Apparel',accessories:'ACC'}[String(product.productType||'').toLowerCase()];
 if(sourceType)return sourceType;
 const name=(String(product.sku||'')+' '+String(product.name||'')).replace(/[_-]/g,' ');
 if(/\b(?:socks?|ถุงเท้า)\b/i.test(name))return 'SOCKS';
 if(/\b(?:shirts?|shorts?|apparel|pants|เสื้อ|กางเกง)\b/i.test(name))return 'Apparel';
 if(/\b(?:sandals?|shoes?)\b/i.test(name))return 'SHOES';
 if(/\b(?:bags?|zipbag|caps?|chair|flexstraps|accessor(?:y|ies)|accesory|clean solution)\b/i.test(name))return 'ACC';
 return 'other';
}
export function activityBranches(snapshot){const map=new Map();for(const [month,report]of Object.entries(snapshot?.data?.['/api/daily-sales']?.periods||{}).sort(([a],[b])=>a.localeCompare(b)))for(const b of report.branches||[]){if(!b.branch)continue;const type=String(b.type||'ไม่ระบุประเภท'),id=b.branch_code?String(b.branch_code):type+':'+b.branch;map.set(id,{id,name:b.branch,type});}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'th'));}
export function filterActivities(items,f){return items.filter(a=>(!f.month||a.month===f.month)&&(!f.branchId||a.branchId===f.branchId)&&(!f.type||a.type===f.type)&&(!f.status||a.status===f.status)&&(!f.q||a.name.toLowerCase().includes(f.q.toLowerCase())));}
export function monthlyActivities(items,year){return Array.from({length:12},(_,i)=>{const month=year+'-'+String(i+1).padStart(2,'0'),rows=items.filter(a=>a.month===month&&!['cancelled','rejected'].includes(a.status));const totals=rows.map(activityTotals);return {month,count:rows.length,qty:totals.reduce((s,t)=>s+t.qty,0),gift:baht(totals.reduce((s,t)=>s+cents(t.gift),0)),discount:baht(totals.reduce((s,t)=>s+cents(t.discount),0)),total:baht(totals.reduce((s,t)=>s+cents(t.total),0)),missing:totals.reduce((s,t)=>s+t.missing+t.missingCoupons,0)};});}
export function activitiesCsv(rows){const csvCell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\uFEFF'+[['กิจกรรม','เดือน','สาขา','ประเภทร้าน','สถานะ','จำนวนสินค้า','ต้นทุนสินค้า','งบส่วนลดใช้ครบ','ส่วนลดสูงสุด','ค่าใช้จ่ายอื่น','งบรวมใช้ครบ','ข้อมูลยังไม่ครบ'],...rows.map(a=>{const t=activityTotals(a);return [a.name,a.month,a.branchName||'ทุกสาขาตามประเภท',a.type||'ทุกประเภท',activityStates[a.status],t.qty,t.gift,t.discount,t.maximum,t.extra,t.total,t.missing+t.missingCoupons];})].map(r=>r.map(csvCell).join(',')).join('\r\n');}
