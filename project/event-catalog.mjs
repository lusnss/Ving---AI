import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCsv, numberFromCell } from '../marketing-warroom-os-delivery-v2.0.3-marketing-warroom-os/app/lib/mall-sales.mjs';

const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const trim = value => String(value ?? '').replace(/\s+/g,' ').trim();
const identity = value => trim(value).toLocaleLowerCase('th-TH');
const summarize = items => ({count:items.length,with_sales:items.filter(x=>x.sales>0).length,planned:items.filter(x=>x.sales<=0).length,sales:items.reduce((n,x)=>n+x.sales,0)});

export function parseEventCatalog(csv2025, csvDirect, csvGp, fetchedAt = new Date().toISOString()) {
  const past = new Map();
  const months = new Map();
  for (const row of parseCsv(csv2025).slice(1)) {
    if (!trim(row[3]) || !monthNames.includes(trim(row[5]))) continue;
    const name=trim(row[3]), id=identity(name), sales=numberFromCell(row[6]);
    const item=past.get(id)||{name,venue:trim(row[1]),date:trim(row[4]),months:[],sales:0};
    item.sales+=sales;
    const recordedMonth=monthNames.indexOf(trim(row[5]))+1;
    if(!item.months.includes(recordedMonth))item.months.push(recordedMonth);
    past.set(id,item);
    const month=trim(row[5]), entry=months.get(month)||{month,names:new Set(),sales:0};
    entry.names.add(id);entry.sales+=sales;months.set(month,entry);
  }
  const catalog=new Map();
  for (const [csv,category,label] of [[csvDirect,'direct','Event เก็บเงินเอง'],[csvGp,'gp','Event จ่าย GP']]) {
    let month=0, section=0, rowCount=0;
    for (const row of parseCsv(csv)) {
      const heading=trim(row[0]).replace(/^เดือน\s*/, '');
      if (monthNames.includes(heading)) month=monthNames.indexOf(heading)+1;
      if(trim(row[1])==='สาขา'){section++;month=section;}
      if (!/^\d+$/.test(trim(row[0])) || !trim(row[1])) continue;
      rowCount++;
      const name=trim(row[1]), id=identity(name);
      const item=catalog.get(id)||{name,category,categories:[],venue:label,month};
      if (!item.categories.includes(category)) item.categories.push(category);
      catalog.set(id,item);
    }
    if(!rowCount)throw Error(`ไม่พบรายชื่อใน ${label}`);
  }
  if (!past.size || !catalog.size) throw Error('ข้อมูลรายชื่อ Event ไม่ครบ');
  const items=[...past.values()].sort((a,b)=>b.sales-a.sales);
  return {catalog_version:1,source:{file:'สรุปต้นทุนห้าง 2569',online_status:'online',fetched_at:fetchedAt},years:{
    '2025':{year:2025,summary:summarize(items),items,top_events:items.slice(0,8),months:[...months.values()].map(x=>({month:x.month,count:x.names.size,sales:x.sales})).sort((a,b)=>monthNames.indexOf(a.month)-monthNames.indexOf(b.month))},
    '2026':{year:2026,items:[...catalog.values()]}
  }};
}

export async function loadEventCatalog(rootDir) {
  const cache=path.join(import.meta.dirname,'.event-catalog-cache.json');
  let previous;
  try {previous=JSON.parse(await fs.readFile(cache,'utf8'));} catch {}
  if (previous && Date.now()-Date.parse(previous.source.fetched_at)<300_000) return previous;
  try {
    const config=JSON.parse(await fs.readFile(path.join(rootDir,'data/other_ops_source.json'),'utf8'));
    const sourceUrl=new URL(config.url);
    const id=sourceUrl.pathname.match(/^\/spreadsheets\/d\/([\w-]+)\//)?.[1];
    if(sourceUrl.hostname!=='docs.google.com'||sourceUrl.protocol!=='https:'||!id)throw Error('แหล่งข้อมูลไม่ถูกต้อง');
    const csv=await Promise.all(['event_2025','event_2026_direct','event_2026_gp'].map(async key=>{
      const sheet=config[key];
      const url=new URL(sheet.mode==='sheet_name'?`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`:`https://docs.google.com/spreadsheets/d/${id}/export`);
      for(const [k,v] of Object.entries(sheet.mode==='sheet_name'?{tqx:'out:csv',sheet:sheet.name}:{format:'csv',gid:sheet.gid}))url.searchParams.set(k,v);
      const response=await fetch(url,{signal:AbortSignal.timeout(20_000)});
      if(!response.ok)throw Error('โหลดรายชื่อ Event ไม่สำเร็จ');
      const body=await response.text();
      if(Buffer.byteLength(body)>2_000_000||/^\s*</.test(body))throw Error('รูปแบบข้อมูล Event ไม่ถูกต้อง');
      return body;
    }));
    const result=parseEventCatalog(...csv);
    await fs.writeFile(cache,JSON.stringify(result),{mode:0o600});
    return result;
  } catch(error) {
    if(!previous)throw error;
    return {...previous,source:{...previous.source,online_status:'stale',status_message:'รายชื่อ Event ใช้ข้อมูลที่ดึงสำเร็จล่าสุด'}};
  }
}
