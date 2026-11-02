// analyticsEvents.js — parameter builders for Lucid's activation and
// retention GA4 events, plus the internal-user rule.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/analyticsEvents.test.mjs). analytics.js sends
// what these return.
//
// Privacy: every string parameter is checked against an allowlist, so free
// text (activity names, reflections, notification bodies) can never reach
// GA4. Unknown values are sent as 'other'. Flags are 0/1 numbers.

export const PRODUCTION_BUNDLE_ID = 'com.airraman.deepwork';

export const EVENTS = {
  HOME_PROGRESS_VIEWED: 'home_progress_viewed',
  SESSION_SUMMARY_VIEWED: 'session_summary_viewed',
  SESSION_START_ANOTHER_TAPPED: 'session_start_another_tapped',
  NOTIFICATION_OPENED: 'notification_opened',
};

const HOME_PROGRESS_STATES = ['first_session', 'today', 'this_week', 'welcome_back', 'quiet_week'];

// data.type values sent by functions/index.js (FCM) and by the app's own
// local notifications (sessionEndNotification, streakService,
// personalizedNotificationService).
const NOTIFICATION_TYPES = [
  'morning_activation', 're_engagement', 'weekly_performance', 'daily_reminder', 'insights_ready',
  'session_end', 'streak_risk', 'reengagement',
];
// data.segment (morning_activation), data.category (re_engagement) and
// data.subtype (local reengagement).
const NOTIFICATION_CATEGORIES = [
  'new', 'active', 'consistent', 'returning',
  'never_started', 'started_once_then_lapsed', 'one_week_lapse', 'high_engagement_lapse',
  'workedOn', 'aiSuggestion', 'fallback',
];
const NOTIFICATION_SOURCES = ['fcm', 'local'];
const APP_STATES = ['background', 'quit'];

const allow = (value, list) => (list.includes(value) ? value : 'other');
const flag = (value) => (value ? 1 : 0);
const wholeMinutes = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const dropNull = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined));

export function homeProgressViewedParams(state) {
  return { progress_state: allow(state, HOME_PROGRESS_STATES) };
}

/**
 * @param {object} input
 * @param {number} input.durationMinutes  completed session length
 * @param {number|null} input.weekSessionCount  null if the recap couldn't load
 * @param {boolean} input.hasNextStep  whether a next-step reflection exists (never its text)
 * @param {boolean} input.startAnotherAvailable
 * @param {boolean} input.isFirstSession
 */
export function sessionSummaryViewedParams({
  durationMinutes, weekSessionCount, hasNextStep, startAnotherAvailable, isFirstSession,
}) {
  return dropNull({
    session_duration_min: wholeMinutes(durationMinutes),
    week_session_count: Number.isInteger(weekSessionCount) ? weekSessionCount : null,
    has_next_step: flag(hasNextStep),
    start_another_available: flag(startAnotherAvailable),
    is_first_session: flag(isFirstSession),
  });
}

export function startAnotherTappedParams({ durationMinutes, weekSessionCount }) {
  return dropNull({
    session_duration_min: wholeMinutes(durationMinutes),
    week_session_count: Number.isInteger(weekSessionCount) ? weekSessionCount : null,
  });
}

/**
 * @param {object|undefined} data  the notification's data payload
 * @param {'fcm'|'local'} source
 * @param {'background'|'quit'|undefined} appState  FCM only; unknown for local taps
 */
export function notificationOpenedParams(data, source, appState) {
  const category = data?.segment ?? data?.category ?? data?.subtype;
  return dropNull({
    notification_type: allow(data?.type, NOTIFICATION_TYPES),
    notification_category: category === undefined ? null : allow(category, NOTIFICATION_CATEGORIES),
    notification_source: allow(source, NOTIFICATION_SOURCES),
    app_state: appState === undefined ? null : allow(appState, APP_STATES),
  });
}

/**
 * Internal / test traffic, reported as user property internal_user = 'true'
 * so it can be excluded from product reporting: any dev build, any non-
 * production bundle (the .dev app), or a uid in the internal allowlist.
 */
export function isInternalUser({ isDevBuild, applicationId, uid, internalUids }) {
  if (isDevBuild) return true;
  if (applicationId && applicationId !== PRODUCTION_BUNDLE_ID) return true;
  return !!uid && Array.isArray(internalUids) && internalUids.includes(uid);
}
