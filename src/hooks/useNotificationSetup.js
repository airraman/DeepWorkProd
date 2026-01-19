// src/hooks/useNotificationSetup.js
import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, Linking } from 'react-native';

/**
 * Hook to handle FCM token generation and registration
 * 
 * WHAT THIS DOES:
 * 1. Requests notification permission from iOS
 * 2. Generates FCM token (unique device identifier)
 * 3. Sends token to backend for storage
 * 4. Listens for token refresh (when iOS rotates it)
 * 
 * WHY WE NEED THIS:
 * - FCM tokens are how Firebase knows which device to send notifications to
 * - Tokens can change, so we must listen for refreshes
 * - Without this, your backend has no way to reach this device
 */
export function useNotificationSetup() {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    setupNotifications();
  }, []);

  async function setupNotifications() {
    try {
      console.log('🔔 [FCM] Starting notification setup...');

      // Step 1: Request permission (iOS requires explicit user permission)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('🔔 [FCM] Permission denied');
        
        // Show user how to enable in Settings
        Alert.alert(
          'Enable Notifications',
          'DeepWork needs notification permission to alert you when sessions complete.\n\nTo enable:\n1. Open Settings\n2. Find DeepWork\n3. Enable Notifications',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openURL('app-settings:')
            }
          ]
        );
        return;
      }

      console.log('✅ [FCM] Permission granted');
      setPermissionGranted(true);

      // Step 2: Get FCM token (this is the device-specific identifier)
      const token = await messaging().getToken();
      console.log('🔔 [FCM] Token generated:', token.substring(0, 20) + '...');
      setFcmToken(token);

      // Step 3: Send token to your backend
      await sendTokenToBackend(token);

      // Step 4: Listen for token refresh (critical for reliability!)
      const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 [FCM] Token refreshed:', newToken.substring(0, 20) + '...');
        setFcmToken(newToken);
        await sendTokenToBackend(newToken);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ [FCM] Setup error:', error);
    }
  }

  async function sendTokenToBackend(token) {
    try {
      // TODO: Replace with your Firebase Cloud Function URL after deploying
      // For now, this will fail gracefully
      const BACKEND_URL = 'https://us-central1-deepwork-8416f.cloudfunctions.net/registerToken';
      
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken: token,
          platform: Platform.OS,
          // For now, use a placeholder user ID
          // Later we'll replace this with Firebase Auth UID
          userId: 'temp_user_' + Math.random().toString(36).substring(7),
        }),
      });

      if (response.ok) {
        console.log('✅ [FCM] Token sent to backend');
      } else {
        console.error('❌ [FCM] Failed to send token:', response.status);
      }
    } catch (error) {
      console.error('❌ [FCM] Error sending token to backend:', error);
      // Non-critical - we'll retry on next app launch
    }
  }

  return { fcmToken, permissionGranted };
}