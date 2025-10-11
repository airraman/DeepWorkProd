// src/services/insights/CacheManager.js

/**
 * CacheManager - Validates cached insights
 * 
 * Cache invalidation rules:
 * 1. Data-based: If session data changes (detected via hash comparison)
 * 2. Time-based: Different expiration for each insight type
 */

// Time constants (in milliseconds)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

export class CacheManager {
  /**
   * Determines if a cached insight is still valid
   * 
   * @param {Object|null} cachedInsight - The cached insight from database
   * @param {string} currentDataHash - Hash of current session data
   * @param {string} insightType - Type: 'daily', 'weekly', 'monthly', 'activity_X_week'
   * @returns {boolean} - True if cache is valid and should be used
   */
  static isCacheValid(cachedInsight, currentDataHash, insightType) {
    // Rule 1: No cache exists
    if (!cachedInsight) {
      return false;
    }

    // Rule 2: Data has changed (most important check)
    // If user added new sessions, we want fresh insight immediately
    if (cachedInsight.data_hash !== currentDataHash) {
      return false;
    }

    // Rule 3: Time-based expiration
    const now = Date.now();
    const timeSinceCached = now - cachedInsight.generated_at;

    // Determine expiration based on insight type
    switch (insightType) {
      case 'daily':
        return timeSinceCached < ONE_DAY_MS;

      case 'weekly':
        return timeSinceCached < ONE_WEEK_MS;

      case 'monthly':
        return timeSinceCached < ONE_MONTH_MS;

      default:
        // Activity-specific insights (e.g., 'activity_work_week')
        if (insightType.startsWith('activity_')) {
          return timeSinceCached < ONE_WEEK_MS;
        }
        
        // Unknown type - invalidate cache to be safe
        return false;
    }
  }

  /**
   * Determines if background regeneration should occur
   * More aggressive than isCacheValid - triggers regeneration earlier
   * 
   * Use case: App opened, cache is "valid" but approaching expiration
   * 
   * @param {Object|null} cachedInsight
   * @param {string} insightType
   * @returns {boolean} - True if should regenerate in background
   */
  static shouldRegenerateInBackground(cachedInsight, insightType) {
    if (!cachedInsight) {
      return true;
    }

    const now = Date.now();
    const timeSinceCached = now - cachedInsight.generated_at;

    // Regenerate if cache is older than 80% of expiration time
    const expirationThreshold = {
      daily: ONE_DAY_MS * 0.8,      // After 19.2 hours
      weekly: ONE_WEEK_MS * 0.8,    // After 5.6 days
      monthly: ONE_MONTH_MS * 0.8,  // After 24 days
    };

    const threshold = expirationThreshold[insightType] || ONE_WEEK_MS * 0.8;
    return timeSinceCached > threshold;
  }
}