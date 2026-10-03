import {sanitizeDailySales} from './sanitize.mjs';

function cellNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text=String(value ?? '').trim().replace(/[,฿\s]/g,'');
  if (!text || /^[—–-]$/.test(text)) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw Error('invalid_cells');
  return Number(text);
}
function cellDate(value) {
  if (typeof value==='number' && value>36525 && value<80000) return new Date(Date.UTC(1899,11,30)+Math.trunc(value)*86400000).toISOString().slice(0,10);
  const m=String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const year=Number(m[3])>2400?Number(m[3])-543:Number(m[3]);
  const d=new Date(Date.UTC(year,Number(m[2])-1,Number(m[1])));
  return d.getUTCFullYear()===year && d.getUTCMonth()+1===Number(m[2]) && d.getUTCDate()===Number(m[1])?d.toISOString().slice(0,10):'';
}

// Graph returns cells in memory. Persist only this sales allow-list, never the
// original ranges, staff columns, formulas, worksheet URLs or account identity.
export function parseOnlineSales(sheets, at=new Date().toISOString()) {
  const today=new Date(Date.parse(at)+7*3600000).toISOString().slice(0,10),periods={};
  for (const sheet of sheets) {
    if (!String(sheet.name).replace(/\s/g,'').includes('ยอดขาย')) continue;
    const rows=sheet.values;
    if (!Array.isArray(rows) || !rows.length || rows.length>2000 || rows.some(r=>!Array.isArray(r)||r.length>200)) throw Error('invalid_layout');
    const headerIndex=rows.findIndex(row=>String(row[0]).trim()==='ลำดับ' && String(row[3]).trim()==='สาขา');
    if (headerIndex<0) continue;
    const header=rows[headerIndex].map(v=>String(v ?? '').trim());
    const columns=['ประเภท','รหัสสาขา','สาขา','เป้าหมาย','ยอดขายปัจจุบัน'].map(name=>header.indexOf(name));
    if (columns.some(i=>i<0)) throw Error('invalid_layout');
    const [type,code,branch,target,mtd]=columns;
    const dates=rows[headerIndex].map((value,index)=>({date:cellDate(value),index})).filter(c=>c.date);
    if (!dates.length) throw Error('invalid_layout');
    const key=dates[0].date.slice(0,7),year=Number(key.slice(0,4)),month=Number(key.slice(5));
    const count=new Date(Date.UTC(year,month,0)).getUTCDate();
    if (dates.length!==count || dates.some((c,i)=>c.date!==`${key}-${String(i+1).padStart(2,'0')}`)) throw Error('invalid_layout');
    if (key>today.slice(0,7)) continue;
    if (periods[key]) throw Error('duplicate_month');
    const branches=[];
    for (const row of rows.slice(headerIndex+1)) {
      // A broken/blank display ordinal must not discard a valid store code.
      const numbered=/^\d+$/.test(String(row[0] ?? '').trim());
      const coded=/^V[A-Z]-\d+$/i.test(String(row[code] ?? '').trim());
      if (!numbered && !coded) continue;
      if (!String(row[branch] ?? '').trim()) throw Error('invalid_layout');
      const daily_sales=Object.fromEntries(dates.map(c=>[c.date,c.date>today?null:cellNumber(row[c.index])]));
      const record={type:String(row[type] ?? '').trim(),branch_code:String(row[code] ?? '').trim(),branch:String(row[branch]).trim(),target:cellNumber(row[target])??0,month_to_date:cellNumber(row[mtd])??0,daily_sales};
      if (record.target!==0 || record.month_to_date!==0 || Object.values(daily_sales).some(v=>v!==null&&v!==0)) branches.push(record);
    }
    const latest_date=dates.map(c=>c.date).filter(d=>d<=today&&branches.some(b=>b.daily_sales[d]!==null)).at(-1);
    if (!branches.length || !latest_date) throw Error('empty_month');
    periods[key]={year,month,dates:dates.map(c=>c.date),latest_date,branches,source:{as_of_date:latest_date,fetched_at:at}};
  }
  if (!Object.keys(periods).length) throw Error('empty_report');
  const as_of_date=Object.values(periods).map(p=>p.latest_date).sort().at(-1);
  return sanitizeDailySales({version:2,source:{as_of_date,fetched_at:at},periods});
}
