/**
 * widgetHandoffService.js
 * Consumes the widget's pending session-start handoff (App Group, written by
 * StartFocusSessionIntent in DeepWorkWidget.swift) and resolves it into
 * session-start params the app's EXISTING canonical start path can use
 * unchanged — this file never starts a session itself, only decides
 * whether/what to start.
 *
 * Design principles:
 * - Exactly-once: all calls are serialized through a lock (same pattern as
 *   deepWorkStore.addSession's _addSessionLock) so two near-simultaneous
 *   triggers (e.g. two AppState 'active' events) can't both read the same
 *   not-yet-cleared request.
 * - The pending request is cleared as soon as it's been validated — before
 *   the active-session check or session actually starts — so a crash or
 *   early return afterward can never cause it to silently re-fire later.
 * - Malformed or expired requests are cleared and rejected, never crash.
 * - An existing active session always wins — this never starts a second one.
 * - Config resolution prefers the handoff's own fields (usually accurate —
 *   mirrored from the same source moments earlier by widgetSyncService) but
 *   falls back to the live AsyncStorage last-used config for anything
 *   missing/invalid, since that remains the real source of truth.
 */

import { getPendingSessionStart, clearPendingSessionStart } from './widgetDataBridge';
import { getActiveSession, getLastUsedSessionConfig, discardActiveSession, saveLastSessionConfig } from './sessionStateService';
import { deepWorkStore } from './deepWorkStore';
import { saveSessionToFirestore } from './firestoreSessionService';

// Long enough to comfortably cover realistic cold-launch + auth-resolution
// latency (typically a few seconds, generously up to ~30s on a slow
// network), short enough that a user who tapped FOCUS and only opened the
// app much later doesn't get a session started on stale intent.
const PENDING_REQUEST_EXPIRATION_MS = 90 * 1000;

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isPositiveNumber = (v) => typeof v === 'number' && isFinite(v) && v > 0;

// Mirrors HomeScreen's existing long-session premium gate (duration >= 45 &&
// !isPremium). Reused verbatim rather than re-deriving a threshold here —
// see HomeScreen.js's showGatedPaywall('long_session', ...) call site.
const LONG_SESSION_MINUTES_THRESHOLD = 45;

let _lock = Promise.resolve();

/**
 * Resolve an orphaned 'expired' active-session record the same way
 * HomeScreen.handleSaveExpiredSession does: save it to history (best-effort
 * Firestore sync included) and then discard the record, so a new
 * widget-triggered session can proceed. Mirrors that function's semantics
 * exactly — this never invents or discards data silently, it just performs
 * the same resolution the user would otherwise have to do by hand on Home.
 */
const resolveExpiredActiveSession = async (active) => {
  const config = active?.config;
  if (!config) {
    await discardActiveSession();
    return;
  }

  try {
    const settings = await deepWorkStore.getSettings();
    const activityColor = settings.activities.find(a => a.id === config.activity)?.color;

    const result = await deepWorkStore.addSession({
      activity:    config.activity,
      duration:    parseFloat(config.duration),
      musicChoice: config.musicChoice || 'none',
      notes:       '',
      timestamp:   active.endTime,
      ...(activityColor ? { activityColor } : {}),
    });
    await discardActiveSession();

    // Same field mapping DeepWorkSession.js/HomeScreen.js use on their own
    // completion paths — without this, the widget's defaultSessionConfig
    // never gets populated for a session resolved here.
    await saveLastSessionConfig({
      activity: config.activity,
      activityName: settings.activities.find(a => a.id === config.activity)?.name || '',
      duration: config.duration,
      musicChoice: config.musicChoice,
      focusLockEnabled: config.focusLockEnabled,
    });

    if (result?.success && result.session?.id) {
      saveSessionToFirestore(result.session).catch((err) => {
        console.log('[WidgetHandoff] JS: Firestore save failed for resolved expired session (non-critical):', err.message);
      });
    }
  } catch (error) {
    console.warn('[WidgetHandoff] JS: failed to save expired session before widget start (non-critical, discarding):', error.message);
    await discardActiveSession();
  }
};

/**
 * Validates and consumes the pending widget session-start request, if any.
 * Safe to call from multiple lifecycle points (cold launch, foreground) —
 * calls are serialized and a request is only ever resolved once.
 *
 * Does NOT navigate or start anything itself — callers use the returned
 * params with the existing DeepWorkSession navigation/start path.
 *
 * @param {object} [options]
 * @param {boolean} [options.isPremium] - current effective premium status
 *   (from SubscriptionContext.useSubscription()). Required to safely resolve
 *   a request whose duration would otherwise bypass the app's existing
 *   long-session paywall gate. If omitted/undefined (subscription state not
 *   yet resolved), long-session requests are conservatively blocked rather
 *   than risking a bypass — same fail-closed principle as the auth gate.
 * @returns {Promise<{ started: boolean, reason?: string, params?: { activity: string, duration: number, musicChoice: string, focusLockEnabled: boolean } }>}
 */
