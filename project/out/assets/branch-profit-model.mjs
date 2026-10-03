export const GP_POLICY={vat:.07,pendingCostRate:.25,reviewGpRate:.22};
export function gpCalculate(row){
 const net=row.sales/1.07,reviewEstimate=row.status==='hold',hasCost=reviewEstimate||['actual','discount','estimate','zero'].includes(row.status),isEstimate=reviewEstimate||row.status==='estimate',cost=reviewEstimate?net*(1-GP_POLICY.reviewGpRate):row.status==='estimate'?net*GP_POLICY.pendingCostRate:row.status==='actual'?row.qty*row.unitCost:0;
 return {...row,reviewEstimate,net,covered:hasCost?net:0,cost:hasCost?cost:0,held:reviewEstimate||!hasCost?net:0,profit:hasCost?net-cost:0,pending:reviewEstimate||!hasCost?1:0,estimated:isEstimate?net:0,estimateCost:isEstimate?cost:0,estimateRows:isEstimate?1:0};
}
export function gpAggregate(rows){
 const out={net:0,covered:0,cost:0,held:0,profit:0,pending:0,estimated:0,estimateCost:0,estimateRows:0,qty:0,absolute:0,absoluteCovered:0};
 for(const raw of rows){const r=raw.net===undefined?gpCalculate(raw):raw;for(const k of ['net','covered','cost','held','profit','pending','estimated','estimateCost','estimateRows','qty'])out[k]+=r[k]||0;out.absolute+=Math.abs(r.net);out.absoluteCovered+=r.pending?0:Math.abs(r.net);}
 out.fullProfit=out.profit;Object.assign(out,gpRatios(out));out.coverage=out.absolute?out.absoluteCovered/out.absolute:1;out.actualCost=out.cost-out.estimateCost;return out;
}
export function gpRatios(row){const available=Math.abs(row.covered)>1e-8;return {gp:available?row.profit/row.covered:null,costRatio:available?row.cost/row.covered:null};}
export function gpSort(rows,key,direction='desc'){
 const field=key==='sales'?'net':key,sign=direction==='asc'?1:-1,missing=v=>v==null||(typeof v==='number'&&!Number.isFinite(v));
 return [...rows].sort((a,b)=>{const av=a[field],bv=b[field];if(missing(av)||missing(bv))return missing(av)===missing(bv)?0:missing(av)?1:-1;return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'th',{numeric:true}))*sign;});
}
export function gpBranches(rows){const groups=new Map();for(const r of rows){if(!groups.has(r.branch))groups.set(r.branch,[]);groups.get(r.branch).push(r);}return [...groups].map(([id,rs])=>({id,name:rs[0].branchName,type:rs[0].type,...gpAggregate(rs),rows:rs})).sort((a,b)=>b.net-a.net);}
export const gpStatus=b=>b.pending?'รอตรวจสอบ · ประมาณ GP 22%':b.estimateRows>0?'มีต้นทุนรออัพเดท':'ต้นทุนครบ';
export function gpExpandMonth(raw,productMap,branchMap){
 const heldGroups=new Set();for(const r of raw.rows)if(Math.abs(r[3])>100)heldGroups.add(r[1]+':'+r[2]);
 const rows=raw.rows.map(r=>{const [date,cid,pid,qty,gross,discount,sales,orders]=r,p=raw.products[pid]||{sku:'',product:'ไม่ระบุสินค้า'},key=p.sku||'ชื่อ: '+p.product,mapping=productMap[pid],c=mapping&&mapping.key===key?mapping:Object.values(productMap).find(x=>x.key===key),b=branchMap[cid],label=b?.display||raw.branches[cid]?.erp||'ไม่ระบุสาขา';let status=c?.status||'hold',note=c?.note||'พบสินค้าใหม่ ยังไม่มีการจับคู่ต้นทุน';
 if(heldGroups.has(cid+':'+pid)){status='hold';note='จำนวนสินค้าในเดือนนี้มีรายการเกิน 100 หน่วยต่อวันต่อ SKU หรือมีรายการปรับยอด รอตรวจสอบก่อนใช้ต้นทุน';}else if(!qty&&!sales)status='zero';
 return {period:raw.month,date,branch:String(cid),branchName:label,type:b?.type||'รอยืนยันประเภท',key,sku:p.sku,product:p.product,qty,gross,discount,sales,orders,unitCost:c?.unitCost??null,status,note,family:c?.family||'',branchMapped:!!b};});
 return {period:raw.month,updatedAt:raw.updatedAt,asOf:raw.asOf,granularity:'day',rows,orders:raw.totals.order_id};
}
export function gpDecode(payload){return {...payload,months:payload.rawMonths.map(m=>gpExpandMonth(m,payload.productMap,payload.branches))};}
