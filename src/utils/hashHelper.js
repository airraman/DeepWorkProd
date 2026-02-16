// hashHelper.js - Simple hash function for cache invalidation

/**
 * Create a simple hash of a string
 * This is NOT cryptographically secure - just for cache invalidation
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36); // Convert to base36 string
  }
  
  /**
   * Create a hash of session data
   * Returns a fingerprint that changes when data changes
   * 
   * @param {Array} sessions - Array of session objects
   * @returns {string} - Hash string (e.g., "abc123def")
   */
  export function hashSessions(sessions) {
    if (!sessions || sessions.length === 0) {
      return 'empty';
    }
    
    // Create a string representation of key session data
    const dataString = sessions
      .map(s => `${s.id}:${s.activity_type}:${s.duration}:${s.created_at}`)
      .sort() // Sort to ensure consistent ordering
      .join('|');
    
    return simpleHash(dataString);
  }
  
  /**
   * Create a hash of aggregated data
   * Useful for comparing if aggregation results changed
   */
  export function hashAggregatedData(aggregatedData) {
    const dataString = JSON.stringify(aggregatedData);
    return simpleHash(dataString);
  }
  
  /**
   * Compare two hashes
   * @returns {boolean} - True if hashes match (data unchanged)
   */
  export function hashesMatch(hash1, hash2) {
    return hash1 === hash2;
  }