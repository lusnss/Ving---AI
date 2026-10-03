const clean = value => String(value ?? '').trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
const key = value => clean(value).toLocaleLowerCase();
const missing = value => !value || /^(ไม่มี|ไม่ระบุ|n\/?a|-)$/i.test(value);
const compare = (a, b) => a.localeCompare(b, 'th', {numeric: true, sensitivity: 'base'});
const grades = ['A', 'B+', 'B', 'C', 'D', 'ไม่ระบุ'];

export function mergeSummaryPrices(rows) {
  const known = rows.filter(row => Number.isFinite(row.fullPriceMin) && Number.isFinite(row.fullPriceMax));
  return {
    fullPriceMin: known.length ? Math.min(...known.map(row => row.fullPriceMin)) : null,
    fullPriceMax: known.length ? Math.max(...known.map(row => row.fullPriceMax)) : null,
    priceMissing: rows.some(row => row.priceMissing || !Number.isFinite(row.fullPriceMin))
  };
}

export function mergeSummaryCosts(rows) {
  const known = rows.filter(row => Number.isFinite(row.unitCostMin) && Number.isFinite(row.unitCostMax));
  return {
    unitCostMin: known.length ? Math.min(...known.map(row => row.unitCostMin)) : null,
    unitCostMax: known.length ? Math.max(...known.map(row => row.unitCostMax)) : null,
    costMissing: rows.some(row => row.costMissing || !Number.isFinite(row.unitCostMin)),
    costRows: [...new Set(rows.flatMap(row => row.costRows || []))].sort((a, b) => a - b)
  };
}

export function summaryItemCost(item, costs) {
  const identity = summaryIdentity(item);
  const normalize = value => String(value || '').normalize('NFKC').toUpperCase().replace(/[\s_-]+/g, '');
  const ungrade = value => String(value || '').replace(/_(BB|B\+|A|B|C|D)$/i, '');
  const rawModel = String(item.sku || '').replace(/^(VING|TORANI)-/i, '').split('#')[0].split('-')[0];
  const models = new Set([identity.model, ungrade(rawModel), ungrade(item.model)].map(normalize).filter(Boolean));
  const matches = costs.filter(cost => {
    const grade = String(cost.grade || '').trim().toUpperCase().replace(/^GRADE\s*/, '').replace(/^BB$/, 'B+');
    // Ungraded accessory costs apply to that named accessory. Shoe grades must match.
    if (grade ? grade !== identity.grade : cost.type === 'SHOES') return false;
    if (String(cost.model).includes('#')) return normalize(cost.model) === normalize(item.sku);
    return String(cost.model).split(/\s+\/\s+/).some(alias => {
      const [model, size] = alias.split(/\s*:\s*/);
      return models.has(normalize(ungrade(model))) && (!size || normalize(size) === normalize(identity.size));
    });
  });
  const ready = matches.filter(cost => !cost.note && Number.isFinite(cost.beforeVat) && cost.beforeVat > 0 && Number.isFinite(cost.includingVat) && cost.includingVat >= 0);
  return {
    unitCostMin: ready.length ? Math.min(...ready.map(cost => cost.includingVat)) : null,
    unitCostMax: ready.length ? Math.max(...ready.map(cost => cost.includingVat)) : null,
    costMissing: !matches.length || ready.length !== matches.length,
    costRows: matches.map(cost => cost.sourceRow).filter(Number.isInteger)
  };
}

// Use the same SKU model boundary as Stock Explorer; the SKU is never displayed.
// PIVOT's explicit quality column takes precedence over any legacy SKU suffix.
export function summaryIdentity(item) {
  const raw = String(item.sku || '').trim();
  const brand = /^TORANI-/i.test(raw) ? 'TORANI ' : '';
  const [base, skuSize = ''] = raw.replace(/^(VING|TORANI)-/i, '').split('#');
  const [modelToken = '', ...colorTokens] = base.split('-');
  const suffix = /_(BB|B\+|A|B|C|D)$/i.exec(modelToken);
  const explicitGrade = clean(item.grade).replace(/^(คุณภาพสินค้า|grade)\s*/i, '').toUpperCase();
  const grade = explicitGrade || suffix?.[1]?.toUpperCase() || (raw ? 'A' : 'ไม่ระบุ');
  const model = brand + (clean(modelToken.replace(/_(BB|B\+|A|B|C|D)$/i, '')) || clean(item.model) || 'ไม่ระบุรุ่น');
  const namedColor = clean(item.color);
  const color = missing(namedColor) || /^(VING|TORANI)[- ]/i.test(namedColor)
    ? clean(colorTokens.join('-')) : namedColor;
  const size = missing(clean(item.size)) ? clean(skuSize) : clean(item.size);
  return {model, grade: grade === 'BB' ? 'B+' : grade, color: missing(color) ? 'ไม่ระบุสี' : color, size: missing(size) ? 'ไม่ระบุไซซ์' : size};
}

