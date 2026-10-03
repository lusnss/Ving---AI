// Presentation helpers. Pricing, stock allocation and approval rules stay in promotion-model.
export function filterPromotionRows(rows, {query='', tier='all', quick='all', sort='stock', selected=new Map(), policy}, tierFor) {
  const q=query.trim().toLocaleLowerCase('th-TH');
  const result=rows.filter(row =>
    (!q || [row.model, row.grade, ...(row.colors||[]), ...(row.sizes||[]), row.branchName].join(' ').toLocaleLowerCase('th-TH').includes(q)) &&
    (tier==='all' || tierFor(row.stockPerSource??row.available,policy)===Number(tier)) &&
    (quick==='all' || quick==='selected'&&selected.has(row.key) || quick==='no-sales'&&row.noSales || quick==='available'&&row.available>0)
  );
  return result.sort((a,b)=>{
    if(sort==='name')return a.model.localeCompare(b.model,'th',{numeric:true}) || (b.available-a.available);
    if(sort==='doh'){
      const aKnown=Number.isFinite(a.doh),bKnown=Number.isFinite(b.doh);
      if(aKnown!==bKnown)return aKnown?-1:1;
      if(aKnown&&a.doh!==b.doh)return b.doh-a.doh;
    }
    return b.available-a.available || a.model.localeCompare(b.model,'th',{numeric:true});
  });
}

export function workbenchToolbar(state, escape) {
  const filters=[['all','ทั้งหมด'],['available','มีสต็อก'],['no-sales','ไซซ์ไม่พบขาย'],['selected','ที่เลือกแล้ว']];
  return `<div class="pm-workbench-tools"><div class="pm-quick-filters" role="group" aria-label="ตัวกรองด่วน">${filters.map(([key,label])=>`<button type="button" data-promo-control data-quick="${key}" aria-pressed="${state.quick===key}">${label}${key==='selected'?` <span data-selected-count>${state.selected.size}</span>`:''}</button>`).join('')}</div><div class="pm-view-tools"><label><span class="pm-sr">เรียงรุ่นสินค้า</span><select data-field="sort" data-promo-control aria-label="เรียงรุ่นสินค้า">${[['stock','สต็อกมาก → น้อย'],['doh','DOH มาก → น้อย'],['name','ชื่อรุ่น A → Z']].map(([key,label])=>`<option value="${key}" ${state.sort===key?'selected':''}>${escape(label)}</option>`).join('')}</select></label><button type="button" data-promo-control data-action="density" class="pm-density" aria-pressed="${state.compact}" aria-label="แสดงตารางแบบกระชับ" title="ตารางแบบกระชับ">☷ <span>กระชับ</span></button></div></div><div class="pm-filter-status" ${state.query||state.tier!=='all'||state.quick!=='all'?'':'hidden'}><span data-filter-result role="status" aria-live="polite"></span><button type="button" data-promo-control data-action="reset-filters">ล้างตัวกรอง ×</button></div>`;
}
