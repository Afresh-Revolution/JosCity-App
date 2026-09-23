const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function setup() {
  const calls = [], exports = {};
  class Form { constructor() { this.fields = []; } append(...args) { this.fields.push(args); } }
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/agent.ts'),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, FormData: Form, require: () => ({ appendAgentImage: async (data,field,image) => data.append(field,image), agentRequest: async (...args) => { calls.push(args); return {}; } }) });
  return { api: exports.agentApi, calls, inBounds: exports.inBounds };
}
test('agent quote lookup and requester quote listing use separate endpoints', async () => {
  const { api, calls } = setup();
  await api.myQuote('buy',9); await api.quotes('buy',9);
  assert.equal(calls[0][0],'/agent/buy-requests/9/my-quote');
  assert.equal(calls[1][0],'/agent/buy-requests/9/quotes');
});
test('multipart direct requests send false, images and destination fields', async () => {
  const { api, calls } = setup();
  await api.createRequest('delivery',{ isPublic: false, agentUserId: 7, destinationAddress: 'Rayfield' },[{ uri: 'file://photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }]);
  const body = calls[0][1].body.fields;
  assert.equal(calls[0][0],'/agent/delivery-requests');
  assert.equal(body.find(([key]) => key === 'isPublic')[1],'false');
  assert.equal(body.find(([key]) => key === 'images')[1].name,'photo.jpg');
});
test('funding does not send client amounts and cancellation does not assign fault', async () => {
  const { api, calls } = setup();
  await api.fund(12); await api.cancel(12,'Changed plans');
  assert.equal(calls[0][1].body,undefined);
  assert.equal(JSON.parse(calls[1][1].body).fault,null);
});
test('map jobs request the correct private role, public map is unauthenticated', async () => {
  const { api, calls } = setup();
  await api.mapJobs('agent'); await api.mapPublic('Jos & Bukuru');
  assert.equal(calls[0][0],'/agent/map/jobs?role=agent');
  assert.equal(calls[1][1].auth,false); assert.match(calls[1][0],/Jos%20%26%20Bukuru/);
});
test('place search and directions hit the map endpoints', async () => {
  const { api, calls } = setup();
  await api.places('Afresh center');
  await api.directions({ lat: 9.89, lng: 8.85 }, { lat: 9.9, lng: 8.86 });
  assert.match(calls[0][0], /\/agent\/map\/places\?q=Afresh%20center/);
  assert.equal(calls[0][1].timeoutMs, 12000);
  assert.match(calls[1][0], /\/agent\/map\/directions\?/);
  assert.match(calls[1][0], /fromLat=9.89/);
});
test('catalogue source listings and save send source fields', async () => {
  const { api, calls } = setup();
  await api.sourceListings('rice');
  await api.saveCatalogue({ title: 'Rice', sourceKind: 'joscity', listingId: 9, productPrice: 1000, agentFeePercent: 5 }, []);
  assert.equal(calls[0][0], '/agent/catalogue/source-listings?search=rice');
  const fields = calls[1][1].body.fields;
  assert.equal(calls[1][0], '/agent/catalogue');
  assert.equal(fields.find(([key]) => key === 'sourceKind')[1], 'joscity');
  assert.equal(fields.find(([key]) => key === 'listingId')[1], '9');
});
test('fee quote looks up the admin tier for a product price', async () => {
  const { api, calls } = setup();
  await api.feeQuote(1567000);
  assert.equal(calls[0][0], '/agent/fee-quote?productPrice=1567000');
  assert.equal(calls[0][1].auth, false);
});
test('claiming a request posts to the claim endpoint', async () => {
  const { api, calls } = setup();
  await api.claim('buy', 9, { productPrice: 1567000 });
  await api.claim('delivery', 4, { chargeAmount: 2500 });
  assert.equal(calls[0][0], '/agent/buy-requests/9/claim');
  assert.equal(calls[1][0], '/agent/delivery-requests/4/claim');
});
