const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/chat.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function api(body, ok = true) {
  const exports = {};
  vm.runInNewContext(source, { exports, require() { return {
    apiFetch: async () => ({ ok, body }), readJson: async response => response.body,
  }; } });
  return exports;
}
const message = (id, sender = 1, extra = {}) => ({ message_id: id, sender_id: sender, ...extra });
const body = (participants, messages) => ({ conversation: { id: 5, type: 'direct' }, participants, messages });
test('only recipient cursor marks outgoing messages through its boundary', async () => {
  const result = await api(body([{ user_id: 1, last_read_message_id: 100 }, { user_id: 2, last_read_message_id: '10' }],
    [message(9), message(10), message(11), message(8, 2)])).getConversation(5, 1);
  assert.deepEqual(Array.from(result.messages, m => !!m.seen), [true, true, false, false]);
});
test('missing receipts and viewer-only cursor never imply seen', async () => {
  const result = await api(body([{ user_id: 1, last_read_message_id: 100 }], [message(9)])).getConversation(5, 1);
  assert.equal(result.messages[0].seen, false);
});
test('explicit server receipts support booleans and numeric flags without treating false strings as true', async () => {
  const result = await api(body([], [message(1, 1, { seen: true }), message(2, 1, { seen: '1' }), message(3, 1, { seen: 'false' })])).getConversation(5, 1);
  assert.deepEqual(Array.from(result.messages, m => m.seen), [true, true, false]);
});
test('failed loads reject instead of clearing the conversation', async () => {
  await assert.rejects(api({}, false).getConversation(5, 1), /Could not load/);
});
