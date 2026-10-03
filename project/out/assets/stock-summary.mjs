import {escapeHtml as esc} from './api.mjs';
import {summaryColumns as columns, summaryViews as views, summarySorts, summaryPriceColumn, summaryPriceLabel, summaryCostColumn, summaryCostLabel, summaryGpLabel, filteredStockSummary, hasSummarySelection, summaryFilterText, stockDashboardModels, summaryTableColumns, visibleSummaryColumns} from './stock-summary-view.mjs';
const number = value => Number.isFinite(value) ? value.toLocaleString('th-TH') : '—';
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short'}) : 'ไม่ระบุเวลา';
const initialState = () => ({query: '', model: '', grade: '', color: '', size: '', sort: 'name', hiddenColumns: []});
const columnPreferenceKey = 'ving-stock-summary-columns-v1';
function readColumnPreferences() {
  try {const value = JSON.parse(localStorage.getItem(columnPreferenceKey)); return value && typeof value === 'object' ? value : {};} catch {return {};}
}
function columnPicker(view, state) {
  const all = summaryTableColumns(view), shown = new Set(visibleSummaryColumns(view, state).map(column => column.key));
  return `<details class="ss-column-picker" data-ss-column-picker="${view.key}"><summary>เลือกข้อมูลที่แสดง <span data-ss-column-count="${view.key}">${shown.size}/${all.length}</span></summary><fieldset><legend>คอลัมน์ใน${view.title}</legend>${all.map(column => `<label><input type="checkbox" data-ss-column-scope="${view.key}" data-ss-column="${column.key}" ${shown.has(column.key) ? 'checked' : ''} ${column.key === 'model' ? 'disabled' : ''}><span>${esc(column.label)}${column.key === 'model' ? ' (แสดงเสมอ)' : ''}</span></label>`).join('')}</fieldset><div><button type="button" data-ss-columns-all="${view.key}" data-inventory-control>แสดงทั้งหมด</button><small>ใช้กับตารางนี้และ Excel</small></div></details>`;
}

