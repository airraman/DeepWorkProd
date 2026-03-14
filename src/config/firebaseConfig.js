// src/config/firebaseConfig.js
import { firebase } from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/messaging';
import '@react-native-firebase/database';

/**
 * Firebase Configuration
 * 
 * @react-native-firebase initializes automatically from GoogleService-Info.plist (iOS)
 * No manual initializeApp() call needed or allowed.
 */

console.log('✅ Firebase auto-initialized from GoogleService-Info.plist');
console.log('  - Auth:', firebase.auth ? '✅' : '❌');
console.log('  - Messaging:', firebase.messaging ? '✅' : '❌');
console.log('  - Database:', firebase.database ? '✅' : '❌');

export default firebase;