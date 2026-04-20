// src/services/sessionStateService.js
//
// Lightweight service that persists session config alongside the timer keys so
// HomeScreen can detect and offer to resume or save an orphaned session after
// an app kill or unexpected background termination.
//
// Keys used:
//   @active_session_config  — written when session starts, cleared when it ends
//   @last_session_config    — written on successful completion for quick-restart
//
// These are additive to the existing timer keys in useSessionTimer:
//   @session_end_time       — read-only here (timer owns it)
//   @session_remaining_ms   — read-only here

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_KEY = '@active_session_config';
const LAST_KEY   = '@last_session_config';

// The timer hook owns this key — we read it but never write it.
const TIMER_END_KEY       = '@session_end_time';
const TIMER_REMAINING_KEY = '@session_remaining_ms';

// ─── Active session (in-flight) ───────────────────────────────────────────────

/**
 * Persist the session config as soon as the timer starts.
 * Called from DeepWorkSession.initializeSession() after start() succeeds.
 */
export const saveActiveSession = async (config) => {
  try {
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify({
      activity:         config.activity,
      duration:         config.duration,
      musicChoice:      config.musicChoice,
      focusLockEnabled: config.focusLockEnabled ?? false,
      startedAt:        Date.now(),
    }));
  } catch (error) {
    console.warn('[sessionStateService] saveActiveSession failed:', error);
  }
};

/**
 * Remove the active session marker.
 * Called from DeepWorkSession.cleanup() — fires on both completion and abandonment.
 */
export const clearActiveSession = async () => {
  try {
    await AsyncStorage.removeItem(ACTIVE_KEY);
  } catch (_) {}
};

/**
 * Check whether a session is still in-flight (or recently expired while the app
 * was in the background).
 *
 * Returns one of:
 *   null                                    — no orphaned session
 *   { config, endTime, status: 'running' }  — timer has not expired yet
 *   { config, endTime, status: 'expired' }  — timer expired while app was away
 */
export const getActiveSession = async () => {
  try {
    const [[, configRaw], [, endTimeRaw]] = await AsyncStorage.multiGet([
      ACTIVE_KEY,
      TIMER_END_KEY,
    ]);

    const config  = configRaw  ? JSON.parse(configRaw)          : null;
    const endTime = endTimeRaw ? parseInt(endTimeRaw, 10)        : null;

    // No orphaned state at all
    if (!config && !endTime) return null;

    // Timer key exists but config is missing — stale key from a pre-service version.
    // Clean up silently.
    if (!config && endTime) {
      await AsyncStorage.multiRemove([TIMER_END_KEY, TIMER_REMAINING_KEY]);
      return null;
    }

    // Config exists but timer ended normally (stop() cleared the key in cleanup).
    // clearActiveSession should have also removed ACTIVE_KEY, but guard anyway.
    if (config && !endTime) {
      await AsyncStorage.removeItem(ACTIVE_KEY);
      return null;
    }

    return {
      config,
      endTime,
      status: endTime > Date.now() ? 'running' : 'expired',
    };
  } catch (_) {
    return null;
  }
};

/**
 * Discard orphaned timer keys without saving the session.
 * Called when user taps "Abandon" or "Skip" in the interrupted-session modal.
 */
export const discardActiveSession = async () => {
  try {
    await AsyncStorage.multiRemove([
      ACTIVE_KEY,
      TIMER_END_KEY,
      TIMER_REMAINING_KEY,
    ]);
  } catch (_) {}
};

// ─── Last completed session (quick restart) ───────────────────────────────────

/**
 * Persist the config of the most recently *completed* session.
 * Called from DeepWorkSession.handleSessionComplete() on success.
 */
export const saveLastSessionConfig = async (config) => {
  try {
    await AsyncStorage.setItem(LAST_KEY, JSON.stringify({
      activity:         config.activity,
      activityName:     config.activityName || '',
      duration:         config.duration,
      musicChoice:      config.musicChoice,
      completedAt:      Date.now(),
      hasOfferedRestart: false,
    }));
  } catch (error) {
    console.warn('[sessionStateService] saveLastSessionConfig failed:', error);
  }
};

/**
 * Retrieve the last completed session config.
 * Returns null if none saved or if data is too old (> 4 hours).
 */
export const getLastSessionConfig = async () => {
  try {
    const raw = await AsyncStorage.getItem(LAST_KEY);
    if (!raw) return null;

    const config = JSON.parse(raw);

    // Only offer quick restart within 4 hours of the last session
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    if (Date.now() - config.completedAt > FOUR_HOURS) return null;

    return config;
  } catch (_) {
    return null;
  }
};

/**
 * Mark that the quick-restart modal has been shown for this session.
 * Prevents it from re-appearing on subsequent HomeScreen visits.
 */
export const markRestartOffered = async () => {
  try {
    const raw = await AsyncStorage.getItem(LAST_KEY);
    if (!raw) return;
    await AsyncStorage.setItem(LAST_KEY, JSON.stringify({
      ...JSON.parse(raw),
      hasOfferedRestart: true,
    }));
  } catch (_) {}
};
