// InsightCacheRepository.js
import DatabaseService from './DatabaseService';

class InsightCacheRepository {
  
  // Save or update a cached insight
  async upsert(insightData) {
    const db = DatabaseService.getDB();
    
    // SQLite doesn't have UPSERT in older versions, so we use INSERT OR REPLACE
    const result = await db.runAsync(
      `INSERT OR REPLACE INTO insights_cache 
       (insight_type, generated_at, data_hash, insight_text, time_period_start, time_period_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        insightData.insight_type,
        Date.now(),
        insightData.data_hash,
        insightData.insight_text,
        insightData.time_period_start,
        insightData.time_period_end
      ]
    );
    
    return result.lastInsertRowId;
  }

  // Get cached insight by type and time period
  async get(insightType, timePeriodStart, timePeriodEnd) {
    const db = DatabaseService.getDB();
    
    const insight = await db.getFirstAsync(
      `SELECT * FROM insights_cache 
       WHERE insight_type = ? 
       AND time_period_start = ? 
       AND time_period_end = ?`,
      [insightType, timePeriodStart, timePeriodEnd]
    );
    
    return insight || null;
  }

  // Delete old insights (optional cleanup)
  async deleteOlderThan(timestamp) {
    const db = DatabaseService.getDB();
    
    await db.runAsync(
      `DELETE FROM insights_cache WHERE generated_at < ?`,
      [timestamp]
    );
  }
}

export default new InsightCacheRepository();