// functions/morningActivation.js - Pure decision + copy logic for the daily
// morning focus activation notification sent by dailyRemindersBatch.
//
// Kept free of firebase-admin so it can be unit tested with node:test
// (see __tests__/morningActivation.test.js). All Firestore reads/writes
// stay in index.js.

const DAY_MS = 24 * 60 * 60 * 1000;

// After this many daily pushes in a row with no session completed in
// between, stop sending until the user completes a session again.
const MAX_CONSECUTIVE_UNANSWERED = 3;

// A user is "consistent" with sessions on at least this many of the
// previous 7 local days.
const CONSISTENT_MIN_ACTIVE_DAYS = 3;

// A user is "active" if their last session was within this many local days
// before today. Older than that (and not consistent) is "returning".
const ACTIVE_MAX_DAYS_SINCE = 2;

const DEFAULT_REMINDER_TIME = "09:00";

/**
 * True if `timezone` is an IANA zone Intl accepts.
 * @param {*} timezone
 * @return {boolean}
 */
function isValidTimeZone(timezone) {
  if (typeof timezone !== "string" || timezone.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", {timeZone: timezone});
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * YYYY-MM-DD for epoch `ms` in `timezone`.
 * @param {number} ms
 * @param {string} timezone
 * @return {string}
 */
function localDateLabel(ms, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(ms));
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Local hour (0-23) for epoch `ms` in `timezone`.
 * @param {number} ms
 * @param {string} timezone
 * @return {number}
 */
function localHour(ms, timezone) {
  const hour = parseInt(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "2-digit", hour12: false,
  }).format(new Date(ms)), 10);
  // Some ICU builds render midnight as "24" under hour12: false.
  return hour === 24 ? 0 : hour;
}

/**
 * Whole calendar days from `fromLabel` to `toLabel` (both YYYY-MM-DD).
 * @param {string} fromLabel
 * @param {string} toLabel
 * @return {number}
 */
function daysBetweenLabels(fromLabel, toLabel) {
  const toUtc = (label) => {
    const [y, m, d] = label.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toLabel) - toUtc(fromLabel)) / DAY_MS);
}

/**
 * The user's timezone, or null if none is known. The token doc's timezone is
 * preferred: it's refreshed on every app launch, while the prefs doc's is
 * written once. Never falls back to UTC.
 * @param {object|null} prefs users/{uid}/preferences/notifications data
 * @param {object|null} tokenData fcm_tokens/{uid} data
 * @return {string|null}
 */
function resolveTimezone(prefs, tokenData) {
  return [tokenData?.timezone, prefs?.dailyReminder?.timezone]
      .find(isValidTimeZone) || null;
}

/**
 * Resolve the timezone and reminder hour to use, or null if the user can't
 * be scheduled safely.
 * @param {object|null} prefs users/{uid}/preferences/notifications data
 * @param {object|null} tokenData fcm_tokens/{uid} data
 * @return {{timezone: string, reminderHour: number}|null}
 */
function resolveSchedule(prefs, tokenData) {
  const timezone = resolveTimezone(prefs, tokenData);
  if (!timezone) return null;

  const time = prefs?.dailyReminder?.time || DEFAULT_REMINDER_TIME;
  const reminderHour = parseInt(String(time).split(":")[0], 10);
  const validHour = Number.isInteger(reminderHour) &&
    reminderHour >= 0 && reminderHour <= 23;
  if (!validHour) {
    return null;
  }
  return {timezone, reminderHour};
}

// Notification categories (users/{uid}/preferences/notifications):
//   daily focus reminders   dailyReminder.enabled  default ON (opt-out)
//   behavior re-engagement  reengagement           default ON
//   weekly recap            weeklySummary          default ON
// A stored value always wins; defaults only fill a missing field, and are
// never written back. The app uses the same rules (notificationPrefsRules.js).

/**
 * Daily focus reminders (morning activation). Opt-out: on unless
 * `dailyReminder.enabled === false`.
 * @param {object|null} prefs
 * @return {boolean}
 */
function isDailyReminderEnabled(prefs) {
  return prefs?.dailyReminder?.enabled !== false;
}

/**
 * Behavior-based re-engagement (lapsed / never-started pushes). On unless
 * `reengagement === false`.
 * @param {object|null} prefs
 * @return {boolean}
 */
function isReengagementEnabled(prefs) {
  return prefs?.reengagement !== false;
}

