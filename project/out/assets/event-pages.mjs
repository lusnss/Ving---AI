export const eventPages=[
 {key:'overview',path:'/events',label:'ภาพรวมปี',title:'ภาพรวม Event',description:'ยอดขายและจำนวน Event ของปีที่เลือก',group:'ภาพรวม',icon:'overview'},
 {key:'monthly-pnl',path:'/events/monthly-pnl',label:'กำไร–ขาดทุนรายเดือน',title:'กำไร–ขาดทุนรายเดือน',description:'ผลประกอบการของงาน แยกตามเดือนที่มีข้อมูล',group:'ภาพรวม',icon:'report'},
 {key:'calendar',path:'/events/calendar',label:'ปฏิทิน Event',title:'ปฏิทิน Event',description:'กำหนดจัดงาน พร้อมตาราง Set up และเก็บกลับ',group:'การจัดงาน',icon:'calendar'},
 {key:'directory',path:'/events/directory',label:'รายชื่อ Event',title:'รายชื่อ Event',description:'ค้นหางาน กรองรายการ และ Export Excel',group:'การจัดงาน',icon:'list'},
 {key:'performance',path:'/events/performance',label:'ผลลัพธ์ทั้งปี',title:'ผลลัพธ์ทั้งปี',description:'แนวโน้มรายเดือนและสัดส่วนประเภทงาน',group:'ผลลัพธ์และข้อมูล',icon:'chart'},
 {key:'ranking',path:'/events/ranking',label:'อันดับยอดขาย',title:'อันดับยอดขาย Event',description:'งานที่ทำยอดขายสูงสุดของปีที่เลือก',group:'ผลลัพธ์และข้อมูล',icon:'rank'},
 {key:'reconciliation',path:'/events/reconciliation',label:'ยอดขายรอจับคู่',title:'ยอดขายรอจับคู่',description:'รายการจาก Sales Report ที่ยังจับคู่กับรายชื่อ Event ไม่ได้',group:'ผลลัพธ์และข้อมูล',icon:'link'},
 {key:'sources',path:'/events/sources',label:'แหล่งข้อมูล',title:'แหล่งข้อมูลและวิธีคำนวณ',description:'ที่มาของรายชื่อ ยอดขาย และหลักการคำนวณ',group:'ผลลัพธ์และข้อมูล',icon:'source'}
];
export const eventPage=key=>eventPages.find(page=>page.key===key)||eventPages[0];
export function eventPageForPath(path=''){
 const normalized=String(path).replace(/\.html$/,'').replace(/\/$/,'');
 return eventPages.find(page=>page.path===normalized);
}
export function eventPageHref(key,state={}){
 const params=new URLSearchParams();
 for(const [name,value] of Object.entries({year:state.year,month:state.scheduleMonth,schedule:state.scheduleMode,eventMonth:state.month,eventQuery:state.listQuery,eventType:state.listType,eventPlace:state.listPlace,eventStatus:state.listStatus,view:state.view,scheduleStatus:state.status,scheduleQuery:state.query,scheduleDay:state.day,metric:state.metric})){
  if(value&&value!=='all'&&!(name==='schedule'&&value==='timeline')&&!(name==='view'&&value==='calendar')&&!(name==='metric'&&value==='sales'))params.set(name,String(value));
 }
 return eventPage(key).path+(params.size?'?'+params.toString():'');
}
