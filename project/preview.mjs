import http from 'node:http';
import worker from './dist/server/index.js';
import fs from 'node:fs';
import { previewDatabase } from './preview-db.mjs';
fs.mkdirSync('.sites-runtime',{recursive:true});
const env={DB:previewDatabase('.sites-runtime/preview.sqlite'),BUCKET:{get:async()=>null}};
http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await worker.fetch(new Request('http://127.0.0.1:4175'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}}).listen(4175,'127.0.0.1',()=>console.log('http://127.0.0.1:4175'));
