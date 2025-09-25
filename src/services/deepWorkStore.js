// src/services/deepWorkStore.js - UPDATED FOR REMINDER FREQUENCY

import AsyncStorage from '@react-native-async-storage/async-storage';
import SessionNotesModal from '../components/modals/SessionNotesModal';

// Storage configuration
const STORAGE_KEY = '@deep_work_sessions';
const SETTINGS_KEY = '@deep_work_settings';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds
const DEBUG = true;

// UPDATED: Default settings with reminder frequency instead of goals
// IMPORTANT CONCEPT: Default state design in React Native
// We always provide sensible defaults to prevent null/undefined errors
const DEFAULT_SETTINGS = {
  activities: [], 
  durations: [],
  reminderFrequency: 'daily',  // CHANGED FROM goals: [] to reminderFrequency with default
  lastUpdated: new Date().toISOString()
};

// Debug logging utility to help with development and troubleshooting
const log = (message, data) => {
  if (DEBUG) {
    console.log(`[DeepWorkStore] ${message}`, data || '');
  }
};

// Validation function for individual session objects
const isValidSession = (session) => {
  return (
    session &&
    typeof session.activity === 'string' &&
    typeof session.duration === 'number' &&
    typeof session.musicChoice === 'string' &&
    (!session.notes || typeof session.notes === 'string') && // Make notes optional but must be string if present
    session.duration > 0
  );
};

// Validation function for the entire sessions storage structure
const isValidStorage = (sessions) => {
  if (!sessions || typeof sessions !== 'object') return false;
  
  return Object.entries(sessions).every(([date, daySessions]) => {
    return (
      // Validate date format (YYYY-MM-DD)
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      // Validate sessions array
      Array.isArray(daySessions) &&
      daySessions.every(isValidSession)
    );
  });
};

// UPDATED: Validation function for settings structure with reminder frequency
// IMPORTANT: This shows how to validate transformed data structures in React Native
const isValidSettings = (settings) => {
  return (
    settings &&
    Array.isArray(settings.activities) &&
    settings.activities.every(activity => 
      activity.id && 
      activity.name && 
      activity.color
    ) &&
    Array.isArray(settings.durations) &&
    settings.durations.every(duration => 
      typeof duration === 'number' && 
      duration > 0
    ) &&
    // UPDATED: Validate reminder frequency instead of goals
    // We accept string values that match our expected options
    typeof settings.reminderFrequency === 'string' &&
    ['multiple_daily', 'daily', 'weekly'].includes(settings.reminderFrequency)
  );
};

