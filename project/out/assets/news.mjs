import { copyText, escapeHtml, uid } from './api.mjs';

const JOB_LABEL = Object.freeze({ render_card: '🎨 การ์ดซีน AI', render_text_card: '🖼 การ์ดตัวอักษร', rewrite_copy: '✍️ เขียนใหม่ด้วย AI', ai_improve: '✨ เกลาบท' });
const COMMENT_ROLES = Object.freeze(['cta', 'article', 'source', 'angle2', 'cases']);
let state;
let services;

function candidateTitle(candidate, newsItems) { return newsItems.find((item)=>item.id===candidate.news_item_id)?.title || candidate.hooks?.[0]?.text || 'ข่าวรอเลือก'; }
function orderedCommentThread(candidate) {
  const comments = candidate.comment_thread || [];
  const ordered = COMMENT_ROLES.map((role) => comments.find((entry) => entry.role === role)).filter(Boolean);
  return ordered.length === COMMENT_ROLES.length ? ordered : comments;
}
function articleCommentIndex(comments) { return comments.findIndex((entry) => entry.role === 'article'); }

function formatNewsRun(run) {
  if (!run?.ran_at) return 'ยังไม่มีข้อมูลการรัน';
  const failed = Array.isArray(run.errors) ? run.errors.length : 0;
  return `${new Date(run.ran_at).toLocaleString('th-TH')} · ${Number(run.inserted || 0)} ข่าวใหม่ · ${Number(run.sources || 0)} แหล่ง${failed ? ` · ล้ม ${failed} แหล่ง` : ''}`;
}

function articleMetrics(value) {
  const thai = [...String(value)].filter((char) => /[\u0E00-\u0E7F]/.test(char)).length;
  const pins = (String(value).match(/📍/g) || []).length;
  const long = String(value).split('\n').filter((line) => [...line].length > 48).length;
  return { thai, pins, long, minutes: Math.max(1, Math.ceil(thai / 900)) };
}

function updateCounter() {
  const node = document.querySelector('#nd-article');
  const counter = document.querySelector('#nd-counter');
  if (!node || !counter) return;
  const metric = articleMetrics(node.value);
  counter.textContent = `${metric.thai} ตัวอักษรไทย · อ่าน ~${metric.minutes} นาที · 📍 ${metric.pins} จุด${metric.long ? ` · ⚠️ บรรทัดยาวเกิน 48 ตัวอักษร ${metric.long} บรรทัด` : ''}`;
  counter.className = metric.thai < 1500 || metric.thai > 2100 || metric.pins < 3 || metric.pins > 4 || metric.long ? 'urgent-note' : 'help';
}

function card(candidate) {
  const image = candidate.images?.[candidate.selected_image ?? 0];
  const label = candidate.status === 'scheduled' ? `ตั้งเวลาแล้ว${candidate.scheduled_at ? ` · ⏰ ${new Date(candidate.scheduled_at).toLocaleString('th-TH')}` : ''}` : 'รอเลือก';
  return `<li class="list-item" role="button" tabindex="0" data-open="${candidate.id}"><div class="layout-two">${image ? `<img class="nd-img" src="${escapeHtml(image.url)}" alt="หน้าปก">` : '<span class="badge">ไม่มีรูป</span>'}<div><div class="meta"><span class="badge">${label}</span><span>${escapeHtml(candidate.scene_field)}</span></div><h3>${escapeHtml(candidateTitle(candidate, state.news))}</h3><p>${escapeHtml(candidate.article_md).slice(0, 160).replaceAll('📍', ' ')}</p></div></div></li>`;
}

function tabButton(key, label, badge = '') { return `<button class="btn btn-quiet" data-nd-tab="${key}" type="button">${label}${badge}</button>`; }

