// src/services/notificationHandler.js
import * as Notifications from 'expo-notifications';

export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      try {
        const data = notification.request.content.data;
        
        // Determine notification type
        const isCompletion = data?.shouldPlayAlarm || data?.type === 'sessionComplete';
        const isProgress = data?.type === 'progress';
        const isReminder = data?.type === 'reminder';
        
        // Completion: Show + Sound + Badge
        if (isCompletion) {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          };
        }
        
        // Progress: Show only (silent)
        if (isProgress) {
          return {
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
          };
        }
        
        // Default: Show + Sound
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
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