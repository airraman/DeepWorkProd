// App.js - Production Version with iOS Notification Fix + Database + RevenueCat + Auth
import '@react-native-firebase/app'; // MUST be absolute first

import './src/config/firebaseConfig';

import messaging from '@react-native-firebase/messaging';
import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { AuthProvider } from './src/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert, View, Text, Platform, Dimensions, StatusBar, Linking, AppState, Vibration } from 'react-native';
import { navigationRef } from './src/services/navigationService';
import { versionCheckService } from './src/services/versionCheckService.js';
import { ForceUpdateModal } from './src/components/ForceUpdateModal';
import { WhatsNewModal } from './src/components/WhatsNewModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { devModalService } from './src/services/devModalService';
// PHASE 3: removed imports of notificationBackgroundTask and backgroundTimer.
// Those modules and the BackgroundFetch + FCM-completion subsystems they wrapped
// have been deleted — session completion is now owned exclusively by the OS
// notification scheduled in sessionEndNotification.js (background) and by
// DeepWorkSession.handleTimeout (foreground).
import { setupNotificationHandler } from './src/services/notificationHandler';
import ErrorBoundary from './src/components/ErrorBoundary';
import { audioSessionManager } from './src/services/audioSessionManager';
import { useNotificationSetup } from './src/hooks/useNotificationSetup';
import { useNotificationHandlers } from './src/hooks/useNotificationHandlers';
import { FocusLockProvider } from './src/context/FocusLockContext';
import FocusLockTest from './src/screens/FocusLockTest';
import LoginScreen from './src/screens/LoginScreen';
import { useAuth } from './src/context/AuthContext';
import { runMigration } from './src/services/migrationService';
import { runLocalMigrationsIfNeeded } from './src/services/localMigrationService';
import { logSessionComplete } from './src/services/analyticsService';
import { getActiveSession, clearActiveSession } from './src/services/sessionStateService';

try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('📱 [FCM Background] Notification received:', remoteMessage);
    Vibration.vibrate([0, 250, 250, 250]);
    const { title, body } = remoteMessage.notification || {};
  });
} catch (e) {
  console.warn('FCM background handler registration failed:', e);
}

// S1-1: Register notification handler at module level — must run before any
// component renders so that notifications arriving during cold launch are
// handled correctly (shouldShowAlert/shouldPlaySound respected).
// setupNotificationHandler() is also called inside MainApp's useEffect as a
// belt-and-suspenders fallback; the module-level call is the authoritative one.
setupNotificationHandler();

const DevToolsScreen = __DEV__
  ? require('./src/screens/DevToolsScreen').default
  : () => null;

// PHASE 4: removed `notificationService` import (file deleted) and the
// `alarmService` dynamic require / mock fallback. App.js no longer touches the
// alarm — the only allowed JS alarm trigger is DeepWorkSession.handleTimeout.
import DatabaseService from './src/services/database/DatabaseService';

import InitialSetupScreen from './src/screens/InitialSetUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import MetricsScreen from './src/screens/MetricsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeepWorkSession from './src/screens/DeepWorkSession';
import SessionRatingScreen from './src/features/session-completion/screens/SessionRatingScreen';
import SessionSummaryScreen from './src/features/session-completion/screens/SessionSummaryScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const { width, height } = Dimensions.get('window');
const isTablet = Platform.isPad || (width > 768 && height > 768);

console.log('📱 Device Info:', {
  platform: Platform.OS,
  version: Platform.Version,
  isTablet,
  dimensions: { width, height },
});

console.log('📦 Updates status:', {
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  updateId: Updates.updateId,
  runtimeVersion: Updates.runtimeVersion,
  channel: Updates.channel,
});

// ─── Migration Handler ────────────────────────────────────────────────────────
// Stub for now — Session 2 wires this to migrationService
const handleMigrationNeeded = async (firebaseUser) => {
  console.log('📦 [App] migration check triggered for uid:', firebaseUser.uid);
  const result = await runMigration(firebaseUser);
  console.log('📦 [App] migration result:', result);
};

// ─── Auth-Gated Navigator ─────────────────────────────────────────────────────
/**
 * Renders LoginScreen when user is null and auth has resolved.
 * Returns null during authLoading to prevent flash of LoginScreen
 * on cold start for already-logged-in users.
 */
