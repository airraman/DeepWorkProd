// App.js - Production Version with iOS Notification Fix + Database + RevenueCat
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';  // ✅ NEW IMPORT
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert, View, Text, Platform, Dimensions, StatusBar, Linking } from 'react-native';import { navigationRef, safeNavigate } from './src/services/navigationService';
import backgroundTimer from './src/services/backgroundTimer';
import ErrorBoundary from './src/components/ErrorBoundary';
import DevToolsScreen from './src/screens/DevToolsScreen';
import { notificationService } from './src/services/notificationService';
// import DeepWorkSession from './src/screens/DeepWorkSession';


// DATABASE IMPORTS
import DatabaseService from './src/services/database/DatabaseService';
// import { testDatabase } from './src/services/database/testDatabase';

// SAFE IMPORT: Only import alarmService if we want to use it
let alarmService = null;
try {
  // Dynamically import alarmService - this prevents crashes if the service has issues
  const alarmModule = require('./src/services/alarmService');
  alarmService = alarmModule.alarmService;
  console.log('🔔 Alarm service imported successfully');
} catch (error) {
  console.warn('🔔 Alarm service not available:', error.message);
  // Create a mock alarm service that does nothing
  alarmService = {
    init: async () => { console.log('🔔 Mock alarm service init'); return true; },
    cleanup: async () => { console.log('🔔 Mock alarm service cleanup'); },
    playCompletionAlarm: async () => { console.log('🔔 Mock alarm'); return true; }
  };
}

// Import screens
import InitialSetupScreen from './src/screens/InitialSetUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import MetricsScreen from './src/screens/MetricsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeepWorkSession from './src/screens/DeepWorkSession';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Safe iPad detection
const { width, height } = Dimensions.get('window');
const isTablet = Platform.isPad || (width > 768 && height > 768);

console.log('📱 Device Info:', {
  platform: Platform.OS,
  version: Platform.Version,
  isTablet,
  dimensions: { width, height },
  hasAlarmService: !!alarmService
});

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

// SAFE background services initialization with proper error handling
// COMPLETE: Updated initializeBackgroundServices function with notification permissions
const initializeBackgroundServices = async () => {
  try {
    console.log('🚀 Starting safe background services initialization...');
    
    if (Platform.OS === 'ios' && isTablet) {
      console.log('📱 iPad detected - using conservative background task setup');
    }
    
    // STEP 1: Request notification permissions FIRST
    let permissionsGranted = false;
    try {
      console.log('📱 Requesting notification permissions...');
      
      // ✅ Request with all options
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: false, // Requires special entitlement
        },
      });
      
      if (status === 'granted') {
        console.log('📱 Notification permissions granted');
        permissionsGranted = true;
      } else {
        console.warn('📱 Notification permissions denied');
        
        // Show alert explaining why notifications are important
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
    
    // STEP 2: Initialize alarm service with error handling
    let alarmInitialized = false;
    try {
      if (alarmService && typeof alarmService.init === 'function') {
        alarmInitialized = await alarmService.init();
        if (alarmInitialized) {
          console.log('🔔 Alarm service initialized successfully');
        } else {
          console.warn('⚠️ Alarm service failed to initialize - alarms may not work');
        }
      } else {
        console.log('🔔 Alarm service not available - using mock service');
        alarmInitialized = true; // Mock service always "succeeds"
      }
    } catch (alarmError) {
      console.error('🔔 Alarm service initialization error:', alarmError);
      alarmInitialized = false; // Continue without alarm service
    }
    
    // STEP 3: Configure notifications with timeout (FIXED - no iOS categories crash)
    let notificationsConfigured = false;
    try {
      console.log('📱 Configuring notification system...');
      const configPromise = backgroundTimer.configureNotifications();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Configuration timeout')), 15000)
      );
      
      await Promise.race([configPromise, timeoutPromise]);
      notificationsConfigured = true;
      console.log('📱 Notifications configured successfully');
    } catch (notificationError) {
      console.error('📱 Notification configuration failed:', notificationError);
      notificationsConfigured = false; // Continue without background notifications
    }
    
    // STEP 4: Test notification system if permissions are granted
    if (permissionsGranted && notificationsConfigured) {
      try {
        console.log('📱 Testing notification system...');
        
        // Send a silent test notification to verify the system works
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'DeepWork Ready',
            body: 'Notification system initialized successfully',
            data: { test: true },
            sound: false, // Silent test
          },
          trigger: null,
        });
        
        console.log('📱 Notification system test completed');
      } catch (testError) {
        console.warn('📱 Notification test failed (non-critical):', testError);
      }
    }
    
    console.log('🚀 Background services initialization completed:', {
      permissions: permissionsGranted,
      alarmService: alarmInitialized,
      notifications: notificationsConfigured
    });
    
    // Return true even if some services failed - app should still work
    return true;
  } catch (error) {
    console.error('🚀 Background services initialization failed:', error);
    // Always return true to prevent app crashes
    return true;
  }
};

