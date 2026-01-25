// src/hooks/useNotificationSetup.js
import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, Linking } from 'react-native';
import deviceIdService from '../services/deviceIdService'; // ✅ ADD THIS

export function useNotificationSetup() {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [deviceId, setDeviceId] = useState(null); // ✅ ADD THIS

  useEffect(() => {
    setupNotifications();
  }, []);

  async function setupNotifications() {
    try {
      console.log('🔔 [FCM] Starting notification setup...');

      // ✅ STEP 0: Get stable device ID FIRST
      const devId = await deviceIdService.getDeviceId();
      setDeviceId(devId);
      console.log('🔔 [FCM] Using device ID:', devId.substring(0, 20) + '...');

      // Step 1: Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('🔔 [FCM] Permission denied');
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

      // Step 2: Get FCM token
      const token = await messaging().getToken();
      console.log('🔔 [FCM] Token generated:', token.substring(0, 20) + '...');
      setFcmToken(token);

      // Step 3: Send token to backend with STABLE device ID
      await sendTokenToBackend(token, devId); // ✅ PASS DEVICE ID

      // Step 4: Listen for token refresh
      const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 [FCM] Token refreshed:', newToken.substring(0, 20) + '...');
        setFcmToken(newToken);
        await sendTokenToBackend(newToken, devId); // ✅ PASS DEVICE ID
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ [FCM] Setup error:', error);
    }
  }

  async function sendTokenToBackend(token, devId) { // ✅ ADD devId PARAMETER
    try {
      const BACKEND_URL = 'https://us-central1-deepwork-8416f.cloudfunctions.net/registerToken';
      
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken: token,
          platform: Platform.OS,
          userId: devId, // ✅ USE STABLE DEVICE ID
        }),
      });

      if (response.ok) {
        console.log('✅ [FCM] Token sent to backend for device:', devId.substring(0, 15) + '...');
      } else {
        console.error('❌ [FCM] Failed to send token:', response.status);
      }
    } catch (error) {
      console.error('❌ [FCM] Error sending token to backend:', error);
    }
  }

  return { fcmToken, permissionGranted, deviceId }; // ✅ RETURN DEVICE ID
}