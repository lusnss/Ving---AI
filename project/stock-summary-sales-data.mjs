import {completeForecastMonth} from './out/assets/stock-history.mjs';
import {summaryProductNames, summaryDisplayIdentity} from './out/assets/stock-summary-model.mjs';

export async function loadSavedSummarySales(env, pivot) {
  const empty = {status:'unavailable', models:[], totalQty:0, months:[], skippedMonths:[], fetchedAt:null, duplicateRowsSkipped:0};
  if (!env.BUCKET?.list || !env.BUCKET?.get) return empty;
  try {
    const saved = new Map(), cursors = new Set();
    let cursor;
    do {
      const page = await env.BUCKET.list({prefix:'stock-report/v1/', limit:1000, ...(cursor ? {cursor} : {})});
      for (const object of page.objects) {
        const match = /^stock-report\/v1\/(\d{4}-(?:0[1-9]|1[0-2]))\/(\d+)\.json$/.exec(object.key);
        if (!match) continue;
        if (!saved.has(match[1])) saved.set(match[1], new Set());
        saved.get(match[1]).add(Number(match[2]));
      }
      if (!page.truncated) break;
      if (!page.cursor || cursors.has(page.cursor)) throw Error('Incomplete cache listing');
      cursor = page.cursor; cursors.add(cursor);
    } while (true);
    const names = summaryProductNames(pivot?.items || []), models = new Map(), seen = new Map();
    const result = {...empty, status:'empty', months:[], skippedMonths:[]};
    for (const month of [...saved.keys()].sort()) {
      try {
        const chunks = [], visited = new Set();
        let page = 1;
        do {
          if (!Number.isInteger(page) || page < 1 || visited.has(page) || !saved.get(month).has(page)) throw Error('Incomplete month');
          visited.add(page);
          const object = await env.BUCKET.get(`stock-report/v1/${month}/${page}.json`);
          if (!object) throw Error('Missing page');
          const chunk = await object.json();
          if (!Array.isArray(chunk.rows) || !Number.isFinite(Date.parse(chunk.fetchedAt)) || !Number.isInteger(chunk.total) || chunk.total < 0 || !Number.isFinite(chunk.expectedQty) || chunk.expectedQty < 0) throw Error('Invalid page');
          if (chunk.rows.some(row => !row.id || typeof row.sku !== 'string' || !row.sku || !Number.isFinite(row.qty) || row.qty <= 0)) throw Error('Invalid sale');
          chunks.push(chunk); page = chunk.nextPage;
        } while (page !== null);
        const complete = completeForecastMonth(chunks, month);
        const signature = row => JSON.stringify([row.sku,row.qty,row.branchId,row.date]);
        if (complete.rows.some(row => seen.has(row.id) && seen.get(row.id) !== signature(row))) throw Error('Changed duplicate');
        for (const row of complete.rows) {
          if (seen.has(row.id)) {result.duplicateRowsSkipped++; continue;}
          seen.set(row.id, signature(row));
          const model = summaryDisplayIdentity(row, names).model;
          models.set(model, (models.get(model) || 0) + row.qty);
        }
        result.months.push(month);
        result.fetchedAt = !result.fetchedAt || complete.fetchedAt < result.fetchedAt ? complete.fetchedAt : result.fetchedAt;
      } catch {result.skippedMonths.push(month);}
    }
    result.models = [...models].map(([model,qty]) => ({model,qty}));
    result.totalQty = result.models.reduce((sum,row) => sum + row.qty, 0);
    result.status = result.skippedMonths.length ? 'partial' : result.months.length ? 'ready' : 'empty';
    return result;
  } catch {return empty;}
}
