import analytics from '@react-native-firebase/analytics';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

const sanitizeString = (str, maxLen = 40) =>
  (str || 'unknown').toLowerCase().replace(/[\s-]+/g, '_').substring(0, maxLen);

export const logSessionStart = (duration, musicChoice, activityName) =>
  analytics().logEvent('dw_session_start', {
    session_length: parseFloat(duration),
    music_selected: sanitizeString(musicChoice || 'none'),
    activity_name: sanitizeString(activityName),
    app_version: APP_VERSION,
  });

  export const logSessionComplete = (duration, source = 'foreground') =>
    analytics().logEvent('session_complete', {
      session_length: parseFloat(duration),
      completion_source: source,
      app_version: APP_VERSION,
    });

export const logSessionAbandon = (elapsedSeconds, duration) =>
  analytics().logEvent('session_abandon', {
    elapsed_time: elapsedSeconds,
    session_length: parseFloat(duration),
    app_version: APP_VERSION,
  });

export const logSessionPause = (elapsedSeconds) =>
  analytics().logEvent('session_pause', {
    elapsed_time: elapsedSeconds,
  });

export const logSessionResume = (elapsedSeconds) =>
  analytics().logEvent('session_resume', {
    elapsed_time: elapsedSeconds,
  });

export const logNotificationScheduled = (label, frequency) =>
  analytics().logEvent('notification_scheduled', {
    time_label: sanitizeString(label),
    frequency: sanitizeString(frequency),
    app_version: APP_VERSION,
  });
