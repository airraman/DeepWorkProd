// src/services/insights/PromptBuilder.js

/**
 * PromptBuilder - Creates context-aware prompts for OpenAI
 * 
 * Why separate prompts from API calls?
 * - Easier to test different prompt strategies
 * - Can A/B test prompt effectiveness
 * - Prompts are complex logic, not just strings
 * 
 * ADVANCED CONCEPT: Prompt Engineering
 * - The quality of AI output depends heavily on prompt quality
 * - We adjust prompts based on data density and user context
 */

class PromptBuilder {
  
    /**
     * Build prompt for daily insight
     */
    buildDailyPrompt(aggregatedData) {
      const { summary, timePeriod } = aggregatedData;
      
      // Handle empty data
      if (summary.totalSessions === 0) {
        return this._buildEmptyPrompt('daily');
      }
  
      // Decide detail level based on description density
      const hasDescriptions = summary.descriptionDensity > 0.3;
  
      let prompt = `Analyze this user's focus session data from ${timePeriod.label}:
  
  Total Sessions: ${summary.totalSessions}
  Total Focus Time: ${summary.totalHours} hours
  Average Session: ${summary.avgSessionMinutes} minutes
  
  Activity Breakdown:
  ${this._formatActivities(summary.topActivities)}`;
  
      if (hasDescriptions && summary.sampleDescriptions) {
        prompt += `\n\nSample session descriptions:
  ${summary.sampleDescriptions.slice(0, 3).map((desc, i) => `${i + 1}. ${desc}`).join('\n')}`;
      }
  
      prompt += `\n\nProvide a brief, encouraging insight (2-3 sentences) that:
  1. Highlights a specific pattern or achievement
  2. Offers one actionable suggestion for improvement
  3. Maintains a supportive, motivational tone`;
  
      return prompt;
    }
  
    /**
     * Build prompt for weekly insight
     */
    buildWeeklyPrompt(aggregatedData) {
      const { summary, timePeriod, trends } = aggregatedData;
      
      if (summary.totalSessions === 0) {
        return this._buildEmptyPrompt('weekly');
      }
  
      let prompt = `Analyze this user's weekly focus performance:
  
  Week Summary (${timePeriod.label}):
  - Sessions Completed: ${summary.totalSessions}
  - Total Focus Time: ${summary.totalHours} hours
  - Avg Session Length: ${summary.avgSessionMinutes} minutes
  - Most Productive Activity: ${summary.topActivities[0]?.name || 'N/A'}`;
  
      // Add trend comparison if available
      if (trends) {
        prompt += `\n\nTrends vs Previous Week:
  - Session Count: ${trends.sessionCountChange > 0 ? '+' : ''}${trends.sessionCountChange}
  - Focus Time: ${trends.hoursChange > 0 ? '+' : ''}${trends.hoursChange.toFixed(1)} hours
  - Change: ${trends.percentageChange > 0 ? '+' : ''}${trends.percentageChange}%`;
      }
  
      prompt += `\n\nActivity Distribution:
  ${this._formatActivities(summary.topActivities)}`;
  
      prompt += `\n\nGenerate a weekly review (3-4 sentences) that:
  1. Celebrates specific wins from this week
  2. Identifies a key pattern or trend
  3. Suggests one strategy to optimize next week's performance`;
  
      return prompt;
    }
  
    /**
     * Build prompt for monthly insight
     */
    buildMonthlyPrompt(aggregatedData) {
      const { summary, timePeriod } = aggregatedData;
      
      if (summary.totalSessions === 0) {
        return this._buildEmptyPrompt('monthly');
      }
  
      const dailyAverage = (summary.totalHours / 30).toFixed(1);
  
      let prompt = `Analyze this user's monthly focus performance:
  
  Month: ${timePeriod.label}
  - Total Sessions: ${summary.totalSessions}
  - Total Focus Hours: ${summary.totalHours}
  - Daily Average: ${dailyAverage} hours
  - Session Consistency: ${summary.descriptionDensity > 0.5 ? 'High' : 'Moderate'}
  
  Top Focus Areas:
  ${this._formatActivities(summary.topActivities)}`;
  
      prompt += `\n\nGenerate a monthly review (4-5 sentences) that:
  1. Provides a big-picture perspective on their month
  2. Highlights their strongest performance area
  3. Identifies one area for growth next month
  4. Offers specific, actionable advice`;
  
      return prompt;
    }
  
    /**
     * Build prompt for activity-specific insight
     */
    buildActivityPrompt(aggregatedData, activityName) {
      const { summary } = aggregatedData;
      
      if (summary.totalSessions === 0) {
        return `The user has no ${activityName} sessions this week. Encourage them to schedule focused time for this activity.`;
      }
  
      let prompt = `Analyze the user's ${activityName} activity:
  
  Sessions: ${summary.totalSessions}
  Total Time: ${summary.totalHours} hours
  Average Duration: ${summary.avgSessionMinutes} minutes`;
  
      if (summary.descriptionDensity > 0.3 && summary.sampleDescriptions) {
        prompt += `\n\nRecent session notes:
  ${summary.sampleDescriptions.slice(0, 2).map((desc, i) => `• ${desc}`).join('\n')}`;
      }
  
      prompt += `\n\nProvide activity-specific feedback (2-3 sentences) that:
  1. Comments on their ${activityName} focus patterns
  2. Suggests how to optimize this activity type`;
  
      return prompt;
    }
  
    /**
     * Format activities for prompt
     * @private
     */
    _formatActivities(topActivities) {
      if (!topActivities || topActivities.length === 0) {
        return '- No activities recorded';
      }
  
      return topActivities
        .slice(0, 3)
        .map((act, i) => {
          const percentage = act.percentage || 0;
          return `${i + 1}. ${act.name}: ${act.hours?.toFixed(1) || 0}h (${percentage.toFixed(0)}%)`;
        })
        .join('\n');
    }
  
    /**
     * Prompt for when no data exists
     * @private
     */
    _buildEmptyPrompt(insightType) {
      return `The user has no focus sessions for this ${insightType} period. Write an encouraging 2-sentence message that:
  1. Acknowledges they're just getting started or took a break
  2. Motivates them to schedule their next focus session`;
    }
  }
  
  export default new PromptBuilder();