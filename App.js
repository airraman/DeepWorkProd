// App.js - FIXED
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert, View, Text } from 'react-native';
import { navigationRef, safeNavigate } from './src/services/navigationService';
import backgroundTimer from './src/services/backgroundTimer';

// Import screens
import InitialSetupScreen from './src/screens/InitialSetUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import MetricsScreen from './src/screens/MetricsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeepWorkSession from './src/screens/DeepWorkSession';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Main App component using both navigators
function MainApp() {
  const [notificationSubscription, setNotificationSubscription] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    // Initialize app
    const initApp = async () => {
      try {
        // Set app as ready first to ensure UI is visible 
        // even if there are issues with background services
        setIsAppReady(true);
        
        // Delay background services initialization
        setTimeout(async () => {
          try {
            // Configure notifications
            await backgroundTimer.configureNotifications();
            console.log('Notifications configured successfully');
          } catch (error) {
            console.error('Error initializing background services:', error);
          }
        }, 1500); // Delay by 1.5 seconds
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsAppReady(true); // Still set app as ready so UI is visible
      }
    };
    
    initApp();
    
    // Check for updates with error handling
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('New update available');
          await Updates.fetchUpdateAsync();
          // Alert user to reload
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
        } else {
          console.log('App is up to date');
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
        // Non-fatal error, don't block app startup
      }
    };
    
    // Delay update check to prioritize UI rendering
    setTimeout(() => {
      checkForUpdates();
    }, 3000);

    // Set up notification response handler after app is ready
    const setupNotifications = async () => {
      try {
        // Set up notification response handler
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          try {
            // Get the action identifier
            const actionId = response.actionIdentifier;
            
            if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
              // Notification was tapped - navigate to the session screen
              const { screen, params } = response.notification.request.content.data;
              if (screen) {
                safeNavigate(screen, params);
              }
            }
            else if (actionId === 'PAUSE_RESUME') {
              // Toggle pause state
              const handlePauseResumeAction = async () => {
                try {
                  const sessionData = await backgroundTimer.getCurrentSession();
                  if (sessionData) {
                    await backgroundTimer.updateTimerPauseState(!sessionData.isPaused);
                  }
                } catch (error) {
                  console.error("Error handling pause/resume action:", error);
                }
              };
              handlePauseResumeAction();
            }
            else if (actionId === 'END_SESSION') {
              // End session
              try {
                backgroundTimer.stopTimerNotification();
                safeNavigate('MainApp', { screen: 'Home' });
              } catch (error) {
                console.error("Error ending session:", error);
              }
            }
          } catch (error) {
            console.error("Error handling notification action:", error);
          }
        });
        
        setNotificationSubscription(subscription);
      } catch (error) {
        console.error("Error setting up notification handler:", error);
      }
    };

    // Delay notification setup
    setTimeout(() => {
      setupNotifications();
    }, 2000);
    
    // Clean up on unmount
    return () => {
      if (notificationSubscription) {
        try {
          notificationSubscription.remove();
        } catch (error) {
          console.error("Error removing notification subscription:", error);
        }
      }
    };
  }, []);
  
  // Show a loading screen if app is not ready
  if (!isAppReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading DeepWork.io...</Text>
      </View>
    );
  }
  
  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="InitialSetup"
          screenOptions={{
            headerShown: false,
            gestureEnabled: false
          }}
        >
          <Stack.Screen name="InitialSetup" component={InitialSetupScreen} />
          <Stack.Screen name="MainApp" component={TabNavigator} />
          <Stack.Screen 
            name="DeepWorkSession" 
            component={DeepWorkSession}
            options={{
              gestureEnabled: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

// Safe initialization wrapper to catch any critical errors
const SafeApp = () => {
  try {
    return <MainApp />;
  } catch (error) {
    console.error('Critical error during app initialization:', error);
    // Return a simple error screen
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20}}>
        <Text style={{fontSize: 18, fontWeight: 'bold', marginBottom: 10}}>
          Something went wrong
        </Text>
        <Text style={{textAlign: 'center', marginBottom: 20}}>
          We encountered a problem starting the app. Please try again.
        </Text>
        <Text style={{color: '#666', fontSize: 12}}>
          Error details: {error.message || 'Unknown error'}
        </Text>
      </View>
    );
  }
};

export default SafeApp;