import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
export function previewDatabase(filename=':memory:',{includeSeedData=filename!==':memory:'}={}) {
 const db=new DatabaseSync(filename);
 db.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
 for(const name of fs.readdirSync(new URL('./drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  const sql=fs.readFileSync(new URL('./drizzle/'+name,import.meta.url),'utf8');
  if(!includeSeedData&&sql.startsWith('-- data-only-seed'))continue;
  if(db.prepare('SELECT name FROM preview_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN');try{db.exec(sql);db.prepare('INSERT INTO preview_migrations (name) VALUES (?)').run(name);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 return {prepare(sql){let values=[];const statement=db.prepare(sql);return {bind(...args){values=args;return this;},async run(){return statement.run(...values);},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};}};},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}},close:()=>db.close()};
}
