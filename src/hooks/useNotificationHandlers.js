// src/hooks/useNotificationHandlers.js
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { navigationRef } from '../services/navigationService';
// import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

/**
 * Hook to handle incoming notifications in different app states
 * 
 * iOS/ANDROID APP STATES (Important!):
 * 
 * 1. FOREGROUND: App is visible and active
 *    - Handler: onMessage()
 *    - You control everything (show banner, navigate, etc.)
 * 
 * 2. BACKGROUND: App is suspended but process is alive
 *    - Handler: setBackgroundMessageHandler() [set at top level]
 *    - Limited to 30 seconds of execution
 *    - Can update storage, trigger haptics
 * 
 * 3. QUIT/TERMINATED: App is completely killed
 *    - Handler: setBackgroundMessageHandler() STILL FIRES!
 *    - This is the magic - APNs wakes your app briefly
 *    - This is why FCM works when local notifications don't
 */
export function useNotificationHandlers() {
  // const navigation = useNavigation();

  useEffect(() => {
    console.log('🔔 [FCM] Setting up notification handlers...');

    // Handler 1: Foreground messages (app is open and visible)
    const unsubscribeForeground = messaging().onMessage(async (message) => {
      console.log('📱 [FCM] Foreground notification received:', message);
      
      // Trigger haptic feedback
      // await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show in-app notification (you can customize this)
      console.log(`📱 ${message.notification?.title}: ${message.notification?.body}`);
      
      // Optional: Show a banner/toast here using a library like react-native-toast-message
    });

    // Handler 2: Notification tap (user taps notification while app is in background)
    messaging().onNotificationOpenedApp((message) => {
      console.log('👆 [FCM] Notification tapped (app was background):', message);
      handleNotificationTap(message);
    });

    // Handler 3: App opened from quit state via notification tap
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
    // Navigate based on notification type
    const notificationType = message.data?.type;

    console.log('🧭 [FCM] Navigating based on type:', notificationType);

    switch (notificationType) {
      case 'session_end':
        // Session completed - go to metrics
        navigationRef.current?.navigate('Metrics');
        break;
      
      case 're_engagement':
        // Reminder to start session - go to home
        navigationRef.current?.navigate('Home');
        break;
      
      case 'insights_ready':
        // New insights available - go to metrics
        navigationRef.current?.navigate('Metrics');
        break;
      
      default:
        // Default to home screen
        navigationRef.current?.navigate('Home');
    }
  }
}