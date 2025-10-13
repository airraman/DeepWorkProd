// src/services/insights/PromptBuilder.js - IMPROVED VERSION

/**
 * 🎯 KEY CHANGES:
 * 1. Include sample descriptions (qualitative data)
 * 2. Focus on observations over recommendations
 * 3. Structure: Quantitative → Qualitative → Light suggestion
 * 4. Analytical tone (data-driven, not coaching)
 */

class PromptBuilder {
  
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

    // Build activity breakdown WITH descriptions
    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => {
        let text = `- ${activity}: ${stats.sessionCount} sessions, ${stats.totalHours.toFixed(1)}h total (avg ${stats.avgMinutes} min/session)`;
        
        // ✅ NEW: Include sample descriptions if available
        if (stats.sampleDescriptions && stats.sampleDescriptions.length > 0) {
          const descriptions = stats.sampleDescriptions
            .slice(0, 3)  // Max 3 to control token usage
            .map(desc => `"${desc}"`)
            .join(', ');
          text += `\n  Notes: ${descriptions}`;
        }
        
        return text;
      })
      .join('\n\n');

    // ✅ IMPROVED PROMPT STRUCTURE
    return `Analyze this week's focus work patterns:

QUANTITATIVE SUMMARY:
• Sessions completed: ${totalSessions}
• Total focus time: ${totalHours.toFixed(1)} hours
• Average session length: ${avgSessionMinutes} minutes

ACTIVITY BREAKDOWN:
${activityText}

Generate a 2-3 sentence analytical observation that:
1. Identifies a pattern in the quantitative data (session length, distribution, consistency)
2. References specific work from the session notes to add context
3. Ends with ONE optional, data-driven suggestion (not generic advice)

Use an analytical tone - you're a data analyst reviewing metrics, not a motivational coach.`;
  }

  /**
   * 🎯 ADVANCED CONCEPT: Prompt Engineering Patterns
   * 
   * This prompt uses several techniques:
   * 
   * 1. STRUCTURED INPUT (Quantitative → Qualitative)
   *    - Makes it easier for the AI to reference specific data points
   *    - Separates numbers from context
   * 
   * 2. EXPLICIT OUTPUT FORMAT
   *    - "2-3 sentence" constrains length
   *    - "1. Pattern 2. Context 3. Suggestion" structures the response
   * 
   * 3. ROLE DEFINITION
   *    - "data analyst" vs "coach" changes vocabulary/tone
   *    - "not generic advice" prevents cliché recommendations
   * 
   * 4. SAMPLE DATA INCLUSION
   *    - Descriptions provide concrete examples
   *    - AI can reference actual work instead of abstractions
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
      .map(([activity, stats]) => {
        let text = `- ${activity}: ${stats.sessionCount} sessions, ${stats.totalHours.toFixed(1)}h`;
        
        if (stats.sampleDescriptions && stats.sampleDescriptions.length > 0) {
          text += `\n  Worked on: ${stats.sampleDescriptions.join(', ')}`;
        }
        
        return text;
      })
      .join('\n');

    return `Review yesterday's focus sessions:

METRICS:
• ${totalSessions} sessions completed
• ${totalHours.toFixed(1)} hours total
• ${avgSessionMinutes} min average

ACTIVITIES:
${activityText}

Provide a brief analytical summary (2 sentences max): one quantitative observation about session patterns, and one observation about the type of work completed based on the notes.`;
  }

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
      .map(([activity, stats]) => {
        let text = `- ${activity}: ${stats.sessionCount} sessions (${stats.totalHours.toFixed(1)}h total)`;
        
        if (stats.sampleDescriptions && stats.sampleDescriptions.length > 0) {
          const topWork = stats.sampleDescriptions.slice(0, 2).join('; ');
          text += `\n  Examples: ${topWork}`;
        }
        
        return text;
      })
      .join('\n');

    return `Analyze this month's focus patterns:

METRICS:
• ${totalSessions} total sessions (${(totalSessions / 4).toFixed(1)} per week)
• ${totalHours.toFixed(1)} hours total focus time
• ${avgSessionMinutes} min average session

ACTIVITY DISTRIBUTION:
${activityText}

Provide an analytical summary (2-3 sentences): highlight the most significant quantitative pattern (volume, consistency, or session length), reference 1-2 specific projects from the notes, and optionally suggest one area to track differently next month.`;
  }

  static _buildEmptyPrompt(insightType) {
    // Even empty prompts should be analytical, not motivational
    return `No focus sessions recorded in this ${insightType} period. Consider what data points would be valuable to track.`;
  }
}

export default PromptBuilder;