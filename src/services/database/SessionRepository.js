// src/services/database/SessionRepository.js

import { deepWorkStore } from '../deepWorkStore';

class SessionRepository {
  
  /**
   * Get sessions by date range
   * Converts date-keyed object to flat array
   * 
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Promise<Array>} - Flat array of sessions
   */
  async getSessionsByDateRange(startTime, endTime) {
    try {
      // Get all sessions from deepWorkStore (returns date-keyed object)
      const allSessions = await deepWorkStore.getSessions();
      
      const flatSessions = [];
      
      // Convert object to array and filter by date range
      Object.entries(allSessions).forEach(([dateString, sessions]) => {
        // Parse the date string to timestamp
        const dateTimestamp = new Date(dateString).getTime();
        
        // Check if this date is in range
        if (dateTimestamp >= startTime && dateTimestamp <= endTime) {
          // Add all sessions from this date
          sessions.forEach(session => {
            flatSessions.push({
              id: session.id,
              activity_type: session.activity, // Convert to snake_case for consistency
              duration: session.duration * 60,
              start_time: session.timestamp,
              end_time: session.timestamp + (session.duration * 60 * 1000),
              description: session.notes || null,
              created_at: session.timestamp,
            });
          });
        }
      });
      
      console.log(`[SessionRepository] Found ${flatSessions.length} sessions in range`);
      
      return flatSessions;
      
    } catch (error) {
      console.error('[SessionRepository] Error getting sessions:', error);
      return [];
    }
  }
  
  /**
   * Get sessions by activity and date range
   */
  async getSessionsByActivityAndDateRange(activityType, startTime, endTime) {
    const allSessions = await this.getSessionsByDateRange(startTime, endTime);
    return allSessions.filter(s => s.activity_type === activityType);
  }
  
  /**
   * Create a new session
   */
  async create(sessionData) {
    try {
      await deepWorkStore.addSession({
        activity: sessionData.activity_type,
        duration: sessionData.duration / 60, // Convert seconds to minutes
        timestamp: sessionData.start_time,
        notes: sessionData.description || '',
        musicChoice: 'none',
      });
      
      return true;
    } catch (error) {
      console.error('[SessionRepository] Error creating session:', error);
      throw error;
    }
  }
  
  /**
   * Get all unique activity types
   */
  async getActivityTypes() {
    const allSessions = await this.getSessionsByDateRange(0, Date.now());
    const types = new Set(allSessions.map(s => s.activity_type));
    return Array.from(types);
  }
}

export default new SessionRepository();