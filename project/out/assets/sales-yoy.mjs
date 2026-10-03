// Compare a forecast with the full same-month actual from the prior year.
const code = row => String(row.branch_code || '').trim().toUpperCase();
const name = row => String(row.branch || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const family = row => String(row.type || '').trim().toLowerCase();
export const comparisonKey = row => [family(row), code(row), name(row)].join('\u0001');
const amount = value => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const unknown = reason => ({status:'unknown', reason});

export function compareForecasts(rows, allPeriods, selectedPeriod, isBranch, useActual = false) {
  const results = new Map();
  const priorKey = selectedPeriod ? `${selectedPeriod.year - 1}-${String(selectedPeriod.month).padStart(2,'0')}` : null;
  const prior = allPeriods.find(period => period.key === priorKey && !period.projected);
  const priorEnd = prior ? `${priorKey}-${new Date(Date.UTC(prior.year,prior.month,0)).getUTCDate()}` : null;
  const current = (selectedPeriod?.branches || []).filter(isBranch);
  const previous = (prior?.branches || []).filter(isBranch);
  const matchingCode = (list, row) => code(row) ? list.filter(other => code(other) === code(row)) : [];
  for (const row of rows) {
    let result;
    if (!isBranch(row)) result = {status:'excluded',reason:'Event ไม่เทียบสาขาเดิม'};
    else if (!selectedPeriod) result = unknown('เลือกเดือนเพื่อเทียบ');
    else if (!prior) result = unknown('ไม่มีข้อมูลเดือนเดียวกันปีก่อน');
    else if (!prior.latest_date || prior.latest_date < priorEnd) result = unknown('ข้อมูลเดือนปีก่อนยังไม่ครบ');
    else if (amount(useActual ? row.total : row.forecast) === null) result = unknown(useActual ? 'ยังไม่มียอดจริง' : 'ยังไม่มีคาดการณ์');
    else if (current.filter(other => comparisonKey(other) === comparisonKey(row)).length !== 1) result = unknown('รายการซ้ำ ต้องตรวจสอบสาขา');
    else {
      const currentCode = matchingCode(current,row);
      const priorCode = matchingCode(previous,row);
      let match = currentCode.length === 1 && priorCode.length === 1 ? priorCode[0] : null;
      // A code can be reused. Exact name + channel can disambiguate it; never sum it.
      if (!match && code(row) && (currentCode.length > 1 || priorCode.length > 1)) {
        const precise = list => list.filter(other => comparisonKey(other) === comparisonKey(row));
        if (precise(currentCode).length === 1 && precise(priorCode).length === 1) match = precise(priorCode)[0];
      }
      // Code-free matches must be unique and must not reuse a coded branch's baseline.
      if (!match && !code(row)) {
        const sameName = list => list.filter(other => name(other) === name(row) && family(other) === family(row));
        const candidates = sameName(previous);
        if (sameName(current).length === 1 && candidates.length === 1 && !code(candidates[0])) match = candidates[0];
      }
      if (match) {
        const actual = amount(match.month_to_date);
        if (actual === null || actual <= 0) result = unknown(actual === 0 ? 'ยอดปีก่อนเป็น 0 — คำนวณ % ไม่ได้' : 'ไม่มีฐานยอดขายปีก่อนที่ใช้เทียบได้');
        else {
          const delta = (useActual ? row.total : row.forecast) - actual;
          result = {status:Math.abs(delta) < 0.005 ? 'equal' : delta > 0 ? 'up' : 'down', actual, delta, percent:delta/actual, priorKey};
        }
      } else {
        // Owner-requested reporting classification: unmatched branches are new.
        // No opening date or prior-year sales amount is inferred.
        result = {status:'new',reason:'สาขาเปิดใหม่'};
      }
    }
    results.set(comparisonKey(row), result);
  }
  return results;
}

export function comparisonCounts(rows) {
  const counts = {up:0,down:0,equal:0,new:0,unknown:0,eligible:0};
  for (const row of rows) if (row.yoy && row.yoy.status !== 'excluded') {
    counts.eligible++;
    counts[row.yoy.status]++;
  }
  return counts;
}

// Channel totals compare the full channel, including outlets without a matching
// branch code. Branch-level matching remains the responsibility of compareForecasts.
export function compareAggregateSales({current, basis, allPeriods, scope, include = () => true}) {
  const priorKeys = scope.map(period => `${period.year - 1}-${String(period.month).padStart(2,'0')}`);
  const result = {status:'unknown', actual:null, current:amount(current), delta:null, percent:null,
    priorKey:priorKeys.length === 1 ? priorKeys[0] : null, priorKeys, basis, reason:null};
  const unavailable = reason => ({...result,reason});
  if (!priorKeys.length) return unavailable('เลือกเดือนเพื่อเทียบปีก่อน');
  let actual = 0;
  for (const key of priorKeys) {
    const prior = allPeriods.find(period => period.key === key && !period.projected);
    if (!prior) return unavailable('ไม่มีข้อมูลช่วงเดียวกันปีก่อน');
    const end = `${key}-${new Date(Date.UTC(prior.year,prior.month,0)).getUTCDate()}`;
    if (!prior.latest_date || prior.latest_date < end) return unavailable('ข้อมูลช่วงเดียวกันปีก่อนยังไม่ครบ');
    const previous = prior.branches.filter(include);
    if (!previous.length) return unavailable('ไม่มีข้อมูลช่องทางนี้ในช่วงเดียวกันปีก่อน');
    const amounts = previous.map(row => amount(row.month_to_date));
    if (amounts.some(value => value === null)) return unavailable('ยอดขายปีก่อนมีรายการที่ยังไม่มีข้อมูล');
    actual += amounts.reduce((sum,value) => sum + value,0);
  }
  result.actual = actual;
  if (result.current === null) return {...result,reason:'ยังไม่มียอดที่ใช้เปรียบเทียบ'};
  const delta = result.current - actual;
  return {...result, status:Math.abs(delta) < 0.005 ? 'equal' : delta > 0 ? 'up' : 'down', delta,
    percent:actual > 0 ? delta / actual : null,
    reason:actual === 0 ? 'ยอดปีก่อนเป็น 0 — คำนวณ % ไม่ได้' : actual < 0 ? 'ยอดปีก่อนติดลบ — คำนวณ % ไม่ได้' : null};
}
