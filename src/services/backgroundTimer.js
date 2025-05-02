import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deepWorkStore } from './deepWorkStore';
import { Platform } from 'react-native';

// Define constants - UPDATED to match App.js
const BACKGROUND_TIMER_TASK = 'com.expo.tasks.BACKGROUND_TIMER_TASK';
const ACTIVE_SESSION_KEY = '@active_deep_work_session';

// Helper functions for session storage
const saveActiveSessionToStorage = async (sessionData) => {
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
};

const getActiveSessionFromStorage = async () => {
  const data = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  return data ? JSON.parse(data) : null;
};

const clearActiveSession = async () => {
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
};

// Generate a text-based progress bar
const generateTextProgressBar = (percent, length = 10) => {
  const filledLength = Math.floor(length * (percent / 100));
  const emptyLength = length - filledLength;
  
  // Using Unicode block characters for better visibility
  return '▓'.repeat(filledLength) + '░'.repeat(emptyLength);
};

// Calculate time remaining based on session data
const calculateRemainingTime = (sessionData) => {
  if (sessionData.isPaused) {
    // If paused, return the time remaining at the moment of pausing
    return sessionData.remainingAtPause;
  }
  
  const elapsed = Date.now() - sessionData.startTime;
  return Math.max(0, sessionData.duration - elapsed);
};

