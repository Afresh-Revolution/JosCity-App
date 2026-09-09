const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function api(responses) {
  const calls = [];
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/feed.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, URLSearchParams, require(name) {
    if (name === './client') return {
      apiFetch: async path => { calls.push(path); return responses.shift(); },
      readJson: async response => response.body,
    };
    if (name === '../state/savedPosts') return { resolveSaved: (_id, value) => value };
    if (name === '../utils/errors') return { friendlyError: value => value };
    throw Error(name);
  } });
  return { getFeed: exports.getFeed, calls };
}
const ok = { ok: true, body: { success: true, data: [{ post_id: 1 }], feedSessionId: 'session',
  feedSessionExpiresAt: '2026-09-08T00:30:00Z', pagination: { hasMore: true, nextCursor: 'opaque' } } };
test('client returns server session metadata and sends only ID/cursor on pagination', async () => {
  const f = api([ok, ok]);
  const first = await f.getFeed(1, 10, {});
  await f.getFeed(2, 10, { feedSessionId: first.feedSessionId, cursor: first.pagination.nextCursor });
  const query = new URL(f.calls[1], 'https://example.test').searchParams;
  assert.equal(query.get('feedSessionId'), 'session');
  assert.equal(query.get('cursor'), 'opaque');
  assert.equal(query.get('refresh'), null);
  assert.equal(query.get('seed'), null);
});
test('pull refresh requests session rotation without generating a client seed', async () => {
  const f = api([ok]);
  await f.getFeed(1, 10, { feedSessionId: 'old', refresh: true });
  assert.match(f.calls[0], /refresh=1/);
  assert.match(f.calls[0], /feedSessionId=old/);
});
test('rejects a legacy chronological response instead of silently showing it as ranked', async () => {
  const f = api([{ ok: true, body: { success: true, data: [{ post_id: 1 }], pagination: { hasMore: false } } }]);
  await assert.rejects(f.getFeed(1, 10, {}), /Feed ranking is not available/);
});
test('removed session recovers once from first page with no stale cursor', async () => {
  const f = api([{ ok: false, body: { code: 'INVALID_FEED_SESSION' } }, ok]);
  await f.getFeed(4, 10, { feedSessionId: 'expired', cursor: 'old' });
  const query = new URL(f.calls[1], 'https://example.test').searchParams;
  assert.equal(query.get('page'), '1');
  assert.equal(query.has('feedSessionId'), false);
  assert.equal(query.has('cursor'), false);
});
test('tampered cursor surfaces failure instead of silently changing sessions', async () => {
  const f = api([{ ok: false, body: { code: 'INVALID_FEED_CURSOR', message: 'Invalid cursor' } }]);
  await assert.rejects(f.getFeed(2, 10, { feedSessionId: 'session', cursor: 'bad' }), /Invalid cursor/);
  assert.equal(f.calls.length, 1);
});
