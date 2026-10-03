import { copyText, escapeHtml, uid } from './api.mjs';
import { ideaRecord, nextContentId, variantRecord } from './content.mjs';
import { briefLine, hasTranscript, HOOK_STYLE_LABEL, LENGTH_LABEL, PILLAR_LABEL, suggestedTheme, validateBrief } from './rewrite.mjs';
import { buildScoutJob, classifyScoutInput, scoutJobPresentation } from './scout-intake.mjs';

const THREAT_ORDER = ['red', 'orange', 'yellow', 'green', 'na'];
const THREAT_LABEL = Object.freeze({ red: 'หัวชนกัน', orange: 'ใกล้ · สูง', yellow: 'บางส่วน · เฝ้าดู', green: 'ต่ำ', na: 'บริบท' });
const THREAT_GROUP = Object.freeze({ red: 'head-on', orange: 'close / high', yellow: 'partial / watch', green: 'low', na: 'benchmark / context' });
const ROLE_LABEL = Object.freeze({ competitor: '🎯 คู่แข่งตลาด', benchmark: '📹 content benchmark', mentor: '🧭 mentor', context: '👁 context' });
const PLATFORM_LABEL = Object.freeze({ tiktok: 'TikTok', youtube: 'YouTube', instagram: 'IG', facebook_page: 'เพจ FB', web: 'เว็บ', line: 'LINE', skool: 'Skool' });
const NEWSROOM_PLATFORM_LABEL = Object.freeze({ tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', 'meta-ads': 'Meta Ads', web: 'Web', upload: 'Upload' });
const KIND_LABEL = Object.freeze({ clip: 'คลิป', page: 'เพจ', ads: 'แอด', web: 'เว็บ', shot: 'ภาพ', paste: 'ข้อความ' });
const METRIC_LABEL = Object.freeze({ median: 'median views/likes', per_week: 'โพสต์/สัปดาห์', followers: 'followers', scanned: 'โพสต์ที่สแกน', active_ads: 'แอด ACTIVE', max_longevity_days: 'แอดรันนานสุด (วัน)', views: 'views', score: 'คะแนน' });
const HOST_PLATFORM = Object.freeze({ 'youtube.com':'youtube', 'www.youtube.com':'youtube', 'tiktok.com':'tiktok', 'www.tiktok.com':'tiktok', 'instagram.com':'instagram', 'www.instagram.com':'instagram', 'facebook.com':'facebook_page', 'www.facebook.com':'facebook_page' });
const FB_NOT_PAGE = ['groups','watch','reel','share','events','marketplace'];
const IG_NOT_PROFILE = ['p','reel','reels','stories','explore'];
const JUNK_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','igsh','mibextid'];
let state;
let services;
let selected = new Set();
let pollTimer;
let openedItem = null;

function bindHandleNormalization(dialog) {
  dialog.querySelectorAll('[data-h-ref]').forEach((input) => input.addEventListener('change', () => {
    const result = normalizeHandle(input.value);
    input.value = result.ref;
    const platform = dialog.querySelector(`[data-h-platform="${input.dataset.hRef}"]`);
    if (platform && [...platform.options].some((option) => option.value === result.platform)) platform.value = result.platform;
    services.toast(result.hint, result.hint.includes('ไม่ใช่'));
  }));
}

function filterRoster(root, role = 'all') {
  const query = root.querySelector('#it-search').value.toLowerCase();
  root.querySelectorAll('[data-target-row]').forEach((row) => {
    const target = state.targets.find((item) => item.id === row.dataset.targetRow);
    const roleMatch = role === 'all' || target.role.includes(role) || (role === 'fired' && target.triggers.some((x) => x.fired_at)) || (role === 'due' && target.next_scout_at && new Date(target.next_scout_at) < new Date()) || (role === 'sug' && target.handle_suggestions?.length);
    const haystack = `${target.name} ${target.aliases.join(' ')} ${target.sells} ${target.icp} ${target.why_watch} ${target.handles.map((handle)=>handle.ref).join(' ')}`.toLowerCase();
    row.hidden = !roleMatch || !haystack.includes(query);
  });
}

function filterLibrary(root) {
  const platform = root.querySelector('#nr-platform').value;
  const kind = root.querySelector('#nr-kind').value;
  const query = root.querySelector('#nr-search').value.toLowerCase();
  const target = root.querySelector('#nr-target').value;
  root.querySelectorAll('[data-library-item]').forEach((card) => {
    card.hidden = (platform !== 'all' && card.dataset.platform !== platform) || (kind !== 'all' && card.dataset.kind !== kind) || (target !== 'all' && card.dataset.target !== target) || !card.textContent.toLowerCase().includes(query);
  });
  const gallery = root.querySelector('#it-gallery');
  const cards = [...gallery.querySelectorAll('[data-library-item]')];
  const sort = root.querySelector('#nr-sort').value;
  cards.sort((a,b)=>sort==='score' ? Number(b.dataset.score||0)-Number(a.dataset.score||0) : Number(b.dataset.time||0)-Number(a.dataset.time||0));
  cards.forEach((card)=>gallery.append(card));
}

function normalizeHandle(value) { try { const url=new URL(value); for(const key of JUNK_PARAMS)url.searchParams.delete(key);url.hash='';const platform=HOST_PLATFORM[url.hostname]||'web';const parts=url.pathname.split('/').filter(Boolean);const hint=platform==='facebook_page'&&FB_NOT_PAGE.includes(parts[0])?'Facebook link นี้ไม่ใช่เพจ':platform==='instagram'&&IG_NOT_PROFILE.includes(parts[0])?'Instagram link นี้ไม่ใช่โปรไฟล์':'normalize แล้ว';return {platform,ref:platform==='web'?`${url.origin}${url.pathname.replace(/\/$/,'')}`:parts[0]||url.origin,hint}; } catch { return {platform:value.startsWith('@')?'tiktok':'web',ref:value,hint:'กรอกเอง'}; } }

function daysAgo(value) { return value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : null; }
function initials(name) { return String(name).split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase(); }
function safeHref(value) {
  const input = String(value ?? '').trim();
  if (!input || /[\x00-\x1f\x7f]/.test(input)) return '#';
  try {
    const url = new URL(input, location.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '#';
    return escapeHtml(url.href);
  } catch { return '#'; }
}

function laneFor(platform) { return ['tiktok','youtube','instagram'].includes(platform) ? 'page' : platform === 'facebook_page' ? 'ads' : platform === 'web' ? 'web' : null; }
function targetLanes(target) { return [...new Set(target.handles.map((handle)=>laneFor(handle.platform)).filter(Boolean))]; }
function nextLabel(target,now=Date.now()) { if(!target.next_scout_at)return '';const delta=Math.ceil((new Date(target.next_scout_at).getTime()-now)/86400000);return delta<0?`เลยกำหนด ${Math.abs(delta)} วัน`:delta===0?'ถึงกำหนดวันนี้':`ถัดไปอีก ${delta} วัน`; }
function defaultTarget(targets){return targets.find((target)=>target.triggers.some((trigger)=>trigger.fired_at))||targets[0]||null;}
function renderTrigger(trigger,index){return `<div class="list-item"><strong>${trigger.fired_at?'⚠️':'○'} ${escapeHtml(trigger.text)}</strong><p class="help">เช็คคำ: ${(trigger.keywords||[]).map(escapeHtml).join(', ')||'—'}</p><p>${trigger.fired_at?`ดังเมื่อ ${new Date(trigger.fired_at).toLocaleDateString('th-TH')} · <button class="btn btn-quiet" data-ack="${index}" type="button">ปิดธง</button>`:'ยังไม่ดัง'}</p></div>`;}
function groupedRoster(targets){return THREAT_ORDER.map((threat)=>{const group=targets.filter((target)=>target.threat===threat);return group.length?`<li class="meta"><strong>${THREAT_GROUP[threat]} · ${group.length}</strong></li>${group.map(rosterRow).join('')}`:'';}).join('');}

function signalCards() {
  const recent = state.items.filter((x) => Date.now() - new Date(x.created_at).getTime() <= 604800000).length;
  const fired = state.targets.reduce((count, target) => count + target.triggers.filter((x) => x.fired_at).length, 0);
  const due = state.targets.filter((x) => x.next_scout_at && new Date(x.next_scout_at) < new Date()).length;
  const never = state.targets.filter((x) => !x.last_scouted_at).length;
  return [['มีรายงานใหม่ 7 วัน', recent], ['trigger ดัง', fired], ['เลยกำหนดสืบซ้ำ', due], ['ยังไม่เคยสืบ', never]].map(([label, count]) => `<div class="card ${count ? 'urgent-note' : ''}"><strong>${label}</strong><div class="stat">${count}</div></div>`).join('');
}

const DETECTED_SOURCE_LABEL = Object.freeze({
  clip: 'คลิปสาธารณะ', page: 'เพจหรือโปรไฟล์', ads: 'โฆษณา Meta', web: 'หน้าเว็บสาธารณะ', shot: 'ภาพใน workspace', paste: 'ข้อความหลักฐาน'
});

export function researchDialogMarkup({ targets = [], targetId = '', raw = '', note = '', error = '' } = {}) {
  const classification = raw ? classifyScoutInput(raw) : null;
  const validationError = error || (classification && !classification.ok ? classification.error : '');
  const detected = classification?.ok ? DETECTED_SOURCE_LABEL[classification.kind] || classification.kind : 'ระบบจะตรวจให้อัตโนมัติ';
  const invalidAttributes = validationError ? ' aria-invalid="true" aria-describedby="scout-input-error"' : '';
  return `<form id="scout-research-form" class="research-dialog" novalidate>
    <header><p class="eyebrow">Evidence intake</p><h2>สืบ URL / ไฟล์</h2><p class="help">วางแหล่งเดียว ระบบจะแยกประเภทและส่งเข้า queue ให้เอง</p></header>
    <label class="field">URL หรือ path ใน workspace<input name="raw" value="${escapeHtml(raw)}" required autocomplete="off"${invalidAttributes}></label>
    ${validationError ? `<p id="scout-input-error" role="alert" class="error-box">${escapeHtml(validationError)}</p>` : ''}
    <p class="detected-source" aria-live="polite">ตรวจพบ: <strong data-scout-detected>${escapeHtml(detected)}</strong></p>
    <label class="field">ต้องการดูอะไรเป็นพิเศษ<textarea name="note" maxlength="2000">${escapeHtml(note)}</textarea></label>
    <label class="field">เก็บเข้าแฟ้ม<select name="target_id"><option value="unassigned">ไม่ระบุแฟ้ม</option>${targets.map((target) => `<option value="${escapeHtml(target.id)}" ${target.id === targetId ? 'selected' : ''}>${escapeHtml(target.name)}</option>`).join('')}</select></label>
    <button class="btn btn-accent" type="submit">ส่งให้ Agent สืบ</button>
  </form>`;
}

function queueRows(jobs) {
  return jobs.map((job) => {
    const presentation = scoutJobPresentation(job);
    const nextAction = job.status === 'preflight_failed' && presentation.action
      ? `<div class="evidence-request"><strong>ทางต่อ</strong><p>${escapeHtml(presentation.action)}</p><button class="btn btn-outline" data-copy-next="${escapeHtml(job.id)}" type="button">คัดลอกทางต่อ</button></div>` : '';
    return `<li class="list-item queue-state" data-state="${escapeHtml(job.status)}"><div><span class="status-dot" data-tone="${escapeHtml(presentation.tone)}"></span><strong>${escapeHtml(presentation.title)}</strong><p>${escapeHtml(presentation.detail)}</p><p class="help">${escapeHtml(job.kind)} · ${escapeHtml(job.lane)} · ลองแล้ว ${escapeHtml(job.attempts)} ครั้ง</p></div>${nextAction}${job.error && job.status !== 'preflight_failed' ? `<details><summary>เหตุผลที่ล้ม</summary><p class="urgent-note">${escapeHtml(job.error).slice(0, 600)}</p></details>` : ''}<div class="form-actions"><button class="btn btn-outline" data-job-retry="${escapeHtml(job.id)}" data-retry="${escapeHtml(job.id)}" type="button">ลองใหม่</button><button class="btn btn-outline" data-agent-fix="${escapeHtml(job.id)}" data-fix="${escapeHtml(job.id)}" type="button">🛠 ส่งให้ Agent แก้</button><button class="btn btn-danger" data-job-delete="${escapeHtml(job.id)}" data-delete-job="${escapeHtml(job.id)}" type="button">ลบ</button>${job.item_id ? `<button class="btn btn-quiet" data-job-open="${escapeHtml(job.id)}" data-open="${escapeHtml(job.item_id)}" type="button">เปิด</button>` : ''}${job.kind === 'identity' && job.target_id ? `<button class="btn btn-quiet" data-job-goto="${escapeHtml(job.id)}" data-goto-target="${escapeHtml(job.target_id)}" type="button">เปิดแฟ้ม</button>` : ''}<button class="btn btn-quiet" data-job-show-found="${escapeHtml(job.id)}" data-show-found="${escapeHtml(job.id)}" type="button">ดูผลที่เจอ</button></div></li>`;
  }).join('') || '<li class="card">ยังไม่มีงานในคิว</li>';
}

function openResearchDialog(root, targetId = '') {
  const show = ({ raw = '', note = '', error = '' } = {}) => {
    services.showDialog(researchDialogMarkup({ targets: state.targets, targetId, raw, note, error }));
    const form = document.querySelector('#scout-research-form');
    const input = form.querySelector('[name="raw"]');
    const detected = form.querySelector('[data-scout-detected]');
    input.addEventListener('input', () => {
      const classification = classifyScoutInput(input.value);
      detected.textContent = classification.ok ? DETECTED_SOURCE_LABEL[classification.kind] || classification.kind : classification.error;
      input.setAttribute('aria-invalid', classification.ok ? 'false' : 'true');
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      try {
        const job = buildScoutJob({ raw: data.raw, note: data.note, targetId: data.target_id });
        await services.api('/api/newsroom_jobs', { method: 'POST', body: job });
        document.querySelector('#app-dialog').close();
        services.toast('เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI');
        await reload(root);
        switchTab('queue');
      } catch (submitError) {
        show({ raw: data.raw, note: data.note, error: submitError.message });
      }
    });
  };
  show();
}

function rosterRow(target) {
  const suggestionCount = target.handle_suggestions?.length || 0;
  const fired = target.triggers.filter((x) => x.fired_at).length;
  const seen = target.last_scouted_at ? `สืบล่าสุด ${daysAgo(target.last_scouted_at)} วันก่อน` : 'ยังไม่เคยสืบ';
  const lanes = targetLanes(target);
  return `<li class="list-item" data-target-row="${escapeHtml(target.id)}" data-id="${escapeHtml(target.id)}" tabindex="0"><div class="form-actions"><input type="checkbox" data-select-target="${escapeHtml(target.id)}" data-sel="${escapeHtml(target.id)}" aria-label="เลือกแฟ้ม ${escapeHtml(target.name)}" ${selected.has(target.id) ? 'checked' : ''} ${lanes.length?'':'disabled title="ไม่มี handle ให้สืบ"'}><span class="badge">${escapeHtml(initials(target.name))}</span><button class="btn btn-quiet" data-open-target="${escapeHtml(target.id)}" type="button"><strong>${escapeHtml(target.name)}</strong></button>${fired ? `<span class="badge">⚠️ ${fired}</span>` : ''}${suggestionCount ? `<span class="badge" title="มีช่องทางที่เจอเพิ่มรอรับ">🔗 ${suggestionCount}</span>` : ''}${!target.last_scouted_at ? '<span class="badge">ใหม่</span>' : ''}</div><p class="help">${seen}${nextLabel(target) ? ` · ${nextLabel(target)}` : ''}</p><button class="btn btn-outline" data-scout="${escapeHtml(target.id)}" type="button" ${lanes.length?'':'disabled title="ยังไม่มี handle ที่สืบได้ — กดแก้ไขแล้วเติมก่อน"'}>🕵️ สืบ</button></li>`;
}

function renderPage(root) {
  const visible = [...state.targets].sort((a, b) => THREAT_ORDER.indexOf(a.threat) - THREAT_ORDER.indexOf(b.threat));
  const activeJobs = state.jobs.filter((x) => ['queued', 'submitted', 'running'].includes(x.status)).length;
  root.innerHTML = `<header class="page-head intel-page-head"><div><p class="eyebrow">Intel Warroom</p><h1>แฟ้มเป้าหมายและหลักฐาน</h1><p class="help">จัดเป้าหมาย เก็บหลักฐาน และส่งสิ่งที่พบต่อเป็นงานเดียวกัน</p></div><div class="form-actions"><button id="nr-refresh" class="btn btn-outline" type="button">⟳ รีเฟรช</button><button id="nr-research-open" class="btn btn-accent" type="button">สืบ URL / ไฟล์</button><button id="it-scout-all" class="btn btn-outline" type="button">🕵️ สืบทั้งหมด</button><button id="it-discover-open" class="btn btn-outline" type="button">สืบคนใหม่</button></div></header>
  <nav class="form-actions"><button class="btn btn-quiet" data-it-tab="targets" type="button">🎯 เป้าหมาย <span id="it-count" class="badge">${state.targets.length}</span></button><button class="btn btn-quiet" data-it-tab="library" type="button">🗂 คลัง</button><button class="btn btn-quiet" data-it-tab="queue" type="button">⏳ คิว <span id="nr-queue-badge" class="badge">${activeJobs}</span></button></nav>
  <section id="nr-pane-targets" class="section-gap"><div id="it-signals" class="stats-grid evidence-tray">${signalCards()}</div><div id="it-wrap" class="layout-two intel-workbench section-gap"><aside id="it-roster" class="card"><div class="form-actions"><input id="it-search" aria-label="ค้นหาแฟ้ม" placeholder="ค้นหาแฟ้ม"><button id="it-sel-visible" class="btn btn-quiet" type="button">เลือกที่เห็นทั้งหมด</button><button id="it-sel-clear" class="btn btn-quiet" type="button">ล้าง</button></div><nav id="it-rolechips" class="form-actions" aria-label="กรองแฟ้ม">${[['all','ทั้งหมด'],['competitor','🎯 คู่แข่ง'],['benchmark','📹 benchmark'],['mentor','🧭 mentor'],['fired','⚠️ trigger ดัง'],['due','⏰ เลยกำหนด'],['sug','🔗 มีช่องทางใหม่']].map(([key,label]) => `<button class="btn btn-quiet" data-role="${key}" type="button">${label}</button>`).join('')}</nav><div id="it-selbar" class="today-strip"><span>${selected.size} แฟ้ม</span><button id="it-scout-sel" class="btn btn-accent" type="button">🕵️ สืบที่เลือก (${selected.size})</button></div><ul id="it-list" class="list">${groupedRoster(visible) || '<li class="list-item">ยังไม่มีแฟ้มเป้าหมาย</li>'}</ul></aside><section id="it-file" class="card dossier-panel"><p>เลือกแฟ้มเพื่อดูรายละเอียด</p></section></div><section id="it-group-progress" class="card section-gap" hidden>สถานะกลุ่ม</section><section id="it-runner" class="card section-gap" hidden><button id="it-back" class="btn btn-quiet" type="button">← รายชื่อ</button><h2>Runner</h2><label class="radio-card"><input type="checkbox" value="page" checked> page</label><label class="radio-card"><input type="checkbox" value="ads" checked> ads</label><label class="radio-card"><input type="checkbox" value="web" checked> web</label><button id="it-fire" class="btn btn-accent" data-run-lanes type="button">ยิงเข้าคิว</button><button id="it-cancel" class="btn btn-quiet" type="button">ยกเลิก</button><p>คำขอจะเก็บในคิวบนคลาวด์ ยังไม่ได้เชื่อมตัวประมวลผล AI</p></section></section>
  <section id="nr-pane-library" class="section-gap" hidden><div id="nr-platforms" class="form-actions"><select id="nr-platform"><option value="all">ทุกแพลตฟอร์ม</option>${Object.entries(NEWSROOM_PLATFORM_LABEL).map(([x,l]) => `<option value="${x}">${l}</option>`).join('')}</select><input id="nr-search" placeholder="ค้นหาคลัง"><select id="nr-target"><option value="all">ทุกแฟ้ม</option><option value="__none">ไม่ระบุแฟ้ม</option>${state.targets.map((target)=>`<option value="${escapeHtml(target.id)}">${escapeHtml(target.name)}</option>`).join('')}</select><select id="nr-kind"><option value="all">ทุกชนิด</option>${Object.entries(KIND_LABEL).map(([x,l])=>`<option value="${x}">${l}</option>`).join('')}</select><select id="nr-sort"><option value="newest">ใหม่สุด</option><option value="score">คะแนนสูงสุด</option></select></div><div id="it-gallery" class="workbench-grid section-gap">${state.items.map((item) => `<button class="card" data-library-item="${escapeHtml(item.id)}" data-open="${escapeHtml(item.id)}" data-platform="${escapeHtml(item.platform)}" data-kind="${escapeHtml(item.kind)}" data-target="${escapeHtml(item.target_id || '__none')}" data-score="${escapeHtml(item.score||0)}" data-time="${new Date(item.created_at).getTime()}" type="button">${item.cover_path ? `<img src="/files/${escapeHtml(item.cover_path)}" alt="หน้าปก ${escapeHtml(item.title)}">` : `<div class="today-strip">[ ${escapeHtml(item.platform)} / ${escapeHtml(item.kind)} ]</div>`}<strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary)}</p></button>`).join('') || '<p>คลังยังว่าง</p>'}</div><dialog id="nr-modal" aria-label="รายละเอียดหลักฐาน"></dialog></section>
  <section id="nr-pane-submit" class="section-gap" hidden><div class="queue-heading"><div><p class="eyebrow">Agent handoff</p><h2>Queue</h2></div><button class="btn btn-accent" data-open-research type="button">สืบ URL / ไฟล์</button></div><ul id="nr-queue" class="list">${queueRows(state.jobs)}</ul></section>
  <dialog id="it-edit" aria-label="แก้ไขแฟ้มเป้าหมาย"></dialog><dialog id="it-discover" aria-label="สืบเป้าหมายใหม่"></dialog><dialog id="agent-fix-dialog" aria-label="ส่งงานให้ Agent แก้"></dialog>`;
  bind(root);
  const hash = location.hash.slice(1); if (hash === 'library' || hash === 'submit') switchTab(hash === 'submit' ? 'queue' : hash);
  const requested = new URLSearchParams(location.search).get('target');
  const automatic = defaultTarget(state.targets);
  if (requested || automatic) openTarget(requested || automatic.id, root);
}

async function reload(root) {
  const [targets, snapshots, items, jobs, requests, scripts] = await Promise.all(['intel_targets','intel_snapshots','newsroom_items','newsroom_jobs','agent_requests','intel_scripts'].map((x) => services.api(`/api/${x}`)));
  state = { targets: targets.items, snapshots: snapshots.items, items: items.items, jobs: jobs.items, requests: requests.items, scripts: scripts.items }; renderPage(root);
}

function switchTab(key) { const panes={targets:'#nr-pane-targets',library:'#nr-pane-library',queue:'#nr-pane-submit'};for(const [name,selector] of Object.entries(panes))document.querySelector(selector).hidden=name!==key; }

function openTarget(id, root) {
  const target = state.targets.find((x) => x.id === id); if (!target) return;
  const reports = state.items.filter((x) => x.target_id === id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); const file = root.querySelector('#it-file');
  file.innerHTML = `<div class="today-strip"><div><span class="badge">${escapeHtml(initials(target.name))}</span><h2>${escapeHtml(target.name)}</h2><p>${target.role.map((x) => `<span class="badge">${escapeHtml(ROLE_LABEL[x] || x)}</span>`).join(' ')} · ${escapeHtml(THREAT_LABEL[target.threat] || target.threat)}</p></div><div class="form-actions"><button data-research-target="${escapeHtml(target.id)}" class="btn btn-accent" type="button">+ สืบคอนเทนต์รายชิ้น</button><button id="it-scout-now" class="btn btn-outline" type="button" ${targetLanes(target).length?'':'disabled title="ยังไม่มี handle ที่สืบได้ — กดแก้ไขแล้วเติมก่อน"'}>🕵️ สืบตอนนี้</button><button id="it-edit-open" class="btn btn-quiet" type="button">แก้ไข</button><a class="btn btn-quiet" href="${safeHref(target.deep_dive)}">wiki ↗</a></div></div><p><strong>ชื่อเรียกอื่น:</strong> ${escapeHtml(target.aliases.join(' · ') || '—')}</p><p><strong>Reach:</strong> ${escapeHtml(target.reach)} · <strong>ขายอะไร + ราคา:</strong> ${escapeHtml(target.sells)} · <strong>ICP:</strong> ${escapeHtml(target.icp)}</p><p><strong>ทำไมต้องจับตา:</strong> ${escapeHtml(target.why_watch)}</p><h3>Handles</h3><div class="form-actions">${target.handles.map((h) => `<a class="badge" data-h="${escapeHtml(h.platform)}" href="${h.platform === 'web' ? safeHref(h.ref) : '#'}">${h.platform === 'instagram' ? '🔒 ' : ''}${escapeHtml(PLATFORM_LABEL[h.platform] || h.platform)}: ${escapeHtml(h.ref)}</a>`).join('')}</div>
  ${(target.handle_suggestions || []).length ? `<section class="error-box"><h3>🔗 ช่องทางที่เจอเพิ่ม — รับเข้าแฟ้มไหม</h3><p>agent ไล่หาจากผลค้นเว็บแล้วตรวจของจริงให้ · ✅ = เปิดได้จริง · ⚠️ เพจ FB ระบบไม่แตะ Meta เอง ยืนยันด้วยตาก่อนรับ</p>${target.handle_suggestions.map((s,index) => `<div class="list-item">${s.verified ? '✅' : s.platform === 'facebook_page' ? '⚠️' : '❔'} <strong>${escapeHtml(PLATFORM_LABEL[s.platform] || s.platform)}</strong> <a href="${safeHref(s.url)}">${escapeHtml(s.ref)} ↗</a> <span class="badge">${escapeHtml(s.confidence)}</span> ${escapeHtml(s.note || '')}<button class="btn btn-accent" data-accept-sug="${index}" type="button">รับ</button><button class="btn btn-quiet" data-dismiss-sug="${index}" type="button">ปัด</button></div>`).join('')}</section>` : ''}
  <h3>Trigger — ถ้าเขาทำแบบนี้ ต้องขยับ</h3>${target.triggers.map(renderTrigger).join('') || '<p>—</p>'}<section id="it-trend"><h3>Trend (Δ% ต่อเลน)</h3><p>page — · ads — · web — · รอบแรก</p></section><h3>เส้นเวลา — รอบล่าสุด</h3><ul class="list">${reports.slice(0,5).map((item) => `<li class="list-item">${escapeHtml(item.title)} · ${new Date(item.created_at).toLocaleDateString('th-TH')} · ${escapeHtml(item.platform)} · ${escapeHtml(item.score)}/10</li>`).join('') || '<li>—</li>'}</ul><h3>คอนเทนต์ที่สืบมาแล้ว</h3><div class="form-actions"><button class="btn btn-quiet" data-gkind="all" type="button">ทั้งหมด ${reports.length}</button>${[...new Set(reports.map((item)=>item.kind))].map((kind)=>`<button class="btn btn-quiet" data-gkind="${kind}" type="button">${KIND_LABEL[kind] || kind}</button>`).join('')}</div><div data-target-gallery>${reports.slice(0,40).map((x) => `<span class="badge" data-gallery-kind="${x.kind}">${KIND_LABEL[x.kind] || x.kind}</span>`).join(' ')}</div>`;
  file.querySelector('[data-research-target]').addEventListener('click', () => openResearchDialog(root, target.id)); file.querySelector('#it-scout-now').addEventListener('click', () => openRunner(target)); file.querySelector('#it-edit-open').addEventListener('click', () => openEdit(target, root));
  file.querySelectorAll('[data-accept-sug]').forEach((node) => node.addEventListener('click', () => suggestion(target, Number(node.dataset.acceptSug), true, root)));
  file.querySelectorAll('[data-dismiss-sug]').forEach((node) => node.addEventListener('click', () => suggestion(target, Number(node.dataset.dismissSug), false, root)));
  file.querySelectorAll('[data-ack]').forEach((node) => node.addEventListener('click', async () => { const triggers = structuredClone(target.triggers); triggers[Number(node.dataset.ack)].fired_at = null; await services.api(`/api/intel_targets/${target.id}`, { method: 'PATCH', body: { triggers } }); await reload(root); openTarget(target.id, root); }));
  file.querySelectorAll('[data-gkind]').forEach((node)=>node.addEventListener('click',()=>file.querySelectorAll('[data-gallery-kind]').forEach((item)=>{item.hidden=node.dataset.gkind!=='all'&&item.dataset.galleryKind!==node.dataset.gkind;})));
}

function openRunner(target) { const runner = document.querySelector('#it-runner'); const lanes=targetLanes(target);runner.querySelectorAll('input').forEach((input)=>{input.checked=lanes.includes(input.value);input.disabled=!lanes.includes(input.value);});runner.hidden = false; runner.dataset.target = target.id; runner.scrollIntoView({ behavior: 'smooth' }); }

async function queueScout(ids, lanes = null) {
  const batch = uid('BATCH'); const now = new Date().toISOString();
  let count = 0;
  for (const targetId of ids) { const target=state.targets.find((item)=>item.id===targetId);const targetLaneList=lanes||targetLanes(target);for (const lane of targetLaneList) { await services.api('/api/newsroom_jobs', { method: 'POST', body: { id: uid('NJ'), kind: lane, target: targetId, note: '', status: 'queued', scout_job_id: null, item_id: null, error: null, created_at: now, updated_at: now, target_id: targetId, batch_id: batch, lane, result: {}, attempts: 0 } }); count+=1; } }
  services.toast(`เก็บ ${count} งานในคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI`);
}

async function suggestion(target, index, accept, root) { const suggestions = structuredClone(target.handle_suggestions || []); const [item] = suggestions.splice(index, 1); const handles = accept && !target.handles.some((h) => h.platform === item.platform && h.ref === item.ref) ? [...target.handles, { platform: item.platform, ref: item.ref, note: item.note || '' }] : target.handles; await services.api(`/api/intel_targets/${target.id}`, { method: 'PATCH', body: { handles, handle_suggestions: suggestions, handles_enriched_at: new Date().toISOString() } }); services.toast(accept ? 'รับช่องทางเข้าแฟ้มแล้ว' : 'ปัดช่องทางแล้ว'); await reload(root); openTarget(target.id, root); }

function openEdit(target, root) {
  const dialog = document.querySelector('#it-edit');
  if (dialog.open) dialog.close();
  const triggerLines = target.triggers.map((trigger) => `${trigger.text} | ${(trigger.keywords || []).join(', ')}`).join('\n');
  dialog.innerHTML = `<form id="it-edit-form" class="dialog-body"><h2>แก้ไขแฟ้ม</h2><div class="form-grid"><label class="field">ชื่อ<input name="name" value="${escapeHtml(target.name)}" required></label><label class="field">ชื่อเรียกอื่น (คั่นด้วย ·)<input name="aliases" value="${escapeHtml(target.aliases.join(' · '))}"></label><label class="field">ระดับภัย<select name="threat">${THREAT_ORDER.map((value) => `<option value="${value}" ${value===target.threat?'selected':''}>${{red:'🔴 หัวชนกัน',orange:'🟠 ใกล้ · สูง',yellow:'🟡 บางส่วน · เฝ้าดู',green:'🟢 ต่ำ',na:'⚪ บริบท'}[value]}</option>`).join('')}</select></label><label class="field">สืบซ้ำทุก (วัน)<input name="cadence_days" type="number" min="1" value="${escapeHtml(target.cadence_days)}"></label></div><fieldset class="field"><legend>บทบาท</legend><div class="form-actions">${Object.entries(ROLE_LABEL).map(([value,label])=>`<label><input type="checkbox" name="role" value="${value}" ${target.role.includes(value)?'checked':''}> ${label}</label>`).join('')}</div></fieldset><h3>ช่องทาง</h3><div id="it-handle-editor">${target.handles.map((handle,index) => `<div class="form-actions"><select data-h-platform="${index}">${Object.entries(PLATFORM_LABEL).map(([value,label]) => `<option value="${value}" ${value===handle.platform?'selected':''}>${label}</option>`).join('')}</select><input data-h-ref="${index}" value="${escapeHtml(handle.ref)}" placeholder="วางลิงก์ที่ก๊อปมา หรือพิมพ์ @handle"><button class="btn btn-danger" data-h-del="${index}" data-h="del" type="button">✕</button></div>`).join('')}</div><button id="it-handle-add" class="btn btn-outline" type="button">+ เพิ่มช่องทาง</button><p class="help">ระบบ normalize บน change/paste · ลิงก์ที่ไม่มีชื่อเพจ/โปรไฟล์จะเตือนให้ตรวจ</p><label class="field">ขายอะไร + ราคา<textarea name="sells">${escapeHtml(target.sells)}</textarea></label><label class="field">ICP<textarea name="icp">${escapeHtml(target.icp)}</textarea></label><label class="field">ทำไมต้องจับตา<textarea name="why_watch">${escapeHtml(target.why_watch)}</textarea></label><label class="field">Trigger<textarea name="triggers" class="field-full">${escapeHtml(triggerLines)}</textarea><small>ถ้าเขาทำ… | คำที่เช็ค, คั่นด้วยจุลภาค</small></label><div class="form-actions"><button class="btn btn-accent" type="submit">บันทึก</button><button id="it-edit-delete" class="btn btn-danger" type="button">ลบแฟ้ม</button><button class="btn btn-quiet" data-close-edit type="button">ยกเลิก</button></div></form>`;
  dialog.showModal();
  const handles = structuredClone(target.handles);
  dialog.querySelector('#it-handle-add').addEventListener('click', () => { handles.push({ platform: 'tiktok', ref: '' }); openEdit({ ...target, handles }, root); });
  dialog.querySelectorAll('[data-h-del]').forEach((node) => node.addEventListener('click', () => { handles.splice(Number(node.dataset.hDel), 1); openEdit({ ...target, handles }, root); }));
  bindHandleNormalization(dialog);
  dialog.querySelector('#it-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const nextHandles = [...dialog.querySelectorAll('[data-h-platform]')].map((node,index) => ({ platform: node.value, ref: dialog.querySelector(`[data-h-ref="${index}"]`).value })).filter((item) => item.ref);
    const triggers = String(data.get('triggers')).split('\n').map((line)=>line.trim()).filter(Boolean).map((line,index)=>{const [text,words='']=line.split('|');const previous=target.triggers[index]||{};return { text:text.trim(), keywords:words.split(',').map((word)=>word.trim()).filter(Boolean), escalate_to:previous.escalate_to||'review', fired_at:previous.fired_at||null, fired_by_item:previous.fired_by_item||null };});
    await services.api(`/api/intel_targets/${target.id}`, { method: 'PATCH', body: { name: data.get('name'), aliases: String(data.get('aliases')).split('·').map((value)=>value.trim()).filter(Boolean), threat: data.get('threat'), role: data.getAll('role'), cadence_days: Number(data.get('cadence_days')), sells: data.get('sells'), icp: data.get('icp'), why_watch: data.get('why_watch'), triggers, handles: nextHandles, updated_at: new Date().toISOString() } });
    services.toast('บันทึกแล้ว — ไฟล์ในเครื่องอัปเดตแล้ว');
    dialog.close(); await reload(root); openTarget(target.id, root);
  });
  dialog.querySelector('#it-edit-delete').addEventListener('click', async () => { if (confirm(`ลบแฟ้ม "${target.name}" ออกจาก watchlist? รายงานในคลังยังอยู่ แค่หลุดจากแฟ้ม`)) { await services.api(`/api/intel_targets/${target.id}`, { method: 'DELETE' }); services.toast('ลบแฟ้มแล้ว'); dialog.close(); await reload(root); } });
  dialog.querySelector('[data-close-edit]').addEventListener('click', () => dialog.close());
}

