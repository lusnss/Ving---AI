export const groups = [
  {id:'standalone',name:'Stand Alone',description:'ร้าน Stand Alone ตามกลุ่มในต้นทาง รวมรายการ VING และ TORANi'},
  {id:'event',name:'EVENT',description:'EVENT ในห้าง GP / ลานโปร ห้าง'},
  {id:'event-outside',name:'EVENT นอก',description:'EVENT นอก เก็บเงินเอง ห้าง'},
  {id:'department',name:'Department Stores',description:'ยอดห้างรวมตาม Daily report'}
];
export const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export const fullMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const round = n => Math.round((n+Number.EPSILON)*100)/100;
const daysIn = (y,m) => new Date(Date.UTC(y-543,m,0)).getUTCDate();
export function cutoff(data, group) {
  const active = data.records.filter(r=>r.year===2569 && r.group===group && r.lastDay!==null);
  const latest = active.reduce((last,r)=>Math.max(last,r.month*100+r.lastDay),0);
  return {month:Math.floor(latest/100),day:latest%100};
}
export function selection(data,group,period='ytd') {
  const latest=cutoff(data,group);
  const endMonth=period==='ytd'?latest.month:Number(period);
  const endDay=endMonth===latest.month?latest.day:daysIn(2569,endMonth);
  return {firstMonth:period==='ytd'?1:endMonth,endMonth,endDay,latest,future:endMonth>latest.month};
}
export function aggregate(data,year,group,scope,channel=null) {
  const ready=data.sources[String(year)]?.status==='ready';
  if(!ready) return {amount:null,net:null,available:false,complete:false,missingCells:0,recordedCells:0,rows:[]};
  const rows=data.records.filter(r=>r.year===year&&r.group===group&&r.month>=scope.firstMonth&&r.month<=scope.endMonth&&(!channel||r.channel===channel));
  let amount=0,recordedCells=0,missingCells=0,net=0,netKnown=true;
  const observed=new Set();
  for(const row of rows) {
    const last=row.month===scope.endMonth?Math.min(scope.endDay,daysIn(year,row.month)):daysIn(year,row.month);
    for(let day=1;day<=last;day++) {
      const value=row.daily[day-1];
      if(typeof value==='number'&&Number.isFinite(value)){amount+=value;recordedCells++;observed.add(`${row.month}-${day}`);}
      else missingCells++;
    }
    // Refunds have no daily allocation. Only expose a source Net figure if
    // the requested range includes the entire recorded source month.
    if(row.net===null||row.lastDay===null||last<row.lastDay) netKnown=false;
    else net+=row.net;
  }
  let expected=0;
  for(let month=scope.firstMonth;month<=scope.endMonth;month++) expected+=month===scope.endMonth?Math.min(scope.endDay,daysIn(year,month)):daysIn(year,month);
  return {amount:recordedCells?round(amount):null,net:recordedCells&&netKnown?round(net):null,available:true,complete:expected>0&&observed.size===expected,missingCells,recordedCells,observedDays:observed.size,expectedDays:expected,rows};
}
export function comparison(current,previous) {
  if(current.amount===null||previous.amount===null||!current.complete||!previous.complete) return {delta:null,growth:null,reason:'ข้อมูลยังไม่ครบสำหรับเทียบ'};
  const delta=round(current.amount-previous.amount);
  return {delta,growth:previous.amount===0?null:delta/previous.amount*100,reason:previous.amount===0?'ฐานปี 2568 เป็นศูนย์':null};
}
export function createReport(data,id,period='ytd',sharedScope=null) {
  const group=groups.find(g=>g.id===id)||groups[0];
  const scope=sharedScope||selection(data,group.name,period);
  const current=aggregate(data,2569,group.name,scope);
  const previous=aggregate(data,2568,group.name,scope);
  const monthly=Array.from({length:12},(_,i)=>{
    const month=i+1;
    const range={firstMonth:month,endMonth:month,endDay:month===scope.latest.month?scope.latest.day:daysIn(2569,month)};
    const a=aggregate(data,2569,group.name,range),b=aggregate(data,2568,group.name,range);
    return {month,current:a,previous:b,...comparison(a,b),partial:month===scope.latest.month&&scope.latest.day<daysIn(2569,month),future:month>scope.latest.month,range};
  });
  const names=[...new Set([...current.rows,...previous.rows].map(r=>r.channel))];
  const channels=names.map(name=>{
    const a=aggregate(data,2569,group.name,scope,name),b=aggregate(data,2568,group.name,scope,name);
    return {name,current:a,previous:b,...comparison(a,b)};
  }).sort((a,b)=>(b.current.amount??-1)-(a.current.amount??-1)||a.name.localeCompare(b.name,'th'));
  return {group,scope,current,previous,monthly,channels,...comparison(current,previous)};
}

