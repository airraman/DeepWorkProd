// functions/pushTokens.js - Authenticated FCM token registration and
// removal, used by the registerToken and unregisterToken HTTP endpoints.
//
// fcm_tokens/{uid} holds one token per Firebase Auth user. The uid always
// comes from a verified Firebase ID token, never from the request body, so
// a caller can only register or remove a token for their own account.
//
// `admin` is passed in (rather than required) so these handlers can be unit
// tested against a fake — see __tests__/pushTokens.test.js.

const {isValidTimeZone} = require("./morningActivation");

/**
 * Verify the `Authorization: Bearer <Firebase ID token>` header.
 * @param {object} admin firebase-admin
 * @param {string|undefined} authorization header value
 * @return {Promise<string|null>} the caller's uid, or null
 */
async function verifyCaller(admin, authorization) {
  const match = /^Bearer (.+)$/.exec(authorization || "");
  if (!match) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid || null;
  } catch (error) {
    return null;
  }
}

/**
 * Register `fcmToken` for the authenticated caller. A device's token moves
 * with whoever signed in last: any other account's doc holding this same
 * token is deleted, so the previous account's pushes stop reaching it.
 *
 * @param {object} admin firebase-admin
 * @param {object} request {authorization: header value, body: JSON body}
 * @return {Promise<{status: number, body: object}>}
 */
async function registerPushToken(admin, {authorization, body}) {
  const uid = await verifyCaller(admin, authorization);
  if (!uid) return {status: 401, body: {error: "Unauthenticated"}};

  const {fcmToken, platform, userId, timezone} = body || {};
  if (!fcmToken || typeof fcmToken !== "string") {
    return {status: 400, body: {error: "Missing required field: fcmToken"}};
  }
  // Older clients also send userId; it must match the verified caller.
  if (userId && userId !== uid) {
    return {status: 403, body: {error: "userId does not match the caller"}};
  }

  const tokens = admin.firestore().collection("fcm_tokens");

  const sameToken = await tokens.where("token", "==", fcmToken).get();
  const stale = sameToken.docs.filter((doc) => doc.id !== uid);
  await Promise.all(stale.map((doc) => tokens.doc(doc.id).delete()));

  // timezone is optional (older app versions don't send it) and only stored
  // when Intl recognizes it — the batches never send without a timezone.
  await tokens.doc(uid).set({
    token: fcmToken,
    platform: platform || null,
    ...(isValidTimeZone(timezone) ? {timezone} : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return {
    status: 200,
    body: {success: true, reassignedFrom: stale.length},
  };
}

/**
 * Remove the caller's token on sign-out, only if it is still this device's
 * token. If the account has since registered a different device, or another
 * account has taken over this token, nothing is deleted.
 *
 * @param {object} admin firebase-admin
 * @param {object} request {authorization: header value, body: JSON body}
 * @return {Promise<{status: number, body: object}>}
 */
async function unregisterPushToken(admin, {authorization, body}) {
  const uid = await verifyCaller(admin, authorization);
  if (!uid) return {status: 401, body: {error: "Unauthenticated"}};

  const {fcmToken} = body || {};
  if (!fcmToken || typeof fcmToken !== "string") {
    return {status: 400, body: {error: "Missing required field: fcmToken"}};
  }

  const ref = admin.firestore().collection("fcm_tokens").doc(uid);
  // Check and delete atomically, so a registration that lands in between
  // (e.g. this device signing straight back in) is never removed.
  const removed = await admin.firestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data().token !== fcmToken) return false;
    tx.delete(ref);
    return true;
  });
  return {status: 200, body: {success: true, removed}};
}

module.exports = {
  registerPushToken,
  unregisterPushToken,
};
