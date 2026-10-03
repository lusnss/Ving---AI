import { copyText, escapeHtml, uid } from './api.mjs';

const COLUMNS = [
  ['ideas', '💡', 'Ideas', []], ['ready', '🎤', 'Ready to record', ['draft', 'ai_improved', 'ready_to_record'], 'ready_to_record'],
  ['recorded', '✂️', 'ถ่ายแล้ว/กำลังตัด', ['recorded', 'editing'], 'recorded'], ['edited', '📤', 'ตัดแล้ว/ตั้งเวลา', ['edited', 'scheduled'], 'edited'],
  ['posted', '🚀', 'ลงแล้ว', ['posted'], 'posted'], ['analyzed', '📊', 'วิเคราะห์แล้ว', ['analyzed', 'repurposed'], 'analyzed']
];
// การ์ดพก id มากับ MIME ของตัวเอง — ช่องจะรับ drop เฉพาะการลากที่เริ่มจากการ์ดในบอร์ด
// (ลากข้อความ/ไฟล์จาก Finder ทับช่อง เดิมจะยิง PATCH ด้วย id มั่วแล้วพังเงียบ)
const DRAG_MIME = 'application/x-wr-variant';

/** ช่องนี้รับการลากนี้ไหม — ตอบได้ตั้งแต่ dragover ที่ยังอ่านได้แค่ types (อ่าน data ไม่ได้) */
function acceptsDrag(types = [], primary = '') {
  return Boolean(primary) && types.includes(DRAG_MIME);
}

/** ตัดสินว่า drop ครั้งนี้ควรย้ายอะไร — คืน null ถ้าไม่ใช่การ์ดของบอร์ด · ช่องไม่รับ · id ไม่รู้จัก · อยู่สถานะนั้นแล้ว */
function dropDecision({ types = [], id = '', primary = '' }, variants = []) {
  if (!id || !acceptsDrag(types, primary)) return null;
  const variant = variants.find((item) => item.variant_id === id);
  if (!variant || variant.variant_status === primary) return null;
  return { id, status: primary };
}

const PARITY_LABELS = ['💡 Ideas', '✂️ ถ่ายแล้ว/กำลังตัด', '📤 ตัดแล้ว/ตั้งเวลา', '🚀 ลงแล้ว', '📊 วิเคราะห์แล้ว', "source:'manual'"];
void PARITY_LABELS;
const FORMATS = Object.freeze({ RL: ['reel', 'reel', ['tiktok', 'instagram', 'facebook'], 'Reel'], CR: ['carousel', 'carousel', ['instagram', 'facebook'], 'Carousel'], AR: ['article', 'article', ['facebook', 'linkedin'], 'Article'], LN: ['line_broadcast', 'line-broadcast', ['line_oa'], 'LINE Broadcast'] });
const SCRIPT_TEMPLATE = `# Hook (0-2 วิ — front-load payload)

# Setup (2-10 วิ — สัญญาว่าจะได้เห็นอะไร · "พาไปดู" ห้าม "เล่าให้ฟัง")

# Body (เลือก 1 สไตล์: demo จอจริง / ลิสต์+PiP / reveal เบลอ / rapid-fire / split-screen / ไวท์บอร์ด / สแต็กฉาก / before-after)

↻ Rehook: (วางทุกรอยต่อ · ~1 ครั้ง/15-20 วิ · เปิดคำถามใหม่)

# Payoff (ตอบประเด็นที่ Rehook เปิดไว้ — ห้ามซ้ำ Body)

# CTA

# 🔤 Hook Text (กฎ 5x5 — teaser ไม่ซ้ำเสียงพูด)

# 🔢 Chapter Counter (เฉพาะคลิปลิสต์ — Step N/M …)

# 📝 Caption (ประโยคแรก = hook + keyword · ปิดด้วย CTA)

# 💬 First Comment (optional — คีย์เวิร์ด DM / ลิงก์)`;
let state;
let services;
let view = 'board';
let queueFilter = 'all';
let queueTimer = 0;
let drawerIdea = null;

function bkkDay() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
/** เลข content id ถัดไปของวันนั้น — ห้องอื่น (Intel Warroom) เรียกใช้ตอนส่งบทเข้ามา จึงต้องรับ ideas เข้ามาตรงๆ */
function nextContentId(ideas = [], day = bkkDay()) {
  const prefix = `CNT-${day}-`;
  const n = ideas.filter((x) => x.content_id.startsWith(prefix)).map((x) => Number(x.content_id.slice(-3))).reduce((a, b) => Math.max(a, b), 0) + 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}
function nextId() { return nextContentId(state.ideas); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'content'; }
function days(date, now = Date.now()) { return Math.max(0, Math.floor((now - new Date(date).getTime()) / 86400000)); }
function staleVariants(variants, now = Date.now()) { return variants.filter((item)=>['recorded','editing','edited','scheduled'].includes(item.variant_status) && days(item.status_changed_at,now)>=3).sort((a,b)=>days(b.status_changed_at,now)-days(a.status_changed_at,now)).slice(0,1); }

// ---------- คิวงาน AI (wr_jobs) — เห็นว่าการ์ดไหนกำลังให้ AI เกลา และงานไหนติด ----------
const JOB_LABEL = Object.freeze({ ai_improve: '✨ เกลาบท (Script Studio)', rewrite_reel: '✍️ เวอร์ชันของเรา (Intel Warroom)', rewrite_copy: '✍️ เขียนข่าวใหม่ (News Desk)', render_text_card: '🖼 การ์ดตัวอักษร', render_card: '🎨 การ์ดซีน AI' });
const JOB_STATUS_LABEL = Object.freeze({ queued: 'รอคิว', running: 'กำลังทำ', done: 'เสร็จ', error: 'พัง' });
const STALL_MS = 20 * 60000;
const FORGOT_MS = 30 * 60000;
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
const fmtWhen = (value) => new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

/**
 * สรุปสถานะคิวที่บันทึกบนคลาวด์ โดยระบุว่าตัวประมวลผล AI ยังไม่ได้เชื่อมต่อ
 * สถานะเดิมในข้อมูลไม่ใช่หลักฐานว่ามีตัวประมวลผลกำลังทำงานอยู่
 */
