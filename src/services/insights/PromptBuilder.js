// src/services/insights/PromptBuilder.js

/**
 * PromptBuilder - Creates optimized prompts for OpenAI
 * 
 * Key concepts:
 * - Token optimization: Aggregated data uses ~200 tokens vs ~1250 for raw sessions
 * - Prompt engineering: Clear instructions, examples, constraints
 * - Context window management: Keep prompts concise but informative
 */

class PromptBuilder {
  
  /**
   * Build prompt for weekly insights
   */
  static buildWeeklyPrompt(aggregatedData) {
    const { 
      totalSessions, 
      totalHours, 
      avgSessionMinutes,
      activitiesBreakdown 
    } = aggregatedData;
    
    if (totalSessions === 0) {
      return this._buildEmptyPrompt('weekly');
    }

    // Build activity breakdown text
    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => 
        `- ${activity}: ${stats.sessionCount} sessions (${stats.totalHours.toFixed(1)}h, avg ${stats.avgMinutes}min)`
      )
      .join('\n');

    return `Analyze this week's focus session data:

Sessions: ${totalSessions}
Total Time: ${totalHours.toFixed(1)} hours
Average Session: ${avgSessionMinutes} minutes

Activity Breakdown:
${activityText}

Provide a brief, encouraging insight (2-3 sentences) about their productivity patterns and one specific actionable recommendation.`;
  }

  /**
   * Build prompt for daily insights
   */
  static buildDailyPrompt(aggregatedData) {
    const { 
      totalSessions, 
      totalHours, 
      avgSessionMinutes,
      activitiesBreakdown 
    } = aggregatedData;
    
    if (totalSessions === 0) {
      return this._buildEmptyPrompt('daily');
    }

    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => 
        `- ${activity}: ${stats.sessionCount} sessions (${stats.totalHours.toFixed(1)}h)`
      )
      .join('\n');

    return `Analyze yesterday's focus session data:

Sessions: ${totalSessions}
Total Time: ${totalHours.toFixed(1)} hours
Average Session: ${avgSessionMinutes} minutes

Activities:
${activityText}

Provide a brief, encouraging insight (2-3 sentences) and one tip for today.`;
  }

  /**
   * Build prompt for monthly insights
   */
  static buildMonthlyPrompt(aggregatedData) {
    const { 
      totalSessions, 
      totalHours, 
      avgSessionMinutes,
      activitiesBreakdown 
    } = aggregatedData;
    
    if (totalSessions === 0) {
      return this._buildEmptyPrompt('monthly');
    }

    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => 
        `- ${activity}: ${stats.sessionCount} sessions (${stats.totalHours.toFixed(1)}h)`
      )
      .join('\n');

    return `Analyze this month's focus session data:

Sessions: ${totalSessions}
Total Time: ${totalHours.toFixed(1)} hours
Average Session: ${avgSessionMinutes} minutes
Sessions per week: ${(totalSessions / 4).toFixed(1)}

Activity Distribution:
${activityText}

Provide a brief insight (2-3 sentences) about their monthly progress and one goal for next month.`;
  }

  /**
   * Build prompt for activity-specific insights
   */
  static buildActivityPrompt(aggregatedData, activityType) {
    const { 
      totalSessions, 
      totalHours, 
      avgSessionMinutes,
      activitiesBreakdown 
    } = aggregatedData;
    
    const activityStats = activitiesBreakdown?.[activityType];
    
    if (!activityStats || activityStats.sessionCount === 0) {
      return `No ${activityType} sessions in the past week. Consider scheduling dedicated time for this activity.`;
    }

    return `Analyze ${activityType} focus sessions from the past week:

Sessions: ${activityStats.sessionCount}
Total Time: ${activityStats.totalHours.toFixed(1)} hours
Average Duration: ${activityStats.avgMinutes} minutes

Provide a brief insight (2 sentences) about their ${activityType} practice and one tip to improve.`;
  }

  /**
   * Build prompt for empty data case
   * @private
   */
  static _buildEmptyPrompt(insightType) {
    return `Generate an encouraging message for someone who hasn't logged any ${insightType} focus sessions yet. Keep it brief (2 sentences) and motivational.`;
  }
}

export default PromptBuilder;