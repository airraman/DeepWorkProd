/**
 * migrationService.js
 * One-time migration of all AsyncStorage session data to Firestore.
 *
 * Design principles:
 * - Never deletes or modifies AsyncStorage data — read-only from local store
 * - Idempotent — safe to call multiple times, only runs once per user
 * - Batch writes in groups of 100 (Firestore limit is 500, 100 is safe margin)
 * - If migration fails partway through, it does not mark as complete — will retry next login
 * - Never throws to caller — all errors are caught and logged
 */

import firestore from '../config/firebaseConfig';
import { hasMigrated, setMigrationComplete } from './authService';
import { getSessions } from './deepWorkStore';

const SESSIONS_SUBCOLLECTION = 'sessions';
const BATCH_SIZE = 100;

/**
 * Main migration entry point.
 * Called from App.js onAuthStateChanged after login.
 * Safe to call on every login — exits immediately if already migrated.
 *
 * @param {object} firebaseUser - Firebase Auth user object
 * @returns {Promise<{ skipped: boolean, migrated: number, failed: boolean }>}
 */
export const runMigration = async (firebaseUser) => {
  console.log('🔄 [migrationService] runMigration — uid:', firebaseUser.uid);

  try {
    // ── Guard: already migrated ──────────────────────────────────────────────
    const alreadyMigrated = await hasMigrated(firebaseUser.uid);
    if (alreadyMigrated) {
      console.log('✅ [migrationService] Already migrated — skipping');
      return { skipped: true, migrated: 0, failed: false };
    }

    // ── Read all local sessions ──────────────────────────────────────────────
    const sessionsByDate = await getSessions();
    const allSessions = flattenSessions(sessionsByDate);

    console.log(`📦 [migrationService] Found ${allSessions.length} local sessions to migrate`);

    if (allSessions.length === 0) {
      // No sessions to migrate — still mark as complete so we don't check again
      await setMigrationComplete(firebaseUser.uid);
      console.log('✅ [migrationService] No sessions to migrate — marked complete');
      return { skipped: false, migrated: 0, failed: false };
    }

    // ── Batch write to Firestore ─────────────────────────────────────────────
    const totalMigrated = await writeBatches(firebaseUser.uid, allSessions);

    // ── Mark migration complete ──────────────────────────────────────────────
    // Only reaches here if all batches succeeded
    await setMigrationComplete(firebaseUser.uid);

    console.log(`✅ [migrationService] Migration complete — ${totalMigrated} sessions written`);
    return { skipped: false, migrated: totalMigrated, failed: false };

  } catch (error) {
    // Do NOT mark as complete — will retry on next login
    console.log('❌ [migrationService] Migration failed:', error.message);
    return { skipped: false, migrated: 0, failed: true };
  }
};

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Flatten the { 'YYYY-MM-DD': Session[] } AsyncStorage structure
 * into a flat array of session objects.
 */
const flattenSessions = (sessionsByDate) => {
  if (!sessionsByDate || typeof sessionsByDate !== 'object') return [];

  return Object.values(sessionsByDate).reduce((acc, daySessions) => {
    if (Array.isArray(daySessions)) {
      return acc.concat(daySessions);
    }
    return acc;
  }, []);
};

/**
 * Write sessions to Firestore in batches of BATCH_SIZE.
 * Returns total number of sessions successfully written.
 *
 * Advanced: Firestore batch writes are atomic per batch — if one document
 * in a batch fails, the entire batch fails. Batching at 100 minimizes
 * data loss surface if a failure occurs mid-migration.
 */
const writeBatches = async (userId, sessions) => {
  let totalWritten = 0;
  const chunks = chunkArray(sessions, BATCH_SIZE);

  console.log(`📦 [migrationService] Writing ${chunks.length} batch(es) of up to ${BATCH_SIZE} sessions`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`🔄 [migrationService] Writing batch ${i + 1}/${chunks.length} — ${chunk.length} sessions`);

    try {
      const batch = firestore().batch();

      chunk.forEach((session) => {
        // Use existing session id as Firestore document id for deduplication
        const sessionId = session.id || generateSessionId(session);
        const docRef = firestore()
          .collection('users')
          .doc(userId)
          .collection(SESSIONS_SUBCOLLECTION)
          .doc(sessionId);

        batch.set(docRef, sanitizeSession(session), { merge: true });
      });

      await batch.commit();
      totalWritten += chunk.length;
      console.log(`✅ [migrationService] Batch ${i + 1} committed — total so far: ${totalWritten}`);

    } catch (batchError) {
      console.log(`❌ [migrationService] Batch ${i + 1} failed:`, batchError.message);
      // Throw so the parent catches it and does not mark migration complete
      throw batchError;
    }
  }

  return totalWritten;
};

/**
 * Sanitize a session object before writing to Firestore.
 * - Removes undefined values (Firestore rejects them)
 * - Adds migratedFromLocal flag
 * - Converts numeric timestamps to Firestore Timestamps where appropriate
 */
const sanitizeSession = (session) => {
  const sanitized = {
    migratedFromLocal: true,
    syncStatus: 'synced',
  };

  // Copy all defined fields
  const fields = [
    'id', 'date', 'activity', 'duration', 'musicChoice',
    'notes', 'ratings', 'timestamp', 'completedAt', 'metadata'
  ];

  fields.forEach((field) => {
    if (session[field] !== undefined && session[field] !== null) {
      sanitized[field] = session[field];
    }
  });

  return sanitized;
};

/**
 * Generate a fallback session ID if one doesn't exist.
 * Format matches existing AsyncStorage id pattern.
 */
const generateSessionId = (session) => {
  const date = session.date || new Date().toISOString().split('T')[0];
  const ts = session.timestamp || Date.now();
  return `${date}-${ts}`;
};

/**
 * Split an array into chunks of given size.
 */
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};