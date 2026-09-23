const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/storage/accountKind.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }
).outputText;
const mod = {};
vm.runInNewContext(source, { exports: mod, module: { exports: mod } });
const api = mod.default && typeof mod.default === "object" ? Object.assign(mod, mod.default) : mod;

test("personal, business and agent logins cannot be mixed", () => {
  assert.equal(api.loginMatchesAccount("personal", { account_type: "personal" }), true);
  assert.equal(api.loginMatchesAccount("personal", { account_type: "business" }), false);
  assert.equal(api.loginMatchesAccount("personal", { signup_intent: "agent", agent_type: "buy" }), false);
  assert.equal(api.loginMatchesAccount("business", { account_type: "business" }), true);
  assert.equal(api.loginMatchesAccount("business", { account_type: "personal" }), false);
  assert.equal(api.loginMatchesAccount("agent", { signup_intent: "agent", agent_type: "deliver" }), true);
  assert.equal(api.loginMatchesAccount("agent", { account_type: "personal" }), false);
  assert.equal(api.loginKindForUser({ account_type: "business", agent_type: "buy" }), "business");
});
