// src/services/insights/PromptBuilder.js

class PromptBuilder {

  // ─── Shared helpers ───────────────────────────────────────────────────────

  static _sanitize(str, maxLen = 100) {
    return String(str)
      .replace(/"/g, "'")
      .replace(/[\n\r\t\\]/g, ' ')
      .substring(0, maxLen)
      .trim();
  }

  static _formatSamples(arr, maxLen = 100) {
    if (!arr || arr.length === 0) return null;
    return arr
      .slice(0, 3)
      .map(s => `"${this._sanitize(s, maxLen)}"`)
      .join(', ');
  }

  static _buildActivityBlock(activity, stats) {
    const lines = [
      `- ${activity}: ${stats.sessionCount} sessions, ` +
      `${stats.totalHours.toFixed(1)}h total, ` +
      `avg ${stats.avgMinutes} min/session`,
    ];

    const worked       = this._formatSamples(stats.sampleDescriptions);
    const wentWell     = this._formatSamples(stats.sampleWentWell);
    const distractions = this._formatSamples(stats.sampleDistractions);
    const nextSteps    = this._formatSamples(stats.sampleNextSteps);

    if (worked)       lines.push(`  Worked on:    ${worked}`);
    if (wentWell)     lines.push(`  Went well:    ${wentWell}`);
    if (distractions) lines.push(`  Distractions: ${distractions}`);
    if (nextSteps)    lines.push(`  Next steps:   ${nextSteps}`);

    return lines.join('\n');
  }

  /**
   * Build the behavioral patterns section included in every prompt.
   * Covers: time-of-day distribution, peak focus window, avg duration per window,
   * most common topics, and recurring distractions.
   */
  static _buildPatternBlock(patterns) {
    if (!patterns) return 'No pattern data available.';

    const { timeOfDay, peakTimeOfDay, longestSessionsTime, topWorkedOn, topDistractions } = patterns;

    const lines = [];

    // Time-of-day distribution — only show non-zero buckets
    const activeBuckets = Object.entries(timeOfDay || {})
      .filter(([, d]) => d.count > 0)
      .map(([name, d]) => `${name} (${d.count} sessions, avg ${d.avgMinutes} min)`);

    if (activeBuckets.length > 0) {
      lines.push(`Sessions by time of day: ${activeBuckets.join(' | ')}`);
    }

    if (peakTimeOfDay) {
      const peakLine = `Peak focus window: ${peakTimeOfDay}`;
      const longestLine = longestSessionsTime && longestSessionsTime !== peakTimeOfDay
        ? ` | Longest sessions in: ${longestSessionsTime}`
        : '';
      lines.push(peakLine + longestLine);
    }

    if (topWorkedOn && topWorkedOn.length > 0) {
      lines.push(`Most common topics: ${topWorkedOn.join(', ')}`);
    }

    if (topDistractions && topDistractions.length > 0) {
      lines.push(`Recurring distractions: ${topDistractions.join(', ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : 'No pattern data available.';
  }

  // ─── Weekly ───────────────────────────────────────────────────────────────

  static buildWeeklyPrompt(aggregatedData) {
    const { totalSessions, totalHours, avgSessionMinutes, activitiesBreakdown, patterns } = aggregatedData;

    if (totalSessions === 0) return this._buildEmptyPrompt('weekly');

    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => this._buildActivityBlock(activity, stats))
      .join('\n\n');

    const patternBlock = this._buildPatternBlock(patterns);

    return `You are writing a brief weekly focus review for a user of a deep work app.

DATA:
• Sessions completed: ${totalSessions}
• Total focus time: ${totalHours.toFixed(1)} hours
• Average session length: ${avgSessionMinutes} minutes

ACTIVITY BREAKDOWN:
${activityText}

BEHAVIORAL PATTERNS:
${patternBlock}

Write exactly 3 bullet points. Each bullet must:
- Start with "• This week, you" or "• You" (second person, personal)
- Be one sentence, specific to the data above
- Reference actual work, wins, or patterns where available

The three bullets should cover:
1. Volume or consistency (sessions completed, total time)
2. A specific observation about what they worked on or their peak focus window (time-of-day pattern)
3. One concrete, data-driven suggestion based on their distractions, session timing, or next steps

Tone: direct, warm, specific. No generic motivation. No paragraph text — bullets only.`;
  }

  // ─── Daily ────────────────────────────────────────────────────────────────

  static buildDailyPrompt(aggregatedData) {
    const { totalSessions, totalHours, avgSessionMinutes, activitiesBreakdown, patterns } = aggregatedData;

    if (totalSessions === 0) return this._buildEmptyPrompt('daily');

    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => this._buildActivityBlock(activity, stats))
      .join('\n\n');

    const patternBlock = this._buildPatternBlock(patterns);

    return `You are writing a brief daily focus review for a user of a deep work app.

DATA:
• Sessions completed: ${totalSessions}
• Total focus time: ${totalHours.toFixed(1)} hours
• Average session length: ${avgSessionMinutes} minutes

ACTIVITY BREAKDOWN:
${activityText}

BEHAVIORAL PATTERNS:
${patternBlock}

Write exactly 2 bullet points. Each bullet must:
- Start with "• Yesterday, you" (second person, personal)
- Be one sentence, specific to the data above
- Reference actual work content, time of day, or wins where available

The two bullets should cover:
1. What they accomplished (volume + what they worked on, and when — morning/afternoon/evening)
2. One observation about quality or a pattern worth noting (session length, distractions, or a next step)

Tone: direct, warm, specific. No generic motivation. No paragraph text — bullets only.`;
  }

  // ─── Monthly ──────────────────────────────────────────────────────────────

  static buildMonthlyPrompt(aggregatedData) {
    const { totalSessions, totalHours, avgSessionMinutes, activitiesBreakdown, patterns } = aggregatedData;

    if (totalSessions === 0) return this._buildEmptyPrompt('monthly');

    const activityText = Object.entries(activitiesBreakdown || {})
      .map(([activity, stats]) => this._buildActivityBlock(activity, stats))
      .join('\n\n');

    const patternBlock = this._buildPatternBlock(patterns);

    return `You are writing a brief monthly focus review for a user of a deep work app.

DATA:
• Sessions completed: ${totalSessions} (avg ${(totalSessions / 4).toFixed(1)}/week)
• Total focus time: ${totalHours.toFixed(1)} hours
• Average session length: ${avgSessionMinutes} minutes

ACTIVITY BREAKDOWN:
${activityText}

BEHAVIORAL PATTERNS:
${patternBlock}

Write exactly 3 bullet points. Each bullet must:
- Start with "• This month, you" or "• You" (second person, personal)
- Be one sentence, specific to the data above
- Reference actual projects, time-of-day patterns, or recurring distractions where available

The three bullets should cover:
1. Overall volume and consistency across the month
2. A behavioral pattern — when they focused most (morning/afternoon/evening), what topics came up most, or how session length varied by time of day
3. One concrete suggestion based on recurring distractions or next steps

Tone: direct, warm, specific. No generic motivation. No paragraph text — bullets only.`;
  }

  // ─── Activity-specific ────────────────────────────────────────────────────

  static buildActivityPrompt(aggregatedData, activityType) {
    const { totalSessions, totalHours, avgSessionMinutes, activitiesBreakdown, patterns } = aggregatedData;

    if (totalSessions === 0) return this._buildEmptyPrompt('activity');

    const stats = activitiesBreakdown?.[activityType];
    const activityBlock = stats
      ? this._buildActivityBlock(activityType, stats)
      : `- ${activityType}: no sessions with reflection data`;

    const patternBlock = this._buildPatternBlock(patterns);

    return `You are writing a brief activity-specific focus review for a user of a deep work app.

DATA — last 7 days of "${activityType}":
• Sessions: ${totalSessions}, ${totalHours.toFixed(1)}h total, ${avgSessionMinutes} min avg

${activityBlock}

BEHAVIORAL PATTERNS:
${patternBlock}

Write exactly 2 bullet points. Each bullet must:
- Start with "• This week, you" (second person, personal)
- Be one sentence, specific to the data above

The two bullets should cover:
1. Volume, what they specifically worked on, and when (morning/afternoon/evening)
2. A pattern, win, or blocker worth noting — reference distractions or next steps if available

Tone: direct, warm, specific. No paragraph text — bullets only.`;
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────

  static _buildEmptyPrompt(insightType) {
    return `No focus sessions recorded in this ${insightType} period. Consider what data points would be valuable to track.`;
  }
}

export default PromptBuilder;
