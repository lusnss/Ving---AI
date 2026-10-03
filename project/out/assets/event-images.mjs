import {EVENT_IMAGE_LIMIT, EVENT_IMAGE_BYTES, EVENT_IMAGE_TYPES, eventImageUrl} from './event-image-rules.mjs';

export function imageGalleryMarkup(images = [], proposalId) {
 const valid = images.filter(image => eventImageUrl(proposalId, image.id));
 return `<section id="event-images" class="event-images" aria-labelledby="event-images-title"><div class="ei-heading"><h2 id="event-images-title">รูปประกอบการพิจารณา</h2><span>${valid.length} รูป</span></div><p class="ei-hint">ภาพสถานที่ ผังพื้นที่ หรือจุดตั้งบูธ สำหรับพิจารณาข้อเสนอ</p>${valid.length ? `<div class="ei-grid">${valid.map((image, i) => `<button type="button" class="ei-preview" data-event-image="${i}" aria-label="ดูรูปที่ ${i + 1} แบบขยาย"><img src="${eventImageUrl(proposalId, image.id)}" alt="รูปประกอบ Event ที่ ${i + 1}" loading="lazy"><span>รูปที่ ${i + 1} · ดูภาพขยาย ↗</span></button>`).join('')}</div>` : '<p class="ei-empty">ยังไม่มีรูปแนบในข้อเสนอนี้</p>'}</section>`;
}

export function openEventImage(images, selected, opener, {fullscreen=false,parent=document.body}={}) {
 if (!images.length) return;
 const dialog = document.createElement('dialog');
 dialog.className = 'ei-dialog' + (fullscreen ? ' ei-dialog-fullscreen' : '');
 dialog.setAttribute('aria-label', 'ดูรูปประกอบ Event');
 dialog.innerHTML = '<div class="ei-dialog-toolbar"><strong></strong><button type="button" data-close aria-label="ปิดภาพขยาย">ปิด ×</button></div><div class="ei-full-image"><img alt=""><p hidden role="status">ยังโหลดรูปไม่ได้ กรุณาปิดแล้วเปิดรูปอีกครั้ง</p></div><div class="ei-dialog-nav"><button type="button" data-prev aria-label="รูปก่อนหน้า">← ก่อนหน้า</button><span aria-live="polite"></span><button type="button" data-next aria-label="รูปถัดไป">ถัดไป →</button></div>';
 const draw = () => {
  const image = dialog.querySelector('img');
  image.hidden = false; dialog.querySelector('.ei-full-image p').hidden = true;
  image.src = images[selected]; image.alt = 'รูปประกอบ Event ที่ ' + (selected + 1);
  dialog.querySelector('strong').textContent = 'รูปประกอบการพิจารณา';
  dialog.querySelector('.ei-dialog-nav span').textContent = `${selected + 1} / ${images.length}`;
  dialog.querySelector('[data-prev]').disabled = selected === 0;
  dialog.querySelector('[data-next]').disabled = selected === images.length - 1;
 };
 dialog.querySelector('img').onerror = () => { dialog.querySelector('img').hidden = true; dialog.querySelector('.ei-full-image p').hidden = false; };
 dialog.querySelector('[data-close]').onclick = () => dialog.close();
 dialog.querySelector('[data-prev]').onclick = () => { if (selected > 0) { selected--; draw(); } };
 dialog.querySelector('[data-next]').onclick = () => { if (selected < images.length - 1) { selected++; draw(); } };
 dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); dialog.querySelector('[data-prev]').click(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); dialog.querySelector('[data-next]').click(); }
 });
 dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
 dialog.addEventListener('close', () => { dialog.remove(); if (opener?.isConnected) opener.focus(); }, {once:true});
 parent.append(dialog); draw(); dialog.showModal(); dialog.querySelector('[data-close]').focus();
 return dialog;
}

export function bindImageGallery(root, images, proposalId) {
 const urls = (images || []).map(image => eventImageUrl(proposalId, image.id)).filter(Boolean);
 for (const button of root.querySelectorAll('[data-event-image]')) button.onclick = () => openEventImage(urls, Number(button.dataset.eventImage), button);
}

async function prepareImage(file) {
 if (!EVENT_IMAGE_TYPES.includes(file.type)) throw Error('รองรับรูป JPG, PNG และ WebP เท่านั้น');
 if (file.size > EVENT_IMAGE_BYTES) throw Error('รูปแต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MB');
 let bitmap;
 try { bitmap = await createImageBitmap(file); } catch { throw Error('เปิดรูปนี้ไม่ได้ กรุณาเลือกรูปใหม่'); }
 try {
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) throw Error('รูปมีขนาดใหญ่เกินไป กรุณาลดความละเอียดแล้วเลือกใหม่');
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // Re-encode pixels to reduce upload size and omit camera/location metadata and filenames.
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob || blob.size > EVENT_IMAGE_BYTES) throw Error('เตรียมรูปไม่สำเร็จ กรุณาใช้ไฟล์ที่เล็กลง');
  return blob;
 } finally { bitmap.close(); }
}

