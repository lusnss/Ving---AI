import { copyText, escapeHtml } from './api.mjs';

export async function render(root, { api, toast }) {
  const { items } = await api('/api/wr_jobs');
  root.innerHTML = `<header class="page-head"><p class="eyebrow">Jobs</p><h1>คิวงานที่ agent ต้องหยิบ</h1><p class="lede">หน้านี้ไม่รัน shell จาก HTTP ให้คัดลอกคำสั่งไปวางใน agent ที่เปิด workspace นี้</p><button id="jobs-refresh" class="btn btn-outline" type="button">⟳ รีเฟรช</button></header><section id="jobs-runbook" class="today-strip"><div><h2>/jobs</h2><p>อ่าน brain/20-jobs.md แล้วประมวลผล queued job ทีละรายการ</p></div><button class="btn btn-accent" data-job-command="/jobs" type="button">คัดลอก /jobs</button></section><ul class="list">${items.map((job) => `<li class="list-item"><strong>${escapeHtml(job.job_type)}</strong><span class="badge">${escapeHtml(job.status)}</span><pre>${escapeHtml(JSON.stringify(job.payload, null, 2))}</pre><p>${escapeHtml(job.error || '')}</p></li>`).join('') || '<li class="card">ไม่มีงานในคิว</li>'}</ul><section class="card section-gap"><h2>Job types</h2><p>render_card · render_text_card · rewrite_copy · ai_improve</p><p>Status: queued · running · done · error</p></section>`;
  root.querySelector('[data-job-command]').addEventListener('click', async () => { await copyText('/jobs'); toast('คัดลอก /jobs แล้ว'); });
  root.querySelector('#jobs-refresh').addEventListener('click', () => location.reload());
}
