// insightCardService.js — assembles the fixed-order Insight Card carousel
// content by fetching sessions/aggregations once and handing them to the
// per-type builder functions in cardBuilders.js.

import SessionRepository from '../database/SessionRepository';
import DataAggregator from './DataAggregator';
import { generateInsights, localDateKey, startOfWeek, shiftDays } from './insightEngine';
import { loadInsightHistory, recordShownInsights } from './insightHistory';
import { getStartOfDay, getStartOfWeek, secondsToMinutes } from '../../utils/dateHelpers';
import {
  buildAiInsightCard,
  buildSoFarCard,
  buildComparisonCard,
  buildDataCard,
  buildUpNextCard,
} from './cardBuilders';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildInsightCards() {
  const now = Date.now();
  const todayStart = getStartOfDay(now);
  const thisWeekStart = getStartOfWeek(now);
  const lastWeekStart = thisWeekStart - 7 * DAY_MS;

  // The engine's widest window: this week plus the two before it, with a
  // day of margin because storage buckets sessions by UTC date. The engine
  // filters precisely by local start time itself.
  const engineWindowStart = shiftDays(startOfWeek(now), -15);

  const [windowSessions, history, todaySessions, thisWeekSessions, lastWeekSessions] = await Promise.all([
    SessionRepository.getSessionsByDateRange(engineWindowStart, now),
    loadInsightHistory(),
    SessionRepository.getSessionsByDateRange(todayStart, now),
    SessionRepository.getSessionsByDateRange(thisWeekStart, now),
    SessionRepository.getSessionsByDateRange(lastWeekStart, thisWeekStart - 1),
  ]);

  const aggToday = DataAggregator.aggregateSessions(todaySessions);
  const aggThisWeek = DataAggregator.aggregateSessions(thisWeekSessions);
  const aggLastWeek = DataAggregator.aggregateSessions(lastWeekSessions);

  const longestSessionMinutes = thisWeekSessions.length
    ? Math.max(...thisWeekSessions.map((s) => secondsToMinutes(s.duration)))
    : null;

  const insightResult = generateInsights(windowSessions, { now, history });
  recordShownInsights(insightResult.insights, localDateKey(now));

  // Fixed priority order per the design system: Insights lead, Up Next closes.
  return [
    buildAiInsightCard({ insightResult }),
    buildSoFarCard({ aggToday }),
    buildComparisonCard({ aggThisWeek, aggLastWeek }),
    buildDataCard({ aggThisWeek, longestSessionMinutes }),
    buildUpNextCard({ aggThisWeek }),
  ];
}
