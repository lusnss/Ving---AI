import {eventPages,eventPage,eventPageHref} from './event-pages.mjs';
import {escapeHtml as e} from './api.mjs';

const icons={
 overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 report:'<path d="M8 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8l-5-5H8Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
 chart:'<path d="M3 3v18h18M7 15l5-5 4 3 5-7"/>',
 rank:'<path d="M4 21V11h5v10M9 21V4h6v17M15 21v-7h5v7"/>',
 source:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
 link:'<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

export function eventNavigationMarkup({page='overview',state={}}={}){
 const current=eventPage(page),groups=[...new Set(eventPages.map(item=>item.group))];
 return `<aside class="ev-sidebar"><details class="ev-section-menu" data-event-navigation open><summary><span class="ev-nav-brand">EVENT</span><span class="ev-nav-caption">เลือกหน้า</span><span class="ev-nav-current">${e(current.label)}</span><svg class="ev-nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><nav aria-label="เมนูหน้า Event">${groups.map(group=>`<div class="ev-nav-group"><p>${e(group)}</p>${eventPages.filter(item=>item.group===group).map(item=>`<a href="${e(eventPageHref(item.key,state))}" data-event-page="${item.key}"${item.key===current.key?' aria-current="page"':''}>${icon(item.icon)}<span>${e(item.label)}</span></a>`).join('')}</div>`).join('')}</nav></details></aside>`;
}

export function syncEventNavigationLinks(root,state){
 root.querySelectorAll?.('[data-event-page]').forEach(link=>link.setAttribute('href',eventPageHref(link.dataset.eventPage,state)));
}

export function bindEventNavigation(root){
 root._eventNavigationCleanup?.();
 const menu=root.querySelector?.('[data-event-navigation]');
 if(!menu||!globalThis.window?.matchMedia)return;
 const controller=new AbortController(),{signal}=controller;
 const compact=window.matchMedia('(max-width: 900px)');
 const summary=menu.querySelector('summary');
 const sizeMenu=()=>{menu.open=!compact.matches||root.dataset.eventNavOpen==='true';summary.tabIndex=compact.matches?0:-1;};
 menu.addEventListener('click',event=>{if(event.target.closest('summary')&&!compact.matches)event.preventDefault();},{signal});
 menu.addEventListener('toggle',()=>{if(compact.matches)root.dataset.eventNavOpen=String(menu.open);},{signal});
 compact.addEventListener('change',sizeMenu,{signal});
 root._eventNavigationCleanup=()=>controller.abort();
 sizeMenu();
}
