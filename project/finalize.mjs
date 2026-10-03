import fs from 'node:fs/promises';
const p=new URL('./out/',import.meta.url);
const s=JSON.parse(await fs.readFile(new URL('snapshot.json',p),'utf8'));
for(const key of ['mall-sales','contracts','events']){const d=s.data['/api/'+key];if(d.source&&typeof d.source==='object'){d.source.online_status='snapshot';d.source.url='';d.source.status_message='ชุดข้อมูลที่เผยแพร่ ไม่อัปเดตอัตโนมัติ';}}
for(const j of s.data['/api/newsroom_jobs'].items){j.target='[ข้อมูลภายใน]';j.note='';j.result={};}
await fs.writeFile(new URL('snapshot.json',p),JSON.stringify(s));
let css=await fs.readFile(new URL('assets/readonly.css',p),'utf8');
css+='\n.sales-source-actions{display:none!important}';
await fs.writeFile(new URL('assets/readonly.css',p),css);
let app=await fs.readFile(new URL('assets/app.mjs',p),'utf8');
app=app.replace('item.test(location.pathname)',"item.test(location.pathname.replace(/\\.html$/, '').replace(/\\/$/, '') || '/')");
await fs.writeFile(new URL('assets/app.mjs',p),app);
await fs.writeFile(new URL('out/_headers',import.meta.url),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n');
