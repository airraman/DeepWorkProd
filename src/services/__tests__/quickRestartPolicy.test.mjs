// Run with: node --test src/services/__tests__/quickRestartPolicy.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FREE_DAILY_QUICK_RESTARTS,
  PREMIUM_DAILY_QUICK_RESTARTS,
  quickRestartsUsedToday,
  dailyQuickRestartLimit,
  decideQuickRestart,
  isUntouchedRestart,
} from '../quickRestartPolicy.js';
import { startAnotherNavigationState } from '../sessionPrefill.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');
const ALLOW = { allowed: true, consume: true, showPaywall: false };
const DENY = { allowed: false, consume: false, showPaywall: true };
const PREMIUM_DENY = { allowed: false, consume: false, showPaywall: false };

// ─── Entitlement (cases 1–5) ─────────────────────────────────────────────────

test('1. free user, none used today: allowed and consumes one', () => {
  assert.deepEqual(decideQuickRestart({ isPremium: false, usedToday: 0 }), ALLOW);
});

test('2. free user, one already used today: denied with paywall', () => {
  assert.deepEqual(decideQuickRestart({ isPremium: false, usedToday: 1 }), DENY);
  assert.deepEqual(decideQuickRestart({ isPremium: false, usedToday: 5 }), DENY);
});

test('3. premium user, none used today: allowed', () => {
  assert.deepEqual(decideQuickRestart({ isPremium: true, usedToday: 0 }), ALLOW);
});

test('4. premium user, one used today: allowed (the second restart is the premium benefit)', () => {
  assert.deepEqual(decideQuickRestart({ isPremium: true, usedToday: 1 }), ALLOW);
});

test('5. premium user, two used today: denied, without a paywall (already premium)', () => {
  assert.equal(PREMIUM_DAILY_QUICK_RESTARTS, 2);
  assert.deepEqual(decideQuickRestart({ isPremium: true, usedToday: 2 }), PREMIUM_DENY);
  assert.deepEqual(decideQuickRestart({ isPremium: true, usedToday: 9 }), PREMIUM_DENY);
});

test('paywall copy matches the 2/day premium limit', () => {
  const paywall = read('components/PaywallModal.js');
  assert.match(paywall, /Upgrade for 2 quick restarts a day\./);
  assert.ok(!/unlimited quick restarts/.test(paywall));
});

test('limits come only from isPremium (no second entitlement source)', () => {
  assert.equal(dailyQuickRestartLimit(false), FREE_DAILY_QUICK_RESTARTS);
  assert.equal(FREE_DAILY_QUICK_RESTARTS, 1);
  assert.equal(dailyQuickRestartLimit(true), PREMIUM_DAILY_QUICK_RESTARTS);
  // A loading/odd isPremium is free, so it gets the paywall, never premium's cap.
  assert.equal(decideQuickRestart({ isPremium: undefined, usedToday: 1 }).showPaywall, true);
  // Anything that isn't exactly true is free (e.g. still loading).
  assert.equal(dailyQuickRestartLimit(undefined), 1);
  assert.equal(dailyQuickRestartLimit('true'), 1);
});

// ─── Daily reset (case 6) ────────────────────────────────────────────────────

test('6. a stored count from another day resets to zero, restoring eligibility', () => {
  const used = quickRestartsUsedToday({ storedDate: '2026-11-03', storedCount: '1', today: '2026-11-04' });
  assert.equal(used, 0);
  assert.deepEqual(decideQuickRestart({ isPremium: false, usedToday: used }), ALLOW);
  assert.equal(quickRestartsUsedToday({ storedDate: '2026-11-04', storedCount: '1', today: '2026-11-04' }), 1);
});

test('missing or corrupt storage counts as zero used', () => {
  for (const stored of [
    { storedDate: null, storedCount: null },
    { storedDate: '2026-11-04', storedCount: null },
    { storedDate: '2026-11-04', storedCount: 'abc' },
    { storedDate: '2026-11-04', storedCount: '-3' },
  ]) {
    assert.equal(quickRestartsUsedToday({ ...stored, today: '2026-11-04' }), 0, JSON.stringify(stored));
  }
});

// ─── Consumption (cases 7–8) ─────────────────────────────────────────────────

test('7. a denied decision never asks to consume', () => {
  for (const usedToday of [1, 2, 10]) {
    assert.equal(decideQuickRestart({ isPremium: false, usedToday }).consume, false);
  }
});

test('7b. both entry points record usage only after an allowed decision', () => {
  const home = read('screens/HomeScreen.js');
  const homeFn = home.slice(home.indexOf('const handleQuickRestart'), home.indexOf('const dismissQuickRestart'));
  assert.ok(homeFn.indexOf('checkQuickRestart(isPremium)') < homeFn.indexOf('incrementQuickRestarts()'));
  assert.match(homeFn, /if \(!decision\.allowed\) \{[\s\S]*?return;\s*\}/);

  const summary = read('features/session-completion/screens/SessionSummaryScreen.js');
  const sumFn = summary.slice(summary.indexOf('const handleStartAnother'), summary.indexOf('const handleSetUpManually'));
  assert.ok(sumFn.indexOf('checkQuickRestart(isPremium)') < sumFn.indexOf('incrementQuickRestarts()'));
  assert.match(sumFn, /if \(!decision\.allowed\) \{[\s\S]*?return;\s*\}/);
  // The "Set up manually" fallback consumes nothing.
  const manual = summary.slice(summary.indexOf('const handleSetUpManually'), summary.indexOf('if (loading)'));
  assert.ok(!manual.includes('incrementQuickRestarts'));
});

