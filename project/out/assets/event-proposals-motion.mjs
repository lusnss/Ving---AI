const format=new Intl.NumberFormat('th-TH',{maximumFractionDigits:0});

// Animate displayed totals once; the source values and calculations stay intact.
export function animateProposalMetrics(root,previous){
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 for(const el of root.querySelectorAll('[data-proposal-number]')){
  const target=Number(el.dataset.proposalNumber),key=el.dataset.metricKey;
  const from=previous.has(key)?previous.get(key):0;
  previous.set(key,target);
  if(reduced.matches||from===target)continue;
  const start=performance.now(),duration=850;
  el.setAttribute('aria-label',format.format(target));
  function tick(now){
   if(!el.isConnected)return;
   const progress=reduced.matches?1:Math.min(1,(now-start)/duration);
   el.textContent=format.format(from+(target-from)*(1-Math.pow(1-progress,4)));
   if(progress<1)requestAnimationFrame(tick);
   else el.textContent=format.format(target);
  }
  requestAnimationFrame(tick);
 }
}

export function installProposalMotion(root){
 const pointer=window.matchMedia('(hover: hover) and (pointer: fine)');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let frame=null,latest=null;
 root.addEventListener('pointermove',event=>{
  if(!pointer.matches||reduced.matches)return;
  const card=event.target.closest('[data-proposal-light]');
  if(!card)return;
  latest={card,x:event.clientX,y:event.clientY};
  if(frame!==null)return;
  frame=requestAnimationFrame(()=>{
   frame=null;
   if(!latest.card.isConnected)return;
   const rect=latest.card.getBoundingClientRect();
   latest.card.style.setProperty('--light-x',`${latest.x-rect.left}px`);
   latest.card.style.setProperty('--light-y',`${latest.y-rect.top}px`);
  });
 },{passive:true});
}
