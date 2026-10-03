import { confirmedBranchMapping, isLadpraoCounter } from './out/assets/branch-mapping.mjs';

const eventMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const eventRound=n=>Math.round((n+Number.EPSILON)*100)/100;
const eventAliases=[
  ['terminal-asok',/terminal\s*21?\s*asok|terminal\s*asok|เทอมินอลอโศก/i],
  ['terminal-rama3',/terminal\s*21\s*rama\s*3/i],['terminal-pattaya',/terminal\s*21\s*pattaya/i],
  ['mega',/mega\s*bangna|เมกา\s*บางนา/i],['pinklao',/pinklao|ปิ่นเกล้า/i],
  ['eastville',/east\s*ville|อีสต์วิลล์|อีสวิลล์/i],['chiangmai',/chiang\s*mai|เชียงใหม่/i],
  ['westgate',/westgate|เวส[ตท์]*เกต/i],['bangna',/bangna|บางนา/i],
  ['fashion',/fashion|แฟชั่น|kelly/i],['futurepark',/future\s*park|ฟิวเจอร์/i],
  ['field',/สนามเทพ|เทพหัสดิน/i],['street',/the\s*street|สตรีท/i],
  ['rama2',/rama\s*2|พระราม\s*2/i],['surat',/สุราษ/i],['outlet',/เอาท์เล็ท/i],
  ['korat',/โคราช/i],['suntower',/sun\s*tower/i],['bangkapi',/บางกะปิ/i],
  ['moneyexpo',/money\s*expo/i],['outdoor',/outdoor/i],['lifecenter',/life\s*center/i],
  ['paradise',/ตลาดเสรี/i],['truedigital',/true\s*digital/i],['chanthaburi',/จันทบุรี/i],
  ['muangthong',/เมืองทอง/i],['rangsit',/รังสิต/i],['sinsathorn',/สินสาทร/i],
  ['pim',/pim\s*convention|ปัญญาภิวัฒน์/i],['chamchuri',/จามจุรี/i],
  ['udon',/udon|อุดร/i],['ladprao',/ladprao|ลาดพร้าว/i],['crystal',/crystal/i],
  ['promenade',/promenade/i],['mrt',/mrt.*จตุจักร/i],['seacon',/seacon/i],['innomall',/innomall/i],
  ['phitsanulok',/พิษณุโลก/i],['bangkhae',/บางแค/i]
];
function eventVenue(name){return eventAliases.find(([,rx])=>rx.test(name))?.[0]||String(name).toLowerCase().replace(/\s+/g,'');}
function eventDates(item){
  const s=item.name.replace(/[–—]/g,'-').replace(/\s+/g,' ');
  let m=s.match(/(\d{1,2})(?:\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?)?\s*-\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
  let startDay,startMonth,endDay,endMonth,endYear=2026;
  if(m){startDay=+m[1];startMonth=+(m[2]||m[5]);endDay=+m[4];endMonth=+m[5];const y=+m[6];endYear=y>2400?y-543:y>2000?y:y>=60?y+1957:2000+y;}
  else {
    const short=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const occurrences=[...s.matchAll(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/g)];
    if(occurrences.length){const a=occurrences[0],b=occurrences.at(-1);startMonth=short.indexOf(a[2])+1;endMonth=short.indexOf(b[2])+1;startDay=+(s.slice(0,a.index).match(/(\d{1,2})\s*-\s*$/)?.[1]||a[1]);endDay=+b[1];}
    else {m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m){startDay=endDay=+m[1];startMonth=endMonth=+m[2];}}
  }
  if(!startMonth)return {months:[item.month].filter(Boolean)};
  const startYear=endMonth<startMonth?endYear-1:2026;
  const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const start=iso(startYear,startMonth,startDay),end=iso(endYear,endMonth,endDay);
  const valid=(y,m,d)=>m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();
  if(start>end||!valid(startYear,startMonth,startDay)||!valid(endYear,endMonth,endDay))return {months:[item.month].filter(Boolean),invalid:true};
  const months=Array.from({length:12},(_,i)=>i+1).filter(m=>iso(2026,m,31)>=start&&iso(2026,m,1)<=end);
  return {start,end,months};
}
function eventReportRows(period){
  const rows=period.branches||[];
  // The report's Event block sits between the mall counters and standalone stores.
  // Codes identify the boundaries even when an Event's type is CDS/RBS or blank.
  const lastMall=rows.findLastIndex(b=>/^V[CMR]-\d+/i.test(b.branch_code));
  const nextStore=rows.findIndex((b,i)=>i>lastMall&&/^VA-\d+/i.test(b.branch_code));
  if(lastMall>=0&&nextStore>lastMall)return rows.slice(lastMall+1,nextStore).filter(b=>!confirmedBranchMapping(b)&&!isLadpraoCounter(b));
  return rows.filter(b=>!/^(?:V[ACMR]-\d+)/i.test(b.branch_code)&&!/^(?:CDS|RBS|TM|Stand alone|Flagship|Pop up Store)$/i.test(b.type||''));
}

