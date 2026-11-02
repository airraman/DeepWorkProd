// src/hooks/useNotificationSetup.js
import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import { Platform, Alert, Linking } from 'react-native';
import deviceIdService from '../services/deviceIdService';
import notificationPreferences from '../services/notificationPreferences';
import { registerPushToken } from '../services/pushTokenService';

export function useNotificationSetup() {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    if (!firebase.apps.length) {
      console.warn('⚠️ [FCM] Firebase not ready, skipping notification setup');
      return;
    }
    let cleanup = null;
    let unmounted = false;
    setupNotifications().then((unsubscribe) => {
      if (unmounted) unsubscribe?.();
      else cleanup = unsubscribe;
    });
    return () => {
      unmounted = true;
      cleanup?.();
    };
  }, []);

  async function setupNotifications() {
    try {
      console.log('🔔 [FCM] Starting notification setup...');

      const devId = await deviceIdService.getDeviceId();
      setDeviceId(devId);
      console.log('🔔 [FCM] Device ID:', devId.substring(0, 20) + '...');

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('🔔 [FCM] Permission denied');
        Alert.alert(
          'Enable Notifications',
          'Lucid needs notification permission to alert you when sessions complete.\n\nTo enable:\n1. Open Settings\n2. Find Lucid\n3. Enable Notifications\n4. Enable Sound & Badges',
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

      // Register only under a real Firebase Auth UID — fcm_tokens/{uid} and
      // users/{uid}/preferences/notifications must match what Cloud Functions
      // read. This hook mounts before sign-in may have finished (or happened
      // at all), so wait for auth instead of falling back to the device id,
      // and re-register whenever a different user signs in.
      let currentToken = token;
      let registeredUid = null;
      const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
        // Sign-out removes this device's token (authService.signOut), so the
        // next sign-in — even by the same user — must register it again.
        if (!user) {
          registeredUid = null;
          return;
        }
        if (user.uid === registeredUid) return;
        registeredUid = user.uid;
        console.log('🔔 [FCM] Auth UID:', user.uid.substring(0, 20) + '...');
        await registerTokenWithBackend(currentToken);
        await initializePreferences(user.uid);
      });

      const unsubscribeRefresh = messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 [FCM] Token refreshed');
        currentToken = newToken;
        setFcmToken(newToken);
        if (auth().currentUser) await registerTokenWithBackend(newToken);
      });

      return () => {
        unsubscribeAuth();
        unsubscribeRefresh();
      };
    } catch (error) {
      console.error('❌ [FCM] Setup error:', error);
    }
  }

  async function registerTokenWithBackend(token) {
    console.log('📤 [FCM] Registering token with backend...');
    // Sends the user's Firebase ID token; see services/pushTokenService.js.
    await registerPushToken(token);
  }

  async function initializePreferences(userId) {
    try {
      console.log('📋 [FCM] Initializing notification preferences...');
      // getPreferences() returns defaults (which carry updatedAt) when no doc
      // exists, so checking its updatedAt never detected a missing doc and
      // defaults were never written. Check Firestore directly; on a failed
      // check (null) do nothing rather than risk overwriting saved choices.
      const hasRemote = await notificationPreferences.hasRemotePreferences();
      if (hasRemote === false) {
        console.log('📋 [FCM] No existing preferences, creating defaults...');
        // Written only when no doc exists (never over saved choices).
        // Defaults: every category on (opt-out in Settings).
        const success = await notificationPreferences.savePreferences({
          sessionComplete: true,
          reengagement: true,
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
      } else if (hasRemote) {
        console.log('📋 [FCM] Preferences already exist, skipping');
      } else {
        console.log('📋 [FCM] Could not check preferences, will retry next launch');
      }
    } catch (error) {
      console.error('❌ [FCM] Error initializing preferences:', error);
    }
  }

  return { fcmToken, permissionGranted, deviceId };
}