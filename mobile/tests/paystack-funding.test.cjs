const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/utils/paystackFunding.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;

function load(env) {
  const exports = {};
  vm.runInNewContext(source, { exports, process: { env } });
  return exports;
}

test("Paystack funding button shows while wallet config is still loading", () => {
  const api = load({});
  assert.equal(api.isPaystackFundingEnabled(null), true);
});

test("Paystack funding button shows when the API enables it", () => {
  const api = load({});
  assert.equal(api.isPaystackFundingEnabled({ paystack: { enabled: true } }), true);
});

test("Paystack funding button shows from a client public key even if the API has not enabled it yet", () => {
  const api = load({ EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY: "pk_test_x" });
  assert.equal(api.isPaystackFundingEnabled({ paystack: { enabled: false } }), true);
});

test("Paystack funding button hides when the API disables it and no client key is set", () => {
  const api = load({});
  assert.equal(api.isPaystackFundingEnabled({ paystack: { enabled: false } }), false);
});
