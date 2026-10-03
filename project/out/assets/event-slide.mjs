import {proposalDisplayRow,proposalGroup,proposalBreakEven} from './event-proposals.mjs';
import {eventMonthLabel,proposalScenarios,proposalScenarioIndex} from './event-planning-fields.mjs';
import {forecast,targetGoalsFor,targetGoalLabel,historyFor,identifyForecastVenue} from './event-predict-model.mjs';
import {openEventImage} from './event-images.mjs';

const numeric=value=>{
 const raw=String(value??'').trim().replaceAll(',','').replace(/%$/,'');
 return raw!==''&&Number.isFinite(Number(raw))?Number(raw):null;
};
const number=value=>numeric(value)===null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(numeric(value));
const baht=value=>numeric(value)===null?'—':'฿'+number(value);
const percent=value=>numeric(value)===null?'—':new Intl.NumberFormat('th-TH',{maximumFractionDigits:1}).format(numeric(value))+'%';
const text=value=>String(value??'').trim()||'—';
const shortDate=value=>{
 const raw=String(value??'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return text(raw);
 const date=new Date(raw+'T00:00:00+07:00');
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(date):text(raw);
};
const dateRange=value=>{
 const match=/^(\d{4}-\d{2}-\d{2})\s*(?:ถึง|–|—)\s*(\d{4}-\d{2}-\d{2})$/.exec(String(value??''));
 if(!match)return shortDate(value);
 if(match[1]===match[2])return shortDate(match[1]);
 if(match[1].slice(0,7)===match[2].slice(0,7))return Number(match[1].slice(8))+'–'+shortDate(match[2]);
 return shortDate(match[1])+' – '+shortDate(match[2]);
};
const id=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||'');

// Only published attachments belonging to this proposal are read. No contact fields enter the slide.
export function slideImageUrls(row){
 const attachments=Array.isArray(row.attachments)?row.attachments:[];
 if(!attachments.length)return [];
 if(!id(row.id)||attachments.length>6)throw Error('ข้อมูลรูปแนบไม่ครบ กรุณาเปิดแก้ไข Event แล้วบันทึกใหม่');
 return attachments.map(image=>{
  const imageId=typeof image==='string'?image:image?.id;
  if(!id(imageId))throw Error('ข้อมูลรูปแนบไม่ถูกต้อง กรุณาตรวจรูปของ Event');
  return `/api/event-images/${row.id}/${imageId}`;
 });
}

// Reuse the event calculator, including per-person wages and commission thresholds.
// A missing cost stays unknown; the saved proposal and target are never mutated.
export function slideForecast(row,value=0){
 const raw=String(value??'').trim();
 const sales=/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)?numeric(raw):null;
 if(sales===null||sales<0||sales>1e10)return {sales:null,profit:null,costs:null,roi:null,margin:null,invalid:true};
 const result=forecast([],{...(row.input||{}),mode:'manual',salesMode:'',expectedSales:sales,baselineMonth:'all',targetMode:'manual',target:'',downside:0,upside:0});
 return {...result.base,margin:sales>0&&result.base.profit!==null?result.base.profit/sales*100:null,invalid:false};
}

export function slideTermsRow(row,patch,rows=[]){
 const input={...row.input,...patch};
 if(Object.hasOwn(patch,'pc')&&String(patch.pc)!==String(row.input.pc)&&input.compensationMode==='catalog')input.wageMode='manual';
 const calculation=forecast(rows,input);
 calculation.proposalScenario=input.proposalScenario||'base';
 calculation.proposed=calculation.scenarios[proposalScenarioIndex(input.proposalScenario||'base')];
 const selected=calculation.proposed;
 return {...row,input,calculation,sales:selected.sales,profit:selected.profit,roi:selected.roi,margin:selected.sales>0?selected.profit/selected.sales*100:null,target:calculation.target?.sales??''};
}

