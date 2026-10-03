import assert from 'node:assert/strict';
import test from 'node:test';

// No browser or production requests: tests import the current browser helper
// with a fresh module instance and replace only its browser globals/fetch.
const apiUrl = new URL('./out/assets/api.mjs', import.meta.url);
let sequence = 0;
function json(value, revision, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(revision == null ? {} : { etag: `"cloud-workspace-${revision}"` }),
    },
  });
}
async function setup(t, fetchImpl, role = 'admin') {
  const originals = new Map(['fetch', 'location', 'document'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://workspace.invalid') });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: { dataset: { accessRole: role } } } });
  globalThis.fetch = fetchImpl;
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return import(`${apiUrl.href}?cloud-api-test=${++sequence}`);
}

test('object POST gets an initial revision and serializes its existing body exactly', async t => {
  const requests = [];
  const body = { content_id: 'IDEA-1', title: 'บันทึกบนคลาวด์', extra: ['x'] };
  const { api } = await setup(t, async (url, options) => {
    requests.push({ url, options });
    return options.method === 'GET' ? json({ items: [] }, 4) : json(body, 5, 201);
  });
  assert.deepEqual(await api('/api/content_items', { method: 'POST', body }), body);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[1].options.body, JSON.stringify(body));
  assert.equal(new Headers(requests[1].options.headers).get('if-match'), '"cloud-workspace-4"');
});

test('string PATCH is not double encoded and DELETE handles an empty 204 response', async t => {
  const requests = [];
  const { api } = await setup(t, async (url, options) => {
    requests.push({ url, options });
    if (options.method === 'GET') return json({ items: [{ id: 'JOB-1' }] }, 1);
    if (options.method === 'PATCH') return json({ id: 'JOB-1', status: 'queued' }, 2);
    return json(null, 3, 204);
  });
  const body = '{"status":"queued"}';
  await api('/api/wr_jobs/JOB-1', { method: 'PATCH', body });
  assert.equal(requests[1].options.body, body);
  assert.deepEqual(await api('/api/wr_jobs/JOB-1', { method: 'DELETE' }), {});
  assert.equal(requests.length, 3);
  assert.equal(requests[2].options.body, undefined);
  assert.equal(new Headers(requests[2].options.headers).get('if-match'), '"cloud-workspace-2"');
});

test('background reads cannot authorize a stale editor; a conflict is never retried', async t => {
  const requests = [];
  const { api } = await setup(t, async (url, options) => {
    requests.push({ url, options });
    if (options.method === 'GET') return json({ items: [{ content_id: 'IDEA-1', title: requests.length === 1 ? 'Earlier' : 'Newer' }] }, requests.length);
    return json({ error: 'Conflict', code: 'REVISION_CONFLICT' }, null, 409);
  });
  await api('/api/content_items');
  assert.equal((await api('/api/content_items')).items[0].title, 'Newer');
  await assert.rejects(api('/api/content_items/IDEA-1', { method: 'PATCH', body: { title: 'Unsaved older editor' } }), /บันทึกอีกครั้ง/);
  assert.equal(requests.length, 3, 'must not read a new revision and replay the stale write');
  assert.equal(new Headers(requests[2].options.headers).get('if-match'), '"cloud-workspace-1"');
});

test('an old collection pin blocks writes across collections using actual CAS rules', async t => {
  const sent = [];
  let serverRevision = 0;
  const { api } = await setup(t, async (url, options) => {
    const h = new Headers(options.headers);
    sent.push({ url, method: options.method, revision: h.get('if-match') });
    if (options.method === 'GET') return json({ items: [] }, serverRevision);
    if (h.get('if-match') !== `"cloud-workspace-${serverRevision}"`) return json({ error: 'Conflict' }, null, 409);
    return json({ ok: true }, ++serverRevision);
  });
  await api('/api/wr_jobs');
  serverRevision = 1; // Another client updates before the remaining reads.
  await api('/api/content_items');
  await api('/api/content_variants');
  await assert.rejects(api('/api/content_items/IDEA-1', { method: 'PATCH', body: { title: 'Updated' } }), /รีเฟรชหน้าเว็บ/);
  await assert.rejects(api('/api/content_variants/VAR-1', { method: 'PATCH', body: { working_title: 'Updated' } }), /รีเฟรชหน้าเว็บ/);
  await assert.rejects(api('/api/wr_jobs/JOB-1', { method: 'DELETE' }), /บันทึกอีกครั้ง/);
  assert.deepEqual(sent.filter(x => x.method !== 'GET').map(x => x.revision), [
    '"cloud-workspace-0"', '"cloud-workspace-0"', '"cloud-workspace-0"',
  ]);
  assert.equal(serverRevision, 1, 'conflicts must leave persisted state unchanged');
});

test('a fresh session advances matching pins after successful sequential CAS writes', async t => {
  const writes = [];
  let serverRevision = 1;
  const { api } = await setup(t, async (url, options) => {
    if (options.method === 'GET') return json({ items: [] }, serverRevision);
    const revision = new Headers(options.headers).get('if-match');
    writes.push(revision);
    if (revision !== `"cloud-workspace-${serverRevision}"`) return json({ error: 'Conflict' }, null, 409);
    return json({ ok: true }, ++serverRevision);
  });
  await api('/api/content_items');
  await api('/api/content_variants');
  await api('/api/content_items/IDEA-1', { method: 'PATCH', body: { title: 'Updated' } });
  await api('/api/content_variants/VAR-1', { method: 'PATCH', body: { working_title: 'Updated' } });
  assert.deepEqual(writes, ['"cloud-workspace-1"', '"cloud-workspace-2"']);
  assert.equal(serverRevision, 3);
});

test('write-md initial status lookup cannot authorize a draft opened at an older revision', async t => {
  const requests = [];
  const { api } = await setup(t, async (url, options) => {
    const revision = new Headers(options.headers).get('if-match');
    requests.push({ url, method: options.method, revision });
    if (url === '/api/content_variants') return json({ items: [{ variant_id: 'VAR-1', script_draft: 'Earlier draft' }] }, 1);
    if (url === '/api/cloud-workspace/status') return json({ revision: 2 }, 2);
    return revision !== '"cloud-workspace-2"'
      ? json({ error: 'Conflict' }, null, 409)
      : json({ path: 'output/content/reel/VAR-1.md' }, 3);
  });
  await api('/api/content_variants');
  await assert.rejects(api('/api/write-md', { method: 'POST', body: { path: 'output/content/reel/VAR-1.md', content: 'Earlier draft' } }), /รีเฟรชหน้าเว็บ/);
  assert.deepEqual(requests.map(x => [x.url, x.method, x.revision]), [
    ['/api/content_variants', 'GET', null],
    ['/api/cloud-workspace/status', 'GET', null],
    ['/api/write-md', 'POST', '"cloud-workspace-1"'],
  ]);
});

test('a viewer mutation is denied without any network request', async t => {
  let calls = 0;
  const { api } = await setup(t, async () => { calls++; throw Error('Unexpected request'); }, 'viewer');
  await assert.rejects(api('/api/content_items/IDEA-1', { method: 'PATCH', body: { title: 'Denied' } }), /สิทธิ์ดูอย่างเดียว/);
  assert.equal(calls, 0);
});

test('POST similarity lookup cannot promote stale editor revisions', async t => {
  const writes = [];
  const { api } = await setup(t, async (url, options) => {
    if (options.method === 'GET') return json({ items: [] }, 1);
    // A concurrent client has advanced the workspace to revision 2. Similarity
    // search is read-only and legitimately responds using that latest state.
    if (url === '/api/similar') return json({ items: [] }, 2);
    const revision = new Headers(options.headers).get('if-match');
    writes.push(revision);
    return revision === '"cloud-workspace-1"'
      ? json({ error: 'Conflict' }, null, 409)
      : json({ content_id: 'IDEA-1', title: 'Stale overwrite' }, 3);
  });
  await api('/api/content_items');
  await api('/api/cloud-workspace/status');
  await api('/api/similar', { method: 'POST', body: { query: 'Related topic' } });
  await assert.rejects(api('/api/content_items/IDEA-1', { method: 'PATCH', body: { title: 'Stale overwrite' } }), /บันทึกอีกครั้ง/);
  assert.deepEqual(writes, ['"cloud-workspace-1"']);
});
