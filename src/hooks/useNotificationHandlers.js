// src/hooks/useNotificationHandlers.js
//
// PHASE 4: this hook handles ONLY Firebase Cloud Messaging (re-engagement).
// The expo-notifications response listener (and useLastNotificationResponse
// cold-start polling) have been removed — App.js owns the single
// addNotificationResponseReceivedListener registration. Local notification
// taps no longer need explicit routing because the app's default launch
// sequence lands on Home, which is the right destination for every local
// notif type (session_end, streak_risk, reengagement).

import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';
import { navigationRef } from '../services/navigationService';

export function useNotificationHandlers() {
  useEffect(() => {
    if (!firebase.apps.length) {
      console.warn('⚠️ [FCM] Firebase not ready, skipping notification handlers');
      return;
    }

    console.log('🔔 [FCM] Setting up notification handlers...');

    const unsubscribeForeground = messaging().onMessage(async (message) => {
      console.log('📱 [FCM] Foreground notification received:', message);
      console.log(`📱 ${message.notification?.title}: ${message.notification?.body}`);
    });

    // ── FCM: app was backgrounded when notification arrived ──────────────────
    messaging().onNotificationOpenedApp((message) => {
      console.log('👆 [FCM] Notification tapped (app was background):', message);
      handleFCMNotificationTap(message);
    });

    // ── FCM: app was killed when notification arrived ─────────────────────────
    messaging()
      .getInitialNotification()
      .then((message) => {
        if (message) {
          console.log('🚀 [FCM] App opened from quit state via notification:', message);
          // Delay to allow NavigationContainer to mount if app was killed
          setTimeout(() => handleFCMNotificationTap(message), 500);
        }
      });

    return () => {
      unsubscribeForeground();
    };
  }, []);

  // FCM notifications use nested navigator paths — bare screen names
  // only work at the root stack level, not inside the MainApp tab navigator.
  function handleFCMNotificationTap(message) {
    const notificationType = message.data?.type;
    console.log('🧭 [FCM] Navigating based on type:', notificationType);

    switch (notificationType) {
      case 'session_end':
      case 'insights_ready':
        navigationRef.current?.navigate('MainApp', { screen: 'Metrics' });
        break;
      case 're_engagement':
      default:
        navigationRef.current?.navigate('MainApp', { screen: 'Home' });
        break;
    }
  }
}