export function eventSlideModel(row,source={},forecastSales){
 const input=row.input||{},display=proposalDisplayRow(row),fresh=proposalGroup(row)==='new';
 const calc=row.calculation||{},saved=Boolean(calc.base);
 const base=calc.proposed||(fresh?(input.salesMode==='cost-target'?calc.base:calc.target):calc.base)||{};
 const projection=forecastSales===undefined?null:slideForecast(row,forecastSales);
 const sales=projection?projection.sales:numeric(display.sales),profit=projection?projection.profit:numeric(display.profit);
 const costs=projection?projection.costs:numeric(base.costs)??(sales!==null&&profit!==null&&sales-profit>=0?sales-profit:null);
 const roi=projection?projection.roi:numeric(display.roi)??(costs>0&&profit!==null?profit/costs*100:null);
 const margin=projection?projection.margin:numeric(display.margin)??(sales>0&&profit!==null?profit/sales*100:null);
 const days=numeric(input.days??row.days),types=input.eventTypes||row.eventTypes||[];
 const date=row.updatedAt||row.createdAt||source.fetched_at;
 const stamped=date&&Number.isFinite(Date.parse(date))?new Date(date).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'}):'ไม่ระบุเวลา';
 const terms=saved?[
  ['รูปแบบ',input.channel==='gp'?'ลานโปร GP':input.channel==='direct'?'เก็บเงินเอง':'—'],
  [input.channel==='gp'?'GP / ยอดขาย':'ค่าเช่ารวม',input.channel==='gp'?percent(input.gp):baht(input.rent)],
  ['ต้นทุนสินค้า',percent(input.cogs)],['PC '+(input.pcCostMode==='person'?'/ คน / วัน':'รวม / วัน'),baht(input.pc)],
  ['ขนส่ง / งาน',baht(input.shipping)],['ค่าใช้จ่ายอื่น / งาน',baht(input.other)],
 ]:[['รายละเอียดต้นทุน','[ต้องถามเจ้าของ]']];
 const baseline=input.mode==='manual'?(input.salesMode==='cost-target'?'พื้นที่ใหม่ ใช้ยอดขายเป้า ROI 40%':'พื้นที่ใหม่ ใช้ยอดตั้งเป้าของผู้เสนอ'):saved?`Baseline ${baht(calc.baseline?.rate)} / วัน จาก ${number(calc.observations)} งาน`:'ยอดคาดการณ์ตามชีตเสนอ Event';
 const targetValue=numeric(display.target??calc.target?.sales??(fresh?numeric(display.sales):null));
 const targetSales=baht(targetValue===null?null:Math.ceil(targetValue));
 const targetDaily=baht(days>0&&targetValue!==null?Math.ceil(targetValue/days):null);
 const goalLabel=targetGoalsFor(input).length?targetGoalLabel(input):targetValue!==null?'กำหนดยอดขายเอง':'ยังไม่ระบุ [ต้องถามเจ้าของ]';
 const dailySales=baht(days>0&&sales!==null?sales/days:null);
 const labels=input.salesMode==='cost-target'?['ต่ำกว่าเป้า','เป้า ROI 40%','สูงกว่าเป้า']:['ต่ำกว่าคาดการณ์','ตามคาดการณ์','สูงกว่าคาดการณ์'];
 return {
  title:text(row.place||row.name||'Event'),subtitle:row.name&&row.name!==row.place?text(row.name):'ข้อเสนอจัดงานสำหรับผู้บริหาร',
  trade:text(row.trade),ceo:text(row.ceo),fresh,
  metrics:[
   [projection?'ยอดขายคาดการณ์':fresh?'ยอดขายที่ตั้งเป้า':'คาดการณ์ยอดขาย',baht(sales)],
   [projection?(profit<0?'ขาดทุนคาดการณ์':'กำไรคาดการณ์'):fresh?'กำไรเมื่อถึงเป้า':'คาดการณ์กำไร',baht(profit),profit<0?'loss':'profit'],
   ['ยอดขายคุ้มทุน',calc.noBreakEven?'ไม่ถึงจุดคุ้มทุน':baht(proposalBreakEven(row))],
   ['อัตรากำไร',percent(margin)],['ROI (กำไรต่อต้นทุน)',percent(roi)],['ต้นทุนรวม',baht(costs)],
  ],
  facts:[['วันที่จัด',dateRange(row.dates)],['เดือน',eventMonthLabel(input.eventMonth||row.month)||'—'],['จำนวนวัน',number(days)],
   ['ชั้น / พื้นที่',`${text(input.floor||row.floor)} / ${number(input.area??row.area)} ตร.ม.`],
   ['จำนวน PC',number(input.pcCount??row.pc)+' คน'],['ประเภท',Array.isArray(types)?types.join(', ')||'—':text(types)],
   ['วันที่เสนอ',shortDate(row.proposalDate||input.proposalDate)],['ยืนยันภายใน',shortDate(row.confirmBy||input.confirmBy)],
   ['เวลาทำงาน PC',input.pcStartTime&&input.pcEndTime?`${input.pcStartTime}–${input.pcEndTime}`:'—'],
  ],terms,
  targets:`ยอดขายเป้าหมาย ${targetSales} · ยอดขายเฉลี่ย ${dailySales} / วัน`,
  targetSales,dailySales,
  goals:[['ยอดขายเป้าหมาย / งาน',targetSales],['ยอดขายที่ต้องทำ / วัน',targetDaily],['เกณฑ์เป้าหมาย',goalLabel]],
  scenarios:saved?[calc.scenarios?.[0],calc.base,calc.scenarios?.[2]].map((scenario,index)=>({label:labels[index],sales:baht(scenario?.sales),profit:baht(scenario?.profit),selected:index===proposalScenarioIndex(input.proposalScenario)})):[],
  forecast:projection,
  basis:(projection?'ทดลองยอดบนสไลด์ · ':'')+baseline+(saved&&calc.proposed?' · เสนอกรณี'+(proposalScenarios[proposalScenarioIndex(input.proposalScenario)]?.label||'ตามคาดการณ์'):''),
  notes:(row.planningNotes||[]).map(String),
  source:`${saved?'ข้อเสนอที่บันทึก':'ชีตเสนอ Event'} ${stamped}${source.status==='stale'?' · ข้อมูลล่าสุดที่อ่านได้ ต้นทางยังไม่พร้อม':''}`,
  footnote:'ตัวเลขคาดการณ์ก่อนส่วนกลางและภาษีเงินได้ · ช่อง — คือยังไม่มีข้อมูล [ต้องถามเจ้าของ]',
 };
}

