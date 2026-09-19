const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function loadBadge() {
  const source = ts.transpileModule(
    fs.readFileSync(require.resolve("../src/utils/badgeColor.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, module: { exports } });
  return exports;
}

test("agent badge is grey without NIN and maroon when NIN is verified", () => {
  const { resolveAccountBadgeColor, BADGE_AGENT, BADGE_AGENT_VERIFIED } = loadBadge();
  assert.equal(resolveAccountBadgeColor({ account_type: "agent" }), BADGE_AGENT);
  assert.equal(
    resolveAccountBadgeColor({
      account_type: "agent",
      nin_number: "12345678901",
      nin_verified: true,
    }),
    BADGE_AGENT_VERIFIED
  );
  assert.equal(
    resolveAccountBadgeColor({
      account_type: "personal",
      user_verified: true,
    }),
    null
  );
});
