const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function load() {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/agentSignup.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, module: { exports } });
  return exports;
}
test('selecting Help me buy also selects Help me deliver', () => {
  const { agentTypeFromServices, toggleAgentServices, DEFAULT_AGENT_SERVICES, HELP_ME_BUY, HELP_ME_DELIVER } = load();
  assert.equal(toggleAgentServices([], HELP_ME_BUY).join('|'), DEFAULT_AGENT_SERVICES.join('|'));
  assert.equal(agentTypeFromServices([HELP_ME_BUY]), 'both');
  assert.equal(toggleAgentServices(DEFAULT_AGENT_SERVICES, HELP_ME_DELIVER).join('|'), DEFAULT_AGENT_SERVICES.join('|'));
  assert.equal(toggleAgentServices(DEFAULT_AGENT_SERVICES, HELP_ME_BUY).join('|'), HELP_ME_DELIVER);
  assert.equal(agentTypeFromServices([HELP_ME_DELIVER]), 'deliver');
});
test('create-account services and specialties map to become payload without the overlay fields', () => {
  const { becomePayloadFromSignup } = load();
  const payload = becomePayloadFromSignup({
    bio: 'I Dey deliver',
    category: 'Electronics, groceries, fashion',
    services: ['Help me buy', 'Help me deliver'],
    nin: '12345678901',
  });
  assert.equal(payload.agentType, 'both');
  assert.equal(payload.categories.join('|'), 'Electronics|groceries|fashion');
  assert.equal(payload.ninNumber, '12345678901');
  assert.equal(payload.transportMode, undefined);
});
