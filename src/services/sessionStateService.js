// src/services/sessionStateService.js
//
// PHASE 2: Single source of truth for in-flight session state.
//
// All session timing, activity config, music selection, focus-lock flag, OS
// notification id, and paused-state live in ONE AsyncStorage key:
//
//   @active_session_config = {
//     startTime,         // ms — when the session began
//     endTime,           // ms — when the timer expires (null while paused)
//     activity,          // activity id
//     duration,          // minutes
//     musicChoice,       // 'lofi' | 'white-noise' | 'none'
//     focusLockEnabled,  // bool
//     notificationId,    // OS-scheduled session-end notification id (or null)
//     isPaused,          // bool
//     remainingAtPause,  // ms remaining at the moment of pause (null when running)
//   }
//
// The legacy keys @session_end_time and @session_remaining_ms are no longer
// read or written anywhere in the app. They have been folded into the record
// above as endTime + remainingAtPause.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_KEY = '@active_session_config';
const LAST_KEY   = '@last_session_config';

// ─── Active session (in-flight) ───────────────────────────────────────────────

/**
 * Persist the full session record. Called once at session start.
 */
export const setActiveSession = async (session) => {
  try {
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify({
      startTime:        session.startTime,
      endTime:          session.endTime ?? null,
      activity:         session.activity,
      duration:         session.duration,
      musicChoice:      session.musicChoice,
      focusLockEnabled: session.focusLockEnabled ?? false,
      notificationId:   session.notificationId ?? null,
      isPaused:         session.isPaused ?? false,
      remainingAtPause: session.remainingAtPause ?? null,
    }));
  } catch (error) {
    console.warn('[sessionStateService] setActiveSession failed:', error);
  }
};

// PHASE 4: removed the saveActiveSession back-compat alias. All call sites use
// setActiveSession directly.

/**
 * Patch a subset of fields on the active session. Used to:
 *   - write notificationId once scheduleSessionEndNotification returns
 *   - flip isPaused / remainingAtPause / endTime on pause and resume
 */
export const updateActiveSession = async (partial) => {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!raw) return;
    const current = JSON.parse(raw);
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch (error) {
    console.warn('[sessionStateService] updateActiveSession failed:', error);
  }
};

/**
 * Remove the active session marker. Called from cleanup() on completion or
 * abandonment.
 */
export const clearActiveSession = async () => {
  try {
    await AsyncStorage.removeItem(ACTIVE_KEY);
  } catch (_) {}
};

/**
 * Same effect as clearActiveSession — kept as a separate export so HomeScreen
 * "abandon" / "skip" call sites read intuitively.
 */
export const discardActiveSession = clearActiveSession;

/**
 * Read the in-flight session. Returns:
 *   null                                       — no active session
 *   { config, endTime, status: 'running' }     — timer hasn't expired yet
 *   { config, endTime, status: 'expired' }     — timer expired while app was away
 *   { config, endTime: null, status: 'paused' } — session was paused
 *
 * `config` is the full record (matches the shape stored by setActiveSession).
 * `endTime` is mirrored to the top level for backward-compatible call sites
 * (HomeScreen.handleSaveExpiredSession reads activeSession.endTime).
 */
export const getActiveSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw);

    // Malformed record (e.g. legacy shape from a pre-Phase-2 build): drop it.
    if (!config || (config.endTime == null && !config.isPaused)) {
      await AsyncStorage.removeItem(ACTIVE_KEY);
      return null;
    }

    if (config.isPaused) {
      // Match pre-Phase-2 behavior: paused sessions don't survive an app kill.
      // The old useSessionTimer.pause() removed @session_end_time, and the old
      // getActiveSession() returned null for "config-without-endTime" (and
      // cleaned up the orphan record). Preserve that exact UX so HomeScreen
      // doesn't suddenly start showing "Session ended while away" for paused
      // sessions that the user just walked away from.
      await AsyncStorage.removeItem(ACTIVE_KEY);
      return null;
    }

    return {
      config,
      endTime: config.endTime,
      status: config.endTime > Date.now() ? 'running' : 'expired',
    };
  } catch (_) {
    return null;
  }
};

// ─── Last completed session (quick restart) ───────────────────────────────────

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

export const getLastSessionConfig = async () => {
  try {
    const raw = await AsyncStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw);
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    if (Date.now() - config.completedAt > FOUR_HOURS) return null;
    return config;
  } catch (_) {
    return null;
  }
};

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