// Latest sales include every recorded day. A separate matched view retains a shared cutoff for YOY.
export function createOverview(data,period='ytd',basis='latest') {
  const cutoffs=groups.map(g=>cutoff(data,g.name)).filter(c=>c.month&&c.day);
  const shared=cutoffs.reduce((a,b)=>a.month*100+a.day<b.month*100+b.day?a:b,{month:12,day:31});
  const latest=basis==='matched'?{...shared}:cutoffs.reduce((a,b)=>a.month*100+a.day>b.month*100+b.day?a:b,{month:0,day:0});
  if(!cutoffs.length){latest.month=shared.month=1;latest.day=shared.day=1;}
  let matchedFirst=shared.month;
  for(let month=shared.month;month>=1;month--){
    const range={firstMonth:month,endMonth:month,endDay:month===shared.month?shared.day:daysIn(2569,month)};
    if(!groups.every(g=>[2568,2569].every(y=>aggregate(data,y,g.name,range).complete)))break;
    matchedFirst=month;
  }
  const endMonth=['ytd','matched'].includes(period)?latest.month:Number(period);
  const scope={firstMonth:period==='ytd'?1:period==='matched'?matchedFirst:endMonth,endMonth,endDay:endMonth===latest.month?latest.day:daysIn(2569,endMonth),latest,future:endMonth>latest.month,matchedFirst};
  const reports=groups.map(g=>{const report=createReport(data,g.id,period,scope);const recorded=report.current.rows.filter(r=>r.lastDay).reduce((n,r)=>Math.max(n,r.month*100+Math.min(r.lastDay,r.month===scope.endMonth?scope.endDay:r.lastDay)),0);return {...report,recordedThrough:recorded%100?{month:Math.floor(recorded/100),day:recorded%100}:null};});
  const combine=values=>({
    amount:values.some(v=>v.amount!==null)?round(values.reduce((s,v)=>s+(v.amount??0),0)):null,
    available:values.every(v=>v.available),complete:values.every(v=>v.complete),
    missingCells:values.reduce((s,v)=>s+v.missingCells,0),rows:values.flatMap(v=>v.rows)
  });
  const current=combine(reports.map(r=>r.current)),previous=combine(reports.map(r=>r.previous));
  const monthly=Array.from({length:12},(_,i)=>{
    const byGroup=reports.map(r=>r.monthly[i]);
    const a=combine(byGroup.map(g=>g.current)),b=combine(byGroup.map(g=>g.previous));
    return {month:i+1,current:a,previous:b,byGroup,...comparison(a,b),partial:byGroup.some(g=>g.partial),future:i+1>latest.month};
  });
  const largest=reports.filter(r=>r.current.amount!==null).sort((a,b)=>b.current.amount-a.current.amount)[0]||null;
  const peak=monthly.filter(m=>m.current.amount!==null&&!m.partial&&!m.future).sort((a,b)=>b.current.amount-a.current.amount)[0]||null;
  return {scope,reports,current,previous,monthly,largest,peak,...comparison(current,previous),...(basis==='latest'?{matched:createOverview(data,period,'matched')}:{})};
}

export function filterOverview(overview,id){
  const selected=overview.reports.find(r=>r.group.id===id);
  if(!selected)return overview;
  const monthly=selected.monthly.map(m=>({...m,byGroup:[m]}));
  return {...overview,...(overview.matched?{matched:filterOverview(overview.matched,id)}:{}),selectedGroup:selected.group,reports:[selected],current:selected.current,previous:selected.previous,
    delta:selected.delta,growth:selected.growth,reason:selected.reason,monthly,largest:selected,
    peak:monthly.filter(m=>m.current.amount!==null&&!m.partial&&!m.future).sort((a,b)=>b.current.amount-a.current.amount)[0]||null};
}

export function trendSeries(overview,mode='monthly') {
  const result=[];let current=0,previous=0,currentValid=true,previousValid=true;
  for(const m of overview.monthly){
    if(mode==='monthly'){result.push({month:m.month,current:m.current.amount,previous:m.previous.amount,partial:m.partial});continue;}
    // September is clipped to the shared cutoff; do not extend that clipped
    // cumulative baseline into future months and imply a full-year total.
    if(m.future){result.push({month:m.month,current:null,previous:null,partial:false});continue;}
    currentValid=currentValid&&m.current.amount!==null;previousValid=previousValid&&m.previous.amount!==null;
    if(m.current.amount!==null)current+=m.current.amount;
    if(m.previous.amount!==null)previous+=m.previous.amount;
    result.push({month:m.month,current:currentValid?round(current):null,previous:previousValid?round(previous):null,partial:m.partial});
  }
  return result;
}

export function overviewCsv(overview){
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const status=r=>[r.current,r.previous].map(v=>v.amount===null?'ไม่มีข้อมูล':v.complete?'ครบ':'ไม่ครบ').join(' / ');
  const rows=[['รายงานรวม Daily report','ยอดขายก่อนหักคืนเงิน (บาท)'],['ช่วงเดือน',overview.scope.firstMonth+'–'+overview.scope.endMonth,'ถึงวันที่',overview.scope.endDay],['ช่องทาง','2569','2568','ผลต่าง (บาท)','เปลี่ยนแปลง (%)','สถานะข้อมูล 2569 / 2568']];
  for(const r of overview.reports)rows.push([r.group.name,r.current.amount,r.previous.amount,r.delta,r.growth===null?null:round(r.growth),status(r)]);
  rows.push([overview.selectedGroup?.name||'รวม 4 ช่องทาง',overview.current.amount,overview.previous.amount,overview.delta,overview.growth===null?null:round(overview.growth),status(overview)]);
  rows.push([],['ช่องทางย่อย','กลุ่ม','2569','2568','ผลต่าง (บาท)','เปลี่ยนแปลง (%)','สถานะข้อมูล 2569 / 2568']);
  for(const r of overview.reports)for(const c of r.channels)rows.push([c.name,r.group.name,c.current.amount,c.previous.amount,c.delta,c.growth===null?null:round(c.growth),status(c)]);
  rows.push([],['หมายเหตุ','ช่องว่างหมายถึงไม่มีข้อมูล ไม่ใช่ยอดขายศูนย์']);
  return '\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
}