function controls(scope, fields, report, state) {
  const options = field => [...new Set(report.variants.map(row => row[field]))].sort((a, b) => a.localeCompare(b, 'th', {numeric: true}));
  return `<div class="ss-controls" data-ss-controls="${scope}"><label class="ss-control-search">ค้นหาสินค้า<input type="search" data-ss-scope="${scope}" data-ss-field="query" value="${esc(state.query)}" placeholder="เช่น Jarix Black 40" maxlength="120" autocomplete="off"></label>${fields.map(field => `<label>${columns[field]}<select data-ss-scope="${scope}" data-ss-field="${field}"><option value="">ทั้งหมด</option>${options(field).map(value => `<option value="${esc(value)}" ${state[field] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>`).join('')}${scope !== 'dashboard' ? `<label class="ss-control-sort">เรียงตาม<select data-ss-scope="${scope}" data-ss-field="sort">${Object.entries(summarySorts).map(([value, label]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}<button type="button" class="ss-clear" data-ss-clear="${scope}" data-inventory-control>${scope === 'dashboard' ? 'ล้างการเลือก' : 'ล้างตัวกรอง'}</button></div>`;
}

function tableBody(view, report, state) {
  const rows = report[view.key], shown = visibleSummaryColumns(view, state);
  const numeric = key => !view.fields.includes(key);
  const classes = key => `${numeric(key) ? 'ss-number' : ''} ${key === 'total' ? 'ss-total' : ['cost', 'price', 'gp'].includes(key) ? 'ss-' + key : ''}`;
  const label = (row, key) => key === 'cost' ? summaryCostLabel(row) : key === 'price' ? summaryPriceLabel(row) : key === 'gp' ? summaryGpLabel(row) : numeric(key) ? number(row[key]) : row[key];
  return `<div class="ss-scroll" tabindex="0" role="region" aria-label="${view.title}"><table style="min-width:${195 + (shown.length - 1) * 120}px"><thead><tr>${shown.map(column => `<th scope="col" data-ss-col="${column.key}" class="${classes(column.key)}">${esc(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row, index) => `<tr>${shown.map(column => {
    const content = column.key === 'grade' ? `<span class="ss-grade">${esc(row.grade)}</span>` : esc(label(row, column.key));
    return column.key === 'model' ? `<th scope="row"><button type="button" class="ss-select-product" data-ss-pick="${view.key}" data-ss-row="${index}" data-inventory-control aria-label="ดู Dashboard ${esc(view.fields.map(field => row[field]).join(' · '))}">${content}<span aria-hidden="true">↗</span></button></th>` : `<td class="${classes(column.key)}" data-ss-col="${column.key}">${content}</td>`;
  }).join('')}</tr>`).join('') : `<tr><td class="ss-empty" colspan="${shown.length}">${hasSummarySelection(state) ? 'ไม่พบสินค้าตามตัวกรอง ลองเปลี่ยนหรือล้างตัวกรองของตารางนี้' : 'ยังไม่มีรายการสต็อก'}</td></tr>`}</tbody><tfoot><tr>${shown.map(column => column.key === 'model' ? `<th scope="row">${hasSummarySelection(state) ? 'รวมตามตัวกรอง' : 'รวมทั้งหมด'}</th>` : `<td class="${classes(column.key)}">${['scaleup', 'pivot', 'total'].includes(column.key) ? number(report.totals[column.key]) : ''}</td>`).join('')}</tr></tfoot></table></div>`;
}

function dashboardHTML(report, state) {
  if (!report.models.length) return '<p class="ss-dash-empty" role="status">ไม่พบสินค้าตามที่เลือก ลองเปลี่ยนหรือล้างการเลือกด้านบน</p>';
  const models = stockDashboardModels(report);
  return `<header class="ss-dash-heading"><div><span class="ss-eyebrow">SELECTED STOCK</span><h2>สรุปสินค้าที่เลือก</h2><p>${esc(summaryFilterText(state))}</p></div><span class="ss-count">${number(models.length)} รุ่น</span></header><div class="ss-metrics"><section><span>Scalup</span><strong>${number(report.totals.scaleup)}</strong><small>จำนวนพร้อมขายที่เลือก</small></section><section><span>Pivot</span><strong>${number(report.totals.pivot)}</strong><small>จำนวนคงเหลือที่เลือก</small></section><section class="ss-metric-total"><span>จำนวนรวมพร้อมขายที่เลือก</span><strong>${number(report.totals.total)}</strong><small>แยกเกรด สี และไซซ์ด้านล่าง</small></section></div><div class="ss-dash-models">${models.map((model, modelIndex) => `<section class="ss-dash-model"><header><h3>${esc(model.model)}</h3><span>รวมพร้อมขาย <b>${number(model.total)}</b></span></header>${model.grades.map((grade, gradeIndex) => `<details class="ss-dash-grade" data-ss-dash-model="${esc(model.model)}" data-ss-dash-grade="${esc(grade.grade)}" ${modelIndex === 0 && gradeIndex === 0 ? 'open' : ''}><summary><span class="ss-grade">เกรด ${esc(grade.grade)}</span><span class="ss-dash-meta">${number(grade.colors.length)} สี · ${number(grade.sizes.length)} ไซซ์</span><span class="ss-dash-quantity">คงเหลือ <strong>${number(grade.total)}</strong></span><span class="ss-dash-chevron" aria-hidden="true">⌄</span></summary><div class="ss-dash-finance"><span>ต้นทุนรวม VAT <b>${esc(summaryCostLabel(grade))}</b></span><span>ราคาเต็ม <b>${esc(summaryPriceLabel(grade))}</b></span><span>GP% <b>${esc(summaryGpLabel(grade))}</b></span></div><div class="ss-dash-warehouses">Scalup <b>${number(grade.scaleup)}</b><span>Pivot <b>${number(grade.pivot)}</b></span></div><div class="ss-scroll ss-dash-scroll" tabindex="0" role="region" aria-label="${esc(model.model)} เกรด ${esc(grade.grade)} แยกสีและไซซ์"><table style="min-width:${Math.max(400, 220 + (grade.sizes.length + 1) * 75)}px"><thead><tr><th scope="col">สี / ไซซ์</th>${grade.sizes.map(size => `<th scope="col" class="ss-number">${esc(size)}</th>`).join('')}<th scope="col" class="ss-number ss-total">รวม</th></tr></thead><tbody>${grade.colors.map(row => `<tr><th scope="row">${esc(row.color)}</th>${row.cells.map(value => `<td class="ss-number ${value === 0 ? 'ss-dash-zero' : ''}">${number(value)}</td>`).join('')}<td class="ss-number ss-total">${number(row.total)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">รวม</th>${grade.sizeTotals.map(value => `<td class="ss-number">${number(value)}</td>`).join('')}<td class="ss-number ss-total">${number(grade.total)}</td></tr></tfoot></table></div></details>`).join('')}</section>`).join('')}</div><p class="ss-dash-note">กดแต่ละเกรดเพื่อดูสีและไซซ์ · ตัวเลขในตาราง = ยอดรวมพร้อมขาย · 0 = ไม่มีสต็อก · — = ยังไม่มีข้อมูลครบทั้งสองคลัง</p>`;
}

export async function render(app) {
  document.title = 'สรุปรวม Stock · VING Warroom';
  app.classList.add('stock-summary-page');
  if (!document.querySelector('[data-stock-summary-style]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/assets/stock-summary.css'; link.dataset.stockSummaryStyle = ''; document.head.append(link);
  }
  const banner = document.querySelector('.readonly-banner');
  if (banner) banner.textContent = 'สรุปรวม Stock · Scalup + Pivot · ข้อมูลที่บันทึกไว้ล่าสุด';
  app.innerHTML = `<header class="ss-heading"><div><span class="ss-eyebrow">STOCK OVERVIEW</span><h1>สรุปรวม <span>Stock</span></h1></div><a class="ss-inventory-link" href="/inventory">เปิดสต็อกคลังสินค้า <span aria-hidden="true">↗</span></a></header><div data-ss-content aria-busy="true"><p class="ss-loading" role="status">กำลังรวมสต็อกจาก Scalup และ Pivot…</p></div>`;
  const content = app.querySelector('[data-ss-content]');
  const states = Object.fromEntries(['dashboard', ...views.map(view => view.key)].map(scope => [scope, initialState()]));
  const preferences = readColumnPreferences();
  for (const view of views) states[view.key].hiddenColumns = Array.isArray(preferences[view.key]) ? preferences[view.key] : [];
  function saveColumnPreferences() {
    try {localStorage.setItem(columnPreferenceKey, JSON.stringify(Object.fromEntries(views.map(view => [view.key, states[view.key].hiddenColumns]))));} catch {}
  }
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true; content.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/stock-summary', {cache: 'no-store', signal: AbortSignal.timeout(25000)});
      if (!response.ok) throw Error('ยังโหลดข้อมูลสต็อกไม่ได้');
      const report = await response.json(), visible = {};
      const incomplete = !report.sources.scaleup.ready || !report.sources.pivot.ready;
      content.innerHTML = `<section class="ss-selector"><header><h2>เลือกสินค้าดู Dashboard</h2><p>ค้นหา เลือกรุ่น หรือกดชื่อสินค้าในตาราง · Dashboard จะแสดงเมื่อมีการเลือกเท่านั้น</p></header>${controls('dashboard', ['model', 'grade', 'color', 'size'], report, states.dashboard)}</section><section class="ss-dashboard" data-ss-dashboard hidden aria-label="Dashboard สินค้าที่เลือก"></section><div class="ss-source-strip">${[['scaleup', 'Scalup'], ['pivot', 'Pivot']].map(([source, label]) => `<div><b>${label}</b><span>${report.sources[source].ready ? 'ข้อมูล ณ ' + esc(date(report.sources[source].updatedAt)) : 'ยังอ่านข้อมูลไม่ได้'}</span></div>`).join('')}</div>${incomplete ? '<p class="ss-warning" role="status">ข้อมูลยังไม่ครบทั้งสองคลัง จึงยังไม่แสดงยอดรวมพร้อมขาย ช่อง — หมายถึงไม่มีข้อมูล ไม่ใช่สต็อกเป็นศูนย์ <button type="button" data-ss-retry data-inventory-control>ลองโหลดอีกครั้ง</button></p>' : ''}<div class="ss-context"><p>ตัวกรองของ Dashboard และทั้ง 3 ตารางแยกกัน<br><span>จำนวนตามหน่วยสินค้า รวมสินค้าแจกฟรีและอุปกรณ์ · ไม่แปลงเป็นจำนวนคู่</span></p><nav aria-label="ตารางสรุปสต็อก">${views.map(view => `<a href="#${view.id}">${view.number} ${view.key === 'models' ? 'รุ่น' : view.key === 'grades' ? 'เกรด' : 'สี / ไซซ์'}</a>`).join('')}</nav></div>${views.map(view => `<section class="ss-panel" id="${view.id}" aria-labelledby="${view.id}-title"><header class="ss-panel-heading"><div><span class="ss-index">${view.number}</span><h2 id="${view.id}-title">${view.title}</h2></div><div class="ss-panel-actions"><span class="ss-count" data-ss-count="${view.key}"></span><button type="button" class="ss-export" data-ss-export="${view.key}" data-inventory-control aria-label="Export Excel · ${view.title}">Export Excel <span aria-hidden="true">↓</span></button></div></header>${controls(view.key, view.fields, report, states[view.key])}${columnPicker(view, states[view.key])}<p class="ss-table-status" data-ss-table-status="${view.key}" role="status" aria-live="polite"></p><p class="ss-export-status" data-ss-export-status="${view.key}" role="status" aria-live="polite"></p><div data-ss-table-body="${view.key}"></div></section>`).join('')}<p class="ss-footnote">ต้นทุนรวม VAT อ้างอิงแท็บต้นทุนสินค้า จับคู่รุ่น เกรด และไซซ์ที่ระบุ · ต้นทุนแสดงค่าเฉลี่ยระหว่างค่าต่ำสุดกับค่าสูงสุดของแต่ละรายการ · GP% = (ราคาเต็ม − ต้นทุน) ÷ ราคาเต็ม · คำนวณจากต้นทุนเฉลี่ยและราคาเต็มที่มีข้อมูล<br>ต้นทุน: ${esc(report.sources.cost?.file || "ยังอ่านต้นทุนไม่ได้")} · ${esc(date(report.sources.cost?.fetched_at))}${report.sources.cost?.status === "stale" ? " · ใช้ข้อมูลที่บันทึกไว้ล่าสุด" : ""}<br>ราคาเต็มอ้างอิง Pivot ต่อหน่วยสินค้า · หากมีหลายราคาจะแสดงช่วงราคา · ราคา 0 แสดงตามต้นทาง · กรณีไม่มีตัวเลขอ้างอิง: [ต้องถามเจ้าของ]<br>Pivot: ${esc(report.sources.pivot.file || 'ข้อมูลที่บันทึกไว้')} · เกรดใช้ค่าจากต้นทาง ส่วน Scalup แยกเกรดตามรหัสสินค้า (ไม่มีส่วนต่อท้ายเกรด = A)</p>`;
      const dashboard = content.querySelector('[data-ss-dashboard]');
      function syncControls(scope) {
        content.querySelectorAll(`[data-ss-scope="${scope}"]`).forEach(control => {control.value = states[scope][control.dataset.ssField];});
      }
      function draw(scope) {
        const selected = filteredStockSummary(report, states[scope]); visible[scope] = selected;
        if (scope === 'dashboard') {
          dashboard.hidden = !hasSummarySelection(states.dashboard);
          dashboard.innerHTML = dashboard.hidden ? '' : dashboardHTML(selected, states.dashboard);
          return;
        }
        const view = views.find(view => view.key === scope), rows = selected[scope];
        content.querySelector(`[data-ss-column-count="${scope}"]`).textContent = `${visibleSummaryColumns(view, states[scope]).length}/${summaryTableColumns(view).length}`;
        content.querySelector(`[data-ss-count="${scope}"]`).textContent = `${number(rows.length)} ${view.unit}`;
        content.querySelector(`[data-ss-table-status="${scope}"]`).textContent = `แสดง ${number(rows.length)} จาก ${number(report[scope].length)} ${view.unit} · Export Excel ตามตัวกรองของตารางนี้ · กดชื่อสินค้าเพื่อดู Dashboard`;
        content.querySelector(`[data-ss-table-body="${scope}"]`).innerHTML = tableBody(view, selected, states[scope]);
        content.querySelector(`[data-ss-export="${scope}"]`).disabled = !rows.length;
        content.querySelector(`[data-ss-export-status="${scope}"]`).textContent = '';
      }
      content.oninput = event => {
        const control = event.target.closest('[data-ss-field="query"]');
        if (!control) return;
        states[control.dataset.ssScope].query = control.value; draw(control.dataset.ssScope);
      };
      content.onchange = event => {
        const checkbox = event.target.closest('[data-ss-column]');
        if (checkbox) {
          const scope = checkbox.dataset.ssColumnScope, key = checkbox.dataset.ssColumn;
          if (key === 'model') return;
          const hidden = new Set(states[scope].hiddenColumns);
          checkbox.checked ? hidden.delete(key) : hidden.add(key);
          states[scope].hiddenColumns = [...hidden]; saveColumnPreferences(); draw(scope);
          return;
        }
        const control = event.target.closest('select[data-ss-field]');
        if (!control) return;
        states[control.dataset.ssScope][control.dataset.ssField] = control.value; draw(control.dataset.ssScope);
      };
      content.onclick = async event => {
        const all = event.target.closest('[data-ss-columns-all]');
        if (all) {
          const scope = all.dataset.ssColumnsAll;
          states[scope].hiddenColumns = []; saveColumnPreferences();
          content.querySelectorAll(`[data-ss-column-scope="${scope}"]`).forEach(input => {input.checked = true;});
          draw(scope); return;
        }
        const clear = event.target.closest('[data-ss-clear]');
        if (clear) {
          const scope = clear.dataset.ssClear; states[scope] = {...initialState(), hiddenColumns: states[scope].hiddenColumns}; syncControls(scope); draw(scope);
          content.querySelector(`[data-ss-scope="${scope}"][data-ss-field="query"]`).focus(); return;
        }
        const pick = event.target.closest('[data-ss-pick]');
        if (pick) {
          const view = views.find(view => view.key === pick.dataset.ssPick), row = visible[view.key][view.key][Number(pick.dataset.ssRow)];
          states.dashboard = {...initialState(), ...Object.fromEntries(view.fields.map(field => [field, row[field]]))};
          syncControls('dashboard'); draw('dashboard');
          const selector = content.querySelector('.ss-selector'); selector.scrollIntoView({behavior: 'instant', block: 'start'});
          content.querySelector('[data-ss-scope="dashboard"][data-ss-field="model"]').focus({preventScroll: true}); return;
        }
        if (event.target.closest('[data-ss-retry]')) {await load(); return;}
        const button = event.target.closest('[data-ss-export]');
        if (!button || button.disabled) return;
        const viewKey = button.dataset.ssExport, snapshot = visible[viewKey], selection = {...states[viewKey]};
        const status = content.querySelector(`[data-ss-export-status="${viewKey}"]`);
        button.disabled = true; status.textContent = 'กำลังสร้างไฟล์ Excel…';
        try {
          const {downloadStockSummaryExcel} = await import('./stock-summary-excel.mjs');
          let salesHistory;
          if (viewKey === 'models') {
            status.textContent = 'กำลังอ่านประวัติ Report สินค้าขายดีที่บันทึกไว้…';
            const response = await fetch('/api/stock-summary?includeSales=1', {cache:'no-store', signal:AbortSignal.timeout(60000)});
            if (!response.ok) throw Error('Sales history unavailable');
            salesHistory = (await response.json()).salesHistory;
          }
          downloadStockSummaryExcel({...snapshot, ...(salesHistory ? {salesHistory} : {})}, viewKey, selection);
          status.textContent = `ดาวน์โหลด Excel แล้ว · ${number(snapshot[viewKey].length)} รายการ · ${summaryFilterText(selection)}`;
        } catch { status.textContent = 'ดาวน์โหลด Excel ไม่สำเร็จ กรุณาลองอีกครั้ง'; }
        finally { button.disabled = !visible[viewKey][viewKey].length; }
      };
      for (const scope of Object.keys(states)) draw(scope);
    } catch {
      content.innerHTML = '<section class="ss-error" role="alert"><h2>ยังเปิดสรุป Stock ไม่สำเร็จ</h2><p>โหลดข้อมูลอีกครั้งเพื่อตรวจยอดของทั้งสองคลัง</p><button type="button" data-ss-retry data-inventory-control>ลองโหลดอีกครั้ง</button></section>';
      content.onclick = event => {if (event.target.closest('[data-ss-retry]')) load();};
    } finally { loading = false; content.setAttribute('aria-busy', 'false'); }
  }
  await load();
}
