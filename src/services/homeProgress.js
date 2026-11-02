// homeProgress.js — the contextual progress line at the top of Home.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/homeProgress.test.mjs). Every number comes
// from completed sessions in deepWorkStore; nothing is estimated.
//
// Dates are the device's local calendar days with Monday-start weeks — the
// same helpers the Insights engine uses, so Home and Insights always agree
// on what "today" and "this week" mean.

import {
  startOfWeek,
  shiftDays,
  localDateKey,
  formatMinutes,
  plural,
} from './insights/insightEngine.js';

// No session for this many days (and none this week) = "Welcome back".
export const WELCOME_BACK_DAYS = 7;
// A run of consecutive active days is mentioned from this length.
const MIN_RUN_DAYS = 2;

const DAY_START = (ms) => new Date(ms).setHours(0, 0, 0, 0);

/**
 * Flatten deepWorkStore.getSessions() ({ 'YYYY-MM-DD': [session] }) into
 * { ms, minutes } using each session's own timestamp. Sessions without a
 * usable time or duration are left out rather than guessed.
 */
export function normalizeStoreSessions(sessionsByDate) {
  return Object.values(sessionsByDate || {})
    .flat()
    .map((s) => {
      const ms = typeof s?.timestamp === 'number' ? s.timestamp : Date.parse(s?.completedAt);
      const minutes = Number(s?.duration);
      return Number.isFinite(ms) && Number.isFinite(minutes) && minutes > 0
        ? { ms, minutes }
        : null;
    })
    .filter(Boolean);
}

/**
 * Consecutive local days with a session, ending today or yesterday
 * (a run is still live until a full day is missed).
 */
export function currentRunDays(sessions, nowMs) {
  const days = new Set(sessions.map((s) => localDateKey(s.ms)));
  let cursor = days.has(localDateKey(nowMs)) ? nowMs : shiftDays(nowMs, -1);
  let run = 0;
  while (days.has(localDateKey(cursor))) {
    run += 1;
    cursor = shiftDays(cursor, -1);
  }
  return run;
}

const totals = (list) => ({
  count: list.length,
  minutes: list.reduce((sum, s) => sum + s.minutes, 0),
});

const sessionsAndTime = ({ count, minutes }) =>
  `${plural(count, 'session')} · ${formatMinutes(minutes)}`;

/**
 * @param {{ms: number, minutes: number}[]} sessions completed sessions
 * @param {number} nowMs
 * @returns {{ state: 'first_session'|'today'|'this_week'|'welcome_back'|'quiet_week',
 *            headline: string, detail: string|null }}
 */
export function getHomeProgress(sessions, nowMs) {
  const past = sessions.filter((s) => s.ms <= nowMs);
  if (past.length === 0) {
    return {
      state: 'first_session',
      headline: 'A small start counts.',
      detail: 'Five focused minutes is a real session.',
    };
  }

  const todayStart = DAY_START(nowMs);
  const weekStart = startOfWeek(nowMs);
  const lastWeekStart = shiftDays(weekStart, -7);

  const today = totals(past.filter((s) => s.ms >= todayStart));
  const week = totals(past.filter((s) => s.ms >= weekStart));
  const run = currentRunDays(past, nowMs);
  const runLine = run >= MIN_RUN_DAYS ? `${run} days in a row.` : null;

  if (today.count > 0) {
    return {
      state: 'today',
      headline: `Today: ${sessionsAndTime(today)}`,
      // Only mention the week when it adds something today doesn't.
      detail: week.count > today.count
        ? `This week: ${sessionsAndTime(week)}${runLine ? ` · ${run}-day run` : ''}`
        : runLine,
    };
  }

  if (week.count > 0) {
    return {
      state: 'this_week',
      headline: `This week: ${sessionsAndTime(week)}`,
      detail: runLine,
    };
  }

  const lastMs = Math.max(...past.map((s) => s.ms));
  const daysSinceLast = Math.round((todayStart - DAY_START(lastMs)) / 86400000);

  if (daysSinceLast >= WELCOME_BACK_DAYS) {
    const all = totals(past);
    return {
      state: 'welcome_back',
      headline: 'Welcome back.',
      detail: `${formatMinutes(all.minutes)} of focus so far. Pick up where you left off.`,
    };
  }

  // Nothing yet this week, last session within the past week — so it was
  // last week, and last week has at least one session.
  const lastWeek = totals(past.filter((s) => s.ms >= lastWeekStart && s.ms < weekStart));
  return {
    state: 'quiet_week',
    headline: `Last week: ${plural(lastWeek.count, 'session')}.`,
    detail: 'A new week starts with one.',
  };
}

/**
 * Weekly recap for the session summary's "Build on it" section. Called after
 * the just-completed session has been saved, so it is included in the counts.
 *
 * @param {{ms: number, minutes: number}[]} sessions completed sessions
 * @param {number} nowMs
 * @returns {{ weekCount: number, weekMinutes: number, allTimeCount: number, headline: string } | null}
 *   null when there's nothing real to report
 */
export function getWeekRecap(sessions, nowMs) {
  const past = sessions.filter((s) => s.ms <= nowMs);
  if (past.length === 0) return null;

  const week = totals(past.filter((s) => s.ms >= startOfWeek(nowMs)));
  if (week.count === 0) return null;

  let headline;
  if (past.length === 1) {
    headline = 'Your first session is done.';
  } else if (week.count === 1) {
    headline = 'Your first session this week.';
  } else {
    // Sub-minute totals (dev-only 15-second sessions) would read "0m".
    const time = week.minutes >= 1 ? ` · ${formatMinutes(week.minutes)}` : '';
    headline = `That's ${week.count} sessions this week${time}.`;
  }
  return { weekCount: week.count, weekMinutes: week.minutes, allTimeCount: past.length, headline };
}
