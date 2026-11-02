// App.js - Production Version with iOS Notification Fix + Database + RevenueCat + Auth
import '@react-native-firebase/app'; // MUST be absolute first
import 'react-native-gesture-handler'; // Required side-effect import for react-native-gesture-handler

import './src/config/firebaseConfig';

import messaging from '@react-native-firebase/messaging';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import { SubscriptionProvider, useSubscription } from './src/context/SubscriptionContext';
import { AuthProvider } from './src/context/AuthContext';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert, View, Text, Platform, Dimensions, StatusBar, Linking, AppState, Vibration } from 'react-native';
import { navigationRef, safeNavigate } from './src/services/navigationService';
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
import { configureGoogleSignIn } from './src/services/authService';
import { runMigration } from './src/services/migrationService';
import { restoreSessionsFromFirestore } from './src/services/sessionRestoreService';
import { runLocalMigrationsIfNeeded } from './src/services/localMigrationService';
import { logSessionComplete } from './src/services/analyticsService';
import { trackNotificationOpened } from './src/services/analytics';
import { getActiveSession } from './src/services/sessionStateService';
import { syncWidgetState } from './src/services/widgetSyncService';
import { processPendingWidgetSessionStart } from './src/services/widgetHandoffService';
import { createPendingSessionStart } from './src/services/widgetDataBridge';

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

configureGoogleSignIn();

// ─── Migration Handler ────────────────────────────────────────────────────────
// Stub for now — Session 2 wires this to migrationService
const handleMigrationNeeded = async (firebaseUser) => {
  console.log('📦 [App] migration check triggered for uid:', firebaseUser.uid);
  const result = await runMigration(firebaseUser);
  console.log('📦 [App] migration result:', result);

  // Firestore → local restoration runs after migration (not before) so a
  // fresh install with no local sessions doesn't get its just-restored
  // history immediately re-uploaded by runMigration on the same pass.
  const restoreResult = await restoreSessionsFromFirestore(firebaseUser);
  console.log('📦 [App] session restore result:', restoreResult);
};

// ─── Auth-Gated Navigator ─────────────────────────────────────────────────────
/**
 * Renders LoginScreen when user is null and auth has resolved.
 * Returns null during authLoading to prevent flash of LoginScreen
 * on cold start for already-logged-in users.
 */
