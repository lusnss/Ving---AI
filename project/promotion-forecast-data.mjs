import {completeForecastMonth} from './out/assets/stock-history.mjs';
import {buildForecastRows} from './out/assets/stock-forecast-model.mjs';
import {summaryIdentity} from './out/assets/stock-summary-model.mjs';
import {promotionIdentityKey} from './out/assets/promotion-model.mjs';
export async function readPromotionHistory(env,period,now=Date.now()){
 const history={},failedMonths=[];
 await Promise.all(period.months.map(async month=>{try{const chunks=[];let page=1,count=0;do{if(++count>100)throw Error('Too many history pages');const object=await env.BUCKET?.get('stock-forecast/v1/history/'+month+'/'+page+'.json');if(!object)throw Error('History not loaded');const chunk=await object.json();if(!Number.isFinite(Date.parse(chunk.fetchedAt))||now-Date.parse(chunk.fetchedAt)>6*3600000)throw Error('History expired');chunks.push(chunk);page=chunk.nextPage;}while(page);history[month]=completeForecastMonth(chunks,month);}catch{failedMonths.push(month);}}));
 return {history,failedMonths,period};
}
export function applyPromotionHistory(rows,manifest,loaded,branchIds){
 const selected=manifest.branches.filter(b=>branchIds.includes(b.id)),stocks=Object.fromEntries(selected.map(b=>[b.id,{rows:[]}])) ,history=loaded?.history||{};
 const forecast=buildForecastRows({...manifest,branches:selected,products:manifest.products||[]},history,stocks,{allowPartial:true,horizon:14,multiplier:1});
 const rates=new Map();for(const r of forecast.rows){const key=promotionIdentityKey(summaryIdentity({...r,grade:({normal:'A',grade_b_plus:'B+',grade_b:'B'})[r.grade]||r.grade}));if(!rates.has(key))rates.set(key,{sold:0,daily:0,known:true,partial:false});const rate=rates.get(key);rate.sold+=r.sold;rate.daily+=r.daily||0;rate.known&&=r.daily!==null;rate.partial||=r.partial;}
 const quantities=new Map();for(const row of rows){const key=promotionIdentityKey(row);quantities.set(key,(quantities.get(key)||0)+row.available);}
 for(const row of rows){const key=promotionIdentityKey(row),rate=rates.get(key),zeroKnown=forecast.hasSixMonths&&selected.length>0,known=rate?rate.known:zeroKnown,share=quantities.get(key)>0?row.available/quantities.get(key):0;row.daily=known?(rate?.daily||0)*share:null;row.sold=known?(rate?.sold||0)*share:null;row.historyKnown=known;row.partial=rate?.partial||!forecast.hasSixMonths;}
 return {period:manifest.period,complete:forecast.historyComplete,fullSixMonths:forecast.hasSixMonths,sourceMonths:forecast.sourceMonths,failedMonths:loaded?.failedMonths||manifest.period.months,source:'คาดการณ์สินค้าขาด',basis:'พร้อมขาย ÷ อัตราขายต่อวัน · ตัวจำลอง 100%',fetchedAt:Object.values(history).map(h=>h.fetchedAt).sort()[0]||null};
}
