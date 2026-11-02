/**
 * authService.js
 * Firebase Auth + Firestore profile management.
 * All operations are pure async functions — no React, no hooks.
 * Consumed by AuthContext and any screen that needs auth operations.
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { unregisterPushToken } from './pushTokenService';

const USERS_COLLECTION = 'users';

// GoogleSignin reads iosClientId from GoogleService-Info.plist automatically
// when it's omitted here — no iOS client ID needs to live in JS. webClientId
// is still required (it's the audience Firebase's GoogleAuthProvider expects
// on the idToken) and can only come from Firebase Console once the Google
// sign-in provider is enabled there. GOOGLE_WEB_CLIENT_ID is intentionally
// not a real-looking value so a misconfigured build fails loudly instead of
// silently — see the Google Sign-In setup steps in the PR/task notes.
const GOOGLE_WEB_CLIENT_ID = '545504050117-4tc9rtvpe8ne8nmjijmth3e5u12kliej.apps.googleusercontent.com';

export const configureGoogleSignIn = () => {
  if (GOOGLE_WEB_CLIENT_ID.startsWith('REPLACE_WITH_')) {
    console.warn(
      '⚠️ [authService] Google Sign-In not configured — GOOGLE_WEB_CLIENT_ID is a placeholder. ' +
      'Enable Google as a sign-in provider in Firebase Console, then set GOOGLE_WEB_CLIENT_ID.'
    );
    return;
  }
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
};

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
 * Sign up / sign in with Google.
 * Firebase treats this as a single flow — a first-time Google user gets a
 * new Firebase Auth account and Firestore profile (mirroring signUp above);
 * a returning one just signs in. Returns the Firebase user object.
 */
export const signInWithGoogle = async () => {
  console.log('🔄 [authService] signInWithGoogle');

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    const { data } = await GoogleSignin.signIn();
    const idToken = data?.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In did not return an idToken.');
    }

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const credential = await auth().signInWithCredential(googleCredential);
    const { user, additionalUserInfo } = credential;

    console.log('✅ [authService] signInWithGoogle — success, uid:', user.uid);

    if (additionalUserInfo?.isNewUser) {
      await createUserProfile(user.uid, {
        displayName: user.displayName || '',
        email: user.email,
      });
      console.log('✅ [authService] signInWithGoogle — Firestore profile created for new user');
    }

    return user;
  } catch (error) {
    console.log('❌ [authService] signInWithGoogle error:', error.code || error.message);
    if (error.code === 'SIGN_IN_CANCELLED' || error.code === '-5') {
      const cancelled = new Error('Sign-in cancelled.');
      cancelled.code = 'CANCELLED';
      throw cancelled;
    }
    throw normalizeAuthError(error);
  }
};

/**
 * True on iOS devices that support Sign in with Apple (iOS 13+).
 */
export const isAppleSignInAvailable = async () => {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

/**
 * Prompt the native Apple sheet and build a Firebase credential from it.
 * Apple receives the SHA-256 of a random nonce; Firebase receives the raw
 * nonce and verifies it against the identity token, which prevents replay.
 */
const requestAppleCredential = async () => {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!appleCredential.identityToken) {
    throw new Error('Sign in with Apple did not return an identity token.');
  }

  return {
    appleCredential,
    firebaseCredential: auth.AppleAuthProvider.credential(appleCredential.identityToken, rawNonce),
  };
};

const isAppleCancel = (error) => error?.code === 'ERR_REQUEST_CANCELED';

/**
 * Sign up / sign in with Apple. Like Google, a first-time Apple user gets a
 * Firebase Auth account and Firestore profile; a returning one just signs in.
 * Apple only shares the user's name on the very first authorization, so it
 * is saved then or not at all.
 */
