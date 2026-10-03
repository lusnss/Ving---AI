import { escapeHtml } from './api.mjs';

const money = new Intl.NumberFormat('th-TH', {
  style: 'currency', currency: 'THB', maximumFractionDigits: 0
});
const percent = new Intl.NumberFormat('th-TH', {
  style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1
});
const dateTime = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok'
});

function shortMoney(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} ลบ.`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)} พัน`;
  return money.format(amount);
}

function tone(value) {
  if (Number(value) > 0) return 'sales-positive';
  if (Number(value) < 0) return 'sales-negative';
  return 'sales-neutral';
}

function delta(value, rate) {
  return `<span class="${tone(value)}">${value >= 0 ? '+' : ''}${shortMoney(value)} · ${rate == null ? 'ไม่มีฐานเทียบ' : percent.format(rate)}</span>`;
}

function kpi(label, value, detail, className = '') {
  return `<article class="card sales-kpi ${className}"><p class="sales-kpi-label">${escapeHtml(label)}</p><p class="sales-kpi-value">${escapeHtml(value)}</p><div class="sales-kpi-detail">${detail}</div></article>`;
}

function targetRows(items) {
  return items.map((item) => `<tr>
    <td data-label="สาขา"><strong>${escapeHtml(item.name)}</strong></td>
    <td data-label="Forecast">${money.format(item.forecast)}</td>
    <td data-label="เป้าหมาย">${money.format(item.target)}</td>
    <td data-label="ทำได้"><span class="${tone(item.gap)}">${percent.format(item.achievement)}</span></td>
    <td data-label="ส่วนต่าง"><span class="${tone(item.gap)}">${item.gap >= 0 ? '+' : ''}${money.format(item.gap)}</span></td>
  </tr>`).join('');
}

function highlightRows(items) {
  return items.map((item) => `<li class="sales-branch-row">
    <div><strong>${escapeHtml(item.name)}</strong><small>Forecast ${money.format(item.forecast)} · ปีก่อน ${money.format(item.prior_year)}</small></div>
    <span class="${tone(item.change)}">${item.change >= 0 ? '+' : ''}${shortMoney(item.change)}<small>${percent.format(item.percent)}</small></span>
  </li>`).join('');
}

function monthRows(items) {
  return items.map((item) => {
    if (item.incomplete) return `<tr><td data-label="เดือน"><strong>${escapeHtml(item.name)}</strong></td><td data-label="ฐานข้อมูล"><span class="badge">ข้อมูลไม่ครบ</span></td><td data-label="2569">—</td><td data-label="2568">—</td><td data-label="YOY">รอข้อมูลจาก Google Sheet</td></tr>`;
    const current = Number(item.forecast || item.sales || 0);
    const previous = Number(item.prior_year || 0);
    const change = current - previous;
    const rate = previous ? change / previous : null;
    const basis = item.is_current ? `ปิดเดือน FCT · Actual ${shortMoney(item.sales)}` : item.is_forecast ? 'FCT' : 'Actual';
    return `<tr>
      <td data-label="เดือน"><strong>${escapeHtml(item.name)}</strong></td>
      <td data-label="ฐานข้อมูล"><span class="badge">${escapeHtml(basis)}</span></td>
      <td data-label="2569">${money.format(current)}</td>
      <td data-label="2568">${money.format(previous)}</td>
      <td data-label="YOY">${delta(change, rate)}</td>
    </tr>`;
  }).join('');
}

