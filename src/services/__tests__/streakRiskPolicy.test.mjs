// Run with: node --test src/services/__tests__/streakRiskPolicy.test.mjs
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideStreakRisk,
  buildStreakRiskContent,
  localDateKey,
  STREAK_RISK_MIN_DAYS,
} from '../streakRiskPolicy.js';

const at = (h, m = 0) => new Date(2026, 10, 4, h, m); // Nov 4 2026, local
const base = {
  streak: { count: 3, lastSessionDate: '2026-11-03' },
  streakTodayKey: '2026-11-04',
  now: at(10),
  dailyReminderEnabled: true,
  dailyPushSentToday: false,
};

test('schedules 7 pm today for a 2+ day streak with no session yet', () => {
  const d = decideStreakRisk(base);
  assert.equal(d.action, 'schedule');
  assert.equal(d.date.getHours(), 19);
  assert.equal(d.date.getMinutes(), 0);
  assert.equal(localDateKey(d.date), '2026-11-04');
});

test('minimum streak is 2 days', () => {
  assert.equal(STREAK_RISK_MIN_DAYS, 2);
  assert.equal(decideStreakRisk({ ...base, streak: { count: 2, lastSessionDate: '2026-11-03' } }).action, 'schedule');
  for (const count of [0, 1]) {
    const d = decideStreakRisk({ ...base, streak: { count, lastSessionDate: '2026-11-03' } });
    assert.deepEqual(d, { action: 'cancel', reason: 'streak_too_short' });
  }
});

test('cancels once the user has focused today (existing behavior)', () => {
  const d = decideStreakRisk({ ...base, streak: { count: 4, lastSessionDate: '2026-11-04' } });
  assert.deepEqual(d, { action: 'cancel', reason: 'focused_today' });
});

test('respects the daily reminder preference', () => {
  const d = decideStreakRisk({ ...base, dailyReminderEnabled: false });
  assert.deepEqual(d, { action: 'cancel', reason: 'reminders_disabled' });
});

test('no overlap with a morning push already sent today', () => {
  const d = decideStreakRisk({ ...base, dailyPushSentToday: true });
  assert.deepEqual(d, { action: 'cancel', reason: 'already_nudged_today' });
});

test('past 7 pm: nothing to schedule (existing behavior)', () => {
  assert.deepEqual(decideStreakRisk({ ...base, now: at(19) }), { action: 'none', reason: 'past_7pm' });
  assert.deepEqual(decideStreakRisk({ ...base, now: at(22, 30) }), { action: 'none', reason: 'past_7pm' });
  assert.equal(decideStreakRisk({ ...base, now: at(18, 59) }).action, 'schedule');
});

test('handles a missing streak object', () => {
  assert.equal(decideStreakRisk({ ...base, streak: null }).action, 'cancel');
});

test('copy uses the real count, no emoji, no loss framing', () => {
  const { title, body } = buildStreakRiskContent(5);
  assert.equal(title, '5 days in a row.');
  assert.ok(!/\p{Extended_Pictographic}/u.test(title + body));
  assert.ok(!/alive|lose|break|before the day ends/i.test(title + body));
});

test('localDateKey uses the local calendar day', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});
