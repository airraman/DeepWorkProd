// notificationPrefsRules.js — the user-controllable notification categories
// and how a stored preferences doc maps to on/off.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/notificationPrefsRules.test.mjs). Mirrors
// functions/morningActivation.js (isDailyReminderEnabled,
// isReengagementEnabled, isWeeklySummaryEnabled) — keep the two in sync.
//
// A stored value always wins; defaults only fill a missing field and are
// never written back over an existing doc. Session-end alerts are not a
// category here: they're local, part of the focus session itself, and not
// controlled by these settings.

export const NOTIFICATION_CATEGORIES = [
  {
    key: 'dailyReminders',
    field: 'dailyReminder.enabled',
    label: 'Daily focus reminder',
    description: 'A morning nudge on days you haven\'t focused yet, plus an evening note when you\'re on a run.',
    defaultEnabled: true,
  },
  {
    key: 'reengagement',
    field: 'reengagement',
    label: 'Come-back reminders',
    description: 'An occasional note after a few quiet days. Never more than twice a week.',
    defaultEnabled: true,
  },
  {
    key: 'weeklyRecap',
    field: 'weeklySummary',
    label: 'Weekly recap',
    description: 'Your focus week in one notification, Monday mornings.',
    defaultEnabled: true,
  },
];

/**
 * @param {object|null} prefs users/{uid}/preferences/notifications data
 * @returns {{dailyReminders: boolean, reengagement: boolean, weeklyRecap: boolean}}
 */
export function resolveNotificationCategories(prefs) {
  return {
    dailyReminders: prefs?.dailyReminder?.enabled !== false,
    reengagement: prefs?.reengagement !== false,
    weeklyRecap: prefs?.weeklySummary !== false,
  };
}

/**
 * The minimal Firestore merge payload that changes one category and nothing
 * else (dailyReminder.time / timezone and every other field are left alone).
 * @param {'dailyReminders'|'reengagement'|'weeklyRecap'} key
 * @param {boolean} enabled
 * @returns {object|null} null for an unknown key
 */
export function categoryUpdate(key, enabled) {
  const value = enabled === true;
  switch (key) {
    case 'dailyReminders': return { dailyReminder: { enabled: value } };
    case 'reengagement': return { reengagement: value };
    case 'weeklyRecap': return { weeklySummary: value };
    default: return null;
  }
}
