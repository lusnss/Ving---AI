import {stockGridIdentity} from './stock-grid.mjs';
import {stockBranchType} from './stock-filters.mjs';
export {completeForecastMonth} from './stock-history.mjs';
// Calendar months, counting a partial month in proportion to its calendar days.
export function forecastMonthSpan(start,end){
 if(!start||!end)return 0;
 const from=new Date(start+'T00:00:00Z'),to=new Date(end+'T00:00:00Z');
 if(!Number.isFinite(+from)||!Number.isFinite(+to)||from>to)return 0;
 let sum=0,cursor=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),1));
 while(cursor<=to){const next=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1)),days=(next-cursor)/86400000,first=Math.max(+cursor,+from),last=Math.min(+next,+to+86400000);sum+=(last-first)/86400000/days;cursor=next;}
 return sum;
}
export function buildForecastRows(manifest,history,stocks,{allowPartial=false,horizon=14,multiplier=1}={}){
 const {period}=manifest,allMonths=period.months.map(m=>history[m]),loaded=allMonths.every(Boolean),sourceMonths=allMonths.filter(m=>m?.total>0).length,hasSixMonths=loaded&&sourceMonths===6;
 const sales=new Map(),branchStart=new Map(),skuCatalog=new Map(manifest.products.map(p=>[p.sku,p]));
 for(const month of allMonths)if(month)for(const sale of month.rows){const key=sale.branchId+'\0'+sale.sku;if(!sales.has(key))sales.set(key,{branchId:sale.branchId,sku:sale.sku,monthly:Object.fromEntries(period.months.map(m=>[m,0])),first:sale.date,last:sale.date});const s=sales.get(key);s.monthly[month.month]+=sale.qty;s.first=s.first<sale.date?s.first:sale.date;s.last=s.last>sale.date?s.last:sale.date;if(!branchStart.has(sale.branchId)||branchStart.get(sale.branchId)>sale.date)branchStart.set(sale.branchId,sale.date);if(!skuCatalog.has(sale.sku))skuCatalog.set(sale.sku,sale);}
 const output=[];
 for(const branch of manifest.branches){const balance=stocks[branch.id];if(!balance)continue;const inventory=new Map(balance.rows.map(r=>[r.sku,r]));const skus=new Set([...inventory.keys(),...[...sales.values()].filter(s=>s.branchId===branch.id).map(s=>s.sku)]);
  for(const sku of skus){const stock=inventory.get(sku),sale=sales.get(branch.id+'\0'+sku),monthly=period.months.map(m=>sale?.monthly[m]||0),sold=monthly.reduce((a,b)=>a+b,0),identity=stockGridIdentity({...skuCatalog.get(sku),...stock,sku});
   const partialStart=branchStart.get(branch.id)?new Date(Date.parse(branchStart.get(branch.id))+7*3600000).toISOString().slice(0,10):null;
   const days=hasSixMonths?period.days:partialStart?Math.max(1,Math.round((Date.parse(period.end)-Date.parse(partialStart))/86400000)+1):0;
   const normal=stock?.normal??0,hold=stock?.hold??0,eligible=loaded&&(hasSixMonths||allowPartial)&&sold>0&&days>0&&normal>=0;
   const historyMonths=forecastMonthSpan(hasSixMonths?period.start:partialStart,period.end),monthlyAverage=loaded&&(hasSixMonths||allowPartial)&&historyMonths>0?sold/historyMonths:null;
   const daily=eligible?sold/days*multiplier:null,cover=daily?normal/daily:null,needed=daily?Math.max(0,Math.ceil(daily*horizon-normal)):null;
   const rateMonthly=daily===null?null:monthlyAverage*multiplier;
   const status=normal<0?'check':normal===0&&sold>0&&loaded?'out':!eligible?'unknown':cover<=7?'critical':cover<=horizon?'risk':'covered';
   output.push({key:branch.id+'|'+sku,branchId:branch.id,branchName:branch.name,branchType:stockBranchType(branch),sku,barcode:stock?.barcode||skuCatalog.get(sku)?.barcode||'',model:identity.section,color:identity.rowName.slice(identity.section.length+3),size:identity.size,grade:identity.grade,soh:normal+hold,normal,hold,sold,monthly,historyMonths,monthlyAverage,rateMonthly,monthsWithSales:monthly.filter(n=>n>0).length,daily,cover,needed,status,partial:!hasSixMonths,historyStart:hasSixMonths?period.start:partialStart,historyEnd:period.end,days,firstSale:sale?.first||null,lastSale:sale?.last||null,updatedAt:stock?.updatedAt||null,missingBalance:!stock,stockoutDate:cover===null?null:new Date(Date.parse(period.asOf+'T00:00:00Z')+Math.ceil(cover)*86400000).toISOString().slice(0,10)});
  }
 }
 return {rows:output,sourceMonths,hasSixMonths,historyComplete:loaded,failedBranches:manifest.branches.filter(b=>!stocks[b.id]).map(b=>b.id)};
}
export function filterForecastRows(rows,{type='all',branch='',grade='all',query='',risk='all'}={}){const q=query.trim().toLowerCase().replace(/[ _-]/g,'');return rows.filter(r=>(type==='all'||r.branchType===type)&&(!branch||r.branchId===branch)&&(grade==='all'||r.grade===grade)&&(risk==='all'||risk==='urgent'&&['out','critical','risk'].includes(r.status)||risk==='unknown'&&['unknown','check'].includes(r.status)||risk===r.status)&&(!q||[r.sku,r.model,r.color,r.barcode].some(v=>String(v).toLowerCase().replace(/[ _-]/g,'').includes(q))));}
export function forecastSummary(rows){return {skus:rows.length,branches:new Set(rows.map(r=>r.branchId)).size,urgent:rows.filter(r=>['out','critical','risk'].includes(r.status)).length,out:rows.filter(r=>r.status==='out').length,unknown:rows.filter(r=>['unknown','check'].includes(r.status)).length,needed:rows.reduce((sum,r)=>sum+(r.needed||0),0),normal:rows.reduce((sum,r)=>sum+r.normal,0),soh:rows.reduce((sum,r)=>sum+r.soh,0)};}
