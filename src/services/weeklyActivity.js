// weeklyActivity.js — the 7-day grid shown by WeeklyStreakModal, and whether
// there is anything real to show in it.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/weeklyActivity.test.mjs).
//
// Day keys are UTC 'YYYY-MM-DD' strings — the same keys deepWorkStore files
// sessions under and the same days the modal draws — so "has activity" and
// "draws a filled day" can never disagree.
//
// deepWorkStore only holds completed sessions (abandoned sessions are never
// saved; expired ones are saved only once their timer ran out). Entries that
// aren't a session with a positive duration are still ignored, so a
// malformed row never fills a day.

/**
 * Last 7 UTC days, oldest first, ending today.
 * @param {number} nowMs
 * @returns {string[]}
 */
export function getLast7Days(nowMs = Date.now()) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowMs);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/** A stored row that represents a real completed session. */
export function isQualifyingSession(session) {
  const minutes = Number(session?.duration);
  return Number.isFinite(minutes) && minutes > 0;
}

/**
 * @param {Object} sessions — deepWorkStore.getSessions(): { 'YYYY-MM-DD': [session] }
 * @param {number} nowMs
 * @returns {{ date: string, completed: boolean }[]} 7 entries, oldest first
 */
export function computeWeeklyActivity(sessions, nowMs = Date.now()) {
  return getLast7Days(nowMs).map((date) => ({
    date,
    completed: Array.isArray(sessions?.[date]) && sessions[date].some(isQualifyingSession),
  }));
}

/**
 * True if at least one day in the modal's 7-day grid would be filled.
 * @param {Object} sessions
 * @param {number} nowMs
 * @returns {boolean}
 */
export function hasQualifyingActivityLast7Days(sessions, nowMs = Date.now()) {
  return computeWeeklyActivity(sessions, nowMs).some((day) => day.completed);
}
