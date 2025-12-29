// src/services/notificationService.js - ENHANCED VERSION
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deepWorkStore } from './deepWorkStore';


// Configure notification handler
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

// ✨ ENHANCED: Time-based message variations
const NOTIFICATION_MESSAGES = {
  morning: [
    {
      title: "Start your day with some focus 🌅",
      body: "Morning is the best time for deep work"
    },
    {
      title: "Good morning! Ready to focus? ☀️",
      body: "Your most productive hours are waiting"
    },
    {
      title: "Rise and focus ⏰",
      body: "Begin your day with a deep work session"
    }
  ],
  afternoon: [
    {
      title: "Afternoon focus time 🎯",
      body: "Beat the midday slump with deep work"
    },
    {
      title: "Keep the momentum going 💪",
      body: "Your afternoon session awaits"
    },
    {
      title: "Time for focused work 📚",
      body: "Make progress on what matters most"
    }
  ],
  evening: [
    {
      title: "Evening deep work? 🌙",
      body: "End your day with a productive session"
    },
    {
      title: "One more session today? ⭐",
      body: "Finish strong with focused work"
    },
    {
      title: "Before you wind down... 🎵",
      body: "Consider a final focus session"
    }
  ],
  // ✨ NEW: Streak-based messages
  streak_continuing: [
    {
      title: "Keep your {streak}-day streak alive! 🔥",
      body: "You're on a roll! Start a session today"
    },
    {
      title: "{streak} days strong! 💪",
      body: "Don't break the chain - focus today"
    }
  ],
  streak_starting: [
    {
      title: "Start your focus journey today 🚀",
      body: "Build a streak one session at a time"
    },
    {
      title: "Every streak starts with one session 🌱",
      body: "Begin your deep work practice now"
    }
  ]
};

class NotificationService {
  constructor() {
    this.notificationIdentifiers = [];
  }

  /**
   * Request notification permissions
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
   * ✨ ENHANCED: Check if user had a RECENT session (within last 3 hours)
   * This prevents spamming but still reminds if they haven't focused in a while
   */
  async hasRecentSession() {
    try {
      const sessions = await deepWorkStore.getSessions();
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = sessions[today] || [];
      
      if (todaySessions.length === 0) return false;
      
      // Check if last session was within past 3 hours
      const lastSession = todaySessions[todaySessions.length - 1];
      const lastSessionTime = new Date(lastSession.timestamp);
      const threeHoursAgo = new Date(Date.now() - (3 * 60 * 60 * 1000));
      
      return lastSessionTime > threeHoursAgo;
    } catch (error) {
      console.error('❌ Error checking recent session:', error);
      return false;
    }
  }