export const deepWorkStore = {
  /**
   * Initialize the storage system and perform integrity check
   * This should be called when the app starts
   */
  initialize: async () => {
    try {
        // Check if storage exists first
        const settings = await AsyncStorage.getItem(SETTINGS_KEY);
        
        // Only initialize if storage doesn't exist
        if (!settings) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({}));
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
                activities: [],
                durations: [],
                reminderFrequency: 'daily',  // UPDATED: Default reminder frequency
                lastUpdated: new Date().toISOString()
            }));
            log('Storage initialized with reminder frequency');
        }
        
        return true;
    } catch (error) {
        console.error('Initialization failed:', error);
        return false;
    }
  },

  /**
   * Get the current settings
   * Returns default settings if none exist or if settings are corrupted
   */
  getSettings: async () => {
    try {
      const settings = await AsyncStorage.getItem(SETTINGS_KEY);
      
      if (!settings) {
        // Initialize with default settings if none exist
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        return DEFAULT_SETTINGS;
      }

      const parsed = JSON.parse(settings);
      
      // MIGRATION LOGIC: Handle existing users who might have old 'goals' structure
      // This is an important pattern for real-world apps
      if (parsed.goals !== undefined && parsed.reminderFrequency === undefined) {
        log('Migrating from goals to reminderFrequency structure');
        const migratedSettings = {
          ...parsed,
          reminderFrequency: 'daily', // Set default for existing users
          // Remove old goals field
          goals: undefined
        };
        delete migratedSettings.goals;
        
        // Save migrated settings
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(migratedSettings));
        return migratedSettings;
      }
      
      if (!isValidSettings(parsed)) {
        log('Invalid settings detected, restoring defaults');
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        return DEFAULT_SETTINGS;
      }

      log('Settings retrieved successfully');
      return parsed;
    } catch (error) {
      log('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  },

  /**
 * Get all stored sessions
 * @returns {Promise<Object>} Object with dates as keys and arrays of sessions as values
 */
getSessions: async () => {
  try {
    const sessions = await AsyncStorage.getItem(STORAGE_KEY);
    
    if (!sessions) {
      log('No sessions found, returning empty object');
      return {};
    }

    const parsed = JSON.parse(sessions);
    
    if (!isValidStorage(parsed)) {
      throw new Error('Invalid sessions data structure');
    }

    log('Retrieved sessions successfully');
    return parsed;
  } catch (error) {
    log('Error getting sessions:', error);
    throw error;
  }
},

  /**
   * Update the entire settings object
   * @param {Object} newSettings - The new settings to save
   */
  updateSettings: async (newSettings) => {
    try {
      if (!isValidSettings(newSettings)) {
        throw new Error('Invalid settings structure');
      }

      const validatedSettings = {
        ...newSettings,
        lastUpdated: new Date().toISOString()
      };

      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(validatedSettings));
      log('Settings updated successfully');
      return true;
    } catch (error) {
      log('Error updating settings:', error);
      return false;
    }
  },

  /**
   * Update just the activities list
   * @param {Array} activities - New activities array
   */
  updateActivities: async (activities) => {
    try {
      const currentSettings = await deepWorkStore.getSettings();
      return await deepWorkStore.updateSettings({
        ...currentSettings,
        activities
      });
    } catch (error) {
      log('Error updating activities:', error);
      return false;
    }
  },

  /**
   * Update just the durations list
   * @param {Array} durations - New durations array
   */
  updateDurations: async (durations) => {
    try {
      const currentSettings = await deepWorkStore.getSettings();
      return await deepWorkStore.updateSettings({
        ...currentSettings,
        durations: durations.sort((a, b) => a - b)
      });
    } catch (error) {
      log('Error updating durations:', error);
      return false;
    }
  },

  /**
   * NEW FUNCTION: Update reminder frequency
   * @param {string} frequency - The reminder frequency ('multiple_daily', 'daily', 'weekly')
   * 
   * IMPORTANT CONCEPT: Single responsibility functions
   * This function only handles reminder frequency updates, making it:
   * - Easier to test
   * - More reusable  
   * - Less prone to bugs
   * - Following React Native best practices for data layer separation
   */
  updateReminderFrequency: async (frequency) => {
    try {
      // Validate input
      const validFrequencies = ['multiple_daily', 'daily', 'weekly'];
      if (!validFrequencies.includes(frequency)) {
        throw new Error(`Invalid reminder frequency: ${frequency}`);
      }

      const currentSettings = await deepWorkStore.getSettings();
      const success = await deepWorkStore.updateSettings({
        ...currentSettings,
        reminderFrequency: frequency
      });

      if (success) {
        log('Reminder frequency updated:', frequency);
      }
      
      return success;
    } catch (error) {
      log('Error updating reminder frequency:', error);
      return false;
    }
  },

  /**
   * NEW FUNCTION: Get current reminder frequency
   * @returns {Promise<string>} The current reminder frequency setting
   * 
   * INTERVIEW TIP: Getter functions like this demonstrate understanding of:
   * - Data encapsulation
   * - Error handling in async operations
   * - Default value patterns in mobile apps
   */
  getReminderFrequency: async () => {
    try {
      const settings = await deepWorkStore.getSettings();
      return settings.reminderFrequency || 'daily';
    } catch (error) {
      log('Error getting reminder frequency:', error);
      return 'daily'; // Safe default
    }
  },

  /**
   * Add a new completed session to storage
   * @param {Object} session - The session details
   */
  addSession: async (session) => {
    try {
      if (!isValidSession(session)) {
        throw new Error('Invalid session data');
      }

      // Get existing sessions with retry mechanism
      let existingSessions = {};
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        try {
          existingSessions = await deepWorkStore.getSessions();
          break;
        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
      
      const date = new Date().toISOString().split('T')[0];
      const newSession = {
        id: `${date}-${Date.now()}`,
        date,
        activity: session.activity,
        duration: parseInt(session.duration),
        musicChoice: session.musicChoice,
        notes: session.notes || '', // Add notes field, default to empty string if not provided
        completedAt: new Date().toISOString(),
        syncStatus: 'pending',
        metadata: {
          appVersion: '1.0.0',
          created: Date.now(),
          modified: Date.now()
        }
      };
      
      // Add to existing sessions or create new array
      if (existingSessions[date]) {
        existingSessions[date].push(newSession);
      } else {
        existingSessions[date] = [newSession];
      }
      
      // Save and verify
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingSessions));
      
      const verifiedSessions = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(verifiedSessions);
      
      if (!parsed[date]?.some(s => s.id === newSession.id)) {
        throw new Error('Session verification failed');
      }

      log('Session saved successfully:', newSession);
      return { success: true, session: newSession };
    } catch (error) {
      log('Error saving session:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Calculate statistics for sessions
   */
  getStatistics: async () => {
    try {
      const sessions = await deepWorkStore.getSessions();
      const stats = {
        totalSessions: 0,
        totalMinutes: 0,
        byActivity: {},
        byMusic: {},
        streaks: {
          current: 0,
          longest: 0
        }
      };

      let lastSessionDate = null;
      
      Object.entries(sessions).forEach(([date, dateSessions]) => {
        // Update session counts
        stats.totalSessions += dateSessions.length;
        
        // Process each session
        dateSessions.forEach(session => {
          stats.totalMinutes += session.duration;
          
          // Update activity stats
          stats.byActivity[session.activity] = stats.byActivity[session.activity] || {
            count: 0,
            minutes: 0
          };
          stats.byActivity[session.activity].count++;
          stats.byActivity[session.activity].minutes += session.duration;
          
          // Update music choice stats
          stats.byMusic[session.musicChoice] = stats.byMusic[session.musicChoice] || 0;
          stats.byMusic[session.musicChoice]++;
        });

        // Calculate streaks
        const sessionDate = new Date(date);
        if (lastSessionDate) {
          const daysDiff = Math.floor(
            (sessionDate - lastSessionDate) / (1000 * 60 * 60 * 24)
          );
          
          if (daysDiff === 1) {
            stats.streaks.current++;
            stats.streaks.longest = Math.max(
              stats.streaks.longest,
              stats.streaks.current
            );
          } else if (daysDiff > 1) {
            stats.streaks.current = 0;
          }
        }
        
        lastSessionDate = sessionDate;
      });

      return stats;
    } catch (error) {
      log('Error calculating statistics:', error);
      return null;
    }
  },

  /**
   * Verify storage integrity
   */
  verifyStorageIntegrity: async () => {
    try {
      const [sessions, settings] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(SETTINGS_KEY)
      ]);
      
      // Verify sessions
      if (sessions) {
        try {
          const parsedSessions = JSON.parse(sessions);
          if (!isValidStorage(parsedSessions)) return false;
        } catch (error) {
          return false;
        }
      }

      // Verify settings
      if (settings) {
        try {
          const parsedSettings = JSON.parse(settings);
          if (!isValidSettings(parsedSettings)) return false;
        } catch (error) {
          return false;
        }
      }

      return true;
    } catch (error) {
      log('Error verifying storage:', error);
      return false;
    }
  },

  /**
   * UPDATED: Attempt to repair corrupted storage with reminder frequency support
   */
  repairStorage: async () => {
    try {
      // Repair sessions storage
      const sessions = await AsyncStorage.getItem(STORAGE_KEY);
      if (sessions) {
        try {
          const parsed = JSON.parse(sessions);
          const repairedSessions = {};
          
          Object.entries(parsed).forEach(([date, dateSessions]) => {
            if (Array.isArray(dateSessions)) {
              const validSessions = dateSessions.filter(isValidSession);
              if (validSessions.length > 0) {
                repairedSessions[date] = validSessions;
              }
            }
          });

          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(repairedSessions));
        } catch (error) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({}));
        }
      }

      // Repair settings storage with reminder frequency migration
      const settings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (settings) {
        try {
          const parsed = JSON.parse(settings);
          
          // Migration: Convert goals to reminderFrequency if needed
          if (parsed.goals !== undefined && parsed.reminderFrequency === undefined) {
            const migratedSettings = {
              activities: Array.isArray(parsed.activities) ? parsed.activities : [],
              durations: Array.isArray(parsed.durations) ? parsed.durations : [],
              reminderFrequency: 'daily', // Default for migrated users
              lastUpdated: new Date().toISOString()
            };
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(migratedSettings));
            log('Migrated settings during repair');
          } else if (!isValidSettings(parsed)) {
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
          }
        } catch (error) {
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        }
      }

      log('Storage repaired successfully');
      return true;
    } catch (error) {
      log('Error repairing storage:', error);
      return false;
    }
  },

  /**
   * Clear all stored sessions
   */
  clearSessions: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      log('Storage cleared successfully');
      return true;
    } catch (error) {
      log('Error clearing storage:', error);
      return false;
    }
  }
};