// src/services/localMigrationService.js
//
// Versioned local AsyncStorage schema migration engine.
// Runs synchronously during app startup (before isAppReady=true) so all data
// is normalized before any screen reads it.
//
// Design:
//   - Each migration is a pure function: reads → transforms → writes
//   - Idempotent: checking '@data_version' ensures a migration never runs twice
//   - Atomic: version is only advanced AFTER the migration succeeds
//   - Concurrent-safe: module-level flag prevents multiple simultaneous runs
//   - Never throws to caller — failure is logged and retried on next launch
//
// Version history:
//   0 → 1: Normalize sessions — add missing 'id', backfill 'syncStatus: pending'

import AsyncStorage from '@react-native-async-storage/async-storage';

const DATA_VERSION_KEY = '@data_version';
const CURRENT_VERSION  = 1;
const SESSIONS_KEY     = '@deep_work_sessions';

// Prevent concurrent runs within a single app session
let _running = false;

/**
 * Returns true while a migration is in progress.
 * deepWorkStore.addSession reads this to guard against writes during migration.
 */
export const isMigrationRunning = () => _running;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check current local schema version and run any outstanding migrations.
 * Safe to call on every app launch — exits immediately if already current.
 *
 * Never throws. On failure the version is NOT advanced, so the next launch
 * will retry automatically.
 */
export const runLocalMigrationsIfNeeded = async () => {
  if (_running) {
    console.log('[LocalMigration] Already running — skipping concurrent call');
    return;
  }
  _running = true;

  try {
    const raw = await AsyncStorage.getItem(DATA_VERSION_KEY);
    const storedVersion = raw !== null ? parseInt(raw, 10) : 0;

    if (storedVersion >= CURRENT_VERSION) {
      console.log(`[LocalMigration] Schema current (v${storedVersion}) — nothing to do`);
      return;
    }

    console.log(`[LocalMigration] Migrating v${storedVersion} → v${CURRENT_VERSION}`);

    for (let v = storedVersion; v < CURRENT_VERSION; v++) {
      await runStep(v);
      // Advance version after EACH step so a mid-run crash only replays
      // the remaining steps, not the whole sequence.
      await AsyncStorage.setItem(DATA_VERSION_KEY, String(v + 1));
      console.log(`[LocalMigration] Step v${v}→v${v + 1} complete`);
    }

    console.log(`[LocalMigration] All migrations complete — now at v${CURRENT_VERSION}`);
  } catch (error) {
    // Version was NOT advanced past the failed step — will retry on next launch
    console.warn('[LocalMigration] Migration failed — will retry on next launch:', error.message);
  } finally {
    _running = false;
  }
};

// ─── Step dispatcher ──────────────────────────────────────────────────────────

const runStep = async (fromVersion) => {
  switch (fromVersion) {
    case 0: return migrateV0toV1();
    default:
      console.warn(`[LocalMigration] No handler for v${fromVersion} — skipping`);
  }
};

// ─── Migration steps ──────────────────────────────────────────────────────────

/**
 * v0 → v1: Normalize all sessions in '@deep_work_sessions'.
 *
 * Fixes applied per session:
 *   1. Add deterministic `id` if missing   (format: 'YYYY-MM-DD-<timestamp>')
 *   2. Backfill `syncStatus: 'pending'`    if the field doesn't exist
 *      (ensures the Firestore migration picks them up on next login)
 */
const migrateV0toV1 = async () => {
  console.log('[LocalMigration] v0→v1: normalizing sessions');

  const raw = await AsyncStorage.getItem(SESSIONS_KEY);

  if (!raw) {
    console.log('[LocalMigration] v0→v1: no sessions found — nothing to normalize');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    console.warn('[LocalMigration] v0→v1: sessions JSON unparseable — skipping normalization');
    return;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[LocalMigration] v0→v1: unexpected sessions shape — skipping');
    return;
  }

  let changedCount = 0;
  const normalized = {};

  for (const [date, sessions] of Object.entries(parsed)) {
    // Preserve non-array values as-is so the existing repairStorage logic
    // can handle them — don't make things worse here.
    if (!Array.isArray(sessions)) {
      normalized[date] = sessions;
      continue;
    }

    normalized[date] = sessions.map((session) => {
      if (!session || typeof session !== 'object') return session;

      const patch = {};

      // 1. Add missing id
      if (!session.id) {
        const ts = session.timestamp || session.metadata?.created || Date.now();
        patch.id = `${date}-${ts}`;
      }

      // 2. Backfill syncStatus
      if (!session.syncStatus) {
        patch.syncStatus = 'pending';
      }

      if (Object.keys(patch).length === 0) return session;

      changedCount++;
      return { ...session, ...patch };
    });
  }

  if (changedCount > 0) {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(normalized));
    console.log(`[LocalMigration] v0→v1: patched ${changedCount} session(s)`);
  } else {
    console.log('[LocalMigration] v0→v1: all sessions already normalized');
  }
};
