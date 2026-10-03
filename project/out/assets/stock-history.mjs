// Use the same completeness checks for the live report and saved sales mix.
export function completeForecastMonth(chunks,month){
 if(!chunks.length||chunks[0].page!==1)throw Error('Incomplete month');
 const first=chunks[0],rows=chunks.flatMap(c=>c.rows);
 for(let i=0;i<chunks.length;i++){const c=chunks[i];if(c.month!==month||c.total!==first.total||c.expectedQty!==first.expectedQty||c.page!==(i?chunks[i-1].nextPage:1))throw Error('Changed month');}
 if(chunks.at(-1).nextPage!==null||rows.length!==first.total||new Set(rows.map(r=>r.id)).size!==rows.length||Math.abs(rows.reduce((sum,r)=>sum+r.qty,0)-first.expectedQty)>.00001)throw Error('Incomplete sales');
 return {month,rows,total:first.total,fetchedAt:chunks.map(c=>c.fetchedAt).sort()[0]};
}
