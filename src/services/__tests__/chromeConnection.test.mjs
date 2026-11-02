// Run with: node --test src/services/__tests__/chromeConnection.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChromeConnection, CHROME_WEB_STORE_URL } from '../chromeConnection.js';

const signedIn = { signedIn: true, isAnonymous: false, loading: false };
const state = (input) => resolveChromeConnection(input).state;

test('signed out', () => {
  assert.equal(state({ signedIn: false, isAnonymous: false, loading: false, signals: null }), 'signed_out');
});

test('anonymous account: needs a real account, no link claim', () => {
  const r = resolveChromeConnection({ ...signedIn, isAnonymous: true, signals: { platformsChrome: true, extensionSession: true } });
  assert.equal(r.state, 'anonymous');
});

test('loading', () => {
  assert.equal(state({ ...signedIn, loading: true, signals: undefined }), 'loading');
  assert.equal(state({ ...signedIn, signals: undefined }), 'loading');
});

test('linked via platforms.chrome (Chrome-first account)', () => {
  assert.equal(state({ ...signedIn, signals: { platformsChrome: true, extensionSession: false } }), 'linked');
});

test('linked via an extension session (mobile-first account)', () => {
  assert.equal(state({ ...signedIn, signals: { platformsChrome: false, extensionSession: true } }), 'linked');
});

test('positive evidence wins even if the other read failed', () => {
  assert.equal(state({ ...signedIn, signals: { platformsChrome: null, extensionSession: true } }), 'linked');
  assert.equal(state({ ...signedIn, signals: { platformsChrome: true, extensionSession: null } }), 'linked');
});

test('a failed read is never shown as not linked', () => {
  assert.equal(state({ ...signedIn, signals: { platformsChrome: null, extensionSession: false } }), 'unavailable');
  assert.equal(state({ ...signedIn, signals: { platformsChrome: false, extensionSession: null } }), 'unavailable');
  assert.equal(state({ ...signedIn, signals: { platformsChrome: null, extensionSession: null } }), 'unavailable');
});

test('not linked only when both reads succeed and both are negative, with a path to connect', () => {
  const r = resolveChromeConnection({ ...signedIn, signals: { platformsChrome: false, extensionSession: false } });
  assert.equal(r.state, 'not_linked');
  assert.equal(r.showGetExtension, true);
  assert.match(r.detail, /same account/);
});

test('only not_linked offers the extension link; nothing ever claims "online" or "connected now"', () => {
  const all = [
    { signedIn: false, isAnonymous: false, loading: false, signals: null },
    { ...signedIn, isAnonymous: true, signals: null },
    { ...signedIn, loading: true, signals: undefined },
    { ...signedIn, signals: { platformsChrome: true, extensionSession: true } },
    { ...signedIn, signals: { platformsChrome: null, extensionSession: null } },
    { ...signedIn, signals: { platformsChrome: false, extensionSession: false } },
  ].map(resolveChromeConnection);
  assert.deepEqual(all.filter((r) => r.showGetExtension).map((r) => r.state), ['not_linked']);
  for (const r of all) assert.ok(!/online|connected now|active now/i.test(`${r.title} ${r.detail}`));
});

test('Web Store URL is the one the welcome email already uses', () => {
  assert.equal(CHROME_WEB_STORE_URL,
    'https://chromewebstore.google.com/detail/lucid-%E2%80%93-creative-focus/kjhmjfnodmankioppjmblompjlnoldfo');
});
