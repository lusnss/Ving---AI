// Read-only Google Sheets adapter. Only allow-listed financial fields leave here.
const BOOK = '1HtT3m5DlxoxtB6l-JsYxgUeZniXoixDBcGKgoH3X1m4';
export const costFields = ['rent','electricity','pc','shipping','depreciation','interest','landTax','mallDeduction','marketing','misc'];
const text = value => String(value ?? '').trim();
const number = value => {if(value===null||value===undefined||text(value)==='')return null;const normalized=text(value).replaceAll(',','');if(!/^-?\d+(\.\d+)?$/.test(normalized))return null;const result=Number(normalized);return Number.isFinite(result)?result:null;};
const safeName = value => text(value).replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[ปกปิด]').replace(/(?:\+66|0)[ -]?[689](?:[ -]?\d){8}\b/g,'[ปกปิด]').slice(0,180);
export function parseGoogleTable(body) {
  const value = JSON.parse(body.slice(body.indexOf('{'),body.lastIndexOf('}')+1));
  if(value.status !== 'ok' || !Array.isArray(value.table?.rows)) throw Error('รูปแบบชีตไม่ถูกต้อง');
  return value.table.rows.map(row => row.c.map(cell => cell?.v ?? null));
}
function finish(record) {
  const values = Object.values(record.costs);
  record.missingCosts = values.filter(v=>v===null).length + (record.cogs===null ? 1 : 0);
  record.opex = values.some(v=>v!==null) ? values.reduce((sum,v)=>sum+(v??0),0) : null;
  record.grossProfit = record.net!==null && record.cogs!==null ? record.net-record.cogs : null;
  record.profit = record.grossProfit!==null && record.opex!==null ? record.grossProfit-record.opex : null;
  record.difference = record.profit!==null && record.sourceProfit!==null ? record.profit-record.sourceProfit : null;
  return record;
}
export function buildProfitLoss(tables, fetchedAt = new Date().toISOString()) {
  const {consign,standalone,periods,direct,gp} = tables;
  const date = standalone.find(row=>text(row[0])==='วันที่ปัจจุบัน')?.[1];
  const match = text(date).match(/(20\d{2}|25\d{2})/);
  if(!match) throw Error('ไม่พบปีต้นทาง');
  const year = Number(match[1])>2400 ? Number(match[1])-543 : Number(match[1]);
  if(periods.length!==2 || periods[0].length!==12 || !periods[0].every(v=>text(v).startsWith('เดือน'))) throw Error('หัวเดือน Stand alone เปลี่ยนรูปแบบ');
  const records=[];
  for(const row of consign) {
    if(!['ACT','FCT'].includes(text(row[0]))) continue;
    const month=Number(text(row[1]).match(/^\d{1,2}/)?.[0]);
    if(month<1||month>12||!month||!text(row[6])) throw Error('เดือน Consign ไม่ถูกต้อง');
    const costs=Object.fromEntries(['rent','mallDeduction','pc','shipping','marketing','misc'].map((field,i)=>[field,number(row[12+i])]));
    records.push(finish({year,month,basis:text(row[0]),channel:'consign',name:safeName(row[6]),code:safeName(row[4]),gross:number(row[7]),discount:number(row[8]),net:number(row[9]),cogs:number(row[10]),costs,sourceProfit:number(row[19])}));
  }
  if(!records.length) throw Error('ไม่พบรายละเอียด Consign');
  const mappings = {'ยอดขาย':'gross','หักส่วนลด':'discount','ยอดขายหลังจากหักส่วนลด':'net','ต้นทุนสินค้า':'cogs','ยอดหักGP/ค่าเช่า':'rent','ค่าไฟ':'electricity','ต้นทุนค่าPC':'pc','ต้นทุนค่าขนส่ง (ไพวอท+ขนส่งนอก)':'shipping','ค่าเสื่อมเฟอร์นิเจอร์+ค่าตกแต่ง':'depreciation','ดอกเบี้ยค่ามัดจำพื้นที่ (8%/ปี)':'interest','ค่าภาษีที่ดิน (0.3%)':'landTax','การตลาด (โปสเตอร์รายเดือน)':'marketing','อื่นๆ (เงินสดย่อย)':'misc','กำไร':'sourceProfit'};
  const branches=new Map();
  for(const row of standalone) {
    const name=text(row[0]),field=mappings[text(row[1])];
    if(!name||name==='รวมยอดขาย'||!field) continue;
    if(!branches.has(name)) branches.set(name,{});
    const fields=branches.get(name);
    if(fields[field]) throw Error('ชื่อสาขา Stand alone ซ้ำ');
    fields[field]=row.slice(2,14);
  }
  if(!branches.size) throw Error('ไม่พบสาขา Stand alone');
  for(const [name,fields] of branches) for(let offset=0;offset<12;offset++) {
    if(!fields.net || !fields.cogs || !fields.gross || !fields.sourceProfit) throw Error('รายการ Stand alone ไม่ครบ');
    const costs=Object.fromEntries(costFields.filter(f=>f!=='mallDeduction').map(f=>[f,number(fields[f]?.[offset])]));
    const amounts=Object.fromEntries(['gross','discount','net','cogs','sourceProfit'].map(f=>[f,number(fields[f]?.[offset])]));
    // Empty future templates are not actual zero revenue.
    if(amounts.gross===null && amounts.net===null) continue;
    records.push(finish({year,month:offset+1,basis:text(periods[1][offset])==='FCT'?'FCT':'ACT',channel:'standalone',name:safeName(name),code:'',...amounts,costs}));
  }
  for(const [rows,channel,fields,profitColumn] of [[direct,'event-direct',['rent','pc','shipping','marketing','misc'],14],[gp,'event-gp',['rent','mallDeduction','pc','shipping','marketing','misc'],15]]) {
    let month=0;
    for(const row of rows) {
      if(text(row[1])==='สาขา') {month++;continue;}
      if(!/^\d+$/.test(text(row[0]))||!text(row[1])) continue;
      if(month<1||month>12) throw Error('หัวเดือน Event ไม่ครบ');
      const gross=number(row[4]),net=number(row[6]);
      const costs=Object.fromEntries(fields.map((f,i)=>[f,number(row[9+i])]));
      const cogs=number(row[7]),sourceProfit=number(row[profitColumn]);
      if(gross===null&&net===null&&![cogs,sourceProfit,...Object.values(costs)].some(v=>v!==null&&v!==0)) continue;
      records.push(finish({year,month,basis:'ACT',channel,name:safeName(row[1]),code:'',gross,discount:number(row[5]),net,cogs,costs,sourceProfit}));
    }
    if(month!==12) throw Error('หัวเดือน Event เปลี่ยนรูปแบบ');
  }
  return {version:1,year,source:{file:'สรุปต้นทุนห้าง 2569',sheets:['Consign','Stand alone','Event เก็บเงินเอง','Event จ่าย GP'],fetched_at:fetchedAt,status:'online'},records};
}
export async function fetchProfitLoss(fetchImpl=fetch) {
  const requests=[['consign','Consign'],['standalone','Stand alone'],['periods','Stand alone','C5:N6'],['direct','Event เก็บเงินเอง'],['gp','Event จ่าย GP']];
  const entries=await Promise.all(requests.map(async([key,sheet,range])=>{
    const url=new URL(`https://docs.google.com/spreadsheets/d/${BOOK}/gviz/tq`);
    url.searchParams.set('tqx','out:json');url.searchParams.set('headers','0');url.searchParams.set('sheet',sheet);
    if(range)url.searchParams.set('range',range);
    const response=await fetchImpl(url.href,{signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error('อ่านชีตต้นทุนไม่สำเร็จ');
    const body=await response.text();
    if(body.length>2_000_000) throw Error('ชีตต้นทุนมีขนาดเกินกำหนด');
    return [key,parseGoogleTable(body)];
  }));
  return buildProfitLoss(Object.fromEntries(entries));
}
let profitLossPending;
let profitLossMemory;
export async function loadProfitLoss(env, fallback, fetchImpl=fetch) {
  if(!env.FORCE_DATA_REFRESH&&profitLossMemory&&profitLossMemory.checked>=(env.DATA_REFRESH_SOURCES?.['/api/profit-loss']||env.DATA_REFRESH_AFTER||0)&&Date.now()-profitLossMemory.checked<300_000)return profitLossMemory.value;
  if(profitLossPending){await profitLossPending;if(!env.FORCE_DATA_REFRESH)return profitLossMemory.value;}
  profitLossPending=(async()=>{
    let previous=fallback;
    try {const stored=await env.BUCKET.get('profit-loss.json');if(stored){const value=await stored.json();if(value.version===1&&Array.isArray(value.records))previous=value;}}catch{}
    if(!env.FORCE_DATA_REFRESH&&previous&&Date.parse(previous.source.fetched_at)>=(env.DATA_REFRESH_SOURCES?.['/api/profit-loss']||env.DATA_REFRESH_AFTER||0)&&Date.now()-Date.parse(previous.source.fetched_at)<300_000){profitLossMemory={checked:Date.now(),value:previous};return previous;}
    try {
      const value=await fetchProfitLoss(fetchImpl);
      // Persist only financial records, never the raw workbook or source URLs.
      try{await env.BUCKET.put('profit-loss.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}catch{if(env.FORCE_DATA_REFRESH)throw Error('Unable to persist refreshed source');}
      profitLossMemory={checked:Date.now(),value};return value;
    }catch{
      if(!previous)throw Error('ยังอ่านข้อมูลต้นทุนไม่ได้');
      const value={...previous,source:{...previous.source,status:'stale'}};
      profitLossMemory={checked:Date.now(),value};return value;
    }
  })().finally(()=>{profitLossPending=null;});
  return profitLossPending;
}
