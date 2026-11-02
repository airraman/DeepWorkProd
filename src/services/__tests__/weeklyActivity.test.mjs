// Run with: node --test src/services/__tests__/weeklyActivity.test.mjs
// A US timezone, so local evening falls on the next UTC day.
process.env.TZ = 'America/Los_Angeles';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLast7Days,
  isQualifyingSession,
  computeWeeklyActivity,
  hasQualifyingActivityLast7Days,
} from '../weeklyActivity.js';

// Wed Nov 4 2026, 12:00 UTC. Grid: Oct 29 .. Nov 4 (UTC days).
const NOW = Date.UTC(2026, 10, 4, 12, 0);
const session = (minutes = 25) => ({ duration: minutes, timestamp: NOW });

test('grid is the last 7 UTC days, oldest first, ending today', () => {
  assert.deepEqual(getLast7Days(NOW), [
    '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    '2026-11-02', '2026-11-03', '2026-11-04',
  ]);
});

test('zero sessions: suppressed', () => {
  assert.equal(hasQualifyingActivityLast7Days({}, NOW), false);
  assert.equal(hasQualifyingActivityLast7Days(null, NOW), false);
  assert.equal(computeWeeklyActivity({}, NOW).every((d) => !d.completed), true);
});

test('zero in the window, older history only: suppressed', () => {
  assert.equal(hasQualifyingActivityLast7Days({ '2026-10-28': [session()] }, NOW), false); // 7 days ago
  assert.equal(hasQualifyingActivityLast7Days({ '2026-09-01': [session(), session()] }, NOW), false);
});

test('one completed session: shown, exactly one day filled', () => {
  const sessions = { '2026-11-02': [session()] };
  assert.equal(hasQualifyingActivityLast7Days(sessions, NOW), true);
  const filled = computeWeeklyActivity(sessions, NOW).filter((d) => d.completed).map((d) => d.date);
  assert.deepEqual(filled, ['2026-11-02']);
});

test('one session on each window edge counts', () => {
  assert.equal(hasQualifyingActivityLast7Days({ '2026-10-29': [session()] }, NOW), true); // oldest day
  assert.equal(hasQualifyingActivityLast7Days({ '2026-11-04': [session()] }, NOW), true); // today
});

test('multiple sessions across days: shown, each active day filled once', () => {
  const sessions = {
    '2026-10-30': [session(15), session(30)],
    '2026-11-01': [session(45)],
    '2026-11-04': [session(5)],
  };
  assert.equal(hasQualifyingActivityLast7Days(sessions, NOW), true);
  assert.deepEqual(
    computeWeeklyActivity(sessions, NOW).map((d) => d.completed),
    [false, true, false, true, false, false, true]);
});

test('malformed or zero-length rows never fill a day', () => {
  const sessions = {
    '2026-11-01': [null, {}, { duration: 0 }, { duration: 'abc' }, { duration: -5 }],
    '2026-11-02': 'not-an-array',
    '2026-11-03': [],
  };
  assert.equal(hasQualifyingActivityLast7Days(sessions, NOW), false);
});

test('a malformed row next to a real one: the day still counts', () => {
  assert.equal(hasQualifyingActivityLast7Days({ '2026-11-03': [{ duration: 0 }, session()] }, NOW), true);
});

test('UTC boundary: a US evening session keyed to the next UTC day is still inside the grid', () => {
  // Nov 3, 8 pm Pacific = Nov 4 04:00 UTC, so the store files it under 2026-11-04.
  const eveningNow = new Date(2026, 10, 3, 20, 30).getTime();
  const key = new Date(eveningNow).toISOString().split('T')[0];
  assert.equal(key, '2026-11-04');
  assert.equal(hasQualifyingActivityLast7Days({ [key]: [session()] }, eveningNow), true);
  assert.equal(getLast7Days(eveningNow).at(-1), '2026-11-04');
});

test('isQualifyingSession', () => {
  assert.equal(isQualifyingSession({ duration: 25 }), true);
  assert.equal(isQualifyingSession({ duration: '0.25' }), true); // dev 15 s session
  assert.equal(isQualifyingSession({ duration: 0 }), false);
  assert.equal(isQualifyingSession(undefined), false);
});
