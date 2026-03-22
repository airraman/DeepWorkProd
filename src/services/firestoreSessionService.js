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

// ─── Private Helpers ─────────────────────────────────────────────────────────

const sanitizeSession = (session) => {
  const sanitized = {};

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

const generateSessionId = (session) => {
  const date = session.date || new Date().toISOString().split('T')[0];
  const ts = session.timestamp || Date.now();
  return `${date}-${ts}`;
};