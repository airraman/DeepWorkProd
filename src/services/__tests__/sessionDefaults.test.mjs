// Run with: node --test src/services/__tests__/sessionDefaults.test.mjs
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionDefaults, findLastCompletedSession } from '../sessionDefaults.js';

// Wed Nov 4 2026, 10:00 local.
const NOW = new Date(2026, 10, 4, 10, 0).getTime();
const daysAgo = (n, h = 9) => new Date(2026, 10, 4 - n, h, 0).getTime();
const key = (ms) => new Date(ms).toISOString().split('T')[0];
const store = (...rows) => {
  const out = {};
  rows.forEach((r) => { (out[key(r.timestamp)] ||= []).push(r); });
  return out;
};
const row = (ms, activity, duration, musicChoice) => ({ timestamp: ms, activity, duration, musicChoice });

const base = {
  activityIds: ['writing', 'coding', 'editing'],
  durations: [5, 10, 15, 20, 30, 45],
  musicValues: ['none', 'white-noise', 'lofi'],
  isPremium: false,
  nowMs: NOW,
};
const resolve = (sessionsByDate, over = {}) => resolveSessionDefaults({ ...base, sessionsByDate, ...over });

// ─── New users ────────────────────────────────────────────────────────────────

test('new user: 5 min, first activity, no music', () => {
  assert.deepEqual(resolve({}), { reason: 'new', isQuickRestart: false, activity: 'writing', duration: '5', musicChoice: 'none' });
});

test('new user: same for premium', () => {
  assert.equal(resolve({}, { isPremium: true }).duration, '5');
});

test('new user: rows that are not completed sessions do not count as history', () => {
  const junk = { '2026-11-03': [null, { duration: 0, timestamp: daysAgo(1) }, { duration: 20 }] };
  assert.equal(resolve(junk).reason, 'new');
});

test('new user with no activities yet: activity left for the user', () => {
  assert.equal(resolve({}, { activityIds: [] }).activity, null);
});

// ─── Returning users ──────────────────────────────────────────────────────────

test('returning user: most recent completed session config', () => {
  const s = store(row(daysAgo(3), 'coding', 20, 'white-noise'), row(daysAgo(1), 'editing', 15, 'lofi'));
  assert.deepEqual(resolve(s), { reason: 'returning', isQuickRestart: false, activity: 'editing', duration: '15', musicChoice: 'lofi' });
});

test('returning user: most recent is by timestamp, not storage order', () => {
  const s = { '2026-11-03': [row(daysAgo(1, 18), 'coding', 30, 'none'), row(daysAgo(1, 8), 'writing', 10, 'none')] };
  assert.equal(resolve(s).activity, 'coding');
});

test('returning free user: a 45-min last session defaults to 30 (Begin would block 45)', () => {
  const s = store(row(daysAgo(1), 'coding', 45, 'lofi'));
  assert.equal(resolve(s).duration, '30');
});

test('returning premium user: keeps 45', () => {
  const s = store(row(daysAgo(1), 'coding', 45, 'lofi'));
  assert.equal(resolve(s, { isPremium: true }).duration, '45');
});

test('returning user: deleted activity falls back to the first activity', () => {
  const s = store(row(daysAgo(1), 'deleted-activity', 20, 'lofi'));
  assert.equal(resolve(s).activity, 'writing');
});

test('returning user: unknown music falls back to no music', () => {
  assert.equal(resolve(store(row(daysAgo(1), 'coding', 20, 'jazz'))).musicChoice, 'none');
});

test('returning user: a duration no longer offered (dev 15 s, or 25) falls back to 5', () => {
  assert.equal(resolve(store(row(daysAgo(1), 'coding', 0.25, 'none'))).duration, '5');
  assert.equal(resolve(store(row(daysAgo(1), 'coding', 25, 'none'))).duration, '5');
});

test('returning user who focused earlier today: today\'s config', () => {
  const s = store(row(daysAgo(0, 8), 'writing', 30, 'lofi'));
  assert.deepEqual(resolve(s), { reason: 'returning', isQuickRestart: true, activity: 'writing', duration: '30', musicChoice: 'lofi' });
});

// ─── Inactive users ───────────────────────────────────────────────────────────

test('inactive 7+ days: 5 min, keeps last activity and music', () => {
  const s = store(row(daysAgo(7), 'coding', 45, 'lofi'));
  assert.deepEqual(resolve(s, { isPremium: true }), { reason: 'inactive', isQuickRestart: false, activity: 'coding', duration: '5', musicChoice: 'lofi' });
});

test('inactive boundary: 6 days is returning, 7 is inactive', () => {
  assert.equal(resolve(store(row(daysAgo(6), 'coding', 20, 'none'))).reason, 'returning');
  assert.equal(resolve(store(row(daysAgo(7), 'coding', 20, 'none'))).reason, 'inactive');
});

test('inactive months later with a deleted activity: 5 min, first activity', () => {
  const s = store(row(daysAgo(90), 'deleted-activity', 30, 'white-noise'));
  assert.deepEqual(resolve(s), { reason: 'inactive', isQuickRestart: false, activity: 'writing', duration: '5', musicChoice: 'white-noise' });
});

// ─── Safety ───────────────────────────────────────────────────────────────────

test('a free user is never defaulted to a premium-only duration', () => {
  const cases = [{}, store(row(daysAgo(1), 'coding', 45, 'none')), store(row(daysAgo(30), 'coding', 45, 'none'))];
  for (const c of cases) assert.notEqual(resolve(c).duration, '45');
});

test('future-dated rows (clock skew) are ignored', () => {
  assert.equal(findLastCompletedSession(store(row(NOW + 3600000, 'coding', 20, 'none')), NOW), null);
});

test('output only carries the three editable fields plus the reason and restart flag', () => {
  assert.deepEqual(Object.keys(resolve({})).sort(), ['activity', 'duration', 'isQuickRestart', 'musicChoice', 'reason']);
});

// ─── Quick restart (quickRestartPolicy.js) ────────────────────────────────────

test('re-loading a session done earlier today is a quick restart; the day\'s first session is not', () => {
  assert.equal(resolve(store(row(daysAgo(0, 8), 'coding', 20, 'none'))).isQuickRestart, true);
  // Yesterday late evening is still "not today" on the local calendar.
  assert.equal(resolve(store(row(daysAgo(1, 23), 'coding', 20, 'none'))).isQuickRestart, false);
  assert.equal(resolve({}).isQuickRestart, false);
  assert.equal(resolve(store(row(daysAgo(7), 'coding', 20, 'none'))).isQuickRestart, false);
});

test('free and premium users both get the last session as the default (gating is separate)', () => {
  const s = store(row(daysAgo(0, 8), 'editing', 15, 'lofi'));
  for (const isPremium of [false, true]) {
    const d = resolve(s, { isPremium });
    assert.deepEqual([d.activity, d.duration, d.musicChoice], ['editing', '15', 'lofi']);
  }
});
