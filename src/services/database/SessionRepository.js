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
        // Date keys are stored as UTC dates (YYYY-MM-DD from toISOString).
        // Parse as local midnight by appending T00:00:00 without a Z suffix so
        // the JS engine uses the device timezone, matching how InsightGenerator
        // computes its local-midnight start/end boundaries.
        const dateTimestamp = new Date(`${dateString}T00:00:00`).getTime();
        const dateEndTimestamp = dateTimestamp + 24 * 60 * 60 * 1000 - 1;

        // Include this date if its local day overlaps the requested range
        if (dateEndTimestamp >= startTime && dateTimestamp <= endTime) {
          // Add all sessions from this date
          sessions.forEach(session => {
            flatSessions.push({
              id: session.id,
              activity_type: session.activity,
              duration: session.duration * 60,
              start_time: session.timestamp,
              end_time: session.timestamp + (session.duration * 60 * 1000),
              // Priority: structured reflection → legacy rating.notes → top-level notes
              description: session.rating?.reflection?.workedOn
                        || session.rating?.notes
                        || session.notes
                        || null,
              // Pass full reflection through so DataAggregator can use all four fields
              reflection: session.rating?.reflection || null,
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