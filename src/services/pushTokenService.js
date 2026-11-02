// src/services/pushTokenService.js
//
// Registers and removes this device's FCM token with the backend
// (functions/pushTokens.js). Every request carries the signed-in user's
// Firebase ID token; the backend takes the uid from it, never from the body.
//
// Both calls are best-effort: they log and resolve rather than throw, so a
// network failure can never block sign-in, sign-out or app launch.

import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

const FUNCTIONS_BASE_URL = 'https://us-central1-deepwork-8416f.cloudfunctions.net';
const REQUEST_TIMEOUT_MS = 8000;
// Shorter on sign-out: the user is waiting on it.
const SIGN_OUT_TIMEOUT_MS = 4000;

async function postAsCurrentUser(path, body, timeoutMs = REQUEST_TIMEOUT_MS) {
  const user = auth().currentUser;
  if (!user) return null;

  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Register `fcmToken` for the signed-in user. If the device was last
 * registered to a different account, the backend moves it to this one.
 * @returns {Promise<boolean>} true if the backend accepted it
 */
export async function registerPushToken(fcmToken) {
  try {
    const uid = auth().currentUser?.uid;
    const response = await postAsCurrentUser('registerToken', {
      fcmToken,
      platform: Platform.OS,
      // Only needed by backends deployed before ID-token auth; the current
      // backend rejects a userId that doesn't match the verified caller.
      userId: uid,
      // Refreshed every launch so morning and weekly pushes follow the
      // user's current timezone.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (!response) return false;
    if (!response.ok) {
      console.error('❌ [FCM] Token registration failed:', response.status, await response.text());
      return false;
    }
    console.log('✅ [FCM] Token registered successfully');
    return true;
  } catch (error) {
    console.error('❌ [FCM] Error registering token:', error.message);
    return false;
  }
}

/**
 * Remove this device's token from the signed-in account. Call BEFORE
 * auth().signOut() — the request needs the user's ID token. The backend only
 * deletes the doc if it still holds this device's token, so another device
 * on the same account, or another account, is never affected.
 * @returns {Promise<boolean>} true if the request completed
 */
export async function unregisterPushToken() {
  try {
    if (!auth().currentUser) return false;
    // getToken() can stall when notifications were never permitted; don't
    // let that hold up sign-out.
    const fcmToken = await Promise.race([
      messaging().getToken(),
      new Promise((resolve) => setTimeout(() => resolve(null), SIGN_OUT_TIMEOUT_MS)),
    ]);
    if (!fcmToken) return false;
    const response = await postAsCurrentUser('unregisterToken', { fcmToken }, SIGN_OUT_TIMEOUT_MS);
    if (!response?.ok) {
      console.warn('⚠️ [FCM] Token unregister did not complete:', response?.status);
      return false;
    }
    console.log('✅ [FCM] Token unregistered for this account');
    return true;
  } catch (error) {
    console.warn('⚠️ [FCM] Token unregister failed (non-blocking):', error.message);
    return false;
  }
}
