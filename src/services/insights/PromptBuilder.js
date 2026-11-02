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
      `- ${stats.name || activity}: ${stats.sessionCount} sessions, ` +
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

The three bullets must follow this exact order:
1. The activity with the most focus time — name it and state how many hours were spent on it
2. Total sessions completed, average session length, and total focus time
3. Accomplishments — briefly summarize what was worked on or what went well from the reflection data above (if no reflection data is present, nudge the user to add reflections next time); end with one behavioral observation such as recurring distractions, peak focus window, or a notable pattern

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

Write exactly 3 bullet points. Each bullet must:
- Start with "• Yesterday, you" (second person, personal)
- Be one sentence, specific to the data above

The three bullets must follow this exact order:
1. The activity with the most focus time — name it and state how many hours/minutes were spent on it
2. Total sessions completed, average session length, and total focus time
3. Accomplishments — briefly summarize what was worked on or what went well from the reflection data above (if no reflection data is present, nudge the user to add a reflection next time); end with one behavioral observation such as distractions noted, time of day, or a pattern worth calling out

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

The three bullets must follow this exact order:
1. The activity with the most focus time — name it and state how many hours were spent on it
2. Total sessions completed, average session length, and total focus time
3. Accomplishments — briefly summarize what was worked on or what went well from the reflection data above (if no reflection data is present, nudge the user to add reflections next time); end with one behavioral observation such as recurring distractions, time-of-day pattern, or consistency across the month

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
2. A pattern, win, or blocker worth noting — reference session timing or what they worked on if available

Tone: direct, warm, specific. No paragraph text — bullets only.`;
  }

  // ─── Behavioral (30-day qualitative insight) ────────────────────────────────

  static _formatGroup(label, group) {
    if (!group || group.count === 0) return null;
    const parts = [`${label}: ${group.count} session${group.count === 1 ? '' : 's'}`];
    if (group.totalHours !== undefined) parts.push(`${group.totalHours.toFixed(1)}h total`);
    if (group.avgFocus !== null && group.avgFocus !== undefined) parts.push(`avg focus ${group.avgFocus}/5`);
    if (group.avgProductivity !== null && group.avgProductivity !== undefined) parts.push(`avg productivity ${group.avgProductivity}/5`);
    return parts.join(', ');
  }

  static buildBehavioralPrompt(aggregatedData) {
    const {
      totalSessions, totalHours, avgSessionMinutes, daysInWindow, daysWithSessions,
      ratedSessionCount, avgFocus, avgProductivity,
      byDurationBucket, byActivity, byTimeOfDay, weekdayVsWeekend, recentVsHistorical,
      notableSessions,
    } = aggregatedData;

    const overallLines = [
      `Total sessions: ${totalSessions}, total focus time: ${totalHours.toFixed(1)}h, avg session length: ${avgSessionMinutes} min`,
      `Days with at least one session: ${daysWithSessions} of ${daysInWindow}`,
    ];
    if (ratedSessionCount > 0) {
      overallLines.push(`Average focus rating: ${avgFocus}/5, average productivity rating: ${avgProductivity}/5 (based on ${ratedSessionCount} rated sessions)`);
    } else {
      overallLines.push('No focus/productivity ratings recorded in this period.');
    }

    const durationLines = Object.entries(byDurationBucket || {})
      .map(([bucket, g]) => this._formatGroup(bucket, g))
      .filter(Boolean);

    const activityLines = Object.entries(byActivity || {})
      .sort((a, b) => b[1].totalHours - a[1].totalHours)
      .map(([activity, g]) => this._formatGroup(activity, g))
      .filter(Boolean);

    const timeOfDayLines = Object.entries(byTimeOfDay || {})
      .map(([bucket, g]) => this._formatGroup(bucket, g))
      .filter(Boolean);

    const weekdayLines = [
      this._formatGroup('Weekday', weekdayVsWeekend?.weekday),
      this._formatGroup('Weekend', weekdayVsWeekend?.weekend),
    ].filter(Boolean);

    const trendLines = [
      this._formatGroup('Last 7 days', recentVsHistorical?.recent7Days),
      this._formatGroup(`Previous ${Math.max(daysInWindow - 7, 0)} days`, recentVsHistorical?.priorPeriod),
    ].filter(Boolean);

    const notableLines = (notableSessions || []).map(s => {
      const ratingPart = s.focusRating !== null
        ? `focus ${s.focusRating}/5${s.productivityRating !== null ? `, productivity ${s.productivityRating}/5` : ''}`
        : 'no rating';
      const workedOnPart = s.workedOn ? ` Worked on: "${this._sanitize(s.workedOn, 80)}"` : '';
      return `- ${s.date} (${s.dayOfWeek}, ${s.timeOfDay}): ${s.activity}, ${s.minutes} min, ${ratingPart}.${workedOnPart}`;
    });

    return `You are analyzing focus session data for a user of a deep work app, covering the last ${daysInWindow} days.

OVERALL
${overallLines.join('\n')}

BY SESSION LENGTH
${durationLines.length > 0 ? durationLines.join('\n') : 'No data.'}

BY ACTIVITY
${activityLines.length > 0 ? activityLines.join('\n') : 'No data.'}

BY TIME OF DAY
${timeOfDayLines.length > 0 ? timeOfDayLines.join('\n') : 'No data.'}

WEEKDAY VS WEEKEND
${weekdayLines.length > 0 ? weekdayLines.join('\n') : 'No data.'}

RECENT VS EARLIER
${trendLines.length > 0 ? trendLines.join('\n') : 'No data.'}

NOTABLE SESSIONS (for context — reference only if relevant to the pattern you pick)
${notableLines.length > 0 ? notableLines.join('\n') : 'None.'}

TASK
Identify the SINGLE most useful, well-supported pattern in this data — something the user would not already know just from looking at simple totals like session count or total hours.

Consider (without forcing yourself into) these pattern types: optimal session duration, optimal time of day, an activity associated with stronger focus/productivity, a change in focus/productivity over time (recent vs earlier), consistency, an unusually strong or weak session, or a relationship between session length and ratings.

Requirements:
- The insight must be interpretation, not a restated total. Do NOT report "you completed N sessions" or "you focused for N hours" as the insight — those are already shown elsewhere in the app.
- The insight must be grounded in the data above. The evidence field must cite the specific numbers that support it.
- Use cautious, evidence-based language: "Your data suggests...", "You tend to...", "Your highest-focus sessions...". Do not invent a causal explanation the data doesn't support.
- If no group above has at least 3 rated sessions, or no dimension shows a meaningful difference (roughly 0.5+ points on the 1-5 scale, or a clear directional trend), return category "insufficient_data" with a short, honest insight instead of manufacturing a pattern.
- Set confidence to "high" only when the supporting group has 5+ sessions and a clear (0.5+) difference vs. the comparison group; "medium" for smaller samples or smaller differences; "low" otherwise (including "insufficient_data").

Respond with ONLY a JSON object in this exact shape, no other text, no markdown code fences:
{"insight": "<one sentence, the interpretive observation, second person>", "evidence": "<one sentence, the specific numbers that support it>", "category": "session_duration | time_of_day | activity | trend | consistency | standout_session | insufficient_data", "confidence": "high | medium | low"}`;
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────

  static _buildEmptyPrompt(insightType) {
    return `No focus sessions recorded in this ${insightType} period. Consider what data points would be valuable to track.`;
  }
}

export default PromptBuilder;
