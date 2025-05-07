// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider } from './src/context/ThemeContext';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
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

// Define the background task identifier - must match app.json and backgroundTimer.js
const BACKGROUND_TIMER_TASK = 'com.expo.tasks.BACKGROUND_TIMER_TASK';

// Setup background tasks
const setupBackgroundTasks = async () => {
  try {
    console.log('Setting up background tasks...');
    // Check if TaskManager already has this task defined
    const isTaskDefined = TaskManager.isTaskDefined(BACKGROUND_TIMER_TASK);
    
    if (!isTaskDefined) {
      console.log('Defining background task:', BACKGROUND_TIMER_TASK);
      TaskManager.defineTask(BACKGROUND_TIMER_TASK, async () => {
        try {
          const sessionData = await backgroundTimer.getCurrentSession();
          
          if (!sessionData) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
          }
    
          // Don't update timer if paused
          if (sessionData.isPaused) {
            // Instead of redefining this logic, we'll just call our existing function
            await backgroundTimer.updateTimerNotification(sessionData.remainingAtPause, sessionData);
            return BackgroundFetch.BackgroundFetchResult.NewData;
          }
    
          const timeRemaining = backgroundTimer.calculateRemainingTime(sessionData);
          
          if (timeRemaining <= 0) {
            // Session complete
            await backgroundTimer.sendCompletionNotification();
            await backgroundTimer.clearActiveSession();
            return BackgroundFetch.BackgroundFetchResult.NewData;
          }
          
          // Update notification with current timer
          await backgroundTimer.updateTimerNotification(timeRemaining, sessionData);
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          console.error("Background task error:", error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
    }
    
    console.log('Registering background task...');
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TIMER_TASK, {
      minimumInterval: 15, // 15 seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background task registered successfully');
  } catch (error) {
    console.error('Failed to set up background tasks:', error);
  }
};

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
        // Set up background tasks right away
        await setupBackgroundTasks();
        
        // Configure notifications
        await backgroundTimer.configureNotifications();
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    initApp();
    
    // Updated way to check for updates
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
          setupBackgroundTasks(); // Register tasks again to be safe
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