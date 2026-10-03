export const tables=['ca_sources','ca_news_items','ca_candidates','ca_post_log','content_items','content_variants','publications','analytics_snapshots','intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','intel_scripts','wr_jobs','notifications','agent_requests'];
export function clean(value,key='') {
  if (/token|password|secret|api_key|email|phone|contact|spreadsheet|workbook|export_url|source_url|prompt|error|ผู้ติดต่อ|ผู้รับผิดชอบ|responsible|เบอร์|อีเมล/i.test(key)) return null;
  if(typeof value==='string') return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]').replace(/https:\/\/docs\.google\.com\/[^\s"<>]+/g,'[แหล่งข้อมูลภายใน]').replace(/https:\/\/[^\s"<>]*sharepoint\.com\/[^\s"<>]+/gi,'[แหล่งข้อมูลภายใน]').replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]').replace(/\/Users\/[^\s"<>]+/g,'[ไฟล์ภายใน]');
  if(Array.isArray(value))return value.map(x=>clean(x));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v,k)]));
  return value;
}

const isoDate=/^\d{4}-\d{2}-\d{2}$/;
const periodKey=/^\d{4}-(0[1-9]|1[0-2])$/;
const text=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):'';
const number=(value)=>Number.isFinite(Number(value))?Number(value):0;
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const safeText=(value,max=160)=>text(clean(value),max);
const strictText=(value,max)=>{
  const cleaned=clean(value);
  return typeof cleaned==='string'&&cleaned.trim().length<=max?cleaned.trim():'';
};

function validDate(value,period=''){
  if(!isoDate.test(value)||(period&&!value.startsWith(`${period}-`)))return false;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

function optionalNumber(value){
  if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:null;
}

function sanitizeSource(value){
  const source=value&&typeof value==='object'?value:{};
  const asOf=strictText(source.as_of_date,10);
  const fetchedAt=strictText(source.fetched_at,40);
  return {
    as_of_date:validDate(asOf)?asOf:null,
    fetched_at:timestamp.test(fetchedAt)?fetchedAt:null
  };
}

function periodEntries(input){
  if(Array.isArray(input?.periods))return input.periods.map((period)=>[period?.key,period]);
  if(input?.periods&&typeof input.periods==='object')return Object.entries(input.periods);
  return [];
}

function sanitizePeriod(key,value){
  const period=strictText(key,7);
  if(!periodKey.test(period)||!value||typeof value!=='object'||Array.isArray(value))return null;
  const dates=new Set();
  for(const date of Array.isArray(value.dates)?value.dates:[]){
    const normalized=strictText(date,10);
    if(validDate(normalized,period))dates.add(normalized);
  }
  const branches=(Array.isArray(value.branches)?value.branches:[]).map((item)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return null;
    const dailySales={};
    if(item.daily_sales&&typeof item.daily_sales==='object'&&!Array.isArray(item.daily_sales))for(const [date,value] of Object.entries(item.daily_sales)){
      if(!validDate(date,period))continue;
      dates.add(date);
      dailySales[date]=optionalNumber(value);
    }
    const branch=safeText(item.branch);
    const monthToDate=number(item.month_to_date);
    const target=number(item.target);
    const forecast=optionalNumber(item.forecast);
    if(!branch||(monthToDate===0&&target===0&&forecast===null&&!Object.values(dailySales).some((entry)=>Number(entry)!==0)))return null;
    return {
      branch_code:safeText(item.branch_code,48),
      branch,
      type:safeText(item.type),
      month_to_date:monthToDate,
      target,
      forecast,
      daily_sales:dailySales
    };
  }).filter(Boolean);
  const available=[...dates].sort();
  const requested=strictText(value.latest_date,10);
  const observed=[...available].reverse().find((date)=>branches.some((branch)=>branch.daily_sales[date]!==null&&branch.daily_sales[date]!==undefined));
  return {
    year:Number(period.slice(0,4)),
    month:Number(period.slice(5,7)),
    source:sanitizeSource(value.source),
    dates:available,
    latest_date:validDate(requested,period)&&available.includes(requested)?requested:observed||available.at(-1)||null,
    branches
  };
}

export function emptyDailySales(){
  return {version:2,source:{as_of_date:null,fetched_at:null},periods:{}};
}

// Daily reports are deliberately allow-listed. This prevents columns such as
// "ผู้รับผิดชอบ" and source links from entering the public snapshot.
export function sanitizeDailySales(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return emptyDailySales();
  const periods={};
  for(const [rawKey,value] of periodEntries(input)){
    const key=strictText(rawKey,7);
    const period=sanitizePeriod(key,value);
    if(period&&!Object.hasOwn(periods,key))periods[key]=period;
  }
  return {version:2,source:sanitizeSource(input.source),periods:Object.fromEntries(Object.entries(periods).sort(([a],[b])=>a.localeCompare(b)))};
}

export function ensureDailySales(snapshot){
  if(!snapshot||typeof snapshot!=='object')return snapshot;
  const data=snapshot.data&&typeof snapshot.data==='object'?snapshot.data:{};
  if(!data['/api/daily-sales'])data['/api/daily-sales']=emptyDailySales();
  return {...snapshot,data};
}
export function sanitizeSnapshot(input) {
  const data={};
  for(const name of tables){const v=input.data['/api/'+name];if(!v||!Array.isArray(v.items))throw Error('Missing table '+name);data['/api/'+name]=clean(v);}
  for(const name of ['mall-sales','contracts','events']){const v=input.data['/api/'+name];if(!v||typeof v!=='object')throw Error('Missing dashboard');data['/api/'+name]=clean(v);if(data['/api/'+name].source){data['/api/'+name].source.url='';}}
  data['/api/daily-sales']=sanitizeDailySales(input.data['/api/daily-sales']);
  data['/api/meta']={companyName:'VING',sceneCardEnabled:false,newsDailyLastRun:null};
  for(const job of data['/api/newsroom_jobs'].items){job.target='[ข้อมูลภายใน]';job.note='';job.result={};}
  return {exportedAt:input.exportedAt,data};
}
