import {api} from './api.mjs';
import {installNotifications} from './notifications.mjs';
import {ensureRequiredMobilePush} from './iphone-push-gate.mjs';
await ensureRequiredMobilePush();
const dialog=document.querySelector('#app-dialog');let trigger;
const showDialog=html=>{trigger=document.activeElement;document.querySelector('#app-dialog-body').innerHTML=html;dialog.showModal();dialog.querySelector('button,a')?.focus();};
dialog.addEventListener('click',event=>{if(event.target.matches('[data-close-dialog]'))dialog.close();});dialog.addEventListener('close',()=>trigger?.focus());
const toast=(message)=>{const node=document.querySelector('#app-toast');node.textContent=message;node.hidden=false;setTimeout(()=>node.hidden=true,3500);};
installNotifications({api,showDialog,toast});
for(const menu of document.querySelectorAll('.nav-menu')){menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});}
