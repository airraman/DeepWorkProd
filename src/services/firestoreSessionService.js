/**
 * firestoreSessionService.js
 * Firestore read/write operations for session data.
 *
 * This service is purely additive — it never replaces AsyncStorage writes.
 * Called alongside existing AsyncStorage saves in DeepWorkSession.js.
 *
 * All methods are safe to call when user is logged out — they exit
 * immediately if no authenticated user is present.
 */

import firestore from '../config/firebaseConfig';
import auth from '@react-native-firebase/auth';

const SESSIONS_SUBCOLLECTION = 'sessions';

/**
 * Save a single completed session to Firestore.
 * Safe to call regardless of auth state — no-ops if logged out.
 *
 * @param {object} session - Session object from AsyncStorage save
 * @returns {Promise<boolean>} - true if saved, false if skipped or failed
 */
export const saveSessionToFirestore = async (session) => {
  const user = auth().currentUser;

  if (!user) {
    console.log('📦 [firestoreSessionService] No user logged in — skipping Firestore save');
    return false;
  }

  console.log('🔄 [firestoreSessionService] Saving session to Firestore:', session.id);

  try {
    const sessionId = session.id || generateSessionId(session);
    const docRef = firestore()
      .collection('users')
      .doc(user.uid)
      .collection(SESSIONS_SUBCOLLECTION)
      .doc(sessionId);

    await docRef.set({
      ...sanitizeSession(session),
      migratedFromLocal: false,
      syncStatus: 'synced',
      savedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('✅ [firestoreSessionService] Session saved to Firestore:', sessionId);
    return true;

  } catch (error) {
    // Non-fatal — AsyncStorage save already succeeded
    console.log('❌ [firestoreSessionService] Firestore save failed (non-critical):', error.message);
    return false;
  }
};

/**
 * Fetch all sessions for the current user from Firestore.
 * Returns sessions sorted by timestamp descending.
 * Returns empty array if logged out or on error.
 *
 * @returns {Promise<Session[]>}
 */
export const getSessionsFromFirestore = async () => {
  const user = auth().currentUser;

  if (!user) {
    console.log('📦 [firestoreSessionService] No user — returning empty sessions');
    return [];
  }

  console.log('🔄 [firestoreSessionService] Fetching sessions from Firestore');

  try {
    const snapshot = await firestore()
      .collection('users')
      .doc(user.uid)
      .collection(SESSIONS_SUBCOLLECTION)
      .orderBy('timestamp', 'desc')
      .get();

    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ [firestoreSessionService] Fetched ${sessions.length} sessions from Firestore`);
    return sessions;

  } catch (error) {
    console.log('❌ [firestoreSessionService] Fetch failed:', error.message);
    return [];
  }
};

/**
 * Get aggregate stats for the profile screen.
 * Returns { totalSessions, totalMinutes } for the current user.
 * Returns zeros if logged out or on error.
 *
 * @returns {Promise<{ totalSessions: number, totalMinutes: number }>}
 */
export const getUserStats = async () => {
  const user = auth().currentUser;

  if (!user) {
    return { totalSessions: 0, totalMinutes: 0 };
  }

  console.log('🔄 [firestoreSessionService] Fetching user stats');

  try {
    const snapshot = await firestore()
      .collection('users')
      .doc(user.uid)
      .collection(SESSIONS_SUBCOLLECTION)
      .get();

    let totalMinutes = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (typeof data.duration === 'number') {
        totalMinutes += data.duration;
      }
    });

    const stats = {
      totalSessions: snapshot.size,
      totalMinutes,
    };

    console.log('✅ [firestoreSessionService] Stats:', stats);
    return stats;

  } catch (error) {
    console.log('❌ [firestoreSessionService] Stats fetch failed:', error.message);
    return { totalSessions: 0, totalMinutes: 0 };
  }
};

/**
 * Patch the rating + reflection onto an existing Firestore session document.
 * Called from sessionService.saveRating() after AsyncStorage is updated.
 *
 * Uses { merge: true } so it is safe to call multiple times — subsequent
 * calls overwrite with the same data rather than creating duplicates.
 *
 * @param {string} sessionId - The session doc ID (format: YYYY-MM-DD-<timestamp>)
 * @param {object} rating    - Full rating object including reflection sub-object
 * @returns {Promise<boolean>}
 */
export const updateSessionRatingInFirestore = async (sessionId, rating) => {
  const user = auth().currentUser;

  if (!user) {
    console.log('[firestoreSessionService] No user — skipping rating sync');
    return false;
  }

  try {
    await firestore()
      .collection('users')
      .doc(user.uid)
      .collection(SESSIONS_SUBCOLLECTION)
      .doc(sessionId)
      .set(
        {
          rating: sanitizeRating(rating),
          syncStatus: 'synced',
          ratingUpdatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }   // never overwrites base session fields
      );

    console.log('[firestoreSessionService] Rating synced to Firestore:', sessionId);
    return true;

  } catch (error) {
    console.log('[firestoreSessionService] Rating sync failed (non-critical):', error.message);
    return false;
  }
};

// ─── Private Helpers ─────────────────────────────────────────────────────────

const sanitizeSession = (session) => {
  const sanitized = {};

  // 'rating' (singular) is written by sessionService.saveRating after navigation.
  // 'ratings' (plural, legacy) is the pre-reflection field from handleSessionComplete.
  // Both are included so whichever is present gets synced.
  const fields = [
    'id', 'date', 'activity', 'duration', 'musicChoice',
    'notes', 'rating', 'ratings', 'timestamp', 'completedAt', 'metadata',
  ];

  fields.forEach((field) => {
    if (session[field] !== undefined && session[field] !== null) {
      sanitized[field] = session[field];
    }
  });

  return sanitized;
};

const sanitizeRating = (rating) => {
  if (!rating || typeof rating !== 'object') return null;

  const sanitized = {
    rating:      rating.rating      ?? null,
    focus:       rating.focus       ?? null,
    productivity: rating.productivity ?? null,
    ratedAt:     rating.ratedAt     ?? null,
  };

  // Reflection: four structured fields — the data the AI insight pipeline reads
  if (rating.reflection && typeof rating.reflection === 'object') {
    sanitized.reflection = {
      workedOn:    rating.reflection.workedOn    || null,
      wentWell:    rating.reflection.wentWell    || null,
      distractions: rating.reflection.distractions || null,
      nextStep:    rating.reflection.nextStep    || null,
    };
  }

  return sanitized;
};

const generateSessionId = (session) => {
  const date = session.date || new Date().toISOString().split('T')[0];
  const ts = session.timestamp || Date.now();
  return `${date}-${ts}`;
};