// Explicit allow-list: a refresh can only read connected sources/import reports.
// It cannot forward arbitrary URLs, alter business records, or approve anything.
export function refreshPlan(now=new Date()) {
 const current=new Date(+now+7*3600000).toISOString().slice(0,7);
 const tasks=[
  ['snapshot','หน้าหลัก / Content / News / Intel / งาน'],
  ['sales','Sales Report · Excel ออนไลน์'],
  ['comparison','Daily report · Google Sheets'],
  ['pnl','งบกำไร–ขาดทุน · Google Sheets'],
  ['costs','ต้นทุนสินค้า · Google Sheets'],
  ['proposals','ข้อเสนอ Event และสถานะอนุมัติ'],
  ['predict','ข้อมูลอ้างอิงและคาดการณ์ Event'],
  ['schedule','Set up / เก็บกลับ · Google Sheets'],
  ['catalog','รายการ Event · Google Sheets'],
  ['contracts','สัญญาห้าง · Google Sheets และข้อมูลที่แก้ในเว็บ'],
  ['rebrand','Rebrand · Google Sheets'],
  ['inventory','สินค้าคงคลัง · Scaleup'],
  ['pivot','สต็อก / ราคา PIVOT · ไฟล์นำเข้า'],
  ['branch-stock','สต็อกสาขา'],
  ...['overview','initial','movement','returns','grades','audit'].map((s,i)=>['warehouse:'+s,'คลังกลาง · '+['ภาพรวม','ตั้งต้น','เคลื่อนไหว','คืนสินค้า','ปรับเกรด','ประวัติ'][i]]),
  ['forecast','คาดการณ์สต็อก · ทุกสาขา'],
  ['stock-report','รายงานสต็อก · ข้อมูลสาขา'],
  ['history:'+current+':1','รายการขายสินค้า · '+current],
  ['references','ข้อมูลอ้างอิงจากไฟล์นำเข้า']
 ].map(([id,label])=>({id,label}));
 return {currentMonth:current,tasks,finalTasks:[['gp','กำไรสาขา / Odoo · '+current],['activities','กิจกรรม'],['promotions','โปรโมชั่น'],['approved','Event ที่อนุมัติ'],['stock-summary','สรุปสต็อก'],['summary','Summary'],['notifications','การแจ้งเตือน']].map(([id,label])=>({id,label}))};
}
const refreshRoutes={comparison:'/api/daily-comparison',pnl:'/api/profit-loss',costs:'/api/product-costs',proposals:'/api/event-proposals',predict:'/api/event-predict',schedule:'/api/events/schedule',rebrand:'/api/rebrand','branch-stock':'/api/branch-stock',contracts:'/api/contracts',activities:'/api/activities',promotions:'/api/promotions',approved:'/api/events/approved','stock-summary':'/api/stock-summary?includeSales=1',summary:'/api/summary',notifications:'/api/notifications'};
export async function refreshSource(id,{read,now=()=>new Date()}) {
 const date=now(),current=new Date(+date+7*3600000).toISOString().slice(0,7);
 const at=date.toISOString(),ok=(extra={})=>({status:'success',checkedAt:at,...extra});
 const issue=(message,extra={})=>({status:'attention',message,checkedAt:at,retryable:true,...extra});
 // Validate each request, including old tabs, retries and dynamic pages.
 const requestedMonth=/^(?:gp|(?:forecast-)?history):(20\d\d-(?:0[1-9]|1[0-2]))(?:$|:)/.exec(id)?.[1];
 if((requestedMonth&&requestedMonth!==current)||id.startsWith('forecast-history:'))return {status:'skipped',message:'ข้ามรายการนี้ · อัปเดตเฉพาะเดือนปัจจุบัน '+current,checkedAt:at,retryable:false};
 if(id==='catalog'){const data=await read('/api/events/catalog');return data.source?.online_status==='online'?ok({sourceAt:data.source.fetched_at}):issue('ยังอ่านชีต Event ไม่สำเร็จ แสดงรายการที่บันทึกไว้');}
 if(id==='snapshot'){
  const data=await read('/api/snapshot');
  if(data.cloudWorkspace?.mode==='cloud')return ok({sourceAt:data.cloudWorkspace.updatedAt,message:'อ่านข้อมูล Content / News / Intel ที่บันทึกบนคลาวด์แล้ว'});
  return issue('อ่านชุดข้อมูลที่ซิงก์ไว้แล้ว ต้นทางของแท็บเหล่านี้ต้องซิงก์จากเครื่องที่เชื่อมระบบ', {sourceAt:data.syncedAt||data.exportedAt||null,retryable:false});
 }
 if(id==='sales'){
  const data=await read('/api/snapshot'),s=data.salesOnline;
  return s?.status==='online'&&Date.parse(s.fetchedAt)>=Date.parse(at)?ok({sourceAt:s.fetchedAt}):issue('ยังดึง Excel ต้นทางไม่ได้ หรือมีรอบอัพเดทกำลังทำงาน ต้องตรวจการเชื่อม Microsoft / ระบบนำเข้า', {sourceAt:s?.fetchedAt||data.salesSync?.fetchedAt||null});
 }
 if(id==='pivot'){
  const data=await read('/api/inventory');
  return issue('อ่านไฟล์นำเข้าที่บันทึกไว้แล้ว หากต้นทางเปลี่ยนต้องนำเข้าไฟล์ PIVOT ล่าสุด', {sourceAt:data.pivot?.updatedAt||null,retryable:false});
 }
 if(id==='references')return issue('ยอดเทียบปีก่อนและค่าแรงเป็นไฟล์อ้างอิง ต้องนำเข้าฉบับใหม่เมื่อมีการเปลี่ยนแปลง',{retryable:false});
 if(id==='inventory'){const data=await read('/api/inventory/refresh',{method:'POST',body:JSON.stringify({source:'scaleup'})});return ok({sourceAt:data.snapshot?.updatedAt||data.updatedAt||at});}
 if(id==='gp'){
  return ok({nextTasks:[{id:'gp:'+current,label:'Odoo · '+current}],message:'เข้าคิวอัปเดต Odoo เฉพาะเดือนปัจจุบัน'});
 }
 if(/^gp:20\d\d-(0[1-9]|1[0-2])$/.test(id)){
  const data=await read('/api/branch-profit/refresh',{method:'POST',body:JSON.stringify({period:id.slice(3)})});return ok({sourceAt:data.updatedAt});
 }
 if(id==='forecast'){
  const data=await read('/api/stock-forecast?part=manifest&refresh=1');
  const ids=(data.branches||[]).map(b=>b.id),nextTasks=[];
  for(let i=0;i<ids.length;i+=6)nextTasks.push({id:'balances:'+ids.slice(i,i+6).map(encodeURIComponent).join(','),label:'สต็อกทุกสาขา · ชุด '+(i/6+1)});
  return ok({sourceAt:data.fetchedAt,nextTasks});
 }
 if(id.startsWith('balances:')){
  const ids=id.slice(9).split(',').map(decodeURIComponent);
  if(!ids.length||ids.length>6||ids.some(v=>!/^[A-Za-z0-9 _-]{1,80}$/.test(v)))throw Error('รหัสสาขาไม่ถูกต้อง');
  const data=await read('/api/stock-forecast?part=stock&refresh=1&ids='+encodeURIComponent(ids.join(',')));
  return data.failedBranchIds?.length?issue('ยังอ่านสต็อกไม่ครบ '+data.failedBranchIds.length+' สาขา'):ok({sourceAt:data.fetchedAt});
 }
 if(id==='stock-report'){const data=await read('/api/stock-report?part=manifest&refresh=1');return ok({sourceAt:data.fetchedAt});}
 const history=/^(?:forecast-)?history:(20\d\d-(0[1-9]|1[0-2])):([1-9]\d{0,5})$/.exec(id);
 if(history){
  const isForecast=id.startsWith('forecast-'),prefix=isForecast?'forecast-history:':'history:';
  const data=await read('/api/'+(isForecast?'stock-forecast':'stock-report')+'?part=history&refresh=1&month='+history[1]+'&page='+history[3]);
  if(data.nextPage!==null&&(!Number.isInteger(data.nextPage)||data.nextPage<=Number(history[3])))throw Error('ลำดับหน้าข้อมูลไม่ถูกต้อง');
  return ok({sourceAt:data.fetchedAt,nextTasks:data.nextPage?[{id:prefix+history[1]+':'+data.nextPage,label:(isForecast?'ประวัติคาดการณ์สต็อก':'ประวัติการขายสินค้า')+' · '+history[1]+' (ต่อ)'}]:[]});
 }
 const warehouse=/^warehouse:(overview|initial|movement|returns|grades|audit)$/.exec(id);
 const path=warehouse?'/api/warehouse?section='+warehouse[1]:refreshRoutes[id];
 if(!path)throw Error('ไม่พบแหล่งข้อมูลนี้');
 const data=await read(path),sources=[data.source,data.live,data.web,...Object.values(data.sources||{}),data.salesHistory].filter(s=>s&&typeof s==='object');
 const stale=sources.some(s=>['stale','unavailable','partial','not_configured','waiting','saved'].includes(s.status)||s.online_status==='stale');
 if(stale||data.unavailable||data.failures?.length||data.recovery?.stale)return issue('บางส่วนยังอ่านต้นทางไม่ได้ แสดงข้อมูลที่โหลดสำเร็จล่าสุด',{sourceAt:data.source?.fetched_at||null});
 return ok({sourceAt:data.source?.fetched_at||data.live?.checkedAt||data.fetchedAt||at});
}