function AppNavigator() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    // Auth is resolving persisted session — render nothing to avoid flash
    return null;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName="InitialSetup"
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        presentation: 'card',
        animationTypeForReplace: 'push',
        ...(isTablet && {
          contentStyle: { backgroundColor: 'transparent' },
          cardStyle: { backgroundColor: 'transparent' }
        })
      }}
    >
      <Stack.Screen
        name="InitialSetup"
        component={InitialSetupScreen}
        options={{ presentation: 'card', gestureEnabled: false }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ presentation: 'card', gestureEnabled: false }}
      />
      <Stack.Screen
        name="MainApp"
        component={TabNavigator}
        options={{ presentation: 'card', gestureEnabled: false }}
      />
      <Stack.Screen
        name="DeepWorkSession"
        component={DeepWorkSession}
        options={{
          presentation: 'card',
          gestureEnabled: false,
          animationTypeForReplace: 'push',
          ...(isTablet && { orientation: 'portrait' })
        }}
      />
      <Stack.Screen
        name="SessionRating"
        component={SessionRatingScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="SessionSummary"
        component={SessionSummaryScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
      {__DEV__ && (
        <Stack.Screen
          name="DevTools"
          component={DevToolsScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      )}
      {__DEV__ && (
        <Stack.Screen
          name="FocusLockTest"
          component={FocusLockTest}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      )}
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: isTablet ? 70 : 60,
          paddingBottom: isTablet ? 10 : 5,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const initializeBackgroundServices = async () => {
  try {
    console.log('🚀 Starting safe background services initialization...');

    try {
      console.log('🎵 Initializing unified audio session...');
      await audioSessionManager.initialize();
      console.log('✅ Audio session ready for all services');
    } catch (audioError) {
      console.warn('⚠️ Audio session initialization failed:', audioError);
    }

    if (Platform.OS === 'ios' && isTablet) {
      console.log('📱 iPad detected - using conservative background task setup');
    }

    let permissionsGranted = false;
    try {
      console.log('📱 Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: false,
        },
      });

      if (status === 'granted') {
        console.log('📱 Notification permissions granted');
        permissionsGranted = true;
      } else {
        console.warn('📱 Notification permissions denied');
        setTimeout(() => {
          Alert.alert(
            'Enable Notifications',
            'DeepWork needs notifications to alert you when sessions complete, even when your phone is locked.\n\nTo enable:\n1. Open Settings\n2. Find DeepWork\n3. Enable Notifications\n4. Enable Sounds',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
        }, 2000);
      }
    } catch (error) {
      console.error('📱 Permission request error:', error);
    }

    // PHASE 4: removed the alarmService init block. The alarm is owned by
    // DeepWorkSession (lazy-loaded when the session screen mounts) — App.js
    // has no business pre-warming it.

    // PHASE 3: replaces backgroundTimer.configureNotifications + the subsequent
    // notificationBackgroundTask.register block. The Android session-completion
    // channel is the only piece still required — it's the channel referenced by
    // sessionEndNotification.scheduleSessionEndNotification and is needed for
    // the OS notification to play completion_alarm.wav on Android. iOS does not
    // use channels. No BackgroundFetch task is registered anywhere.
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('session-completion', {
          name: 'Session Completion',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'completion_alarm.wav',
          vibrationPattern: [0, 250, 250, 250],
          enableLights: true,
          enableVibrate: true,
        });
        console.log('📱 Android session-completion channel ready');
      } catch (channelError) {
        console.warn('📱 Android channel creation failed (non-critical):', channelError);
      }
    }

    console.log('🚀 Background services initialization completed:', {
      permissions: permissionsGranted,
    });

    return true;
  } catch (error) {
    console.error('🚀 Background services initialization failed:', error);
    return true;
  }
};

