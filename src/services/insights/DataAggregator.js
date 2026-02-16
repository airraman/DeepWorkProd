// DataAggregator.js - Transform raw sessions into compact summaries

import { secondsToHours, secondsToMinutes } from '../../utils/dateHelpers';

class DataAggregator {
  
  /**
   * Aggregate all sessions into a summary
   * This is the main function that reduces token usage
   * 
   * @param {Array} sessions - Raw session data
   * @param {Object} options - Aggregation options
   * @returns {Object} - Compact summary
   */
  aggregateSessions(sessions, options = {}) {
    if (!sessions || sessions.length === 0) {
      return this._getEmptyAggregation();
    }
    
    const {
      maxDescriptionSamples = 3, // Max descriptions per activity
      includeTrends = false,
      previousPeriodSessions = null
    } = options;
    
    // Calculate totals
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalHours = secondsToHours(totalDuration);
    const avgSessionMinutes = secondsToMinutes(totalDuration / totalSessions);
    
    // Group by activity
    const activitiesBreakdown = this._groupByActivity(sessions, maxDescriptionSamples);
    
    // Calculate description density
    const sessionsWithDescriptions = sessions.filter(s => 
      s.description && s.description.trim().length > 0
    ).length;
    const descriptionDensity = sessionsWithDescriptions / totalSessions;
    
    // Build summary object
    const summary = {
      totalSessions,
      totalHours,
      avgSessionMinutes,
      activitiesBreakdown,
      descriptionDensity,
      topActivities: this._getTopActivities(activitiesBreakdown, 3)
    };
    
    // Add trends if requested
    if (includeTrends && previousPeriodSessions) {
      summary.trends = this._calculateTrends(sessions, previousPeriodSessions);
    }
    
    return summary;
  }
  
  /**
   * Group sessions by activity type
   * @private
   */
  _groupByActivity(sessions, maxSamples) {
    const grouped = {};
    
    sessions.forEach(session => {
      const activity = session.activity_type;
      
      if (!grouped[activity]) {
        grouped[activity] = {
          sessionCount: 0,
          totalDuration: 0,
          descriptions: []
        };
      }
      
      grouped[activity].sessionCount++;
      grouped[activity].totalDuration += session.duration;
      
      // Collect unique descriptions (up to maxSamples)
      if (session.description && 
        typeof session.description === 'string' &&     // ✅ ADDED: Type check
        session.description.trim().length > 0 &&
        grouped[activity].descriptions.length < maxSamples) {
      const desc = session.description.trim();
      // ✅ ADDED: Additional validation
      if (desc.length > 0 && !grouped[activity].descriptions.includes(desc)) {
        grouped[activity].descriptions.push(desc);
      }
    }
    });
    
    // Convert to final format
    const result = {};
    Object.keys(grouped).forEach(activity => {
      const data = grouped[activity];
      result[activity] = {
        sessionCount: data.sessionCount,
        totalHours: secondsToHours(data.totalDuration),
        avgMinutes: secondsToMinutes(data.totalDuration / data.sessionCount),
        sampleDescriptions: data.descriptions
      };
    });
    
    return result;
  }
  
  /**
   * Get top N activities by total time
   * @private
   */
  _getTopActivities(activitiesBreakdown, count = 3) {
    return Object.entries(activitiesBreakdown)
      .sort((a, b) => b[1].totalHours - a[1].totalHours)
      .slice(0, count)
      .map(([activity, data]) => ({
        activity,
        hours: data.totalHours,
        percentage: 0 // Will calculate after we have totals
      }));
  }
  
  /**
   * Calculate trends vs previous period
   * @private
   */
  _calculateTrends(currentSessions, previousSessions) {
    const currentTotal = currentSessions.reduce((sum, s) => sum + s.duration, 0);
    const previousTotal = previousSessions.reduce((sum, s) => sum + s.duration, 0);
    
    if (previousTotal === 0) {
      return {
        sessionCountChange: currentSessions.length,
        hoursChange: secondsToHours(currentTotal),
        percentageChange: 100
      };
    }
    
    const percentageChange = Math.round(
      ((currentTotal - previousTotal) / previousTotal) * 100
    );
    
    return {
      sessionCountChange: currentSessions.length - previousSessions.length,
      hoursChange: secondsToHours(currentTotal - previousTotal),
      percentageChange
    };
  }
  
  /**
   * Empty aggregation for when there are no sessions
   * @private
   */
  _getEmptyAggregation() {
    return {
      totalSessions: 0,
      totalHours: 0,
      avgSessionMinutes: 0,
      activitiesBreakdown: {},
      descriptionDensity: 0,
      topActivities: []
    };
  }
  
  /**
   * Aggregate sessions for a specific activity
   * Used when user clicks on an activity card
   */
  aggregateByActivity(sessions, activityType, options = {}) {
    const filtered = sessions.filter(s => s.activity_type === activityType);
    
    if (filtered.length === 0) {
      return {
        activity: activityType,
        ...this._getEmptyAggregation()
      };
    }
    
    const aggregated = this.aggregateSessions(filtered, options);
    
    return {
      activity: activityType,
      ...aggregated
    };
  }
}

export default new DataAggregator();