function queueHealth(jobs = [], now = Date.now()) {
  const running = jobs.filter((job) => job.status === 'running');
  const queued = jobs.filter((job) => job.status === 'queued');
  const stalled = running.filter((job) => job.started_at && now - new Date(job.started_at).getTime() > STALL_MS);
  const waitedMs = queued.length ? now - Math.min(...queued.map((job) => new Date(job.created_at).getTime())) : 0;
  const lastDone = jobs.filter((job) => job.status === 'done' && job.finished_at).sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)))[0];
  const base = { running: running.length, queued: queued.length, stalled: stalled.length, pending: running.length + queued.length };
  if (stalled.length) return { ...base, tone: 'error', text: `⚠️ งานค้างสถานะ "กำลังทำ" ${stalled.length} งาน เกิน 20 นาที — เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI` };
  if (queued.length && waitedMs > FORGOT_MS) return { ...base, tone: 'error', text: `⚠️ มีงานรอคิว ${queued.length} งานมา ${mmss(waitedMs)} นาทีแล้ว — เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI` };
  if (running.length) return { ...base, tone: 'ok', text: `🟡 สถานะที่บันทึกไว้: กำลังทำ ${running.length} งาน${queued.length ? ` · รอคิวอีก ${queued.length}` : ''} — ${running.map((job) => `${JOB_LABEL[job.job_type] || job.job_type}${job.started_at ? ` ${mmss(now - new Date(job.started_at).getTime())} นาที` : ''}`).join(' · ')} · ยังไม่ได้เชื่อมตัวประมวลผล AI บนคลาวด์` };
  if (queued.length) return { ...base, tone: 'ok', text: `🟡 รอคิว ${queued.length} งาน — เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI` };
  return { ...base, tone: 'ok', text: `✅ คิวว่าง ไม่มีงานค้าง${lastDone ? ` · งานล่าสุดเสร็จ ${fmtWhen(lastDone.finished_at)}` : ''}` };
}

/** งานนี้ทำให้การ์ดไหน — ตอบเป็นชื่อที่ผู้ใช้จำได้ ไม่ใช่ id ดิบ */
function jobSubject(job, { ideas = [], variants = [], items = [] } = {}) {
  const payload = job.payload || {};
  if (job.job_type === 'ai_improve') {
    const variant = variants.find((x) => x.variant_id === payload.variant_id);
    const idea = ideas.find((x) => x.content_id === variant?.content_id);
    return { text: idea?.title || variant?.working_title || payload.variant_id || '—', sub: payload.variant_id || '', variantId: payload.variant_id || null, href: null };
  }
  if (job.job_type === 'rewrite_reel') {
    const item = items.find((x) => x.id === payload.item_id);
    return { text: payload.theme || '—', sub: item?.title ? `จากการ์ด: ${item.title}` : payload.item_id ? `การ์ด ${String(payload.item_id).slice(0, 12)}…` : '', variantId: null, href: '/intel#library' };
  }
  return { text: payload.candidate_id ? `ข่าว ${String(payload.candidate_id).slice(0, 12)}…` : '—', sub: '', variantId: null, href: '/news-desk' };
}

function ideaCard(idea) { return `<article class="brief-card" data-card="idea" data-id="${idea.content_id}"><div class="meta"><span class="badge">🧪 ${escapeHtml(idea.acid_test)}</span><button class="btn btn-quiet" data-action="copy-id" data-id="${idea.content_id}" type="button">📋</button></div><h4>${escapeHtml(idea.title)}</h4><p>${escapeHtml(idea.canonical_angle || '')}</p><div class="form-actions"><button class="btn btn-quiet" data-action="open-card" aria-label="เปิดรายละเอียด ${escapeHtml(idea.title)}" type="button">เปิดรายละเอียด</button><button class="btn btn-outline" data-action="quick-produce" data-id="${idea.content_id}" type="button">+ เริ่มผลิต</button></div></article>`; }
function variantCard(variant) { const age = days(variant.status_changed_at); return `<article class="brief-card" draggable="true" data-card="variant" data-id="${variant.variant_id}"><span class="badge">${escapeHtml(variant.format)}</span><h4>${escapeHtml(variant.working_title)}</h4><p>${escapeHtml(variant.variant_id.replace('CNT-', ''))}</p><span class="${age >= 3 ? 'urgent-note' : 'help'}">${age >= 3 ? `⏳ ค้าง ${age} วัน` : age ? `${age} วัน` : 'วันนี้'}</span><p>${escapeHtml(variant.target_platforms.slice(0, 3).join(' · '))}</p><button class="btn btn-quiet" data-action="open-card" aria-label="เปิดรายละเอียด ${escapeHtml(variant.working_title)}" type="button">เปิดรายละเอียด</button></article>`; }

function column([key, icon, label, statuses, primary]) {
  const variants = state.variants.filter((item) => statuses.includes(item.variant_status));
  const ideas = key === 'ideas' ? state.ideas.filter((item) => !['archived', 'published', 'repurpose_candidate'].includes(item.idea_status) && !state.variants.some((variant) => variant.content_id === item.content_id)) : [];
  return `<section class="kanban-column" data-column="${key}" data-primary="${primary || ''}"><h3>${icon} ${label}</h3>${[...ideas.map(ideaCard), ...variants.map(variantCard)].join('') || '<p>— ว่าง —</p>'}</section>`;
}

function stats() {
  const ready = state.variants.filter((x) => x.variant_status === 'ready_to_record');
  const recorded = state.variants.filter((x) => ['recorded', 'editing'].includes(x.variant_status));
  const edited = state.variants.filter((x) => ['edited', 'scheduled'].includes(x.variant_status));
  const snapshots = new Set(state.snapshots.map((x) => x.publication_id));
  const due = state.publications.filter((x) => x.status === 'posted' && Date.now() - new Date(x.published_at).getTime() > 172800000 && !snapshots.has(x.publication_id));
  return [["🎤 Ready to record", ready.length, ready.length ? `เก่าสุด ${Math.max(...ready.map((x) => days(x.status_changed_at)))} วัน` : '—'], ['✂️ ถ่ายแล้วยังไม่ตัด', recorded.length, 'hot'], ['📤 ตัดแล้วยังไม่ลง', edited.length, 'hot'], ['📊 Analytics due', due.length, 'ลงแล้วเกิน 48 ชม.']].map(([label, count, sub]) => `<div class="card"><strong>${label}</strong><div class="stat">${count}</div><p class="help">${sub}</p></div>`).join('');
}