/**
 * Same default as the app: a missing prefs doc means the weekly summary is
 * on. Only an explicit `weeklySummary === false` opts out.
 * @param {object|null} prefs
 * @return {boolean}
 */
function isWeeklySummaryEnabled(prefs) {
  return prefs?.weeklySummary !== false;
}

/**
 * Classify the user for copy, from completed-session timestamps.
 * @param {number[]} sessionTimestamps epoch ms, any order
 * @param {number} nowMs
 * @param {string} timezone
 * @return {{segment: string, activeDaysLast7: number}}
 */
function classifySegment(sessionTimestamps, nowMs, timezone) {
  const valid = sessionTimestamps.filter((t) => typeof t === "number");
  if (valid.length === 0) return {segment: "new", activeDaysLast7: 0};

  const today = localDateLabel(nowMs, timezone);
  const activeDays = new Set();
  let mostRecent = -Infinity;
  valid.forEach((t) => {
    const label = localDateLabel(t, timezone);
    const ago = daysBetweenLabels(label, today);
    if (ago >= 1 && ago <= 7) activeDays.add(label);
    mostRecent = Math.max(mostRecent, t);
  });

  const activeDaysLast7 = activeDays.size;
  if (activeDaysLast7 >= CONSISTENT_MIN_ACTIVE_DAYS) {
    return {segment: "consistent", activeDaysLast7};
  }
  const lastLabel = localDateLabel(mostRecent, timezone);
  const daysSinceLast = daysBetweenLabels(lastLabel, today);
  if (daysSinceLast <= ACTIVE_MAX_DAYS_SINCE) {
    return {segment: "active", activeDaysLast7};
  }
  return {segment: "returning", activeDaysLast7};
}

/**
 * Copy per segment. Every number shown comes from the user's own sessions.
 * @param {{segment: string, activeDaysLast7: number}} classification
 * @return {{title: string, body: string}}
 */
function buildMorningActivationMessage({segment, activeDaysLast7}) {
  switch (segment) {
    case "consistent":
      return {
        title: "You've been making time for focused work.",
        body: `You focused on ${activeDaysLast7} of the last 7 days. ` +
          "Keep it going this morning.",
      };
    case "active":
      return {
        title: "Ready to make a little more progress today?",
        body: "Pick up where you left off with a focused session.",
      };
    case "returning":
      return {
        title: "A fresh day, a fresh start.",
        body: "What would you like to work on? " +
          "A short session is enough to begin.",
      };
    case "new":
    default:
      return {
        title: "Five minutes counts.",
        body: "Pick one thing and give it a short, focused session.",
      };
  }
}

/**
 * True if a session was completed after the last daily push was sent.
 * @param {object} state notificationState/dailyActivation data
 * @param {number|null} lastSessionMs
 * @return {boolean}
 */
function answeredSinceLastSend(state, lastSessionMs) {
  if (!state?.lastSentAtMs) return true;
  return typeof lastSessionMs === "number" &&
    lastSessionMs > state.lastSentAtMs;
}

/**
 * Suppress after MAX_CONSECUTIVE_UNANSWERED pushes with no session between.
 * @param {object} state
 * @param {number|null} lastSessionMs
 * @return {boolean}
 */
function isUnansweredCapReached(state, lastSessionMs) {
  if (answeredSinceLastSend(state, lastSessionMs)) return false;
  return (state.consecutiveUnanswered || 0) >= MAX_CONSECUTIVE_UNANSWERED;
}

/**
 * The counter value to store with a new send.
 * @param {object} state
 * @param {number|null} lastSessionMs
 * @return {number}
 */
function nextUnansweredCount(state, lastSessionMs) {
  if (answeredSinceLastSend(state, lastSessionMs)) return 1;
  return (state.consecutiveUnanswered || 0) + 1;
}

/**
 * FCM error codes meaning the token will never work again.
 * @param {*} error
 * @return {boolean}
 */
function isInvalidTokenError(error) {
  const code = error?.errorInfo?.code || error?.code;
  // messaging/invalid-argument is deliberately excluded: it also covers
  // malformed payloads, which say nothing about the token.
  return code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token";
}

module.exports = {
  MAX_CONSECUTIVE_UNANSWERED,
  isValidTimeZone,
  localDateLabel,
  localHour,
  resolveTimezone,
  resolveSchedule,
  isDailyReminderEnabled,
  isReengagementEnabled,
  isWeeklySummaryEnabled,
  classifySegment,
  buildMorningActivationMessage,
  isUnansweredCapReached,
  nextUnansweredCount,
  isInvalidTokenError,
};
