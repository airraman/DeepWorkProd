// src/hooks/useNotificationHandlers.js
import { useEffect, useRef } from 'react';
import messaging from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';
import * as Notifications from 'expo-notifications';
import { navigationRef } from '../services/navigationService';

export function useNotificationHandlers() {
  // Tracks the last notification response to detect cold-start taps.
  // useLastNotificationResponse is the non-deprecated replacement for
  // the no-arg getLastNotificationResponseAsync() call.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledRef = useRef(null);

  useEffect(() => {
    if (!lastResponse) return;
    // Guard: only handle each response once (the value persists across re-renders)
    const id = lastResponse.notification.request.identifier;
    if (handledRef.current === id) return;
    handledRef.current = id;

    const type = lastResponse.notification.request.content.data?.type;
    console.log('🔔 [LocalNotif] Cold-start or resumed tap, type:', type);
    // Delay to allow NavigationContainer to mount if app was killed
    setTimeout(() => handleLocalNotificationTap(type), 500);
  }, [lastResponse]);

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
          // Same delay as cold-start local notifications
          setTimeout(() => handleFCMNotificationTap(message), 500);
        }
      });

    // ── Local notification taps while app is in memory ────────────────────────
    const localTapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      console.log('🔔 [LocalNotif] Tapped (in-memory), type:', type);
      handleLocalNotificationTap(type);
    });

    return () => {
      unsubscribeForeground();
      localTapSub.remove();
    };
  }, []);

  function handleLocalNotificationTap(type) {
    switch (type) {
      case 'streak_risk':
      case 'reengagement':
        navigationRef.current?.navigate('MainApp', { screen: 'Home' });
        break;
      default:
        navigationRef.current?.navigate('MainApp', { screen: 'Home' });
    }
  }

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