function AppNavigator() {
  const { user, authLoading } = useAuth();
  // Widget-triggered starts must respect the same long-session premium gate
  // HomeScreen enforces — isPremium/isLoading feed into
  // processPendingWidgetSessionStart's fail-closed check below.
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();

  // Cold-launch active-session recovery: if iOS suspended/killed the app while
  // a session was running (e.g. phone locked with no background audio), route
  // straight back into DeepWorkSession instead of landing on Home and forcing
  // the user through the manual "pick up where you left off?" prompt.
  // DeepWorkSession.initializeSession() re-derives the correct remaining time
  // from the persisted endTime on mount, so only the launch config (duration/
  // activity/musicChoice/focusLockEnabled) needs to be restored here — same
  // params HomeScreen.handleResumeSession already passes.
  const [sessionRecovery, setSessionRecovery] = useState({ checked: false, params: null });
  const recoveryStartedRef = useRef(false);

  useEffect(() => {
    // Also wait on subscription readiness — the widget-check below needs a
    // resolved isPremium to safely apply the long-session paywall gate, and
    // gating the whole effect keeps this simple rather than letting
    // active-session recovery and the widget-check race independently.
    if (authLoading || subscriptionLoading || !user) return;
    // Guard against re-running on subsequent auth-state changes (token
    // refresh, etc.) — this check must happen at most once per cold launch.
    if (recoveryStartedRef.current) return;
    recoveryStartedRef.current = true;

    let cancelled = false;
    (async () => {
      let params = null;
      try {
        const active = await getActiveSession();
        // Only auto-resume a still-running session. Expired sessions must
        // continue through the existing HomeScreen "session finished while
        // away" recovery flow — do not treat them as active.
        if (active && active.status === 'running') {
          params = {
            duration:         String(active.config.duration),
            activity:         active.config.activity,
            musicChoice:      active.config.musicChoice,
            focusLockEnabled: active.config.focusLockEnabled,
          };
        }
      } catch (error) {
        // If the check itself fails, fall through to normal Home routing —
        // HomeScreen's own getActiveSession() check remains the fallback.
        console.warn('[App] Active-session recovery check failed:', error);
      }

      // A resumed in-progress session always takes priority — only look for
      // a widget-triggered start request if there's nothing to resume.
      if (!params) {
        try {
          console.log('[WidgetHandoff] JS: cold-launch check running, isPremium=', isPremium);
          const widgetResult = await processPendingWidgetSessionStart({ isPremium });
          console.log('[WidgetHandoff] JS: cold-launch result =', widgetResult);
          if (widgetResult.started) {
            params = {
              duration:         String(widgetResult.params.duration),
              activity:         widgetResult.params.activity,
              musicChoice:      widgetResult.params.musicChoice,
              focusLockEnabled: widgetResult.params.focusLockEnabled,
            };
          }
        } catch (error) {
          console.warn('[App] Widget session-start check failed:', error);
        }
      }

      if (!cancelled) setSessionRecovery({ checked: true, params });
    })();

    return () => { cancelled = true; };
  }, [authLoading, subscriptionLoading, user]);

  // Recurring foreground check for widget-triggered session starts. The
  // effect above only runs once per cold launch (recoveryStartedRef guards
  // it) and covers the "auth just became ready" moment; this covers every
  // subsequent return to foreground while already authenticated. Kept as a
  // separate AppState subscription (distinct from the one in MainApp, which
  // handles unrelated housekeeping and has no auth access) specifically
  // because starting a session requires user/authLoading, which only this
  // component (inside AuthProvider) has via useAuth().
  useEffect(() => {
    if (authLoading || subscriptionLoading || !user) return; // not safe to process yet — request stays pending untouched

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      (async () => {
        try {
          console.log('[WidgetHandoff] JS: foreground check running, isPremium=', isPremium);
          const result = await processPendingWidgetSessionStart({ isPremium });
          console.log('[WidgetHandoff] JS: foreground result =', result);
          if (result.started) {
            console.log('[WidgetHandoff] JS: navigating to DeepWorkSession with params=', result.params);
            safeNavigate('DeepWorkSession', {
              duration:         String(result.params.duration),
              activity:         result.params.activity,
              musicChoice:      result.params.musicChoice,
              focusLockEnabled: result.params.focusLockEnabled,
            });
          }
        } catch (error) {
          console.warn('[AppNavigator] Widget session-start foreground check failed:', error);
        }
      })();
    });

    return () => subscription.remove();
  }, [authLoading, subscriptionLoading, user]);

  // lucid://start-focus deep link (widget FOCUS button, via a widgetURL/Link
  // rather than the AppIntent handoff — see DeepWorkWidget.swift). Receiving
  // this URL only proves the OS delivered the tap; it does not by itself mean
  // a pending request exists, so this creates one via the native bridge
  // (createPendingSessionStart mirrors the widget's own App Group write —
  // see widgetDataBridge.js/WidgetDataBridge.swift) and then reuses the same
  // processPendingWidgetSessionStart() lifecycle/premium-gate/navigation
  // already used by the foreground and cold-launch paths above, rather than
  // introducing a second session-start pathway.
  //
  // Refs (not state) mirror the latest auth/subscription values so the
  // Linking listener effect below can read fresh values without needing
  // those values as dependencies — keeping that effect's registration
  // one-time-per-mount instead of resubscribing (and re-querying
  // getInitialURL()) on every auth/subscription change.
  const widgetDeepLinkAuthStateRef = useRef({ authLoading, subscriptionLoading, user, isPremium });
  useEffect(() => {
    widgetDeepLinkAuthStateRef.current = { authLoading, subscriptionLoading, user, isPremium };
  }, [authLoading, subscriptionLoading, user, isPremium]);

  // Guards against overlapping runs if the OS ever redelivers the same URL
  // while a previous invocation is still in flight — without this, two
  // concurrent createPendingSessionStart() calls could each be picked up by
  // a separate processPendingWidgetSessionStart() call and start two
  // sessions instead of one.
  const handlingStartFocusDeepLinkRef = useRef(false);

  const handleStartFocusDeepLink = useCallback(async () => {
    if (handlingStartFocusDeepLinkRef.current) return;
    handlingStartFocusDeepLinkRef.current = true;
    try {
      const created = await createPendingSessionStart();
      if (!created) return;

      const {
        authLoading: authLoadingNow,
        subscriptionLoading: subscriptionLoadingNow,
        user: userNow,
        isPremium: isPremiumNow,
      } = widgetDeepLinkAuthStateRef.current;

      if (authLoadingNow || subscriptionLoadingNow || !userNow) {
        // Not safe to resolve/navigate yet — the pending request now sits in
        // the App Group exactly like a widget-written one, and the existing
        // cold-launch effect above will pick it up as soon as auth is ready.
        return;
      }

      const result = await processPendingWidgetSessionStart({ isPremium: isPremiumNow });
      if (result.started) {
        safeNavigate('DeepWorkSession', {
          duration:         String(result.params.duration),
          activity:         result.params.activity,
          musicChoice:      result.params.musicChoice,
          focusLockEnabled: result.params.focusLockEnabled,
        });
      }
    } catch (error) {
      console.warn('[App] Widget deep-link session-start failed:', error);
    } finally {
      handlingStartFocusDeepLinkRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleUrl = ({ url }) => {
      if (url && url.startsWith('lucid://start-focus')) {
        handleStartFocusDeepLink();
      }
    };

    // Covers the app already running (foregrounded or backgrounded).
    const subscription = Linking.addEventListener('url', handleUrl);

    // Covers the app being launched cold by the link itself.
    Linking.getInitialURL()
      .then((url) => {
        if (url && url.startsWith('lucid://start-focus')) {
          handleStartFocusDeepLink();
        }
      })
      .catch((error) => {
        console.warn('[App] Linking.getInitialURL() failed:', error);
      });

    return () => subscription.remove();
  }, [handleStartFocusDeepLink]);

  if (authLoading) {
    // Auth is resolving persisted session — render nothing to avoid flash
    return null;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!sessionRecovery.checked) {
    // Brief check before the navigator mounts — same "render nothing" pattern
    // used for authLoading above. initialRouteName is only honored on first
    // mount, so the navigator must not render until this resolves.
    return null;
  }

  return (
    <Stack.Navigator
      initialRouteName={sessionRecovery.params ? 'DeepWorkSession' : 'InitialSetup'}
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
        initialParams={sessionRecovery.params || undefined}
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
            'Lucid needs notifications to alert you when sessions complete, even when your phone is locked.\n\nTo enable:\n1. Open Settings\n2. Find Lucid\n3. Enable Notifications\n4. Enable Sounds',
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
                'A new version of Lucid has been downloaded. Would you like to restart to apply it?',
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
          'There was a problem starting Lucid. Please try restarting the app.',
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

              // FCM taps are counted in useNotificationHandlers; count only
              // the app's own local types here so no tap is counted twice.
              if (['session_end', 'streak_risk', 'reengagement'].includes(type)) {
                trackNotificationOpened(data, 'local');
              }
        
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

                // NOTE: intentionally NOT calling clearActiveSession() here.
                // HomeScreen's orphan-detection ("Session ended while away" modal)
                // is the sole owner of saving + clearing an expired active-session
                // record. Clearing it here would race with that flow — if this
                // notification-tap handler wins the race, the record disappears
                // before HomeScreen can show the save prompt, silently losing the
                // session (it would never be written to history). Leaving it
                // intact is safe: HomeScreen's checkSessionState() (now also
                // triggered on AppState foreground, not just navigation focus)
                // will pick it up and clear it once the user saves or dismisses.
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
        // Keep the widget's shared state current in case anything changed
        // while the app was backgrounded (e.g. a notification-driven
        // completion) — fire-and-forget, matches the pattern above.
        syncWidgetState().catch(() => {});
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
          Loading Lucid...
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
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