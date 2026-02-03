// src/hooks/useNotificationSetup.js - ENHANCED for Sprint 2
/**
 * Notification Setup Hook
 * 
 * RESPONSIBILITIES:
 * - Request notification permissions
 * - Register FCM token with Cloud Functions
 * - Initialize notification preferences in Firestore
 * - Handle token refresh
 * 
 * CALLED FROM: App.js on launch
 */

import { useEffect, useState } from 'react';
import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, Linking } from 'react-native';
import deviceIdService from '../services/deviceIdService';
import notificationPreferences from '../services/notificationPreferences';

export function useNotificationSetup() {
  const [fcmToken, setFcmToken] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    setupNotifications();
  }, []);

  async function setupNotifications() {
    try {
      console.log('🔔 [FCM] Starting notification setup...');

      // STEP 1: Get stable device ID
      const devId = await deviceIdService.getDeviceId();
      setDeviceId(devId);
      console.log('🔔 [FCM] Device ID:', devId.substring(0, 20) + '...');

      // STEP 2: Request permission
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

      // STEP 3: Get FCM token
      const token = await messaging().getToken();
      setFcmToken(token);
      console.log('🔑 [FCM] Token received:', token.substring(0, 20) + '...');

      // STEP 4: Register token with Cloud Functions
      await registerTokenWithBackend(devId, token);

      // ✅ NEW STEP 5: Initialize notification preferences in Firestore
      await initializePreferences(devId);

      // STEP 6: Listen for token refresh
      const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
        console.log('🔄 [FCM] Token refreshed');
        setFcmToken(newToken);
        await registerTokenWithBackend(devId, newToken);
      });

      return unsubscribe;
    } catch (error) {
      console.error('❌ [FCM] Setup error:', error);
    }
  }

  /**
   * Register FCM token with Cloud Functions
   * 
   * WHY CLOUD FUNCTIONS:
   * - Stores token in Firestore
   * - Allows sending notifications from server
   * - Handles token updates automatically
   */
  async function registerTokenWithBackend(userId, token) {
    try {
      console.log('📤 [FCM] Registering token with backend...');

      const response = await fetch(
        'https://us-central1-deepwork-8416f.cloudfunctions.net/registerToken',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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

  /**
   * ✅ NEW: Initialize notification preferences in Firestore
   * 
   * WHY THIS MATTERS:
   * - Sets up default preferences for new users
   * - Ensures Cloud Functions can read user preferences
   * - Detects and stores user's timezone
   * 
   * CALLED ONCE: On first app launch after FCM setup
   */
  async function initializePreferences(userId) {
    try {
      console.log('📋 [FCM] Initializing notification preferences...');

      // Check if preferences already exist
      const existingPrefs = await notificationPreferences.getPreferences();
      
      // If preferences don't have updatedAt, they're defaults (not saved yet)
      if (!existingPrefs.updatedAt) {
        console.log('📋 [FCM] No existing preferences, creating defaults...');
        
        // Save default preferences to Firestore
        const success = await notificationPreferences.savePreferences({
          sessionComplete: true,
          dailyReminder: {
            enabled: true, // ✅ Auto opt-in per requirements
            time: '09:00',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          weeklySummary: true,
        });
        
        if (success) {
          console.log('✅ [FCM] Preferences initialized in Firestore');
        } else {
          console.warn('⚠️ [FCM] Failed to initialize preferences');
        }
      } else {
        console.log('📋 [FCM] Preferences already exist, skipping initialization');
      }
    } catch (error) {
      console.error('❌ [FCM] Error initializing preferences:', error);
    }
  }

  return {
    fcmToken,
    permissionGranted,
    deviceId,
  };
}