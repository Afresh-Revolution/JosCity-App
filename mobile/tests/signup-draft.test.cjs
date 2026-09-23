const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const ts = require("typescript");

function load() {
  const store = new Map();
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync(require.resolve("../src/storage/signupDraft.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    module: { exports },
    require: (name) => {
      if (name === "@react-native-async-storage/async-storage") {
        const storage = {
          getItem: async (key) => store.get(key) ?? null,
          setItem: async (key, value) => {
            store.set(key, value);
          },
          removeItem: async (key) => {
            store.delete(key);
          },
        };
        storage.default = storage;
        return storage;
      }
      throw new Error(`Unexpected require: ${name}`);
    },
  });
  return { api: exports, store };
}

test("signup draft resumes the matching register route and ignores empty forms", async () => {
  const { api, store } = load();
  assert.equal(api.signupDraftRoute({ kind: "agent" }), "/register/agent");
  assert.equal(api.signupDraftRoute({ kind: "business" }), "/register/business");
  assert.equal(api.signupDraftRoute({ kind: "personal" }), "/register/personal");

  await api.saveSignupDraft({
    kind: "personal",
    step: 1,
    email: "",
    phone: "",
    password: "",
    confirm: "",
    firstName: "",
    lastName: "",
    gender: "",
    address: "",
    nin: "",
    agreed: false,
    agentBio: "",
    agentCategories: "",
    services: [],
  });
  assert.equal(await api.loadSignupDraft(), null);

  await api.saveSignupDraft({
    kind: "agent",
    step: 2,
    email: "agent@example.com",
    phone: "08012345678",
    password: "secret",
    confirm: "secret",
    firstName: "Ada",
    lastName: "Musa",
    gender: "female",
    address: "Rayfield, Jos",
    nin: "",
    agreed: true,
    agentBio: "I help people shop",
    agentCategories: "Electronics",
    services: ["Help me buy"],
  });
  const draft = await api.loadSignupDraft();
  assert.equal(draft.kind, "agent");
  assert.equal(draft.step, 2);
  assert.equal(draft.email, "agent@example.com");
  assert.equal(store.size, 1);

  await api.clearSignupDraft();
  assert.equal(await api.loadSignupDraft(), null);
});
