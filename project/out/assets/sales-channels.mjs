import {normalizeReportBranches} from './branch-mapping.mjs';

export const REPORT_TYPES = Object.freeze(['Stand alone', 'CDS', 'RBS', 'TM', 'Event']);
export function reportType(value) {
  if (value && typeof value === 'object') {
    if (value.source_section === 'event') return 'Event';
    if (value.source_section === 'branch' && /^VA-\d+/i.test(value.branch_code || '')) return 'Stand alone';
    value = value.type;
  }
  return REPORT_TYPES.find(type=>type.toLowerCase()===String(value || '').trim().toLowerCase()) || 'Event';
}

export function sourceSections(branches) {
  const lastMall=branches.findLastIndex(branch=>/^V[CMR]-\d+/i.test(branch.branch_code || ''));
  const firstStore=branches.findIndex((branch,index)=>index>lastMall && /^VA-\d+/i.test(branch.branch_code || ''));
  if(lastMall<0 || firstStore<=lastMall)return branches;
  return branches.map((branch,index)=>({...branch,source_section:index>lastMall && index<firstStore?'event':'branch'}));
}

// A report-wide latest date may belong only to Event. Use source cells before
// the UI fills internal blank branch days with zero; explicit numeric zero counts.
export function prepareReportPeriod(period, today) {
  const branches=normalizeReportBranches(sourceSections(period.branches || []));
  const key=period.key || `${period.year}-${String(period.month).padStart(2,'0')}`;
  const valid=date=>typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(key+'-') &&
    date<=(period.latest_date || today) && date<=today && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date;
  const latestFor=rows=>{
    const observed=rows.flatMap(row=>Object.entries(row.daily_sales || {}).filter(([date,value])=>
      valid(date) && value!=null && String(value).trim()!=='' && Number.isFinite(Number(value))).map(([date])=>date)).sort().at(-1);
    if(observed)return observed;
    // Older aggregate-only imports have no daily cells. Preserve their explicit
    // report date; a present-but-blank daily grid is not a reported day.
    return rows.length && rows.every(row=>!Object.keys(row.daily_sales || {}).length) && valid(period.latest_date) ? period.latest_date : null;
  };
  return {...period,branches,
    branch_latest_date:latestFor(branches.filter(row=>reportType(row)!=='Event')),
    event_latest_date:latestFor(branches.filter(row=>reportType(row)==='Event'))};
}

export function periodSalesDatesText(period, formatDate) {
  if(period.branch_latest_date && period.event_latest_date && period.branch_latest_date!==period.event_latest_date)
    return `ยอดสาขาถึง ${formatDate(period.branch_latest_date)} · ยอด Event ถึง ${formatDate(period.event_latest_date)}`;
  const latest=period.branch_latest_date || period.event_latest_date;
  return latest ? `ยอดสะสมถึง ${formatDate(latest)}` : 'ยังไม่มีข้อมูลรายวัน';
}