  /**
   * ✨ NEW: Get user's current streak
   */
  async getCurrentStreak() {
    try {
      const sessions = await deepWorkStore.getSessions();
      const dates = Object.keys(sessions).sort().reverse();
      
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < dates.length; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        if (sessions[dateStr] && sessions[dateStr].length > 0) {
          streak++;
        } else {
          break;
        }
      }
      
      return streak;
    } catch (error) {
      console.error('❌ Error calculating streak:', error);
      return 0;
    }
  }

  /**
   * ✨ ENHANCED: Get appropriate message based on time and streak
   */
  async getSmartMessage() {
    const hour = new Date().getHours();
    const streak = await this.getCurrentStreak();
    
    // Determine time of day
    let timeCategory;
    if (hour < 12) {
      timeCategory = 'morning';
    } else if (hour < 18) {
      timeCategory = 'afternoon';
    } else {
      timeCategory = 'evening';
    }
    
    // If user has a streak, use streak message 50% of the time
    if (streak > 2 && Math.random() > 0.5) {
      const messages = NOTIFICATION_MESSAGES.streak_continuing;
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      return {
        title: message.title.replace('{streak}', streak.toString()),
        body: message.body
      };
    }
    
    // Otherwise use time-based message
    const messages = NOTIFICATION_MESSAGES[timeCategory];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * ✨ ENHANCED: Schedule multiple notifications throughout the day
   */
  async scheduleNotifications() {
    try {
      const frequency = await deepWorkStore.getReminderFrequency();
      console.log('📅 Scheduling notifications with frequency:', frequency);
      
      // Cancel existing notifications
      await this.cancelAllNotifications();
      
      if (frequency === 'none') {
        console.log('✅ User chose no reminders');
        return true;
      }
      
      // ✨ ENHANCED: Multiple notification times
      const notificationTimes = this.getNotificationTimes(frequency);
      
      for (const time of notificationTimes) {
        await this.scheduleNotificationAtTime(time, frequency);
      }
      
      console.log(`✅ Scheduled ${notificationTimes.length} notifications`);
      return true;
    } catch (error) {
      console.error('❌ Error scheduling notifications:', error);
      return false;
    }
  }

  /**
   * ✨ NEW: Get notification times based on frequency
   */
  getNotificationTimes(frequency) {
    if (frequency === 'daily') {
      // Daily: 9 AM, 2 PM, 7 PM
      return [
        { hour: 9, minute: 0, label: 'morning' },
        { hour: 14, minute: 0, label: 'afternoon' },
        { hour: 19, minute: 0, label: 'evening' }
      ];
    } else if (frequency === 'weekly') {
      // Weekly: Monday 9 AM only
      return [
        { hour: 9, minute: 0, weekday: 2, label: 'morning' }
      ];
    }
    
    return [];
  }

  /**
   * ✨ NEW: Schedule single notification with smart content
   */
  async scheduleNotificationAtTime(time, frequency) {
    try {
      const message = await this.getSmartMessage();
      
      const trigger = {
        hour: time.hour,
        minute: time.minute,
        repeats: true
      };
      
      // Add weekday for weekly reminders
      if (time.weekday) {
        trigger.weekday = time.weekday;
      }
      
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          data: { 
            type: 'reminder',
            timeLabel: time.label
          },
          sound: true,
          badge: 1,
        },
        trigger
      });
      
      this.notificationIdentifiers.push(identifier);
      console.log(`✅ Scheduled ${time.label} notification at ${time.hour}:${time.minute}`);
      
    } catch (error) {
      console.error(`❌ Error scheduling ${time.label} notification:`, error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.notificationIdentifiers = [];
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
      console.log('📋 Scheduled notifications:', notifications.length);
      notifications.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(notif.trigger)}`);
      });
      return notifications;
    } catch (error) {
      console.error('❌ Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * ✨ NEW: Send immediate test notification
   */
  async sendTestNotification() {
    try {
      const message = await this.getSmartMessage();
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          data: { type: 'test' },
        },
        trigger: null, // Send immediately
      });
      
      console.log('✅ Test notification sent');
      return true;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return false;
    }
  }
  async logNotificationDelivery(notificationId, delivered) {
    try {
      const log = await AsyncStorage.getItem('@notification_delivery_log') || '[]';
      const logs = JSON.parse(log);
      
      logs.push({
        id: notificationId,
        delivered,
        timestamp: new Date().toISOString(),
        appState: 'unknown' // Will update when app opens
      });
      
      // Keep only last 50 logs to prevent storage bloat
      const trimmed = logs.slice(-50);
      await AsyncStorage.setItem('@notification_delivery_log', JSON.stringify(trimmed));
      
      console.log('📊 Notification delivery logged:', { 
        delivered, 
        total: trimmed.length,
        recentDeliveryRate: this._calculateRecentRate(trimmed)
      });
    } catch (error) {
      console.error('❌ Error logging notification delivery:', error);
    }
  }

  /**
   * ✨ NEW: Calculate recent delivery rate from logs
   * @private
   */
  _calculateRecentRate(logs) {
    if (logs.length === 0) return '0%';
    
    const delivered = logs.filter(l => l.delivered).length;
    const rate = (delivered / logs.length * 100).toFixed(1);
    return `${rate}%`;
  }

  /**
   * ✨ NEW: Get delivery statistics
   * 
   * INTERVIEW CONCEPT: Data-Driven Decision Making
   * - Quantify the problem before solving it
   * - Track improvement over time
   * - A/B test different strategies
   */
  async getDeliveryStats() {
    try {
      const log = await AsyncStorage.getItem('@notification_delivery_log') || '[]';
      const logs = JSON.parse(log);
      
      const total = logs.length;
      const delivered = logs.filter(l => l.delivered).length;
      const rate = total > 0 ? (delivered / total * 100).toFixed(1) : 0;
      
      const stats = { 
        total, 
        delivered, 
        rate: `${rate}%`,
        rawRate: parseFloat(rate)
      };
      
      console.log(`📊 Notification Delivery Rate: ${stats.rate} (${delivered}/${total})`);
      return stats;
    } catch (error) {
      console.error('❌ Error getting delivery stats:', error);
      return { total: 0, delivered: 0, rate: '0%', rawRate: 0 };
    }
  }

  async scheduleNextNotification() {
    try {
      const frequency = await deepWorkStore.getReminderFrequency();
      
      if (frequency === 'none') {
        console.log('⏭️ Reminders disabled - skipping scheduling');
        return null;
      }
      
      const now = new Date();
      const currentHour = now.getHours();
      
      // ✅ SMART LOGIC: Determine next notification time
      let nextHour, nextLabel, daysToAdd = 0;
      
      if (frequency === 'daily') {
        // Daily reminders: 9 AM, 2 PM, 7 PM
        if (currentHour < 9) {
          nextHour = 9;
          nextLabel = 'morning';
        } else if (currentHour < 14) {
          nextHour = 14;
          nextLabel = 'afternoon';
        } else if (currentHour < 19) {
          nextHour = 19;
          nextLabel = 'evening';
        } else {
          // After 7 PM, schedule tomorrow's 9 AM
          nextHour = 9;
          nextLabel = 'morning';
          daysToAdd = 1;
        }
      } else if (frequency === 'weekly') {
        // Weekly: Next Monday at 9 AM
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay) % 7;
        
        nextHour = 9;
        nextLabel = 'morning';
        daysToAdd = daysUntilMonday;
        
        // If today is Monday and before 9 AM, schedule for today
        if (currentDay === 1 && currentHour < 9) {
          daysToAdd = 0;
        }
      } else {
        console.warn('⚠️ Unknown frequency:', frequency);
        return null;
      }
      
      // ✅ Calculate exact trigger time
      const nextTrigger = new Date();
      nextTrigger.setHours(nextHour, 0, 0, 0);
      nextTrigger.setDate(nextTrigger.getDate() + daysToAdd);
      
      // Get smart message for this notification
      const message = await this.getSmartMessage();
      
      // ✅ CRITICAL: Use DATE trigger instead of CALENDAR trigger
      // DATE triggers are more reliable for iOS when app is backgrounded
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          data: { 
            type: 'reminder',
            timeLabel: nextLabel,
            scheduledFor: nextTrigger.toISOString(),
            frequency: frequency
          },
          sound: true,
          badge: 1,
        },
        trigger: {
          date: nextTrigger, // ← DATE trigger (not calendar with repeats)
        }
      });
      
      // Log for debugging
      const hoursUntil = (nextTrigger - now) / (1000 * 60 * 60);
      console.log(`✅ Next notification scheduled:`, {
        time: nextTrigger.toLocaleString(),
        label: nextLabel,
        hoursUntil: hoursUntil.toFixed(1),
        identifier: identifier
      });
      
      return identifier;
      
    } catch (error) {
      console.error('❌ Error scheduling next notification:', error);
      return null;
    }
  }


}

export const notificationService = new NotificationService();