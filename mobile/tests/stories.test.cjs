const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/stories.ts'), 'utf8'), { compilerOptions: {module: ts.ModuleKind.CommonJS,target: ts.ScriptTarget.ES2020} }).outputText;
function api(ok, body) {
 const calls = []; const exports = {};
 vm.runInNewContext(source, {exports, require: () => ({apiFetch: async (path, options) => {calls.push({path, options}); return {ok};},readJson: async () => body})});
 return {api: exports, calls};
}
test('status reaction uses authenticated existing endpoint', async () => {const value = api(true, {success:true}); await value.api.reactToStory(42); assert.equal(value.calls[0].path, '/stories/42/react'); assert.equal(value.calls[0].options.auth, true); assert.equal(value.calls[0].options.method,'POST');});
test('status reaction failures are surfaced rather than confirmed', async () => {await assert.rejects(api(false,{message:'Status expired'}).api.reactToStory(42), /Status expired/); await assert.rejects(api(true,{success:false,message:'Not permitted'}).api.reactToStory(42), /Not permitted/);});