function renderPage(root) {
  const pending = state.candidates.filter((item) => ['pending_review', 'scheduled'].includes(item.status));
  const activeJobs = state.jobs.filter((item) => ['queued', 'running'].includes(item.status));
  root.innerHTML = `<div class="news-desk-column"><header class="page-head news-page-head"><div><p class="eyebrow">Editorial desk</p><h1>News Desk</h1><p class="lede">คัดข่าว เขียน ตรวจ และส่งออกด้วยมือ โดยเก็บ state ไว้ในเครื่องนี้</p></div><div class="form-actions"><button id="nd-refresh" class="btn btn-outline" type="button">⟳ รีเฟรช</button><button id="nd-daily-brain" class="btn btn-accent" type="button">☀️ รันสมองเช้า</button></div></header>
  <nav class="form-actions" aria-label="News Desk tabs">${tabButton('candidates', '📋 รอเลือก', ` <span id="nd-badge" class="badge">${pending.length}</span>`)}${tabButton('jobs', '⏳ คิวงาน', ` <span id="nd-queue-badge" class="badge"${activeJobs.length ? '' : ' hidden'}>${activeJobs.length}</span>`)}${tabButton('sources', '📡 แหล่งข่าว')}${tabButton('history', '🗒 ประวัติโพสต์')}</nav>
  <section id="nd-pane-candidates" class="section-gap"><ul class="list">${pending.length ? pending.map(card).join('') : '<li class="card">ยังไม่มีข่าวรอเลือก — กด ☀️ รันสมองเช้า</li>'}</ul></section>
  <section id="nd-pane-jobs" class="section-gap" hidden><ul class="list">${state.jobs.length ? state.jobs.map((job) => `<li class="list-item"><strong>${JOB_LABEL[job.job_type] || job.job_type}</strong><div class="meta"><span>${job.status === 'done' ? 'สำเร็จ' : job.status === 'error' ? 'ล้มเหลว' : escapeHtml(job.status)}</span><span>${escapeHtml(job.error || '').slice(0, 240)}</span></div><div class="form-actions"><button class="btn btn-outline" data-job-retry="${job.id}" data-retry="${job.id}" type="button">ลองใหม่</button><button class="btn btn-danger" data-job-delete="${job.id}" data-delete-job="${job.id}" type="button">ลบ</button></div></li>`).join('') : '<li class="card">ยังไม่มีงานในคิว</li>'}</ul></section>
  <section id="nd-pane-sources" class="section-gap" hidden><form id="nd-source-form" class="card form-grid"><div class="field field-full"><label for="nd-source-url">URL</label><input id="nd-source-url" name="url" type="url" required placeholder="URL (เว็บข่าว หรือ RSS feed)"></div><div class="field"><label for="nd-source-topic">Topic</label><input id="nd-source-topic" name="topic" required placeholder="หัวข้อ เช่น เศรษฐกิจ SME / AI / ฝ่ายขาย"></div><div class="field"><label for="nd-source-tags">Tags</label><input id="nd-source-tags" name="tags" placeholder="tags คั่นด้วย , เช่น thai,macro,export"></div><div class="field"><label for="nd-source-type">Type</label><select id="nd-source-type" name="type"><option value="rss">RSS feed</option><option value="scrape">หน้าเว็บทั่วไป (scrape)</option></select></div><button id="nd-src-add" class="btn btn-accent" type="submit">+ เพิ่ม</button></form><ul class="list section-gap">${state.sources.length ? state.sources.map((source) => `<li class="list-item"><strong>${escapeHtml(source.topic)}</strong><p>${escapeHtml(source.url)}</p><button class="btn btn-outline" data-source-toggle="${source.id}" data-src="${source.id}" type="button">${source.active ? 'ปิด' : 'เปิด'}ใช้งาน</button></li>`).join('') : '<li class="card">ยังไม่มีแหล่งข่าว — เพิ่มด้านบนได้เลย</li>'}</ul></section>
  <section id="nd-pane-log" class="section-gap" hidden><ul class="list">${state.history.length ? state.history.map((post) => `<li class="list-item"><strong>📘 FB · ${post.error ? 'ล้มเหลว' : 'สำเร็จ'}</strong><p>${new Date(post.posted_at).toLocaleString('th-TH')}</p>${post.permalink ? `<a href="${escapeHtml(post.permalink)}">เปิดโพสต์ ↗</a>` : ''}</li>`).join('') : '<li class="card">ยังไม่มีประวัติโพสต์</li>'}</ul></section>
  <dialog id="nd-modal" aria-label="รายละเอียดข่าว"></dialog></div>`;
  bind(root);
  const hash = location.hash.slice(1);
  if (['sources', 'jobs'].includes(hash)) switchTab(hash);
}

function switchTab(key) {
  const panes = { candidates: '#nd-pane-candidates', jobs: '#nd-pane-jobs', sources: '#nd-pane-sources', history: '#nd-pane-log' };
  for (const [name, selector] of Object.entries(panes)) document.querySelector(selector).hidden = name !== key;
}

