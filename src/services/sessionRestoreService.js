/**
 * sessionRestoreService.js
 * Firestore → local session-history restoration.
 *
 * Distinct, one-directional counterpart to migrationService (which is local →
 * Firestore only). This service never writes to Firestore and never deletes
 * local data — it only ever ADDS sessions that exist in Firestore but are
 * missing locally (e.g. after a reinstall or on a new device).
 *
 * Design principles:
 * - Local sessions always win on id collision — never overwrites a local
 *   session with a Firestore copy.
 * - Idempotent — safe to call on every login; a per-device/per-account guard
 *   flag skips the Firestore read entirely once nothing remains to restore,
 *   so normal launches after the first stay cheap. The flag is only written
 *   after a genuinely successful pass — a fetch/write failure leaves it
 *   unset so the next login retries.
 * - Sessions are converted and merged ONE AT A TIME. A single malformed
 *   Firestore document (bad date field, etc.) is logged and skipped — it
 *   must never abort restoration of the other valid sessions.
 * - Never throws to caller — all errors are caught and logged; a failed
 *   restore never blocks app usage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionsFromFirestore } from './firestoreSessionService';
import { deepWorkStore, isValidSession } from './deepWorkStore';

const RESTORE_FLAG_PREFIX = '@sessions_restored_';

/**
 * Main restore entry point.
 * Called from App.js handleMigrationNeeded, after runMigration, on every
 * auth resolution. Safe to call on every login — exits immediately if this
 * device has already restored for this uid.
 *
 * @param {object} firebaseUser - Firebase Auth user object
 * @returns {Promise<{ skipped: boolean, restored: number, failed: boolean, skippedSessions: number }>}
 */
export const restoreSessionsFromFirestore = async (firebaseUser) => {
  const flagKey = `${RESTORE_FLAG_PREFIX}${firebaseUser.uid}`;
  console.log('🔄 [sessionRestoreService] restoreSessionsFromFirestore — uid:', firebaseUser.uid);

  try {
    // ── Guard: already restored on this device for this account ────────────
    // The flag alone isn't proof local history is still intact — it's just a
    // timestamp from a prior successful pass. If local session data is
    // completely empty despite the flag being set (e.g. local storage was
    // wiped by something outside this service after that prior pass), trust
    // what's actually on disk over a stale flag and retry the fetch instead
    // of permanently suppressing restoration for this device/account.
    const alreadyRestored = await AsyncStorage.getItem(flagKey);
    const localSessionsByDate = await deepWorkStore.getSessions();
    const localSessionCount = Object.values(localSessionsByDate)
      .reduce((sum, daySessions) => sum + daySessions.length, 0);

    if (alreadyRestored && localSessionCount > 0) {
      console.log('✅ [sessionRestoreService] Already restored on this device — skipping');
      return { skipped: true, restored: 0, failed: false, skippedSessions: 0 };
    }
    if (alreadyRestored && localSessionCount === 0) {
      console.log('⚠️ [sessionRestoreService] Restore flag set but local history is empty — retrying restore instead of trusting stale flag');
    }

    // ── Fetch remote (infrastructure-level failures here ARE fatal to this
    //    pass — no data to work with, guard flag stays unset) ───────────────
    const remoteSessions = await getSessionsFromFirestore();

    console.log(
      `📦 [sessionRestoreService] fetched ${remoteSessions.length} remote session(s), ` +
      `local session count: ${localSessionCount} (${Object.keys(localSessionsByDate).length} date bucket(s))`
    );

    // Build a set of local ids for O(1) collision checks.
    const localIds = new Set();
    Object.values(localSessionsByDate).forEach((daySessions) => {
      daySessions.forEach((s) => { if (s.id) localIds.add(s.id); });
    });

    // ── Convert + merge, ONE SESSION AT A TIME ──────────────────────────────
    // Each iteration is independently wrapped so one malformed document
    // (bad date field, missing required field, etc.) never aborts the rest.
    const merged = { ...localSessionsByDate };
    let restoredCount = 0;
    const skipped = []; // [{ id, reason }]

    for (const remoteSession of remoteSessions) {
      const docId = remoteSession.id || '(missing id)';

      try {
        if (!remoteSession.id) {
          throw new Error('missing document id');
        }
        if (localIds.has(remoteSession.id)) {
          continue; // local wins — not a failure, just nothing to do
        }

        const localShapeSession = toLocalSessionShape(remoteSession); // may throw
        if (!isValidSession(localShapeSession)) {
          throw new Error(
            `failed isValidSession (activity=${typeof localShapeSession.activity}, ` +
            `duration=${typeof localShapeSession.duration}:${localShapeSession.duration}, ` +
            `musicChoice=${typeof localShapeSession.musicChoice})`
          );
        }

        const dateKey = dateKeyFor(localShapeSession); // may throw
        if (!merged[dateKey]) merged[dateKey] = [];
        merged[dateKey].push(localShapeSession);
        restoredCount++;

      } catch (sessionError) {
        skipped.push({ id: docId, reason: sessionError.message });
        console.log(
          `⚠️ [sessionRestoreService] Skipped session ${docId} — ${sessionError.message} ` +
          `(raw timestamp: ${describeRawValue(remoteSession.timestamp)}, ` +
          `raw date: ${describeRawValue(remoteSession.date)})`
        );
      }
    }

    console.log(
      `📦 [sessionRestoreService] restored ${restoredCount}, skipped ${skipped.length} of ${remoteSessions.length} remote session(s)`
    );

    // ── Persist only if something actually changed ──────────────────────────
    let writeSucceeded = true;
    if (restoredCount > 0) {
      writeSucceeded = await deepWorkStore.mergeSessions(merged);
      console.log(`📦 [sessionRestoreService] merge write result: ${writeSucceeded ? 'success' : 'FAILED'}`);
      if (!writeSucceeded) {
        // Do not set the guard flag — retry on next login.
        console.log('❌ [sessionRestoreService] Merge write failed — will retry on next login');
        return { skipped: false, restored: 0, failed: true, skippedSessions: skipped.length };
      }
    }

    // Mark this device as restored for this uid regardless of whether any
    // sessions were actually missing — avoids re-querying Firestore on every
    // future launch once this device is caught up. Only reached on a
    // successful pass (fetch + per-session processing + write all completed).
    await AsyncStorage.setItem(flagKey, String(Date.now()));

    console.log(
      `✅ [sessionRestoreService] Restore complete — ${restoredCount} restored, ${skipped.length} skipped`
    );
    return { skipped: false, restored: restoredCount, failed: false, skippedSessions: skipped.length };

  } catch (error) {
    // Infrastructure-level failure (Firestore fetch, local read, etc.) —
    // non-fatal to the app, guard flag intentionally left unset so this
    // retries on next login.
    console.log('❌ [sessionRestoreService] Restore failed (non-critical):', error.message);
    return { skipped: false, restored: 0, failed: true, skippedSessions: 0 };
  }
};

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Firestore session document into the exact shape deepWorkStore
 * expects locally. Firestore docs are expected to carry the same field set
 * written by firestoreSessionService/migrationService's sanitizeSession, but
 * date-like fields (timestamp, completedAt) may come back as a Firestore
 * native Timestamp object rather than a plain number/string — normalizeTimestamp
 * handles that. Throws on unrecoverable conversion failure so the caller's
 * per-session try/catch can skip just this one record.
 */
