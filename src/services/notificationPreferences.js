// src/services/notificationPreferences.js
/**
 * Notification Preferences Service
 *
 * ARCHITECTURE v3 (Firestore):
 * - Primary storage: Firestore at users/{uid}/preferences/notifications —
 *   the exact path/uid key functions/index.js's dailyRemindersBatch and
 *   weeklySummaryBatch read from.
 * - Fallback: AsyncStorage (local cache for offline / logged-out reads).
 * - Defaults: every category ON, opt-out — daily focus reminders,
 *   behavior re-engagement and weekly recap. A stored value always wins;
 *   see notificationPrefsRules.js, which mirrors the Cloud Functions rules.
 *
 * v2 wrote this data to Realtime Database keyed by deviceId, which the
 * Cloud Functions never read (they read Firestore keyed by Auth uid) — so
 * scheduled notifications silently never sent. Nothing else in the app
 * reads the old RTDB path, so it has been retired rather than kept as a
 * second, unread source of truth.
 */

import auth from '@react-native-firebase/auth';
import firestore from '../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { categoryUpdate } from './notificationPrefsRules';

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
  reengagement: true,
  weeklySummary: true,
  updatedAt: new Date().toISOString(),
};

class NotificationPreferencesService {
  
  /**
   * Get user's notification preferences
   *
   * FLOW:
   * 1. Try Firestore, users/{uid}/preferences/notifications (cloud)
   * 2. Fallback to AsyncStorage cache (offline / logged-out)
   * 3. Return defaults if nothing exists
   */
  async getPreferences() {
    try {
      const uid = auth().currentUser?.uid;

      // Try Firestore first — same doc the Cloud Functions read.
      if (uid) {
        try {
          const doc = await firestore()
            .collection('users')
            .doc(uid)
            .collection('preferences')
            .doc('notifications')
            .get();

          if (doc.exists) {
            console.log('📋 [NotificationPrefs] Loaded from Firestore');
            const prefs = doc.data();

            // Cache locally for offline access
            await this._cachePreferences(prefs);

            return prefs;
          }
        } catch (firestoreError) {
          console.warn('⚠️ [NotificationPrefs] Firestore unavailable:', firestoreError.message);
        }
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
   * Whether users/{uid}/preferences/notifications exists in Firestore.
   *
   * Unlike getPreferences(), this never falls back to defaults or the cache,
   * so callers can tell "never saved" (false) apart from "couldn't check"
   * (null) and only write defaults in the first case.
   *
   * @returns {Promise<boolean|null>}
   */
  async hasRemotePreferences() {
    const uid = auth().currentUser?.uid;
    if (!uid) return null;
    try {
      const doc = await firestore()
        .collection('users')
        .doc(uid)
        .collection('preferences')
        .doc('notifications')
        .get();
      return doc.exists;
    } catch (error) {
      console.warn('⚠️ [NotificationPrefs] Could not check Firestore:', error.message);
      return null;
    }
  }

  /**
   * Save user's notification preferences
   *
   * DUAL-WRITE PATTERN:
   * - Firestore, users/{uid}/preferences/notifications (primary, cloud-synced,
   *   merge:true so a single-field update never drops sibling fields)
   * - AsyncStorage (backup, offline support)
   */
  async savePreferences(preferences) {
    try {
      const uid = auth().currentUser?.uid;

      // Validate preferences
      const validatedPrefs = this._validatePreferences(preferences);

      // Add timestamp
      const prefsWithTimestamp = {
        ...validatedPrefs,
        updatedAt: new Date().toISOString(),
      };

      // Save to Firestore — same doc the Cloud Functions read. No-ops
      // safely when logged out, matching the Chrome bridge's pattern.
      if (uid) {
        try {
          await firestore()
            .collection('users')
            .doc(uid)
            .collection('preferences')
            .doc('notifications')
            .set(prefsWithTimestamp, {merge: true});

          console.log('✅ [NotificationPrefs] Saved to Firestore');
        } catch (firestoreError) {
          console.warn('⚠️ [NotificationPrefs] Firestore save failed:', firestoreError.message);
        }
      } else {
        console.log('📋 [NotificationPrefs] No user logged in — skipping Firestore save');
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
   * Turn one notification category on or off (Settings toggles).
   *
   * Writes ONLY that field with a Firestore merge — never the whole doc —
   * so a stale cache or a failed read can't overwrite the user's other
   * choices (unlike updatePreference, which rewrites every field).
   *
   * @param {'dailyReminders'|'reengagement'|'weeklyRecap'} key
   * @param {boolean} enabled
   * @returns {Promise<boolean>} true once saved to Firestore
   */
  async setCategoryEnabled(key, enabled) {
    const update = categoryUpdate(key, enabled);
    const uid = auth().currentUser?.uid;
    if (!update || !uid) return false;
    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .collection('preferences')
        .doc('notifications')
        .set({ ...update, updatedAt: new Date().toISOString() }, { merge: true });

      // Keep the offline cache in step without touching other fields.
      const cached = (await this._getCachedPreferences()) || {};
      await this._cachePreferences({
        ...cached,
        ...update,
        ...(update.dailyReminder
          ? { dailyReminder: { ...cached.dailyReminder, ...update.dailyReminder } }
          : {}),
      });
      return true;
    } catch (error) {
      console.warn('⚠️ [NotificationPrefs] setCategoryEnabled failed:', error.message);
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
      
      reengagement: typeof prefs.reengagement === 'boolean'
        ? prefs.reengagement
        : true,

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
      const uid = auth().currentUser?.uid;

      // Clear Firestore
      if (uid) {
        await firestore()
          .collection('users')
          .doc(uid)
          .collection('preferences')
          .doc('notifications')
          .delete();
      }

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