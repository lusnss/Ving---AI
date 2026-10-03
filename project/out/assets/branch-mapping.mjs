// Branch identities confirmed by the owner. Keep venue promotions (for example
// Fashion Island / Sneaker Showcase) separate from these permanent counters.
const branchMappings = [
  { code:'VC-014', type:'RBS', name:'พิษณุโลก', sourceName:'พิษณุโลก' },
  { code:'VC-006', type:'RBS', name:'CM (เชียงใหม่)', sourceName:'โรบินสันเชียงใหม่' },
  { code:'VC-028', type:'CDS', name:'Fashion Island', sourceName:'แฟชั่นไอซ์แลนด์' },
  { code:'VC-010', type:'CDS', name:'RAMA 2', sourceName:'พระราม2' },
  { code:'VA-007', type:'Stand alone', name:'สนามกีฬาเทพหัสดิน', sourceName:'สนามกีฬาเทพหัสดิน' }
];
const identityText = value => String(value || '').trim().toLowerCase().replace(/\s+/g,'');

export function confirmedBranchMapping(branch) {
  const code = identityText(branch.branch_code), name = identityText(branch.branch);
  return branchMappings.find(mapping => {
    const coded = code === identityText(mapping.code);
    const matchingType = identityText(branch.type) === identityText(mapping.type);
    if (coded) return (matchingType || mapping.code === 'VA-007') &&
      [mapping.name,mapping.sourceName].some(value => identityText(value) === name);
    return !code && matchingType && name === identityText(mapping.name);
  });
}

function emptyAlias(branch) {
  const mtd = branch.month_to_date;
  return (mtd == null || String(mtd).trim() === '' || Number(mtd) === 0) &&
    Object.values(branch.daily_sales || {}).every(value => value == null || String(value).trim() === '');
}

export function normalizeReportBranches(branches) {
  // The owner confirmed the uncoded Phitsanulok Event row refers to VC-014.
  // The coded source is authoritative: never add the alias sales or target.
  const phitsanulok = branches.filter(branch => confirmedBranchMapping(branch)?.code === 'VC-014');
  const primary = phitsanulok.filter(branch => identityText(branch.branch_code) === 'vc-014');
  if (primary.length === 1) branches = branches.filter(branch =>
    !phitsanulok.includes(branch) || branch === primary[0]);
  branches = mergeLadpraoSales(branches);
  const codedCounts = new Map();
  for (const branch of branches) {
    const mapping = confirmedBranchMapping(branch);
    if (mapping && identityText(branch.branch_code) === identityText(mapping.code)) {
      codedCounts.set(mapping.code,(codedCounts.get(mapping.code) || 0) + 1);
    }
  }
  return branches.flatMap(branch => {
    const mapping = confirmedBranchMapping(branch);
    if (!mapping) return [branch];
    // Drop only an entirely unrecorded alias with one verified coded counterpart.
    // Its placeholder target must not be added to the counter's source target.
    if (!identityText(branch.branch_code) && codedCounts.get(mapping.code) === 1 && emptyAlias(branch)) return [];
    return [{...branch,branch:mapping.name,type:mapping.type,source_section:'branch'}];
  });
}

// Owner confirmed that the uncoded CDS Ladprao rows are one counter, including
// the row placed in the workbook's Event section. Keep its daily sales, but
// count the counter's monthly target only once. Do not merge other venues.
export function isLadpraoCounter(branch) {
  return !identityText(branch.branch_code) && identityText(branch.type) === 'cds' &&
    identityText(branch.branch) === 'ลาดพร้าว';
}

function mergeLadpraoSales(branches) {
  const matches = branches.filter(isLadpraoCounter);
  if (!matches.length) return branches;
  const primary = matches.find(branch => branch.source_section === 'branch') || matches[0];
  const merged = {...primary, branch:'ลาดพร้าว', type:'CDS', source_section:'branch',
    month_to_date:0, daily_sales:{}};
  for (const branch of matches) {
    merged.month_to_date += Number(branch.month_to_date || 0);
    for (const [date,value] of Object.entries(branch.daily_sales || {})) {
      if (value != null && String(value).trim() !== '' && Number.isFinite(Number(value))) {
        merged.daily_sales[date] = (merged.daily_sales[date] ?? 0) + Number(value);
      } else if (!(date in merged.daily_sales)) merged.daily_sales[date] = null;
    }
  }
  let emitted = false;
  return branches.flatMap(branch => {
    if (!isLadpraoCounter(branch)) return [branch];
    if (emitted) return [];
    emitted = true;
    return [merged];
  });
}