async function reload(root) {
  const [candidates, jobs, sources, history, news, meta] = await Promise.all(['ca_candidates', 'wr_jobs', 'ca_sources', 'ca_post_log', 'ca_news_items'].map((table) => services.api(`/api/${table}`)).concat(services.api('/api/meta')));
  state = { candidates: candidates.items, jobs: jobs.items, sources: sources.items, history: history.items, news: news.items, meta };
  renderPage(root);
}

function openCandidate(id, root) {
  const candidate = state.candidates.find((item) => item.id === id);
  const news = state.news.find((item) => item.id === candidate.news_item_id);
  const sourceUrl = escapeHtml(news?.url || '#');
  const modal = document.querySelector('#nd-modal');
  const images = candidate.images || [];
  const comments = orderedCommentThread(candidate);
  modal.innerHTML = `<div class="dialog-body"><div class="form-actions"><h2>${escapeHtml(news?.title || candidate.hooks?.[0]?.text || 'ตรวจข่าว')}</h2><a href="${sourceUrl}" target="_blank">อ่านข่าวต้นทาง ↗</a><button id="nd-rewrite" class="btn btn-outline" data-rewrite="${id}" type="button">✍️ เขียนใหม่ด้วย AI</button><span class="badge">AI ของบริษัท · เสียงบริษัท + writing-rules</span><span id="nd-rewrite-status"></span></div>
  <h3>1) เลือก Hook (ย่อหน้าแรกของโพสต์)</h3><div>${candidate.hooks.map((hook, index) => `<label class="radio-card nd-hook"><input type="radio" name="hook" data-hook="${index}" ${index === (candidate.selected_hook ?? 0) ? 'checked' : ''}><span><span class="badge">${escapeHtml(hook.style || hook.id)}</span> ${escapeHtml(hook.text)}</span></label>`).join('')}</div>
  <h3>2) การ์ดภาพ — ข้อความบนการ์ด + ซีน</h3><p class="help">กฎ Glance: ข้อความบนการ์ดต้องไม่ใช่ hook ใน caption — 5-10 คำ อ่านออกใน 2 วิ · [[คำ]] = เน้นสี coral · | = ขึ้นบรรทัดใหม่</p><div class="field"><label for="nd-glance">Glance copy</label><input id="nd-glance" maxlength="120" value="${escapeHtml(candidate.glance_line)}" placeholder="เศรษฐกิจโต | แต่[[ยอดคุณยังนิ่ง]]"></div><div class="field"><label for="nd-scene">Scene</label><textarea id="nd-scene" maxlength="1200" rows="3">${escapeHtml(candidate.scene_prompt)}</textarea></div><div class="form-actions"><button id="nd-textcard" class="btn btn-outline" data-render-text="${id}" type="button">🖼 สร้างการ์ดตัวอักษร <small>ฟรี · ~1 นาที</small></button><button id="nd-rerender" class="btn btn-outline" data-render-scene="${id}" type="button" ${state.meta.sceneCardEnabled ? '' : 'disabled title="ต้องใส่ kie.ai key ใน company/config.json"'}>🎨 สร้างการ์ดซีน AI <small>ใช้เครดิต kie.ai</small></button></div><p id="nd-rerender-status">สนาม: ${escapeHtml(candidate.scene_field)}</p><div class="workbench-grid">${images.length ? images.map((image, index) => `<button class="card ${index === (candidate.selected_image ?? 0) ? 'selected' : ''}" data-image="${index}" type="button"><img class="nd-img" src="${escapeHtml(image.url)}" alt="ตัวเลือกภาพ ${index + 1}"></button>`).join('') : '<p>ยังไม่มีการ์ด — พิมพ์ข้อความการ์ดด้านบนแล้วกด "🖼 สร้างการ์ดตัวอักษร" (ฟรี) หรือ "🎨 การ์ดซีน AI"</p>'}</div>
  <h3>3) บทความ (แก้ได้เลย)</h3><p class="help">บทความเล่าเรื่อง 1,500-2,000 ตัวอักษร · 📍 คั่นช่วง 3-4 จุด · บรรทัดสั้น 3-8 คำ <kbd>⌥↩</kbd></p><textarea id="nd-article" class="field-full" spellcheck="false">${escapeHtml(candidate.edited_article_md || candidate.article_md)}</textarea><p id="nd-counter"></p><button id="nd-article-expand" class="btn btn-outline" type="button">⤢ เต็มจอ</button>
  <h3>4) คอมเมนต์ใต้โพสต์ (${comments.length} รายการ)</h3><p class="help">caption ลงแค่ hook + 'สรุปไว้ใน comment' — เนื้อหาเต็มลงเป็นคอมเมนต์ตามลำดับนี้</p><div>${comments.map((comment, index) => `<label class="field"><span class="badge">${index + 1}. ${escapeHtml(comment.role)}</span><textarea data-comment="${index}" rows="${comment.role === 'article' ? 14 : 3}">${escapeHtml(comment.text)}</textarea></label>`).join('')}</div>
  <label class="radio-card"><input type="checkbox" disabled> ลง Instagram ด้วย <span class="badge">ไม่รวมใน Client Edition</span></label><div class="field"><label for="nd-sched">เวลาที่จะโพสต์</label><input id="nd-sched" type="datetime-local" title="จดไว้เตือนตัวเอง ระบบไม่โพสต์ให้"></div><div class="form-actions"><button id="nd-schedule" class="btn btn-outline" data-schedule="${id}" type="button" title="จดไว้เตือนตัวเอง ระบบไม่โพสต์ให้">⏰ ตั้งเวลา</button><button id="nd-reject" class="btn btn-danger" data-reject="${id}" type="button">🗑 ไม่เอา</button><button id="nd-post" class="btn btn-accent" data-post="${id}" type="button">🚀 โพสต์เลย</button><button class="btn btn-quiet" data-close-modal type="button">ปิด</button></div></div>`;
  modal.showModal(); updateCounter(); bindModal(candidate, root, modal);
}

