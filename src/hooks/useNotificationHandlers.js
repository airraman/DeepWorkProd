// src/hooks/useNotificationHandlers.js
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { firebase } from '@react-native-firebase/app';
import { navigationRef } from '../services/navigationService';
import { Vibration } from 'react-native';

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

    messaging().onNotificationOpenedApp((message) => {
      console.log('👆 [FCM] Notification tapped (app was background):', message);
      handleNotificationTap(message);
    });

    messaging()
      .getInitialNotification()
      .then((message) => {
        if (message) {
          console.log('🚀 [FCM] App opened from quit state via notification:', message);
          handleNotificationTap(message);
        }
      });

    return () => {
      unsubscribeForeground();
    };
  }, []);

  function handleNotificationTap(message) {
    const notificationType = message.data?.type;
    console.log('🧭 [FCM] Navigating based on type:', notificationType);

    switch (notificationType) {
      case 'session_end':
        navigationRef.current?.navigate('Metrics');
        break;
      case 're_engagement':
        navigationRef.current?.navigate('Home');
        break;
      case 'insights_ready':
        navigationRef.current?.navigate('Metrics');
        break;
      default:
        navigationRef.current?.navigate('Home');
    }
  }
}