export const processPendingWidgetSessionStart = async ({ isPremium } = {}) => {
  const prevLock = _lock;
  let releaseLock;
  _lock = new Promise((resolve) => { releaseLock = resolve; });
  await prevLock.catch(() => {});

  try {
    const pending = await getPendingSessionStart();
    console.log('[WidgetHandoff] JS: pending handoff payload =', pending);
    if (!pending) {
      return { started: false, reason: 'no_pending_request' };
    }

    if (!isNonEmptyString(pending.requestId)) {
      console.log('[WidgetHandoff] JS: rejected — malformed_request', pending);
      await clearPendingSessionStart();
      return { started: false, reason: 'malformed_request' };
    }

    const ageMs = Date.now() - Number(pending.createdAt);
    if (!isFinite(ageMs) || ageMs < 0 || ageMs > PENDING_REQUEST_EXPIRATION_MS) {
      console.log('[WidgetHandoff] JS: rejected — expired, ageMs=', ageMs);
      await clearPendingSessionStart();
      return { started: false, reason: 'expired' };
    }

    // Consume now — before any further decision — so this exact request can
    // never be evaluated twice regardless of what happens next.
    await clearPendingSessionStart();

    const active = await getActiveSession();
    if (active) {
      if (active.status !== 'expired') {
        // A genuinely in-progress session (status 'running') is a real
        // conflict — never silently override it.
        console.log('[WidgetHandoff] JS: rejected — active_session_exists', active);
        return { started: false, reason: 'active_session_exists' };
      }
      // An 'expired' record is just a previous session whose timer ran out
      // while the app was away and nobody has acknowledged it yet — the same
      // state HomeScreen's "Session ended while away" prompt resolves with a
      // single tap before letting the user start a new one. The widget path
      // has no such prompt, so resolve it here the same way
      // (HomeScreen.handleSaveExpiredSession: save to history, then discard)
      // rather than leaving it to permanently block every future widget tap.
      console.log('[WidgetHandoff] JS: resolving orphaned expired session before continuing', active);
      await resolveExpiredActiveSession(active);
    }

    const lastUsed = await getLastUsedSessionConfig();

    const activity = isNonEmptyString(pending.activity) ? pending.activity : lastUsed?.activity;
    const duration = isPositiveNumber(pending.durationMinutes) ? pending.durationMinutes : lastUsed?.duration;
    const musicChoice = isNonEmptyString(pending.musicChoice)
      ? pending.musicChoice
      : (lastUsed?.musicChoice || 'none');
    const focusLockEnabled = typeof pending.focusLockEnabled === 'boolean'
      ? pending.focusLockEnabled
      : (lastUsed?.focusLockEnabled ?? false);

    if (!isNonEmptyString(activity) || !isPositiveNumber(duration)) {
      // No usable config anywhere (e.g. brand-new account, never started a
      // session) — fail safely rather than starting with invented values.
      console.log('[WidgetHandoff] JS: rejected — no_usable_session_config', { activity, duration, pending, lastUsed });
      return { started: false, reason: 'no_usable_session_config' };
    }

    // Monetization gate — must not let a widget tap silently bypass the
    // existing long-session paywall. isPremium === true is required
    // explicitly; undefined (not yet resolved) or false both block, same
    // fail-closed posture as the active-session and auth checks above. This
    // does not show the paywall UI itself (that's HomeScreen-owned state,
    // out of scope for this integration pass) — it just refuses to
    // auto-start a gated session. See milestone report for the documented
    // limitation.
    if (duration >= LONG_SESSION_MINUTES_THRESHOLD && isPremium !== true) {
      console.log('[WidgetHandoff] JS: rejected — premium_required', { duration, isPremium });
      return { started: false, reason: 'premium_required' };
    }

    console.log('[WidgetHandoff] JS: ACCEPTED, resolved params =', { activity, duration, musicChoice, focusLockEnabled });
    return {
      started: true,
      params: { activity, duration, musicChoice, focusLockEnabled },
    };
  } catch (error) {
    console.warn('[WidgetHandoff] JS: processPendingWidgetSessionStart threw:', error.message);
    return { started: false, reason: 'error' };
  } finally {
    releaseLock();
  }
};
