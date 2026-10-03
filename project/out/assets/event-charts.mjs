import {escapeHtml as e} from './api.mjs';
const shortMonths=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const number=value=>value!=null&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
export const compactEventNumber=value=>Math.abs(value)>=1e6?`${+(value/1e6).toFixed(2)} ล้าน`:Math.abs(value)>=1e3?`${+(value/1e3).toFixed(1)} พัน`:String(+value.toFixed(1));
const money=value=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(value);
export function eventChartSeries(months=[],metric='sales'){
 return shortMonths.map((label,i)=>{const row=months[i];return {label,month:row?.month||label,value:number(row?.[metric==='count'?'count':'sales']),count:number(row?.count)};});
}
export function monthlyEventChart(current,metric='sales'){
 const counts=metric==='count',series=eventChartSeries(current.months,metric),known=series.filter(x=>x.value!==null);
 const rawMax=Math.max(0,...known.map(x=>x.value)),rawMin=Math.min(0,...known.map(x=>x.value));
 const span=rawMax-rawMin||1,step=10**Math.floor(Math.log10(span))/2;
 const max=counts?Math.max(4,Math.ceil(rawMax/4)*4):Math.ceil((rawMax||1)/step)*step,min=counts?Math.floor(rawMin/4)*4:Math.floor(rawMin/step)*step;
 const top=24,height=194,left=70,width=760,slot=width/12,barWidth=30;
 const y=v=>top+(max-v)/(max-min)*height,base=y(0);
 const asOf=current.as_of||'',partialMonth=asOf&&Number(asOf.slice(8,10))<new Date(Date.UTC(Number(asOf.slice(0,4)),Number(asOf.slice(5,7)),0)).getUTCDate()?Number(asOf.slice(5,7)):0;
 const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
 const chart=`<svg class="event-month-chart" viewBox="0 0 850 260" role="img" aria-label="${counts?'จำนวนงาน':'ยอดขาย'}รายเดือน มีข้อมูล ${known.length} เดือน"><g class="event-chart-grid">${ticks.map(t=>`<line x1="${left}" x2="830" y1="${y(t)}" y2="${y(t)}"/><text x="${left-12}" y="${y(t)+4}" text-anchor="end">${e(compactEventNumber(t))}</text>`).join('')}</g>${series.map((s,i)=>{
  const x=left+i*slot+(slot-barWidth)/2,missing=s.value===null,isPartial=!counts&&partialMonth===i+1;
  const label=`${s.month}: ${missing?'ยังไม่มีข้อมูล':counts?s.value+' งาน':money(s.value)}${isPartial?' · ข้อมูลถึง '+asOf:''}`;
  const bar=missing?`<line class="event-chart-missing" x1="${x}" x2="${x+barWidth}" y1="${base}" y2="${base}"/><text class="event-chart-missing-label" x="${x+barWidth/2}" y="${base-8}" text-anchor="middle">—</text>`:s.value===0?`<line class="event-chart-zero" x1="${x}" x2="${x+barWidth}" y1="${base}" y2="${base}"/>`:`<rect class="${isPartial?'event-chart-partial':''}" x="${x}" y="${Math.min(y(s.value),base)}" width="${barWidth}" height="${Math.max(1,Math.abs(base-y(s.value)))}" rx="4"/>`;
  return `<g class="event-chart-point" tabindex="0" role="img" aria-label="${e(label)}"><title>${e(label)}</title>${bar}<text class="event-chart-month" x="${x+barWidth/2}" y="243" text-anchor="middle">${s.label}</text></g>`;
 }).join('')}</svg>`;
 const best=known.length?known.reduce((a,b)=>b.value>a.value?b:a):null;
 return `<div class="event-chart-meta"><span>${counts?'จำนวนงาน (งาน)':'ยอดขาย (บาท)'}</span><span>${best?`${e(best.month)} สูงสุด · <strong>${counts?best.value+' งาน':money(best.value)}</strong>`:'ยังไม่มีข้อมูลสำหรับกราฟ'}</span></div><div class="event-chart-scroll" tabindex="0" role="region" aria-label="กราฟรายเดือน เลื่อนแนวนอนบนมือถือ">${chart}</div><div class="event-chart-legend"><span><i></i>${counts?'จำนวนงานตามชีตต้นทาง':'ยอดขายที่บันทึกแล้ว'}</span>${!counts&&partialMonth?'<span><i class="partial"></i>เดือนที่ข้อมูลยังไม่ครบเดือน</span>':''}<span class="event-chart-null">— ยังไม่มีข้อมูล</span></div>`;
}
export function eventComposition(current,modern){
 const sources=modern?(current.sources||[]):[{label:'งานที่มียอดขาย',count:current.summary?.with_sales||0},{label:'งานที่ยังไม่มียอด',count:current.summary?.planned||0}];
 const total=sources.reduce((sum,s)=>sum+Math.max(0,number(s.count)||0),0),colors=['#fde412','#6ea8cc','#bbd5d5','#ef7023'];
 let offset=0;const radius=66,circumference=2*Math.PI*radius;
 const arcs=sources.map((s,i)=>{const count=Math.max(0,number(s.count)||0),length=total?count/total*circumference:0;const part=`<circle r="${radius}" cx="92" cy="92" fill="none" stroke="${colors[i%colors.length]}" stroke-width="20" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 92 92)"/>`;offset+=length;return part;}).join('');
 return `<div class="event-composition"><div class="event-donut"><svg viewBox="0 0 184 184" role="img" aria-label="${e(sources.map(s=>s.label+' '+s.count+' งาน').join(', ')||'ยังไม่มีข้อมูลประเภทงาน')}"><circle r="66" cx="92" cy="92" fill="none" stroke="#303030" stroke-width="20"/>${arcs}</svg><div><strong>${total}</strong><span>งาน</span></div></div><div class="event-source-legend">${sources.map((s,i)=>`<div><span><i style="background:${colors[i%colors.length]}"></i>${e(s.label)}</span><strong>${s.count}<small> งาน · ${total?(s.count/total*100).toFixed(1):'0'}%</small></strong></div>`).join('')||'<p>ยังไม่มีข้อมูลประเภทงาน</p>'}</div></div>`;
}
export function eventRankingChart(items=[]){
 const top=items.filter(item=>number(item.sales)!==null).slice(0,5),max=Math.max(1,...top.map(x=>Math.abs(Number(x.sales))));
 return `<ol class="event-ranking">${top.map((item,i)=>`<li><span class="event-rank">${String(i+1).padStart(2,'0')}</span><div class="event-rank-content"><div><strong>${e(item.name)}</strong><span>${money(item.sales)}</span></div><div class="event-rank-track" role="img" aria-label="${e(item.name)} ยอดขาย ${money(item.sales)}"><i style="width:${Math.abs(item.sales)/max*100}%"></i></div><small>${e(item.venue||'')}</small></div></li>`).join('')||'<li>ยังไม่มีงานที่มียอดขาย</li>'}</ol>`;
}
