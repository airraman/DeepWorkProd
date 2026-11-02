// streakRiskPolicy.js — decides whether the 7 pm "streak risk" local
// notification should be scheduled, and what it says.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/streakRiskPolicy.test.mjs). streakService.js
// gathers the inputs and does the scheduling.

export const STREAK_RISK_MIN_DAYS = 2;
export const STREAK_RISK_HOUR = 19;

/**
 * YYYY-MM-DD in the device's local timezone — the same calendar day the
 * backend uses (it stores the device's timezone with the push token).
 */
export function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {object} input
 * @param {{count: number, lastSessionDate: string|null}} input.streak
 * @param {string} input.streakTodayKey  "today" in the streak's own date
 *   convention (streakService stores UTC dates)
 * @param {Date} input.now
 * @param {boolean} input.dailyReminderEnabled
 * @param {boolean} input.dailyPushSentToday  morning activation or
 *   re-engagement push already sent today by the backend
 * @returns {{action: 'schedule', date: Date} | {action: 'cancel'|'none', reason: string}}
 */
export function decideStreakRisk({
  streak,
  streakTodayKey,
  now,
  dailyReminderEnabled,
  dailyPushSentToday,
}) {
  if (streak?.lastSessionDate === streakTodayKey) {
    return { action: 'cancel', reason: 'focused_today' };
  }
  if (!dailyReminderEnabled) {
    return { action: 'cancel', reason: 'reminders_disabled' };
  }
  if ((streak?.count || 0) < STREAK_RISK_MIN_DAYS) {
    return { action: 'cancel', reason: 'streak_too_short' };
  }
  if (dailyPushSentToday) {
    return { action: 'cancel', reason: 'already_nudged_today' };
  }

  const sevenPm = new Date(now);
  sevenPm.setHours(STREAK_RISK_HOUR, 0, 0, 0);
  if (now >= sevenPm) {
    // Too late to schedule for today; a notification for today, if any,
    // has already fired.
    return { action: 'none', reason: 'past_7pm' };
  }
  return { action: 'schedule', date: sevenPm };
}

/**
 * Notification copy. The count is the user's real streak; no emoji or
 * loss framing.
 */
export function buildStreakRiskContent(count) {
  return {
    title: `${count} days in a row.`,
    body: 'A short session tonight keeps the run going.',
  };
}
