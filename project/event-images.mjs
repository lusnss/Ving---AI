import {EVENT_IMAGE_LIMIT, EVENT_IMAGE_BYTES, EVENT_IMAGE_TYPES, eventImageId} from './out/assets/event-image-rules.mjs';

const imageError = (message, status = 400) => Object.assign(new Error(message), {status});
const imageKey = (proposalId, imageId) => `event-images/${proposalId}/${imageId}`;

export function eventImageIds(images = []) {
 if (!Array.isArray(images) || images.length > EVENT_IMAGE_LIMIT) throw imageError(`แนบรูปได้สูงสุด ${EVENT_IMAGE_LIMIT} รูป`);
 const ids = images.map(image => typeof image === 'string' ? image : image?.id);
 if (ids.some(id => !eventImageId(id)) || new Set(ids).size !== ids.length) throw imageError('ข้อมูลรูปแนบไม่ถูกต้อง');
 return ids;
}
export const sameEventImages = (a, b) => JSON.stringify(eventImageIds(a)) === JSON.stringify(eventImageIds(b));

export async function resolveEventImages(env, proposalId, images = []) {
 const ids = eventImageIds(images);
 if (!ids.length) return [];
 if (!env.BUCKET) throw imageError('ระบบรูปภาพยังไม่พร้อม กรุณาลองบันทึกอีกครั้ง', 503);
 return Promise.all(ids.map(async id => {
  const object = await env.BUCKET.head(imageKey(proposalId, id));
  if (!object || !EVENT_IMAGE_TYPES.includes(object.httpMetadata?.contentType) || object.size > EVENT_IMAGE_BYTES) throw imageError('รูปแนบยังอัปโหลดไม่ครบ กรุณาเลือกรูปและบันทึกใหม่');
  return {id, type: object.httpMetadata.contentType, size: object.size};
 }));
}

async function imageBytes(request) {
 if (Number(request.headers.get('content-length')) > EVENT_IMAGE_BYTES) throw imageError('รูปต้องมีขนาดไม่เกิน 5 MB', 413);
 if (!request.body) throw imageError('กรุณาเลือกรูปภาพ');
 const reader = request.body.getReader(), chunks = [];
 let size = 0;
 try {
  while (true) {
   const {done, value} = await reader.read();
   if (done) break;
   size += value.byteLength;
   if (size > EVENT_IMAGE_BYTES) { await reader.cancel(); throw imageError('รูปต้องมีขนาดไม่เกิน 5 MB', 413); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(size); let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
 return bytes;
}
function matchesImageType(bytes, type) {
 if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
 if (type === 'image/png') return bytes.length > 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
 if (type === 'image/webp') return bytes.length > 12 && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
 return false;
}

export async function uploadEventImage(request, env, proposalId, draftOwner=null) {
 if (request.headers.get('origin') !== new URL(request.url).origin) throw imageError('คำขอต้องมาจากเว็บนี้', 403);
 if (!eventImageId(proposalId)) throw imageError('รหัสข้อเสนอไม่ถูกต้อง');
 if (!env.DB || !env.BUCKET) throw imageError('ระบบรูปภาพยังไม่พร้อม กรุณาลองอีกครั้ง', 503);
 if (await env.DB.prepare('SELECT id FROM event_proposal_deletions WHERE id = ?').bind('web:' + proposalId).first()) throw imageError('Event นี้ถูกลบแล้ว', 404);
 const type = request.headers.get('content-type')?.split(';')[0];
 if (!EVENT_IMAGE_TYPES.includes(type)) throw imageError('รองรับรูป JPG, PNG และ WebP เท่านั้น', 415);
 const bytes = await imageBytes(request);
 if (!matchesImageType(bytes, type)) throw imageError('ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ', 415);
 const id = crypto.randomUUID();
 await env.BUCKET.put(imageKey(proposalId, id), bytes, {httpMetadata:{contentType:type},...(draftOwner?{customMetadata:{draftOwner}}:{})});
 return {id, type, size:bytes.length};
}

export async function readEventImage(env, proposalId, id, method = 'GET', draftOwner=null) {
 if (!eventImageId(proposalId) || !eventImageId(id)) throw imageError('ไม่พบรูปภาพ', 404);
 if (!env.DB || !env.BUCKET) throw imageError('ยังโหลดรูปไม่ได้ กรุณาลองใหม่', 503);
 if (await env.DB.prepare('SELECT id FROM event_proposal_deletions WHERE id = ?').bind('web:' + proposalId).first()) throw imageError('ไม่พบรูปภาพ', 404);
 const stored = await env.DB.prepare('SELECT payload FROM event_requests WHERE id = ?').bind(proposalId).first();
 const published=stored&&eventImageIds(JSON.parse(stored.payload).attachments).includes(id);
 const object = await env.BUCKET.get(imageKey(proposalId, id));
 if(!published&&(!draftOwner||object?.customMetadata?.draftOwner!==draftOwner))throw imageError('ไม่พบรูปภาพ',404);
 if (!object || !EVENT_IMAGE_TYPES.includes(object.httpMetadata?.contentType)) throw imageError('ไม่พบรูปภาพ', 404);
 return new Response(method === 'HEAD' ? null : object.body, {headers:{
  'content-type':object.httpMetadata.contentType, 'content-length':String(object.size),
  'cache-control':'private, no-store', 'x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'; sandbox", 'cross-origin-resource-policy':'same-origin',
 }});
}
