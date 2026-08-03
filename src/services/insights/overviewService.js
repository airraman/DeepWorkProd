// overviewService.js — adapter for the Insights bottom sheet's "THIS WEEK"
// header and Quick Start section. Reuses deepWorkStore (the same source
// SessionRepository/insightCardService read from) rather than recomputing
// session aggregation logic that already exists elsewhere.

import { deepWorkStore } from '../deepWorkStore';
import { generateWeeklyChartData } from '../../utils/weeklyChartData';
import { getStartOfWeek } from '../../utils/dateHelpers';
import { getLastUsedSessionConfig } from '../sessionStateService';

function getThisWeekSessions(allSessions) {
  const weekStart = getStartOfWeek(Date.now());
  const flat = [];
  Object.entries(allSessions).forEach(([dateString, daySessions]) => {
    if (new Date(dateString).getTime() >= weekStart) {
      flat.push(...daySessions);
    }
  });
  return flat;
}

function mostCommon(values) {
  if (!values.length) return null;
  const counts = {};
  values.forEach((v) => {
    counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export async function getWeeklyOverview() {
  const allSessions = await deepWorkStore.getSessions();
  const weekSessions = getThisWeekSessions(allSessions);
  const stats = await deepWorkStore.getStatistics();

  const totalMinutes = weekSessions.reduce((sum, s) => sum + s.duration, 0);

  return {
    chartData: generateWeeklyChartData(allSessions),
    weeklySessions: weekSessions.length,
    weeklyHours: parseFloat((totalMinutes / 60).toFixed(1)),
    currentStreak: stats.streaks.current,
  };
}

export async function getQuickStartDefaults() {
  const allSessions = await deepWorkStore.getSessions();
  const weekSessions = getThisWeekSessions(allSessions);
  const lastUsed = await getLastUsedSessionConfig();

  const mostCommonDuration = mostCommon(weekSessions.map((s) => s.duration));
  const mostCommonActivity = mostCommon(weekSessions.map((s) => s.activity));

  return {
    duration: mostCommonDuration || (lastUsed?.duration ? String(lastUsed.duration) : '30'),
    activity: mostCommonActivity || lastUsed?.activity || null,
    musicChoice: lastUsed?.musicChoice || 'none',
  };
}