const palette={ink:'#181818',muted:'#666666',gold:'#fde412',line:'#ffffff',green:'#245143',red:'#ef7023',paper:'#ffffff',navy:'#181818',wash:'#ffffff'};
const overflowMessage='ข้อมูลข้อความยาวเกินสไลด์ 1 หน้า กรุณาย่อชื่อหรือเงื่อนไขใน Event ก่อนสร้างสไลด์';
function font(ctx,size,weight=400,family='IBM Plex Sans Thai Looped'){ctx.font=`${weight} ${size}px ${family}, sans-serif`;ctx.textBaseline='alphabetic';}
function wrap(ctx,value,width){
 const raw=String(value),segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('th',{granularity:'word'}):null;
 const chunks=segmenter?[...segmenter.segment(raw)].map(s=>s.segment):Array.from(raw);
 const lines=[];let line='';
 const add=chunk=>{if(chunk==='\n'){lines.push(line.trimEnd());line='';return;}if(line&&ctx.measureText(line+chunk).width>width){lines.push(line.trimEnd());line=chunk.trimStart();}else line+=chunk;};
 for(const chunk of chunks){
  if(ctx.measureText(chunk).width>width){const graphemes=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(chunk)].map(s=>s.segment):Array.from(chunk);graphemes.forEach(add);}
  else add(chunk);
 }
 if(line)lines.push(line.trimEnd());return lines.length?lines:[''];
}
// Canvas font sizes and `top` baselines do not describe the visible bounds of Thai
// accents or mixed fonts. Plan with real ink bounds, then draw on an alphabetic baseline.
function textPlan(ctx,value,width,{size=26,min=22,weight=400,color=palette.ink,lines=1,lineHeight=1.4,height=Infinity,family='IBM Plex Sans Thai Looped',align='left'}={}){
 min=Math.min(min,size);
 for(;size>=min;size--){
  font(ctx,size,weight,family);
  const rows=wrap(ctx,value,width),metrics=rows.map(row=>ctx.measureText(row));
  const ascent=Math.max(0,...metrics.map(m=>m.actualBoundingBoxAscent??size*.85));
  const descent=Math.max(0,...metrics.map(m=>m.actualBoundingBoxDescent??size*.25));
  const leading=Math.max(size*lineHeight,ascent+descent+8);
  const inkHeight=ascent+descent+(rows.length-1)*leading;
  if(rows.length<=lines&&inkHeight<=height&&metrics.every(m=>Math.max(m.width,(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight||0))<=width))return {rows,metrics,size,weight,color,family,align,ascent,leading,height:inkHeight,width};
 }
 throw Error(overflowMessage);
}
function paintText(ctx,plan,x,y){
 font(ctx,plan.size,plan.weight,plan.family);ctx.fillStyle=plan.color;
 plan.rows.forEach((row,index)=>{const metric=plan.metrics[index],left=metric.actualBoundingBoxLeft||0,right=metric.actualBoundingBoxRight??metric.width;
  const tx=plan.align==='right'?x+plan.width-right:x+Math.max(0,left);
  ctx.fillText(row,tx,y+plan.ascent+index*plan.leading);
 });
 return {x,y,width:plan.width,height:plan.height,bottom:y+plan.height};
}
function write(ctx,value,x,y,width,options={}){return paintText(ctx,textPlan(ctx,value,width,options),x,y);}
function rule(ctx,x,y,width,color=palette.line){ctx.fillStyle=color;ctx.fillRect(x,y,width,1);}
function pairs(ctx,items,x,y,width,columns,height){
 const gutter=34,cellWidth=(width-gutter*(columns-1))/columns,rowCount=Math.ceil(items.length/columns);
 let cells,rowHeights;
 for(let size=30;size>=20;size--){
  cells=items.map(([label,value])=>({label:textPlan(ctx,label,cellWidth,{size:22,min:20,color:palette.muted}),value:textPlan(ctx,value,cellWidth,{size,min:22,weight:600,lines:2,height:74})}));
  rowHeights=Array.from({length:rowCount},(_,row)=>{const group=cells.slice(row*columns,(row+1)*columns);return Math.max(...group.map(c=>c.label.height))+14+Math.max(...group.map(c=>c.value.height));});
  if(rowHeights.reduce((sum,h)=>sum+h,0)+20*(rowCount-1)<=height)break;
  if(size===20)throw Error(overflowMessage);
 }
 const gap=rowCount>1?(height-rowHeights.reduce((sum,h)=>sum+h,0))/(rowCount-1):0;
 let rowY=y;
 rowHeights.forEach((rowHeight,row)=>{
  const group=cells.slice(row*columns,(row+1)*columns),labelHeight=Math.max(...group.map(c=>c.label.height));
  group.forEach((cell,column)=>{const cx=x+column*(cellWidth+gutter);paintText(ctx,cell.label,cx,rowY);paintText(ctx,cell.value,cx,rowY+labelHeight+14);});
  rowY+=rowHeight+gap;
 });
}
function sectionHeading(ctx,label,x,y,width){
 write(ctx,label,x,y,width,{size:29,min:26,weight:600});
 rule(ctx,x,y+48,width);ctx.fillStyle=palette.gold;ctx.fillRect(x,y+47,44,2);
}
function approvalLine(ctx,label,value,x,y){
 write(ctx,label,x,y+2,100,{size:24,color:'#cccccc'});
 const color=value==='อนุมัติ'?'#bbd5d5':value==='ไม่อนุมัติ'?'#ebb9c5':'#fde412';
 write(ctx,value,x+122,y,236,{size:27,weight:600,color});
}
function slideGeometry(ctx,model){
 const basis=textPlan(ctx,model.basis,1544,{size:21,min:20,color:palette.muted,lines:2,height:54});
 const note=model.notes.join(' · '),notes=note?textPlan(ctx,note,1744,{size:21,min:20,color:palette.muted,lines:3,height:84}):null;
 const footerHeight=basis.height+(notes?16+notes.height:0);
 const footerY=Math.min(974,1024-footerHeight);
 return {basis,notes,footerY,bodyY:660,bodyHeight:footerY-28-660};
}
// Image controls and the canvas use exactly the same measured layout.
function slideImageBoxes(count,layout){
 if(!count)return [];
 const cols=count===1?1:2,rows=Math.ceil(count/cols),gap=16;
 const width=(448-gap*(cols-1))/cols,height=(layout.bodyHeight-gap*(rows-1))/rows;
 return Array.from({length:count},(_,i)=>({x:1384+(i%cols)*(width+gap),y:layout.bodyY+Math.floor(i/cols)*(height+gap),width,height}));
}
export function drawEventSlide(canvas,model,images=[],brandImage=null){
 canvas.width=1920;canvas.height=1080;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('เบราว์เซอร์นี้ยังสร้างภาพสไลด์ไม่ได้');
 const layout=slideGeometry(ctx,model);
 ctx.fillStyle=palette.paper;ctx.fillRect(0,0,1920,1080);
 ctx.fillStyle=palette.navy;ctx.fillRect(0,0,1920,184);
 ctx.fillStyle=palette.gold;ctx.fillRect(88,0,88,4);ctx.fillRect(0,183,1920,1);
 if(brandImage){
  ctx.save();ctx.globalCompositeOperation='screen';ctx.filter='invert(1)';
  ctx.drawImage(brandImage,228,4083,718,161,88,34,128,128*161/718);ctx.restore();
 }else write(ctx,'VING',88,30,128,{size:30,weight:600,family:'IBM Plex Sans Thai Looped',color:'#fde412'});
 write(ctx,'EVENT PROPOSAL',240,35,1020,{size:20,color:'#cecece'});
 const customSubtitle=model.subtitle&&!['ข้อเสนอจัดงานสำหรับผู้บริหาร','ข้อเสนอ Event สำหรับผู้บริหาร'].includes(model.subtitle);
 write(ctx,model.title,88,customSubtitle?78:88,1270,{size:48,min:32,weight:600,family:'IBM Plex Sans Thai Looped',color:'#ffffff',height:customSubtitle?52:72});
 if(customSubtitle)write(ctx,model.subtitle,88,145,1270,{size:23,min:21,color:'#cecece',height:35});
 ctx.fillStyle='#ffffff24';ctx.fillRect(1420,30,1,128);
 write(ctx,'สถานะการอนุมัติ',1468,32,364,{size:22,color:'#cecece'});
 approvalLine(ctx,'Trade',model.trade,1468,79);approvalLine(ctx,'CEO',model.ceo,1468,128);
 const starts=[88,696,1304],columnWidth=528;
 model.metrics.slice(0,3).forEach(([label,value,tone],i)=>{
  const x=starts[i];
  if(i){ctx.fillStyle=palette.line;ctx.fillRect(x-40,216,1,120);}
  write(ctx,label,x,214,i===0?256:columnWidth,{size:26,min:24,color:palette.muted});
  write(ctx,value,x,270,columnWidth,{size:64,min:34,weight:600,family:'IBM Plex Sans Thai Looped',color:value==='—'?palette.muted:tone==='profit'?palette.green:tone==='loss'?palette.red:palette.ink,height:74});
  if(i===0&&model.dailySales!==undefined)write(ctx,'เฉลี่ย '+model.dailySales+' / วัน',x+288,214,240,{size:22,min:20,color:palette.muted,height:36});
 });
 ctx.fillStyle=palette.wash;ctx.fillRect(88,370,1744,64);
 model.metrics.slice(3).forEach(([label,value],i)=>{
  const x=starts[i]+20,valuePlan=textPlan(ctx,value,234,{size:34,min:26,weight:600,align:'right'});
  const valueWidth=Math.max(...valuePlan.metrics.map(m=>m.width))+2;
  const labelPlan=textPlan(ctx,label,columnWidth-40-valueWidth-32,{size:24,min:22,color:palette.muted});
  paintText(ctx,labelPlan,x,370+(64-labelPlan.height)/2);
  paintText(ctx,valuePlan,starts[i]+columnWidth-20-234,370+(64-valuePlan.height)/2);
 });
 if(model.goals){
  ctx.fillStyle='#ffffff';ctx.fillRect(88,454,1744,120);ctx.fillStyle=palette.gold;ctx.fillRect(88,454,3,120);
  write(ctx,'เป้าหมายของงาน',112,500,258,{size:25,weight:600,color:'#77653f'});
  const goalStarts=[416,936,1400],goalWidths=[462,406,406];
  model.goals.forEach(([label,value],index)=>{
   write(ctx,label,goalStarts[index],474,goalWidths[index],{size:23,min:22,color:palette.muted,height:36});
   write(ctx,value,goalStarts[index],524,goalWidths[index],{size:index===2?27:32,min:22,weight:600,height:44});
  });
 }else write(ctx,model.targets,88,544,1744,{size:28,weight:600});
 const factsWidth=images.length?748:1032,termsX=images.length?884:1192,termsWidth=images.length?452:640;
 sectionHeading(ctx,'รายละเอียดการจัดงาน',88,592,factsWidth);
 sectionHeading(ctx,'เงื่อนไขและค่าใช้จ่าย',termsX,592,termsWidth);
 pairs(ctx,model.facts,88,layout.bodyY,factsWidth,3,layout.bodyHeight);
 pairs(ctx,model.terms,termsX,layout.bodyY,termsWidth,2,layout.bodyHeight);
 if(images.length){
  sectionHeading(ctx,'รูปประกอบสถานที่',1384,592,448);
  images.forEach((image,i)=>{
   const {x,y,width,height}=slideImageBoxes(images.length,layout)[i];
   ctx.fillStyle=palette.wash;ctx.fillRect(x,y,width,height);
   const inset=12,scale=Math.min((width-inset*2)/image.width,(height-inset*2)/image.height),w=image.width*scale,h=image.height*scale;
   ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);
  });
 }
 rule(ctx,88,layout.footerY-18,1744);
 write(ctx,'ข้อมูลอ้างอิง',88,layout.footerY,168,{size:21,min:20,weight:600,color:'#77653f'});
 paintText(ctx,layout.basis,288,layout.footerY);
 if(layout.notes)paintText(ctx,layout.notes,88,layout.footerY+layout.basis.height+16);
 rule(ctx,88,1040,1744);
 write(ctx,model.footnote,88,1055,1230,{size:18,min:17,color:palette.muted,height:25});
 write(ctx,model.source,1366,1055,466,{size:18,min:16,color:palette.muted,align:'right',height:25});
 return canvas;
}

