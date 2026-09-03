/**
 * widgetSyncService.js
 * Assembles the widget's shared-state payload from EXISTING app data sources
 * and writes it via widgetDataBridge.setWidgetSharedState(). This file does
 * not compute or store anything itself — it is a thin read-and-forward layer
 * over deepWorkStore, weeklyChartData, and sessionStateService, which remain
 * the actual sources of truth.
 *
 * Called from a minimum reliable set of lifecycle points (audited, not every
 * possible event): session start, session completion, and app foreground.
 * Safe to call at any of them — always non-fatal, never throws.
 */

import { deepWorkStore } from './deepWorkStore';
import { generateWeeklyChartData } from '../utils/weeklyChartData';
import { getActiveSession, getLastUsedSessionConfig } from './sessionStateService';
import { setWidgetSharedState } from './widgetDataBridge';

/**
 * Reads current session/history state from existing services and pushes the
 * widget's shared-state contract to the App Group. Fire-and-forget from all
 * call sites — never blocks or throws.
 *
 * @returns {Promise<boolean>} - true if written, false if skipped/failed
 */
export const syncWidgetState = async () => {
  try {
    const sessionsByDate = await deepWorkStore.getSessions();
    const weeklyChartData = generateWeeklyChartData(sessionsByDate); // last entry (index 6) is today

    const weeklyActivity = weeklyChartData.map((day, index) => ({
      date: day.date,
      sessionsCount: day.sessionsCount,
      isToday: index === weeklyChartData.length - 1,
    }));

    const sessionsCompletedToday = weeklyChartData[weeklyChartData.length - 1]?.sessionsCount ?? 0;

    const active = await getActiveSession(); // null | { config, endTime, status }
    const activeSession = active
      ? {
          isActive: active.status === 'running',
          startTime: active.config.startTime ?? null,
          endTime: active.endTime ?? null,
          durationMinutes: active.config.duration ?? null,
        }
      : { isActive: false, startTime: null, endTime: null, durationMinutes: null };

    const lastUsed = await getLastUsedSessionConfig(); // null | { activity, activityName, duration, musicChoice, focusLockEnabled?, completedAt, hasOfferedRestart }
    const defaultSessionConfig = lastUsed
      ? {
          activity: lastUsed.activity ?? null,
          durationMinutes: lastUsed.duration ?? null,
          musicChoice: lastUsed.musicChoice ?? null,
          // Milestone 5: focusLockEnabled is now persisted going forward.
          // Records saved before this change won't have the field — default
          // to false (matches the existing app-wide implicit default) rather
          // than surfacing undefined to the widget.
          focusLockEnabled: lastUsed.focusLockEnabled ?? false,
        }
      : null;

    return await setWidgetSharedState({
      sessionsCompletedToday,
      weeklyActivity,
      activeSession,
      lastCompletedSession: null, // not yet needed by the current visualization; left null rather than guessed
      defaultSessionConfig,
    });
  } catch (error) {
    console.warn('[widgetSyncService] syncWidgetState failed (non-critical):', error.message);
    return false;
  }
};
