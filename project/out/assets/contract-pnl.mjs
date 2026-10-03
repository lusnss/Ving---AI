// The contract and Stand alone report use these two labels for the same Rangsit location.
export function contractBranchName(name){const value=String(name||'').normalize('NFKC').trim();return value==='ฟิวเจอร์รังสิต'?'ฟิวเจอร์พาร์ครังสิต':value;}
export function sameContractBranch(name,branch){return contractBranchName(name).replace(/\s+/g,'').toLowerCase()===contractBranchName(branch).replace(/\s+/g,'').toLowerCase();}
export function contractPnlUrl(item){const branch=contractBranchName(item.sourceBranch||item.branch);return '/profit-loss?'+new URLSearchParams({branch,channel:'standalone',month:'all',basis:'ACT'});}
