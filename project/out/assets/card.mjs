export function parseGlance(value) {
  return String(value).split('|').map((line) => {
    const parts = []; let cursor = 0;
    for (const match of line.matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (match.index > cursor) parts.push({ text:line.slice(cursor,match.index),accent:false });
      parts.push({ text:match[1],accent:true }); cursor=match.index+match[0].length;
    }
    if (cursor < line.length) parts.push({ text:line.slice(cursor),accent:false });
    return parts.length ? parts : [{text:line,accent:false}];
  });
}

function renderText(node, lines) {
  node.replaceChildren();
  lines.forEach((line,index)=>{ if(index)node.append(document.createElement('br'));for(const part of line){const span=document.createElement('span');span.textContent=part.text;if(part.accent)span.className='urgent-note';node.append(span);} });
}

export async function render(root) {
  const params = new URLSearchParams(location.search); const text=params.get('text')||'ข้อความการ์ด'; const lines=parseGlance(text);
  root.innerHTML = '<header class="page-head"><p class="eyebrow">Text Card</p><h1 id="card-text">ข้อความการ์ด</h1><p class="lede">ตรวจข้อความก่อนบันทึกเป็นภาพด้วย Canvas</p></header><section class="card"><button id="card-save" class="btn btn-accent" type="button">บันทึกเป็นภาพ</button></section>';
  renderText(root.querySelector('#card-text'),lines);
  root.querySelector('#card-save').addEventListener('click',()=>{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const context=canvas.getContext('2d');context.fillStyle='#000000';context.fillRect(0,0,1080,1080);context.font='700 68px IBM Plex Sans Thai Looped, sans-serif';context.textBaseline='middle';
    lines.forEach((line,index)=>{const widths=line.map((part)=>context.measureText(part.text).width);let x=(1080-widths.reduce((a,b)=>a+b,0))/2;const y=500+(index-(lines.length-1)/2)*96;line.forEach((part,partIndex)=>{context.fillStyle=part.accent?'#ef7023':'#ffffff';context.fillText(part.text,x,y);x+=widths[partIndex];});});
    const link=document.createElement('a');link.download='text-card.png';link.href=canvas.toDataURL('image/png');link.click();
  });
}
