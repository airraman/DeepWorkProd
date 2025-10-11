// DatabaseService.js
import * as SQLite from 'expo-sqlite'; // or your sqlite import
import {
  CREATE_SESSIONS_TABLE,
  CREATE_INSIGHTS_CACHE_TABLE,
  CREATE_SESSIONS_INDEXES,
  CREATE_INSIGHTS_INDEXES,
  SCHEMA_VERSION
} from './schema';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  // Open database and run migrations
  async init() {
    try {
      // Open or create database
      this.db = await SQLite.openDatabaseAsync('focus_sessions.db');
      
      console.log('📦 Database opened successfully');
      
      // Run migrations
      await this.runMigrations();
      
      console.log('✅ Database initialized');
      return true;
    } catch (error) {
      console.error('❌ Database init failed:', error);
      throw error;
    }
  }

  async runMigrations() {
    // Create tables
    await this.db.execAsync(CREATE_SESSIONS_TABLE);
    await this.db.execAsync(CREATE_INSIGHTS_CACHE_TABLE);
    
    // Create indexes
    await this.db.execAsync(CREATE_SESSIONS_INDEXES);
    await this.db.execAsync(CREATE_INSIGHTS_INDEXES);
    
    console.log('📊 Tables and indexes created');
  }

  // Get database instance
  getDB() {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // Utility: Close database (for testing/cleanup)
  async close() {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// Export singleton instance
export default new DatabaseService();