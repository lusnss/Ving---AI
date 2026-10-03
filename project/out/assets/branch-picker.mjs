import {escapeHtml as e} from './api.mjs';

export function branchPicker(branches,selected){
 const label=branches.find(b=>b.id===selected)?.name||'ทุกสาขา';
 return `<div class="gp-field gp-branch-field"><label for="gp-branch">สาขา</label><div class="gp-branch-picker"><div class="gp-branch-input"><input id="gp-branch" data-gp-control role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="gp-branch-options" autocomplete="off" placeholder="พิมพ์ชื่อหรือรหัสสาขา…" value="${e(label)}"><button type="button" data-gp-control class="gp-branch-toggle" aria-label="แสดงรายชื่อสาขา" tabindex="-1">⌄</button></div><div id="gp-branch-options" role="listbox" aria-label="รายชื่อสาขา" hidden></div><span class="gp-sr-only" id="gp-branch-result" role="status" aria-live="polite"></span></div></div>`;
}

export function bindBranchPicker(host,branches,selected,onSelect){
 const root=host.querySelector('.gp-branch-picker'),input=root.querySelector('input'),list=root.querySelector('[role=listbox]'),status=root.querySelector('[role=status]');
 const options=[{id:'',name:'ทุกสาขา'},...branches.slice().sort((a,b)=>a.name.localeCompare(b.name,'th'))];
 const selectedLabel=options.find(b=>b.id===selected)?.name||'ทุกสาขา';
 let matches=[],active=-1;
 const isOpen=()=>input.getAttribute('aria-expanded')==='true';
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=selectedLabel;}
 function highlight(){list.querySelectorAll('[role=option]').forEach((el,i)=>el.classList.toggle('active',i===active));if(active>=0){input.setAttribute('aria-activedescendant','gp-branch-option-'+active);list.children[active]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
 function open(query=''){
  const q=query.normalize('NFC').trim().toLocaleLowerCase();
  matches=options.filter(b=>!q||(b.name+' '+b.id).normalize('NFC').toLocaleLowerCase().includes(q));active=-1;
  list.innerHTML=matches.map((b,i)=>`<div id="gp-branch-option-${i}" role="option" aria-selected="${b.id===selected}" data-index="${i}"><span>${e(b.name)}</span>${b.id?`<small>#${e(b.id)}</small>`:''}</div>`).join('')||'<div class="gp-branch-empty">ไม่พบสาขาที่ตรงกับคำค้น</div>';
  list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');status.textContent=matches.length+' รายการ';
 }
 input.addEventListener('focus',()=>{open();input.select();});
 input.addEventListener('click',()=>{if(!isOpen()){open();input.select();}});
 input.addEventListener('input',()=>open(input.value));
 input.addEventListener('keydown',ev=>{
  if(ev.isComposing)return;
  if(ev.key==='Escape'){ev.preventDefault();close();return;}
  if(ev.key==='Tab'){close();return;}
  if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
   ev.preventDefault();if(!isOpen())open();
   if(matches.length){active=ev.key==='ArrowDown'?(active+1)%matches.length:(active<=0?matches.length-1:active-1);highlight();}
  }else if(ev.key==='Enter'&&isOpen()){
   ev.preventDefault();const option=matches[active]||(matches.length===1?matches[0]:null);if(option)choose(option.id);
  }
 });
 function choose(id){close();onSelect(id);const replacement=host.querySelector('#gp-branch');replacement?.focus();replacement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));}
 list.addEventListener('pointerdown',ev=>ev.preventDefault());
 list.addEventListener('click',ev=>{const option=ev.target.closest('[data-index]');if(option)choose(matches[Number(option.dataset.index)].id);});
 root.querySelector('button').addEventListener('pointerdown',ev=>ev.preventDefault());
 root.querySelector('button').addEventListener('click',()=>{if(isOpen())close();else{input.focus();open();input.select();}});
 root.addEventListener('focusout',ev=>{if(!root.contains(ev.relatedTarget))close();});
}
