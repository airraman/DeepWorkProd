// src/services/notificationPreferences.js
/**
 * Notification Preferences Service
 * 
 * ARCHITECTURE v2 (Realtime Database):
 * - Primary storage: Firebase Realtime Database (cloud, syncs across devices)
 * - Fallback: AsyncStorage (local cache for offline)
 * - Smart defaults: All notifications ON by default
 * 
 * WHY REALTIME DATABASE:
 * - Multi-device sync (preferences follow user across devices)
 * - Real-time updates (changes sync instantly)
 * - Simple structure (perfect for user preferences)
 * - No gRPC issues (unlike Firestore)
 */

import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import deviceIdService from './deviceIdService';

const PREFS_STORAGE_KEY = '@notification_preferences';

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES = {
  sessionComplete: true,
  dailyReminder: {
    enabled: true,
    time: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  weeklySummary: true,
  updatedAt: new Date().toISOString(),
};

class NotificationPreferencesService {
  
  /**
   * Get user's notification preferences
   * 
   * FLOW:
   * 1. Try Realtime Database (cloud)
   * 2. Fallback to AsyncStorage cache (offline)
   * 3. Return defaults if nothing exists
   */
  async getPreferences() {
    try {
      const deviceId = await deviceIdService.getDeviceId();
      
      // Try Realtime Database first
      try {
        const snapshot = await database()
          .ref(`/users/${deviceId}/preferences/notifications`)
          .once('value');
        
        if (snapshot.exists()) {
          console.log('📋 [NotificationPrefs] Loaded from Realtime Database');
          const prefs = snapshot.val();
          
          // Cache locally for offline access
          await this._cachePreferences(prefs);
          
          return prefs;
        }
      } catch (dbError) {
        console.warn('⚠️ [NotificationPrefs] Realtime Database unavailable:', dbError.message);
      }
      
      // Fallback to local cache
      const cachedPrefs = await this._getCachedPreferences();
      if (cachedPrefs) {
        console.log('📋 [NotificationPrefs] Loaded from cache');
        return cachedPrefs;
      }
      
      // No preferences exist - return defaults
      console.log('📋 [NotificationPrefs] Using defaults');
      return DEFAULT_PREFERENCES;
      
    } catch (error) {
      console.error('❌ [NotificationPrefs] Error getting preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }
  
  /**
   * Save user's notification preferences
   * 
   * DUAL-WRITE PATTERN:
   * - Realtime Database (primary, cloud-synced)
   * - AsyncStorage (backup, offline support)
   */
  async savePreferences(preferences) {
    try {
      const deviceId = await deviceIdService.getDeviceId();
      
      // Validate preferences
      const validatedPrefs = this._validatePreferences(preferences);
      
      // Add timestamp
      const prefsWithTimestamp = {
        ...validatedPrefs,
        updatedAt: new Date().toISOString(),
      };
      
      // Save to Realtime Database
      try {
        await database()
          .ref(`/users/${deviceId}/preferences/notifications`)
          .set(prefsWithTimestamp);
        
        console.log('✅ [NotificationPrefs] Saved to Realtime Database');
      } catch (dbError) {
        console.warn('⚠️ [NotificationPrefs] Realtime Database save failed:', dbError.message);
      }
      
      // Save to local cache (always succeeds)
      await this._cachePreferences(prefsWithTimestamp);
      console.log('✅ [NotificationPrefs] Cached locally');
      
      return true;
      
    } catch (error) {
      console.error('❌ [NotificationPrefs] Error saving preferences:', error);
      return false;
    }
  }
  
  /**
   * Update a specific preference field
   */
  async updatePreference(field, value) {
    try {
      const currentPrefs = await this.getPreferences();
      
      // Handle nested fields (e.g., 'dailyReminder.time')
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        currentPrefs[parent] = {
          ...currentPrefs[parent],
          [child]: value,
        };
      } else {
        currentPrefs[field] = value;
      }
      
      return await this.savePreferences(currentPrefs);
      
    } catch (error) {
      console.error('❌ [NotificationPrefs] Error updating preference:', error);
      return false;
    }
  }
  
  /**
   * Enable/disable session complete notifications
   */
  async setSessionCompleteEnabled(enabled) {
    return await this.updatePreference('sessionComplete', enabled);
  }
  
  /**
   * Enable/disable daily reminders
   */
  async setDailyReminderEnabled(enabled) {
    return await this.updatePreference('dailyReminder.enabled', enabled);
  }
  
  /**
   * Set daily reminder time
   */
  async setDailyReminderTime(time) {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      console.error('❌ Invalid time format. Use HH:mm (e.g., "09:00")');
      return false;
    }
    
    return await this.updatePreference('dailyReminder.time', time);
  }
  
  /**
   * Update timezone (called when timezone changes)
   */
  async updateTimezone(timezone) {
    return await this.updatePreference('dailyReminder.timezone', timezone);
  }
  
  /**
   * Enable/disable weekly summary
   */
  async setWeeklySummaryEnabled(enabled) {
    return await this.updatePreference('weeklySummary', enabled);
  }
  
  /**
   * Reset to default preferences
   */
  async resetToDefaults() {
    console.log('🔄 [NotificationPrefs] Resetting to defaults');
    return await this.savePreferences(DEFAULT_PREFERENCES);
  }
  
  /**
   * PRIVATE: Validate preferences object
   */
  _validatePreferences(prefs) {
    const validated = {
      sessionComplete: typeof prefs.sessionComplete === 'boolean' 
        ? prefs.sessionComplete 
        : true,
      
      dailyReminder: {
        enabled: typeof prefs.dailyReminder?.enabled === 'boolean'
          ? prefs.dailyReminder.enabled
          : true,
        time: prefs.dailyReminder?.time || '09:00',
        timezone: prefs.dailyReminder?.timezone || 
          Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      
      weeklySummary: typeof prefs.weeklySummary === 'boolean'
        ? prefs.weeklySummary
        : true,
    };
    
    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(validated.dailyReminder.time)) {
      console.warn('⚠️ Invalid time format, using 09:00');
      validated.dailyReminder.time = '09:00';
    }
    
    return validated;
  }
  
  /**
   * PRIVATE: Cache preferences locally
   */
  async _cachePreferences(prefs) {
    try {
      await AsyncStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify(prefs)
      );
    } catch (error) {
      console.warn('⚠️ [NotificationPrefs] Failed to cache:', error);
    }
  }
  
  /**
   * PRIVATE: Get cached preferences
   */
  async _getCachedPreferences() {
    try {
      const cached = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('⚠️ [NotificationPrefs] Failed to read cache:', error);
      return null;
    }
  }
  
  /**
   * TESTING/DEBUG: Clear all preferences
   */
  async clearAll() {
    try {
      const deviceId = await deviceIdService.getDeviceId();
      
      // Clear Realtime Database
      await database()
        .ref(`/users/${deviceId}/preferences/notifications`)
        .remove();
      
      // Clear cache
      await AsyncStorage.removeItem(PREFS_STORAGE_KEY);
      
      console.log('🗑️ [NotificationPrefs] Cleared all preferences');
      return true;
      
    } catch (error) {
      console.error('❌ [NotificationPrefs] Error clearing:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new NotificationPreferencesService();