const toLocalSessionShape = (remoteSession) => {
  const timestampMs = normalizeTimestamp(remoteSession.timestamp) ?? Date.now();

  return {
    id: remoteSession.id,
    date: isValidDateKey(remoteSession.date) ? remoteSession.date : dateKeyFromMillis(timestampMs),
    activity: remoteSession.activity,
    duration: remoteSession.duration,
    musicChoice: remoteSession.musicChoice,
    notes: remoteSession.notes || '',
    ...(remoteSession.activityColor ? { activityColor: remoteSession.activityColor } : {}),
    timestamp: timestampMs,
    completedAt: normalizeToIsoString(remoteSession.completedAt) || new Date(timestampMs).toISOString(),
    syncStatus: 'synced',
    ...(remoteSession.rating !== undefined ? { rating: remoteSession.rating } : {}),
    ...(remoteSession.ratings !== undefined ? { ratings: remoteSession.ratings } : {}),
    metadata: remoteSession.metadata || {
      appVersion: '1.0.0',
      created: timestampMs,
      modified: timestampMs,
    },
  };
};

/**
 * Derive the 'YYYY-MM-DD' bucket key for an already-normalized local-shape
 * session (timestamp is guaranteed to be a finite millisecond number by the
 * time this is called from toLocalSessionShape).
 */
const dateKeyFor = (localShapeSession) => {
  if (isValidDateKey(localShapeSession.date)) return localShapeSession.date;
  return dateKeyFromMillis(localShapeSession.timestamp);
};

const dateKeyFromMillis = (ms) => {
  const d = new Date(ms);
  if (isNaN(d.getTime())) {
    throw new Error(`could not derive date key from timestamp ${ms}`);
  }
  return d.toISOString().split('T')[0];
};

const isValidDateKey = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Normalize any of the date representations this project's Firestore data
 * may actually contain into a finite millisecond timestamp:
 *   - Firestore Timestamp instance (has .toDate()) — the existing convention
 *     used elsewhere in this codebase (see ProfileScreen.js:83, userProfile.createdAt.toDate())
 *   - Plain { seconds, nanoseconds } object (Timestamp shape after
 *     serialization, e.g. via JSON)
 *   - JS Date instance
 *   - Finite number (already a millisecond timestamp)
 *   - ISO / parseable date string
 * Returns null (not throw) if the value is absent so callers can fall back
 * to Date.now(); throws only when a present value cannot be parsed at all,
 * so the caller's per-session catch reports a clear reason instead of a
 * generic "Date value out of bounds".
 */
const normalizeTimestamp = (value) => {
  if (value === undefined || value === null) return null;

  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error(`timestamp is a non-finite number (${value})`);
    return value;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const d = value.toDate();
    if (isNaN(d.getTime())) throw new Error('Firestore Timestamp.toDate() produced an invalid date');
    return d.getTime();
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.round(nanos / 1e6);
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error('timestamp is an invalid Date instance');
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (isNaN(parsed)) throw new Error(`timestamp string could not be parsed ("${value}")`);
    return parsed;
  }

  throw new Error(`timestamp has unrecognized type/shape (${typeof value})`);
};

/** Same normalization, returned as an ISO string for completedAt; null if absent/invalid rather than throwing (completedAt is not required by isValidSession). */
const normalizeToIsoString = (value) => {
  try {
    const ms = normalizeTimestamp(value);
    return ms == null ? null : new Date(ms).toISOString();
  } catch (_) {
    return null;
  }
};

/** Short, safe description of a raw field value for diagnostic logging — never throws. */
const describeRawValue = (value) => {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'object') {
      return `object(${value.constructor?.name || 'plain'}):${JSON.stringify(value).slice(0, 80)}`;
    }
    return `${typeof value}:${String(value).slice(0, 40)}`;
  } catch (_) {
    return '(unstringifiable)';
  }
};
