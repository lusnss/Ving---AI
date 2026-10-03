import {escapeHtml as esc} from './api.mjs';
export const nf=(n,d=0)=>n===null||n===undefined?'—':n.toLocaleString('th-TH',{maximumFractionDigits:d});
export const monthLabel=m=>new Date(m+'-15T00:00:00Z').toLocaleDateString('th-TH',{month:'short',year:'2-digit',timeZone:'Asia/Bangkok'});
export const dayLabel=d=>new Date(d+'T00:00:00Z').toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'Asia/Bangkok'});
export function chartHTML(series,{mode='day',kind='bar',selected='',interactive=true}={}){
 const sharedKeys=[...new Set(series.flatMap(s=>s.points.map(p=>p.key)))].sort();
 const known=new Set(series.flatMap(s=>s.points.filter(p=>p.qty!==null).map(p=>p.key)));
 series=series.map(s=>{const values=new Map(s.points.map(p=>[p.key,p.qty]));return {...s,points:sharedKeys.map(key=>({key,qty:values.has(key)?values.get(key):known.has(key)?0:null}))};});
 if(!series.length||!series[0].points.some(p=>p.qty!==null))return '<div class="sr-empty"><strong>ยังไม่มีรายการขายในช่วงนี้</strong>ต้นทางไม่พบประวัติ จึงยังไม่แสดงเป็นยอดขายศูนย์</div>';
 const keys=series[0].points.map(p=>p.key),w=800,h=270,left=47,right=16,top=22,bottom=39,plotW=w-left-right,plotH=h-top-bottom,max=Math.max(1,...series.flatMap(s=>s.points.map(p=>p.qty||0))),step=plotW/keys.length;
 const y=n=>top+plotH-(n/max)*plotH,x=i=>left+step*(i+.5),label=k=>mode==='month'?monthLabel(k):String(Number(k.slice(-2)));
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="${interactive?'group':'img'}" aria-label="กราฟจำนวนขายออก${mode==='month'?'รายเดือน':'รายวัน'}">`;
 for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);svg+=`<line x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}" stroke="#303030" stroke-dasharray="3 5"/><text x="${left-9}" y="${yy+4}" text-anchor="end" fill="#808080" font-size="10">${nf(v,v<4?1:0)}</text>`;}
 series.forEach((s,si)=>{
  if(kind==='line'){
   let segment=[];const flush=()=>{if(!segment.length)return;const line=segment.map(({p,i},n)=>`${n?'L':'M'}${x(i)},${y(p.qty)}`).join(' ');if(series.length===1)svg+=`<path d="${line} L${x(segment.at(-1).i)},${y(0)} L${x(segment[0].i)},${y(0)}Z" fill="#bbd5d510"/>`;svg+=`<path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`;for(const{p,i}of segment)svg+=`<circle cx="${x(i)}" cy="${y(p.qty)}" r="3" fill="${s.color}"/>`;segment=[];};s.points.forEach((p,i)=>{if(p.qty===null)flush();else segment.push({p,i});});flush();
  }else{s.points.forEach((p,i)=>{if(p.qty===null)return;const bw=Math.min(44,step*.68/series.length),xx=x(i)-bw*series.length/2+si*bw;svg+=`<rect x="${xx}" y="${y(p.qty)}" width="${Math.max(1,bw-1)}" height="${Math.max(p.qty>0?2:0,y(0)-y(p.qty))}" rx="${keys.length<10?4:2}" fill="${s.color}" opacity="${selected&&selected!==p.key?'.45':'.9'}"/>`;});}
 });
 keys.forEach((key,i)=>{const known=series[0].points[i].qty!==null,title=(mode==='month'?monthLabel(key):dayLabel(key))+'\n'+series.map(s=>s.label+': '+nf(s.points[i].qty)+' หน่วย').join('\n'),canClick=known&&interactive;
  svg+=`<g ${canClick?`tabindex="0" role="button" data-sr-point="${key}" aria-label="${esc(title.replaceAll('\n',' · '))}"`:''} data-sr-tip="${esc(title)}"><title>${esc(title)}</title><rect class="sr-hover" x="${left+i*step}" y="${top-6}" width="${step}" height="${plotH+12}" fill="${selected===key?'#fde41214':'transparent'}"/>${!known?`<text x="${x(i)}" y="${y(0)-8}" text-anchor="middle" fill="#808080" font-size="11">—</text>`:''}${keys.length<=12||i%Math.ceil(keys.length/15)===0||i===keys.length-1?`<text x="${x(i)}" y="${h-13}" text-anchor="middle" fill="${selected===key?'#fde412':'#808080'}" font-size="10">${label(key)}</text>`:''}</g>`;
 });return svg+'</svg>';
}