function MainApp() {
  const [notificationSubscription, setNotificationSubscription] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState({
    database: 'pending',
    backgroundServices: 'pending',
    notifications: 'pending',
    updates: 'pending'
  });

  useEffect(() => {
    console.log('🚀 App.js: useEffect starting...');
    
    const initApp = async () => {
      try {
        console.log('🚀 App initialization starting...');
        
        // STEP 1: Initialize database FIRST (before anything else)
        try {
          console.log('💾 Initializing database...');
          await DatabaseService.init();
          console.log('✅ Database initialized successfully');
          
          // // TEMPORARY: Run database test in development
          // if (__DEV__) {
          //   setTimeout(async () => {
          //     try {
          //       await testDatabase();
          //     } catch (testError) {
          //       console.error('Test error:', testError);
          //     }
          //   }, 2000);
          // }
          
          setInitializationStatus(prev => ({
            ...prev,
            database: 'success'
          }));

          // STEP 1A: Schedule reminder notifications
  try {
    console.log('🔔 Scheduling reminder notifications...');
    const hasPermission = await notificationService.areNotificationsEnabled();
    if (hasPermission) {
      await notificationService.scheduleNotifications();
      console.log('✅ Reminder notifications scheduled');
    } else {
      console.log('⚠️ Notification permissions not granted - reminders not scheduled');
    }
  } catch (notifError) {
    console.error('❌ Error scheduling reminders:', notifError);
    // Non-critical - continue app initialization
  }
  
        } catch (dbError) {
          console.error('❌ Database initialization failed:', dbError);
          setInitializationStatus(prev => ({
            ...prev,
            database: 'failed'
          }));
          throw dbError;
        }
        
        // STEP 2: Initialize background services
        try {
          console.log('🚀 Initializing background services...');
          await initializeBackgroundServices();
          console.log('✅ Background services initialized');
          
          setInitializationStatus(prev => ({
            ...prev,
            backgroundServices: 'success'
          }));
        } catch (bgError) {
          console.error('❌ Background services initialization failed:', bgError);
          setInitializationStatus(prev => ({
            ...prev,
            backgroundServices: 'failed'
          }));
        }
        
        // STEP 3: Check for app updates (non-blocking)
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
                  { 
                    text: 'Restart Now', 
                    onPress: () => Updates.reloadAsync() 
                  }
                ]
              );
            } else {
              console.log('✅ App is up to date');
            }
          }
          
          setInitializationStatus(prev => ({
            ...prev,
            updates: 'success'
          }));
        } catch (updateError) {
          console.warn('⚠️ Update check failed (non-critical):', updateError);
          setInitializationStatus(prev => ({
            ...prev,
            updates: 'skipped'
          }));
        }
        
        console.log('✅ App initialization completed successfully');
        
        // Mark app as ready
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
    
    const setupNotifications = async () => {
      try {
        const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
          try {
            const data = response.notification.request.content.data;
            
            if (data.action === 'pauseResume') {
              handlePauseResumeAction();
            } else if (data.action === 'endSession') {
              handleEndSession();
            } else if (data.type === 'sessionComplete') {
              await handleCompletionAlarmFromNotification(data);
            } else if (data.action === 'navigateToSession') {
              safeNavigate('DeepWorkSession');
            } else if (data.type === 'timerUpdate') {
              // Just update - no action needed
            } else if (data.type === 'pauseResume') {
              handlePauseResumeAction();
            } else if (data.type === 'endSession') {
              handleEndSession();
            }
          } catch (error) {
            console.error('🚀 Notification response error:', error);
          }
        });
        
        setNotificationSubscription(subscription);
        setInitializationStatus(prev => ({
          ...prev,
          notifications: 'success'
        }));
        
      } catch (error) {
        console.error('🚀 Notification setup error:', error);
        setInitializationStatus(prev => ({
          ...prev,
          notifications: 'failed'
        }));
      }
    };

    // SAFE: Alarm handling from notifications
    const handleCompletionAlarmFromNotification = async (notificationData) => {
      try {
        console.log('🔔 Attempting to play completion alarm from notification...');
        
        // Check if alarm service is available and functional
        if (alarmService && typeof alarmService.init === 'function') {
          // Initialize alarm service if needed
          const alarmReady = await alarmService.init();
          if (!alarmReady) {
            console.error('🔔 Failed to initialize alarm service');
            showFallbackAlert();
            return;
          }
          
          // Get alarm settings from notification data or use defaults
          const alarmSettings = notificationData.alarmSettings || {
            volume: 0.8,
            autoStopAfter: 8
          };
          
          // Play the completion alarm
          const alarmPlayed = await alarmService.playCompletionAlarm(alarmSettings);
          
          if (alarmPlayed) {
            console.log('🎉 Session completion alarm played successfully!');
          } else {
            console.log('🔔 Alarm failed to play - showing visual confirmation');
            showFallbackAlert();
          }
        } else {
          console.log('🔔 Alarm service not available - showing visual alert instead');
          showFallbackAlert();
        }
        
      } catch (error) {
        console.error('🔔 Error playing completion alarm from notification:', error);
        showFallbackAlert();
      }
    };

    // Fallback visual notification
    const showFallbackAlert = () => {
      setTimeout(() => {
        Alert.alert(
          '🎉 Session Complete!',
          'Congratulations! Your deep work session has finished successfully.',
          [{ text: 'Awesome!', style: 'default' }]
        );
      }, 500);
    };

    setTimeout(setupNotifications, isTablet ? 4000 : 2000);
    
    return () => {
      console.log('🚀 App.js: Cleaning up...');
      if (notificationSubscription) {
        try {
          notificationSubscription.remove();
        } catch (error) {
          console.error('🚀 Error removing notification subscription:', error);
        }
      }
    };
  }, []);

  // Safe action handlers
  const handlePauseResumeAction = async () => {
    try {
      const sessionData = await backgroundTimer.getCurrentSession();
      if (sessionData) {
        await backgroundTimer.updateTimerPauseState(!sessionData.isPaused);
      }
    } catch (error) {
      console.error('🚀 Pause/resume error:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      await backgroundTimer.stopTimerNotification();
      safeNavigate('MainApp', { screen: 'Home' });
    } catch (error) {
      console.error('🚀 End session error:', error);
    }
  };
  
  if (!isAppReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        padding: 20
      }}>
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
      {/* ✅ UPDATED: SubscriptionProvider wraps ThemeProvider */}
      <SubscriptionProvider>
        <ThemeProvider>
          <StatusBar 
            barStyle="dark-content" 
            backgroundColor="transparent" 
            translucent={false}
          />
          
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              initialRouteName="InitialSetup"
              screenOptions={{
                headerShown: false,
                gestureEnabled: false,
                presentation: 'card',
                animationTypeForReplace: 'push',
                ...(isTablet && {
                  contentStyle: { 
                    backgroundColor: 'transparent' 
                  },
                  cardStyle: { 
                    backgroundColor: 'transparent' 
                  }
                })
              }}
            >
              <Stack.Screen 
                name="InitialSetup" 
                component={InitialSetupScreen}
                options={{
                  presentation: 'card',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen 
                name="MainApp" 
                component={TabNavigator}
                options={{
                  presentation: 'card',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen 
                name="DeepWorkSession" 
                component={DeepWorkSession}
                options={{
                  presentation: 'card',
                  gestureEnabled: false,
                  animationTypeForReplace: 'push',
                  ...(isTablet && {
                    orientation: 'portrait',
                  })
                }}
              />
              <Stack.Screen 
                name="DevTools" 
                component={DevToolsScreen}
                options={{
                  presentation: 'modal',
                  gestureEnabled: true,
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </SubscriptionProvider>
      {/* ✅ END OF UPDATED SECTION */}
    </ErrorBoundary>
  );
}

// Safety wrapper
const SafeApp = () => {
  try {
    return <MainApp />;
  } catch (error) {
    console.error('🚀 Critical app error:', error);
    
    return (
      <View style={{
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20,
        backgroundColor: '#f8f9fa'
      }}>
        <Text style={{fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#dc3545'}}>
          App Error
        </Text>
        <Text style={{textAlign: 'center', marginBottom: 20, fontSize: 16}}>
          Something went wrong during startup
        </Text>
        <Text style={{fontSize: 12, color: '#6c757d', textAlign: 'center'}}>
          Device: {Platform.OS} {Platform.Version}
        </Text>
        <Text style={{fontSize: 12, color: '#6c757d', textAlign: 'center'}}>
          Error: {error.message || 'Unknown error'}
        </Text>
      </View>
    );
  }
};

export default SafeApp;