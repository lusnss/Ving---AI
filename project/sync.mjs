import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {sanitizeSnapshot,tables} from './sanitize.mjs';
import {loadEventCatalog} from './event-catalog.mjs';
import {reconcileEvents} from './events-data.mjs';
const root=import.meta.dirname;
const source=path.resolve(root,'../marketing-warroom-os-delivery-v2.0.3-marketing-warroom-os');
const {createRequestDispatcher}=await import(pathToFileURL(path.join(source,'app/server.mjs')));
const endpoint='https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site/api/sync';
const token=(await fs.readFile(path.join(root,'.sync-secret'),'utf8')).trim();
let stopped=false;process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
async function once(){
  const data={};const dispatch=createRequestDispatcher({rootDir:source});
  await Promise.all([...tables,'mall-sales','contracts','events'].map(async name=>{const result=await dispatch({method:'GET',url:'/api/'+name,headers:{host:'127.0.0.1:4173'}});if(result.status!==200)throw Error('Unable to read '+name);data['/api/'+name]=JSON.parse(result.body);}));
  const daily=await dispatch({method:'GET',url:'/api/daily-sales',headers:{host:'127.0.0.1:4173'}});
  // Keep the current public snapshot healthy while the offline app is being
  // upgraded. sanitizeSnapshot supplies a safe empty report until this route
  // is available, then starts sending it on the next sync.
  if(daily.status===200)data['/api/daily-sales']=JSON.parse(daily.body);
  else if(daily.status!==404)throw Error('Unable to read daily-sales');
  data['/api/events']=reconcileEvents(await loadEventCatalog(source),data['/api/daily-sales']);
  const snapshot=sanitizeSnapshot({exportedAt:new Date().toISOString(),data});
  const response=await fetch(endpoint,{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(snapshot),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Sync HTTP '+response.status);
  const result=await response.json();await fs.writeFile(path.join(root,'.sync-state.json'),JSON.stringify({ok:true,syncedAt:result.syncedAt}),{mode:0o600});
  console.log('Synced '+result.syncedAt);
}
do{const start=Date.now();try{await once();}catch(error){console.error(new Date().toISOString()+' '+error.message);await fs.writeFile(path.join(root,'.sync-state.json'),JSON.stringify({ok:false,lastAttempt:new Date().toISOString(),error:error.message}),{mode:0o600});if(process.argv.includes('--once'))process.exitCode=1;}if(process.argv.includes('--once'))break;if(!stopped)await new Promise(r=>setTimeout(r,Math.max(1000,30000-(Date.now()-start))));}while(!stopped);