function renderPage(root) {
  const stale = staleVariants(state.variants);
  root.innerHTML = `<header class="page-head content-page-head"><div><p class="eyebrow">Editorial operations</p><h1>Content Center</h1><p id="wr-date" class="lede">${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}</p></div><div class="form-actions room-tabs" role="tablist" aria-label="มุมมอง"><button id="wr-view-board" class="btn btn-primary" type="button" role="tab" aria-selected="true">🗂 Board</button><button id="wr-view-list" class="btn btn-outline" type="button" role="tab" aria-selected="false">📋 List</button><button id="wr-view-queue" class="btn btn-outline" type="button" role="tab" aria-selected="false">⏳ Queue <span id="wr-queue-badge" class="badge">${queueHealth(state.jobs).pending}</span></button></div></header>
  <section id="wr-stats" class="stats-grid content-status-strip" aria-label="สถานะการผลิต">${stats()}</section><div id="wr-stale" class="error-box section-gap" ${stale.length ? '' : 'hidden'}>${stale.map((x) => `⚠️ ${x.variant_id} ค้างสถานะ ${x.variant_status} มา ${days(x.status_changed_at)} วันแล้ว`).join('<br>')}</div>
  <section class="card section-gap content-quick-capture"><div class="form-actions"><input id="wr-quick-idea" aria-label="เพิ่มไอเดียเร็ว" placeholder="โยนไอเดียเร็ว ๆ แล้วกด Enter…"><button id="wr-quick-save" class="btn btn-accent" type="button">เพิ่ม</button><input id="wr-board-search" aria-label="ค้นหาในบอร์ด" placeholder="ค้นหา board"></div><div id="wr-quick-similar" class="error-box section-gap" hidden></div></section>
  <section id="wr-board" class="kanban production-board section-gap">${COLUMNS.map(column).join('')}</section>
  <section id="wr-list-view" class="layout-two section-gap" hidden><div class="card"><h2>💡 Idea Inbox</h2><form id="wr-idea-form" class="stack"><input name="title" placeholder="title" required><textarea name="canonical_angle" placeholder="canonical angle"></textarea><select name="pillar_bucket"><option value="ai_in_business">AI ในธุรกิจจริง 40%</option><option value="sales_team">ทีมขาย/บริหาร 30%</option><option value="intersection">จุดตัด AI×ขาย 20%</option><option value="persona">ตัวตน 10%</option></select><select name="funnel_stage"><option>top</option><option>middle</option><option>bottom</option></select><button id="wr-idea-save" class="btn btn-accent" type="submit">💾 Save idea</button></form><nav id="wr-filter" class="form-actions section-gap">${[['all','ทั้งหมด'],['captured','ยังไม่ triage'],['active','กำลังผลิต'],['published','ลงแล้ว'],['archived','archive']].map(([v,l]) => `<button class="btn btn-quiet" data-f="${v}" type="button">${l}</button>`).join('')}</nav><input id="wr-search" placeholder="ค้นหา..."><p id="wr-untriaged">${state.ideas.filter((x) => x.idea_status === 'captured').length ? `${state.ideas.filter((x) => x.idea_status === 'captured').length} ยังไม่ triage` : 'inbox ว่าง 🎉'}</p><div id="wr-idea-list">${state.ideas.map((idea) => `<button class="list-item" data-id="${idea.content_id}" type="button">${escapeHtml(idea.content_id)} · ${escapeHtml(idea.title)}</button>`).join('')}</div></div><div class="card">เลือก idea เพื่อดูรายละเอียด (เปิดแผงด้านขวา)</div></section>
  <section id="wr-queue-view" class="section-gap" hidden aria-label="คิวงาน AI"><div id="wr-queue-health" class="today-strip" role="status" aria-live="polite">กำลังโหลดคิว…</div><div class="form-actions section-gap"><nav id="wr-queue-filter" class="form-actions">${[['all','ทั้งหมด'],['ai_improve','✨ เกลาบท'],['rewrite_reel','✍️ เวอร์ชันของเรา'],['other','อื่นๆ (News Desk)']].map(([value,label]) => `<button class="btn btn-quiet" data-qf="${value}" type="button">${label}</button>`).join('')}</nav><button id="wr-queue-refresh" class="btn btn-quiet" type="button">⟳ รีเฟรช</button></div><div class="table-wrap section-gap"><table><thead><tr><th>งาน</th><th>การ์ด / ธง</th><th>สถานะ</th><th>ส่งเมื่อ</th><th>ทำต่อ</th></tr></thead><tbody id="wr-queue"></tbody></table></div><p class="help">เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI ปิดหน้านี้ได้ งานยังอยู่ในคิว</p></section>
  <div id="wr-drawer-scrim" hidden></div><dialog id="wr-drawer" aria-label="รายละเอียดคอนเทนต์"><div class="dialog-body"><button id="wr-drawer-close" class="btn btn-quiet" type="button" aria-label="ปิดรายละเอียด">✕</button><div id="wr-drawer-body"></div></div></dialog><dialog id="wr-studio" aria-label="Script Studio"></dialog><dialog id="wr-snap" aria-label="บันทึกผลลัพธ์คอนเทนต์"></dialog>`;
  bind(root);
}

async function reload(root) {
  const results = await Promise.all(['content_items', 'content_variants', 'publications', 'analytics_snapshots', 'wr_jobs'].map((table) => services.api(`/api/${table}`)));
  state = { ideas: results[0].items, variants: results[1].items, publications: results[2].items, snapshots: results[3].items, jobs: results[4].items, items: state?.items || [] };
  renderPage(root);
}

/** ตัวสร้างเรคคอร์ด idea — ห้อง Intel Warroom ใช้ตัวเดียวกันตอนส่งบทเข้ามา ฟิลด์จะได้ไม่หลุดกัน */
function ideaRecord(content_id, title, extra = {}) {
  return { content_id, title, canonical_angle: extra.canonical_angle || '', topic_cluster: '', funnel_stage: extra.funnel_stage || 'top', pillar_bucket: extra.pillar_bucket || 'ai_in_business', angle_type: 'how_to', acid_test: 'pending', offer_link: null, source_type: extra.source_type || 'webapp', source_ref: extra.source_ref || 'manual', idea_status: 'captured', freshness_score: 1, similarity_group: null, decision_label: null, created_at: extra.created_at || new Date().toISOString(), last_used_at: null };
}

async function createIdea(title, extra = {}) {
  const item = ideaRecord(nextId(), title, extra);
  await services.api('/api/content_items', { method: 'POST', body: item }); return item;
}

