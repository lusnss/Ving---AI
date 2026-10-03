import {eventPnl} from './event-pnl.mjs';
import {eventMonthNames} from './event-months.mjs';

export function monthlyPnlSummary(items,year,data={}){
 const matched=items.map(item=>({item,records:eventPnl(item,year,data).records}));
 return Array.from({length:12},(_,index)=>{
  const month=index+1,row={month,total:0,profit:0,loss:0,even:0,pending:0,net:null};
  for(const {item,records} of matched){
   const monthly=records.filter(r=>Number(r.month)===month);
   if(!monthly.length&&!item.months?.includes(month))continue;
   row.total++;
   const result=eventPnl(item,year,{...data,records:monthly});
   if(['profit','loss','even'].includes(result.status)){
    row[result.status]++;
    row.net=(row.net??0)+result.totals.profit;
   }else row.pending++;
  }
  return row;
 });
}
export function monthlyPnlMarkup(items,year,data={}){
 const rows=monthlyPnlSummary(items,year,data);
 const money=new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});
 return `<section class="card event-monthly-pnl" aria-labelledby="event-monthly-pnl-title"><header class="event-card-head"><h2 id="event-monthly-pnl-title">สรุปกำไร–ขาดทุนรายเดือน</h2><span class="event-tag">ปี ${Number(year)+543}</span></header><p class="help">นับงานไม่ซ้ำในแต่ละเดือน · ใช้งบจริง (ACT) ของเดือนนั้น · งานข้ามเดือนอาจมีผลต่างกันในแต่ละเดือน</p>${data.unavailable?'<p role="status">โหลดงบไม่ได้ จำนวนงานกำไร–ขาดทุนและยอดสุทธิยังไม่พร้อมแสดง</p>':''}<div class="table-wrap" tabindex="0" aria-label="สรุปกำไรขาดทุน 12 เดือน เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table><thead><tr><th scope="col">เดือน</th><th scope="col">จำนวนงาน</th><th scope="col">กำไร (งาน)</th><th scope="col">ขาดทุน (งาน)</th><th scope="col">เท่าทุน (งาน)</th><th scope="col">รอข้อมูล (งาน)</th><th scope="col">กำไร / ขาดทุนสุทธิ</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${eventMonthNames[r.month-1]}</th><td>${r.total}</td><td class="pnl-positive">${data.unavailable?'—':r.profit}</td><td class="pnl-negative">${data.unavailable?'—':r.loss}</td><td>${data.unavailable?'—':r.even}</td><td>${r.pending}</td><td class="${r.net>0?'pnl-positive':r.net<0?'pnl-negative':''}">${r.net===null?'—':money.format(r.net)}${r.net!==null&&r.pending?'<small>เฉพาะงานที่ข้อมูลครบ</small>':''}</td></tr>`).join('')}</tbody></table></div><p class="help">จำนวนงานรวมงานที่จัดในเดือนนั้นและงานที่มีงบบันทึกในเดือนนั้น · รอข้อมูล = ยังไม่มีงบ ต้นทุนไม่ครบ หรืองบซ้ำ · ยอดสุทธิรวมเฉพาะงานที่คำนวณได้ ก่อนค่าใช้จ่ายส่วนกลางและภาษีเงินได้</p></section>`;
}
