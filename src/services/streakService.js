// src/services/streakService.js
//
// Streak tracking: counts consecutive days on which the user completed at least
// one focus session. Also manages the "streak risk" local notification that fires
// at 7 pm if the user hasn't focused yet that day.
//
// Storage key: @streak_data  { count: number, lastSessionDate: 'YYYY-MM-DD' }
// All dates are UTC ISO date strings (toISOString().split('T')[0]) for consistency
// across time zones.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import auth from '@react-native-firebase/auth';
import firestore from '../config/firebaseConfig';
import notificationPreferences from './notificationPreferences';
import {
  decideStreakRisk,
  buildStreakRiskContent,
  localDateKey,
} from './streakRiskPolicy';
import { resolveNotificationCategories } from './notificationPrefsRules';

const STREAK_KEY              = '@streak_data';
const STREAK_RISK_NOTIF_KEY   = '@streak_risk_notif_id';
const LAST_STREAK_MODAL_KEY   = '@last_streak_modal_seen';

// ─── Date helpers ─────────────────────────────────────────────────────────────

const utcToday = () => new Date().toISOString().split('T')[0];

const utcYesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
};

// ─── Streak read / write ──────────────────────────────────────────────────────

/**
 * Read current streak.
 * Auto-resets to 0 if the last session date was before yesterday (gap detected).
 * Does NOT reset the lastSessionDate — keeps it for display purposes.
 */
export const getStreak = async () => {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (!raw) return { count: 0, lastSessionDate: null };

    const data = JSON.parse(raw);
    const today     = utcToday();
    const yesterday = utcYesterday();

    // Streak is still live today or yesterday — no reset needed
    if (
      data.lastSessionDate === today ||
      data.lastSessionDate === yesterday
    ) {
      return data;
    }

    // Gap of 2+ days — streak broken, reset count but preserve lastSessionDate
    const reset = { count: 0, lastSessionDate: data.lastSessionDate };
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(reset));
    return reset;
  } catch (_) {
    return { count: 0, lastSessionDate: null };
  }
};

/**
 * Increment streak after a successful session completion.
 * Idempotent for the same day — calling twice on the same date does not double-count.
 *
 * @returns {{ count: number, lastSessionDate: string }} — the updated streak
 */
export const incrementStreak = async () => {
  try {
    const today     = utcToday();
    const yesterday = utcYesterday();
    const current   = await getStreak();

    if (current.lastSessionDate === today) {
      // Already counted today — idempotent
      return current;
    }

    const newCount =
      current.lastSessionDate === yesterday || current.count === 0
        ? current.count + 1   // extend streak
        : 1;                   // gap → reset to 1

    const updated = { count: newCount, lastSessionDate: today };
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(updated));
    console.log(`[StreakService] Streak updated: ${current.count} → ${newCount}`);
    return updated;
  } catch (error) {
    console.warn('[StreakService] incrementStreak failed:', error);
    return { count: 1, lastSessionDate: utcToday() };
  }
};

// ─── Streak risk notification ─────────────────────────────────────────────────

/**
 * Whether the backend already sent today's morning activation or
 * re-engagement push (users/{uid}/notificationState/dailyActivation, written
 * by functions/index.js). Fails open — returns false — if it can't be read,
 * so a read error never silences a streak reminder.
 */
const wasDailyPushSentToday = async () => {
  try {
    const uid = auth().currentUser?.uid;
    if (!uid) return false;
    const doc = await firestore()
      .collection('users')
      .doc(uid)
      .collection('notificationState')
      .doc('dailyActivation')
      .get();
    return doc.exists && doc.data()?.lastSentDate === localDateKey(new Date());
  } catch (_) {
    return false;
  }
};

/**
 * Schedule a local notification for 7 pm today if the user hasn't focused yet.
 * Safe to call on every app open — cancels and replaces any existing one.
 *
 * Only for streaks of 2+ days, only while daily reminders are enabled, and
 * not on a day the backend already sent a morning push — at most one Lucid
 * nudge a day (decision logic: streakRiskPolicy.js).
 *
 * @param {{ count: number, lastSessionDate: string|null }} streak
 */
export const scheduleStreakRiskNotification = async (streak) => {
  try {
    const prefs = await notificationPreferences.getPreferences().catch(() => null);
    const input = {
      streak,
      streakTodayKey:       utcToday(),
      now:                  new Date(),
      dailyReminderEnabled: resolveNotificationCategories(prefs).dailyReminders,
      dailyPushSentToday:   false,
    };

    // Cheap checks first; only read Firestore when we'd otherwise schedule.
    let decision = decideStreakRisk(input);
    if (decision.action === 'schedule' && await wasDailyPushSentToday()) {
      decision = decideStreakRisk({ ...input, dailyPushSentToday: true });
    }

    if (decision.action === 'cancel') {
      await cancelStreakRiskNotification();
      return;
    }
    if (decision.action !== 'schedule') return;

    // Cancel any stale notification from a previous app open
    const existingId = await AsyncStorage.getItem(STREAK_RISK_NOTIF_KEY);
    if (existingId) {
      await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
    }

    const { title, body } = buildStreakRiskContent(streak.count);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data:  { type: 'streak_risk' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: decision.date,
      },
    });

    await AsyncStorage.setItem(STREAK_RISK_NOTIF_KEY, id);
    console.log(`[StreakService] Risk notification scheduled for 7pm (id: ${id})`);
  } catch (error) {
    console.warn('[StreakService] scheduleStreakRiskNotification failed:', error);
  }
};

// ─── Streak modal seen helpers ────────────────────────────────────────────────

/**
 * Returns the date string (YYYY-MM-DD) of when the streak modal was last shown,
 * or null if it has never been shown.
 */
export const getLastStreakModalSeen = async () => {
  try {
    const value = await AsyncStorage.getItem(LAST_STREAK_MODAL_KEY);
    return value ?? null;
  } catch (_) {
    return null;
  }
};

/**
 * Persist the date on which the streak modal was shown.
 * @param {string} dateString — YYYY-MM-DD (use utcToday() for consistency)
 */
export const setLastStreakModalSeen = async (dateString) => {
  try {
    await AsyncStorage.setItem(LAST_STREAK_MODAL_KEY, dateString);
  } catch (error) {
    console.warn('[StreakService] setLastStreakModalSeen failed:', error);
  }
};

/**
 * Cancel the streak risk notification.
 * Call immediately after a successful session completion so the notification
 * doesn't fire at 7 pm for a user who has already focused.
 */
export const cancelStreakRiskNotification = async () => {
  try {
    const id = await AsyncStorage.getItem(STREAK_RISK_NOTIF_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(STREAK_RISK_NOTIF_KEY);
      console.log('[StreakService] Risk notification cancelled');
    }
  } catch (_) {}
};
