import analytics from '@react-native-firebase/analytics';
import * as Application from 'expo-application';
import { INTERNAL_UIDS } from '../config/analyticsInternalUsers';
import { EVENTS, isInternalUser, notificationOpenedParams } from './analyticsEvents';

// Fire-and-forget event tracking. Never awaited at call sites — analytics
// must not add latency to UI interactions.
export function trackEvent(name, params = {}) {
  analytics()
    .logEvent(name, params)
    .catch((error) => {
      console.warn(`[analytics] Failed to log ${name}:`, error.message);
    });
}

// Tie GA4 activity to the signed-in Firebase Auth uid (pseudonymous; never
// an email or name) so it can be joined with Firestore session data, and
// mark team/test traffic with user property internal_user. Called from
// AuthContext on every auth change; null on sign-out. Fire-and-forget.
export function identifyAnalyticsUser(uid) {
  const internal = isInternalUser({
    isDevBuild: __DEV__,
    applicationId: Application.applicationId,
    uid,
    internalUids: INTERNAL_UIDS,
  });
  Promise.all([
    analytics().setUserId(uid || null),
    analytics().setUserProperty('internal_user', internal ? 'true' : 'false'),
  ]).catch((error) => {
    console.warn('[analytics] Failed to set user identity:', error.message);
  });
}

// One notification_opened per tap. `data` is the notification's data payload;
// only allowlisted values from it are sent (see analyticsEvents.js).
export function trackNotificationOpened(data, source, appState) {
  trackEvent(EVENTS.NOTIFICATION_OPENED, notificationOpenedParams(data, source, appState));
}