export function reconcileEvents(catalog, report){
  if(catalog?.catalog_version!==1)return {...catalog,years:{...catalog?.years,'2026':{year:2026,summary:{count:catalog?.years?.['2026']?.summary?.count||0,sales:null,with_sales:0,planned:0},items:[],months:[],sources:[],unmatched:[],sales_available:false,status_message:'กำลังรอรายชื่อ Event จากชีตต้นทุนเพื่อเชื่อมกับ Sales Report'}}};
  const entries=Object.entries(report?.periods||{}).filter(([key])=>/^2026-(0[1-9]|1[0-2])$/.test(key)).sort(([a],[b])=>a.localeCompare(b));
  const items=catalog.years['2026'].items.map(item=>({...item,sales:null,report_rows:0,range:eventDates(item)}));
  const unmatched=[],months=[];let total=0,mismatches=0;
  for(const [key,period] of entries){
    let monthSales=0;
    for(const row of eventReportRows(period)){
      const dates=Object.entries(row.daily_sales||{}).filter(([date,value])=>date.startsWith(key)&&date<=(period.latest_date||`${key}-31`)&&value!=null&&Number.isFinite(Number(value)));
      const sales=eventRound(dates.length?dates.reduce((sum,[,value])=>sum+Number(value),0):Number(row.month_to_date||0));
      if(dates.length&&Math.abs(sales-Number(row.month_to_date||0))>.01)mismatches++;
      total+=sales;monthSales+=sales;
      const identity=eventVenue(row.branch), text=`${row.branch} ${row.branch_code||''}`;
      const direct=/อีเวนท์นอก|sneaker|showcase|world\s*cup/i.test(text);
      const gp=!direct&&/ลานโปร|\bCDS\b|\bRBS\b|Sport[s]?\s*(?:World|Mall)|SPW|OLM/i.test(`${text} ${row.type}`);
      const activity=dates.filter(([,value])=>Number(value)!==0).map(([date])=>date);
      let candidates=items.filter(item=>eventVenue(item.name)===identity&&item.range.months.includes(Number(key.slice(5)))&&(!gp||item.categories.includes('gp'))&&(!direct||item.categories.includes('direct')));
      const dated=candidates.filter(item=>!item.range.invalid&&(!activity.length||!item.range.start||activity.every(date=>date>=item.range.start&&date<=item.range.end)));
      // Invalid dates and overlapping campaigns need review, never guess a split.
      candidates=dated;
      if(candidates.length===1){const item=candidates[0];item.sales=eventRound((item.sales||0)+sales);item.report_rows++;}
      else if(sales!==0)unmatched.push({month:eventMonths[Number(key.slice(5))-1],name:row.branch,sales,reason:candidates.length>1?'ตรงกับหลายงาน':'ยังจับคู่รายชื่อไม่ได้'});
    }
    months.push({month:eventMonths[Number(key.slice(5))-1],count:items.filter(item=>item.month===Number(key.slice(5))).length,sales:eventRound(monthSales)});
  }
  const salesAvailable=entries.length>0;
  for(let month=1;month<=12;month++)if(!months.some(m=>m.month===eventMonths[month-1]))months.push({month:eventMonths[month-1],count:items.filter(item=>item.month===month).length,sales:null});
  months.sort((a,b)=>eventMonths.indexOf(a.month)-eventMonths.indexOf(b.month));
  const assigned=items.filter(item=>item.report_rows>0),allocated=eventRound(assigned.reduce((sum,item)=>sum+(item.sales||0),0));
  const year={year:2026,items:items.map(({range,...item})=>item),summary:{count:items.length,sales:salesAvailable?eventRound(total):null,with_sales:assigned.filter(item=>item.sales>0).length,planned:items.length-assigned.length},months,
    sources:[['direct','Event เก็บเงินเอง'],['gp','Event จ่าย GP']].map(([category,label])=>({label,count:items.filter(item=>item.categories.includes(category)).length,sales:eventRound(items.filter(item=>item.categories.includes(category)).reduce((sum,item)=>sum+(item.sales||0),0))})),
    top_events:assigned.filter(item=>item.sales>0).sort((a,b)=>b.sales-a.sales).slice(0,8),unmatched,allocated_sales:allocated,unallocated_sales:eventRound(total-allocated),mtd_differences:mismatches,sales_available:salesAvailable,
    coverage:entries.map(([key])=>Number(key.slice(5))),as_of:entries.map(([,period])=>period.latest_date).filter(Boolean).sort().at(-1)||null,sales_fetched_at:report?.source?.fetched_at||null};
  return {...catalog,years:{...catalog.years,'2026':year}};
}

export function applyEventSales(snapshot){
  return {...snapshot,data:{...snapshot.data,'/api/events':reconcileEvents(snapshot.data['/api/events'],snapshot.data['/api/daily-sales'])}};
}