async function quickSave(root, force = false) {
  const input = document.querySelector('#wr-quick-idea'); const title = input.value.trim(); if (!title) return;
  const found = await services.api('/api/similar', { method: 'POST', body: { query: title, items: state.ideas, threshold: 0.22 } });
  if (!force && found.items.length) { const panel = document.querySelector('#wr-quick-similar'); panel.hidden = false; panel.innerHTML = `⚠️ คล้ายกับ idea เดิม: ${found.items.slice(0, 3).map((x) => `${escapeHtml(x.content_id)} ${escapeHtml(x.title)} (${Math.round(x.similarity * 100)}%)`).join('<br>')}<div class="form-actions"><button class="btn btn-accent" data-sim="force" type="button">บันทึกเป็น idea ใหม่</button><button class="btn btn-quiet" data-sim="cancel" type="button">ยกเลิก</button></div>`; bindSimilar(root); return; }
  const item = await createIdea(title); services.toast(`บันทึกแล้ว → ${item.content_id}`); await reload(root);
}

function bindSimilar(root) { root.querySelector('[data-sim="force"]')?.addEventListener('click', () => quickSave(root, true)); root.querySelector('[data-sim="cancel"]')?.addEventListener('click', () => { document.querySelector('#wr-quick-similar').hidden = true; }); }

/** ตัวสร้างเรคคอร์ด variant — ใช้ร่วมกับห้อง Intel Warroom เช่นเดียวกับ ideaRecord */
function variantRecord(idea, code, extra = {}) {
  const [format, dir, platforms] = FORMATS[code]; const variant_id = `${idea.content_id}-${code}`; const now = extra.created_at || new Date().toISOString();
  return { variant_id, content_id: idea.content_id, format, target_platforms: platforms, working_title: idea.title, markdown_path: `output/content/${dir}/${variant_id}--${slug(idea.title)}.md`, variant_status: extra.variant_status || 'draft', cta_keyword: extra.cta_keyword || '', editorial_status: 'draft', publish_target_at: null, published_at: null, created_at: now, status_changed_at: now, script_draft: extra.script_draft || '', ai_result: extra.ai_result ?? null, ai_result_at: extra.ai_result ? now : null };
}

async function createVariant(idea, code) {
  const item = variantRecord(idea, code);
  await services.api('/api/content_variants', { method: 'POST', body: item });
  if (['captured', 'triaged', 'selected'].includes(idea.idea_status)) await services.api(`/api/content_items/${idea.content_id}`, { method: 'PATCH', body: { idea_status: 'active' } });
  return item;
}

// ---------- แก้ชื่อไอเดียในที่ (✏️ → ช่องพิมพ์ · Enter บันทึก · Esc ยกเลิก) ----------
function titleView(title) {
  return `<div id="wr-title-wrap" class="form-actions"><h3>${escapeHtml(title)}</h3><button class="btn btn-quiet" data-action="edit-title" type="button" aria-label="แก้ชื่อหัวข้อ" title="แก้ชื่อหัวข้อ">✏️</button></div>`;
}
function titleEditor(title) {
  return `<div id="wr-title-wrap" class="form-actions"><input id="wr-title-input" value="${escapeHtml(title)}" maxlength="200" aria-label="ชื่อหัวข้อไอเดีย"><button class="btn btn-accent" data-action="save-title" type="button">บันทึก</button><button class="btn btn-quiet" data-action="cancel-title" type="button">ยกเลิก</button></div>`;
}

