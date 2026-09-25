const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(fs.readFileSync(require.resolve("../src/utils/cbcNfc.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = {};
vm.runInNewContext(source, { exports: mod, module: { exports: mod } });

test("extracts the RGC1 ciphertext from an NDEF text record", () => {
  const text = "RGC1:ab12cd34ef56ab78";
  const payload = [2, 101, 110, ...Buffer.from(text, "utf8")];
  assert.equal(mod.extractCardPayload([{ payload }]), "AB12CD34EF56AB78");
});

test("rejects a tag that is not a CBC card", () => {
  assert.equal(mod.extractCardPayload([{ payload: [2, 101, 110, 104, 105] }]), "");
  assert.equal(mod.normalizeUid("04:a1-b2 c3"), "04A1B2C3");
  assert.equal(mod.normalizeUid(""), "");
});

test("formats the PIN session countdown", () => {
  assert.equal(mod.formatTapCountdown(125), "2:05");
  assert.equal(mod.formatTapCountdown(0), "0:00");
  assert.equal(mod.formatTapCountdown(-4), "0:00");
});