function openDiscover(root) {
  const dialog = document.querySelector('#it-discover');
  dialog.innerHTML = `<div class="dialog-body"><h2>สืบคนใหม่</h2><label class="field">ชื่อหรือ URL<input id="it-dq" placeholder="เช่น บริษัทคู่แข่ง · @handle · ลิงก์สาธารณะ"></label><button id="it-dgo" class="btn btn-accent" type="button">ค้นหาตัวตน</button><p id="it-dstat">รอคำค้น</p><div id="it-dfound"></div><button id="it-dadd" class="btn btn-outline" type="button">เพิ่มเข้า watchlist + สืบรอบแรก</button><button id="it-dclose" class="btn btn-quiet" type="button">ปิด</button></div>`;
  dialog.showModal(); dialog.querySelector('#it-dq').focus();
  const discover = async () => {
    const query = dialog.querySelector('#it-dq').value.trim();
    if (!query) { dialog.querySelector('#it-dstat').textContent = 'กรอกชื่อก่อน'; return; }
    const now = new Date().toISOString();
    await services.api('/api/newsroom_jobs', { method:'POST', body:{ id:uid('NJ'), kind:'identity', target:query, note:'สืบคนใหม่', status:'queued', created_at:now, updated_at:now, target_id:'unassigned', lane:'web', result:{}, attempts:0 } });
    dialog.querySelector('#it-dstat').textContent = 'ส่งให้ AI แล้ว — TikTok/YouTube ~30 วิ · เว็บ ~1–2 นาที';
    dialog.querySelector('#it-dfound').innerHTML = `<label class="radio-card"><input type="checkbox" checked> ${escapeHtml(query)} · web</label>`;
  };
  dialog.querySelector('#it-dgo').addEventListener('click', discover);
  dialog.querySelector('#it-dq').addEventListener('keydown', (event)=>{if(event.key==='Enter'){event.preventDefault();discover();}});
  dialog.querySelector('#it-dadd').addEventListener('click', async () => { const name = dialog.querySelector('#it-dq').value.trim(); if (!name) return; const now = new Date().toISOString(); const id = uid('TGT'); await services.api('/api/intel_targets', { method: 'POST', body: { id, slug: name.toLowerCase().replace(/[^a-z0-9]+/g,'-') || id.toLowerCase(), name, aliases: [], role: ['competitor'], threat: 'yellow', section: 'competitor', handles: [], handle_suggestions: [], handles_enriched_at: null, reach: 'unknown', sells: 'unknown', icp: 'unknown', why_watch: `เพิ่มจาก "สืบคนใหม่" — รอรายงานรอบแรกแล้วค่อยเขียนเหตุผล`, triggers: [], deep_dive: '', cadence_days: 30, last_scouted_at: null, next_scout_at: now, avatar_path: null, created_at: now, updated_at: now } }); await queueScout([id], ['web']); services.toast('เพิ่มเข้า watchlist แล้ว — เริ่มสืบรอบแรก'); dialog.close(); await reload(root); });
  dialog.querySelector('#it-dclose').addEventListener('click', () => dialog.close());
}

