// Run with: node --test src/services/__tests__/homeProgress.test.mjs
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getHomeProgress,
  normalizeStoreSessions,
  currentRunDays,
  WELCOME_BACK_DAYS,
} from '../homeProgress.js';

// Wednesday Nov 4 2026, 10:00 local. The week started Monday Nov 2.
const NOW = new Date(2026, 10, 4, 10, 0).getTime();
const at = (month, day, h = 9, m = 0) => new Date(2026, month, day, h, m).getTime();
const s = (ms, minutes = 25) => ({ ms, minutes });

test('no sessions: first-session invitation', () => {
  const p = getHomeProgress([], NOW);
  assert.equal(p.state, 'first_session');
  assert.equal(p.headline, 'A small start counts.');
});

test('a session today: today totals', () => {
  const p = getHomeProgress([s(at(10, 4, 8), 30), s(at(10, 4, 9), 15)], NOW);
  assert.equal(p.state, 'today');
  assert.equal(p.headline, 'Today: 2 sessions · 45m');
  assert.equal(p.detail, null); // the week adds nothing yet
});

test('today plus earlier this week: week line added, with a run', () => {
  const p = getHomeProgress([s(at(10, 2)), s(at(10, 3)), s(at(10, 4, 8), 60)], NOW);
  assert.equal(p.headline, 'Today: 1 session · 1h');
  assert.equal(p.detail, 'This week: 3 sessions · 1h 50m · 3-day run');
});

test('today with a run that started last week, nothing else this week', () => {
  const p = getHomeProgress([s(at(10, 1)), s(at(10, 2)), s(at(10, 3)), s(at(10, 4, 8))], NOW);
  assert.equal(p.state, 'today');
  assert.match(p.detail, /4-day run/);
});

test('active this week but not today', () => {
  const p = getHomeProgress([s(at(10, 2), 20), s(at(10, 3), 40)], NOW);
  assert.equal(p.state, 'this_week');
  assert.equal(p.headline, 'This week: 2 sessions · 1h');
  assert.equal(p.detail, '2 days in a row.');
});

test('this week, single day, no run mention', () => {
  const p = getHomeProgress([s(at(10, 2))], NOW);
  assert.equal(p.state, 'this_week');
  assert.equal(p.detail, null);
});

test('quiet week: nothing this week, last session last week', () => {
  const p = getHomeProgress([s(at(9, 29)), s(at(10, 1))], NOW); // Thu Oct 29, Sun Nov 1
  assert.equal(p.state, 'quiet_week');
  assert.equal(p.headline, 'Last week: 2 sessions.');
  assert.equal(p.detail, 'A new week starts with one.');
});

test('welcome back after 7+ days, with real lifetime total', () => {
  const p = getHomeProgress([s(at(8, 1), 90), s(at(9, 28), 45)], NOW); // last: Oct 28 = 7 days ago
  assert.equal(p.state, 'welcome_back');
  assert.equal(p.detail, '2h 15m of focus so far. Pick up where you left off.');
});

test('boundary: 6 days since last session is a quiet week, 7 is welcome back', () => {
  assert.equal(WELCOME_BACK_DAYS, 7);
  assert.equal(getHomeProgress([s(at(9, 29))], NOW).state, 'quiet_week'); // 6 days
  assert.equal(getHomeProgress([s(at(9, 28))], NOW).state, 'welcome_back'); // 7 days
});

test('Monday morning: last week counts as last week, not this week', () => {
  const monday = new Date(2026, 10, 2, 7, 0).getTime();
  const p = getHomeProgress([s(at(10, 1, 22))], monday); // Sunday 10 pm
  assert.equal(p.state, 'quiet_week');
  assert.equal(p.headline, 'Last week: 1 session.');
});

test('just after midnight: yesterday is not today', () => {
  const p = getHomeProgress([s(at(10, 3, 23, 50))], new Date(2026, 10, 4, 0, 5).getTime());
  assert.equal(p.state, 'this_week');
});

test('future-dated sessions (clock skew) are ignored', () => {
  assert.equal(getHomeProgress([s(NOW + 3600000)], NOW).state, 'first_session');
});

test('no message ever shows a zero count or empty text', () => {
  const cases = [
    [], [s(at(10, 4, 8))], [s(at(10, 2))], [s(at(10, 1))], [s(at(8, 1))],
    [s(at(10, 2)), s(at(10, 3)), s(at(10, 4, 8))],
  ];
  for (const c of cases) {
    const p = getHomeProgress(c, NOW);
    assert.ok(p.headline.trim().length > 0);
    assert.ok(!/\b0 sessions?\b|\b0m\b/.test(`${p.headline} ${p.detail || ''}`), JSON.stringify(p));
    if (p.detail !== null) assert.ok(p.detail.trim().length > 0);
  }
});

test('normalizeStoreSessions reads the deepWorkStore shape and drops unusable rows', () => {
  const store = {
    '2026-11-04': [
      { timestamp: at(10, 4, 8), duration: 25 },
      { completedAt: new Date(at(10, 4, 9)).toISOString(), duration: '15' },
      { timestamp: at(10, 4, 9), duration: 0 },
      { duration: 20 },
      null,
    ],
  };
  assert.deepEqual(normalizeStoreSessions(store), [s(at(10, 4, 8), 25), s(at(10, 4, 9), 15)]);
  assert.deepEqual(normalizeStoreSessions(null), []);
});

test('currentRunDays: live through yesterday, broken by a missed day', () => {
  assert.equal(currentRunDays([s(at(10, 2)), s(at(10, 3))], NOW), 2);
  assert.equal(currentRunDays([s(at(10, 1)), s(at(10, 2))], NOW), 0);
});

// ─── getWeekRecap (session summary "Build on it") ────────────────────────────

import { getWeekRecap } from '../homeProgress.js';

test('recap: very first session ever', () => {
  assert.equal(getWeekRecap([s(at(10, 4, 9))], NOW).headline, 'Your first session is done.');
});

test('recap: first session this week, with history', () => {
  const r = getWeekRecap([s(at(9, 20)), s(at(10, 4, 9))], NOW);
  assert.equal(r.headline, 'Your first session this week.');
  assert.equal(r.weekCount, 1);
  assert.equal(r.allTimeCount, 2);
});

test('recap: several this week, with real total time', () => {
  const r = getWeekRecap([s(at(10, 2), 30), s(at(10, 3), 45), s(at(10, 4, 9), 25)], NOW);
  assert.equal(r.headline, "That's 3 sessions this week · 1h 40m.");
});

test('recap: sub-minute dev sessions omit the time rather than show 0m', () => {
  const r = getWeekRecap([s(at(10, 3), 0.25), s(at(10, 4, 9), 0.25)], NOW);
  assert.equal(r.headline, "That's 2 sessions this week.");
});

test('recap: nothing real to report returns null', () => {
  assert.equal(getWeekRecap([], NOW), null);
  assert.equal(getWeekRecap([s(at(9, 20))], NOW), null); // only older weeks
  assert.equal(getWeekRecap([s(NOW + 60000)], NOW), null); // future-dated
});
