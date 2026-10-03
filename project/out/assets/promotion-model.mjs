// Editable proposal assumptions, never approved commercial terms.
export const promotionChannels={department:{label:'Department',family:'department',stock:'branch'},event_gp:{label:'Event หัก GP%',family:'department',stock:'branch'},standalone:{label:'Standalone',family:'fast',stock:'branch'},event_cash:{label:'Event เก็บเงินเอง',family:'fast',stock:'warehouse'}};
export const defaultPromotionPolicy={thresholds:[5,20,50],department:[5,10,15,25],fast:[10,20,30,40],doh:[14,30,60,120]};
export function validatePromotionPolicy(policy){
 if(!policy||!Array.isArray(policy.thresholds)||policy.thresholds.length!==3||policy.thresholds.some((n,i)=>!Number.isInteger(n)||n<1||n>100000||i>0&&n<=policy.thresholds[i-1]))throw Error('เกณฑ์สต็อกต้องเป็นจำนวนเต็มและเรียงจากน้อยไปมาก');
 for(const family of ['department','fast'])if(!Array.isArray(policy[family])||policy[family].length!==4||policy[family].some((n,i)=>!Number.isFinite(n)||n<0||n>100||i>0&&n<policy[family][i-1]))throw Error('ส่วนลดต้องเรียงจากน้อยไปมาก และอยู่ระหว่าง 0–100%');
 if(policy.fast.some((n,i)=>n<policy.department[i]))throw Error('กลุ่มรับเงินเองต้องลดไม่น้อยกว่ากลุ่ม Department ที่ระดับสต็อกเดียวกัน');
 const doh=policy.doh||defaultPromotionPolicy.doh;if(!Array.isArray(doh)||doh.length!==4||doh.some((n,i)=>!Number.isInteger(n)||n<1||n>3650||i>0&&n<=doh[i-1]))throw Error('เกณฑ์ DOH ต้องเป็นวันและเรียงจากน้อยไปมาก');
 return {...structuredClone(policy),doh:[...doh]};
}
export function promotionBranchFamily(branch){const id=String(branch.id||'').toUpperCase().replace(/[\s_-]/g,'');return /^STANDALONE\d+$/.test(id)?'fast':/^(RBS|CDS)\d+$/.test(id)?'department':null;}
export function stockTier(available,policy=defaultPromotionPolicy){if(!(available>0))return -1;return policy.thresholds.filter(n=>available>n).length;}
export function recommendedDiscount(item,channel,policy=defaultPromotionPolicy){
 const object=typeof item==='object',available=object?(item.stockPerSource??item.available):item,tier=stockTier(available,policy);if(tier<0)return 0;
 const rates=policy[promotionChannels[channel].family];let cap=tier;
 if(object){const days=policy.doh||defaultPromotionPolicy.doh;if(item.noSales)cap=tier;else if(!Number.isFinite(item.doh))cap=Math.min(tier,0);else if(item.doh<=days[0])return 0;else cap=Math.min(tier,item.doh<=days[1]?0:item.doh<=days[2]?1:item.doh<=days[3]?2:3);}
 return Math.min(100,rates[cap]);
}
export function promotionReason(row,policy=defaultPromotionPolicy){if(!(row.available>0))return 'ไม่มีสต็อกพร้อมขาย';if(row.noSales)return 'ไซซ์นี้ไม่พบยอดขายในช่วงย้อนหลังที่อ่านครบ';if(!Number.isFinite(row.doh))return 'DOH ยังไม่พอประเมิน · ใช้ส่วนลดระดับต่ำ';if(row.doh<=(policy.doh||defaultPromotionPolicy.doh)[0])return 'ใกล้ขาด · เก็บสต็อกไว้ ไม่เสนอส่วนลด';return 'ใช้ระดับสต็อกร่วมกับ DOH '+Math.round(row.doh)+' วัน';}
export const promotionIdentityKey=i=>[i.model,i.grade,i.color,i.size].map(v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[\s_-]+/g,'')).join('|');
export function promotionPricing(line){return line.pricingMode==='price'?{pricingMode:'price',salePrice:line.salePrice,discount:null}:{pricingMode:'discount',discount:line.discount,salePrice:null};}
export function promotionPricingError(line){
 if(line.pricingMode!==undefined&&!['price','discount'].includes(line.pricingMode))return 'รูปแบบราคาไม่ถูกต้อง';
 if(line.pricingMode==='price')return typeof line.salePrice==='number'&&Number.isFinite(line.salePrice)&&line.salePrice>=0.01&&Number.isSafeInteger(Math.round(line.salePrice*100))&&Math.abs(line.salePrice*100-Math.round(line.salePrice*100))<0.00001?'':'กรอกราคาขายมากกว่า 0 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง';
 return typeof line.discount==='number'&&Number.isFinite(line.discount)&&line.discount>=0&&line.discount<=100?'':'ส่วนลดต้องอยู่ระหว่าง 0–100%';
}
export function promotionDiscountPercent(line){const f=promotionUnitFinance(line);return line.pricingMode!=='price'?line.discount:f.price!==null&&f.after!==null?(f.price-f.after)/f.price*100:null;}
export function groupPromotionDiscounts(lines){
 const groups=new Map();
 for(const line of lines){
  const discount=Number(line.discount),name=line.model,key=line.pricingMode==='price'?'price:'+line.salePrice:discount;
  if(!groups.has(key))groups.set(key,new Map());
  const models=groups.get(key);
  if(!models.has(name))models.set(name,new Set());
  if(line.grade)models.get(name).add(line.grade);
 }
 return [...groups].sort(([a],[b])=>typeof a==='number'&&typeof b==='number'?a-b:typeof a==='number'?-1:typeof b==='number'?1:Number(a.slice(6))-Number(b.slice(6))).map(([key,models])=>({
  ...(typeof key==='number'?{discount:key}:{pricingMode:'price',salePrice:Number(key.slice(6)),discount:null}),
  models:[...models].sort(([a],[b])=>a.localeCompare(b,'th',{numeric:true})).map(([name,grades])=>({name,grades:[...grades].sort()}))
 }));
}
export function groupPromotionModels(rows){
 const established=new Set(rows.filter(r=>r.historyKnown&&r.sold>0).map(r=>[r.model,r.grade].join('\0')));
 const sizes=new Map();for(const r of rows){const key=[r.model,r.grade,r.size].join('\0');if(!sizes.has(key))sizes.set(key,[]);sizes.get(key).push(r);}
 const groups=new Map();for(const r of rows){const sameSize=sizes.get([r.model,r.grade,r.size].join('\0')),noSales=established.has([r.model,r.grade].join('\0'))&&sameSize.every(i=>i.historyKnown&&i.sold===0)&&sameSize.some(i=>i.available>0),kind=noSales?'no-sales':'model',key=JSON.stringify([r.model,r.grade,kind]);if(!groups.has(key))groups.set(key,{key,model:r.model,grade:r.grade,kind,noSales,members:[],available:0,hold:0});const g=groups.get(key);g.members.push(r);g.available+=r.available;g.hold+=r.hold||0;}
 return [...groups.values()].map(g=>{g.members.sort((a,b)=>a.key.localeCompare(b.key));const stocked=g.members.filter(r=>r.available>0),active=stocked.length?stocked:g.members;const price=active.filter(r=>Number.isFinite(r.fullPrice)&&r.fullPrice>0).map(r=>r.fullPrice),costs=active.filter(r=>Number.isFinite(r.unitCost)).map(r=>r.unitCost);const daily=active.every(r=>Number.isFinite(r.daily))?active.reduce((n,r)=>n+r.daily,0):null;return {...g,sizes:[...new Set(active.map(r=>r.size))].sort((a,b)=>a.localeCompare(b,'th',{numeric:true})),colors:[...new Set(active.map(r=>r.color))],sourceCount:Math.max(1,...active.map(r=>r.sourceCount||1)),branchName:active[0]?.branchName||'',stockPerSource:g.available/Math.max(1,...active.map(r=>r.sourceCount||1)),daily,doh:daily>0?g.available/daily:null,sold:active.every(r=>r.historyKnown)?active.reduce((n,r)=>n+r.sold,0):null,partial:active.some(r=>r.partial),fullPrice:price.length===active.length&&new Set(price).size===1?price[0]:null,priceMin:price.length?Math.min(...price):null,priceMax:price.length?Math.max(...price):null,priceMissing:price.length!==active.length,unitCost:costs.length===active.length&&new Set(costs).size===1?costs[0]:null,costMissing:costs.length!==active.length};});
}
export function allocatePromotionLine(line){
 if(!line.members)return [line];const candidates=line.members.filter(r=>r.available>0).slice().sort((a,b)=>a.key.localeCompare(b.key)),total=candidates.reduce((n,r)=>n+r.available,0);const qty=Math.min(total,Math.max(0,Math.floor(line.qty||0)));let cumulative=0;
 return candidates.map(r=>{const before=cumulative;cumulative+=r.available;return {...r,qty:Math.round(qty*cumulative/total)-Math.round(qty*before/total),...promotionPricing(line)};}).filter(r=>r.qty>0);
}
export function promotionUnitFinance(line,fee=null){
 const price=Number.isFinite(line.fullPrice)&&line.fullPrice>0?line.fullPrice:null,cost=Number.isFinite(line.unitCost)?line.unitCost:null,discount=Number(line.discount||0);
 const after=line.pricingMode==='price'?(promotionPricingError(line)?null:Math.round(line.salePrice*100)/100):price===null?null:(Math.round(price*100)-Math.round(price*discount))/100,profit=after!==null&&cost!==null?Math.round((after-cost)*100)/100:null,net=after!==null&&fee!==null?Math.round(after*(1-fee/100)*100)/100:null;
 return {price,cost,after,profit,gp:after>0&&profit!==null?profit/after*100:null,net,netProfit:net!==null&&cost!==null?Math.round((net-cost)*100)/100:null,netGp:net>0&&cost!==null?(net-cost)/net*100:null};
}
export function promotionTotals(lines,gp=null){let gross=0,discount=0,net=0,qty=0,missing=0,missingCost=0,missingFullPrice=0,cost=0,matchedNet=0,profit=0;
 for(const line of lines.flatMap(allocatePromotionLine)){qty+=line.qty;const f=promotionUnitFinance(line,gp);if(f.after===null){missing++;continue;}net+=Math.round(f.after*100)*line.qty;if(f.price===null)missingFullPrice++;else{gross+=Math.round(f.price*100)*line.qty;discount+=Math.round((f.price-f.after)*100)*line.qty;}if(f.cost===null){missingCost++;continue;}cost+=Math.round(f.cost*100)*line.qty;matchedNet+=Math.round(f.after*100)*line.qty;profit+=Math.round(f.profit*100)*line.qty;}
 const afterGp=gp===null?null:Math.round(net*(1-gp/100)),matchedAfterGp=gp===null?null:Math.round(matchedNet*(1-gp/100));return {qty,missing,missingCost,missingFullPrice,gross:missingFullPrice?null:gross/100,discount:missingFullPrice?null:discount/100,net:net/100,cost:cost/100,profit:matchedNet?profit/100:null,grossMargin:matchedNet?profit/matchedNet*100:null,afterGp:afterGp===null?null:afterGp/100,profitAfterGp:matchedAfterGp===null||!matchedNet?null:(matchedAfterGp-cost)/100,marginAfterGp:matchedAfterGp>0?(matchedAfterGp-cost)/matchedAfterGp*100:null};
}
