// src/services/emailConsent.js
//
// Marketing email consent for the signed-in user, stored at
// users/{uid}/preferences/email — the doc functions/email.js checks before
// sending any marketing email (and sets to "denied" on unsubscribe or a
// spam complaint).
//
// Consent is explicit: a missing doc means NO consent. Having an email
// address never counts. Account / transactional email isn't governed here.

import auth from '@react-native-firebase/auth';
import firestore from '../config/firebaseConfig';

const emailPrefsRef = (uid) => firestore()
  .collection('users')
  .doc(uid)
  .collection('preferences')
  .doc('email');

/**
 * @returns {Promise<boolean|null>} true only for explicit consent; null if
 *   there's no signed-in user or the read failed
 */
export async function getMarketingConsent() {
  const uid = auth().currentUser?.uid;
  if (!uid) return null;
  try {
    const doc = await emailPrefsRef(uid).get();
    return doc.exists && doc.data()?.marketingConsent === 'granted';
  } catch (error) {
    console.warn('⚠️ [EmailConsent] read failed:', error.message);
    return null;
  }
}

/**
 * Record the user's choice from Settings. Merge-writes only the consent
 * fields.
 * @returns {Promise<boolean>} true once saved
 */
export async function setMarketingConsent(granted) {
  const uid = auth().currentUser?.uid;
  if (!uid) return false;
  try {
    await emailPrefsRef(uid).set({
      marketingConsent: granted === true ? 'granted' : 'denied',
      consentSource: 'app_settings',
      consentUpdatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('⚠️ [EmailConsent] save failed:', error.message);
    return false;
  }
}
