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
          name: session.activity_name || null,
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
        name: data.name,
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
        activity: data.name || activity,
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
   * Aggregate sessions into behavioral pattern groupings for the 30-day
   * qualitative "AI Insight" card. Unlike aggregateSessions() (a flat
   * summary), this computes focus/productivity ratings broken out by
   * duration bucket, activity, time-of-day, weekday/weekend, and a
   * recent-vs-prior trend split, plus a handful of standout sessions —
   * the deterministic evidence the AI is asked to interpret, not restate.
   *
   * @param {Array} sessions - Raw sessions (last N days)
   * @param {Object} options - { daysInWindow }
   */
  aggregateBehavioralData(sessions, options = {}) {
    const { daysInWindow = 30 } = options;

    if (!sessions || sessions.length === 0) {
      return { totalSessions: 0, ratedSessionCount: 0, daysInWindow };
    }

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalHours = secondsToHours(totalDuration);
    const avgSessionMinutes = secondsToMinutes(totalDuration / totalSessions);

    const rated = sessions.filter(s => typeof s.focusRating === 'number');
    const ratedSessionCount = rated.length;

    const avg = (arr, key) => {
      const vals = arr.map(s => s[key]).filter(v => typeof v === 'number');
      return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    };

    const daysWithSessions = new Set(sessions.map(s => new Date(s.start_time).toDateString())).size;

    // ── By duration bucket ──
    const bucketFor = (minutes) => {
      if (minutes < 20) return '<20 min';
      if (minutes < 30) return '20-29 min';
      if (minutes < 45) return '30-44 min';
      return '45+ min';
    };
    const durationGroups = {};
    sessions.forEach(s => {
      const bucket = bucketFor(secondsToMinutes(s.duration));
      if (!durationGroups[bucket]) durationGroups[bucket] = [];
      durationGroups[bucket].push(s);
    });
    const byDurationBucket = {};
    Object.entries(durationGroups).forEach(([bucket, group]) => {
      byDurationBucket[bucket] = {
        count: group.length,
        avgFocus: avg(group, 'focusRating'),
        avgProductivity: avg(group, 'productivityRating'),
      };
    });

    // ── By activity ──
    const activityGroups = {};
    sessions.forEach(s => {
      const label = s.activity_name || s.activity_type;
      if (!activityGroups[label]) activityGroups[label] = [];
      activityGroups[label].push(s);
    });
    const byActivity = {};
    Object.entries(activityGroups).forEach(([activity, group]) => {
      const groupDuration = group.reduce((sum, s) => sum + s.duration, 0);
      byActivity[activity] = {
        count: group.length,
        totalHours: secondsToHours(groupDuration),
        avgFocus: avg(group, 'focusRating'),
        avgProductivity: avg(group, 'productivityRating'),
      };
    });

    // ── By time of day ──
    const timeOfDayBucket = (hour) => {
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      if (hour >= 17 && hour < 21) return 'evening';
      return 'night';
    };
    const todGroups = {};
    sessions.forEach(s => {
      const bucket = timeOfDayBucket(new Date(s.start_time).getHours());
      if (!todGroups[bucket]) todGroups[bucket] = [];
      todGroups[bucket].push(s);
    });
    const byTimeOfDay = {};
    Object.entries(todGroups).forEach(([bucket, group]) => {
      byTimeOfDay[bucket] = {
        count: group.length,
        avgFocus: avg(group, 'focusRating'),
        avgProductivity: avg(group, 'productivityRating'),
      };
    });

    // ── Weekday vs weekend ──
    const isWeekend = (s) => [0, 6].includes(new Date(s.start_time).getDay());
    const weekendGroup = sessions.filter(isWeekend);
    const weekdayGroup = sessions.filter(s => !isWeekend(s));
    const weekdayVsWeekend = {
      weekday: { count: weekdayGroup.length, avgFocus: avg(weekdayGroup, 'focusRating'), avgProductivity: avg(weekdayGroup, 'productivityRating') },
      weekend: { count: weekendGroup.length, avgFocus: avg(weekendGroup, 'focusRating'), avgProductivity: avg(weekendGroup, 'productivityRating') },
    };

    // ── Recent (last 7 days) vs prior ──
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentGroup = sessions.filter(s => s.start_time >= sevenDaysAgo);
    const priorGroup = sessions.filter(s => s.start_time < sevenDaysAgo);
    const recentVsHistorical = {
      recent7Days: { count: recentGroup.length, avgFocus: avg(recentGroup, 'focusRating'), avgProductivity: avg(recentGroup, 'productivityRating') },
      priorPeriod: { count: priorGroup.length, avgFocus: avg(priorGroup, 'focusRating'), avgProductivity: avg(priorGroup, 'productivityRating') },
    };

    // ── Notable sessions (evidence texture): highest/lowest focus, most recent first as tiebreak ──
    const sortedByFocus = [...rated].sort((a, b) => b.focusRating - a.focusRating);
    const highest = sortedByFocus.slice(0, 2);
    const lowest = sortedByFocus.slice(-2).reverse();
    const notableSet = new Map();
    [...highest, ...lowest].forEach(s => notableSet.set(s.id, s));
    const notableSessions = Array.from(notableSet.values())
      .sort((a, b) => b.start_time - a.start_time)
      .slice(0, 5)
      .map(s => {
        const d = new Date(s.start_time);
        return {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
          timeOfDay: timeOfDayBucket(d.getHours()),
          activity: s.activity_name || s.activity_type,
          minutes: secondsToMinutes(s.duration),
          focusRating: s.focusRating,
          productivityRating: s.productivityRating,
          workedOn: s.description || null,
        };
      });

    const topActivities = Object.entries(byActivity)
      .sort((a, b) => b[1].totalHours - a[1].totalHours)
      .slice(0, 3)
      .map(([activity, data]) => ({ activity, hours: data.totalHours }));

    return {
      totalSessions,
      totalHours,
      avgSessionMinutes,
      daysInWindow,
      daysWithSessions,
      ratedSessionCount,
      avgFocus: avg(rated, 'focusRating'),
      avgProductivity: avg(rated, 'productivityRating'),
      byDurationBucket,
      byActivity,
      byTimeOfDay,
      weekdayVsWeekend,
      recentVsHistorical,
      notableSessions,
      topActivities,
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