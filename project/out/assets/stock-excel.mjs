import {buildStockGrid,stockGridIdentity} from './stock-grid.mjs';
import {summarizeStock} from './stock-filters.mjs';
import {reportExcelWorkbook,downloadExcelWorkbook} from './event-excel.mjs';
const metrics={normal:'สต็อกปกติ',hold:'On-Hold',total:'รวมทั้งหมด'};
const grades={normal:'สินค้าปกติ',grade_b_plus:'Grade B+',grade_b:'Grade B'};
export function stockExcelSheets(items,products=[],options={}){
 const metric=Object.hasOwn(metrics,options.metric)?options.metric:'normal',groups=buildStockGrid(items,metric,products),summary=summarizeStock(items);
 const stamp=value=>value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ไม่ระบุ';
 const scope=[options.branchType||'ทุกประเภท',options.branch||'รวมทุกสาขา',grades[options.grade]||'ทุกเกรด',options.model||'ทุกรุ่น'].join(' · ');
 const row=(values,kind='body',extra={})=>({values,kind,...extra});
 const intro=(title,width)=>[row([title],'title',{merge:width,height:38}),row([scope],'body',{merge:width,height:36}),row([`ดึงข้อมูล ${stamp(options.fetchedAt)} · ต้นทางอัปเดต ${stamp(options.lastUpdatedAt)}`],'stripe',{merge:width,height:32})];
 const summaryRows=[...intro('VING | สรุปสต็อกสาขา',5),row(['สต็อกปกติ','On-Hold','รวม','SKU ที่พบ',''],'header'),row([summary.normal,summary.hold,summary.total,summary.skus,''],'total',{height:34}),row(['ประเภทสาขา',options.branchType||'ทุกประเภท']),row(['สาขา',options.branch||'รวมทุกสาขา']),row(['เกรด',grades[options.grade]||'ทุกเกรด']),row(['รุ่นที่เลือก',options.model||'ทุกรุ่น']),row(['คำค้นหารุ่น',options.query||'ทั้งหมด']),row(['คำค้นหา SKU',options.sourceQuery||'ทั้งหมด']),row(['จำนวนที่แสดงในตารางไซซ์',metrics[metric]]),row(['ข้อมูล ณ เวลาดาวน์โหลด · Excel ไม่อัปเดตตามเว็บอัตโนมัติ'],'stripe',{merge:5}),row([]),row(['รุ่น / เกรด','สต็อกปกติ','On-Hold','รวม','SKU ที่พบ'],'header')];
 const byModel=new Map();for(const item of items){const id=stockGridIdentity(item),key=id.section+' · '+grades[id.grade];if(!byModel.has(key))byModel.set(key,[]);byModel.get(key).push(item);}
 [...byModel].sort(([a],[b])=>a.localeCompare(b,'th',{numeric:true})).forEach(([name,list],i)=>{const s=summarizeStock(list);summaryRows.push(row([name,s.normal,s.hold,s.total,s.skus],i%2?'stripe':'body'));});
 summaryRows.push(row(['รวม',summary.normal,summary.hold,summary.total,summary.skus],'total'));
 const gridWidth=Math.max(6,...groups.flatMap(g=>g.sections.map(s=>s.sizes.length+2)));
 const gridRows=[...intro(`VING | ตารางไซซ์ · ${metrics[metric]}`,gridWidth),row([`ค้นหารุ่น: ${options.query||'ทั้งหมด'} · ค้นหา SKU: ${options.sourceQuery||'ทั้งหมด'} · — หมายถึง 0`],'body',{merge:gridWidth}),row([])];
 for(const group of groups)for(const section of group.sections){
  gridRows.push(row([`${section.section} · ${group.label} · ${section.total.toLocaleString('th-TH')} ${metrics[metric]}`],'group',{merge:gridWidth,height:34}),row(['สี / ไซซ์',...section.sizes,'รวม'],'header'));
  section.rows.forEach((r,i)=>gridRows.push(row([r.name.slice(section.section.length+3),...section.sizes.map(size=>r.cells.get(size)||0),r.total],i%2?'stripe':'body',{totalColumn:section.sizes.length+1})));
  gridRows.push(row(['รวม',...section.sizes.map(size=>section.rows.reduce((sum,r)=>sum+(r.cells.get(size)||0),0)),section.total],'total'),row([]));
 }
 if(!groups.length)gridRows.push(row(['ไม่พบจำนวนในมุมมองที่เลือก'],'body',{merge:gridWidth}));
 const skuRows=[...intro('VING | รายการ SKU',10),row(['SKU','บาร์โค้ด','เกรด','รุ่น','สี','ไซซ์','สต็อกปกติ','On-Hold','รวม','จำนวนสาขา'],'header'),...items.map((item,i)=>{const id=stockGridIdentity(item);return row([item.sku,item.barcode||'',grades[id.grade],id.section,id.rowName.slice(id.section.length+3),id.size,item.normal,item.hold,item.total,item.branchCount??''],i%2?'stripe':'body');})];
 return [{name:'สรุป',rows:summaryRows,widths:[42,38,22,22,18],freezeRows:5},{name:'ตารางไซซ์',rows:gridRows,widths:[32,...Array(gridWidth-1).fill(12)],freezeRows:4,freezeCols:1},{name:'SKU',rows:skuRows,widths:[44,22,18,24,26,12,18,16,16,18],freezeRows:4,freezeCols:1,filterRow:4}];
}
export function stockExcelWorkbook(items,products=[],options={}){return reportExcelWorkbook(stockExcelSheets(items,products,options));}
export function downloadStockExcel(items,products=[],options={}){
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
 downloadExcelWorkbook(stockExcelWorkbook(items,products,options),`VING-Stock-${options.metric||'normal'}-${date}.xlsx`);
}
