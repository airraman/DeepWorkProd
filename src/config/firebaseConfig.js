// src/config/firebaseConfig.js
import { firebase } from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/messaging';
import '@react-native-firebase/database';

/**
 * Firebase Configuration
 * 
 * PACKAGES INSTALLED:
 * - @react-native-firebase/app (core)
 * - @react-native-firebase/auth (user accounts)
 * - @react-native-firebase/messaging (FCM push notifications)
 * - @react-native-firebase/database (Realtime Database)
 * 
 * NOT INSTALLED (to avoid gRPC build issues):
 * - @react-native-firebase/firestore
 * - @react-native-firebase/functions
 */

// Firebase config from Firebase Console
// Get this from: Firebase Console > Project Settings > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQo9Z_LJxJ5vGxKZxJ5vGxKZxJ5vGxKZxJ", // Replace with your actual key
  authDomain: "deepwork-8416f.firebaseapp.com",
  databaseURL: "https://deepwork-8416f-default-rtdb.firebaseio.com",
  projectId: "deepwork-8416f",
  storageBucket: "deepwork-8416f.appspot.com",
  messagingSenderId: "123456789012", // Replace with your actual ID
  appId: "1:123456789012:ios:abc123def456", // Replace with your actual app ID
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
  console.log('📦 Firebase packages loaded:');
  console.log('  - Auth:', firebase.auth ? '✅' : '❌');
  console.log('  - Messaging:', firebase.messaging ? '✅' : '❌');
  console.log('  - Database:', firebase.database ? '✅' : '❌');
} else {
  console.log('✅ Firebase already initialized');
}

export default firebase;