// Register the background task
TaskManager.defineTask(BACKGROUND_TIMER_TASK, async () => {
  try {
    const sessionData = await getActiveSessionFromStorage();
    
    if (!sessionData) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Don't update timer if paused
    if (sessionData.isPaused) {
      await updateTimerNotification(sessionData.remainingAtPause, sessionData);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    const timeRemaining = calculateRemainingTime(sessionData);
    
    if (timeRemaining <= 0) {
      // Session complete
      await sendCompletionNotification();
      await clearActiveSession();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    
    // Update notification with current timer
    await updateTimerNotification(timeRemaining, sessionData);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Background task error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Send session completion notification
const sendCompletionNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Deep Work Session Complete!',
      body: 'Great job! Your focus session has ended.',
      data: { screen: 'MainApp', params: { screen: 'Metrics' } },
    },
    trigger: null,
  });
};

// Update the notification with current timer
const updateTimerNotification = async (timeRemaining, sessionData) => {
  try {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Calculate progress percentage (0-100)
    const totalDuration = sessionData.duration;
    const progress = Math.max(0, Math.min(1, (totalDuration - timeRemaining) / totalDuration));
    const progressPercentage = Math.round(progress * 100);
    
    // Create a text-based progress bar
    const progressBar = generateTextProgressBar(progressPercentage);
    
    // Try to get activity details
    let activityName = 'Focus Session';
    let activityColor = '#2563eb';
    
    try {
      const settings = await deepWorkStore.getSettings();
      const activityDetails = settings.activities.find(a => a.id === sessionData.activity);
      if (activityDetails) {
        activityName = activityDetails.name;
        activityColor = activityDetails.color;
      }
    } catch (error) {
      console.log("Could not get activity details:", error);
    }
    
    // Format the message based on pause state
    const statusMessage = sessionData.isPaused
      ? `PAUSED - ${timeString} remaining`
      : `${timeString} remaining`;
      
    // Progress indicator text (e.g., "25 of 45 minutes")
    const durationMinutes = Math.floor(totalDuration / 60000);
    const completedMinutes = Math.floor((totalDuration - timeRemaining) / 60000);
    const progressText = `${completedMinutes} of ${durationMinutes} minutes`;
    
    // Enhanced body text with visual progress bar
    const body = `${statusMessage}
${progressBar} ${progressPercentage}%
${progressText}`;
    
    // Create the notification actions based on current state
    const actions = [];
    
    // Only add actions on Android as iOS handles them differently
    if (Platform.OS === 'android') {
      actions.push(
        {
          identifier: 'PAUSE_RESUME',
          title: sessionData.isPaused ? '▶️ Resume' : '⏸️ Pause',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false
          }
        },
        {
          identifier: 'END_SESSION',
          title: '❌ End',
          options: {
            isDestructive: true,
            isAuthenticationRequired: false
          }
        }
      );
    }

    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Deep Work: ${activityName}`,
        body: body,
        data: { 
          screen: 'DeepWorkSession',
          sessionData: sessionData
        },
        color: activityColor,
        // Make the notification sticky and ongoing
        sticky: true,
        autoDismiss: false,
        // Progress indicator (works on Android)
        ...(Platform.OS === 'android' && {
          progress: {
            max: 100,
            current: progressPercentage,
            indeterminate: false
          }
        }),
        // Add the actions for pause/resume (Android)
        ...(actions.length > 0 && {
          categoryIdentifier: 'deepwork',
          actions: actions
        })
      },
      trigger: null
    });
  } catch (error) {
    console.error("Failed to update notification:", error);
  }
};

// Configure notifications system
export const configureNotifications = async () => {
  // Only set up categories on iOS - Android handles this differently
  if (Platform.OS === 'ios') {
    await Notifications.setNotificationCategoryAsync('deepwork', [
      {
        identifier: 'PAUSE_RESUME',
        buttonTitle: 'Pause/Resume',
        options: {
          isDestructive: false,
          isAuthenticationRequired: false
        }
      },
      {
        identifier: 'END_SESSION',
        buttonTitle: 'End Session',
        options: {
          isDestructive: true,
          isAuthenticationRequired: false
        }
      }
    ]);
  }

  // Configure notification handler
  await Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH
    }),
  });
};

// Handle notification action responses
export const setupNotificationActions = (navigation) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    try {
      // Get the action identifier
      const actionId = response.actionIdentifier;
      
      if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // Notification was tapped - navigate to the session screen
        const { screen, params } = response.notification.request.content.data;
        if (screen) {
          navigation.navigate(screen, params);
        }
      }
      else if (actionId === 'PAUSE_RESUME') {
        // Toggle pause state
        handlePauseResumeAction();
      }
      else if (actionId === 'END_SESSION') {
        // End session
        stopTimerNotification();
        navigation.navigate('MainApp', { screen: 'Home' });
      }
    } catch (error) {
      console.error("Error handling notification action:", error);
    }
  });
  
  return subscription;
};

// Handle pause/resume action from notification
const handlePauseResumeAction = async () => {
  try {
    const sessionData = await getActiveSessionFromStorage();
    
    if (!sessionData) return;
    
    if (sessionData.isPaused) {
      // Resume session
      await updateTimerPauseState(false);
    } else {
      // Pause session
      await updateTimerPauseState(true);
    }
  } catch (error) {
    console.error("Failed to handle pause/resume action:", error);
  }
};

// Start background timer and notification
export const startTimerNotification = async (duration, activity, musicChoice) => {
  try {
    // Configure notifications first
    await configureNotifications();
    
    // Register background task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TIMER_TASK, {
      minimumInterval: 15, // 15 seconds, minimum allowed by Expo
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    // Calculate duration in milliseconds
    const durationMs = parseInt(duration) * 60 * 1000;
    
    // Save session data
    await saveActiveSessionToStorage({
      startTime: Date.now(),
      duration: durationMs,
      activity,
      musicChoice,
      isPaused: false,
      pausedAt: null,
      remainingAtPause: null
    });
    
    // Create initial notification
    const sessionData = await getActiveSessionFromStorage();
    await updateTimerNotification(durationMs, sessionData);
    
    console.log("Background timer started successfully");
  } catch (error) {
    console.error("Failed to start timer notification:", error);
  }
};

// Stop background timer and notification
export const stopTimerNotification = async () => {
  try {
    // Unregister background task
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TIMER_TASK);
    
    // Clear active session data
    await clearActiveSession();
    
    // Dismiss all notifications
    await Notifications.dismissAllNotificationsAsync();
    
    console.log("Background timer stopped successfully");
  } catch (error) {
    console.error("Failed to stop timer notification:", error);
  }
};

// Update timer when paused/resumed
export const updateTimerPauseState = async (isPaused) => {
  try {
    const sessionData = await getActiveSessionFromStorage();
    if (!sessionData) return;
    
    if (isPaused) {
      // Calculate remaining time at moment of pause
      const timeRemaining = calculateRemainingTime(sessionData);
      
      // Save pause state
      await saveActiveSessionToStorage({
        ...sessionData,
        isPaused: true,
        pausedAt: Date.now(),
        remainingAtPause: timeRemaining
      });
      
      // Update notification to show paused state
      await updateTimerNotification(timeRemaining, {
        ...sessionData,
        isPaused: true,
        remainingAtPause: timeRemaining
      });
    } else {
      // Calculate new start time that accounts for pause duration
      let newStartTime;
      
      if (sessionData.pausedAt && sessionData.remainingAtPause) {
        // Adjust start time so that the remaining time is correct
        newStartTime = Date.now() - (sessionData.duration - sessionData.remainingAtPause);
      } else {
        // Fallback: just use current time
        newStartTime = Date.now();
      }
      
      const updatedSession = {
        ...sessionData,
        startTime: newStartTime,
        isPaused: false,
        pausedAt: null,
        remainingAtPause: null
      };
      
      await saveActiveSessionToStorage(updatedSession);
      
      // Update notification with current time
      const timeRemaining = calculateRemainingTime(updatedSession);
      await updateTimerNotification(timeRemaining, updatedSession);
    }
    
    console.log(`Timer ${isPaused ? 'paused' : 'resumed'} successfully`);
  } catch (error) {
    console.error("Failed to update pause state:", error);
  }
};

// Get the current session data
export const getCurrentSession = async () => {
  return await getActiveSessionFromStorage();
};

// Export all the functions needed by App.js
export default {
  startTimerNotification,
  stopTimerNotification,
  updateTimerPauseState,
  configureNotifications,
  setupNotificationActions,
  getCurrentSession,
  // Additional exports needed for App.js
  calculateRemainingTime,
  sendCompletionNotification,
  updateTimerNotification,
  clearActiveSession
};