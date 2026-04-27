// src/services/sessionEndNotification.js
//
// WHY THIS WORKS RELIABLY ON iOS:
//
// Notifications.scheduleNotificationAsync with a `date` trigger calls
// UNUserNotificationCenter.add() — an OS-level API. Once registered, the
// notification lives in the iOS notification database, not in the JS runtime.
// iOS fires it at the exact trigger time regardless of:
//   - App state (foreground / background / killed)
//   - JS runtime state
//   - Network connectivity
//   - Background App Refresh setting (that only affects BGAppRefreshTask)
//
// The only things that can prevent delivery:
//   - User has revoked notification permissions (we check/request at session start)
//   - The notification was explicitly cancelled (we do this intentionally on early end)
//   - Device is in Do Not Disturb with no exceptions — mitigated by
//     interruptionLevel: 'timeSensitive' which iOS allows through most Focus modes
//
// This is categorically different from the Firebase FCM path in backgroundTimer.js:
//   FCM:    JS detects expiry → HTTP call → Firebase → APNs → device  (needs network + JS)
//   This:   OS fires at endTime, no intermediaries                     (needs nothing)
//
// Both can coexist: this fires reliably; FCM is kept for analytics.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_ID_KEY = '@session_end_notification_id';

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

/**
 * Checks (and requests if needed) Expo notification permissions.
 * On iOS, `messaging().requestPermission()` in useNotificationSetup already
 * triggered the system prompt, so this will usually just confirm the status.
 */
export const ensureNotificationPermissions = async () => {
  try {
    const existing = await Notifications.getPermissionsAsync();
    console.log('[SessionEnd] Permission check — status:', existing.status,
      '| allowsAlert:', existing.ios?.allowsAlert,
      '| allowsSound:', existing.ios?.allowsSound,
      '| allowsBadge:', existing.ios?.allowsBadge,
      '| allowsLockScreen:', existing.ios?.allowsDisplayOnLockScreen);

    if (existing.status === 'granted') return true;

    console.log('[SessionEnd] Requesting notification permissions...');
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
        allowCriticalAlerts: false,
      },
    });

    console.log('[SessionEnd] Permission request result:', requested.status,
      '| ios:', JSON.stringify(requested.ios ?? {}));

    if (requested.status !== 'granted') {
      console.error('[SessionEnd] CRITICAL: Notification permission denied —',
        'no session-end notification will be scheduled.',
        'User must enable in iOS Settings → DeepWork → Notifications');
    }

    return requested.status === 'granted';
  } catch (error) {
    console.warn('[SessionEnd] Permission check failed:', error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// Schedule the OS-level session end notification
// ---------------------------------------------------------------------------

/**
 * Schedule a local notification to fire at endTimeMs.
 *
 * Call this once at session start. The OS holds the scheduled notification —
 * it fires even if the app is closed or the phone is locked.
 *
 * @param {number} endTimeMs     - Unix ms timestamp when the session ends
 * @param {string} activityName  - Human-readable activity label
 * @param {number} durationMinutes - Session duration for the notification body
 * @returns {string|null} notification identifier, or null if scheduling failed
 */
export const scheduleSessionEndNotification = async (
  endTimeMs,
  activityName = 'Focus Session',
  durationMinutes
) => {
  try {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) {
      console.warn('[SessionEnd] Notifications not permitted — skipping schedule');
      return null;
    }

    // Cancel any stale scheduled notification first (prevents duplicates on
    // quick session restart or app reload that calls initializeSession again)
    await cancelSessionEndNotification();

    const endDate = new Date(endTimeMs);

    // Guard: never schedule in the past (would fire immediately and confuse user)
    if (endDate <= new Date()) {
      console.warn('[SessionEnd] endTime is already past — skipping schedule');
      return null;
    }

    const durationLabel = durationMinutes != null
      ? `${Math.round(durationMinutes)}-minute `
      : '';

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Session Complete 🎉',
        body: `Great work! Your ${durationLabel}${activityName} session is done.`,
        // The .wav file is bundled via app.config.js expo-notifications sounds array
        sound: 'completion_alarm.wav',
        data: { type: 'session_end' },
        badge: 1,

        // iOS: 'timeSensitive' breaks through Focus modes (Airplane, Do Not Disturb)
        // without requiring the Critical Alerts entitlement.
        // 'active' (default) would be silenced by Focus modes.
        ...(require('react-native').Platform.OS === 'ios' && {
          interruptionLevel: 'timeSensitive',
        }),

        // Android: HIGH importance shows heads-up banner on lock screen + vibration
        ...(require('react-native').Platform.OS === 'android' && {
          channelId: 'session-completion', // already created in backgroundTimer.js
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 500, 200, 500, 200, 500],
        }),
      },
      trigger: {
        // `date` trigger → handed to OS scheduler, fires regardless of JS state
        // expo-notifications 0.20+ requires explicit `type` field — omitting it
        // throws a TypeError that is silently caught, preventing scheduling.
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endDate,
      },
    });

    await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
    // Written here so checkMissedCompletion() in App.js can detect a session that
    // ended while the app was backgrounded/killed and the user never tapped the notification.
    await AsyncStorage.setItem('@session_end_time', String(endTimeMs));

    console.log(
      `[SessionEnd] Notification scheduled for ${endDate.toLocaleTimeString()}, ` +
      `in ${Math.round((endTimeMs - Date.now()) / 1000)}s, id: ${id}`
    );
    return id;

  } catch (error) {
    console.error('[SessionEnd] Failed to schedule notification:', error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Cancel — call when session ends normally (in-app) or is abandoned
// ---------------------------------------------------------------------------

/**
 * Cancel the pending session end notification.
 * Call from handleTimeout (app is foregrounded, handling completion in-app)
 * and from cleanup() (session abandoned early).
 */
export const cancelSessionEndNotification = async () => {
  try {
    const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
      console.log('[SessionEnd] Scheduled notification cancelled');
    }
    await AsyncStorage.removeItem('@session_end_time');
  } catch (error) {
    // Non-critical — worst case the notification fires after session already ended
    console.warn('[SessionEnd] Cancel failed (non-critical):', error);
  }
};