export function dashboardMarkup(data) {
  const month = data.current_month;
  const year = data.year_forecast;
  const branches = data.branches;
  const online = data.source.online_status === 'online';
  const sourceUrl = data.source.url ? `<a class="sales-source-link" href="${escapeHtml(data.source.url)}" target="_blank" rel="noopener noreferrer">เปิด Google Sheet ↗</a>` : '';
  const fetchedAt = data.source.fetched_at ? dateTime.format(new Date(data.source.fetched_at)) : null;
  return `<section class="page-head sales-page-head">
    <div>
      <p class="eyebrow">Sales operations</p>
      <h1>ยอดขายห้าง</h1>
      <p class="lede">ดูยอดจริง เทียบเป้าหมาย เทียบปีก่อน และประมาณการปิดงวดจากข้อมูลชุดเดียว</p>
    </div>
    <div class="sales-source">
      <span class="badge ${online ? 'sales-source-online' : 'sales-source-fallback'}">${online ? '● Google Sheet ออนไลน์' : '● ใช้ข้อมูลสำรอง'}</span>
      <span>งวด ${escapeHtml(data.source.period)}${fetchedAt ? ` · ดึงล่าสุด ${escapeHtml(fetchedAt)}` : ''}</span>
      <div class="sales-source-actions">${sourceUrl}<button class="btn btn-quiet" type="button" data-refresh-sales>รีเฟรชข้อมูล</button></div>
      ${data.source.status_message ? `<small>${escapeHtml(data.source.status_message)}</small>` : ''}
    </div>
  </section>

  <section class="sales-kpi-grid" aria-label="ตัวเลขสำคัญเดือนปัจจุบัน">
    ${kpi('คาดการณ์ปิดเดือน', shortMoney(month.forecast), `Actual ปัจจุบัน ${money.format(month.actual)}`)}
    ${kpi('เทียบเป้าหมาย', percent.format(month.target_percent), `${delta(month.target_gap, month.target_percent - 1)}<small>Forecast ${shortMoney(month.target_forecast)} จากเป้า ${shortMoney(month.target)} · ${month.target_branches} สาขา</small>`, tone(month.target_gap))}
    ${kpi('YOY เดือนนี้', percent.format(month.yoy_percent), `${delta(month.yoy_change, month.yoy_percent)}<small>เทียบกันยายน 2568 ${money.format(month.prior_year)}</small>`, tone(month.yoy_change))}
    ${kpi('กำไรเดือนนี้', shortMoney(month.profit), `<span class="${tone(month.profit)}">อัตรากำไร ${percent.format(month.profit_margin)}</span><small>จากยอด Actual ปัจจุบัน</small>`, tone(month.profit))}
  </section>

  <section class="sales-summary-grid section-gap">
    <article class="card sales-year-card">
      <div><p class="sales-kpi-label">คาดการณ์ปิดปี 2569</p><p class="sales-year-value">${shortMoney(year.sales)}</p></div>
      <div class="sales-year-metrics">
        <p><span>เทียบปี 2568</span>${delta(year.yoy_change, year.yoy_percent)}</p>
        <p><span>กำไรคาดการณ์</span><strong class="${tone(year.profit)}">${money.format(year.profit)}</strong></p>
        <p><span>อัตรากำไร</span><strong>${percent.format(year.profit_margin)}</strong></p>
      </div>
    </article>
    <article class="card">
      <p class="sales-kpi-label">สถานะ ${branches.total} สาขา</p>
      <div class="sales-branch-counts">
        <div class="sales-count sales-positive"><strong>${branches.growth}</strong><span>ยอดโต</span></div>
        <div class="sales-count sales-negative"><strong>${branches.decline}</strong><span>ยอดตก</span></div>
        <div class="sales-count sales-new"><strong>${branches.new}</strong><span>เปิดใหม่</span></div>
        <div class="sales-count sales-neutral"><strong>${branches.closed}</strong><span>ปิด/ไม่มียอด</span></div>
      </div>
      <p class="help">กำไร ${branches.profitable} · ขาดทุน ${branches.loss} · เท่าทุน ${branches.break_even} สาขา</p>
    </article>
  </section>

  <section class="card section-gap">
      <div class="sales-section-head"><div><p class="sales-kpi-label">เปรียบเทียบเป้าหมาย</p><h2>${data.target_branches.length} สาขาที่มีเป้ารายเดือน</h2></div><div class="sales-target-count"><span class="sales-positive">ถึงเป้า ${branches.above_target}</span><span class="sales-negative">ต่ำกว่าเป้า ${branches.below_target}</span></div></div>
    <div class="table-wrap section-gap"><table><thead><tr><th>สาขา</th><th>Forecast</th><th>เป้าหมาย</th><th>ทำได้</th><th>ส่วนต่าง</th></tr></thead><tbody>${targetRows(data.target_branches)}</tbody></table></div>
  </section>

  <section class="sales-highlight-grid section-gap">
    <article class="card"><p class="sales-kpi-label">YOY</p><h2>ยอดตกมากสุด</h2><ul class="sales-branch-list">${highlightRows(data.decline_highlights)}</ul></article>
    <article class="card"><p class="sales-kpi-label">YOY</p><h2>ยอดโตมากสุด</h2><ul class="sales-branch-list">${highlightRows(data.growth_highlights)}</ul></article>
  </section>

  <section class="card section-gap">
    <div class="sales-section-head"><div><p class="sales-kpi-label">ภาพรวมรายเดือน</p><h2>ยอดขาย 2569 เทียบ 2568</h2></div><span class="help">ก.ย. แสดง Forecast ปิดเดือน · ต.ค.–ธ.ค. เป็น FCT</span></div>
    <div class="table-wrap section-gap"><table><thead><tr><th>เดือน</th><th>ฐานข้อมูล</th><th>2569</th><th>2568</th><th>YOY</th></tr></thead><tbody>${monthRows(data.months)}</tbody></table></div>
  </section>

  <section class="sales-method section-gap" aria-label="ที่มาของข้อมูล">
    <strong>ที่มาและขอบเขต</strong>
    <p>${escapeHtml(data.source.yoy_basis)} · ${escapeHtml(data.source.target_basis)} · ${escapeHtml(data.source.year_forecast_basis)}</p>
  </section>`;
}

export async function render(root, services) {
  async function load(refresh = false) {
    root.setAttribute('aria-busy', 'true');
    const data = await services.api(`/api/mall-sales${refresh ? '?refresh=1' : ''}`);
    root.innerHTML = dashboardMarkup(data);
    root.removeAttribute('aria-busy');
    root.querySelector('[data-refresh-sales]')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      try {
        const updated = await load(true);
        services.toast(updated.source.online_status === 'online' ? 'ดึงข้อมูลจาก Google Sheet แล้ว' : 'รีเฟรชข้อมูลแล้ว');
      } catch (error) {
        root.removeAttribute('aria-busy');
        event.currentTarget.disabled = false;
        services.toast(error.message, true);
      }
    });
    return data;
  }
  await load();
}