// ---------- การ์ดในคลัง: แก้ชื่อ + เกลาเป็นบทของเรา ----------
const RESCOUT_NOTE = 'intel:rescout แกะใหม่เพื่อเอาบทพูดไปเกลาเป็นบทของเรา';
function fmtWhen(value) { return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); }
function itemScripts(itemId) { return state.scripts.filter((x) => x.item_id === itemId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); }

function itemTitleView(title) {
  return `<div id="nr-title-wrap" class="form-actions"><h2>${escapeHtml(title || 'ยังไม่มีหัวข้อ')}</h2><button class="btn btn-quiet" data-edit-title type="button" aria-label="แก้ชื่อหัวข้อ" title="แก้ชื่อหัวข้อ">✏️</button></div>`;
}
function itemTitleEditor(title) {
  return `<div id="nr-title-wrap" class="form-actions"><input id="nr-title-input" value="${escapeHtml(title || '')}" maxlength="200" aria-label="ชื่อหัวข้อการ์ด" placeholder="พิมพ์หัวข้อใหม่"><button class="btn btn-accent" data-save-title type="button">บันทึก</button><button class="btn btn-quiet" data-cancel-title type="button">ยกเลิก</button></div>`;
}

function mmss(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
const SCAFFOLD_MARK = 'ยังเป็นโครงเปล่า';
function rewriteJobsOf(itemId) { return (state.rwJobs || []).filter((job) => job.job_type === 'rewrite_reel' && job.payload?.item_id === itemId); }
// บรรทัดสถานะใต้หัวข้อ — ตอบว่าสถานะบทที่บันทึกไว้ (รอคิว · กำลังทำ · ส่งเข้า Content Center แล้ว · พัง) ไม่ใช่ spinner ค้าง
function rewriteStatus(item) {
  const jobs = rewriteJobsOf(item.id);
  const now = Date.now();
  const running = jobs.find((job) => job.status === 'running') || jobs.find((job) => job.status === 'queued');
  if (running) return running.status === 'running' ? `⏳ สถานะที่บันทึกไว้: กำลังทำ · ${mmss(now - new Date(running.started_at || running.created_at).getTime())} นาที — ยังไม่ได้เชื่อมตัวประมวลผล AI บนคลาวด์` : `⏳ เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI · ส่งเมื่อ ${mmss(now - new Date(running.created_at).getTime())} นาทีที่แล้ว`;
  const scaffold = itemScripts(item.id).find((script) => !script.content_id && String(script.script_md || '').includes(SCAFFOLD_MARK));
  if (scaffold) return `✍️ มีร่างบท "${scaffold.title}" บันทึกไว้ — ยังไม่ได้เชื่อมตัวประมวลผล AI บนคลาวด์`;
  const broken = jobs.filter((job) => job.status === 'error').sort((a, b) => String(b.finished_at || '').localeCompare(String(a.finished_at || '')))[0];
  if (broken) return `❌ งานเกลาล่าสุดพัง: ${broken.error || 'ไม่ระบุ'} — ดูที่ Content Center แท็บ ⏳ คิว แล้วลองใหม่`;
  const failedHandoff = jobs.find((job) => job.status === 'done' && job.result?.handoff_error && !job.result?.content_id);
  if (failedHandoff) return `⚠️ บทเสร็จแล้วแต่ส่งเข้า Content Center ไม่ผ่าน (${failedHandoff.result.handoff_error}) — กด ⬆️ ส่งเองได้`;
  return '';
}
// เปรียบเทียบเวอร์ชันระหว่างรอบ poll — บทถูกเขียนจริง / ส่งเข้า Content Center แล้ว = ต้องบอกผู้ใช้ทันที
function scriptSignature(scripts) { return scripts.map((script) => `${script.id}|${script.content_id || ''}|${String(script.script_md || '').includes(SCAFFOLD_MARK) ? 'S' : 'W'}`).join(','); }
function announceScriptChanges(before, after) {
  const prev = new Map(before.map((script) => [script.id, script]));
  for (const script of after) {
    const old = prev.get(script.id); if (!old) continue;
    const wasScaffold = String(old.script_md || '').includes(SCAFFOLD_MARK); const isScaffold = String(script.script_md || '').includes(SCAFFOLD_MARK);
    if (!old.content_id && script.content_id) { services.toast(`เกลาเสร็จ ✨ ส่งเข้า Content Center แล้ว — ${script.content_id}-RL`); continue; }
    if (wasScaffold && !isScaffold && !script.content_id) {
      const job = (state.rwJobs || []).find((entry) => entry.id === script.job_id);
      services.toast(`เกลาเสร็จแล้ว ✨ เวอร์ชันใหม่อยู่บนการ์ด${job?.result?.handoff_error ? ' (ส่งเข้า Content Center ไม่ผ่าน กด ⬆️ ส่งเองได้)' : ''}`);
    }
  }
}

function scriptList(scripts) {
  if (!scripts.length) return '<p class="help">ยังไม่มีเวอร์ชัน — กด "+ เกลาใหม่" แล้วบอกธงที่อยากเล่า</p>';
  return scripts.map((script, index) => `<details class="list-item" ${index === 0 ? 'open' : ''}><summary><strong>${escapeHtml(script.title)}</strong> ${script.content_id ? `<span class="badge">${escapeHtml(script.content_id)}</span>` : ''} <span class="help">${escapeHtml(fmtWhen(script.created_at))} · ${escapeHtml(briefLine(script.brief))}</span></summary><pre>${escapeHtml(script.script_md)}</pre><div class="form-actions"><button class="btn btn-outline" data-script-copy="${escapeHtml(script.id)}" type="button">📋 คัดลอกบท</button>${script.content_id ? `<a class="btn btn-quiet" href="/content">✅ อยู่ใน Content Center แล้ว (${escapeHtml(script.content_id)}) ↗</a>` : `<button class="btn btn-accent" data-script-handoff="${escapeHtml(script.id)}" type="button">⬆️ ส่งเข้า Content Center</button>`}<button class="btn btn-danger" data-script-delete="${escapeHtml(script.id)}" type="button">ลบเวอร์ชัน</button></div></details>`).join('');
}

function rewriteSection(item) {
  const ready = hasTranscript(item.report_md);
  const hint = suggestedTheme(item.report_md);
  const option = (map, selected) => Object.entries(map).map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  const body = ready
    ? `<form id="nr-rw-form" class="form-grid section-gap" hidden>
        <label class="field field-full"><span>ธง / หัวข้อคลิปของเรา <b class="urgent-note">*</b></span><textarea id="nr-rw-theme" rows="2" maxlength="600" placeholder="เช่น เป็นเซลล์แล้วทำคอนเทนต์บอกราคา ผิดไหม"></textarea></label>
        ${hint ? `<p class="help field-full">💡 รายงาน scout เสนอไว้: "${escapeHtml(hint)}" <button class="btn btn-quiet" data-use-hint type="button">ใช้อันนี้</button></p>` : ''}
        <label class="field">หมวด Content Mix<select id="nr-rw-pillar"><option value="">— ไม่ระบุ —</option>${option(PILLAR_LABEL, '')}</select></label>
        <label class="field">สไตล์ hook<select id="nr-rw-hook">${option(HOOK_STYLE_LABEL, 'auto')}</select></label>
        <label class="field">ความยาว<select id="nr-rw-len">${option(LENGTH_LABEL, 'mid')}</select></label>
        <label class="field">คีย์เวิร์ด DM (CTA)<input id="nr-rw-cta" value="AI" maxlength="40"></label>
        <label class="field field-full">โน้ตเพิ่ม (ถ้ามี)<input id="nr-rw-notes" maxlength="1000" placeholder="เช่น เคสจริงที่อยากให้ใส่ · มุมที่ไม่อยากแตะ"></label>
        <div class="form-actions field-full"><button class="btn btn-accent" data-rewrite-submit type="submit">🚀 ส่งเข้าคิว</button><button class="btn btn-quiet" data-rewrite-cancel type="button">ยกเลิก</button><span class="help">คำขอจะเก็บในคิวบนคลาวด์ ยังไม่ได้เชื่อมตัวประมวลผล AI</span></div>
      </form>`
    : `<div class="error-box section-gap"><p>การ์ดนี้ยังไม่มีบทพูดถอดเสียง (บรรทัด <code>[m:ss] …</code> ในรายงาน) — ต้องเห็นบทพูดจริงถึงจะยืมโครงมาเกลาได้</p>${/^https?:\/\//.test(item.source_url || '') ? `<button class="btn btn-outline" data-rescout="${safeHref(item.source_url)}" type="button">🔁 แกะใหม่ให้มีบทพูด</button><span class="help">คำขอจะเก็บในคิวบนคลาวด์ ยังไม่ได้เชื่อมตัวประมวลผล AI</span>` : '<p class="help">ไม่มีลิงก์ต้นฉบับให้แกะใหม่</p>'}</div>`;
  return `<section id="nr-rewrite" class="card section-gap"><div class="form-actions"><h3>✍️ บทเวอร์ชันของเรา <span id="nr-rw-count" class="badge">${itemScripts(item.id).length}</span></h3>${ready ? '<button class="btn btn-outline" data-rewrite-open type="button">+ เกลาใหม่</button>' : ''}</div><p class="help">ยืม "โครง" ของคลิปนี้มาเขียนเป็นบทของเราตามธงที่เลือก — ห้ามลอกคำ · ออก 3 ชั้น (บทพูด · 🔤 Hook Text · 📝 Caption) · คำขอจะเก็บในคิวบนคลาวด์ ยังไม่ได้เชื่อมตัวประมวลผล AI</p><p id="nr-rw-status" class="help">${escapeHtml(rewriteStatus(item))}</p>${body}<div id="nr-scripts" class="section-gap">${scriptList(itemScripts(item.id))}</div></section>`;
}

function openLibraryItem(id, root) {
  const item = state.items.find((x) => x.id === id); if (!item) return;
  const dialog = root.querySelector('#nr-modal');
  const source = /^https?:\/\//.test(item.source_url || '') ? `<a href="${safeHref(item.source_url)}" target="_blank" rel="noopener">เปิดต้นฉบับ ↗</a>` : '';
  dialog.innerHTML = `<div class="dialog-body">${item.cover_path ? `<img src="/files/${escapeHtml(item.cover_path)}" alt="cover">` : ''}<p><span class="badge">${escapeHtml(NEWSROOM_PLATFORM_LABEL[item.platform] || item.platform)}</span> <span class="badge">${escapeHtml(KIND_LABEL[item.kind] || item.kind)}</span></p>${itemTitleView(item.title)}<p>${escapeHtml(item.summary || 'ไม่มีสรุป')}</p>${source}${item.kind === 'clip' ? rewriteSection(item) : ''}<pre>${escapeHtml(item.report_md || 'ยังไม่มีรายงาน')}</pre>${item.report_path ? `<button class="btn btn-outline" data-copy="${escapeHtml(item.report_path)}" type="button">คัดลอก path รายงาน</button>` : ''}<button class="btn btn-danger" data-delete-library="${escapeHtml(item.id)}" data-delete-item="${escapeHtml(item.id)}" type="button">ลบออกจากคลัง</button><button class="btn btn-quiet" data-close-library type="button">ปิด</button></div>`;
  openedItem = item;
  dialog.showModal();
  bindLibraryDialog(dialog, root);
}

function refreshScripts(item, dialog) {
  const box = dialog.querySelector('#nr-scripts'); if (!box) return;
  const scripts = itemScripts(item.id);
  box.innerHTML = scriptList(scripts);
  const count = dialog.querySelector('#nr-rw-count'); if (count) count.textContent = scripts.length;
}

// ส่งเข้า Content Center: idea (ธง = canonical angle) + variant RL ที่มีบทอยู่ในช่อง AI ของ Script Studio
async function handoffScript(script, item) {
  const ideas = (await services.api('/api/content_items')).items;
  const idea = ideaRecord(nextContentId(ideas), script.title.slice(0, 200), {
    canonical_angle: script.brief?.theme || '', pillar_bucket: script.brief?.pillar || 'ai_in_business',
    source_type: 'transcript', source_ref: `intel:${script.item_id}${item?.source_url ? ` ${item.source_url}` : ''}`
  });
  await services.api('/api/content_items', { method: 'POST', body: idea });
  await services.api('/api/content_variants', { method: 'POST', body: variantRecord(idea, 'RL', { ai_result: script.script_md, variant_status: 'ai_improved', cta_keyword: script.brief?.cta_keyword || '' }) });
  await services.api(`/api/content_items/${idea.content_id}`, { method: 'PATCH', body: { idea_status: 'active' } });
  await services.api(`/api/intel_scripts/${script.id}`, { method: 'PATCH', body: { content_id: idea.content_id } });
  script.content_id = idea.content_id;
  return idea.content_id;
}

async function queueRewrite(item, dialog) {
  const value = (id) => dialog.querySelector(id)?.value ?? '';
  const checked = validateBrief({
    theme: value('#nr-rw-theme'), pillar: value('#nr-rw-pillar'), hook_style: value('#nr-rw-hook'),
    length: value('#nr-rw-len'), cta_keyword: value('#nr-rw-cta'), notes: value('#nr-rw-notes')
  });
  if (!checked.ok) { services.toast(checked.error, true); dialog.querySelector('#nr-rw-theme')?.focus(); return; }
  const button = dialog.querySelector('[data-rewrite-submit]');
  if (button) button.disabled = true;
  try {
    await services.api('/api/wr_jobs', { method: 'POST', body: { id: uid('JOB'), job_type: 'rewrite_reel', payload: { item_id: item.id, ...checked.brief }, status: 'queued', result: {}, error: null, created_at: new Date().toISOString(), started_at: null, finished_at: null } });
    dialog.querySelector('#nr-rw-form').hidden = true;
    services.toast('เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI');
    state.jobs = (await services.api('/api/newsroom_jobs')).items;
    state.rwJobs = (await services.api('/api/wr_jobs').catch(() => ({ items: state.rwJobs || [] }))).items;
    const status = dialog.querySelector('#nr-rw-status'); if (status) status.textContent = rewriteStatus(item);
  } catch (error) { services.toast(`ส่งเข้าคิวไม่สำเร็จ: ${error.message}`, true); }
  finally { if (button) button.disabled = false; }
}

function bindLibraryDialog(dialog, root) {
  if (dialog.dataset.bound === 'yes') return;   // dialog ตัวเดิมถูกเปิดซ้ำได้หลายการ์ด — ผูก listener ครั้งเดียวต่อการ render
  dialog.dataset.bound = 'yes';
  const swapTitle = (html) => { dialog.querySelector('#nr-title-wrap').outerHTML = html; };
  const saveTitle = async () => {
    const input = dialog.querySelector('#nr-title-input'); if (!input || !openedItem) return;
    const title = input.value.trim();
    if (!title) { services.toast('หัวข้อว่างไม่ได้ครับ', true); return; }
    if (title === (openedItem.title || '')) { swapTitle(itemTitleView(openedItem.title)); return; }
    input.disabled = true;
    try {
      await services.api(`/api/newsroom_items/${openedItem.id}`, { method: 'PATCH', body: { title } });
      openedItem.title = title; swapTitle(itemTitleView(title)); services.toast('บันทึกหัวข้อแล้ว');
      root.querySelectorAll(`[data-library-item="${openedItem.id}"] strong`).forEach((node) => { node.textContent = title; });
    } catch (error) { input.disabled = false; services.toast(`บันทึกหัวข้อไม่สำเร็จ: ${error.message}`, true); }
  };
  dialog.addEventListener('keydown', (event) => {
    if (event.target?.id !== 'nr-title-input' || !openedItem) return;
    if (event.key === 'Enter') { event.preventDefault(); saveTitle(); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); swapTitle(itemTitleView(openedItem.title)); }
  });
  dialog.addEventListener('submit', (event) => { if (event.target.id === 'nr-rw-form') { event.preventDefault(); queueRewrite(openedItem, dialog); } });
  dialog.addEventListener('click', async (event) => {
    const target = event.target.closest('button, a'); if (!target || !openedItem) return;
    const item = openedItem;
    const dataset = target.dataset;
    if (dataset.copy !== undefined) { await copyText(dataset.copy); services.toast('คัดลอกแล้ว'); return; }
    if (dataset.closeLibrary !== undefined) { dialog.close(); return; }
    if (dataset.editTitle !== undefined) { swapTitle(itemTitleEditor(item.title)); const input = dialog.querySelector('#nr-title-input'); input.focus(); input.select(); return; }
    if (dataset.saveTitle !== undefined) { await saveTitle(); return; }
    if (dataset.cancelTitle !== undefined) { swapTitle(itemTitleView(item.title)); return; }
    if (dataset.rewriteOpen !== undefined) { dialog.querySelector('#nr-rw-form').hidden = false; dialog.querySelector('#nr-rw-theme').focus(); return; }
    if (dataset.rewriteCancel !== undefined) { dialog.querySelector('#nr-rw-form').hidden = true; return; }
    if (dataset.useHint !== undefined) { const box = dialog.querySelector('#nr-rw-theme'); box.value = suggestedTheme(item.report_md); box.focus(); return; }
    if (dataset.rescout !== undefined) {
      target.disabled = true;
      const now = new Date().toISOString();
      try {
        await services.api('/api/newsroom_jobs', { method: 'POST', body: { id: uid('NJ'), kind: 'clip', target: dataset.rescout, note: RESCOUT_NOTE, status: 'queued', scout_job_id: null, item_id: null, error: null, created_at: now, updated_at: now, target_id: item.target_id || 'unassigned', batch_id: uid('BATCH'), lane: 'web', result: {}, attempts: 0 } });
        state.jobs = (await services.api('/api/newsroom_jobs')).items;
        services.toast('เก็บคำขอแกะใหม่ในคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI');
      } catch (error) { target.disabled = false; services.toast(error.message, true); }
      return;
    }
    if (dataset.scriptCopy !== undefined) { const script = state.scripts.find((x) => x.id === dataset.scriptCopy); if (script) { await copyText(script.script_md); services.toast('คัดลอกบทแล้ว'); } return; }
    if (dataset.scriptHandoff !== undefined) {
      const script = state.scripts.find((x) => x.id === dataset.scriptHandoff); if (!script) return;
      target.disabled = true;
      try { const contentId = await handoffScript(script, item); services.toast(`ส่งเข้า Content Center แล้ว — ${contentId}`); refreshScripts(item, dialog); }
      catch (error) { target.disabled = false; services.toast(`ส่งไม่สำเร็จ: ${error.message}`, true); }
      return;
    }
    if (dataset.scriptDelete !== undefined) {
      const script = state.scripts.find((x) => x.id === dataset.scriptDelete); if (!script) return;
      if (!confirm(`ลบเวอร์ชัน "${script.title}"?${script.content_id ? ` (ไอเดีย ${script.content_id} ใน Content Center ยังอยู่)` : ''}`)) return;
      await services.api(`/api/intel_scripts/${script.id}`, { method: 'DELETE' });
      state.scripts = state.scripts.filter((x) => x.id !== script.id);
      refreshScripts(item, dialog); services.toast('ลบเวอร์ชันแล้ว');
    }
  });
}