export const signInWithApple = async () => {
  console.log('🔄 [authService] signInWithApple');

  try {
    const { appleCredential, firebaseCredential } = await requestAppleCredential();
    const credential = await auth().signInWithCredential(firebaseCredential);
    const { user, additionalUserInfo } = credential;

    console.log('✅ [authService] signInWithApple — success, uid:', user.uid);

    if (additionalUserInfo?.isNewUser) {
      const fullName = [appleCredential.fullName?.givenName, appleCredential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      if (fullName && !user.displayName) {
        await user.updateProfile({ displayName: fullName });
      }
      await createUserProfile(user.uid, {
        displayName: fullName || user.displayName || '',
        email: user.email || appleCredential.email || null,
      });
      console.log('✅ [authService] signInWithApple — Firestore profile created for new user');
    }

    return auth().currentUser;
  } catch (error) {
    console.log('❌ [authService] signInWithApple error:', error.code || error.message);
    if (isAppleCancel(error)) {
      const cancelled = new Error('Sign-in cancelled.');
      cancelled.code = 'CANCELLED';
      throw cancelled;
    }
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

  // Stop this account's pushes reaching this device. Must run while still
  // signed in (it sends the ID token); never throws, so sign-out proceeds.
  await unregisterPushToken();

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

// ─── Account Deletion ────────────────────────────────────────────────────────

/**
 * Best-effort delete of everything this app knows the user owns in
 * Firestore: the sessions / activeSession / preferences subcollections
 * under users/{uid}, then the users/{uid} profile doc itself. Each
 * subcollection is cleared independently so a failure on one (e.g. rules
 * denying a particular subcollection) doesn't stop the others from being
 * attempted — mirrors the per-item isolation used elsewhere (see
 * sessionRestoreService.js).
 */
const deleteUserFirestoreData = async (userId) => {
  const userDocRef = firestore().collection(USERS_COLLECTION).doc(userId);
  const subcollections = ['sessions', 'activeSession', 'preferences'];

  for (const sub of subcollections) {
    try {
      const snapshot = await userDocRef.collection(sub).get();
      if (!snapshot.empty) {
        const batch = firestore().batch();
        snapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (error) {
      console.log(`❌ [authService] deleteUserFirestoreData — failed clearing '${sub}':`, error.message);
    }
  }

  await userDocRef.delete();
};

/**
 * Re-authenticate the current user against whichever provider they signed
 * in with. Required by Firebase before a sensitive operation (account
 * deletion) if the existing sign-in is no longer "recent" enough.
 * `password` is only used for password-provider accounts; omit it for
 * Google accounts, where re-auth re-prompts the native Google sign-in flow.
 */
const reauthenticate = async (user, password) => {
  const providerId = user.providerData?.[0]?.providerId;

  if (providerId === 'google.com') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    const { data } = await GoogleSignin.signIn();
    const idToken = data?.idToken;
    if (!idToken) {
      throw new Error('Google re-authentication did not return an idToken.');
    }
    await user.reauthenticateWithCredential(auth.GoogleAuthProvider.credential(idToken));
    return;
  }

  if (providerId === 'apple.com') {
    const { firebaseCredential } = await requestAppleCredential();
    await user.reauthenticateWithCredential(firebaseCredential);
    return;
  }

  if (providerId === 'password') {
    if (!password) {
      const needsPassword = new Error('Please re-enter your password to confirm account deletion.');
      needsPassword.code = 'REQUIRES_PASSWORD';
      throw needsPassword;
    }
    await user.reauthenticateWithCredential(auth.EmailAuthProvider.credential(user.email, password));
    return;
  }

  throw new Error('Re-authentication is required but this sign-in method is not supported for account deletion.');
};

/**
 * Permanently delete the signed-in user's account: their known Firestore
 * data, then the Firebase Auth account itself. Firebase signs the user out
 * automatically once the Auth account is deleted, which the existing
 * onAuthStateChanged listener (AuthContext) picks up on its own — no
 * separate signOut() call is needed here.
 *
 * If Firebase requires a recent login, this re-authenticates (prompting a
 * fresh Google sign-in, or throwing REQUIRES_PASSWORD for the caller to
 * collect a password and retry with it) and then retries the deletion once.
 */
export const deleteAccount = async (password) => {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('No signed-in user to delete.');
  }

  console.log('🔄 [authService] deleteAccount — uid:', user.uid);

  // Apple requires apps to revoke the user's Sign in with Apple tokens when
  // the account is deleted. That needs a fresh authorization code, so prompt
  // first: cancelling here leaves the account and its data untouched.
  const isAppleUser = user.providerData?.some((p) => p.providerId === 'apple.com');
  let appleAuthorizationCode = null;
  if (isAppleUser) {
    try {
      const { appleCredential, firebaseCredential } = await requestAppleCredential();
      await user.reauthenticateWithCredential(firebaseCredential);
      appleAuthorizationCode = appleCredential.authorizationCode;
    } catch (error) {
      if (isAppleCancel(error)) {
        const cancelled = new Error('Account deletion cancelled.');
        cancelled.code = 'CANCELLED';
        throw cancelled;
      }
      throw normalizeAuthError(error);
    }
  }

  try {
    await deleteUserFirestoreData(user.uid);
  } catch (error) {
    console.log('❌ [authService] deleteAccount — Firestore cleanup error (continuing to Auth deletion):', error.message);
  }

  if (appleAuthorizationCode) {
    try {
      await auth().revokeToken(appleAuthorizationCode);
    } catch (error) {
      console.log('❌ [authService] deleteAccount — Apple token revocation failed (continuing):', error.code || error.message);
    }
  }

  try {
    await user.delete();
  } catch (error) {
    if (error.code === 'auth/requires-recent-login') {
      await reauthenticate(user, password);
      await user.delete();
    } else {
      console.log('❌ [authService] deleteAccount error:', error.code, error.message);
      throw normalizeAuthError(error);
    }
  }

  console.log('✅ [authService] deleteAccount — Firebase Auth account deleted');
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
    'auth/account-exists-with-different-credential': 'An account with this email already exists. Sign in the way you did before.',
    'auth/operation-not-allowed': 'This sign-in method isn\'t available right now.',
  };

  const userMessage = messages[error.code] || 'Something went wrong. Please try again.';
  const normalized = new Error(userMessage);
  normalized.code = error.code;
  return normalized;
};