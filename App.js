// App.js - FIXED
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';
import { navigationRef } from './src/services/navigationService';
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
function App() {
  useEffect(() => {
    // Initialize app
    const initApp = async () => {
      try {
        // Configure notifications
        await backgroundTimer.configureNotifications();
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    initApp();
    
    // Check for updates
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
                  await Updates.reloadAsync();
                }
              }
            ]
          );
        } else {
          console.log('App is up to date');
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    };
    
    checkForUpdates();

    // Set up notification response handler
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        // Get the action identifier
        const actionId = response.actionIdentifier;
        
        if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          // Notification was tapped - navigate to the session screen
          const { screen, params } = response.notification.request.content.data;
          if (screen) {
            navigationRef.current?.navigate(screen, params);
          }
        }
        else if (actionId === 'PAUSE_RESUME') {
          // Toggle pause state
          const handlePauseResumeAction = async () => {
            const sessionData = await backgroundTimer.getCurrentSession();
            if (sessionData) {
              await backgroundTimer.updateTimerPauseState(!sessionData.isPaused);
            }
          };
          handlePauseResumeAction();
        }
        else if (actionId === 'END_SESSION') {
          // End session
          backgroundTimer.stopTimerNotification();
          if (navigationRef.current) {
            navigationRef.current.navigate('MainApp', { screen: 'Home' });
          }
        }
      } catch (error) {
        console.error("Error handling notification action:", error);
      }
    });
    
    // Clean up on unmount
    return () => {
      if (notificationSubscription) {
        notificationSubscription.remove();
      }
    };
  }, []);
  
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

export default App;