export function buildStockSummary(scaleup, pivot, costs = []) {
  const snapshots = {scaleup, pivot};
  const ready = Object.fromEntries(Object.entries(snapshots).map(([source, snapshot]) => [source,
    !!snapshot && Array.isArray(snapshot.items) && snapshot.items.every(item => Number.isFinite(item.available))]));
  const levels = [['model'], ['model', 'grade'], ['model', 'grade', 'color', 'size']];
  const groups = levels.map(() => new Map());
  // Reuse readable model names supplied by PIVOT for accessories. Exact product
  // matches keep separately named designs (e.g. Jibbiz M1–M4) separate; an
  // unambiguous model alias also covers colors/sizes stocked only at Scaleup.
  const names = summaryProductNames(ready.pivot ? pivot.items : []);
  for (const source of ['scaleup', 'pivot']) {
    if (!ready[source]) continue;
    for (const item of snapshots[source].items) {
      const identity = summaryDisplayIdentity(item, names);
      const cost = summaryItemCost(item, costs);
      levels.forEach((fields, index) => {
        const id = JSON.stringify(fields.map(field => key(identity[field])));
        if (!groups[index].has(id)) groups[index].set(id, {
          ...Object.fromEntries(fields.map(field => [field, identity[field]])), scaleup: 0, pivot: 0
        });
        const row = groups[index].get(id);
        row[source] += item.available;
        if (index === 2) Object.assign(row, mergeSummaryCosts(row.costRows ? [row, cost] : [cost]));
        // Retail prices come only from PIVOT, never from cost or another grade.
        if (index === 2 && source === 'pivot') {
          if (Number.isFinite(item.fullPrice) && item.fullPrice >= 0) {
            row.fullPriceMin = Math.min(row.fullPriceMin ?? item.fullPrice, item.fullPrice);
            row.fullPriceMax = Math.max(row.fullPriceMax ?? item.fullPrice, item.fullPrice);
          } else row.priceMissing = true;
        }
      });
    }
  }
  const quantities = row => {
    const scaleup = ready.scaleup ? row.scaleup : null, pivot = ready.pivot ? row.pivot : null;
    return {...row, scaleup, pivot, total: ready.scaleup && ready.pivot ? scaleup + pivot : null};
  };
  const sorted = groups.map(group => [...group.values()].map(quantities).sort((a, b) =>
    compare(a.model, b.model) || ((grades.indexOf(a.grade) - grades.indexOf(b.grade)) || compare(a.grade || '', b.grade || '')) ||
    compare(a.color || '', b.color || '') || compare(a.size || '', b.size || '')));
  const priceGroups = [new Map(), new Map()];
  for (const row of sorted[2]) {
    Object.assign(row, mergeSummaryPrices([row]), mergeSummaryCosts([row]));
    levels.slice(0, 2).forEach((fields, index) => {
      const id = JSON.stringify(fields.map(field => key(row[field])));
      if (!priceGroups[index].has(id)) priceGroups[index].set(id, []);
      priceGroups[index].get(id).push(row);
    });
  }
  levels.slice(0, 2).forEach((fields, index) => {
    for (const row of sorted[index]) {
      const id = JSON.stringify(fields.map(field => key(row[field])));
      Object.assign(row, mergeSummaryPrices(priceGroups[index].get(id)), mergeSummaryCosts(priceGroups[index].get(id)));
    }
  });
  return {
    models: sorted[0], grades: sorted[1], variants: sorted[2],
    totals: quantities(sorted[0].reduce((sum, row) => ({scaleup: sum.scaleup + (row.scaleup || 0), pivot: sum.pivot + (row.pivot || 0)}), {scaleup: 0, pivot: 0})),
    sources: Object.fromEntries(Object.entries(snapshots).map(([source, snapshot]) => [source, {
      ready: ready[source], updatedAt: ready[source] ? snapshot.updatedAt || null : null,
      file: ready[source] ? snapshot.sourceFile?.name || null : null
    }]))
  };
}

export function summaryProductNames(items) {
  const productNames = new Map(), modelNames = new Map();
  for (const item of items) {
    if (/^(Sandals|Sneakers)$/i.test(item.productType || '')) continue;
    const name = clean(item.model);
    if (!/[\u0E00-\u0E7F]/.test(name) && !/^Jibbiz\b/i.test(name)) continue;
    productNames.set(key(item.sku), name);
    const modelKey = key(summaryIdentity(item).model);
    if (!modelNames.has(modelKey)) modelNames.set(modelKey, new Set());
    modelNames.get(modelKey).add(name);
  }
  return {productNames, modelNames};
}

export function summaryDisplayIdentity(item, {productNames, modelNames}) {
  const identity = summaryIdentity(item), names = modelNames.get(key(identity.model));
  identity.model = productNames.get(key(item.sku)) || (names?.size === 1 ? [...names][0] : identity.model);
  if (productNames.has(key(item.sku)) && missing(clean(item.color)) && item.color !== undefined) identity.color = 'ไม่ระบุสี';
  return identity;
}