async function loadImage(url){
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('ยังโหลดรูปแนบไม่ครบ กรุณาลองใหม่');
 const blob=await response.blob();if(!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('รูปแนบมีรูปแบบที่ไม่รองรับ');
 const objectUrl=URL.createObjectURL(blob);
 try{const img=new Image();img.src=objectUrl;await img.decode();return img;}
 finally{URL.revokeObjectURL(objectUrl);}
}

export async function openEventSlide(initialRow,initialSource,opener,options={}){
 document.querySelector('.event-slide-dialog')?.close();
 const dialog=document.createElement('dialog');dialog.className='event-slide-dialog';dialog.setAttribute('aria-label','สไลด์เสนอผู้บริหาร');
 dialog.innerHTML=`<header class="event-slide-toolbar"><div><strong>สไลด์ผู้บริหาร</strong><span>1 หน้า · 16:9</span></div><div class="event-slide-actions"><button type="button" data-slide-save hidden disabled>บันทึกการแก้ไข</button><button type="button" data-slide-reset hidden>ยกเลิกการแก้ไข</button><button type="button" data-slide-present disabled>นำเสนอเต็มจอ</button><button type="button" data-slide-download disabled>ดาวน์โหลด PNG</button><button type="button" data-slide-close aria-label="ปิดสไลด์">ปิด ×</button></div></header><p class="event-slide-status" role="status" aria-live="polite"></p><div class="event-slide-stage"><div class="event-slide-frame"><canvas role="img" aria-label="สไลด์สรุป Event" hidden></canvas><div class="event-slide-image-targets"></div><div class="event-slide-terms-editor" hidden></div><input class="event-slide-forecast-input" aria-label="ยอดขายคาดการณ์ (บาท)" title="คลิกเพื่อแก้ยอดขายคาดการณ์" inputmode="decimal" type="text" value="0" maxlength="20" autocomplete="off" hidden></div></div><div class="event-slide-recovery" hidden><button type="button" data-slide-retry>ลองใหม่</button></div><details class="event-slide-text" hidden><summary>อ่านข้อมูลสไลด์</summary><div></div></details>`;
 document.body.append(dialog);dialog.showModal();
 const canvas=dialog.querySelector('canvas'),status=dialog.querySelector('[role="status"]'),download=dialog.querySelector('[data-slide-download]'),present=dialog.querySelector('[data-slide-present]'),recovery=dialog.querySelector('.event-slide-recovery'),stage=dialog.querySelector('.event-slide-stage');
 const imageTargets=dialog.querySelector('.event-slide-image-targets'),forecastInput=dialog.querySelector('.event-slide-forecast-input');
 const termsEditor=dialog.querySelector('.event-slide-terms-editor'),save=dialog.querySelector('[data-slide-save]'),reset=dialog.querySelector('[data-slide-reset]');
 let savedRow=initialRow,historyRows=[],dirty=false,saving=false,editToken=crypto.randomUUID();
 let slideSource=initialSource,slideImages=[],brandImage=null,ready=false;
 const editable=()=>options.canEdit&&(!options.canMutate||options.canMutate())&&savedRow.source==='web'&&savedRow.input&&ready;
 function fillTerms(){
  termsEditor.hidden=!editable();save.hidden=reset.hidden=!editable();
  if(!editable())return;
  termsEditor.style.left=(slideImages.length?884:1192)/1920*100+'%';
  termsEditor.style.width=(slideImages.length?452:640)/1920*100+'%';
  const input=currentRow.input,space=input.channel==='gp'?'gp':'rent';
  const layout=slideGeometry(canvas.getContext('2d'),eventSlideModel(currentRow,slideSource,forecastInput.value));
  termsEditor.style.top=(layout.bodyY-26)/1080*100+'%';termsEditor.style.height=(layout.bodyHeight+26)/1080*100+'%';
  termsEditor.replaceChildren();
  const field=(key,label,choices)=>{
   const wrapper=document.createElement('label');wrapper.textContent=label;
   const control=document.createElement(choices?'select':'input');control.dataset.term=key;control.setAttribute('aria-label',label);
   if(choices){for(const [value,title] of choices){const option=document.createElement('option');option.value=value;option.textContent=title;control.append(option);}}
   else{control.type='number';control.min='0';control.max=['gp','cogs'].includes(key)?'100':'10000000000';control.step='0.01';}
   control.value=input[key]??'';wrapper.append(control);termsEditor.append(wrapper);
  };
  field('channel','รูปแบบ',[['direct','เก็บเงินเอง'],['gp','ลานโปร GP']]);field(space,space==='gp'?'GP / ยอดขาย (%)':'ค่าเช่ารวม (บาท)');
  field('cogs','ต้นทุนสินค้า (%)');field('pc',input.pcCostMode==='person'?'PC / คน / วัน (บาท)':'PC รวม / วัน (บาท)');
  field('shipping','ขนส่ง / งาน (บาท)');field('other','ค่าใช้จ่ายอื่น / งาน (บาท)');
 }
 function changeTerms(event){
  if(saving)return;
  const patch=Object.fromEntries([...termsEditor.querySelectorAll('[data-term]')].map(el=>[el.dataset.term,el.value]));
  currentRow=slideTermsRow(savedRow,patch,historyRows);dirty=true;editToken=crypto.randomUUID();
  if(event.target.dataset.term==='channel')fillTerms();
  renderForecast();
 }
 termsEditor.addEventListener('input',changeTerms);
 reset.onclick=()=>{currentRow=savedRow;dirty=false;fillTerms();renderForecast();};
 save.onclick=async()=>{
  if(!dirty||saving||save.disabled)return;
  if(!editable()){status.textContent='ยังอัปเดตข้อมูลไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก';return;}
  saving=true;save.disabled=reset.disabled=true;termsEditor.inert=true;
  status.textContent='กำลังบันทึกเงื่อนไขและคำนวณข้อมูลที่เกี่ยวข้อง…';
  try{
   const response=await fetch('/api/event-requests',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:savedRow.id,revision:savedRow.updatedAt||savedRow.createdAt,editToken,place:savedRow.forecastPlace||savedRow.place,startDate:savedRow.startDate,endDate:savedRow.endDate,input:currentRow.input,referenceKey:savedRow.reference.signature}),signal:AbortSignal.timeout(25000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');
   dirty=false;await build();await options.onSaved?.();window.dispatchEvent(new Event('ving:changed'));
   if(!ready)throw Error('บันทึกแล้ว แต่โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณากดลองใหม่');
   status.textContent='บันทึกแล้ว · อัปเดตต้นทุนคงที่และตัวเลขที่เกี่ยวข้องแล้ว · ข้อเสนอกลับไปรออนุมัติ';
  }catch(error){status.textContent=error.name==='TimeoutError'?'ยังยืนยันการบันทึกไม่ได้ กดบันทึกซ้ำเพื่อตรวจผลได้':error.message;}
  finally{saving=false;termsEditor.inert=false;reset.disabled=false;save.disabled=!dirty;}
 };
 let currentRow=initialRow,busy=false,imageUrls=[],imageDialog,openingImage=false;
 async function openImage(index,button){
  if(openingImage||imageDialog?.open||!dialog.open)return;
  openingImage=true;
  const wasPresenting=document.fullscreenElement===stage;
  try{
   if(!document.fullscreenElement&&stage.requestFullscreen)await stage.requestFullscreen();
  }catch{/* The image viewer still fills the viewport when fullscreen is unavailable. */}
  openingImage=false;
  if(!dialog.open)return;
  const enteredFullscreen=!wasPresenting&&document.fullscreenElement===stage;
  imageDialog=openEventImage(imageUrls,index,button,{fullscreen:true,parent:stage});
  const viewer=imageDialog;
  const onFullscreenChange=()=>{if(!document.fullscreenElement&&viewer.open)viewer.close();};
  document.addEventListener('fullscreenchange',onFullscreenChange);
  viewer.addEventListener('close',()=>{
   document.removeEventListener('fullscreenchange',onFullscreenChange);
   if(enteredFullscreen&&document.fullscreenElement===stage)document.exitFullscreen().catch(()=>{});
   if(imageDialog===viewer)imageDialog=null;
  },{once:true});
 }
 dialog.querySelector('[data-slide-close]').onclick=()=>{if(!saving&&!dirty)dialog.close();else if(dirty)status.textContent='มีค่าใช้จ่ายที่ยังไม่บันทึก กรุณาบันทึกหรือยกเลิกการแก้ไขก่อนปิด';};
 dialog.addEventListener('cancel',event=>{if(saving||dirty){event.preventDefault();status.textContent='กรุณาบันทึกหรือยกเลิกการแก้ไขก่อนปิด';}});
 dialog.addEventListener('click',event=>{if(event.target===dialog&&!saving&&!dirty)dialog.close();});
 dialog.addEventListener('close',()=>{imageDialog?.close();dialog.remove();opener?.focus({preventScroll:true});},{once:true});
 function renderForecast(){
  if(!ready)return;
  const model=eventSlideModel(currentRow,slideSource,forecastInput.value);
  drawEventSlide(canvas,model,slideImages,brandImage);
  const invalid=model.forecast.invalid||Boolean(currentRow.calculation?.errors?.length);
  save.disabled=!dirty||invalid||saving;reset.disabled=!dirty||saving;
  forecastInput.setAttribute('aria-invalid',String(invalid));
  download.disabled=present.disabled=invalid;
  const details=dialog.querySelector('.event-slide-text');details.hidden=false;
  details.querySelector('div').textContent=[model.title,model.subtitle,`Trade: ${model.trade} · CEO: ${model.ceo}`,...[...model.metrics,...model.facts,...model.terms].map(([label,value])=>`${label}: ${value}`),model.targets,...(model.goals||[]).map(([label,value])=>`${label}: ${value}`),model.basis,...model.notes,model.footnote,model.source].join('\n');
  status.textContent=dirty?(invalid?'กรุณากรอกค่าใช้จ่ายให้ครบและอยู่ในช่วงที่กำหนด':'ยังไม่บันทึก · ต้นทุนคงที่ '+baht(currentRow.calculation.fixedCosts)+' · บันทึกแล้วข้อเสนอจะกลับไปรออนุมัติ'):invalid?'กรอกยอดขายตั้งแต่ 0 ถึง 10,000,000,000 บาท':model.forecast.profit===null?'ต้นทุนไม่ครบ จึงยังคำนวณกำไรไม่ได้ [ต้องถามเจ้าของ]':'ต้นทุนคงที่ '+baht(currentRow.calculation?.fixedCosts)+' · ยอดขายทดลองใช้เฉพาะสไลด์ · แก้ค่าใช้จ่ายแล้วกดบันทึก'+(slideImages.length?' · คลิกรูปเพื่อดูเต็มจอ':'');
 }
 forecastInput.addEventListener('input',renderForecast);
 forecastInput.addEventListener('focus',()=>forecastInput.select());
 forecastInput.addEventListener('blur',()=>{
  const value=slideForecast(currentRow,forecastInput.value).sales;
  if(value!==null&&value>=0&&value<=1e10)forecastInput.value=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
  renderForecast();
 });
 async function build(){
  if(busy)return;busy=true;ready=false;forecastInput.hidden=true;download.disabled=present.disabled=true;canvas.hidden=true;imageTargets.replaceChildren();imageUrls=[];recovery.hidden=true;status.textContent='กำลังเตรียมข้อมูลและรูปแนบ…';
  try{
   let source=initialSource;
   if(initialRow.deletionKey){
    const response=await fetch('/api/event-proposals/detail?key='+encodeURIComponent(initialRow.deletionKey),{cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok||!result.item)throw Error(result.error||'ยังโหลดข้อมูล Event ไม่ได้');currentRow=result.item;source=result.source;
   }
   await Promise.all([document.fonts.load('400 28px IBM Plex Sans Thai Looped','สรุป Event'),document.fonts.load('600 34px IBM Plex Sans Thai Looped','สรุป Event'),document.fonts.load('600 74px IBM Plex Sans Thai Looped','สรุป Event ฿0123456789')]);
   const urls=slideImageUrls(currentRow),images=await Promise.all(urls.map(loadImage));
   brandImage=await loadImage('/assets/ving-brand-source.png');
   if(!dialog.open)return;
   savedRow=currentRow;
   historyRows=[];
   if(options.canEdit&&currentRow.input?.mode==='history'){
    const response=await fetch('/api/event-predict',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('โหลดข้อมูลอ้างอิงสำหรับแก้ไขไม่ได้ กรุณาลองใหม่');
    const data=await response.json();historyRows=historyFor(data.records,identifyForecastVenue(currentRow.forecastPlace||currentRow.place).id,null,new Date(Date.now()+7*3600000).toISOString().slice(0,10));
   }
   slideSource=source;slideImages=images;ready=true;fillTerms();
   const model=eventSlideModel(currentRow,source,forecastInput.value);renderForecast();canvas.hidden=false;forecastInput.hidden=false;
   canvas.setAttribute('aria-label','สไลด์เสนอผู้บริหาร '+model.title);
   imageUrls=urls;
   slideImageBoxes(images.length,slideGeometry(canvas.getContext('2d'),model)).forEach((box,index)=>{
    const button=document.createElement('button');button.type='button';button.className='event-slide-image-target';
    button.setAttribute('aria-label',`ดูรูปประกอบสถานที่ ${index+1} เต็มจอ`);button.title=`ดูรูปที่ ${index+1} เต็มจอ`;
    button.style.cssText=`left:${box.x/1920*100}%;top:${box.y/1080*100}%;width:${box.width/1920*100}%;height:${box.height/1080*100}%`;
    button.onclick=()=>openImage(index,button);imageTargets.append(button);
   });
  }catch(error){if(dialog.open){status.textContent=error.name==='TimeoutError'?'โหลดข้อมูลนานกว่าปกติ กรุณาลองใหม่':error.message;recovery.hidden=false;}}
  finally{busy=false;}
 }
 dialog.querySelector('[data-slide-retry]').onclick=build;
 download.onclick=()=>{
  download.disabled=true;
  canvas.toBlob(blob=>{
   download.disabled=false;if(!blob){status.textContent='ยังสร้างไฟล์ภาพไม่ได้ กรุณาลองใหม่';return;}
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`VING-Event-${text(currentRow.place||currentRow.name).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-')}-${new Date().toISOString().slice(0,10)}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status.textContent='ดาวน์โหลดภาพ 1920 × 1080 แล้ว · นำภาพไปวางใน PowerPoint หรือ Google Slides ได้';
  },'image/png');
 };
 present.onclick=async()=>{try{if(stage.requestFullscreen)await stage.requestFullscreen();else dialog.classList.toggle('event-slide-expanded');}catch{dialog.classList.toggle('event-slide-expanded');}};
 await build();
}
