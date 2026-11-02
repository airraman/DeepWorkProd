// src/services/chromeConnectionService.js
//
// Reads the two existing Firestore signals described in chromeConnection.js.
// Read-only: never writes, so the extension's own auth and sync are untouched.

import firestore from '../config/firebaseConfig';

/**
 * @param {string} uid
 * @returns {Promise<{platformsChrome: boolean|null, extensionSession: boolean|null}>}
 *   null = that read failed
 */
export async function getChromeConnectionSignals(uid) {
  const userRef = firestore().collection('users').doc(uid);

  const [platformsChrome, extensionSession] = await Promise.all([
    userRef.get()
      .then((doc) => doc.exists && doc.data()?.platforms?.chrome === true)
      .catch(() => null),
    userRef.collection('sessions')
      .where('source', '==', 'extension')
      .limit(1)
      .get()
      .then((snap) => !snap.empty)
      .catch(() => null),
  ]);

  return { platformsChrome, extensionSession };
}
