// src/services/monetizationService.js
//
// Shared helpers for all monetization gates.
// All functions are safe to call when state is missing — they return
// conservative defaults (i.e., no gate fires on missing data).

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  HAS_BLOCKED_APPS_DATE    : '@last_block_date',
  QUICK_RESTART_COUNT      : '@quick_restart_count',
  QUICK_RESTART_DATE       : '@last_quick_restart_date',
  POST_INSIGHT_SESSIONS    : '@post_insight_sessions_since_paywall',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

/** Compare two YYYY-MM-DD strings for same-day equality. */
export const isSameDay = (d1, d2) =>
  typeof d1 === 'string' && typeof d2 === 'string' && d1 === d2;

// ─── App-blocking gate ────────────────────────────────────────────────────────

/**
 * Returns true if the user has already used app-blocking at least once today.
 */
export const getBlockingUsedToday = async () => {
  try {
    const dateStr = await AsyncStorage.getItem(KEYS.HAS_BLOCKED_APPS_DATE);
    return isSameDay(dateStr, todayStr());
  } catch {
    return false;
  }
};

/**
 * Record that app-blocking was used today. Call after a session with
 * focusLockEnabled starts successfully.
 */
export const recordBlockingUsed = async () => {
  try {
    await AsyncStorage.setItem(KEYS.HAS_BLOCKED_APPS_DATE, todayStr());
    console.log('[monetizationService] Blocking usage recorded for today');
  } catch (err) {
    console.warn('[monetizationService] recordBlockingUsed failed:', err);
  }
};

// ─── Quick-restart gate ───────────────────────────────────────────────────────

/**
 * Returns how many quick restarts the user has performed today (0 if none or
 * if the stored date is not today).
 */
export const getQuickRestartsToday = async () => {
  try {
    const [[, dateStr], [, countStr]] = await AsyncStorage.multiGet([
      KEYS.QUICK_RESTART_DATE,
      KEYS.QUICK_RESTART_COUNT,
    ]);
    if (!isSameDay(dateStr, todayStr())) return 0;
    return parseInt(countStr || '0', 10);
  } catch {
    return 0;
  }
};

/**
 * Increment the quick-restart counter for today.
 * Resets automatically when the stored date is not today.
 */
export const incrementQuickRestarts = async () => {
  try {
    const today = todayStr();
    const [[, dateStr], [, countStr]] = await AsyncStorage.multiGet([
      KEYS.QUICK_RESTART_DATE,
      KEYS.QUICK_RESTART_COUNT,
    ]);
    const base = isSameDay(dateStr, today) ? parseInt(countStr || '0', 10) : 0;
    await AsyncStorage.multiSet([
      [KEYS.QUICK_RESTART_COUNT, String(base + 1)],
      [KEYS.QUICK_RESTART_DATE, today],
    ]);
    console.log('[monetizationService] Quick restarts today:', base + 1);
  } catch (err) {
    console.warn('[monetizationService] incrementQuickRestarts failed:', err);
  }
};

// ─── Post-insight frequency gate ─────────────────────────────────────────────

/**
 * Returns how many sessions have been completed since the post-insight
 * paywall was last shown. Used to enforce "once every 2 sessions".
 */
export const getPostInsightSessionCount = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.POST_INSIGHT_SESSIONS);
    return parseInt(raw || '0', 10);
  } catch {
    return 0;
  }
};

/**
 * Increment the counter. Call once per completed session on SessionSummaryScreen.
 */
export const incrementPostInsightSessionCount = async () => {
  try {
    const current = await getPostInsightSessionCount();
    await AsyncStorage.setItem(KEYS.POST_INSIGHT_SESSIONS, String(current + 1));
  } catch (err) {
    console.warn('[monetizationService] incrementPostInsightSessionCount failed:', err);
  }
};

/**
 * Reset after the post-insight paywall is shown. Next paywall fires 2 sessions later.
 */
export const resetPostInsightSessionCount = async () => {
  try {
    await AsyncStorage.setItem(KEYS.POST_INSIGHT_SESSIONS, '0');
  } catch (err) {
    console.warn('[monetizationService] resetPostInsightSessionCount failed:', err);
  }
};
