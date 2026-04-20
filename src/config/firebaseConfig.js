// src/config/firebaseConfig.js
import { firebase } from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/messaging';
import '@react-native-firebase/database';
import firestore from '@react-native-firebase/firestore';

/**
 * Firebase Configuration
 *
 * @react-native-firebase auto-initializes from GoogleService-Info.plist (iOS)
 * Never call firebase.initializeApp() — it will crash the app.
 *
 * Firestore persistence is configured here so it applies before any
 * Firestore reads/writes happen anywhere else in the app.
 */

// Enable Firestore offline persistence.
// Called once at app start. Safe to call every launch — Firebase deduplicates it.
try {
  firestore().settings({
    persistence: true,
    cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
  });
  console.log('✅ [firebaseConfig] Firestore offline persistence enabled');
} catch (error) {
  // throws if called after Firestore has already been used — safe to ignore
  console.log('⚠️ [firebaseConfig] Firestore settings already set:', error.message);
}

console.log('✅ Firebase auto-initialized from GoogleService-Info.plist');
console.log('  - Auth:', firebase.auth ? '✅' : '❌');
console.log('  - Messaging:', firebase.messaging ? '✅' : '❌');
console.log('  - Database:', firebase.database ? '✅' : '❌');
console.log('  - Firestore:', firestore ? '✅' : '❌');

export { firebase };
export default firestore;