function bind(root) {
  root.querySelector('#it-search').addEventListener('input', () => filterRoster(root));
  root.querySelectorAll('[data-role]').forEach((node) => node.addEventListener('click', () => filterRoster(root, node.dataset.role)));
  for (const id of ['#nr-platform','#nr-kind','#nr-search','#nr-target','#nr-sort']) root.querySelector(id).addEventListener(id.includes('search') ? 'input' : 'change', () => filterLibrary(root));
  root.querySelector('#nr-modal').addEventListener('click', async (event) => { const button=event.target.closest('[data-delete-library]'); if(button&&confirm('ลบออกจากคลัง? ไฟล์ปก/ภาพจะถูกลบด้วย')){await services.api(`/api/newsroom_items/${button.dataset.deleteLibrary}`,{method:'DELETE'});root.querySelector('#nr-modal').close();services.toast('ลบออกจากคลังแล้ว');await reload(root);} });
  root.querySelectorAll('[data-job-open]').forEach((node)=>node.addEventListener('click',()=>{const job=state.jobs.find((x)=>x.id===node.dataset.jobOpen);const item=state.items.find((x)=>x.id===job.item_id);services.showDialog(item?`<h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p>`:'<p>งานนี้ยังไม่มี item</p>');}));
  root.querySelectorAll('[data-job-goto]').forEach((node)=>node.addEventListener('click',()=>{const job=state.jobs.find((x)=>x.id===node.dataset.jobGoto);switchTab('targets');openTarget(job.target_id,root);}));
  root.querySelectorAll('[data-job-show-found]').forEach((node)=>node.addEventListener('click',()=>{const job=state.jobs.find((x)=>x.id===node.dataset.jobShowFound);services.showDialog(`<h2>ผลที่พบ</h2><pre>${escapeHtml(JSON.stringify(job.result||{},null,2))}</pre>`);}));
  root.querySelectorAll('[data-it-tab]').forEach((n) => n.addEventListener('click', () => switchTab(n.dataset.itTab)));
  root.querySelectorAll('#nr-research-open, [data-open-research]').forEach((node) => node.addEventListener('click', () => openResearchDialog(root)));
  root.querySelector('#nr-refresh').addEventListener('click', () => reload(root)); root.querySelector('#it-discover-open').addEventListener('click', () => openDiscover(root));
  root.querySelector('#it-scout-all').addEventListener('click', async () => { if (confirm(`สืบ ${state.targets.length} แฟ้ม × 3 เลน ใช้เวลาตามจำนวนแหล่งข้อมูล ยืนยัน?`)) { await queueScout(state.targets.map((x)=>x.id)); await reload(root); } });
  root.querySelector('#it-scout-sel').addEventListener('click', async () => { await queueScout([...selected]); await reload(root); }); root.querySelector('#it-sel-visible').addEventListener('click', () => { selected = new Set([...root.querySelectorAll('[data-target-row]:not([hidden])')].map((row)=>state.targets.find((target)=>target.id===row.dataset.targetRow)).filter((target)=>targetLanes(target).length).map((target)=>target.id)); renderPage(root); }); root.querySelector('#it-sel-clear').addEventListener('click', () => { selected.clear(); renderPage(root); });
  root.querySelectorAll('[data-select-target]').forEach((n) => n.addEventListener('change', () => { n.checked ? selected.add(n.dataset.selectTarget) : selected.delete(n.dataset.selectTarget); })); root.querySelectorAll('[data-open-target]').forEach((n) => n.addEventListener('click', () => openTarget(n.dataset.openTarget, root))); root.querySelectorAll('[data-scout]').forEach((n) => n.addEventListener('click', async () => { await queueScout([n.dataset.scout]); await reload(root); }));
  root.querySelectorAll('[data-target-row]').forEach((row)=>{row.addEventListener('click',(event)=>{if(!event.target.closest('button,input,a'))openTarget(row.dataset.targetRow,root);});row.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();openTarget(row.dataset.targetRow,root);}});});
  root.querySelector('#it-fire').addEventListener('click', async () => { const runner = root.querySelector('#it-runner'); const lanes = [...runner.querySelectorAll('input:checked')].map((x)=>x.value); await queueScout([runner.dataset.target], lanes); await reload(root); }); for(const selector of ['#it-back','#it-cancel']) root.querySelector(selector).addEventListener('click', () => { root.querySelector('#it-runner').hidden = true; });
  root.querySelectorAll('[data-copy-next]').forEach((node) => node.addEventListener('click', async () => { const job = state.jobs.find((item) => item.id === node.dataset.copyNext); const nextAction = scoutJobPresentation(job).action; if (nextAction) { await copyText(nextAction); services.toast('คัดลอกทางต่อแล้ว'); } }));
  root.querySelectorAll('[data-job-retry]').forEach((n) => n.addEventListener('click', async () => { const job = state.jobs.find((x)=>x.id===n.dataset.jobRetry); await services.api(`/api/newsroom_jobs/${job.id}`, { method:'PATCH', body:{ status:'queued', error:null, attempts:job.attempts+1, updated_at:new Date().toISOString() } }); services.toast(job.attempts < 1 ? 'ส่งกลับเข้าคิวบนคลาวด์ครั้งที่ 1 ยังไม่ได้เชื่อมตัวประมวลผล AI' : 'ส่งกลับเข้าคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI'); await reload(root); }));
  root.querySelectorAll('[data-job-delete]').forEach((n) => n.addEventListener('click', async () => { if(!confirm('ลบงานนี้ออกจากคิว?'))return;await services.api(`/api/newsroom_jobs/${n.dataset.jobDelete}`, { method:'DELETE' });services.toast('ลบออกจากคิวแล้ว'); await reload(root); }));
  root.querySelectorAll('[data-agent-fix]').forEach((n) => n.addEventListener('click', async () => { const job=state.jobs.find((x)=>x.id===n.dataset.agentFix); const prompt=`แก้งาน Intel ที่ล้มเหลว\nงาน: ${escapeHtml(job.id)}\nเลน: ${job.lane}\nerror: ${job.error || 'ไม่ระบุ'}\nไฟล์ที่เกี่ยว: data/newsroom_jobs.json, brain/30-scout.md, tools/intel-export.mjs`; const request={ id:uid('REQ'), newsroom_job_id:job.id, title:'Fix Intel job', prompt, status:'open', created_at:new Date().toISOString() }; await services.api('/api/agent_requests',{method:'POST',body:request}); const dialog=root.querySelector('#agent-fix-dialog'); dialog.innerHTML=`<div class="dialog-body"><h2>คำสั่งสำหรับ agent</h2><pre>${escapeHtml(prompt)}</pre><button class="btn btn-accent" data-copy-agent type="button">คัดลอกคำสั่ง</button><button class="btn btn-quiet" data-close-agent type="button">ปิด</button></div>`; dialog.showModal(); dialog.querySelector('[data-copy-agent]').addEventListener('click',async()=>{await copyText(prompt);services.toast('คัดลอกคำสั่งแล้ว — วางใน agent ของคุณ');}); dialog.querySelector('[data-close-agent]').addEventListener('click',()=>dialog.close()); }));
  root.querySelectorAll('[data-library-item]').forEach((n)=>n.addEventListener('click',()=>openLibraryItem(n.dataset.libraryItem, root)));
}

