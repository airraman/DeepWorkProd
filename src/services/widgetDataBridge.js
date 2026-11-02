/**
 * widgetDataBridge.js
 * Thin wrapper over the native WidgetDataBridge module (App Group write side
 * of the widget's shared-data contract).
 *
 * Callers assemble the payload (see widgetSyncService.js, which is the
 * intended single caller — it reads real data from existing app services and
 * calls this function; nothing else should construct this payload by hand).
 *
 * Safe to import and call even before WidgetDataBridge.swift/.m have been
 * added to the DeepWorkio Xcode target and the app rebuilt — no-ops with a
 * warning instead of crashing or throwing.
 */

import { NativeModules } from 'react-native';

const { WidgetDataBridge } = NativeModules;

/**
 * Write the widget's shared-state contract to the App Group and trigger a
 * WidgetKit timeline reload.
 *
 * Shape must match WidgetSharedState in ios/DeepWorkWidget/DeepWorkWidget.swift:
 * {
 *   sessionsCompletedToday: number,
 *   weeklyActivity: [{ date: 'YYYY-MM-DD', sessionsCount: number, isToday: boolean }] (7 entries, oldest first),
 *   activeSession: { isActive, startTime?, endTime?, durationMinutes? } | null,
 *   lastCompletedSession: { activity?, durationMinutes?, completedAt? } | null,
 *   defaultSessionConfig: { activity?, durationMinutes?, musicChoice?, focusLockEnabled? } | null,
 *   updatedAt: number (ms epoch — set automatically by this function)
 * }
 *
 * @param {object} state - partial WidgetSharedState (updatedAt is added automatically)
 * @returns {Promise<boolean>} - true if written, false if skipped or failed
 */
export const setWidgetSharedState = async (state) => {
  if (!WidgetDataBridge) {
    console.warn(
      '[widgetDataBridge] Native module not linked — skipping ' +
      '(WidgetDataBridge.swift/.m not yet added to the Xcode target)'
    );
    return false;
  }

  try {
    const payload = JSON.stringify({ ...state, updatedAt: Date.now() });
    await WidgetDataBridge.setSharedState(payload);
    return true;
  } catch (error) {
    console.warn('[widgetDataBridge] setSharedState failed (non-critical):', error.message);
    return false;
  }
};

/**
 * Read (without clearing) the widget's pending session-start handoff, if any.
 * Shape: { requestId: string, createdAt: number, activity?, durationMinutes?,
 *          musicChoice?, focusLockEnabled? } | null
 *
 * Deliberately a minimal, explicit API (get/clear) rather than exposing raw
 * App Group UserDefaults access to JS — the native side owns the App Group
 * key name and read/write mechanics.
 *
 * @returns {Promise<object|null>}
 */
export const getPendingSessionStart = async () => {
  if (!WidgetDataBridge) return null;
  try {
    const result = await WidgetDataBridge.getPendingSessionStart();
    return result || null;
  } catch (error) {
    console.warn('[widgetDataBridge] getPendingSessionStart failed (non-critical):', error.message);
    return null;
  }
};

/**
 * Clear the pending session-start handoff. Safe to call even if nothing is
 * pending.
 *
 * @returns {Promise<boolean>}
 */
export const clearPendingSessionStart = async () => {
  if (!WidgetDataBridge) return false;
  try {
    await WidgetDataBridge.clearPendingSessionStart();
    return true;
  } catch (error) {
    console.warn('[widgetDataBridge] clearPendingSessionStart failed (non-critical):', error.message);
    return false;
  }
};

export const createPendingSessionStart = async () => {
  if (!WidgetDataBridge) return false;

  try {
    await WidgetDataBridge.createPendingSessionStart();
    return true;
  } catch (error) {
    console.warn(
      '[widgetDataBridge] createPendingSessionStart failed (non-critical):',
      error.message
    );
    return false;
  }
};
