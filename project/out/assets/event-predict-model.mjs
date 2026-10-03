import { eventDateRange } from './event-forecast.mjs';
import {compensationContext,estimateCompensation,compensationSalesTarget} from './event-compensation.mjs';

const aliases = [
 ['pim','PIM Convention Hall',/pim\s*convention|ปัญญาภิวัฒน์/i],
 ['government-chaeng','ศูนย์ราชการ แจ้งวัฒนะ',/ศูนย์ราชการ.*แจ้งวัฒนะ/i],
 ['tm-korat','เดอะมอลล์ โคราช',/(?:เดอะมอลล์|the\s*mall|\bTM\b).*โคราช/i],
 ['tm-ngam','เดอะมอลล์ งามวงศ์วาน',/งามวงศ์วาน/i],
 ['tm-bangkhae','เดอะมอลล์ บางแค',/บางแค/i],
 ['chaeng','เซ็นทรัล แจ้งวัฒนะ',/แจ้งวัฒนะ/i],
 ['chonburi','โรบินสัน ชลบุรี',/ชลบุรี/i],
 ['ayutthaya','โรบินสัน อยุธยา 2',/อยุธยา\s*2|RBS\s*AU/i],
 ['ubon','โรบินสัน อุบลราชธานี',/อุบลราชธานี/i],
 ['phitsanulok','โรบินสัน พิษณุโลก',/พิษณุโลก/i],
 ['ctw','Central World',/central\s*wor?ld|เซ็นทรัล\s*เวิลด์|\bCTW\b/i],
 ['iconsiam','ICONSIAM',/iconsiam|ไอคอนสยาม/i],
 ['paragon','Siam Paragon',/paragon|พารากอน/i],
 ['ladprao','เซ็นทรัล ลาดพร้าว',/ladprao|ลาดพร้าว/i],
 ['hatyai','Central Festival Hatyai',/hatyai|หาดใหญ่/i],
 ['khonkaen','Central Khon Kaen',/khon\s*kaen|ขอนแก่น/i],
 ['rama2','เซ็นทรัล พระราม 2',/rama\s*2|พระราม\s*2/i],
 ['surat','โรบินสัน สุราษฎร์ธานี',/สุราษ/i],
 ['korat','เซ็นทรัล โคราช',/โคราช|นครราชสีมา/i],
 ['robinson-cm','โรบินสัน เชียงใหม่',/RBS\s*CM|(?:RBS|โรบินสัน).*เชียงใหม่|CM\s*\(เชียงใหม่/i],
 ['chanthaburi','โรบินสัน จันทบุรี',/จันทบุรี/i],
 ['rangsit','เซ็นทรัล รังสิต',/รังสิต/i],
 ['udon','เซ็นทรัล อุดรธานี',/udon|อุดร/i],
 ['terminal-asok','Terminal21 Asok',/terminal\s*(?:21)?\s*asok|เทอมินอลอโศก/i],
 ['terminal-rama3','Terminal21 Rama 3',/terminal\s*(?:21)?\s*rama\s*3/i],
 ['terminal-pattaya','Terminal21 Pattaya',/terminal\s*(?:21)?\s*pattaya|เทอมินอลพัทยา/i],
 ['mega','เมกาบางนา',/mega\s*bangna|เมกา\s*บางนา/i],
 ['pinklao','เซ็นทรัล ปิ่นเกล้า',/pinklao|ปิ่นเกล้า/i],
 ['eastville','เซ็นทรัล อีสต์วิลล์',/east\s*ville|อีสต์วิลล์|อีสวิลล์/i],
 ['festival-cm','Central Festival Chiangmai',/festival\s*(?:chiang\s*mai|เชียงใหม่)|เฟสติวัลเชียงใหม่/i],
 ['westgate','เซ็นทรัล เวสต์เกต',/westgate|เวส[ตท์]*เกต/i],
 ['bangna','เซ็นทรัล บางนา',/CDS\s*Bangna|เซ็นทรัล\s*บางนา/i],
 ['fashion','Fashion Island',/fashion|แฟชั่น/i],
 ['future','Future Park',/future\s*park|ฟิวเจอร์/i],
 ['field','สนามเทพหัสดิน',/สนามเทพ|เทพหัสดิน/i],
 ['street','The Street รัชดา',/the\s*street|สตรีทรัชดา/i],
 ['life','Life Center',/life\s*center/i],
 ['paradise','ตลาดเสรี พาราไดซ์',/ตลาดเสรี|พาราไดซ์/i],
 ['outlet','Outlet Mall พัทยา',/เอาท์เล็ทมอลล์พัทยา/i],
 ['sun','Sun Tower',/sun\s*tower/i],
 ['bangkapi','เดอะมอลล์ บางกะปิ',/บางกะปิ/i],
 ['true','True Digital Park',/true\s*digital/i],
 ['sinsathorn','ตึกสินสาทร',/สินสาทร/i],
 ['pim','PIM Convention Hall',/pim\s*convention/i],
 ['chamchuri','จามจุรี',/จามจุรี/i],
 ['samyan','สามย่านมิตรทาวน์',/สามย่านมิตรทาวน์/i],
 ['promenade','Promenade',/promenade/i],
 ['crystal','The Crystal Park',/crystal|crstral|คริสตัล/i],
 ['mrt','MRT Metro Mall จตุจักร',/mrt.*จตุจักร/i],
 ['seacon','Seacon Square',/seacon/i],
 ['bitec','ไบเทค บางนา',/ไบเทค|bitec/i],
 ['impact','IMPACT เมืองทองธานี',/อิมแพค|อิมแพ็ค|impact|เมืองทอง/i]
];
export const numeric = v => v===null||v===undefined||String(v).trim()==='' ? null : Number.isFinite(Number(String(v).replaceAll(',',''))) ? Number(String(v).replaceAll(',','')) : null;
export const median = values => {const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return a.length ? (a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2 : null;};
export function predictRange(text,year=2026){
 let normalized=String(text||'').replace(/[–—]/g,'-').replace(/\.{2,}/g,'.');
 for(const [rx,value] of [[/ม\.?ค\.?/g,'ม.ค.'],[/ก\.?พ\.?/g,'ก.พ.'],[/มี\.?ค\.?/g,'มี.ค.'],[/เม\.?ย\.?/g,'เม.ย.'],[/พ\.?ค\.?/g,'พ.ค.'],[/มิ\.?ย\.?/g,'มิ.ย.'],[/ก\.?ค\.?/g,'ก.ค.'],[/ส\.?ค\.?/g,'ส.ค.'],[/ก\.?ย\.?/g,'ก.ย.'],[/ต\.?ค\.?/g,'ต.ค.'],[/พ\.?ย\.?/g,'พ.ย.'],[/ธ\.?ค\.?/g,'ธ.ค.']])normalized=normalized.replace(rx,value);
 normalized=normalized.replace(/(\d)\s*-\s*(?=[ก-๙]+\.)/g,'$1 ').replace(/\.{2,}/g,'.');
 const thai=[...normalized.matchAll(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/g)];
 if(thai.length===1){const a=thai[0],before=normalized.slice(0,a.index),after=normalized.slice(a.index+a[0].length);if(/\d[^()]*-\s*$/.test(before)&&!/(\d{1,2})\s*-\s*$/.test(before)||/^\s*\d{2,4}\s*-\s*\d/.test(after))return null;}
 const range=eventDateRange(normalized,year);
 const startYear=Number(range?.start.slice(0,4)),endYear=Number(range?.end.slice(0,4));
 return range&&startYear<=year&&endYear>=year&&startYear>=year-1&&endYear<=year+1?range:null;
}
export function identifyVenue(name) {const a=aliases.find(([,label,rx])=>label.toLowerCase()===String(name).trim().toLowerCase()||rx.test(name));if(a)return {id:a[0],label:a[1]};const label=String(name).split(/(?:\d{1,2}\s*[\/–-]|\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.))/)[0].replace(/\b(?:19|20|25)\d{2}\b/g,'').replace(/^(?:event|ลานโปร|อีเวนท์|อีเว้นท์|บูธ)\s*/i,'').replace(/\s*ชั้น.*$/,'').trim();return {id:label.toLowerCase().replace(/\s+/g,' '),label,unmapped:true};}
export function isBaanSuan(value){
 const text=typeof value==='object'&&value?`${value.name||''} ${value.originalName||''}`:String(value||'');
 return /บ้าน\s*(?:และ|เเละ|&)\s*สวน|baan\s*(?:lae|and|&)\s*suan/i.test(text);
}
export function identifyForecastVenue(value){
 return isBaanSuan(value)?{id:'baan-suan',label:'บ้านและสวน',special:true}:identifyVenue(typeof value==='object'?value.name:value);
}
export const baselineEventKey=row=>'event:'+encodeURIComponent(row.databaseKey||row.id);
export function baselineSelectionLabel(rows,value='all'){
 if(!value||value==='all')return rows.some(isBaanSuan)?'บ้านและสวน · รวมทุกครั้ง':'ค่าเฉลี่ยทั้งหมดของห้าง';
 if(typeof value!=='string')return 'รายการอ้างอิงไม่พร้อมใช้งาน';
 if(value.startsWith('event:')){const row=rows.find(r=>baselineEventKey(r)===value);return row?`${row.originalName||row.name} · ${row.range?.start||'รอยืนยันวัน'}`:'รายการอ้างอิงไม่พร้อมใช้งาน';}
 return baselineMonthLabel(value);
}
export function historyFor(records, venue, channel, today) {
 const rows=records.filter(r=>identifyForecastVenue(r).id===venue&&(!channel||r.channel===channel));
 const identity=r=>r.databaseKey||r.name;
 const counts=new Map();for(const r of rows)counts.set(identity(r),(counts.get(identity(r))||0)+1);
 return rows.map(r=>{const range=r.range||predictRange(r.name,r.year||2026);let reason=r.exclusion||'';
  if(reason){}
  else if(counts.get(identity(r))>1)reason='ชื่อซ้ำหลายแถว ต้องตรวจการแบ่งยอดก่อน';
  else if(!range)reason='วันเริ่ม–สิ้นสุดไม่ชัดเจน';
  else if(range.end>=today)reason='งานยังไม่สิ้นสุด';
  else if(!(r.days>0)||r.net===null||r.net<0)reason='รอยอดขายหรือจำนวนวัน';
  return {...r,venue:identifyVenue(r.name),range,reason,usable:!reason};
 });
}
export function defaultsFor(rows) {
 const valid=rows.filter(r=>r.usable), total=key=>valid.map(r=>r[key]);
 return {days:median(total('days')),cogs:median(valid.filter(r=>(r.costNet??r.net)>0&&r.cogs>0).map(r=>100*r.cogs/(r.costNet??r.net))),
  rent:median(total('space')),gp:median(valid.filter(r=>(r.costNet??r.net)>0&&r.space!=null).map(r=>100*r.space/(r.costNet??r.net))),
  pc:median(valid.filter(r=>r.pc!=null).map(r=>r.pc/(r.costDays||r.days))),shipping:median(total('shipping')),other:median(total('other'))};
}
const validBaselineMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function rowsForBaseline(rows,month='all') {
 if(!month||month==='all')return rows;
 if(typeof month!=='string')return [];
 if(month.startsWith('event:'))return rows.filter(r=>baselineEventKey(r)===month);
 return validBaselineMonth(month)?rows.filter(r=>r.range?.start?.slice(0,7)===month):[];
}
export function baselineMonthLabel(month) {
 if(!month||month==='all')return 'ค่าเฉลี่ยทั้งหมดของห้าง';
 if(!validBaselineMonth(month))return 'เดือนที่เลือกไม่ถูกต้อง';
 const names=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 return names[Number(month.slice(5))-1]+' '+(Number(month.slice(0,4))+543);
}
export function baselineFor(rows,month='all') {
 const valid=rowsForBaseline(rows,month).filter(r=>r.usable), days=valid.reduce((s,r)=>s+r.days,0),sales=valid.reduce((s,r)=>s+r.net,0);
 return {rate:days>0?sales/days:null,days,sales,observations:valid.length};
}
export function baselineMonths(rows) {
 const months=[...new Set(rows.map(r=>r.range?.start?.slice(0,7)).filter(m=>m&&validBaselineMonth(m)))].sort().reverse();
 return months.map(month=>{const selected=rowsForBaseline(rows,month),baseline=baselineFor(selected);return {month,...baseline,total:selected.length,excluded:selected.length-baseline.observations};});
}
export function historicalTarget(rows, channel) {
 const matches=rows.filter(r=>r.usable&&r.channel===channel&&r.target>0).sort((a,b)=>(b.range?.end||'').localeCompare(a.range?.end||'')||b.row-a.row);
 return matches[0]?{value:matches[0].target,row:matches[0].row,days:matches[0].days,channel}:null;
}
export function selectedDays(start, end) {
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(start)||!valid(end)||end<start)return null;
 const days=(Date.parse(end)-Date.parse(start))/86400000+1;
 return days<=366?days:null;
}
export const targetGoalsFor=input=>input.targetMode==='roi-pc'?['roi','pc']:['roi','pc'].includes(input.targetMode)?[input.targetMode]:[];
export const targetGoalLabel=input=>targetGoalsFor(input).map(goal=>goal==='roi'?'ROI '+(input.roiPercent??40)+'%':'ค่าแรง PC '+(input.pcPercent??13)+'%').join(' + ')||'ที่กำหนดเอง';
export function forecast(rows, input) {
 if(input.startDate||input.endDate)input={...input,days:selectedDays(input.startDate,input.endDate)};
 const compensation=compensationContext(input);
 if(compensation.active&&input.wageMode==='source'&&compensation.wage?.daily!=null)input={...input,pc:compensation.wage.daily,pcCostMode:'person'};
 const baseline={...baselineFor(rows,input.baselineMonth),month:input.baselineMonth||'all'},errors=[...compensation.errors];
 if(input.mode!=='manual'&&baseline.month!=='all'&&!baseline.observations)errors.push('baselineMonth');
 const read=(key,max=1e10)=>{const n=numeric(input[key]);if(n===null||n<0||n>max)errors.push(key);return n;};
 const days=read('days',366);if(days!==null&&(!Number.isInteger(days)||days<1))errors.push('days');
 if(!['direct','gp'].includes(input.channel))errors.push('channel');
 const cogs=read('cogs',100),pc=read('pc'),shipping=read('shipping'),other=read('other');
 const space=read(input.channel==='direct'?'rent':'gp',input.channel==='direct'?1e10:100);
 const area=numeric(input.area),pcCount=numeric(input.pcCount),perPerson=input.pcCostMode==='person';
 if(input.area!==undefined&&String(input.area).trim()!==''&&(area===null||area<=0||area>1e7))errors.push('area');
 if((perPerson||input.pcCount!==undefined&&String(input.pcCount).trim()!=='')&&(pcCount===null||!Number.isInteger(pcCount)||pcCount<0||pcCount>10000))errors.push('pcCount');
 if(input.pcCostMode&&!['total','person'].includes(input.pcCostMode))errors.push('pcCostMode');
 const pcDaily=perPerson?pc*pcCount:pc;
 const costReady=!errors.length, fixed=costReady?pcDaily*days+shipping+other+(input.channel==='direct'?space:0):null;
 const variable=costReady?(cogs+(input.channel==='gp'?space:0))/100:null;
 const roiPercent=numeric(input.roiPercent??40),pcPercent=numeric(input.pcPercent??13);
 const roiValid=roiPercent!==null&&roiPercent>=0&&roiPercent<=10000,pcValid=pcPercent!==null&&pcPercent>0&&pcPercent<=100;
 const targetGoals=targetGoalsFor(input);
 if(targetGoals.includes('roi')&&!roiValid)errors.push('roiPercent');
 if(targetGoals.includes('pc')&&!pcValid)errors.push('pcPercent');
 const factor=1+roiPercent/100,denominator=costReady&&roiValid?1-factor*variable:null;
 const roiTarget=costReady&&roiValid&&fixed>0&&denominator>0?(compensation.active?compensationSalesTarget(input,fixed,variable,'roi',5000):Math.ceil(factor*fixed/denominator/5000)*5000):null;
 const roiTargetStatus=!costReady||!roiValid?'missing':fixed===0?'no-fixed-cost':denominator<=0||roiTarget===null?'unreachable':'available';
 const pcReady=!errors.some(key=>['days','pc','pcCount','pcCostMode'].includes(key));
 const pcTarget=pcReady&&pcValid?(compensation.active?(costReady?compensationSalesTarget(input,fixed,variable,'pc',5000):null):Math.ceil(pcDaily*days*100/pcPercent/5000)*5000):null;
 const selectedTargets=targetGoals.map(goal=>goal==='roi'?roiTarget:pcTarget);
 const selectedTarget=selectedTargets.length&&selectedTargets.every(value=>value!==null)?compensation.active&&targetGoals.length===2?compensationSalesTarget(input,fixed,variable,'both',5000):Math.max(...selectedTargets):null;
 const costTarget=input.mode==='manual'&&input.salesMode==='cost-target';
 const target=targetGoals.length?selectedTarget:numeric(input.target);
 const targetValid=target!==null&&target>=0&&target<=1e10;
 const manual=input.mode==='manual';
 const sales=costTarget?(targetValid?target:null):manual?numeric(input.expectedSales):!errors.includes('days')&&baseline.rate!==null?baseline.rate*days:null;
 if(manual&&!costTarget&&(sales===null||sales<0||sales>1e10))errors.push('expectedSales');
 const downside=numeric(input.downside),upside=numeric(input.upside);
 if(downside===null||downside<0||downside>100)errors.push('downside');
 if(upside===null||upside<0||upside>500)errors.push('upside');
 const financials=(sales,label)=>{const incentive=estimateCompensation(sales,input),ready=costReady&&sales!==null&&Number.isFinite(sales)&&sales>=0;const costs=ready?fixed+variable*sales+incentive.total:null,profit=ready?sales-costs:null;return {label,sales,rate:sales!==null&&days>0?sales/days:null,costs,profit,roi:ready&&costs>0?profit/costs*100:null,cogs:ready?sales*cogs/100:null,space:ready?(input.channel==='direct'?space:sales*space/100):null,pc:ready?pcDaily*days:null,fixed,...(compensation.active?{commission:ready?incentive.commission:null,bonus:ready?incentive.bonus:null,incentive:ready?incentive.total:null,incentivePerPerson:ready?incentive.perPerson:null,staffTotal:ready?pcDaily*days+incentive.total:null}:{})};};
 const base=financials(!errors.includes('expectedSales')?sales:null,costTarget?'เป้ายอดขาย '+targetGoalLabel(input):'ตามคาดการณ์');
 const scenarios=[financials(base.sales!==null&&!errors.includes('downside')?base.sales*(1-downside/100):null,'ต่ำกว่าคาดการณ์'),base,financials(base.sales!==null&&!errors.includes('upside')?base.sales*(1+upside/100):null,'สูงกว่าคาดการณ์')];
 const breakEven=costReady?(compensation.active?compensationSalesTarget(input,fixed,variable,'break-even'):variable<1?fixed/(1-variable):variable===1&&fixed===0?0:null):null;
 return {baseline,scenarios,errors:[...new Set(errors)],observations:baseline.observations,base,target:targetValid?financials(target,'เป้าหมาย'):null,roiTarget,roiTargetStatus,pcTarget,targetGoals,costReady,breakEven,noBreakEven:costReady&&breakEven===null,fixedCosts:fixed,variableRate:variable,...(compensation.active?{compensation}:{})};
}

export const historySignature=rows=>JSON.stringify(rows.filter(r=>r.usable).map(r=>[r.id,r.net,r.days,r.range?.start,r.range?.end]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
