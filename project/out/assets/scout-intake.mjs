const MAX_INPUT = 4_096;
const MAX_NOTE = 2_000;
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'igsh', 'igshid', 'mibextid', 'ref'
]);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v']);
const EVIDENCE_ROOTS = ['evidence/', 'output/scout-staging/', 'data/files/newsroom/', 'examples/'];

const mediaByKind = Object.freeze({
  clip: ['video', 'transcript', 'frames'],
  page: ['page-profile', 'recent-posts'],
  ads: ['ad-metadata', 'creative-media'],
  web: ['page-html'],
  shot: ['image'],
  paste: ['text']
});

function invalid(error) { return { ok: false, error }; }

function ipv4Parts(hostname) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
  const parts = hostname.split('.').map(Number);
  return parts.every((part) => part >= 0 && part <= 255) ? parts : null;
}

function isPrivateHost(rawHostname) {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
  const ipv4 = ipv4Parts(hostname);
  if (ipv4) {
    const [a, b] = ipv4;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (hostname.includes(':')) {
    const compact = hostname.replace(/^0+/, '');
    if (compact === '::' || compact === '::1') return true;
    if (/^(?:fc|fd|fe8|fe9|fea|feb)/i.test(compact)) return true;
    const mapped = compact.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    if (mapped && isPrivateHost(mapped)) return true;
  }
  return false;
}

function normalizedUrl(url) {
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.href.replace(/\/$/, url.pathname === '/' && !url.search ? '' : '/');
}

function classifyUrl(url) {
  if (!['http:', 'https:'].includes(url.protocol)) return invalid('รองรับเฉพาะ URL แบบ HTTP(S)');
  if (url.username || url.password) return invalid('URL ต้องไม่มีชื่อผู้ใช้หรือรหัสผ่าน');
  if (isPrivateHost(url.hostname)) return invalid('URL ต้องเป็นแหล่งสาธารณะ ไม่ใช่ localhost หรือ private network');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = url.pathname.toLowerCase();
  let kind = 'web'; let lane = 'web'; let platform = 'web'; let sourceType = 'public-web';
  if (host === 'youtu.be' || /(?:^|\.)youtube\.com$/.test(host)) {
    platform = 'youtube'; sourceType = 'public-media';
    if (host === 'youtu.be' || /^\/(?:watch|shorts|live)\b/.test(pathname) || url.searchParams.has('v')) kind = 'clip';
    else if (/^\/(?:@|channel\/|c\/)/.test(pathname)) { kind = 'page'; lane = 'page'; sourceType = 'public-page'; }
  } else if (/(?:^|\.)tiktok\.com$/.test(host)) {
    platform = 'tiktok'; sourceType = 'public-media';
    if (/\/video\/\d+/.test(pathname)) kind = 'clip';
    else { kind = 'page'; lane = 'page'; sourceType = 'public-page'; }
  } else if (/(?:^|\.)instagram\.com$/.test(host)) {
    platform = 'instagram'; sourceType = 'public-media';
    if (/^\/(?:p|reel|tv)\//.test(pathname)) kind = 'clip';
    else { kind = 'page'; lane = 'page'; sourceType = 'public-page'; }
  } else if (host === 'fb.watch' || /(?:^|\.)facebook\.com$/.test(host)) {
    platform = 'facebook';
    if (host === 'fb.watch' || /^\/(?:reel|watch|share\/r)\b/.test(pathname)) { kind = 'clip'; sourceType = 'public-media'; }
    else { kind = 'ads'; lane = 'ads'; platform = 'meta-ads'; sourceType = 'meta-ads'; }
  }
  return { ok: true, kind, lane, platform, sourceType, normalized: normalizedUrl(url), requestedMedia: mediaByKind[kind] };
}

function classifyWorkspacePath(raw) {
  if (raw.includes('\\') || raw.startsWith('/') || raw.startsWith('~') || /^[A-Za-z]:/.test(raw)) return invalid('ใช้ path แบบ relative ภายใน workspace เท่านั้น');
  const segments = raw.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) return invalid('path ใน workspace ต้องไม่มี . หรือ ..');
  if (!EVIDENCE_ROOTS.some((root) => raw.startsWith(root))) return invalid(`ไฟล์หลักฐานต้องอยู่ใต้ ${EVIDENCE_ROOTS.join(', ')}`);
  const extension = raw.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  if (IMAGE_EXTENSIONS.has(extension)) return { ok: true, kind: 'shot', lane: 'web', platform: 'upload', sourceType: 'workspace-image', normalized: raw, requestedMedia: mediaByKind.shot };
  if (VIDEO_EXTENSIONS.has(extension)) return { ok: true, kind: 'clip', lane: 'web', platform: 'upload', sourceType: 'workspace-video', normalized: raw, requestedMedia: mediaByKind.clip };
  return invalid('รองรับไฟล์ภาพหรือวิดีโอหลักฐานเท่านั้น');
}

export function classifyScoutInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return invalid('กรอก URL, path ใน workspace หรือข้อความหลักฐาน');
  if (raw.length > MAX_INPUT) return invalid('ข้อมูลต้องยาวไม่เกิน 4,096 ตัวอักษร');
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw)) {
    let url;
    try { url = new URL(raw); } catch { return invalid('URL ไม่ถูกต้อง'); }
    return classifyUrl(url);
  }
  if (/^[\w.-]+\.[A-Za-z]{2,}(?:[/?#]|$)/.test(raw)) {
    try { return classifyUrl(new URL(`https://${raw}`)); } catch { return invalid('URL ไม่ถูกต้อง'); }
  }
  if (raw.includes('/') || raw.includes('\\') || /^[A-Za-z]:/.test(raw) || raw.startsWith('~')) return classifyWorkspacePath(raw);
  if (/^@[A-Za-z0-9._-]+$/.test(raw)) return { ok: true, kind: 'page', lane: 'page', platform: 'tiktok', sourceType: 'public-page', normalized: raw.toLowerCase(), requestedMedia: mediaByKind.page };
  if (raw.length >= 80) return { ok: true, kind: 'paste', lane: 'web', platform: 'upload', sourceType: 'pasted-evidence', normalized: raw, requestedMedia: mediaByKind.paste };
  return { ok: true, kind: 'ads', lane: 'ads', platform: 'meta-ads', sourceType: 'meta-ads-query', normalized: raw, requestedMedia: mediaByKind.ads };
}

function generatedId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function buildScoutJob({ raw, note = '', targetId = 'unassigned', now = new Date().toISOString(), id, batchId } = {}) {
  const classification = classifyScoutInput(raw);
  if (!classification.ok) throw new Error(classification.error);
  const cleanNote = String(note ?? '').trim();
  if (cleanNote.length > MAX_NOTE) throw new Error('โน้ตต้องยาวไม่เกิน 2,000 ตัวอักษร');
  const cleanTargetId = String(targetId || 'unassigned').trim();
  if (!cleanTargetId || cleanTargetId.length > 200) throw new Error('แฟ้มเป้าหมายไม่ถูกต้อง');
  return {
    id: id || generatedId('NJ'),
    kind: classification.kind,
    target: classification.normalized,
    note: cleanNote,
    status: 'queued',
    scout_job_id: null,
    item_id: null,
    error: null,
    created_at: now,
    updated_at: now,
    target_id: cleanTargetId,
    batch_id: batchId || generatedId('BATCH'),
    lane: classification.lane,
    result: {
      capability_mode: 'pending',
      source_type: classification.sourceType,
      requested_media: classification.requestedMedia
    },
    attempts: 0
  };
}

export function scoutJobPresentation(job = {}) {
  const result = job.result && typeof job.result === 'object' ? job.result : {};
  const states = {
    submitted: { tone: 'neutral', title: 'ตรวจแหล่งแล้ว', detail: 'คำขอผ่านการตรวจรูปแบบและพร้อมเข้าคิว', action: null },
    queued: { tone: 'warning', title: 'รอประมวลผล', detail: 'เก็บคิวบนคลาวด์แล้ว ยังไม่ได้เชื่อมตัวประมวลผล AI', action: '/worker' },
    running: { tone: 'working', title: 'สถานะที่บันทึก: กำลังสืบ', detail: 'ยังไม่ได้เชื่อมตัวประมวลผล AI บนคลาวด์', action: null },
    done: { tone: 'success', title: 'อยู่ในคลัง', detail: 'หลักฐานและรายงานพร้อมเปิดดู', action: result.item_id || job.item_id || null },
    preflight_failed: { tone: 'warning', title: 'ต้องส่งหลักฐานเพิ่ม', detail: result.reason || job.error || 'แหล่งนี้ต้องมีไฟล์หลักฐานจากผู้ใช้', action: result.next_action || null },
    failed: { tone: 'danger', title: 'สืบไม่สำเร็จ', detail: job.error || result.reason || 'ตรวจรายละเอียดแล้วลองใหม่', action: 'ลองใหม่' }
  };
  return states[job.status] || { tone: 'neutral', title: 'ตรวจแหล่งแล้ว', detail: 'กำลังเตรียมคำขอ', action: null };
}

export { EVIDENCE_ROOTS, MAX_INPUT, MAX_NOTE };