function candidatePatch(candidate) {
  const article = document.querySelector('#nd-article').value;
  const currentComments = orderedCommentThread(candidate);
  const comments = [...document.querySelectorAll('[data-comment]')].map((node, index) => ({ ...currentComments[index], text: currentComments[index].role === 'article' ? article : node.value }));
  return { edited_article_md: article, selected_hook: Number(document.querySelector('[data-hook]:checked')?.dataset.hook || 0), selected_image: candidate.selected_image, glance_line: document.querySelector('#nd-glance').value, scene_prompt: document.querySelector('#nd-scene').value, comment_thread: comments };
}

function bindModal(candidate, root, modal) {
  const comments = orderedCommentThread(candidate);
  const articleIndex = articleCommentIndex(comments);
  modal.querySelector('#nd-article').addEventListener('input', (event) => {
    const article = modal.querySelector(`[data-comment="${articleIndex}"]`); if (articleIndex >= 0 && article) article.value = event.target.value; updateCounter();
  });
  modal.querySelector('#nd-article').addEventListener('keydown', (event) => { if (event.altKey && event.key === 'Enter') modal.querySelector('#nd-article-expand').click(); });
  modal.querySelector('#nd-article-expand').addEventListener('click', (event) => { const area = modal.querySelector('#nd-article'); const full = area.style.minHeight === '70vh'; area.style.minHeight = full ? '' : '70vh'; event.target.textContent = full ? '⤢ เต็มจอ' : '⤡ ย่อลง'; });
  modal.addEventListener('click', async (event) => {
    const image = event.target.closest('[data-image]'); if (image) candidate.selected_image = Number(image.dataset.image);
    if (event.target.closest('[data-close-modal]')) modal.close();
    const jobButton = event.target.closest('[data-rewrite],[data-render-text],[data-render-scene]');
    if (jobButton) {
      const jobType = jobButton.hasAttribute('data-rewrite') ? 'rewrite_copy' : jobButton.hasAttribute('data-render-text') ? 'render_text_card' : 'render_card';
      if (jobType === 'rewrite_copy' && !confirm('เก็บคำขอเขียนใหม่ในคิวบนคลาวด์? ยังไม่ได้เชื่อมตัวประมวลผล AI')) return;
      const payload = { candidate_id: candidate.id, slug: candidate.id.toLowerCase(), glance_line: modal.querySelector('#nd-glance').value, scene_prompt: modal.querySelector('#nd-scene').value };
      await services.api('/api/wr_jobs', { method: 'POST', body: { id: uid('JOB'), job_type: jobType, payload, status: 'queued', result: {}, error: null, created_at: new Date().toISOString(), started_at: null, finished_at: null } });
      services.toast(`เก็บคิวบนคลาวด์แล้ว (${JOB_LABEL[jobType]}) ยังไม่ได้เชื่อมตัวประมวลผล AI`); modal.close(); await reload(root); return;
    }
    const action = event.target.closest('[data-schedule],[data-reject],[data-post]');
    if (!action) return;
    const patch = candidatePatch(candidate);
    if (action.hasAttribute('data-schedule')) {
      const time = modal.querySelector('#nd-sched').value;
      if (!time || new Date(time) <= new Date()) return services.toast('กรุณาเลือกเวลาในอนาคต', true);
      if (patch.selected_hook == null || candidate.images.length && candidate.selected_image == null) return services.toast('เลือก hook และรูปก่อนตั้งเวลา', true);
      await services.api(`/api/ca_candidates/${candidate.id}`, { method: 'PATCH', body: { ...patch, status: 'scheduled', scheduled_at: new Date(time).toISOString() } });
      services.toast('ตั้งเวลาเตือนแล้ว — ระบบไม่โพสต์ให้');
    } else if (action.hasAttribute('data-reject')) {
      if (!confirm('ไม่เอาข่าวนี้ใช่ไหม?')) return;
      await services.api(`/api/ca_candidates/${candidate.id}`, { method: 'PATCH', body: { ...patch, status: 'rejected' } }); services.toast('ตัดออกแล้ว');
    } else {
      if (!confirm('ยืนยันว่าได้ตรวจเนื้อหาแล้ว และจะนำไปโพสต์ด้วยตัวเอง?')) return;
      const hook = candidate.hooks[patch.selected_hook]?.text || '';
      await copyText(`${hook}\n\nสรุปไว้ใน comment\n\n${patch.comment_thread.map((item, index) => `${index + 1}. ${item.text}`).join('\n\n')}`);
      await services.api(`/api/ca_candidates/${candidate.id}`, { method: 'PATCH', body: { ...patch, status: 'posted' } });
      await services.api('/api/ca_post_log', { method: 'POST', body: { id: uid('POST'), candidate_id: candidate.id, platform: 'facebook', post_id: null, permalink: null, error: null, posted_at: new Date().toISOString() } });
      services.toast('คัดลอก caption + คอมเมนต์แล้ว 🚀 เอาไปวางบนเพจได้เลย');
    }
    modal.close(); await reload(root);
  });
}

