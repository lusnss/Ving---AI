import {selectedReportTable,annualReportTables,REPORT_COLUMNS,reportColumnLabel,reportType,dailyCell,zeroSalesDays,weekdayLabel} from './daily-sales.mjs';
import {comparisonKey} from './sales-yoy.mjs';
import {reportExcelWorkbook,downloadExcelWorkbook} from './event-excel.mjs';

const todayThai=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const row=(values,kind='body',extra={})=>({values,kind,...extra});
const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]??0),0);
const status=comparison=>comparison.delta==null?'รอข้อมูลเทียบ':comparison.delta>0?'เติบโต':comparison.delta<0?'ลดลง':'เท่าเดิม';
const label=(key,model)=>key==='branch'?'ชื่อสาขา':key.startsWith('day:')?`${model.selectedPeriod.key}-${key.slice(4)}`:reportColumnLabel(key,REPORT_COLUMNS.find(([id])=>id===key)?.[1]||key,model.useActual);

// Whole-channel selection uses the same channel baseline as the dashboard.
// A subset uses uniquely matched outlets only; unknown baselines stay unknown.
function selectedPrior(model,channel,rows){
  const whole=model.totals.rows.filter(r=>!r.notStarted&&reportType(r)===channel.name);
  if(rows.length===whole.length && whole.every(r=>rows.includes(r)))return {actual:channel.yoySummary.actual,reason:channel.yoySummary.reason};
  let total=0;
  const selected=new Set(rows.map(comparisonKey));
  for(const period of model.scope){
    const key=`${period.year-1}-${String(period.month).padStart(2,'0')}`;
    const prior=model.allPeriods.find(p=>p.key===key&&!p.projected);
    const end=`${key}-${new Date(Date.UTC(period.year-1,period.month,0)).getUTCDate()}`;
    if(!prior || !prior.latest_date || prior.latest_date<end)return {actual:null,reason:'ข้อมูลช่วงเดียวกันปีก่อนไม่ครบ'};
    const current=period.branches.filter(r=>selected.has(comparisonKey(r))&&reportType(r)===channel.name);
    const candidates=prior.branches.filter(r=>reportType(r)===channel.name),used=new Set();
    for(const item of current){
      let matches=candidates.filter(r=>comparisonKey(r)===comparisonKey(item));
      if(matches.length!==1 && item.branch_code && current.filter(r=>r.branch_code===item.branch_code).length===1)matches=candidates.filter(r=>r.branch_code===item.branch_code);
      if(matches.length!==1 || used.has(matches[0]) || matches[0].month_to_date==null || !Number.isFinite(Number(matches[0].month_to_date)))return {actual:null,reason:'จับคู่ฐานปีก่อนของรายการที่เลือกได้ไม่ครบ'};
      used.add(matches[0]);total+=Number(matches[0].month_to_date);
    }
  }
  return {actual:total,reason:null};
}
export function selectedSalesSummary(model,selected){
  return model.channels.map(channel=>{
    const rows=selected.filter(r=>!r.notStarted&&reportType(r)===channel.name);
    if(!rows.length)return null;
    const current=model.useActual?sum(rows,'total'):rows.some(r=>reportType(r)!=='Event'&&r.forecast==null)?null:rows.reduce((n,r)=>n+(r.forecast??r.total),0);
    const prior=selectedPrior(model,channel,rows),delta=prior.actual==null||current==null?null:current-prior.actual;
    return {name:channel.name,count:rows.length,total:sum(rows,'total'),current,actual:prior.actual,delta,percent:delta!=null&&prior.actual>0?delta/prior.actual:null,reason:prior.reason|| (current==null?'ยังไม่มีคาดการณ์':prior.actual===0?'ปีก่อนเป็น 0 คำนวณ % ไม่ได้':prior.actual<0?'ปีก่อนติดลบ คำนวณ % ไม่ได้':'')};
  }).filter(Boolean);
}
function detailColumns(keys,model){
  return keys.flatMap(key=>key==='yoy'?[{key:'yoyActual',label:'ยอดปีก่อน (บาท)'},{key:'yoyDelta',label:'ส่วนต่างปีก่อน (บาท)'},{key:'yoyPercent',label:label(key,model)+' (%)'},{key:'yoyStatus',label:'สถานะเทียบปีก่อน'}]:[{key,label:label(key,model)}]);
}
function detailValue(item,key,model,today){
  if(key==='branch')return item.branch;
  if(key==='type')return reportType(item);
  if(key==='code')return item.branch_code||'';
  if(key==='best')return item.best_date?weekdayLabel(item.best_date):'';
  if(key.startsWith('yoy'))return key==='yoyStatus'?(item.yoy?.reason||({up:'เติบโต',down:'ลดลง',equal:'เท่าเดิม',new:'สาขาเปิดใหม่'})[item.yoy?.status]||'รอข้อมูลเทียบ'):item.yoy?.[{yoyActual:'actual',yoyDelta:'delta',yoyPercent:'percent'}[key]]??null;
  if(item.notStarted)return null;
  if(key.startsWith('day:'))return dailyCell(item,`${model.selectedPeriod.key}-${key.slice(4)}`,model.selectedPeriod,today).value;
  if(key==='zeroDays')return zeroSalesDays(item,model.selectedPeriod,today);
  if(key==='selectedDay')return model.selectedDate?item.daily:null;
  if(key==='forecast')return model.useActual?item.total:item.forecast;
  if(key==='total')return model.selectedPeriod?.projected?null:item.total;
  if(key==='target')return item.target||null;
  return item[key]??null;
}
function appendDetails(rows,columns,items,model,today){
  const headerRow=rows.length+1;
  rows.push(row(columns.map(c=>c.label),'header',{height:48}));
  items.forEach((item,i)=>rows.push(row(columns.map(c=>detailValue(item,c.key,model,today)),i%2?'stripe':'body',{height:36,percentColumns:columns.flatMap((c,j)=>c.key==='yoyPercent'?[j]:[]),decimalColumns:columns.flatMap((c,j)=>['total','target','forecast','gap','selectedDay','yoyActual','yoyDelta'].includes(c.key)||c.key.startsWith('day:')?[j]:[])})));
  return headerRow;
}
export function salesExcelSheets(model,state={},today=todayThai()){
  const selection=selectedReportTable(model,state,today),columns=detailColumns(selection.keys,model);
  const width=9,period=model.month==='all'?`${model.year+543} · ${model.coverage}`:model.selectedPeriod?`${model.selectedPeriod.key} (พ.ศ. ${model.selectedPeriod.year+543})`:'ไม่ระบุช่วง';
  const basis=model.useActual?(model.monthComplete?'ยอดจริงปิดเดือน':'ยอดจริงสะสม'):'ยอดคาดการณ์ปิดเดือน';
  const rows=[row(['VING Sales Report'],'title',{merge:width,height:38}),row([`${period} · วันที่รายงาน ${model.dateMode==='month-end'?'ปิดเดือน':model.selectedDate||'รวมช่วงที่เลือก'} · ${basis}`],'stripe',{merge:width,height:32}),row([`ยอดสะสมจากต้นทางถึง ${model.scope.map(p=>p.latest_date).filter(Boolean).sort().at(-1)||'ยังไม่มีข้อมูล'} · สรุปเฉพาะ ${selection.rows.length} รายการที่ส่งออก`],'body',{merge:width,height:32}),row([`ค้นหาสาขา: ${state.branchQuery||'ทั้งหมด'} · ตัวกรองคอลัมน์ ${Object.keys(selection.filters).length} รายการ · เลือก ${selection.keys.length} คอลัมน์ (เทียบปีก่อนแยกจำนวนเงินและ %)`],'body',{merge:width,height:32}),row(['ช่องทาง','จำนวนจุดขาย','ยอดจริงสะสม (บาท)',basis+' (บาท)','ยอดปีก่อน (บาท)','เพิ่ม / ลด (บาท)','เพิ่ม / ลด (%)','แนวโน้ม','หมายเหตุ'],'header',{height:48})];
  const groups=selectedSalesSummary(model,selection.rows);
  for(const group of groups){
    const n=rows.length+1,formulas={};
    if(group.delta!=null)formulas[5]=`D${n}-E${n}`;
    if(group.percent!=null)formulas[6]=`F${n}/E${n}`;
    rows.push(row([group.name,group.count,group.total,group.current,group.actual,group.delta,group.percent,status(group),group.reason],rows.length%2?'stripe':'body',{height:42,decimalColumns:[2,3,4,5],percentColumns:[6],formulas}));
  }
  if(groups.length){
    const n=rows.length+1,last=n-1,current=groups.every(g=>g.current!=null)?sum(groups,'current'):null,actual=groups.every(g=>g.actual!=null)?sum(groups,'actual'):null,delta=current!=null&&actual!=null?current-actual:null,percent=delta!=null&&actual>0?delta/actual:null;
    const formulas={1:`SUM(B6:B${last})`,2:`SUM(C6:C${last})`};
    if(current!=null)formulas[3]=`SUM(D6:D${last})`;if(actual!=null)formulas[4]=`SUM(E6:E${last})`;if(delta!=null)formulas[5]=`D${n}-E${n}`;if(percent!=null)formulas[6]=`F${n}/E${n}`;
    rows.push(row(['รวม',sum(groups,'count'),sum(groups,'total'),current,actual,delta,percent,status({delta}),actual==null?'ฐานเทียบไม่ครบทุกช่องทาง':''],'total',{height:36,decimalColumns:[2,3,4,5],percentColumns:[6],formulas}));
  }else rows.push(row(['ไม่มีรายการที่ตรงกับตัวกรอง'],'body',{merge:width}));
  rows.push(row(['ส่วนต่าง = ยอดที่ใช้เทียบ − ยอดปีก่อน · % ใช้ยอดปีก่อนเป็นฐาน · ช่องว่างหมายถึงไม่มีข้อมูลพอ ไม่ใช่ยอด 0'],'stripe',{merge:width,height:36}));
  rows.push(row(['เมื่อเลือกเฉพาะบางสาขา ใช้ฐานปีก่อนของสาขาที่จับคู่ได้ครบ · เลือกทั้งช่องทาง ใช้ยอดเต็มช่องทางของแต่ละปี'],'body',{merge:width,height:36}));
  rows.push(row(['แหล่งข้อมูล: Sales Report 2026 PC VING.xlsx และข้อมูลปีก่อนที่แสดงบน VING Warroom'],'body',{merge:width,height:30}));
  rows.push(row(['https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site/daily-sales'],'body',{merge:width}),row(['เปิดชีต “รายสาขา” เพื่อดูยอดขายแยกสาขาตามตัวกรองและคอลัมน์ที่เลือก'],'group',{merge:width,height:36}));
  const detailWidth=Math.max(1,columns.length);
  const details=[row(['VING · ยอดขายรายสาขา'],'title',{merge:detailWidth,height:38}),...rows.slice(1,4).map(r=>({...r,merge:detailWidth}))];
  const headerRow=appendDetails(details,columns,selection.rows,model,today);
  if(!selection.rows.length)details.push(row(['ไม่มีรายการที่ตรงกับตัวกรอง'],'body',{merge:detailWidth}));
  const widths=columns.map((c,i)=>i===0?38:c.key==='yoyStatus'?34:c.key==='code'?20:c.key.startsWith('day:')?15:22);
  const sheets=[
    {name:'Sales Report',rows,widths:[38,20,24,24,24,24,22,22,38],freezeRows:5,freezeCols:1},
    {name:'รายสาขา',rows:details,widths,freezeRows:headerRow,freezeCols:1,table:selection.rows.length?{name:'SalesBranches',headerRow,endRow:details.length}:undefined}
  ];
  for(const table of annualReportTables(model,state,today)){
    const monthly={...model,selectedPeriod:table.period,selectedDate:''},cols=detailColumns(table.keys,monthly),r=[row([`ยอดรายวัน ${table.period.key}`],'title',{merge:cols.length,height:38})];
    const header=appendDetails(r,cols,table.rows,monthly,today);
    sheets.push({name:table.period.key,rows:r,widths:cols.map((c,i)=>i===0?38:15),freezeRows:header,freezeCols:1,table:table.rows.length?{name:'Sales'+table.period.key.replace('-',''),headerRow:header,endRow:r.length}:undefined});
  }
  return sheets;
}
export const salesExcelWorkbook=(model,state,today)=>reportExcelWorkbook(salesExcelSheets(model,state,today));
export function downloadSalesExcel(model,state){downloadExcelWorkbook(salesExcelWorkbook(model,state),`VING-Sales-${model.month==='all'?model.year:model.month||'report'}-${model.selectedDate||model.dateMode}.xlsx`);}
