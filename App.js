// App.js - Fixed Navigation for iPad Full Screen
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert, View, Text, Platform, Dimensions, StatusBar } from 'react-native';
import { navigationRef, safeNavigate } from './src/services/navigationService';
import backgroundTimer from './src/services/backgroundTimer';
import ErrorBoundary from './src/components/ErrorBoundary';

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

console.log('Device Info:', {
  platform: Platform.OS,
  version: Platform.Version,
  isTablet,
  dimensions: { width, height }
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

// Background service initialization with better error handling
const initializeBackgroundServices = async () => {
  try {
    console.log('Starting background services initialization...');
    
    if (Platform.OS === 'ios' && isTablet) {
      console.log('iPad detected - using conservative background task setup');
    }
    
    const configPromise = backgroundTimer.configureNotifications();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Configuration timeout')), 15000)
    );
    
    await Promise.race([configPromise, timeoutPromise]);
    console.log('Background services initialized successfully');
    return true;
  } catch (error) {
    console.error('Background services initialization failed:', error);
    return false;
  }
};

function MainApp() {
  const [notificationSubscription, setNotificationSubscription] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState({
    backgroundServices: 'pending',
    notifications: 'pending',
    updates: 'pending'
  });

  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('App initialization starting...');
        setIsAppReady(true);
        
        // Initialize background services with proper error handling
        setTimeout(async () => {
          const bgSuccess = await initializeBackgroundServices();
          setInitializationStatus(prev => ({
            ...prev,
            backgroundServices: bgSuccess ? 'success' : 'failed'
          }));
        }, isTablet ? 3000 : 1500);
        
      } catch (error) {
        console.error('Critical app initialization error:', error);
        setIsAppReady(true);
      }
    };
    
    initApp();
    
    // Handle updates
    const checkForUpdates = async () => {
      try {
        if (__DEV__) {
          console.log('Development mode - skipping update check');
          return;
        }
        
        console.log('Checking for updates...');
        const update = await Updates.checkForUpdateAsync();
        
        setInitializationStatus(prev => ({
          ...prev,
          updates: 'checked'
        }));
        
        if (update.isAvailable) {
          console.log('Update available, fetching...');
          await Updates.fetchUpdateAsync();
          
          Alert.alert(
            'Update Available',
            'A new version is available. Would you like to restart now?',
            [
              { text: 'Later', style: 'cancel' },
              { 
                text: 'Restart', 
                onPress: async () => {
                  try {
                    await Updates.reloadAsync();
                  } catch (updateError) {
                    console.error('Failed to reload with update:', updateError);
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        console.log('Update check failed (non-critical):', error);
        setInitializationStatus(prev => ({
          ...prev,
          updates: 'failed'
        }));
      }
    };
    
    setTimeout(checkForUpdates, isTablet ? 5000 : 3000);

    // Setup notifications
    const setupNotifications = async () => {
      try {
        console.log('Setting up notification handlers...');
        
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          try {
            const actionId = response.actionIdentifier;
            
            if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
              const { screen, params } = response.notification.request.content.data || {};
              if (screen) {
                safeNavigate(screen, params);
              }
            }
            else if (actionId === 'PAUSE_RESUME') {
              handlePauseResumeAction();
            }
            else if (actionId === 'END_SESSION') {
              handleEndSession();
            }
          } catch (error) {
            console.error('Notification response error:', error);
          }
        });
        
        setNotificationSubscription(subscription);
        setInitializationStatus(prev => ({
          ...prev,
          notifications: 'success'
        }));
        
      } catch (error) {
        console.error('Notification setup error:', error);
        setInitializationStatus(prev => ({
          ...prev,
          notifications: 'failed'
        }));
      }
    };

    setTimeout(setupNotifications, isTablet ? 4000 : 2000);
    
    return () => {
      if (notificationSubscription) {
        try {
          notificationSubscription.remove();
        } catch (error) {
          console.error('Error removing notification subscription:', error);
        }
      }
    };
  }, []);

  const handlePauseResumeAction = async () => {
    try {
      const sessionData = await backgroundTimer.getCurrentSession();
      if (sessionData) {
        await backgroundTimer.updateTimerPauseState(!sessionData.isPaused);
      }
    } catch (error) {
      console.error('Pause/resume error:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      await backgroundTimer.stopTimerNotification();
      safeNavigate('MainApp', { screen: 'Home' });
    } catch (error) {
      console.error('End session error:', error);
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
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        {/* Full screen status bar configuration */}
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
              // CRITICAL FIX: Force full screen presentation on iPad
              presentation: 'card', // Not 'modal' - this was causing the issue
              animationTypeForReplace: 'push',
              // iPad-specific optimizations
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
                // Ensure full screen for setup
                presentation: 'card',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen 
              name="MainApp" 
              component={TabNavigator}
              options={{
                // Ensure full screen for main app
                presentation: 'card',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen 
              name="DeepWorkSession" 
              component={DeepWorkSession}
              options={{
                // CRITICAL: Use card presentation, not modal
                presentation: 'card',
                gestureEnabled: false,
                // Ensure clean transitions
                animationTypeForReplace: 'push',
                // iPad-specific session options
                ...(isTablet && {
                  orientation: 'portrait', // Lock to portrait on iPad
                })
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Safety wrapper
const SafeApp = () => {
  try {
    return <MainApp />;
  } catch (error) {
    console.error('Critical app error:', error);
    
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