export async function render(root, incoming) {
  services = incoming;
  await reload(root);
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = window.setInterval(async () => {
    const [jobs, scripts, rwJobs] = await Promise.all([
      services.api('/api/newsroom_jobs').catch(() => ({ items: state.jobs })),
      services.api('/api/intel_scripts').catch(() => ({ items: state.scripts })),
      services.api('/api/wr_jobs').catch(() => ({ items: state.rwJobs || [] }))
    ]);
    state.rwJobs = rwJobs.items;
    const active = jobs.items.filter((job) => ['queued','submitted','running'].includes(job.status)).length;
    const badge = document.querySelector('#nr-queue-badge');
    if (badge) badge.textContent = active;
    // เวอร์ชันที่บันทึกใหม่ต้องโผล่บนการ์ดที่เปิดค้างอยู่ โดยไม่ต้องกดรีเฟรช
    const changed = scriptSignature(scripts.items) !== scriptSignature(state.scripts);
    const before = state.scripts;
    state.scripts = scripts.items;
    if (changed) announceScriptChanges(before, scripts.items);
    const dialog = document.querySelector('#nr-modal');
    if (openedItem && dialog?.open) {
      if (changed) refreshScripts(openedItem, dialog);
      const status = dialog.querySelector('#nr-rw-status'); if (status) status.textContent = rewriteStatus(openedItem);
    }
  }, 5000);
}
export { THREAT_LABEL, PLATFORM_LABEL, nextLabel, renderTrigger, defaultTarget, rewriteStatus, announceScriptChanges, scriptSignature, __setStateForTest };
// สำหรับ test เท่านั้น — ให้ rewriteStatus/announceScriptChanges ทำงานโดยไม่ต้อง render หน้า
function __setStateForTest(next, incoming) { state = { ...(state || {}), ...next }; if (incoming) services = incoming; }
