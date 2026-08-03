// cardBuilders.js — pure functions that turn aggregated session data into
// { type, eyebrow, value, sub?, state, rows?, action? } card configs.
//
// Rule: color signals STATE (default/live/empty/loading/offline), never
// card TYPE. `state: 'live'` is reserved for genuinely affirmative/active
// facts (e.g. a positive weekly trend) — a quiet week is not an error and
// must not use `state: 'danger'`; that's reserved for real failures.

export function truncate(text, max = 140) {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export function buildAiInsightCard({ aiInsight }) {
  const base = { id: 'ai-insight', type: 'ai_insight', eyebrow: 'AI Insight' };

  if (!aiInsight) {
    return { ...base, state: 'loading', value: 'Generating your insight…', sub: null };
  }
  if (!aiInsight.success) {
    return {
      ...base,
      state: 'offline',
      value: 'Insight unavailable right now — we\'ll try again shortly.',
      sub: null,
    };
  }
  if (aiInsight.metadata?.isEmpty) {
    return {
      ...base,
      state: 'empty',
      value: 'Not enough sessions yet to generate an insight.',
      sub: 'Complete a few focus sessions and check back.',
    };
  }
  return {
    ...base,
    state: 'default',
    value: truncate(aiInsight.insightText),
    sub: aiInsight.metadata?.fromCache ? null : 'New insight',
  };
}

export function buildSoFarCard({ aggToday }) {
  const base = { id: 'so-far', type: 'so_far', eyebrow: 'So Far Today' };

  if (!aggToday || aggToday.totalSessions === 0) {
    return {
      ...base,
      state: 'empty',
      value: '0m',
      sub: 'No sessions yet today — start one to see it here.',
    };
  }

  const hours = aggToday.totalHours;
  const value = hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(hours * 60)}m`;
  const topActivity = aggToday.topActivities?.[0]?.activity;
  const sub = topActivity
    ? `${aggToday.totalSessions} session${aggToday.totalSessions === 1 ? '' : 's'} · ${topActivity}`
    : `${aggToday.totalSessions} session${aggToday.totalSessions === 1 ? '' : 's'}`;

  return { ...base, state: 'default', value, sub };
}

export function buildComparisonCard({ aggThisWeek, aggLastWeek }) {
  const base = { id: 'comparison', type: 'comparison', eyebrow: 'Comparison' };
  const thisEmpty = !aggThisWeek || aggThisWeek.totalSessions === 0;
  const lastEmpty = !aggLastWeek || aggLastWeek.totalSessions === 0;

  if (thisEmpty && lastEmpty) {
    return { ...base, state: 'empty', value: '—', sub: 'No sessions in the last two weeks.' };
  }
  if (lastEmpty) {
    return {
      ...base,
      state: 'default',
      value: `${aggThisWeek.totalHours.toFixed(1)}h`,
      sub: 'First week of tracked data.',
    };
  }
  if (thisEmpty) {
    return {
      ...base,
      state: 'default',
      value: '0h',
      sub: `Last week: ${aggLastWeek.totalHours.toFixed(1)}h. Nothing logged yet this week.`,
    };
  }

  const delta = aggThisWeek.totalHours - aggLastWeek.totalHours;
  const pct = aggLastWeek.totalHours > 0 ? Math.round((delta / aggLastWeek.totalHours) * 100) : 0;
  const trendingUp = delta >= 0;

  return {
    ...base,
    state: trendingUp ? 'live' : 'default',
    value: `${trendingUp ? '+' : ''}${pct}%`,
    sub: `${aggThisWeek.totalHours.toFixed(1)}h this week vs ${aggLastWeek.totalHours.toFixed(1)}h last week`,
  };
}

export function buildDataCard({ aggThisWeek, longestSessionMinutes }) {
  const base = { id: 'data', type: 'data', eyebrow: 'Data' };

  if (!aggThisWeek || aggThisWeek.totalSessions === 0) {
    return { ...base, state: 'empty', value: 'No data yet this week.', sub: null };
  }

  const topActivity = aggThisWeek.topActivities?.[0]?.activity;
  const rows = [
    { label: 'Sessions', value: `${aggThisWeek.totalSessions}` },
    { label: 'Avg length', value: `${aggThisWeek.avgSessionMinutes} min` },
  ];
  if (longestSessionMinutes) rows.push({ label: 'Longest', value: `${longestSessionMinutes} min` });
  if (topActivity) rows.push({ label: 'Top activity', value: topActivity });

  return { ...base, state: 'default', value: null, sub: null, rows };
}

export function buildUpNextCard({ aiInsight, aggThisWeek }) {
  const base = { id: 'up-next', type: 'up_next', eyebrow: 'Up Next' };

  if (aiInsight?.success && !aiInsight.metadata?.fromCache && !aiInsight.metadata?.isEmpty) {
    return {
      ...base,
      state: 'default',
      value: truncate(aiInsight.insightText, 100),
      sub: 'New insight ready',
    };
  }

  const topActivity = aggThisWeek?.topActivities?.[0]?.activity;
  if (topActivity) {
    return {
      ...base,
      state: 'default',
      value: `Continue "${topActivity}"`,
      sub: 'Your most active focus this week',
    };
  }

  return {
    ...base,
    state: 'empty',
    value: 'Complete a session and reflect on it to get personalized suggestions here.',
    sub: null,
  };
}
