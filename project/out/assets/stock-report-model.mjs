import {stockGridIdentity} from './stock-grid.mjs';
import {stockBranchType} from './stock-filters.mjs';
export {completeForecastMonth as completeReportMonth} from './stock-forecast-model.mjs';
export const reportDay=iso=>new Date(Date.parse(iso)+7*3600000).toISOString().slice(0,10);
export function reportWindow(end,count,available){return available.filter(m=>m<=end).slice(0,count).reverse();}
export function reportRows(manifest,history){
 const branches=new Map(manifest.branches.map(b=>[b.id,b])),products=new Map(manifest.products.map(p=>[p.sku,p]));
 return Object.values(history).flatMap(h=>h.rows.map(r=>{const identity=stockGridIdentity({...products.get(r.sku),...r}),branch=branches.get(r.branchId)||{id:r.branchId,name:r.branchId};return {...r,month:h.month,day:reportDay(r.date),model:identity.section,color:identity.rowName.slice(identity.section.length+3),size:identity.size,grade:identity.grade,branchName:branch.name,branchType:stockBranchType(branch)};}));
}
export function filterReportRows(rows,{type='all',branch='',grade='all',query=''}={}){
 const q=query.trim().toLowerCase().replace(/[\s_-]/g,'');
 return rows.filter(r=>(type==='all'||r.branchType===type)&&(!branch||r.branchId===branch)&&(grade==='all'||r.grade===grade)&&(!q||[r.sku,r.model,r.color,r.size,r.barcode].some(v=>String(v||'').toLowerCase().replace(/[\s_-]/g,'').includes(q))));
}
export function reportGroupKey(r,group='model'){return JSON.stringify(group==='sku'?[r.sku]:group==='color'?[r.model,r.color]:[r.model]);}
export function reportRanking(rows,group='model'){
 const map=new Map();for(const r of rows){const key=reportGroupKey(r,group);if(!map.has(key))map.set(key,{key,label:group==='sku'?r.sku:group==='color'?r.model+' · '+r.color:r.model,model:r.model,qty:0,branches:new Set(),skus:new Set(),days:{},months:{}});const g=map.get(key);g.qty+=r.qty;g.branches.add(r.branchId);g.skus.add(r.sku);g.days[r.day]=(g.days[r.day]||0)+r.qty;g.months[r.month]=(g.months[r.month]||0)+r.qty;}
 const total=rows.reduce((s,r)=>s+r.qty,0);return [...map.values()].map(g=>({...g,branches:g.branches.size,skus:g.skus.size,share:total?g.qty/total:0,bestDay:Object.entries(g.days).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]})).sort((a,b)=>b.qty-a.qty||a.label.localeCompare(b.label,'th',{numeric:true}));
}
// Source calendar-month membership is retained so monthly totals reconcile to Check Stock.
// Local day buckets include any boundary date rather than silently dropping an item.
export function reportSeries(rows,{mode='day',month,months,history,asOf}){
 const keys=mode==='month'?[...months]:Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));
 const selected=rows.filter(r=>mode==='month'?months.includes(r.month):r.month===month);
 if(mode==='day')for(const r of selected)if(!keys.includes(r.day))keys.push(r.day);
 const sums=new Map();for(const r of selected){const key=mode==='month'?r.month:r.day;sums.set(key,(sums.get(key)||0)+r.qty);}
 return keys.sort().map(key=>({key,qty:mode==='day'&&key>asOf?null:history[mode==='month'?key:month]?.total>0?sums.get(key)||0:null}));
}
export function reportSummary(rows,series){const valid=series.filter(p=>p.qty!==null);return {qty:rows.reduce((s,r)=>s+r.qty,0),skus:new Set(rows.map(r=>r.sku)).size,branches:new Set(rows.map(r=>r.branchId)).size,average:valid.length?valid.reduce((s,r)=>s+r.qty,0)/valid.length:null,best:[...valid].sort((a,b)=>b.qty-a.qty||a.key.localeCompare(b.key))[0]||null};}
