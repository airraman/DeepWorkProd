// sessionDefaults.js — the activity / duration / music Home pre-selects so a
// session is one tap (Begin) away.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/sessionDefaults.test.mjs). Home applies the
// result only to fields the user (or a "Start another" prefill) hasn't
// already set, and never starts a session itself.
//
//   new        no completed sessions      → 5 min, first activity, no music
//   inactive   last session 7+ days ago   → 5 min, last activity and music
//   returning  otherwise                  → last completed session's config
//
// "7+ days" is the same local-calendar rule the Home progress line uses for
// "Welcome back", so the two never disagree.
//
// isQuickRestart: a "returning" default whose last session was earlier today
// re-loads a session the user just did, so Home treats it as a quick restart
// (quickRestartPolicy.js) — the day's first session never is.

import { WELCOME_BACK_DAYS } from './homeProgress.js';

export const FIRST_SESSION_MINUTES = 5;
// Mirrors HomeScreen.handleStartSession's long-session gate
// (!isPremium && duration >= 45). A free user is never pre-selected into a
// duration that Begin would block; 30 is the alternative that gate offers.
export const PREMIUM_DURATION_MINUTES = 45;
export const FREE_FALLBACK_MINUTES = 30;

const DAY_START = (ms) => new Date(ms).setHours(0, 0, 0, 0);

/**
 * Most recent completed session in deepWorkStore.getSessions() shape
 * ({ 'YYYY-MM-DD': [session] }), by its own timestamp. Rows without a
 * usable time or a positive duration are ignored.
 */
export function findLastCompletedSession(sessionsByDate, nowMs) {
  let last = null;
  Object.values(sessionsByDate || {}).forEach((day) => {
    if (!Array.isArray(day)) return;
    day.forEach((s) => {
      const ms = typeof s?.timestamp === 'number' ? s.timestamp : Date.parse(s?.completedAt);
      const minutes = Number(s?.duration);
      if (!Number.isFinite(ms) || ms > nowMs || !(minutes > 0)) return;
      if (!last || ms > last.ms) last = { ms, session: s };
    });
  });
  return last;
}

/**
 * @param {object} input
 * @param {Object} input.sessionsByDate  deepWorkStore.getSessions()
 * @param {string[]} input.activityIds   current activities, in display order
 * @param {number[]} input.durations     durations Home offers
 * @param {string[]} input.musicValues   music options Home offers, default first
 * @param {boolean} input.isPremium      from SubscriptionContext (loaded)
 * @param {number} input.nowMs
 * @returns {{ reason: 'new'|'inactive'|'returning', isQuickRestart: boolean,
 *             activity: string|null, duration: string|null, musicChoice: string|null }}
 *   Fields are Home's string forms; null means "leave it for the user".
 */
export function resolveSessionDefaults({
  sessionsByDate,
  activityIds,
  durations,
  musicValues,
  isPremium,
  nowMs,
}) {
  const offered = (minutes) => (durations.includes(minutes) ? minutes.toString() : null);
  const firstActivity = activityIds[0] ?? null;
  const defaultMusic = musicValues[0] ?? null;

  const last = findLastCompletedSession(sessionsByDate, nowMs);
  if (!last) {
    return {
      reason: 'new',
      isQuickRestart: false,
      activity: firstActivity,
      duration: offered(FIRST_SESSION_MINUTES),
      musicChoice: defaultMusic,
    };
  }

  const s = last.session;
  const activity = activityIds.includes(s.activity) ? s.activity : firstActivity;
  const musicChoice = musicValues.includes(s.musicChoice) ? s.musicChoice : defaultMusic;

  const daysSince = Math.round((DAY_START(nowMs) - DAY_START(last.ms)) / 86400000);
  if (daysSince >= WELCOME_BACK_DAYS) {
    return { reason: 'inactive', isQuickRestart: false, activity, duration: offered(FIRST_SESSION_MINUTES), musicChoice };
  }

  let minutes = parseFloat(s.duration);
  if (!isPremium && minutes >= PREMIUM_DURATION_MINUTES) minutes = FREE_FALLBACK_MINUTES;
  return {
    reason: 'returning',
    isQuickRestart: daysSince === 0,
    activity,
    // A duration no longer offered (e.g. a dev-only 15 s session) falls back
    // to the first-session length rather than a guess.
    duration: offered(minutes) ?? offered(FIRST_SESSION_MINUTES),
    musicChoice,
  };
}
