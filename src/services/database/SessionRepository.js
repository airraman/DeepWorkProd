// SessionRepository.js - AsyncStorage Version (Temporary)
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';

class SessionRepository {
  
  // Insert a new session
  async create(sessionData) {
    // Ensure DB is initialized
    DatabaseService.getDB();
    
    // Get existing sessions
    const sessionsJson = await AsyncStorage.getItem('sessions');
    const sessions = JSON.parse(sessionsJson || '[]');
    
    // Create new session with auto-increment ID
    const newSession = {
      id: sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1,
      activity_type: sessionData.activity_type,
      duration: sessionData.duration,
      start_time: sessionData.start_time,
      end_time: sessionData.end_time,
      description: sessionData.description || null,
      created_at: Date.now()
    };
    
    // Add to array
    sessions.push(newSession);
    
    // Save back to storage
    await AsyncStorage.setItem('sessions', JSON.stringify(sessions));
    
    return newSession.id;
  }

  // Get sessions within a time range
  async getSessionsByDateRange(startTime, endTime) {
    DatabaseService.getDB();
    
    const sessionsJson = await AsyncStorage.getItem('sessions');
    const sessions = JSON.parse(sessionsJson || '[]');
    
    return sessions
      .filter(s => s.created_at >= startTime && s.created_at <= endTime)
      .sort((a, b) => b.created_at - a.created_at); // DESC order
  }

  // Get sessions by activity type and date range
  async getSessionsByActivityAndDateRange(activityType, startTime, endTime) {
    DatabaseService.getDB();
    
    const sessionsJson = await AsyncStorage.getItem('sessions');
    const sessions = JSON.parse(sessionsJson || '[]');
    
    return sessions
      .filter(s => 
        s.activity_type === activityType &&
        s.created_at >= startTime && 
        s.created_at <= endTime
      )
      .sort((a, b) => b.created_at - a.created_at);
  }

  // Get all unique activity types
  async getActivityTypes() {
    DatabaseService.getDB();
    
    const sessionsJson = await AsyncStorage.getItem('sessions');
    const sessions = JSON.parse(sessionsJson || '[]');
    
    // Get unique activity types
    const types = [...new Set(sessions.map(s => s.activity_type))];
    return types.sort();
  }

  // Utility: Get all sessions (for debugging)
  async getAll() {
    const sessionsJson = await AsyncStorage.getItem('sessions');
    return JSON.parse(sessionsJson || '[]');
  }

  // Utility: Delete all sessions (for testing)
  async deleteAll() {
    await AsyncStorage.setItem('sessions', JSON.stringify([]));
  }
}

export default new SessionRepository();