import assert from 'node:assert/strict';
import {test} from 'node:test';
import {previewDatabase} from './preview-db.mjs';
import seed from './pivot-inventory.snapshot.json' with {type:'json'};
import scaleup from './inventory-initial.json' with {type:'json'};
import {readPivotInventory,enrichInventoryPrices} from './pivot-inventory.mjs';
import {handleInventory} from './inventory-data.mjs';
import {activitySources} from './activities-data.mjs';

test('file import preserves all SKU/grade rows, prices, zeroes and quantities by unit',()=>{
 assert.equal(seed.items.length,694);assert.equal(new Set(seed.items.map(r=>r.id)).size,694);
 assert.equal(new Set(seed.items.map(r=>r.sku.toUpperCase())).size,594);
 assert.equal(seed.items.reduce((n,r)=>n+r.available,0),28054);
 assert.deepEqual(seed.summary.units,{'กล่อง':79,'คู่':17631,'ชิ้น':10286,'ตัว':58});
 assert.equal(seed.items.filter(r=>r.fullPrice===0).length,10);
 const variants=seed.items.filter(r=>r.sku==='VING-Kirion1.5-Turtle_Dove#40');
 assert.deepEqual(variants.map(r=>[r.grade,r.available,r.fullPrice]),[['A',258,1800],['C',4,1800],['D',2,1800]]);
 assert.equal(seed.items.at(-1).sourceRow,695);
});
test('import is durable and idempotent, never overwrites Scaleup or a newer PIVOT import',async()=>{
 const DB=previewDatabase();try{
 await DB.prepare('INSERT INTO inventory_snapshots (source,payload,updated_at) VALUES (?,?,?)').bind('scaleup',JSON.stringify(scaleup),scaleup.updatedAt).run();
 await Promise.all([readPivotInventory({DB}),readPivotInventory({DB})]);
 assert.deepEqual(await readPivotInventory({DB}),seed);
 const stored=await DB.prepare('SELECT payload FROM inventory_snapshots WHERE source = ?').bind('scaleup').first();assert.deepEqual(JSON.parse(stored.payload),scaleup);
 const newer={...seed,updatedAt:'2099-01-01T00:00:00Z',sourceFile:{...seed.sourceFile,sha256:'newer-file'},items:[]};
 await DB.prepare('UPDATE inventory_snapshots SET payload=?,updated_at=? WHERE source=?').bind(JSON.stringify(newer),newer.updatedAt,'pivot').run();assert.deepEqual(await readPivotInventory({DB}),newer);
 }finally{DB.close();}
});
test('price matching preserves zero, requires consistent identifiers/grade and refuses conflicting prices',()=>{
 const pivot={...seed,items:[{sku:'VING-X-Red#40',barcode:'001',grade:'A',fullPrice:100,sourceRow:2},{sku:'VING-X-Red#40',barcode:'001',grade:'B',fullPrice:90,sourceRow:3},{sku:'VING-Gift',barcode:'002',grade:'A',fullPrice:0,sourceRow:4},{sku:'VING-X_BB-Red#40',barcode:'003',grade:'A',fullPrice:100,sourceRow:5}]};
 const products=[{sku:'ving-x-red#40',barcode:'001',grade:'A',available:9},{sku:'VING-X-Red#40',barcode:'001',grade:'B'},{sku:'VING-X-Red#40',barcode:'001'},{sku:'VING-X-Red#40',barcode:'999',grade:'A'},{sku:'VING-Gift',barcode:'002'},{sku:'unknown',barcode:'001',grade:'A'},{sku:'unknown',barcode:'000'},{sku:'VING-X_BB-Red#40',barcode:'003'}];
 const result=enrichInventoryPrices({items:products},pivot);
 assert.deepEqual(result.items.map(r=>r.fullPrice),[100,90,null,null,0,100,null,null]);
 assert.equal(result.items[0].available,9);assert.equal(products[0].fullPrice,undefined);
 assert.deepEqual(result.items[1].priceReference.rows,[3]);
});
test('inventory and activities serve imported retail prices without changing available stock or fetching upstream',async()=>{
 const DB=previewDatabase();try{
 const req=new Request('https://example.test/api/inventory');
 const response=await handleInventory(req,{DB},scaleup,()=>{throw Error('must not fetch');});assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.pivot.items.length,694);assert.deepEqual(data.snapshot.summary,scaleup.summary);
 assert.deepEqual(data.snapshot.items.map(r=>r.available),scaleup.items.map(r=>r.available));
 const clean=data.snapshot.items.find(r=>r.sku==='VING-Ultra_Clean_Solution');assert.equal(clean.fullPrice,200);
 const sources=await activitySources({DB},scaleup,null,async()=>({items:[]}));assert.equal(sources.inventory.items.find(r=>r.sku===clean.sku).fullPrice,200);
 assert.ok(data.snapshot.items.some(r=>r.fullPrice===null));
 console.log('Scaleup retail price coverage:',data.snapshot.items.filter(r=>r.fullPrice!==null).length,'of',data.snapshot.items.length);
 }finally{DB.close();}
});
