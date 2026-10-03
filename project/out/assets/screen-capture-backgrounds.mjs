// WebKit taints a canvas when createPattern receives an SVG data URL, even
// though drawing that same SVG directly is safe. Rasterize only background
// images in the capture clone; keep live controls and inline SVG charts intact.
export async function prepareCaptureBackgrounds(doc){
 const images=new Map();
 async function raster(url){
  const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();
  const canvas=doc.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  try{
   if(!canvas.width||!canvas.height)throw Error('ภาพพื้นหลังมีขนาดไม่ถูกต้อง');
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('สร้างภาพพื้นหลังไม่สำเร็จ');
   ctx.drawImage(image,0,0);return canvas.toDataURL('image/png');
  }finally{canvas.width=canvas.height=0;}
 }
 for(const element of doc.querySelectorAll('*')){
  const background=doc.defaultView.getComputedStyle(element).backgroundImage;
  if(!background.includes('data:image/svg+xml'))continue;
  const matches=[...background.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)];
  let value=background;
  for(const match of matches){
   const url=match[1]??match[2]??match[3];if(!url.startsWith('data:image/svg+xml'))continue;
   if(!images.has(url))images.set(url,raster(url));
   value=value.replace(match[0],`url("${await images.get(url)}")`);
  }
  element.style.setProperty('background-image',value,'important');
 }
}
