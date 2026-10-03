export const productCostSource={file:'Cost Production 250669',sheet:'ต้นทุนขายล่าสุด_230726',url:'https://docs.google.com/spreadsheets/d/1fjLNGxGyraxmKRMVignkpcySJ9rSCFlfHTfsU4r5I-E/edit?gid=0#gid=0'};
function parseCostCsv(csv){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&csv[i+1]==='\n')i++;}else cell+=c;}
 if(quoted)throw Error('Incomplete CSV');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function costNumber(value){const text=String(value??'').trim().replaceAll(',','');if(!text)return null;if(!/^-?\d+(\.\d+)?$/.test(text)||!Number.isFinite(Number(text)))throw Error('Invalid cost');return Number(text);}
export function productCostItems(rows,startRow=6,{purchaseColumn=false}={}){
 return rows.flatMap((r,i)=>{
  if(!['SHOES','SOCKS','ACC','Apparel'].includes(r[2]))return [];
  if(!r[0]||String(r[0]).length>200)throw Error('Missing product');
  // Only product fields and recognized review notes leave the source workbook.
  const note=String(r[purchaseColumn?33:32]||'');const reviewNote=/รอแก้ไข/.test(note)?'รอแก้ไข':/รออัพเดท|รออัปเดต/.test(note)?'รออัปเดต'+(note.includes('ค่าพิมพ์ลายเขาใหญ่')?' + ค่าพิมพ์ลายเขาใหญ่':''):'';
  const n=j=>costNumber(r[j]);
  return [{sourceRow:i+startRow,model:String(r[0]).trim(),grade:String(r[1]||'').trim(),type:r[2],description:String(r[3]||'').trim(),factory:String(r[4]||'').trim(),packaging:['BPKG','NBPKG','BOTH'].includes(r[5])?r[5]:'',production:Array.from({length:6},(_,j)=>n(j+6)),compound:Array.from({length:6},(_,j)=>n(j+12)),extra:n(18),packagingCost:n(19),readyCosts:Array.from({length:6},(_,j)=>n(j+20)),max:n(26),min:n(27),beforeVat:n(28),warehouse:n(29),vat:n(30),includingVat:n(31),currentPurchaseCost:purchaseColumn?n(32):null,note:reviewNote}];
 });
}
export function buildProductCosts(csv,fetchedAt=new Date().toISOString()){
 const rows=parseCostCsv(csv.replace(/^\uFEFF/,''));const head=rows[1]||[];
 const expected={0:'MODEL',1:'GRADE',2:'TYPE',4:'FACTORY',18:'EXTRA',19:'TOTAL PKG',26:'MAX',27:'MIN',28:'FG EX.VAT',29:'ค่านำสินค้าเข้าคลัง',30:'VAT7%',31:'FG INC.VAT'};
 const normalized=head.map(v=>String(v||'').replace(/\s+/g,' ').trim());
 if(Object.entries(expected).some(([i,v])=>normalized[i]!==v&&!(Number(i)===28||Number(i)===31?normalized[i]==='AVG '+v:false))||rows[4]?.[0]!=='รุ่น')throw Error('Cost sheet structure changed');
 const purchaseColumn=normalized[32]==='ตอนนี้ซื้อราคานี้';
 if(purchaseColumn&&normalized[33]!=='Remark')throw Error('Cost note column changed');
 return {version:1,source:{...productCostSource,fetched_at:fetchedAt,status:'online',purchaseColumn},items:productCostItems(rows.slice(5),6,{purchaseColumn})};
}
export function createProductCostLoader({fetchImpl=fetch,now=Date.now,ttl=60000}={}){
 let memory,pending;
 return async function load(env,fallback){
  if(!env.FORCE_DATA_REFRESH&&memory&&memory.checked>=(env.DATA_REFRESH_SOURCES?.['/api/product-costs']||env.DATA_REFRESH_AFTER||0)&&now()-memory.checked<ttl)return memory.value;if(pending){await pending;if(!env.FORCE_DATA_REFRESH)return memory.value;}
  pending=(async()=>{
   let previous=memory?.value||fallback;
   try{const stored=await env.BUCKET?.get('product-costs-v1.json');if(stored){const value=await stored.json();if(value.version===1&&Array.isArray(value.items)&&value.source?.fetched_at&&(!previous||Date.parse(value.source.fetched_at)>Date.parse(previous.source.fetched_at)))previous=value;}}catch{}
   try{
    const url=new URL('https://docs.google.com/spreadsheets/d/1fjLNGxGyraxmKRMVignkpcySJ9rSCFlfHTfsU4r5I-E/export');url.search=new URLSearchParams({format:'csv',gid:'0',range:'A1:AH1029',_:String(now())});
    const response=await fetchImpl(url.href,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Source unavailable');const body=await response.text();if(body.length>1000000)throw Error('Source too large');
    const value=buildProductCosts(body,new Date(now()).toISOString());
    try{await env.BUCKET?.put('product-costs-v1.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}
    memory={checked:now(),value};return value;
   }catch{
    const value=previous?{...previous,source:{...previous.source,status:'stale'}}:{version:1,source:{...productCostSource,status:'unavailable',fetched_at:null},items:[]};memory={checked:now(),value};return value;
   }
  })().finally(()=>{pending=null;});return pending;
 };
}
export const loadProductCosts=createProductCostLoader();
