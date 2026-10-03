export function costStatement(base, input) {
  const valid = v => typeof v === 'number' && Number.isFinite(v);
  const amount = v => valid(v) ? new Intl.NumberFormat('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(v) : '—';
  const share = v => valid(v) && valid(base.sales) && base.sales > 0 ? amount(v / base.sales * 100) + '%' : '—';
  const inputCost = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
  const rows = [
    ['ยอดขายหลังส่วนลด', base.sales, 'total'],
    ['หัก ต้นทุนสินค้า', base.cogs, ''],
    ['กำไรขั้นต้น', valid(base.sales) && valid(base.cogs) ? base.sales - base.cogs : null, 'subtotal'],
    [input.channel === 'direct' ? 'หัก ค่าเช่าพื้นที่' : input.channel === 'gp' ? 'หัก ค่า GP' : 'หัก ค่าเช่า / GP', base.space, ''],
    ['หัก ค่า PC รวม', base.pc, ''],
    ...(input.compensationMode==='catalog'?[
      ['หัก คอมมิชชั่น PC คาดการณ์',base.commission,''],
      ['หัก โบนัส PC คาดการณ์',base.bonus,''],
    ]:[]),
    ['หัก ค่าขนส่ง', inputCost(input.shipping), ''],
    ['หัก ค่าใช้จ่ายอื่น', inputCost(input.other), ''],
    ['ต้นทุนและค่าใช้จ่ายรวม', base.costs, 'subtotal'],
    ['กำไร / ขาดทุนของ Event', base.profit, 'total profit'],
  ];
  return `<section class="fp-cost-statement" aria-label="งบกำไรขาดทุนคาดการณ์"><h3>งบกำไรขาดทุนคาดการณ์</h3><p class="fp-hint">กรณีตามคาดการณ์ · % ของยอดขายหลังส่วนลด</p><div class="fp-statement-scroll" tabindex="0" role="region" aria-label="ตารางต้นทุนและสัดส่วนต่อยอดขาย"><table class="fp-statement-table"><thead><tr><th scope="col">รายการ</th><th scope="col">จำนวนเงิน (บาท)</th><th scope="col">% ของยอดขาย</th></tr></thead><tbody>${rows.map(([label,value,kind]) => `<tr class="${kind}${valid(value) && value < 0 ? ' fp-loss' : ''}"><th scope="row">${label}</th><td>${amount(value)}</td><td>${share(value)}</td></tr>`).join('')}</tbody></table></div>${rows.some(([,value]) => !valid(value)) ? '<p class="fp-hint">— = รอข้อมูลเพื่อคำนวณ · กรอกต้นทุนให้ครบเพื่อแสดงกำไร / ขาดทุนคาดการณ์</p>' : !valid(base.sales) || base.sales <= 0 ? '<p class="fp-hint">แสดง % เมื่อยอดขายมากกว่า 0</p>' : ''}<p class="fp-hint">กำไร / ขาดทุนก่อนค่าใช้จ่ายส่วนกลางและภาษีเงินได้</p></section>`;
}