test('Begin consumes the quick-restart defaults only when started unchanged', () => {
  const d = { activity: 'a1', duration: '25', musicChoice: 'lofi' };
  assert.equal(isUntouchedRestart(d, { ...d }), true);
  assert.equal(isUntouchedRestart(d, { ...d, duration: 25 }), true); // string/number forms
  assert.equal(isUntouchedRestart(d, { ...d, duration: '30' }), false);
  assert.equal(isUntouchedRestart(d, { ...d, activity: 'a2' }), false);
  assert.equal(isUntouchedRestart(d, { ...d, musicChoice: 'none' }), false);
  assert.equal(isUntouchedRestart(null, d), false); // not a restart (first of the day, etc.)
});

test('Home defaults: a same-day re-load is checked first and consumed only on Begin', () => {
  const home = read('screens/HomeScreen.js');
  const effect = home.slice(home.indexOf('const defaultsAppliedRef'), home.indexOf('const [focusLockEnabled'));
  assert.match(effect, /if \(skipDefaultsRef\.current\) return;/);
  const gate = effect.slice(effect.indexOf('if (defaults.isQuickRestart)'));
  assert.ok(gate.indexOf('checkQuickRestart(isPremium)') < gate.indexOf('restartDefaultsRef.current = {'));
  assert.match(gate, /if \(!decision\.allowed\) \{\s*showQuickRestartLimit\(decision, 'Set up manually'\);\s*return;\s*\}/);
  assert.ok(!effect.includes('incrementQuickRestarts'), 'applying defaults never consumes');
  const beginAt = home.indexOf('const handleStartSession');
  const begin = home.slice(beginAt, home.indexOf('navigation.navigate(\'DeepWorkSession\'', beginAt));
  assert.match(begin, /isUntouchedRestart\(restartDefaultsRef\.current[\s\S]*?incrementQuickRestarts\(\)/);
  // Arriving from "Start another" (consumed) or "Set up manually" (denied) skips the defaults.
  assert.match(home, /useRef\(!!route\.params\?\.prefill \|\| !!route\.params\?\.manualSetup\)/);
  // The modal's own restart clears the defaults marker, so Begin can't count it twice.
  const modal = home.slice(home.indexOf('const handleQuickRestart'), home.indexOf('const showQuickRestartLimit'));
  assert.match(modal, /restartDefaultsRef\.current = null/);
});

test('only free users are sold the paywall; premium at the cap gets a notice', () => {
  const home = read('screens/HomeScreen.js');
  const limit = home.slice(home.indexOf('const showQuickRestartLimit'), home.indexOf('const dismissQuickRestart'));
  assert.match(limit, /if \(decision\.showPaywall\) \{\s*showGatedPaywall\('quick_restart'/);
  const summary = read('features/session-completion/screens/SessionSummaryScreen.js');
  const sumFn = summary.slice(summary.indexOf('const handleStartAnother'), summary.indexOf('const handleSetUpManually'));
  assert.match(sumFn, /if \(decision\.showPaywall\) \{\s*setShowQuickRestartPaywall\(true\);/);
});

test('8. completing a session never consumes a quick restart', () => {
  const callers = [
    'screens/HomeScreen.js',
    'features/session-completion/screens/SessionSummaryScreen.js',
    'screens/DeepWorkSession.js',
    'features/session-completion/screens/SessionRatingScreen.js',
    'features/session-completion/services/sessionService.js',
    'services/deepWorkStore.js',
    'services/widgetHandoffService.js',
  ].filter((f) => read(f).includes('incrementQuickRestarts('));
  assert.deepEqual(callers, [
    'screens/HomeScreen.js',
    'features/session-completion/screens/SessionSummaryScreen.js',
  ]);
});

// ─── Identical rules + never auto-start (cases 9–10) ─────────────────────────

test('9. both entry points use the same decision from SubscriptionContext\'s isPremium', () => {
  const home = read('screens/HomeScreen.js');
  const summary = read('features/session-completion/screens/SessionSummaryScreen.js');
  for (const src of [home, summary]) {
    assert.match(src, /checkQuickRestart\(isPremium\)/);
    assert.match(src, /useSubscription\(\)/);
    assert.ok(!/getQuickRestartsToday\(\)\s*;?\s*\n\s*if \(/.test(src), 'no private inline limit check');
  }
  const svc = read('services/monetizationService.js');
  assert.match(svc, /decideQuickRestart\(\{ isPremium, usedToday: await getQuickRestartsToday\(\) \}\)/);
});

test('10. Start another always lands on Home and never on the session screen', () => {
  const withPrefill = startAnotherNavigationState({ activity: 'a1', duration: 25, musicChoice: 'lofi' });
  const manual = startAnotherNavigationState(null);
  for (const nav of [withPrefill, manual]) {
    const json = JSON.stringify(nav);
    assert.ok(!json.includes('DeepWorkSession'));
    assert.equal(nav.routes[0].name, 'MainApp');
    assert.equal(nav.routes[0].state.routes[0].name, 'Home');
  }
  assert.deepEqual(withPrefill.routes[0].state.routes[0].params.prefill,
    { activity: 'a1', duration: 25, musicChoice: 'lofi' });
  assert.deepEqual(manual.routes[0].state.routes[0].params, { manualSetup: true });
  const summary = read('features/session-completion/screens/SessionSummaryScreen.js');
  const sumFn = summary.slice(summary.indexOf('const handleStartAnother'), summary.indexOf('if (loading)'));
  assert.ok(!sumFn.includes("'DeepWorkSession'"));
});

test('edge: negative or non-numeric usage is treated as zero', () => {
  assert.deepEqual(decideQuickRestart({ isPremium: false, usedToday: -1 }), ALLOW);
  assert.deepEqual(decideQuickRestart({ isPremium: false, usedToday: NaN }), ALLOW);
});
