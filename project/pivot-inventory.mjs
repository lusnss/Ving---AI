import pivotInventorySeed from './pivot-inventory.snapshot.json' with {type:'json'};

// Import the supplied file once into durable storage. Keep newer imports intact.
export async function readPivotInventory(env){
 const saved=await env.DB.prepare('SELECT payload FROM inventory_snapshots WHERE source = ?').bind('pivot').first();
 const snapshot=saved?.payload?JSON.parse(saved.payload):null;
 if(snapshot&&(snapshot.sourceFile?.sha256===pivotInventorySeed.sourceFile.sha256||snapshot.updatedAt>=pivotInventorySeed.updatedAt))return snapshot;
 const imported=await env.DB.prepare('INSERT INTO inventory_snapshots (source,payload,updated_at) VALUES (?,?,?) ON CONFLICT(source) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE inventory_snapshots.updated_at IS NULL OR inventory_snapshots.updated_at < excluded.updated_at RETURNING payload').bind('pivot',JSON.stringify(pivotInventorySeed),pivotInventorySeed.updatedAt).first();
 if(imported?.payload)return JSON.parse(imported.payload);
 const latest=await env.DB.prepare('SELECT payload FROM inventory_snapshots WHERE source = ?').bind('pivot').first();
 if(!latest?.payload)throw Error('ยังอ่านข้อมูล PIVOT ที่บันทึกไว้ไม่ได้');
 return JSON.parse(latest.payload);
}

const pivotIdentifier=v=>String(v||'').trim().toUpperCase();
function pivotProductGrade(product){
 const grade=pivotIdentifier(product.grade).replace(/^คุณภาพสินค้า\s*|^GRADE\s*/,'');
 const model=pivotIdentifier(product.sku).replace(/^(VING|TORANI)-/,'').split('-')[0];
 const suffix=/(?:_|\bGRADE\s*)(BB|B\+|A|B|C|D)$/.exec(model)?.[1];
 const named=/\bGRADE\s*(B\+|A|B|C|D)(?=$|[\s_-])/i.exec(product.name||'')?.[1]?.toUpperCase();
 const result=grade||suffix||named||'';
 return result==='BB'?'B+':result;
}
export function enrichInventoryPrices(snapshot,pivot){
 if(!snapshot)return snapshot;
 const skus=new Map(),barcodes=new Map();
 for(const row of pivot?.items||[]){for(const [index,key]of [[skus,pivotIdentifier(row.sku)],[barcodes,pivotIdentifier(row.barcode)]])if(key){if(!index.has(key))index.set(key,[]);index.get(key).push(row);}}
 return {...snapshot,items:snapshot.items.map(product=>{
  const sku=pivotIdentifier(product.sku),barcode=pivotIdentifier(product.barcode),grade=pivotProductGrade(product);
  let matches=skus.get(sku)||barcodes.get(barcode)||[];
  // A known barcode or grade must agree. Never borrow a price from another grade.
  if(barcode&&matches.some(r=>r.barcode))matches=matches.filter(r=>pivotIdentifier(r.barcode)===barcode);
  if(grade)matches=matches.filter(r=>r.grade===grade);
  const prices=new Set(matches.map(r=>r.fullPrice));
  const ready=matches.length&&prices.size===1&&Number.isFinite(matches[0].fullPrice)&&matches[0].fullPrice>=0;
  return {...product,fullPrice:ready?matches[0].fullPrice:null,priceReference:ready?{source:'pivot',fileName:pivot.sourceFile.name,sheet:pivot.sourceFile.sheet,rows:matches.map(r=>r.sourceRow),importedAt:pivot.updatedAt}:null};
 })};
}
