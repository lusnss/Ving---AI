import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clean, sanitizeDailySales } from './sanitize.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, '../marketing-warroom-os-delivery-v2.0.3-marketing-warroom-os');
const out = path.join(root, 'out');
const { createRequestDispatcher } = await import(pathToFileURL(path.join(source, 'app/server.mjs')));
const dispatch = createRequestDispatcher({ rootDir: source });
async function sourceDashboard(name) {
  const response = await dispatch({ method: 'GET', url: `/api/${name}`, headers: { host: '127.0.0.1:4173' } });
  if (response.status !== 200) throw new Error(`${name}: ${response.status}`);
  return JSON.parse(response.body);
}
await mkdir(path.join(out, 'assets'), {recursive:true});
// These modules contain the public-only login, read-only, and live-polling
// behaviour. Preserve them when refreshing copied offline assets.
const publicAssets=Object.fromEntries(await Promise.all(['app.mjs','api.mjs','settings.mjs','readonly.css','readonly.mjs'].map(async name=>[name,await readFile(path.join(out,'assets',name),'utf8').catch(()=>null)])));
await cp(path.join(source,'app/assets'),path.join(out,'assets'),{recursive:true});
const tables=['ca_sources','ca_news_items','ca_candidates','ca_post_log','content_items','content_variants','publications','analytics_snapshots','intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','intel_scripts','wr_jobs','notifications','agent_requests'];
const snapshot={};
for(const name of tables) snapshot['/api/'+name]=clean(JSON.parse(await readFile(path.join(source,'data',name+'.json'),'utf8')));
for(const endpoint of ['mall-sales','contracts','events']) {
  snapshot['/api/'+endpoint]=clean(await sourceDashboard(endpoint));
  if(snapshot['/api/'+endpoint].source)snapshot['/api/'+endpoint].source.url='';
}
snapshot['/api/daily-sales']=sanitizeDailySales(await sourceDashboard('daily-sales'));
const brand=JSON.parse(await readFile(path.join(source,'app/brand.json'),'utf8'));
snapshot['/api/meta']={...brand,companyName:'VING',sceneCardEnabled:false,newsDailyLastRun:null};
const stamp=new Date().toISOString();
await writeFile(path.join(out,'snapshot.json'),JSON.stringify({exportedAt:stamp,data:snapshot}));
let api=await readFile(path.join(out,'assets/api.mjs'),'utf8');
api=api.slice(api.indexOf('export function uid'));
await writeFile(path.join(out,'assets/api.mjs'),`let snapshot;\nexport async function api(url, options={}) {\n if(options.method && !['GET','HEAD'].includes(options.method.toUpperCase())) throw new Error('เวอร์ชันดูอย่างเดียว');\n snapshot ||= fetch('/snapshot.json').then(r=>{if(!r.ok)throw new Error('โหลดข้อมูลไม่สำเร็จ');return r.json();});\n const data=(await snapshot).data; const u=new URL(url,location.origin);\n if(!(u.pathname in data))throw new Error('ข้อมูลนี้ไม่เปิดเผยในเวอร์ชันสาธารณะ');\n let result=structuredClone(data[u.pathname]);\n if(result.items){const {order,limit,...filters}=Object.fromEntries(u.searchParams);result.items=result.items.filter(x=>Object.entries(filters).every(([k,v])=>String(x[k])===v.replace(/^eq\\./,'')));if(order){const [key,dir]=order.split('.');result.items.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(dir==='desc'?-1:1));}if(limit)result.items=result.items.slice(0,Number(limit));}\n return result;\n}\n`+api);
await writeFile(path.join(out,'assets/settings.mjs'),`export async function render(root){root.innerHTML='<header class="page-head"><h1>Settings</h1><p>เวอร์ชันสาธารณะสำหรับดูข้อมูลเท่านั้น การตั้งค่าและข้อมูลเชื่อมต่ออยู่ในระบบต้นฉบับ</p></header>';}`);
const pages=['content','news-desk','intel','sales','daily-sales','contracts','events','jobs','settings','card'];
function includeDailySalesTab(html){return html.includes('data-nav="daily-sales"')?html:html.replace('<a href="/sales" data-nav="sales">ยอดขายห้าง</a>','<a href="/sales" data-nav="sales">ยอดขายห้าง</a>\n      <a href="/daily-sales" data-nav="daily-sales">Sales Report</a>');}
for(const name of pages){
  let html;
  try{html=await readFile(path.join(source,'app/views',name+'.html'),'utf8');}
  catch(error){if(name==='daily-sales'&&error?.code==='ENOENT')continue;throw error;}
  html=includeDailySalesTab(html).replaceAll('{{PRODUCT_NAME}}',brand.productName).replaceAll('{{PRODUCT_TAGLINE}}',brand.productTagline).replace('</head>','<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/assets/readonly.css"></head>').replace('<body>',`<body><aside class="readonly-banner">ดูอย่างเดียว · ข้อมูลเผยแพร่ ${stamp} · การเปลี่ยนแปลงในเครื่องจะปรากฏเมื่อเผยแพร่ใหม่</aside>`).replace('</body>','<script type="module" src="/assets/readonly.mjs"></script></body>');
  await writeFile(path.join(out,name+'.html'),html);
  if(name==='content')await writeFile(path.join(out,'index.html'),html);
}
await writeFile(path.join(out,'assets/readonly.css'),'.readonly-banner{padding:10px 20px;background:#183329;color:#fff;font:13px system-ui;text-align:center} [data-readonly-disabled]{opacity:.4;cursor:not-allowed!important}');
await writeFile(path.join(out,'assets/readonly.mjs'),`const mutating=/บันทึก|เพิ่ม|สร้าง|ลบ|แก้ไข|ส่งเข้า|สืบ|ลองใหม่|รีเฟรช|รัน|เกลา|รับช่องทาง|ปัดช่องทาง|โพสต์|อนุมัติ|ปฏิเสธ/;\nfunction lock(){for(const el of document.querySelectorAll('button'))if(mutating.test(el.textContent)||el.type==='submit'){el.disabled=true;el.dataset.readonlyDisabled='';el.title='เวอร์ชันดูอย่างเดียว';}for(const el of document.querySelectorAll('[draggable="true"]'))el.draggable=false;for(const el of document.querySelectorAll('textarea,input:not([type="search"]),select[data-action], [contenteditable="true"]')){if(el.tagName==='TEXTAREA'||el.tagName==='INPUT')el.readOnly=true;else if(el.tagName==='SELECT')el.disabled=true;else el.contentEditable='false';}}\nnew MutationObserver(lock).observe(document.body,{childList:true,subtree:true});lock();document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);`);
for(const [name,contents] of Object.entries(publicAssets))if(contents!==null)await writeFile(path.join(out,'assets',name),contents);
await writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
await mkdir(path.join(root,'.openai'),{recursive:true});
let hosting={};try{hosting=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));}catch{}
const { static: unusedStaticConfig, ...workerHosting } = hosting;
await writeFile(path.join(root,'.openai/hosting.json'),`${JSON.stringify(workerHosting, null, 2)}\n`);
console.log('Exported '+pages.length+' pages; snapshot '+stamp);
