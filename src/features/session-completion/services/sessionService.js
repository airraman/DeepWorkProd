import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@deep_work_sessions';
const SETTINGS_KEY = '@deep_work_settings';

class SessionService {
  /**
   * Get all sessions, bypassing validation to handle corrupted data
   */
  async _getAllSessions() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      
      const parsed = JSON.parse(raw);
      
      // If it's not an object or is an array, reset it
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn('⚠️ Invalid storage structure, resetting');
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({}));
        return {};
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return {};
    }
  }

  /**
   * Get settings
   */
  async _getSettings() {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return { activities: [] };
      
      const parsed = JSON.parse(raw);
      return parsed || { activities: [] };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return { activities: [] };
    }
  }

  /**
   * Save a rating for a session
   */
  async saveRating(sessionId, rating) {
    try {
      const allSessions = await this._getAllSessions();
      
      // Find the session by ID
      let sessionFound = false;
      const updatedSessions = { ...allSessions };
      
      for (const [date, sessions] of Object.entries(allSessions)) {
        if (!Array.isArray(sessions)) continue; // Skip invalid entries
        
        const sessionIndex = sessions.findIndex(s => s && s.id === sessionId);
        
        if (sessionIndex !== -1) {
          // Found it! Update the session
          updatedSessions[date] = [...sessions];
          updatedSessions[date][sessionIndex] = {
            ...sessions[sessionIndex],
            rating: {
              rating: rating.rating,
              focus: rating.focus,
              productivity: rating.productivity,
              notes: rating.notes,
              ratedAt: rating.ratedAt,
            },
          };
          sessionFound = true;
          break;
        }
      }
      
      if (!sessionFound) {
        console.warn('⚠️ Session not found:', sessionId);
        // Don't throw - just continue
        return;
      }
      
      // Save back to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      console.log('✅ Rating saved successfully for session:', sessionId);
    } catch (error) {
      console.error('❌ Failed to save rating:', error);
      // Don't throw - allow user to continue
    }
  }

  /**
   * Get a single session by ID
   */
  async getSession(sessionId) {
    try {
      const allSessions = await this._getAllSessions();
      const settings = await this._getSettings();
      
      // Find the session by ID
      for (const [date, sessions] of Object.entries(allSessions)) {
        if (!Array.isArray(sessions)) continue; // Skip invalid entries
        
        const session = sessions.find(s => s && s.id === sessionId);
        
        if (session) {
          // Find activity details
          const activity = settings.activities?.find(a => a.id === session.activity);
          
          return {
            id: session.id,
            activityName: activity?.name || 'Focus Session',
            activityColor: activity?.color || '#2563eb',
            duration: session.duration || 0,
            completedAt: session.completedAt,
            rating: session.rating,
            notes: session.notes,
          };
        }
      }
      
      console.warn('⚠️ Session not found:', sessionId);
      // Return a fallback instead of throwing
      return {
        id: sessionId,
        activityName: 'Focus Session',
        activityColor: '#2563eb',
        duration: 25,
        completedAt: new Date().toISOString(),
        rating: null,
        notes: '',
      };
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      // Return fallback instead of throwing
      return {
        id: sessionId,
        activityName: 'Focus Session',
        activityColor: '#2563eb',
        duration: 25,
        completedAt: new Date().toISOString(),
        rating: null,
        notes: '',
      };
    }
  }
}

export const sessionService = new SessionService();