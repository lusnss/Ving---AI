export const stockBranchTypes={all:'ทุกประเภท',standalone:'Stand alone',rbs:'RBS',cds:'CDS'};
export function stockBranchType(branch){const id=String(branch.id||'').toUpperCase().replace(/[\s_-]/g,'');return /^STANDALONE\d+$/.test(id)?'standalone':/^RBS\d+$/.test(id)?'rbs':/^CDS\d+$/.test(id)?'cds':'other';}
export function branchesForStockType(branches,type){return type==='all'?branches:branches.filter(b=>stockBranchType(b)===type);}
export function summarizeStock(items){return items.reduce((a,s)=>({normal:a.normal+s.normal,hold:a.hold+s.hold,total:a.total+s.total,skus:a.skus+1}),{normal:0,hold:0,total:0,skus:0});}
