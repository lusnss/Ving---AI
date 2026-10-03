const dayMs = 86400000;
const iso = (year, month, day) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const yearNumber = value => Number(value) > 2400 ? Number(value)-543 : Number(value) < 100 ? Number(value)+(Number(value)>=60?1957:2000) : Number(value);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

// Dates are taken from the report or event catalog; sales activity never invents an end date.
export function eventDateRange(text, year) {
  const value = String(text || '').replace(/[–—]/g,'-').replace(/\s+/g,' ');
  const numeric = value.match(/(\d{1,2})(?:\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?)?\s*-\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
  let start, end;
  if (numeric) {
    const [,sd,sm,sy,ed,em,ey] = numeric;
    const endYear = yearNumber(ey), startMonth = Number(sm || em);
    start = iso(sy ? yearNumber(sy) : endYear-(startMonth>Number(em)?1:0),startMonth,sd);
    end = iso(endYear,em,ed);
  } else {
    const short = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const matches = [...value.matchAll(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/g)];
    if (matches.length) {
      const a=matches[0], b=matches.at(-1), sm=short.indexOf(a[2])+1, em=short.indexOf(b[2])+1;
      const explicitYear=value.slice(b.index+b[0].length).match(/^\s*(\d{2,4})(?!\d)/)?.[1];
      const ey=explicitYear?yearNumber(explicitYear):year;
      const sd=value.slice(0,a.index).match(/(\d{1,2})\s*-\s*$/)?.[1] || a[1];
      start=iso(ey-(sm>em?1:0),sm,sd); end=iso(ey,em,b[1]);
    } else {
      const single=value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (!single) return null;
      start=end=iso(yearNumber(single[3]),single[2],single[1]);
    }
  }
  if (!validDate(start) || !validDate(end) || start>end || Date.parse(end)-Date.parse(start)>366*dayMs) return null;
  return {start,end};
}

const aliases = [
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
const venue = name => aliases.find(([,rx])=>rx.test(name))?.[0] || String(name).toLowerCase().replace(/\s+/g,'');
const recorded = value => value != null && String(value).trim()!=='' && Number.isFinite(Number(value));

export function eventSchedule(branch, period, catalog, today) {
  const cutoff=[today,period.latest_date || today].sort()[0];
  const activity=Object.entries(branch.daily_sales || {}).filter(([date,value])=>date<=cutoff && recorded(value) && Number(value)!==0).map(([date])=>date);
  const key=`${period.year}-${String(period.month).padStart(2,'0')}`;
  const overlaps=range=>range && range.start<=`${key}-31` && range.end>=`${key}-01` && activity.every(date=>date>=range.start && date<=range.end);
  const embedded=eventDateRange(branch.branch,period.year);
  if (embedded) return overlaps(embedded)?embedded:null;
  if (/\d\s*[-–—]\s*\d.*\/\d/.test(branch.branch || '')) return null;
  const text=`${branch.branch} ${branch.branch_code || ''}`;
  const direct=/อีเวนท์นอก|sneaker|showcase|world\s*cup/i.test(text);
  const gp=!direct && /ลานโปร|\bCDS\b|\bRBS\b|Sport[s]?\s*(?:World|Mall)|SPW|OLM/i.test(`${text} ${branch.type}`);
  const candidates=(catalog?.years?.[String(period.year)]?.items || []).filter(item=>
    venue(item.name)===venue(branch.branch) && (!gp || item.categories?.includes('gp')) && (!direct || item.categories?.includes('direct')))
    .map(item=>({...eventDateRange(item.date || item.name,period.year)}))
    .filter(overlaps);
  return candidates.length===1?candidates[0]:null;
}

export function eventForecast(branch, period, schedule, today) {
  if (!schedule || !period.latest_date || period.projected) return null;
  const key=`${period.year}-${String(period.month).padStart(2,'0')}`;
  const endOfMonth=iso(period.year,period.month,new Date(Date.UTC(period.year,period.month,0)).getUTCDate());
  const start=[schedule.start,`${key}-01`].sort().at(-1), end=[schedule.end,endOfMonth].sort()[0];
  const cutoff=[today,period.latest_date,end].sort()[0];
  if (cutoff<start || end<start) return null;
  const elapsed=(Date.parse(cutoff)-Date.parse(start))/dayMs+1;
  const totalDays=(Date.parse(end)-Date.parse(start))/dayMs+1;
  const values=Object.entries(branch.daily_sales || {}).filter(([date,value])=>date>=start && date<=cutoff && recorded(value));
  // No daily evidence is different from a confirmed zero-sales selling day.
  if (!values.length) return null;
  const actual=values.reduce((sum,[,value])=>sum+Number(value),0);
  return {value:actual/elapsed*totalDays, actual, elapsed, totalDays, start, end, ended:cutoff===end};
}
