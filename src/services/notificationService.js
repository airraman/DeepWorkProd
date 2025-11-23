// src/services/notificationService.js
import * as Notifications from 'expo-notifications';
import { deepWorkStore } from './deepWorkStore';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Message variations that will rotate randomly
const NOTIFICATION_MESSAGES = [
  {
    title: "Ready for deep work? 🧠",
    body: "Start a focused session and build your productivity streak"
  },
  {
    title: "Time to build momentum ⚡",
    body: "Your best work happens in deep focus"
  },
  {
    title: "Let's make today productive 💪",
    body: "Start a deep work session and stay on track"
  },
  {
    title: "Keep your streak alive 🔥",
    body: "Consistency is the key to success"
  },
  {
    title: "Your focus time awaits 📚",
    body: "Build momentum with a deep work session"
  }
];

class NotificationService {
  /**
   * Request notification permissions from user
   */
  async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      console.log('📱 Notification permission status:', finalStatus);
      return finalStatus === 'granted';
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Check if user already completed a session today
   */
  async hasSessionToday() {
    try {
      const sessions = await deepWorkStore.getSessions();
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = sessions[today] || [];
      return todaySessions.length > 0;
    } catch (error) {
      console.error('❌ Error checking today sessions:', error);
      return false;
    }
  }

  /**
   * Get a random notification message
   */
  getRandomMessage() {
    const randomIndex = Math.floor(Math.random() * NOTIFICATION_MESSAGES.length);
    return NOTIFICATION_MESSAGES[randomIndex];
  }

  /**
   * Schedule notifications based on user's preference
   */
  async scheduleNotifications() {
    try {
      // Get user's reminder frequency from onboarding
      const frequency = await deepWorkStore.getReminderFrequency();
      
      console.log('📅 Scheduling notifications with frequency:', frequency);
      
      // Cancel any existing notifications first
      await this.cancelAllNotifications();
      
      // Don't schedule if user chose 'none'
      if (frequency === 'none') {
        console.log('✅ User chose no reminders');
        return true;
      }
      
      // Check if user already had a session today
      const hasSession = await this.hasSessionToday();
      if (hasSession) {
        console.log('✅ User already had session today, skipping notification');
        return true;
      }
      
      // Get random message
      const message = this.getRandomMessage();
      
      // Schedule based on frequency
      if (frequency === 'daily') {
        // Daily at 9 AM
        await Notifications.scheduleNotificationAsync({
          content: {
            title: message.title,
            body: message.body,
            data: { type: 'reminder' },
          },
          trigger: {
            hour: 9,
            minute: 0,
            repeats: true,
          },
        });
        console.log('✅ Daily notification scheduled for 9:00 AM');
      } else if (frequency === 'weekly') {
        // Weekly on Monday at 9 AM
        await Notifications.scheduleNotificationAsync({
          content: {
            title: message.title,
            body: message.body,
            data: { type: 'reminder' },
          },
          trigger: {
            weekday: 2, // Monday (Sunday = 1, Monday = 2, etc.)
            hour: 9,
            minute: 0,
            repeats: true,
          },
        });
        console.log('✅ Weekly notification scheduled for Monday 9:00 AM');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error scheduling notifications:', error);
      return false;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ Canceled all notifications');
      return true;
    } catch (error) {
      console.error('❌ Error canceling notifications:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error checking notification status:', error);
      return false;
    }
  }

  /**
   * Get scheduled notifications (for debugging)
   */
  async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('📋 Scheduled notifications:', notifications);
      return notifications;
    } catch (error) {
      console.error('❌ Error getting scheduled notifications:', error);
      return [];
    }
  }
}

export const notificationService = new NotificationService();