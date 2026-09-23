const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { agentCanDeliver, agentCanBuy, hasAgentRole } = require(
  path.resolve(__dirname, "../../../New_Joscity/utils/agentStatusType.js")
);

test("Help me buy and Help me deliver agents can take both kinds of work", () => {
  assert.equal(agentCanDeliver({ agent_type: "buy" }), true);
  assert.equal(agentCanDeliver({ agent_type: "deliver" }), true);
  assert.equal(agentCanDeliver({ agent_type: "both" }), true);
  assert.equal(agentCanDeliver({ agent_type: "personal" }), false);
  assert.equal(agentCanBuy({ agent_type: "buy" }), true);
  assert.equal(agentCanBuy({ agent_type: "deliver" }), true);
  assert.equal(hasAgentRole({ agent_type: "buy" }), true);
});
