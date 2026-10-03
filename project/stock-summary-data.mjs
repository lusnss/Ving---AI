import {buildStockSummary} from './out/assets/stock-summary-model.mjs';
import summaryPivotSeed from './pivot-inventory.snapshot.json' with {type: 'json'};
import {loadSavedSummarySales} from './stock-summary-sales-data.mjs';

export async function loadStockSummary(env, scaleupInitial, loadCosts = async () => null, {includeSales = false} = {}) {
  const read = async (source, initial) => {
    try {
      const saved = await env.DB.prepare('SELECT payload FROM inventory_snapshots WHERE source = ?').bind(source).first();
      if (!saved?.payload) return initial;
      const snapshot = JSON.parse(saved.payload);
      // A later file import may not have been persisted yet. Never replace a newer saved snapshot.
      if (source === 'pivot' && Date.parse(initial?.updatedAt) > Date.parse(snapshot?.updatedAt)) return initial;
      return snapshot;
    } catch { return null; }
  };
  const [scaleup, pivot, costs] = await Promise.all([read('scaleup', scaleupInitial), read('pivot', summaryPivotSeed),
    Promise.resolve().then(loadCosts).catch(() => null)]);
  const report = buildStockSummary(scaleup, pivot, Array.isArray(costs?.items) ? costs.items : []);
  report.sources.cost = costs?.source || {status: 'unavailable'};
  if (includeSales) report.salesHistory = await loadSavedSummarySales(env, pivot);
  return report;
}