function bind(root) {
  root.querySelectorAll('[data-nd-tab]').forEach((node) => node.addEventListener('click', () => switchTab(node.dataset.ndTab)));
  root.querySelector('#nd-refresh').addEventListener('click', () => reload(root));
  root.querySelector('#nd-daily-brain').addEventListener('click', () => services.showDialog(`<h2>☀️ สมองเช้า</h2><p>ยังไม่ได้เชื่อมตัวประมวลผล AI บนคลาวด์สำหรับสมองเช้า จึงยังเริ่มรอบใหม่จากปุ่มนี้ไม่ได้</p><p>รอบล่าสุด: ${escapeHtml(formatNewsRun(state.meta.newsDailyLastRun))}</p>`));
  root.querySelectorAll('[data-open]').forEach((node) => { node.addEventListener('click', () => openCandidate(node.dataset.open, root)); node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCandidate(node.dataset.open, root); } }); });
  root.querySelector('#nd-source-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.target); await services.api('/api/ca_sources', { method: 'POST', body: { id: uid('SRC'), url: data.get('url'), topic: data.get('topic'), tags: String(data.get('tags')).split(',').map((x) => x.trim()).filter(Boolean), type: data.get('type'), active: true, added_at: new Date().toISOString() } }); services.toast('เพิ่มแหล่งข่าวแล้ว'); await reload(root); });
  root.querySelectorAll('[data-source-toggle]').forEach((node) => node.addEventListener('click', async () => { const item = state.sources.find((x) => x.id === node.dataset.sourceToggle); await services.api(`/api/ca_sources/${item.id}`, { method: 'PATCH', body: { active: !item.active } }); await reload(root); }));
  root.querySelectorAll('[data-job-retry]').forEach((node) => node.addEventListener('click', async () => { await services.api(`/api/wr_jobs/${node.dataset.jobRetry}`, { method: 'PATCH', body: { status: 'queued', error: null, started_at: null, finished_at: null } }); await reload(root); }));
  root.querySelectorAll('[data-job-delete]').forEach((node) => node.addEventListener('click', async () => { await services.api(`/api/wr_jobs/${node.dataset.jobDelete}`, { method: 'DELETE' }); await reload(root); }));
}

export async function render(root, incoming) { services = incoming; await reload(root); }

export { articleCommentIndex, articleMetrics, candidateTitle, formatNewsRun, orderedCommentThread };