function MainApp() {
  const [notificationSubscription, setNotificationSubscription] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isUpdateBlocking, setIsUpdateBlocking] = useState(false);
  const [updateUrl, setUpdateUrl] = useState(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showForceUpdateDebug, setShowForceUpdateDebug] = useState(false);
  const [showWhatsNewDebug, setShowWhatsNewDebug] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState({
    database: 'pending',
    backgroundServices: 'pending',
    notifications: 'pending',
    updates: 'pending'
  });

  const { fcmToken, permissionGranted } = useNotificationSetup();
  useNotificationHandlers();

  useEffect(() => {
    if (fcmToken) {
      console.log('✅ [FCM] Token available:', fcmToken.substring(0, 20) + '...');
    }
    if (permissionGranted) {
      console.log('✅ [FCM] Permission granted');
    }
  }, [fcmToken, permissionGranted]);

  useEffect(() => {
    if (__DEV__) {
      devModalService.register(setShowForceUpdateDebug, setShowWhatsNewDebug);
    }
  }, []);

  useEffect(() => {
    console.log('🚀 App.js: useEffect starting...');
    // PHASE 4: removed the duplicate setupNotificationHandler() call here. The
    // module-level call at the top of this file is the authoritative one and
    // runs before any component renders.

    const initApp = async () => {
      try {
        console.log('🚀 App initialization starting...');

        console.log('📱 Step 0: Checking app version...');
        const { forceUpdate, updateUrl: versionUpdateUrl } = await versionCheckService.performVersionCheck();
        if (forceUpdate) {
          console.log('🚫 Force update required - blocking app');
          setUpdateUrl(versionUpdateUrl);
          setIsUpdateBlocking(true);
          setIsAppReady(true);
          return;
        }
        console.log('✅ Version check passed');

        try {
          console.log('💾 Initializing database...');
          await DatabaseService.init();
          console.log('✅ Database initialized successfully');

          setInitializationStatus(prev => ({ ...prev, database: 'success' }));

          try {
            console.log('📦 Running local schema migrations...');
            await runLocalMigrationsIfNeeded();
            console.log('✅ Local migrations complete');
          } catch (migrationError) {
            // Non-fatal — migration will retry on next launch
            console.warn('⚠️ Local migration error (non-critical):', migrationError);
          }

          // PHASE 4: inlined the permission check (notificationService.js is
          // deleted). The actual permission *request* still happens later in
          // initializeBackgroundServices; this read is purely diagnostic.
          try {
            const { status } = await Notifications.getPermissionsAsync();
            if (status === 'granted') {
              console.log('✅ Notification permissions granted');
              console.log('ℹ️ Re-engagement reminders handled by Firebase Cloud Scheduler');
            } else {
              console.log('⚠️ Notification permissions not granted yet (status:', status + ')');
            }
          } catch (error) {
            console.error('❌ Error checking notification permissions:', error);
          }
        } catch (dbError) {
          console.error('❌ Database initialization failed:', dbError);
          setInitializationStatus(prev => ({ ...prev, database: 'failed' }));
          throw dbError;
        }

        try {
          console.log('🚀 Initializing background services...');
          await initializeBackgroundServices();
          console.log('✅ Background services initialized');
          setInitializationStatus(prev => ({ ...prev, backgroundServices: 'success' }));
        } catch (bgError) {
          console.error('❌ Background services initialization failed:', bgError);
          setInitializationStatus(prev => ({ ...prev, backgroundServices: 'failed' }));
        }

        try {
          if (!__DEV__) {
            console.log('🔄 Checking for updates...');
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
              console.log('📥 Update available, fetching...');
              await Updates.fetchUpdateAsync();
              Alert.alert(
                'Update Available',
                'A new version of DeepWork has been downloaded. Would you like to restart to apply it?',
                [
                  { text: 'Later', style: 'cancel' },
                  { text: 'Restart Now', onPress: () => Updates.reloadAsync() }
                ]
              );
            } else {
              console.log('✅ App is up to date');
            }
          }
          setInitializationStatus(prev => ({ ...prev, updates: 'success' }));
        } catch (updateError) {
          console.warn('⚠️ Update check failed (non-critical):', updateError);
          setInitializationStatus(prev => ({ ...prev, updates: 'skipped' }));
        }

        console.log('✅ App initialization completed successfully');

        // Check whether to show What's New modal (once per version)
        try {
          const WHATS_NEW_KEY = '@last_seen_whats_new_version';
          const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
          const lastSeen = await AsyncStorage.getItem(WHATS_NEW_KEY);
          if (lastSeen !== currentVersion) {
            setShowWhatsNew(true);
          }
        } catch (whatsNewErr) {
          console.warn('⚠️ What\'s New version check failed (non-critical):', whatsNewErr);
        }

        setIsAppReady(true);
      } catch (error) {
        console.error('❌ Critical app initialization error:', error);
        Alert.alert(
          'Initialization Error',
          'There was a problem starting DeepWork. Please try restarting the app.',
          [{ text: 'OK' }]
        );
        setIsAppReady(true);
      }
    };

    initApp();

    // PHASE 4: this is the SOLE expo-notifications response listener in the
    // entire app. App.js owns notification tap handling — no alarm logic, no
    // duplicate listeners, no cold-launch alarm replay. The OS already played
    // the sound for any session_end notification by the time it can be tapped;
    // re-engagement notification taps are routed by useNotificationHandlers
    // via the FCM messaging() handlers (a separate transport).
    const setupNotifications = async () => {
      try {
        console.log('🔔 Setting up notification listeners...');

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(
          async (response) => {
            try {
              const data = response.notification.request.content.data;
              const type = data?.type;
        
              console.log('📱 [App] Local notification tapped, type:', type);
        
              if (type === 'session_end') {
                const session = await getActiveSession();
        
                if (!session) {
                  console.log('⚠️ No active session found — skipping analytics');
                  return;
                }
        
                const { config, endTime, status } = session;
        
                if (!config?.duration || !endTime) {
                  console.log('⚠️ Invalid session shape:', session);
                  return;
                }
        
                // ✅ Strongest, simplest check (you already computed this)
                if (status !== 'expired') {
                  console.log('⚠️ Session not expired yet — skipping');
                  return;
                }
        
                console.log('📊 Logging BACKGROUND session completion');
        
                await logSessionComplete(config.duration, 'background');
        
                await clearActiveSession();
              }
        
            } catch (error) {
              console.error('🚀 Notification response error:', error);
            }
          }
        );

        setNotificationSubscription(responseSubscription);
        console.log('✅ Notification listener configured successfully');
        setInitializationStatus(prev => ({ ...prev, notifications: 'success' }));
      } catch (error) {
        console.error('🚀 Notification setup error:', error);
        setInitializationStatus(prev => ({ ...prev, notifications: 'failed' }));
      }
    };

    setTimeout(setupNotifications, isTablet ? 4000 : 2000);

    // PHASE 2: removed checkMissedCompletion(). Its only remaining job after
    // Phase 1 was to delete the stale @session_end_time key; Phase 2 retires
    // that key entirely (HomeScreen orphan detection now reads endTime from
    // @active_session_config via sessionStateService.getActiveSession()).

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // iOS deactivates AVAudioSession when app is backgrounded — reset the cache
        // so the next audio call re-initializes the session rather than using stale state.
        audioSessionManager.reset();
        // Clear the notification badge now that the user has opened the app.
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
    });

    return () => {
      appStateSubscription.remove();
      console.log('🚀 App.js: Cleaning up...');
      // PHASE 4: notificationSubscription is now a single subscription object,
      // not an array (only one listener is registered).
      if (notificationSubscription && typeof notificationSubscription.remove === 'function') {
        try {
          notificationSubscription.remove();
          console.log('✅ Notification subscription removed');
        } catch (error) {
          console.error('🚀 Error removing notification subscription:', error);
        }
      }
    };
  }, []);

  // PHASE 3: removed handlePauseResumeAction and handleEndSession. Both wrapped
  // backgroundTimer.* methods that no longer exist; both were only invoked by
  // notification action-button taps from the deleted sticky timer notification.

  const handleWhatsNewComplete = async () => {
    try {
      const WHATS_NEW_KEY = '@last_seen_whats_new_version';
      const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
      await AsyncStorage.setItem(WHATS_NEW_KEY, currentVersion);
    } catch (err) {
      console.warn('⚠️ Failed to persist What\'s New version:', err);
    }
    setShowWhatsNew(false);
    if (__DEV__) devModalService.dismissWhatsNew();
  };

  if (isUpdateBlocking || showForceUpdateDebug) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
        <ForceUpdateModal
          visible
          updateUrl={isUpdateBlocking ? updateUrl : 'https://apps.apple.com'}
        />
      </View>
    );
  }

  if (!isAppReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Loading DeepWork.io...
        </Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
          {isTablet ? 'Optimizing for iPad...' : 'Preparing your workspace...'}
        </Text>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 10 }}>
          {initializationStatus.database === 'pending' && 'Initializing database...'}
          {initializationStatus.database === 'success' && '✅ Database ready'}
          {initializationStatus.database === 'failed' && '⚠️ Database error'}
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SubscriptionProvider>
        <FocusLockProvider>
          <ThemeProvider>
            {/* ✅ AuthProvider wraps NavigationContainer so useAuth() works in all screens */}
            <AuthProvider onMigrationNeeded={handleMigrationNeeded}>
              <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent={false}
              />
              <NavigationContainer ref={navigationRef}>
                <AppNavigator />
              </NavigationContainer>
              <WhatsNewModal
                visible={showWhatsNew || showWhatsNewDebug}
                onComplete={handleWhatsNewComplete}
              />
            </AuthProvider>
          </ThemeProvider>
        </FocusLockProvider>
      </SubscriptionProvider>
    </ErrorBoundary>
  );
}

const SafeApp = () => {
  try {
    return <MainApp />;
  } catch (error) {
    console.error('🚀 Critical app error:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8f9fa' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#dc3545' }}>
          App Error
        </Text>
        <Text style={{ textAlign: 'center', marginBottom: 20, fontSize: 16 }}>
          Something went wrong during startup
        </Text>
        <Text style={{ fontSize: 12, color: '#6c757d', textAlign: 'center' }}>
          Device: {Platform.OS} {Platform.Version}
        </Text>
        <Text style={{ fontSize: 12, color: '#6c757d', textAlign: 'center' }}>
          Error: {error.message || 'Unknown error'}
        </Text>
      </View>
    );
  }
};

export default SafeApp;