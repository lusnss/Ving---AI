import {eventCompensationProfiles, eventCompensationVersion} from './event-compensation-data.mjs';

const compensationAliases = [
 ['pattaya-marathon','Pattaya Marathon',/pattaya\s*marathon|พัทยามาราธอน/i],
 ['bangsaen42','บางแสน 42',/บางแสน\s*42|bangsaen\s*42/i],
 ['bangsaen21','บางแสน 21',/บางแสน\s*21|bangsaen\s*21/i],
 ['chombueng','จอมบึงมาราธอน',/จอมบึง/i],
 ['buriram-marathon','บุรีรัมย์มาราธอน',/บุรีรัมย์/i],
 ['outdoor-fest','Outdoor Fest',/outdoor\s*fest/i],
 ['style-bangkok','Style Bangkok',/style\s*bangkok/i],
 ['government-chaeng','ศูนย์ราชการ แจ้งวัฒนะ',/ศูนย์ราชการ.*แจ้งวัฒนะ/i],
 ['robinson-samut','โรบินสัน สมุทรปราการ',/สมุทรปราการ/i],
 ['robinson-rama9','โรบินสัน พระราม 9',/(?:โรบินสัน|robinson).*?(?:พระราม\s*9|rama\s*9)/i],
 ['robinson-bangrak','โรบินสัน บางรัก',/บางรัก/i],
 ['robinson-chalong','โรบินสัน ฉลอง',/ฉลอง/i],
 ['tm-korat','เดอะมอลล์ โคราช',/(?:เดอะมอลล์|the\s*mall|\bTM\b).*โคราช/i],
 ['tm-ngam','เดอะมอลล์ งามวงศ์วาน',/งามวงศ์วาน/i],
 ['tm-bangkhae','เดอะมอลล์ บางแค',/บางแค/i],
 ['bangkapi','เดอะมอลล์ บางกะปิ',/บางกะปิ/i],
 ['terminal-rama3','Terminal21 Rama 3',/(?:terminal|เทอร์?มินอล|เทอมินอล).*?(?:พระราม\s*3|rama\s*3)/i],
 ['terminal-pattaya','Terminal21 Pattaya',/(?:terminal|เทอร์?มินอล|เทอมินอล).*?(?:pattaya|พัทยา)/i],
 ['terminal-asok','Terminal21 Asok',/(?:terminal|เทอร์?มินอล|เทอมินอล).*?(?:asok|อโศก)/i],
 ['iconsiam','ICONSIAM',/iconsiam|ไอคอนสยาม|สยามทาคาชิมายะ/i],
 ['paragon','Siam Paragon',/paragon|พารากอน/i],
 ['ladprao','เซ็นทรัล ลาดพร้าว',/ladprao|ลาดพร้าว/i],
 ['chaeng','เซ็นทรัล แจ้งวัฒนะ',/แจ้งวัฒนะ/i],
 ['hatyai','Central Festival Hatyai',/hatyai|หาดใหญ่/i],
 ['rama2','เซ็นทรัล พระราม 2',/rama\s*2|พระราม\s*2/i],
 ['chanthaburi','โรบินสัน จันทบุรี',/จันทบุรี/i],
 ['mega','เมกาบางนา',/mega\s*bangna|เมกา\s*บางนา/i],
 ['pinklao','เซ็นทรัล ปิ่นเกล้า',/pinklao|ปิ่นเกล้า/i],
 ['eastville','เซ็นทรัล อีสต์วิลล์',/east\s*ville|อีสต์วิลล์|อีสวิลล์/i],
 ['bangna','เซ็นทรัล บางนา',/CDS\s*Bangna|เซ็นทรัล\s*บางนา/i],
 ['fashion','Fashion Island',/fashion|แฟชั่น/i],
 ['future','Future Park',/future\s*park|ฟิวเจอร์/i],
 ['field','สนามเทพหัสดิน',/สนามเทพ|เทพหัสดิน/i],
 ['street','The Street รัชดา',/the\s*street|สตรีท\s*รัชดา/i],
 ['life','Life Center',/life\s*center/i],
 ['paradise','ตลาดเสรี พาราไดซ์',/ตลาดเสรี|พาราไดซ์/i],
 ['outlet','Outlet Mall พัทยา',/outlet|เอาท์เล็ท/i],
 ['sun','Sun Tower',/sun\s*tower/i],
 ['true','True Digital Park',/true\s*digital/i],
 ['sinsathorn','ตึกสินสาทร',/สินสา?ทร|สินสาธร/i],
 ['chamchuri','จามจุรี',/จามจุรี/i],
 ['promenade','Promenade',/promenade|พรอม[าา]?นาด|พรอมานาด/i],
 ['crystal','The Crystal Park',/crystal|crstral|คริสตัล/i],
 ['mrt','MRT Metro Mall จตุจักร',/mrt|metro\s*mall|จตุจักร/i],
 ['seacon','Seacon Square ศรีนครินทร์',/seacon|ซีคอน/i],
 ['silom','เซ็นทรัล สีลมคอมเพลกซ์',/สีลมคอมเพลกซ์|silom\s*complex/i],
 ['bitec','ไบเทค บางนา',/ไบเทค|bitec/i],
 ['impact','IMPACT เมืองทองธานี',/อิมแพค|อิมแพ็ค|impact|เมืองทอง/i],
];
export function compensationVenue(value) {
 const text=String(value||'').replace(/[\u200b-\u200d]/g,'');
 if(/บ้าน\s*(?:และ|เเละ|&)\s*สวน|baan\s*(?:lae|and|&)\s*suan/i.test(text)) {
  if(/ไบเทค|bitec/i.test(text))return {id:'house-bitec',label:'บ้านและสวน · ไบเทค บางนา'};
  if(/เมืองทอง|impact/i.test(text))return {id:/torani/i.test(text)?'house-torani':'house-impact',label:/torani/i.test(text)?'บ้านและสวน Torani · เมืองทอง':'บ้านและสวน · เมืองทองธานี'};
  return {id:'baan-suan',label:'บ้านและสวน'};
 }
 const match=compensationAliases.find(([id,label,rx])=>id===text||label===text||rx.test(text));
 return match?{id:match[0],label:match[1]}:null;
}
export const compensationProfile = id => eventCompensationProfiles.find(p=>p.id===id)||null;
const sortProfiles=(a,b)=>(b.range?.start||`${b.year}-01-01`).localeCompare(a.range?.start||`${a.year}-01-01`)||b.source.sheet.localeCompare(a.source.sheet)||a.id.localeCompare(b.id);
export function compensationProfilesFor(place,location='') {
 const key=compensationVenue(place)?.id;
 const target=key==='baan-suan'?(location?compensationVenue(`${place} ${location}`)?.id:null):key;
 if(!target||target==='baan-suan')return [];
 return eventCompensationProfiles.filter(p=>compensationVenue(p.name)?.id===target).sort(sortProfiles);
}
export function compensationVenues() {
 return [...new Map(eventCompensationProfiles.map(p=>compensationVenue(p.name)).filter(Boolean).filter(v=>!v.id.startsWith('house-')).map(v=>[v.id,v])).values()];
}
export function compensationDefaults(place,location='',profileId='') {
 const profiles=compensationProfilesFor(place,location),profile=profiles.find(p=>p.id===profileId)||profiles[0];
 const wageProfile=profile?.wage?profile:profiles.find(p=>p.wage);
 return {compensationMode:'catalog',rateProfile:profile?.id||'',wageProfile:wageProfile?.id||'',wageMode:wageProfile?'source':'manual',incentiveMode:profile?.commission?'source':'manual',incentiveAmount:'',commissionMethod:'excess',pcCostMode:'person',pcCount:profile?.pcCount??wageProfile?.pcCount??'',pc:wageProfile?compensationWage(wageProfile,{}).daily:'',compensationVersion:eventCompensationVersion};
}
const compensationNumber=value=>value===null||value===undefined||String(value).trim()===''?null:Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
const compensationRound=value=>Math.round((value+Number.EPSILON)*100)/100;
export function compensationWage(profile,input) {
 const wage=profile?.wage;if(!wage)return {daily:null,totalPerPerson:null,range:null,calendarEstimated:false};
 const min=wage.kind==='flat'?wage.amount:wage.kind==='range'?wage.min:Math.min(...wage.daily);
 const max=wage.kind==='flat'?wage.amount:wage.kind==='range'?wage.max:Math.max(...wage.daily);
 const days=compensationNumber(input.days);
 let total=null,calendarEstimated=false;
 const start=String(input.startDate||''),end=String(input.endDate||'');
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(valid(start)&&valid(end)&&end>=start&&(Date.parse(end)-Date.parse(start))/86400000<366) {
  total=0;
  for(let date=Date.parse(start);date<=Date.parse(end);date+=86400000){const day=new Date(date),key=day.toISOString().slice(0,10);total+=wage.overrides?.[key]??(wage.kind==='calendar'?wage.daily[day.getUTCDay()]:max);}
 }else if(days>0&&days<=366&&Number.isInteger(days)){total=max*days;calendarEstimated=wage.kind==='calendar';}
 const effectiveDays=valid(start)&&valid(end)&&end>=start?(Date.parse(end)-Date.parse(start))/86400000+1:days;
 return {daily:total!==null&&effectiveDays>0?total/effectiveDays:max,totalPerPerson:total,range:{min,max},calendarEstimated};
}
export function compensationContext(input) {
 const active=input.compensationMode==='catalog';
 if(!active)return {active:false,errors:[]};
 const errors=[],profile=compensationProfile(input.rateProfile),wageProfile=compensationProfile(input.wageProfile);
 if(input.rateProfile&&!profile)errors.push('rateProfile');
 if(input.wageProfile&&!wageProfile)errors.push('wageProfile');
 if(!['source','manual'].includes(input.wageMode))errors.push('wageMode');
 if(!['source','manual'].includes(input.incentiveMode))errors.push('incentiveMode');
 if(!['excess','cumulative'].includes(input.commissionMethod))errors.push('commissionMethod');
 if(input.incentiveMode==='source'&&!profile?.commission)errors.push('incentiveAmount');
 if(input.incentiveMode==='manual'&&(compensationNumber(input.incentiveAmount)===null||Number(input.incentiveAmount)>1e10))errors.push('incentiveAmount');
 if(input.wageMode==='source'&&!wageProfile?.wage)errors.push('pc');
 const pcCount=compensationNumber(input.pcCount);
 if(pcCount===null||!Number.isInteger(pcCount)||pcCount<1||pcCount>10000)errors.push('pcCount');
 const wage=input.wageMode==='source'?compensationWage(wageProfile,input):null;
 return {active,errors,profile,wageProfile,wage,pcCount,version:eventCompensationVersion};
}
export function estimateCompensation(sales,input) {
 const ctx=compensationContext(input),amount=compensationNumber(sales);
 if(!ctx.active)return {commission:0,bonus:0,total:0,perPerson:null,estimated:false};
 if(ctx.errors.length||amount===null)return {commission:null,bonus:null,total:null,perPerson:null,estimated:true};
 if(input.incentiveMode==='manual'){const total=compensationNumber(input.incentiveAmount);return {commission:total,bonus:0,total,perPerson:total/ctx.pcCount,estimated:true,manual:true};}
 const rule=ctx.profile.commission;let commission=0,bonus=0;
 if(rule.kind==='threshold')commission=amount>rule.threshold?amount*rule.rate:0;
 if(['tiers','large-event','bonus-person'].includes(rule.kind)){
  const tier=[...rule.tiers].reverse().find(([threshold])=>amount>=threshold);
  if(tier){if(rule.kind==='bonus-person')bonus=tier[1]*ctx.pcCount;else commission=amount*tier[1];}
  else if(rule.kind==='large-event'&&amount>=rule.fixedFrom&&amount<rule.fixedTo)commission=rule.perPerson*ctx.pcCount;
 }
 if(rule.kind==='excess'){
  if(amount>=rule.first&&amount<=rule.upper)commission=amount*.01;
  if(amount>rule.threshold)commission=(amount-rule.threshold)*rule.rate+(input.commissionMethod==='cumulative'?rule.threshold*.01:0);
  if(amount>rule.bonusThreshold)bonus=rule.bonus;
  // At a textual gap use the first band's endpoint estimate, explicitly flagged in the UI.
  if(amount>rule.upper&&amount<=rule.threshold)commission=amount*.01;
 }
 const total=compensationRound(commission+bonus);
 return {commission:compensationRound(commission),bonus:compensationRound(bonus),total,perPerson:total/ctx.pcCount,estimated:true,rule:rule.kind};
}
export function compensationBreakpoints(input) {
 const ctx=compensationContext(input);if(!ctx.active||input.incentiveMode==='manual'||!ctx.profile?.commission)return [0];
 const r=ctx.profile.commission,points=[0];
 for(const value of [r.threshold,r.first,r.upper,r.bonusThreshold,r.fixedFrom,r.fixedTo,...(r.tiers||[]).map(t=>t[0])])if(Number.isFinite(value))points.push(Math.floor(value),Math.floor(value)+1);
 return [...new Set(points)].sort((a,b)=>a-b);
}
// Search each linear interval separately because incentive thresholds can make costs jump or fall.
export function compensationSalesTarget(input,fixed,variable,kind='roi',step=1) {
 const ctx=compensationContext(input);if(ctx.errors.length||!Number.isFinite(fixed)||!Number.isFinite(variable))return null;
 const max=1e10/step,starts=[...new Set(compensationBreakpoints(input).map(n=>Math.ceil(n/step)).filter(n=>n<=max))];
 const wage=ctx.wage?.totalPerPerson!=null?ctx.wage.totalPerPerson*ctx.pcCount:Number(input.pc)*Number(input.days)*(input.pcCostMode==='person'?Number(input.pcCount):1);
 const factor=1+Number(input.roiPercent??40)/100,pcRate=Number(input.pcPercent??13)/100;
 const margin=units=>{const sales=units*step,inc=estimateCompensation(sales,input).total;if(inc===null)return -Infinity;const pcMargin=sales*pcRate-wage-inc,roiMargin=sales-factor*(fixed+variable*sales+inc);return kind==='both'?Math.min(pcMargin,roiMargin):kind==='pc'?pcMargin:kind==='roi'?roiMargin:sales-(fixed+variable*sales+inc);};
 for(let i=0;i<starts.length;i++){
  let lo=starts[i],hi=i+1<starts.length?starts[i+1]-1:max;if(hi<lo)continue;
  if(margin(lo)>=-1e-7)return lo*step;
  if(margin(hi)<-1e-7)continue;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(margin(mid)>=-1e-7)hi=mid;else lo=mid+1;}
  return lo*step;
 }
 return null;
}
