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
    
    // Compute behavioral patterns
    const patterns = this._computePatterns(sessions);

    // Build summary object
    const summary = {
      totalSessions,
      totalHours,
      avgSessionMinutes,
      activitiesBreakdown,
      descriptionDensity,
      topActivities: this._getTopActivities(activitiesBreakdown, 3),
      patterns,
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
          descriptions: [],
          wentWell: [],
          distractions: [],
          nextSteps: [],
        };
      }

      grouped[activity].sessionCount++;
      grouped[activity].totalDuration += session.duration;

      // Helper: add unique non-empty string up to maxSamples
      const collect = (bucket, value) => {
        if (
          typeof value === 'string' &&
          value.trim().length > 0 &&
          bucket.length < maxSamples &&
          !bucket.includes(value.trim())
        ) {
          bucket.push(value.trim());
        }
      };

      collect(grouped[activity].descriptions, session.description);

      if (session.reflection) {
        collect(grouped[activity].wentWell,    session.reflection.wentWell);
        collect(grouped[activity].distractions, session.reflection.distractions);
        collect(grouped[activity].nextSteps,    session.reflection.nextStep);
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
        sampleDescriptions: data.descriptions,
        sampleWentWell:     data.wentWell,
        sampleDistractions: data.distractions,
        sampleNextSteps:    data.nextSteps,
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
   * Compute behavioral patterns from sessions
   * Includes time-of-day distribution, peak time, avg duration per bucket,
   * most common workedOn topics, and recurring distractions.
   * @private
   */
  _computePatterns(sessions) {
    const buckets = {
      morning:   { count: 0, totalDuration: 0 }, // 05:00–11:59
      afternoon: { count: 0, totalDuration: 0 }, // 12:00–16:59
      evening:   { count: 0, totalDuration: 0 }, // 17:00–20:59
      night:     { count: 0, totalDuration: 0 }, // 21:00–04:59
    };

    const workedOnFreq = {};
    const distractionFreq = {};

    sessions.forEach(session => {
      // Time-of-day bucket
      const hour = new Date(session.start_time).getHours();
      let bucket;
      if (hour >= 5 && hour < 12)        bucket = 'morning';
      else if (hour >= 12 && hour < 17)  bucket = 'afternoon';
      else if (hour >= 17 && hour < 21)  bucket = 'evening';
      else                               bucket = 'night';

      buckets[bucket].count++;
      buckets[bucket].totalDuration += session.duration;

      // workedOn topic frequency
      const wo = session.description || session.reflection?.workedOn;
      if (wo && wo.trim().length > 0) {
        const key = wo.trim().toLowerCase();
        workedOnFreq[key] = (workedOnFreq[key] || 0) + 1;
      }

      // Distraction frequency
      const dist = session.reflection?.distractions;
      if (dist && dist.trim().length > 0) {
        const key = dist.trim().toLowerCase();
        distractionFreq[key] = (distractionFreq[key] || 0) + 1;
      }
    });

    // Per-bucket avg minutes
    const timeOfDay = {};
    Object.entries(buckets).forEach(([name, data]) => {
      timeOfDay[name] = {
        count: data.count,
        avgMinutes: data.count > 0
          ? Math.round(data.totalDuration / data.count / 60)
          : 0,
      };
    });

    // Peak time (most sessions)
    const activeBuckets = Object.entries(buckets).filter(([, d]) => d.count > 0);
    const peakTimeOfDay = activeBuckets.length > 0
      ? activeBuckets.sort((a, b) => b[1].count - a[1].count)[0][0]
      : null;

    // Time with longest avg session
    const longestSessionsTime = activeBuckets.length > 0
      ? activeBuckets
          .sort((a, b) =>
            (b[1].totalDuration / Math.max(b[1].count, 1)) -
            (a[1].totalDuration / Math.max(a[1].count, 1))
          )[0][0]
      : null;

    // Top 3 workedOn topics
    const topWorkedOn = Object.entries(workedOnFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    // Top 3 distractions
    const topDistractions = Object.entries(distractionFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);

    return {
      timeOfDay,
      peakTimeOfDay,
      longestSessionsTime,
      topWorkedOn: topWorkedOn.length > 0 ? topWorkedOn : null,
      topDistractions: topDistractions.length > 0 ? topDistractions : null,
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
      topActivities: [],
      patterns: null,
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