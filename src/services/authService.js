/**
 * authService.js
 * Firebase Auth + Firestore profile management.
 * All operations are pure async functions — no React, no hooks.
 * Consumed by AuthContext and any screen that needs auth operations.
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const USERS_COLLECTION = 'users';

// ─── Auth Operations ────────────────────────────────────────────────────────

/**
 * Sign up with email + password.
 * Creates Firebase Auth user, updates displayName, creates Firestore profile.
 * Returns the Firebase user object.
 */
export const signUp = async (email, password, displayName) => {
  console.log('🔄 [authService] signUp — creating account for:', email);

  try {
    const credential = await auth().createUserWithEmailAndPassword(email, password);
    const { user } = credential;

    console.log('✅ [authService] signUp — Firebase Auth user created:', user.uid);

    // Update displayName on the Auth user
    await user.updateProfile({ displayName: displayName.trim() });
    console.log('✅ [authService] signUp — displayName set:', displayName);

    // Create Firestore profile document
    await createUserProfile(user.uid, {
      displayName: displayName.trim(),
      email: user.email,
    });

    return auth().currentUser; // re-fetch to get updated profile
  } catch (error) {
    console.log('❌ [authService] signUp error:', error.code, error.message);
    throw normalizeAuthError(error);
  }
};

/**
 * Sign in with email + password.
 * Returns the Firebase user object.
 */
export const signIn = async (email, password) => {
  console.log('🔄 [authService] signIn —', email);

  try {
    const credential = await auth().signInWithEmailAndPassword(email, password);
    console.log('✅ [authService] signIn — success, uid:', credential.user.uid);
    return credential.user;
  } catch (error) {
    console.log('❌ [authService] signIn error:', error.code, error.message);
    throw normalizeAuthError(error);
  }
};

/**
 * Sign in anonymously (guest mode).
 * Creates an anonymous Firebase user so App.js gates open.
 * The user can upgrade to a real account later via linkWithCredential.
 */
export const signInAnonymously = async () => {
  console.log('🔄 [authService] signInAnonymously');
  try {
    const credential = await auth().signInAnonymously();
    console.log('✅ [authService] signInAnonymously — uid:', credential.user.uid);
    return credential.user;
  } catch (error) {
    console.log('❌ [authService] signInAnonymously error:', error.message);
    throw error;
  }
};

/**
 * Sign out current user.
 */
export const signOut = async () => {
  console.log('🔄 [authService] signOut');

  try {
    await auth().signOut();
    console.log('✅ [authService] signOut — success');
  } catch (error) {
    console.log('❌ [authService] signOut error:', error.message);
    throw error;
  }
};

/**
 * Subscribe to auth state changes.
 * Returns unsubscribe function — call it in useEffect cleanup.
 */
export const onAuthStateChanged = (callback) => {
  return auth().onAuthStateChanged(callback);
};

/**
 * Get current auth user synchronously.
 * Returns null if not logged in.
 */
export const getCurrentUser = () => {
  return auth().currentUser;
};

// ─── Firestore Profile Operations ───────────────────────────────────────────

/**
 * Create a new Firestore user profile document.
 * Called once during signUp.
 */
export const createUserProfile = async (userId, { displayName, email }) => {
  console.log('🔄 [authService] createUserProfile — uid:', userId);

  try {
    await firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .set({
        displayName,
        email,
        createdAt: firestore.FieldValue.serverTimestamp(),
        migrated: false,
        migratedAt: null,
      });

    console.log('✅ [authService] createUserProfile — Firestore doc created');
  } catch (error) {
    console.log('❌ [authService] createUserProfile error:', error.message);
    throw error;
  }
};

/**
 * Fetch user profile from Firestore.
 * Returns profile data object or null if not found.
 */
export const getUserProfile = async (userId) => {
  console.log('🔄 [authService] getUserProfile — uid:', userId);

  try {
    const doc = await firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .get();

    if (!doc.exists) {
      console.log('⚠️ [authService] getUserProfile — no profile found');
      return null;
    }

    console.log('✅ [authService] getUserProfile — profile loaded');
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.log('❌ [authService] getUserProfile error:', error.message);
    throw error;
  }
};

/**
 * Check if this user has already completed migration.
 * Returns boolean.
 */
export const hasMigrated = async (userId) => {
  try {
    const profile = await getUserProfile(userId);
    return profile?.migrated === true;
  } catch (error) {
    console.log('❌ [authService] hasMigrated error:', error.message);
    return false; // safe default — will retry migration
  }
};

/**
 * Mark user's migration as complete in Firestore.
 */
export const setMigrationComplete = async (userId) => {
  console.log('🔄 [authService] setMigrationComplete — uid:', userId);

  try {
    await firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .update({
        migrated: true,
        migratedAt: firestore.FieldValue.serverTimestamp(),
      });

    console.log('✅ [authService] setMigrationComplete — done');
  } catch (error) {
    console.log('❌ [authService] setMigrationComplete error:', error.message);
    throw error;
  }
};

// ─── Error Normalization ─────────────────────────────────────────────────────

/**
 * Convert Firebase auth error codes into human-readable messages.
 * Returns a new Error with a user-facing message property.
 */
const normalizeAuthError = (error) => {
  const messages = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/invalid-credential': 'Incorrect email or password.',
  };

  const userMessage = messages[error.code] || 'Something went wrong. Please try again.';
  const normalized = new Error(userMessage);
  normalized.code = error.code;
  return normalized;
};