// src/services/notificationHandler.js
//
// PHASE 4: strict, minimal rule. The handler dispatches on
// notification.request.content.data.type:
//
//   'session_end' → shouldPlaySound: true (the OS plays completion_alarm.wav)
//   anything else → shouldPlaySound: false
//
// The handler MUST NOT trigger alarms or any other side effect — it returns
// only the display flags. Session-end alarm playback while the app is in the
// foreground is owned exclusively by DeepWorkSession.handleTimeout.

import * as Notifications from 'expo-notifications';

export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      try {
        const type = notification.request.content.data?.type;

        if (type === 'session_end') {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          };
        }

        // All other types (re-engagement, streak risk, anything else)
        // are displayed silently. Sound is reserved for session completion.
        return {
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        };
      } catch (error) {
        console.error('Notification handler error:', error);
        return {
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
    },
  });
};
