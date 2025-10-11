// SessionRepository.js
import DatabaseService from './DatabaseService';

class SessionRepository {
  
  // Insert a new session
  async create(sessionData) {
    const db = DatabaseService.getDB();
    
    const result = await db.runAsync(
      `INSERT INTO sessions 
       (activity_type, duration, start_time, end_time, description, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionData.activity_type,
        sessionData.duration,
        sessionData.start_time,
        sessionData.end_time,
        sessionData.description || null,
        Date.now()
      ]
    );
    
    return result.lastInsertRowId;
  }

  // Get sessions within a time range
  async getSessionsByDateRange(startTime, endTime) {
    const db = DatabaseService.getDB();
    
    const sessions = await db.getAllAsync(
      `SELECT * FROM sessions 
       WHERE created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC`,
      [startTime, endTime]
    );
    
    return sessions;
  }

  // Get sessions by activity type and date range
  async getSessionsByActivityAndDateRange(activityType, startTime, endTime) {
    const db = DatabaseService.getDB();
    
    const sessions = await db.getAllAsync(
      `SELECT * FROM sessions 
       WHERE activity_type = ? 
       AND created_at >= ? 
       AND created_at <= ?
       ORDER BY created_at DESC`,
      [activityType, startTime, endTime]
    );
    
    return sessions;
  }

  // Get all unique activity types
  async getActivityTypes() {
    const db = DatabaseService.getDB();
    
    const results = await db.getAllAsync(
      `SELECT DISTINCT activity_type FROM sessions 
       ORDER BY activity_type`
    );
    
    return results.map(row => row.activity_type);
  }
}

export default new SessionRepository();