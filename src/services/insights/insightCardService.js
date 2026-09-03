// insightCardService.js — assembles the fixed-order Insight Card carousel
// content by fetching sessions/aggregations once and handing them to the
// per-type builder functions in cardBuilders.js.

import SessionRepository from '../database/SessionRepository';
import DataAggregator from './DataAggregator';
import InsightGenerator from './InsightGenerator';
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

  const [todaySessions, thisWeekSessions, lastWeekSessions] = await Promise.all([
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

  const aiInsight = await InsightGenerator.generate('behavioral_30d', { referenceDate: new Date() }).catch(
    () => ({ success: false })
  );

  // Fixed priority order per the design system: AI Insight leads, Up Next closes.
  return [
    buildAiInsightCard({ aiInsight }),
    buildSoFarCard({ aggToday }),
    buildComparisonCard({ aggThisWeek, aggLastWeek }),
    buildDataCard({ aggThisWeek, longestSessionMinutes }),
    buildUpNextCard({ aiInsight, aggThisWeek }),
  ];
}
