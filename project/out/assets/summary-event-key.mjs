// Stable across month/day views and catalog ordering; never use a rendered row index.
export function summaryEventKey(item,year){
 if(item.proposalKey)return 'proposal:'+item.proposalKey;
 const normalize=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
 return JSON.stringify(['catalog',Number(item.year||year),normalize(item.name),
  [...new Set(item.categories||[item.category||''])].sort(),normalize(item.date||item.dates),
  item.range?.start||'',item.range?.end||'',item.range?null:item.month||null]);
}