function openDrawer(id, root) {
  const idea = state.ideas.find((x) => x.content_id === id) || state.ideas.find((x) => x.content_id === state.variants.find((v) => v.variant_id === id)?.content_id); if (!idea) return;
  const variants = state.variants.filter((x) => x.content_id === idea.content_id);
  const body = document.querySelector('#wr-drawer-body'); const dialog = document.querySelector('#wr-drawer');
  body.innerHTML = `<h2>รายละเอียด</h2><p>${idea.content_id} <button class="btn btn-quiet" data-action="copy-id" data-id="${idea.content_id}" type="button">📋 ID</button></p>${titleView(idea.title)}<div class="field"><label>canonical angle</label><textarea data-action="angle">${escapeHtml(idea.canonical_angle || '')}</textarea></div><div class="form-grid"><select data-action="i-status"><option>${escapeHtml(idea.idea_status)}</option>${['captured','triaged','selected','active','published','repurpose_candidate','archived'].filter((x) => x !== idea.idea_status).map((x) => `<option>${x}</option>`).join('')}</select><select data-action="i-acid"><option>${escapeHtml(idea.acid_test)}</option><option>pending</option><option>passed</option><option>failed</option></select><select data-action="i-pillar"><option>${escapeHtml(idea.pillar_bucket)}</option><option value="ai_in_business">pillar?</option></select><select data-action="i-funnel"><option>${escapeHtml(idea.funnel_stage)}</option><option>top</option><option>middle</option><option>bottom</option></select></div>${idea.acid_test !== 'passed' ? '<div class="error-box">🧪 Triage Gate: ถามก่อนถ่าย — "ตัดหน้า/ชื่อแบรนด์ออก คนดูยังได้ของกลับบ้านไหม?" ผ่านแล้วตั้ง acid: passed ก่อนเข้า weekly plan</div>' : ''}<h3>Variants (format เท่านั้น — platform บันทึกตอนลงจริง)</h3>${Object.entries(FORMATS).map(([code, info]) => { const variant = variants.find((v) => v.variant_id.endsWith(`-${code}`)); return variant ? `<section class="card"><strong>${code} · ${info[3]}</strong><p>${variant.variant_id} <button class="btn btn-quiet" data-action="copy-id" data-id="${variant.variant_id}" type="button">📋 ID</button></p><select data-action="v-status" data-id="${variant.variant_id}">${['draft','ai_improved','ready_to_record','recorded','editing','edited','scheduled','posted','analyzed','repurposed'].map((x) => `<option ${x === variant.variant_status ? 'selected' : ''}>${x}</option>`).join('')}</select><p class="help">${escapeHtml(variant.markdown_path)}</p><button class="btn btn-outline" data-action="studio" data-id="${variant.variant_id}" type="button">📝 Script Studio</button><button class="btn btn-outline" data-action="snap" data-id="${variant.variant_id}" type="button">📊</button><button class="btn btn-accent" data-action="add-pub" data-id="${variant.variant_id}" type="button">ลงแล้ว</button><select data-action="decision" data-id="${variant.variant_id}"><option>decision?</option><option>kill</option><option>iterate</option><option>repurpose</option><option>boost</option><option>pillar</option><option>sales_asset</option></select></section>` : `<button class="btn btn-outline" data-action="create-variant" data-code="${code}" type="button">${code} · ${info[3]} · + สร้าง</button>`; }).join('')}`;
  body.insertAdjacentHTML('beforeend', `<h3>ประวัติการลง</h3>${state.publications.filter((publication)=>variants.some((variant)=>variant.variant_id===publication.variant_id)).map((publication)=>`<div class="list-item"><strong>${escapeHtml(publication.platform)}</strong> · ${new Date(publication.published_at).toLocaleDateString('th-TH')} · ${escapeHtml(publication.decision_label || 'decision?')} ${/^https?:\/\//.test(publication.post_url||'')?`<a href="${escapeHtml(publication.post_url)}" target="_blank" rel="noopener">เปิดโพสต์ ↗</a>`:''}</div>`).join('') || '<p>ยังไม่มี publication</p>'}`);
  drawerIdea = idea;
  document.querySelector('#wr-drawer-scrim').hidden = false;
  dialog.showModal(); bindDrawer(idea, root, dialog);
}

function frontmatter(idea, variant, body) { return `---\ncontent_id: "${idea.content_id}"\nvariant_id: "${variant.variant_id}"\nformat: "${variant.format}"\ntarget_platforms: [${variant.target_platforms.map((x) => `"${x}"`).join(', ')}]\nstatus: "${variant.variant_status}"        # mirror จาก database — ระบบ stamp ให้ ห้ามแก้มือ\ntopic_cluster: "${idea.topic_cluster || ''}"\nfunnel_stage: "${idea.funnel_stage}"\npillar_bucket: "${idea.pillar_bucket}"\nangle_type: "${idea.angle_type}"\ncta_keyword: "${variant.cta_keyword || ''}"\nsource_refs:\n  - "output/content/war-room/ideas/${idea.content_id}.md"\npublished_urls: []\nanalytics_status: "not_started"\ndraft: true                      # ถอดออกเมื่อ ready → Editorial Gate QC อัตโนมัติ\n---\n\n${body}`; }

function openStudio(id, root) {
  const variant = state.variants.find((x) => x.variant_id === id); const idea = state.ideas.find((x) => x.content_id === variant.content_id); const dialog = document.querySelector('#wr-studio');
  dialog.innerHTML = `<div class="dialog-body"><h2>${variant.variant_id} · ${escapeHtml(idea.title)}</h2><p class="help">${escapeHtml(variant.markdown_path)}</p><textarea id="wr-studio-body" class="field-full">${escapeHtml(variant.script_draft || SCRIPT_TEMPLATE)}</textarea><section class="card"><h3>✅ Checklist ก่อนอัด</h3><ol><li>Hook ส่ง payload ใน 0–2 วิ</li><li>Setup พาไปดูของจริง</li><li>Rehook ทุก 15–20 วิ</li><li>Payoff ตอบสิ่งที่เปิดไว้</li><li>CTA ทำต่อได้ชัด</li></ol></section><div class="form-actions"><button id="wr-studio-ai" class="btn btn-accent" type="button">✨ ให้ AI เกลา</button><button id="wr-studio-save-draft" class="btn btn-primary" type="button">💾 บันทึกร่าง</button><button id="wr-studio-template" class="btn btn-outline" type="button">📐 วางโครง</button></div><section class="card"><h3>🤖 ผลจาก AI</h3><pre id="wr-studio-ai-result">${escapeHtml(variant.ai_result || 'ยังไม่มีผล')}</pre><button id="wr-studio-ai-copy" class="btn btn-quiet" type="button">คัดลอกผล</button><button id="wr-studio-ai-use" class="btn btn-quiet" type="button">⬆️ ใช้แทนร่าง</button><p>AI อ่านโครง + เสียงบริษัทก่อน · ร่างของคุณยังอยู่ช่องบนเสมอ</p></section><div class="form-actions"><button id="wr-studio-copy-body" class="btn btn-quiet" type="button">คัดลอกเนื้อหา</button><button id="wr-studio-copy" class="btn btn-quiet" type="button">คัดลอกทั้งไฟล์ (.md)</button><button id="wr-studio-dl" class="btn btn-quiet" type="button">⬇️ Download .md</button><button id="wr-studio-write" class="btn btn-accent" type="button">💽 เขียนลง output/content/</button><button class="btn btn-quiet" data-close-studio type="button">ปิด</button></div></div>`;
  dialog.showModal(); bindStudio(idea, variant, root, dialog);
}

function bindStudio(idea, variant, root, dialog) {
  const body = () => dialog.querySelector('#wr-studio-body').value;
  dialog.querySelector('#wr-studio-template').addEventListener('click', () => { if (confirm('ทับเนื้อหาในช่องร่างด้วยโครงเปล่า?')) { dialog.querySelector('#wr-studio-body').value = SCRIPT_TEMPLATE; services.toast('วางโครง Hook→Setup→Body→Rehook→Payoff→CTA แล้ว 📐'); } });
  dialog.querySelector('#wr-studio-save-draft').addEventListener('click', async () => { await services.api(`/api/content_variants/${variant.variant_id}`, { method: 'PATCH', body: { script_draft: body() } }); services.toast('บันทึกร่างแล้ว 💾'); });
  dialog.querySelector('#wr-studio-ai').addEventListener('click', async () => { await services.api(`/api/content_variants/${variant.variant_id}`, { method: 'PATCH', body: { script_draft: body() } }); await services.api('/api/wr_jobs', { method: 'POST', body: { id: uid('JOB'), job_type: 'ai_improve', payload: { variant_id: variant.variant_id, script: body() }, status: 'queued', result: {}, error: null, created_at: new Date().toISOString(), started_at: null, finished_at: null } }); services.toast('เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI'); });
  dialog.querySelector('#wr-studio-ai-copy').addEventListener('click', async () => { await copyText(variant.ai_result || ''); services.toast('คัดลอกผล AI แล้ว'); });
  dialog.querySelector('#wr-studio-ai-use').addEventListener('click', () => { dialog.querySelector('#wr-studio-body').value = variant.ai_result || ''; services.toast('วางผล AI ในช่องร่างแล้ว — กด 💾 ถ้าจะเก็บทับร่างเดิม'); });
  dialog.querySelector('#wr-studio-copy-body').addEventListener('click', async () => { await copyText(body()); services.toast('คัดลอกเนื้อหาแล้ว'); });
  dialog.querySelector('#wr-studio-copy').addEventListener('click', async () => { await copyText(frontmatter(idea, variant, body())); services.toast('คัดลอกทั้งไฟล์แล้ว'); });
  dialog.querySelector('#wr-studio-dl').addEventListener('click', () => { const blob = new Blob([frontmatter(idea, variant, body())], { type: 'text/markdown' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = variant.markdown_path.split('/').at(-1); link.click(); URL.revokeObjectURL(link.href); services.toast(`ดาวน์โหลด ${link.download}`); });
  dialog.querySelector('#wr-studio-write').addEventListener('click', async () => { await services.api('/api/write-md', { method: 'POST', body: { path: variant.markdown_path, content: frontmatter(idea, variant, body()) } }); services.toast(`เขียนแล้ว → ${variant.markdown_path}`); });
  dialog.querySelector('[data-close-studio]').addEventListener('click', () => dialog.close());
}

function openSnapshot(variantId) { const dialog = document.querySelector('#wr-snap'); const publication = state.publications.find((x) => x.variant_id === variantId); dialog.innerHTML = `<form class="dialog-body"><h2>${variantId} · ${escapeHtml(publication?.platform || 'platform')}</h2><div class="form-grid">${['views','reach','likes','comments','shares','saves','keyword_comments','dm_count','line_adds','leads_created'].map((name) => `<label class="field">${name}<input name="${name}" type="number" min="0" value="0"></label>`).join('')}<label class="field field-full">notes<textarea name="notes"></textarea></label></div><button id="wr-snap-save" class="btn btn-accent" type="submit">บันทึก</button><button class="btn btn-quiet" data-close-snap type="button">ยกเลิก</button></form>`; dialog.showModal(); dialog.querySelector('form').addEventListener('submit', async (event) => { event.preventDefault(); if (!publication) return services.toast('บันทึก publication ก่อน', true); const form = new FormData(event.target); const item = Object.fromEntries([...form].map(([k, v]) => [k, k === 'notes' ? v : Number(v)])); await services.api('/api/analytics_snapshots', { method: 'POST', body: { snapshot_id: uid('SNAP'), publication_id: publication.publication_id, captured_at: new Date().toISOString(), source: 'manual', views: 0, reach: 0, watch_time_avg: 0, completion_rate: 0, likes: 0, comments: 0, shares: 0, saves: 0, profile_visits: 0, follows: 0, keyword_comments: 0, dm_count: 0, line_adds: 0, leads_created: 0, notes: '', ...item } }); services.toast('บันทึก snapshot แล้ว'); dialog.close(); }); dialog.querySelector('[data-close-snap]').addEventListener('click', () => dialog.close()); }

function bindDrawer(idea, root, dialog) {
  dialog.querySelectorAll('[data-action="decision"]').forEach((node)=>node.addEventListener('change',async()=>{const publication=state.publications.filter((item)=>item.variant_id===node.dataset.id).at(-1);if(!publication){services.toast('บันทึกการลงก่อนเลือก decision',true);return;}await services.api(`/api/publications/${publication.publication_id}`,{method:'PATCH',body:{decision_label:node.value}});services.toast('อัปเดต decision แล้ว');}));
  dialog.querySelectorAll('[data-action="copy-id"]').forEach((n) => n.addEventListener('click', async () => { await copyText(n.dataset.id); services.toast(`คัดลอก ${n.dataset.id}`); }));
  dialog.querySelectorAll('[data-action="create-variant"]').forEach((n) => n.addEventListener('click', async () => { await createVariant(idea, n.dataset.code); services.toast('สร้าง variant แล้ว'); dialog.close(); await reload(root); }));
  dialog.querySelectorAll('[data-action="studio"]').forEach((n) => n.addEventListener('click', () => openStudio(n.dataset.id, root)));
  dialog.querySelectorAll('[data-action="snap"]').forEach((n) => n.addEventListener('click', () => openSnapshot(n.dataset.id)));
  dialog.querySelectorAll('[data-action="v-status"]').forEach((n) => n.addEventListener('change', async () => { await services.api(`/api/content_variants/${n.dataset.id}`, { method: 'PATCH', body: { variant_status: n.value, status_changed_at: new Date().toISOString() } }); services.toast('อัปเดตแล้ว'); }));
  for (const [action, field] of [['i-status','idea_status'],['i-acid','acid_test'],['i-pillar','pillar_bucket'],['i-funnel','funnel_stage']]) dialog.querySelector(`[data-action="${action}"]`)?.addEventListener('change', async (event) => services.api(`/api/content_items/${idea.content_id}`, { method: 'PATCH', body: { [field]: event.target.value } }));
  dialog.querySelector('[data-action="angle"]').addEventListener('change', (event) => services.api(`/api/content_items/${idea.content_id}`, { method: 'PATCH', body: { canonical_angle: event.target.value || null } }));
  dialog.querySelectorAll('[data-action="add-pub"]').forEach((n) => n.addEventListener('click', async () => { const now = new Date().toISOString(); await services.api('/api/publications', { method: 'POST', body: { publication_id: uid('PUB'), variant_id: n.dataset.id, platform: 'facebook', post_url: 'manual-record', post_id: null, published_at: now, caption_path: null, first_comment: null, utm_campaign: null, status: 'posted', decision_label: null, created_at: now } }); await services.api(`/api/content_variants/${n.dataset.id}`, { method: 'PATCH', body: { variant_status: 'posted', published_at: now, status_changed_at: now } }); await services.api(`/api/content_items/${idea.content_id}`, { method: 'PATCH', body: { idea_status: 'published' } }); services.toast('บันทึกการลง facebook แล้ว'); dialog.close(); await reload(root); }));
}

async function saveIdeaTitle(root) {
  const idea = drawerIdea; const input = document.querySelector('#wr-title-input');
  if (!idea || !input) return;
  const title = input.value.trim();
  if (!title) { services.toast('หัวข้อว่างไม่ได้ครับ', true); return; }
  if (title === idea.title) { document.querySelector('#wr-title-wrap').outerHTML = titleView(idea.title); return; }
  const previous = idea.title;
  input.disabled = true;
  try {
    await services.api(`/api/content_items/${idea.content_id}`, { method: 'PATCH', body: { title } });
    // variant ที่ยังใช้ชื่อเดิมของไอเดีย = ตั้งใจให้ตามกัน จึงเปลี่ยนตาม · variant ที่ถูกตั้งชื่อเองแล้วไม่ยุ่ง
    for (const variant of state.variants.filter((item) => item.content_id === idea.content_id && item.working_title === previous)) {
      await services.api(`/api/content_variants/${variant.variant_id}`, { method: 'PATCH', body: { working_title: title } });
      variant.working_title = title;
      root.querySelectorAll(`[data-card="variant"][data-id="${variant.variant_id}"] h4`).forEach((node) => { node.textContent = title; });
    }
    idea.title = title;
    document.querySelector('#wr-title-wrap').outerHTML = titleView(title);
    root.querySelectorAll(`[data-card="idea"][data-id="${idea.content_id}"] h4`).forEach((node) => { node.textContent = title; });
    root.querySelectorAll(`#wr-idea-list [data-id="${idea.content_id}"]`).forEach((node) => { node.textContent = `${idea.content_id} · ${title}`; });
    services.toast('บันทึกหัวข้อแล้ว');
  } catch (error) { input.disabled = false; services.toast(`บันทึกหัวข้อไม่สำเร็จ: ${error.message}`, true); }
}

function setView(root, next) {
  view = next;
  for (const [button, section, key] of [['#wr-view-board', '#wr-board', 'board'], ['#wr-view-list', '#wr-list-view', 'list'], ['#wr-view-queue', '#wr-queue-view', 'queue']]) {
    const on = view === key; const node = root.querySelector(button);
    root.querySelector(section).hidden = !on;
    node.classList.toggle('btn-primary', on); node.classList.toggle('btn-outline', !on);
    node.setAttribute('aria-selected', String(on));
  }
  if (view === 'queue') loadQueue(root).catch((error) => services.toast(error.message, true));
  syncQueuePolling(root);
}

// badge ต้องเดินแม้อยู่หน้าบอร์ด (จะได้รู้ว่ามีงานค้าง) · เปิดมุมมองคิวแล้วถี่ขึ้น · สลับแท็บไปแล้วหยุด
function syncQueuePolling(root) {
  if (queueTimer) window.clearInterval(queueTimer);
  queueTimer = 0;
  if (document.visibilityState !== 'visible') return;
  queueTimer = window.setInterval(() => { loadQueue(root).catch(() => {}); }, view === 'queue' ? 10000 : 30000);
}

async function loadQueue(root) {
  state.jobs = (await services.api('/api/wr_jobs')).items;
  const missingTitle = state.jobs.some((job) => job.job_type === 'rewrite_reel' && job.payload?.item_id && !state.items.some((item) => item.id === job.payload.item_id));
  if (missingTitle) { try { state.items = (await services.api('/api/newsroom_items')).items; } catch { /* ชื่อการ์ดไม่มา ก็ยังโชว์ id ได้ */ } }
  renderQueue(root);
}

function renderQueue(root, now = Date.now()) {
  const health = queueHealth(state.jobs, now);
  const badge = root.querySelector('#wr-queue-badge'); if (badge) badge.textContent = health.pending;
  const banner = root.querySelector('#wr-queue-health');
  // error ใช้กล่องเตือนพื้นอ่อน ไม่ใช่ตัวแดงบนแถบ navy (อ่านไม่ออก)
  if (banner) { banner.textContent = health.text; banner.className = health.tone === 'error' ? 'error-box' : 'today-strip'; }
  const body = root.querySelector('#wr-queue'); if (!body) return;
  const queued = state.jobs.filter((job) => job.status === 'queued');
  const rows = [...state.jobs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 60)
    .filter((job) => queueFilter === 'all' || (queueFilter === 'other' ? !['ai_improve', 'rewrite_reel'].includes(job.job_type) : job.job_type === queueFilter));
  body.innerHTML = rows.map((job) => {
    const subject = jobSubject(job, state);
    const started = job.started_at ? new Date(job.started_at).getTime() : 0;
    const late = job.status === 'running' && started && now - started > STALL_MS;
    const note = job.status === 'running' && started ? `<span class="${late ? 'urgent-note' : 'help'}">${mmss(now - started)} นาที${late ? ' ⚠️' : ''}</span>`
      : job.status === 'queued' ? `<span class="help">อันดับ ${queued.findIndex((x) => x.id === job.id) + 1}</span>`
      : job.status === 'done' && job.finished_at && started ? `<span class="help">ใช้ ${mmss(new Date(job.finished_at).getTime() - started)} นาที</span>` : '';
    const open = job.status !== 'done' ? ''
      : subject.variantId ? `<button class="btn btn-outline" data-open-variant="${escapeHtml(subject.variantId)}" type="button">เปิด Studio</button>`
      : subject.href ? `<a class="btn btn-quiet" href="${escapeHtml(subject.href)}">เปิดห้อง</a>` : '';
    return `<tr class="${late ? 'is-urgent' : ''}"><td data-label="งาน">${escapeHtml(JOB_LABEL[job.job_type] || job.job_type)}</td><td data-label="การ์ด / ธง"><strong>${escapeHtml(subject.text)}</strong>${subject.sub ? `<p class="help">${escapeHtml(subject.sub)}</p>` : ''}${job.error ? `<p class="urgent-note">${escapeHtml(String(job.error).slice(0, 240))}</p>` : ''}</td><td data-label="สถานะ"><span class="badge">${escapeHtml(JOB_STATUS_LABEL[job.status] || job.status)}</span> ${note}</td><td data-label="ส่งเมื่อ" class="help">${escapeHtml(fmtWhen(job.created_at))}</td><td data-label="ทำต่อ">${open}${job.status === 'error' ? `<button class="btn btn-outline" data-queue-retry="${escapeHtml(job.id)}" type="button">ลองใหม่</button>` : ''}<button class="btn btn-danger" data-queue-delete="${escapeHtml(job.id)}" type="button" aria-label="ลบงานนี้ออกจากคิว">ลบ</button></td></tr>`;
  }).join('') || '<tr><td colspan="5">ไม่มีงานในหมวดนี้</td></tr>';
  body.querySelectorAll('[data-open-variant]').forEach((node) => node.addEventListener('click', () => { const variant = state.variants.find((x) => x.variant_id === node.dataset.openVariant); if (!variant) return services.toast('variant นี้ถูกลบไปแล้ว', true); openDrawer(variant.content_id, root); openStudio(variant.variant_id, root); }));
  body.querySelectorAll('[data-queue-retry]').forEach((node) => node.addEventListener('click', async () => { await services.api(`/api/wr_jobs/${node.dataset.queueRetry}`, { method: 'PATCH', body: { status: 'queued', error: null, started_at: null, finished_at: null } }); services.toast('ส่งกลับเข้าคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI'); await loadQueue(root); }));
  body.querySelectorAll('[data-queue-delete]').forEach((node) => node.addEventListener('click', async () => { if (!confirm('ลบงานนี้ออกจากคิว?')) return; await services.api(`/api/wr_jobs/${node.dataset.queueDelete}`, { method: 'DELETE' }); services.toast('ลบแล้ว'); await loadQueue(root); }));
}

function bind(root) {
  root.querySelector('#wr-view-board').addEventListener('click', () => setView(root, 'board'));
  root.querySelector('#wr-view-list').addEventListener('click', () => setView(root, 'list'));
  root.querySelector('#wr-view-queue').addEventListener('click', () => setView(root, 'queue'));
  root.querySelector('#wr-queue-refresh').addEventListener('click', async () => { await loadQueue(root); services.toast('รีเฟรชคิวแล้ว'); });
  root.querySelectorAll('#wr-queue-filter [data-qf]').forEach((node) => node.addEventListener('click', () => { queueFilter = node.dataset.qf; renderQueue(root); }));
  setView(root, view);
  root.querySelector('#wr-board-search').addEventListener('input', (event) => { const query=event.target.value.toLowerCase();root.querySelectorAll('[data-card]').forEach((card)=>{card.hidden=!card.textContent.toLowerCase().includes(query);}); });
  const filterIdeas=(mode='all')=>{const query=root.querySelector('#wr-search').value.toLowerCase();root.querySelectorAll('#wr-idea-list [data-id]').forEach((row)=>{const idea=state.ideas.find((x)=>x.content_id===row.dataset.id);const statusMatch=mode==='all'||idea.idea_status===mode||(mode==='active'&&['selected','active'].includes(idea.idea_status))||(mode==='published'&&['published','repurpose_candidate'].includes(idea.idea_status));row.hidden=!statusMatch||!`${idea.content_id} ${idea.title} ${idea.canonical_angle} ${idea.topic_cluster}`.toLowerCase().includes(query);});};
  root.querySelector('#wr-search').addEventListener('input',()=>filterIdeas());root.querySelectorAll('#wr-filter [data-f]').forEach((node)=>node.addEventListener('click',()=>filterIdeas(node.dataset.f)));
  root.querySelector('#wr-quick-save').addEventListener('click', () => quickSave(root)); root.querySelector('#wr-quick-idea').addEventListener('keydown', (event) => { if (event.key === 'Enter') quickSave(root); });
  root.querySelector('#wr-idea-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const item = await createIdea(data.title, data); services.toast(`บันทึกแล้ว → ${item.content_id}`); await reload(root); });
  root.querySelectorAll('[data-action="quick-produce"]').forEach((n) => n.addEventListener('click', async () => { const idea = state.ideas.find((x) => x.content_id === n.dataset.id); await createVariant(idea, 'RL'); services.toast('สร้าง Reel variant แล้ว'); await reload(root); }));
  root.querySelectorAll('[data-action="open-card"]').forEach((n) => n.addEventListener('click', () => openDrawer(n.closest('[data-card]').dataset.id, root)));
  root.querySelectorAll('[data-card], #wr-idea-list [data-id]').forEach((n) => n.addEventListener('click', (event) => { if (!event.target.closest('button') || n.matches('#wr-idea-list [data-id]')) openDrawer(n.dataset.id, root); }));
  root.querySelectorAll('[data-action="copy-id"]').forEach((n) => n.addEventListener('click', async () => { await copyText(n.dataset.id); services.toast(`คัดลอก ${n.dataset.id}`); }));
  root.querySelectorAll('[data-card="variant"]').forEach((n) => n.addEventListener('dragstart', (event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(DRAG_MIME, n.dataset.id); event.dataTransfer.setData('text/plain', n.dataset.id); }));
  let moving = false;
  root.querySelectorAll('[data-column]').forEach((n) => {
    n.addEventListener('dragover', (event) => { if (acceptsDrag([...event.dataTransfer.types], n.dataset.primary)) event.preventDefault(); });
    n.addEventListener('drop', async (event) => {
      const move = dropDecision({ types: [...event.dataTransfer.types], id: event.dataTransfer.getData(DRAG_MIME), primary: n.dataset.primary }, state.variants);
      if (!move) return;
      event.preventDefault();
      if (moving) return;                       // ปล่อยรัวสองที = ยิงซ้ำ
      moving = true;
      try {
        await services.api(`/api/content_variants/${move.id}`, { method: 'PATCH', body: { variant_status: move.status, status_changed_at: new Date().toISOString() } });
        services.toast(`ย้าย ${move.id.replace('CNT-', '')} → ${move.status}`);
        await reload(root);
      } catch (error) {                         // เดิมไม่มี catch — เซิร์ฟเวอร์ล่ม/ย้ายไม่ผ่าน = เงียบสนิท
        services.toast(`ย้ายไม่สำเร็จ: ${error.message} — เช็คว่าหน้าต่าง workspace ยังรันอยู่ แล้วลองใหม่`, true);
      } finally {
        moving = false;
      }
    });
  });
  // แก้ชื่อไอเดีย — ผูกที่ตัวแผงครั้งเดียวต่อการ render เพราะโครง HTML ในแผงถูกสลับตอนกด ✏️
  root.querySelector('#wr-drawer-body').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'edit-title' && drawerIdea) { document.querySelector('#wr-title-wrap').outerHTML = titleEditor(drawerIdea.title); const input = document.querySelector('#wr-title-input'); input.focus(); input.select(); }
    else if (action === 'save-title') saveIdeaTitle(root);
    else if (action === 'cancel-title' && drawerIdea) document.querySelector('#wr-title-wrap').outerHTML = titleView(drawerIdea.title);
  });
  const closeDrawer=()=>{document.querySelector('#wr-drawer').close();document.querySelector('#wr-drawer-scrim').hidden=true;};root.querySelector('#wr-drawer-close').addEventListener('click', closeDrawer);root.querySelector('#wr-drawer-scrim').addEventListener('click',closeDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.target?.id === 'wr-title-input') {          // ในช่องแก้ชื่อ: Enter บันทึก · Esc ยกเลิกแก้ ไม่ปิดแผง
      if (event.key === 'Enter') { event.preventDefault(); saveIdeaTitle(root); }
      else if (event.key === 'Escape') { event.preventDefault(); document.querySelector('#wr-title-wrap').outerHTML = titleView(drawerIdea.title); }
      return;
    }
    if (event.key === 'Escape') closeDrawer();
  });
}

export async function render(root, incoming) {
  services = incoming;
  await reload(root);
  document.addEventListener('visibilitychange', () => syncQueuePolling(root));
}
export { SCRIPT_TEMPLATE, frontmatter, staleVariants, acceptsDrag, dropDecision, DRAG_MIME, queueHealth, jobSubject, nextContentId, ideaCard, ideaRecord, variantCard, variantRecord, JOB_LABEL };
