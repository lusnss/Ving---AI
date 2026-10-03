// เกลาคลิปที่สืบมาเป็นบทของเราเอง — ยืม "โครง" ห้ามลอกคำ
// ใช้ร่วมกันสามที่: หน้า Intel Warroom (เบราว์เซอร์), หน้า Content Center (ป้ายในคิว) และ tools/jobs/run.mjs (Node)
// ห้ามใส่โค้ดที่แตะ DOM หรือ fetch ในไฟล์นี้

export const PILLAR_LABEL = Object.freeze({
  ai_in_business: 'AI ในธุรกิจจริง 40%', sales_team: 'ทีมขาย/บริหาร 30%',
  intersection: 'จุดตัด AI×ขาย 20%', persona: 'ตัวตน 10%'
});
export const HOOK_STYLE_LABEL = Object.freeze({
  auto: 'ตามโครงต้นฉบับ', question: 'คำถามเจ็บจุด', contrarian: 'ขัดความเชื่อ',
  number: 'ตัวเลข/ผลลัพธ์', case: 'เล่าเคสคนพลาด', show: 'พาไปดูหน้างาน'
});
export const LENGTH_LABEL = Object.freeze({ short: '30-45 วิ', mid: '45-75 วิ', long: '75-120 วิ' });

/** การ์ดมีบทพูดถอดเสียงให้เกลาไหม — รายงานคลิปต้องมีบรรทัด `[m:ss] ข้อความ` ตาม brain/30-scout.md */
export function hasTranscript(reportMd) {
  const lines = String(reportMd ?? '').split('\n').filter((line) => /^`?\[\d{1,2}:\d{2}\]`?\s*\S/.test(line.trim()));
  return lines.join('\n').length >= 120;
}

/** บรรทัด "ตัวอย่างที่เอาไปใช้ได้:" จากรายงาน scout — ใช้เป็นคำใบ้ตอนตั้งธง */
export function suggestedTheme(reportMd) {
  const match = /ตัวอย่างที่เอาไปใช้(?:ได้)?\s*[:：]?\s*["“]?([^\n"”]{12,200})/.exec(String(reportMd ?? ''));
  return match ? match[1].trim() : '';
}

/** ตรวจ + เติมค่าปริยายให้ brief ก่อนเข้าคิว — คืน error ที่อ่านรู้เรื่องแทนการเข้าคิวงานที่ทำไม่ได้ */
export function validateBrief(input = {}) {
  const theme = String(input.theme ?? '').trim();
  if (theme.length < 8) return { ok: false, error: 'บอกธง/หัวข้อคลิปอย่างน้อย 8 ตัวอักษรก่อน' };
  if (input.pillar != null && input.pillar !== '' && !Object.hasOwn(PILLAR_LABEL, input.pillar)) {
    return { ok: false, error: 'หมวด Content Mix ไม่ถูกต้อง' };
  }
  return {
    ok: true,
    brief: {
      theme,
      pillar: input.pillar || null,
      hook_style: Object.hasOwn(HOOK_STYLE_LABEL, input.hook_style) ? input.hook_style : 'auto',
      length: Object.hasOwn(LENGTH_LABEL, input.length) ? input.length : 'mid',
      cta_keyword: String(input.cta_keyword ?? '').trim().slice(0, 40) || 'AI',
      notes: String(input.notes ?? '').trim().slice(0, 1000)
    }
  };
}

export function briefLine(brief = {}) {
  return [
    brief.pillar ? PILLAR_LABEL[brief.pillar] : '',
    HOOK_STYLE_LABEL[brief.hook_style] || '',
    LENGTH_LABEL[brief.length] || '',
    brief.cta_keyword ? `DM: ${brief.cta_keyword}` : ''
  ].filter(Boolean).join(' · ');
}

/**
 * โครงเปล่าที่ tools/jobs/run.mjs เขียนลง script_md ทันทีที่เข้าคิว
 * agent ที่รัน /jobs เป็นคนเขียนทับด้วยบทจริงตาม brain/41-reel-rewrite.md — ท่าเดียวกับ ai_improve
 */
export function scriptScaffold({ item = {}, brief = {} } = {}) {
  const source = item.title || item.source_url || item.id || 'คลิปต้นทาง';
  const lines = [
    `# ${brief.theme}`,
    '',
    `> ยืมโครงจาก: ${source}${item.platform ? ` (${item.platform})` : ''} · item ${item.id ?? '—'}`,
    `> ${briefLine(brief)}`
  ];
  if (brief.notes) lines.push(`> โน้ต: ${brief.notes}`);
  lines.push(
    '',
    '# Hook (0-2 วิ — front-load payload)',
    '',
    '# Setup (2-10 วิ — สัญญาว่าจะได้เห็นอะไร)',
    '',
    '# Body',
    '',
    '↻ Rehook:',
    '',
    '# Payoff',
    '',
    '# CTA',
    '',
    '# 🔤 Hook Text',
    '',
    '# 📝 Caption',
    '',
    '# QC',
    '- ยังเป็นโครงเปล่า — รัน `/jobs` ให้ agent เขียนทับ `script_md` ด้วยเสียงจาก `company/voice.md`',
    '- ยืมได้เฉพาะโครงและจังหวะ ห้ามคัดคำจากคลิปต้นทาง',
    '- ตรวจ claim ทุกข้อกับข้อมูลใน `company/` ก่อนใช้จริง'
  );
  return lines.join('\n');
}
