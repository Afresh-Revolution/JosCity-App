const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/push/pushNotifications.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
function setup() {
  const state = { sent: [], stored: new Map(), auth: 'personal-session', ok: true, app: { currentState: 'active' } };
  const notifications = {
    setNotificationHandler: value => { state.handler = value.handleNotification; },
    addPushTokenListener: callback => { state.rotated = callback; return { remove() {} }; },
    getPermissionsAsync: async () => ({ granted: true, canAskAgain: true, status: 'granted' }),
    requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true, status: 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[expo-token]' }),
    IosAuthorizationStatus: { PROVISIONAL: 3 }, AndroidNotificationPriority: { HIGH: 1 },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, console: { warn() {} }, setTimeout, clearTimeout, require(name) {
    if (name === 'react-native') return { Platform: { OS: 'ios' }, AppState: state.app };
    if (name.includes('async-storage')) return { getItem: async key => state.stored.get(key), setItem: async (key, value) => state.stored.set(key, value) };
    if (name === 'expo-constants') return { easConfig: { projectId: 'test-project' } };
    if (name === 'expo-device') return { isDevice: true };
    if (name.includes('api/notifications')) return { registerPushToken: async input => { state.sent.push(input); return state.ok; } };
    if (name.includes('storage/session')) return { getAuthToken: async () => state.auth };
    if (name.includes('pushFocus')) return { isPushFocused: () => true };
    if (name.includes('optionalNativeModules')) return { getNotificationsModule: async () => notifications };
    throw new Error(name);
  } });
  return { state, api: exports };
}
test('registration retries after failure and works for another signed-in account', async () => {
  const { state, api } = setup(); state.ok = false;
  await api.bootstrapPushNotifications(); state.ok = true; state.auth = 'business-session';
  await api.bootstrapPushNotifications(); assert.equal(state.sent.length, 2);
});
test('native token rotation registers an Expo token, never the native token', async () => {
  const { state, api } = setup(); await api.bootstrapPushNotifications();
  state.rotated({ data: 'raw-apns-device-token' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(state.sent.length, 2);
  assert.ok(state.sent.every(input => input.token === 'ExponentPushToken[expo-token]'));
});
test('different messages for one thread are not deduplicated as the same event', async () => {
  const { state, api } = setup(); await api.configurePushNotifications();
  const notice = id => ({ request: { identifier: id, content: { data: { screen: 'notifications', type: 'comment', entityId: 'post-1' } } } });
  assert.equal((await state.handler(notice('a'))).shouldShowBanner, true);
  assert.equal((await state.handler(notice('b'))).shouldShowBanner, true);
  assert.equal((await state.handler(notice('b'))).shouldShowBanner, false);
});
test('a previously focused chat does not suppress a background notification', async () => {
  const { state, api } = setup(); await api.configurePushNotifications(); state.app.currentState = 'background';
  assert.equal((await state.handler({ request: { identifier: 'chat', content: { data: { screen: 'messages', entityId: 1 } } } })).shouldShowBanner, true);
});
test('signed-out previews do not register an account token', async () => {
  const { state, api } = setup(); state.auth = null; await api.bootstrapPushNotifications(); assert.equal(state.sent.length, 0);
});
test('activatePushNotifications registers the Expo token when permission is granted', async () => {
  const { state, api } = setup();
  assert.equal(await api.activatePushNotifications(), true);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].token, 'ExponentPushToken[expo-token]');
});