export function createImageEditor(onChange) {
 let items = [], container, editable = false, busy = false, message = '', error = false;
 const release = item => { if (item.file) URL.revokeObjectURL(item.url); };
 const draw = () => {
  if (!container?.isConnected) return;
  container.innerHTML = `<section class="event-images ei-editor" aria-labelledby="ei-editor-title"><div class="ei-heading"><h2 id="ei-editor-title">รูปประกอบการพิจารณา</h2><span>${items.length} / ${EVENT_IMAGE_LIMIT} รูป</span></div><p class="ei-hint">แนบภาพสถานที่ ผังพื้นที่ หรือจุดตั้งบูธ ให้ผู้บริหารเห็นภาพก่อนตัดสินใจ</p>${editable ? `<button type="button" class="ei-add" ${busy || items.length >= EVENT_IMAGE_LIMIT ? 'disabled' : ''}>＋ เพิ่มรูปภาพ</button><input type="file" class="ei-input" aria-label="แนบรูปประกอบ Event" accept="image/jpeg,image/png,image/webp" multiple hidden ${busy ? 'disabled' : ''}><p class="ei-hint">JPG, PNG หรือ WebP · ไม่เกิน 5 MB ต่อรูป · สูงสุด ${EVENT_IMAGE_LIMIT} รูป</p>` : ''}<div class="ei-grid">${items.map((item, i) => `<div class="ei-card"><button type="button" class="ei-preview" data-preview="${i}" aria-label="ดูรูปที่ ${i + 1} แบบขยาย"><img src="${item.url}" alt="รูปประกอบ Event ที่ ${i + 1}"><span>รูปที่ ${i + 1} · ดูภาพขยาย ↗</span></button>${editable ? `<button type="button" class="ei-remove" data-remove="${i}" ${busy ? 'disabled' : ''} aria-label="ลบรูปที่ ${i + 1}">ลบรูป</button>` : ''}</div>`).join('')}</div>${items.length ? '' : '<p class="ei-empty">ยังไม่มีรูปแนบ</p>'}<p class="ei-status ${error ? 'ei-error' : ''}" role="status"></p><p class="ei-hint ei-save-note">รูปที่เพิ่มหรือลบจะเปลี่ยนในข้อเสนอเมื่อกด${editable ? 'บันทึก / ขออนุมัติ Event' : 'บันทึก'}</p></section>`;
  container.querySelector('.ei-status').textContent = message;
  const picker = container.querySelector('.ei-input');
  const add = container.querySelector('.ei-add');
  if (add) add.onclick = () => picker.click();
  if (picker) picker.onchange = () => addFiles([...picker.files]);
  for (const button of container.querySelectorAll('[data-preview]')) button.onclick = () => openEventImage(items.map(item => item.url), Number(button.dataset.preview), button);
  for (const button of container.querySelectorAll('[data-remove]')) button.onclick = () => {
   if (busy) return;
   release(items.splice(Number(button.dataset.remove), 1)[0]); message = 'ลบรูปจากรายการแล้ว · กดบันทึกเพื่อยืนยัน'; error = false; onChange(); draw(); container.querySelector('.ei-add')?.focus();
  };
 };
 async function addFiles(files) {
  if (busy || !editable || !files.length) return;
  if (items.length + files.length > EVENT_IMAGE_LIMIT) { message = `แนบรูปได้อีก ${EVENT_IMAGE_LIMIT - items.length} รูป`; error = true; draw(); return; }
  busy = true; message = 'กำลังเตรียมรูป…'; error = false; draw();
  const prepared = [];
  try {
   for (const file of files) { const blob = await prepareImage(file); prepared.push({file:blob, url:URL.createObjectURL(blob)}); }
   items.push(...prepared); onChange(); message = 'เตรียมรูปแล้ว · กำลังบันทึกในร่าง';
  } catch (err) { prepared.forEach(release); message = err.message; error = true; }
  finally { busy = false; draw(); }
 }
 return {
  mount(element, canEdit) { container = element; editable = canEdit; draw(); },
  load(images = [], proposalId) { items.forEach(release); items = images.filter(image => eventImageUrl(proposalId, image.id)).map(image => ({id:image.id, storedFor:proposalId, url:eventImageUrl(proposalId, image.id)})); message = ''; error = false; draw(); },
  get busy() { return busy; },
  get hasPending() { return items.some(item=>!item.id); },
  snapshot() { return items.filter(item=>item.id).map(item=>({id:item.id,storedFor:item.storedFor})); },
  restore(images=[]) { items.forEach(release);items=images.filter(item=>eventImageUrl(item.storedFor,item.id)).map(item=>({...item,url:eventImageUrl(item.storedFor,item.id)}));message='กู้คืนรูปจากร่างแล้ว';error=false;draw(); },
  async upload(proposalId, status) {
   if (busy) throw Error('รอเตรียมรูปให้เสร็จก่อนบันทึก');
   busy = true;
   try {
    for (let i = 0; i < items.length; i++) {
     const item = items[i];
     if (item.id && item.storedFor === proposalId) continue;
     if (!item.file) throw Error('รูปเดิมไม่ตรงกับข้อเสนอ กรุณาเปิดข้อเสนอใหม่');
     status.textContent = `กำลังบันทึกรูป ${i + 1} / ${items.length}…`;
     const response = await fetch('/api/event-images/' + proposalId, {method:'POST', headers:{'content-type':item.file.type}, body:item.file, signal:AbortSignal.timeout(45000)});
     const saved = await response.json();
     if (!response.ok) throw Error(saved.error || 'อัปโหลดรูปไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง');
     item.id = saved.id; item.storedFor = proposalId;
    }
    status.textContent = 'กำลังบันทึกข้อเสนอ…';
    return items.map(item => item.id);
   } finally { busy = false; }
  },
 };
}
