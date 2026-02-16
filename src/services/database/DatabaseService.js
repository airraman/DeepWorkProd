// DatabaseService.js - AsyncStorage Version (Temporary)
import AsyncStorage from '@react-native-async-storage/async-storage';

class DatabaseService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    try {
      console.log('💾 Using AsyncStorage (temporary SQLite replacement)...');
      
      // Initialize storage keys if they don't exist
      const sessions = await AsyncStorage.getItem('sessions');
      if (!sessions) {
        await AsyncStorage.setItem('sessions', JSON.stringify([]));
        console.log('📦 Initialized sessions storage');
      }
      
      const insights = await AsyncStorage.getItem('insights_cache');
      if (!insights) {
        await AsyncStorage.setItem('insights_cache', JSON.stringify([]));
        console.log('📦 Initialized insights cache storage');
      }
      
      this.initialized = true;
      console.log('📦 Storage initialized successfully');
      console.log('✅ Database initialized (AsyncStorage mode)');
      
      return true;
    } catch (error) {
      console.error('❌ Storage init failed:', error);
      throw error;
    }
  }

  getDB() {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call init() first.');
    }
    // Return self for compatibility
    return this;
  }

  async close() {
    this.initialized = false;
    console.log('💾 Storage closed');
  }

  // Utility: Clear all data (for testing)
  async clearAll() {
    await AsyncStorage.multiRemove(['sessions', 'insights_cache']);
    console.log('🗑️ All storage cleared');
  }
}

export default new DatabaseService();