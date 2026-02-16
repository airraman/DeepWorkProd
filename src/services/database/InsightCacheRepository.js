// InsightCacheRepository.js - AsyncStorage Version (Temporary)
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from './DatabaseService';

class InsightCacheRepository {
  
  // Save or update a cached insight (upsert)
  async upsert(insightData) {
    DatabaseService.getDB();
    
    const cacheJson = await AsyncStorage.getItem('insights_cache');
    const cache = JSON.parse(cacheJson || '[]');
    
    // Find existing insight with same type and time period
    const existingIndex = cache.findIndex(c => 
      c.insight_type === insightData.insight_type &&
      c.time_period_start === insightData.time_period_start &&
      c.time_period_end === insightData.time_period_end
    );
    
    const insight = {
      id: existingIndex >= 0 ? cache[existingIndex].id : (cache.length > 0 ? Math.max(...cache.map(c => c.id)) + 1 : 1),
      insight_type: insightData.insight_type,
      generated_at: Date.now(),
      data_hash: insightData.data_hash,
      insight_text: insightData.insight_text,
      time_period_start: insightData.time_period_start,
      time_period_end: insightData.time_period_end
    };
    
    // Update existing or add new
    if (existingIndex >= 0) {
      cache[existingIndex] = insight;
    } else {
      cache.push(insight);
    }
    
    await AsyncStorage.setItem('insights_cache', JSON.stringify(cache));
    return insight.id;
  }

  // Get cached insight by type and time period
  async get(insightType, timePeriodStart, timePeriodEnd) {
    DatabaseService.getDB();
    
    const cacheJson = await AsyncStorage.getItem('insights_cache');
    const cache = JSON.parse(cacheJson || '[]');
    
    const insight = cache.find(c => 
      c.insight_type === insightType &&
      c.time_period_start === timePeriodStart &&
      c.time_period_end === timePeriodEnd
    );
    
    return insight || null;
  }

  // Delete old insights (cleanup)
  async deleteOlderThan(timestamp) {
    DatabaseService.getDB();
    
    const cacheJson = await AsyncStorage.getItem('insights_cache');
    const cache = JSON.parse(cacheJson || '[]');
    
    const filtered = cache.filter(c => c.generated_at >= timestamp);
    await AsyncStorage.setItem('insights_cache', JSON.stringify(filtered));
    
    return cache.length - filtered.length; // Return number deleted
  }

  // Utility: Get all cached insights (for debugging)
  async getAll() {
    const cacheJson = await AsyncStorage.getItem('insights_cache');
    return JSON.parse(cacheJson || '[]');
  }

  // Utility: Clear all cache (for testing)
  async deleteAll() {
    await AsyncStorage.setItem('insights_cache', JSON.stringify([]));
  }
}

export default new InsightCacheRepository();