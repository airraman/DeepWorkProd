// src/hooks/useNotificationSetup.js
import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import { Platform, Alert, Linking } from 'react-native';
import deviceIdService from '../services/deviceIdService';
import notificationPreferences from '../services/notificationPreferences';

export function useNotificationSetup() {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    if (!firebase.apps.length) {
      console.warn('⚠️ [FCM] Firebase not ready, skipping notification setup');
      return;
    }
    setupNotifications();
  }, []);

  async function setupNotifications() {
    try {
      console.log('🔔 [FCM] Starting notification setup...');

      const devId = await deviceIdService.getDeviceId();
      setDeviceId(devId);
      console.log('🔔 [FCM] Device ID:', devId.substring(0, 20) + '...');

      // Use Firebase Auth UID as the Firestore key so fcm_tokens/{uid} and
      // users/{uid}/preferences/notifications align with what Cloud Functions expect.
      // Fall back to devId only if auth is not available (should not happen after
      // anonymous auth fix, but guards against timing edge cases).
      const uid = auth().currentUser?.uid || devId;
      console.log('🔔 [FCM] Auth UID:', uid.substring(0, 20) + '...');

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('🔔 [FCM] Permission denied');
        Alert.alert(
          'Enable Notifications',
          'DeepWork needs notification permission to alert you when sessions complete.\n\nTo enable:\n1. Open Settings\n2. Find DeepWork\n3. Enable Notifications\n4. Enable Sound & Badges',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      setPermissionGranted(true);
      console.log('✅ [FCM] Permission granted');

      const token = await messaging().getToken();
      setFcmToken(token);
      console.log('🔑 [FCM] Token received:', token.substring(0, 20) + '...');

      await registerTokenWithBackend(uid, token);
      await initializePreferences(uid);

      const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 [FCM] Token refreshed');
        setFcmToken(newToken);
        await registerTokenWithBackend(uid, newToken);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ [FCM] Setup error:', error);
    }
  }

  async function registerTokenWithBackend(userId, token) {
    try {
      console.log('📤 [FCM] Registering token with backend...');
      const response = await fetch(
        'https://us-central1-deepwork-8416f.cloudfunctions.net/registerToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fcmToken: token,
            platform: Platform.OS,
            userId: userId,
          }),
        }
      );
      if (response.ok) {
        console.log('✅ [FCM] Token registered successfully');
      } else {
        const error = await response.text();
        console.error('❌ [FCM] Token registration failed:', error);
      }
    } catch (error) {
      console.error('❌ [FCM] Error registering token:', error);
    }
  }

  async function initializePreferences(userId) {
    try {
      console.log('📋 [FCM] Initializing notification preferences...');
      const existingPrefs = await notificationPreferences.getPreferences();
      if (!existingPrefs.updatedAt) {
        console.log('📋 [FCM] No existing preferences, creating defaults...');
        const success = await notificationPreferences.savePreferences({
          sessionComplete: true,
          dailyReminder: {
            enabled: true,
            time: '09:00',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          weeklySummary: true,
        });
        if (success) {
          console.log('✅ [FCM] Preferences initialized');
        } else {
          console.warn('⚠️ [FCM] Failed to initialize preferences');
        }
      } else {
        console.log('📋 [FCM] Preferences already exist, skipping');
      }
    } catch (error) {
      console.error('❌ [FCM] Error initializing preferences:', error);
    }
  }

  return { fcmToken, permissionGranted, deviceId };
}