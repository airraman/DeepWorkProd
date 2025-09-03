// src/services/backgroundTimer.js - Complete iPad-Safe Version with Alarm Integration
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deepWorkStore } from './deepWorkStore';
import { alarmService } from './alarmService'; // NEW: Import alarm service
import { Platform } from 'react-native';

// Constants
const BACKGROUND_TIMER_TASK = 'com.expo.tasks.BACKGROUND_TIMER_TASK';
const ACTIVE_SESSION_KEY = '@active_deep_work_session';

// iPad detection
const isTablet = Platform.isPad || false;

// Enhanced logging for debugging iPad issues
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const deviceInfo = `[${Platform.OS}${isTablet ? '-iPad' : ''}]`;
  console.log(`${timestamp} ${deviceInfo} [BackgroundTimer] ${message}`, data || '');
};

// Helper functions with error handling
const saveActiveSessionToStorage = async (sessionData) => {
  try {
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
    debugLog('Session saved to storage');
  } catch (error) {
    debugLog('Failed to save session to storage:', error);
    throw error;
  }
};

const getActiveSessionFromStorage = async () => {
  try {
    const data = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    const result = data ? JSON.parse(data) : null;
    debugLog('Retrieved session from storage:', result ? 'Found' : 'None');
    return result;
  } catch (error) {
    debugLog('Failed to get session from storage:', error);
    return null;
  }
};

const clearActiveSession = async () => {
  try {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    debugLog('Active session cleared');
  } catch (error) {
    debugLog('Failed to clear active session:', error);
  }
};

// Generate text-based progress bar
const generateTextProgressBar = (percent, length = 10) => {
  try {
    const filledLength = Math.floor(length * (percent / 100));
    const emptyLength = length - filledLength;
    return '▓'.repeat(filledLength) + '░'.repeat(emptyLength);
  } catch (error) {
    debugLog('Progress bar generation error:', error);
    return '░'.repeat(length);
  }
};

// Calculate remaining time with error handling
const calculateRemainingTime = (sessionData) => {
  try {
    if (!sessionData) return 0;
    
    if (sessionData.isPaused) {
      return sessionData.remainingAtPause || 0;
    }
    
    const elapsed = Date.now() - sessionData.startTime;
    return Math.max(0, sessionData.duration - elapsed);
  } catch (error) {
    debugLog('Error calculating remaining time:', error);
    return 0;
  }
};

// NEW: Attempt to play alarm in background (limited success expected)
const attemptBackgroundAlarm = async () => {
  try {
    // Note: Background audio playback is very limited in React Native
    // This is more of a fallback attempt - the main alarm should happen 
    // when the user returns to the app
    
    debugLog('🔔 Attempting background alarm...');
    
    // Try to initialize and play alarm (this may not work on all platforms/scenarios)
    const alarmInitialized = await alarmService.init();
    if (!alarmInitialized) {
      debugLog('🔔 Background alarm initialization failed');
      return false;
    }
    
    const alarmPlayed = await alarmService.playCompletionAlarm({
      volume: 0.7, // Slightly lower volume for background
      autoStopAfter: 5 // Shorter duration for background (if it works)
    });
    
    if (alarmPlayed) {
      debugLog('🔔 Background alarm successfully started');
    } else {
      debugLog('🔔 Background alarm failed to start - will trigger when app opens');
    }
    
    return alarmPlayed;
  } catch (error) {
    debugLog('🔔 Background alarm error:', error);
    return false;
  }
};

// NEW: Enhanced completion notification with alarm-triggering data
const sendCompletionNotification = async () => {
  try {
    debugLog('🔔 Session completed in background - sending enhanced notification');
    
    // Get session data for more personalized notification
    let sessionInfo = { activity: 'Focus Session', duration: 'Unknown' };
    try {
      const sessionData = await getActiveSessionFromStorage();
      if (sessionData) {
        const settings = await deepWorkStore.getSettings();
        const activityDetails = settings.activities.find(a => a.id === sessionData.activity);
        
        sessionInfo = {
          activity: activityDetails ? activityDetails.name : 'Focus Session',
          duration: Math.floor(sessionData.duration / 60000), // Convert to minutes
          color: activityDetails ? activityDetails.color : '#4ADE80'
        };
      }
    } catch (error) {
      debugLog('Error getting session info for notification:', error);
    }
    
    // Schedule a prominent completion notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Deep Work Session Complete!',
        body: `Great job! Your ${sessionInfo.duration}-minute ${sessionInfo.activity} session has ended. Tap to see your progress.`,
        data: { 
          screen: 'MainApp', 
          params: { screen: 'Metrics' },
          // KEY: Add flag to trigger alarm when app opens
          shouldPlayAlarm: true,
          completedAt: new Date().toISOString(),
          sessionInfo: sessionInfo
        },
        sound: true, // Enable system notification sound
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // Make the notification more noticeable
        color: sessionInfo.color,
        // Add vibration pattern for Android (also works on some iOS versions)
        vibrationPattern: [0, 250, 250, 250],
        // iOS-specific enhancements
        ...(Platform.OS === 'ios' && {
          subtitle: `${sessionInfo.activity} • ${sessionInfo.duration} minutes`,
          badge: 1,
          // More prominent sound on iOS
          sound: 'default',
          critical: false, // Don't use critical unless you have special entitlements
        }),
        // Android-specific enhancements
        ...(Platform.OS === 'android' && {
          // Use high importance channel for better visibility
          channelId: 'session-completion',
          // Make it persistent until user interacts
          sticky: false, // Don't make it too annoying
          autoCancel: true,
          // LED and vibration
          lights: true,
          lightColor: sessionInfo.color,
        })
      },
      trigger: null,
    });
    
    debugLog('Enhanced completion notification sent successfully');
  } catch (error) {
    debugLog('Failed to send completion notification:', error);
  }
};

// Update timer notification with iPad optimizations
const updateTimerNotification = async (timeRemaining, sessionData) => {
  try {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const totalDuration = sessionData?.duration || 0;
    const progress = totalDuration > 0 ? Math.max(0, Math.min(1, (totalDuration - timeRemaining) / totalDuration)) : 0;
    const progressPercentage = Math.round(progress * 100);
    
    const progressBar = generateTextProgressBar(progressPercentage);
    
    // Get activity details safely
    let activityName = 'Focus Session';
    let activityColor = '#2563eb';
    
    try {
      const settings = await deepWorkStore.getSettings();
      const activityDetails = settings.activities.find(a => a.id === sessionData?.activity);
      if (activityDetails) {
        activityName = activityDetails.name;
        activityColor = activityDetails.color;
      }
    } catch (error) {
      debugLog('Could not get activity details:', error);
    }
    
    const statusMessage = sessionData?.isPaused
      ? `PAUSED - ${timeString} remaining`
      : `${timeString} remaining`;
      
    const durationMinutes = Math.floor(totalDuration / 60000);
    const completedMinutes = Math.floor((totalDuration - timeRemaining) / 60000);
    const progressText = `${completedMinutes} of ${durationMinutes} minutes`;
    
    const body = `${statusMessage}
${progressBar} ${progressPercentage}%
${progressText}`;
    
    // iPad-specific notification settings
    const notificationContent = {
      title: `Deep Work: ${activityName}`,
      body: body,
      data: { 
        screen: 'DeepWorkSession',
        sessionData: sessionData,
        isTimerUpdate: true // Flag to distinguish from completion notifications
      },
      color: activityColor,
      sticky: !isTablet, // Don't force sticky on iPad
      autoDismiss: isTablet, // Allow auto-dismiss on iPad
    };
    
    // Add progress indicator for Android and iPad differently
    if (Platform.OS === 'android' || isTablet) {
      notificationContent.progress = {
        max: 100,
        current: progressPercentage,
        indeterminate: false
      };
    }

    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: null
    });
    
    debugLog('Timer notification updated successfully');
  } catch (error) {
    debugLog('Failed to update notification:', error);
  }
};

// iPad-safe notification configuration - ENHANCED
const configureNotifications = async () => {
  try {
    debugLog('Configuring notifications system');
    
    // Create Android notification channels for better control
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('session-completion', {
        name: 'Session Completion',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ADE80',
        sound: 'default',
        description: 'Notifications for completed deep work sessions',
      });
      
      await Notifications.setNotificationChannelAsync('session-progress', {
        name: 'Session Progress',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 100],
        sound: false,
        description: 'Timer updates during active sessions',
      });
    }
    
    // iPad-specific notification categories with action buttons
    if (Platform.OS === 'ios') {
      const categories = [
        {
          identifier: 'TIMER_ACTIONS',
          actions: [
            {
              identifier: 'PAUSE_RESUME',
              buttonTitle: isTablet ? 'Toggle' : 'Pause/Resume',
              options: {
                opensApp: false,
                authenticationRequired: false,
                destructive: false
              }
            },
            {
              identifier: 'END_SESSION',
              buttonTitle: 'End Session',
              options: {
                opensApp: true,
                authenticationRequired: false,
                destructive: true
              }
            }
          ],
          intentIdentifiers: [],
          options: {
            categorySummaryFormat: 'Deep work session in progress'
          }
        },
        {
          identifier: 'COMPLETION_ACTIONS',
          actions: [
            {
              identifier: 'VIEW_PROGRESS',
              buttonTitle: 'View Progress',
              options: {
                opensApp: true,
                authenticationRequired: false,
                destructive: false
              }
            },
            {
              identifier: 'NEW_SESSION',
              buttonTitle: 'New Session',
              options: {
                opensApp: true,
                authenticationRequired: false,
                destructive: false
              }
            }
          ],
          intentIdentifiers: [],
          options: {
            categorySummaryFormat: 'Session completed successfully'
          }
        }
      ];
      
      await Promise.all(categories.map(category =>
        Notifications.setNotificationCategoryAsync(category.identifier, category)
      ));
      
      debugLog('iOS notification categories configured');
    }

    // Enhanced notification handler for iPad and alarm integration
    await Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isCompletion = notification.request.content.data?.shouldPlayAlarm;
        const isTimerUpdate = notification.request.content.data?.isTimerUpdate;
        
        return {
          shouldShowAlert: true,
          shouldPlaySound: isCompletion, // Only play system sound for completions
          shouldSetBadge: isCompletion,
          priority: isCompletion 
            ? Notifications.AndroidNotificationPriority.HIGH 
            : (isTablet ? Notifications.AndroidNotificationPriority.DEFAULT : Notifications.AndroidNotificationPriority.HIGH)
        };
      },
    });
    
    // Register background task after notifications are configured
    const taskRegistered = await ensureTaskIsRegistered();
    
    if (!taskRegistered) {
      debugLog('Warning: Background task registration failed');
      // Don't throw error - app should still work without background tasks
    }
    
    debugLog('Notification configuration completed');
    return taskRegistered;
  } catch (error) {
    debugLog('Notification configuration failed:', error);
    throw error;
  }
};

// iPad-safe task registration
const ensureTaskIsRegistered = async () => {
  try {
    debugLog('Starting task registration check');
    
    // Special handling for iPad
    if (isTablet) {
      debugLog('iPad detected - using conservative task registration');
    }
    
    // Check task definition with timeout
    let isTaskDefined = false;
    try {
      const taskCheckPromise = new Promise((resolve) => {
        resolve(TaskManager.isTaskDefined(BACKGROUND_TIMER_TASK));
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task check timeout')), 5000)
      );
      
      isTaskDefined = await Promise.race([taskCheckPromise, timeoutPromise]);
    } catch (error) {
      debugLog('Task definition check failed:', error);
      return false;
    }
    
    if (!isTaskDefined) {
      debugLog('Defining background task');
      
      try {
        TaskManager.defineTask(BACKGROUND_TIMER_TASK, async () => {
          try {
            debugLog('Background task executed');
            
            const sessionData = await getActiveSessionFromStorage();
            if (!sessionData) {
              debugLog('No active session found');
              return BackgroundFetch.BackgroundFetchResult.NoData;
            }
        
            // Don't update if paused
            if (sessionData.isPaused) {
              await updateTimerNotification(sessionData.remainingAtPause, sessionData);
              return BackgroundFetch.BackgroundFetchResult.NewData;
            }
        
            const timeRemaining = calculateRemainingTime(sessionData);
            
            if (timeRemaining <= 0) {
              debugLog('Session completed via background task');
              
              // NEW: Attempt to play background alarm (may not work on all platforms)
              const backgroundAlarmWorked = await attemptBackgroundAlarm();
              if (backgroundAlarmWorked) {
                debugLog('🔔 Background alarm successfully played');
              } else {
                debugLog('🔔 Background alarm failed - notification will trigger alarm when app opens');
              }
              
              // Send enhanced completion notification
              await sendCompletionNotification();
              
              // Clear session data
              await clearActiveSession();
              
              return BackgroundFetch.BackgroundFetchResult.NewData;
            }
            
            await updateTimerNotification(timeRemaining, sessionData);
            return BackgroundFetch.BackgroundFetchResult.NewData;
          } catch (error) {
            debugLog('Background task execution error:', error);
            return BackgroundFetch.BackgroundFetchResult.Failed;
          }
        });
        
        debugLog('Background task defined successfully');
      } catch (defineError) {
        debugLog('Failed to define background task:', defineError);
        return false;
      }
    }
    
    // Check registration status
    let isRegistered = false;
    try {
      const registrationCheckPromise = TaskManager.isTaskRegisteredAsync(BACKGROUND_TIMER_TASK);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Registration check timeout')), 5000)
      );
      
      isRegistered = await Promise.race([registrationCheckPromise, timeoutPromise]);
    } catch (error) {
      debugLog('Registration check failed:', error);
      return false;
    }
    
    if (!isRegistered) {
      debugLog('Registering background task');
      
      try {
        // iPad-specific registration settings
        const registrationOptions = {
          minimumInterval: isTablet ? 30 : 15, // Longer interval for iPad
          stopOnTerminate: false,
          startOnBoot: true,
        };
        
        const registrationPromise = BackgroundFetch.registerTaskAsync(BACKGROUND_TIMER_TASK, registrationOptions);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Registration timeout')), 10000)
        );
        
        await Promise.race([registrationPromise, timeoutPromise]);
        debugLog('Background task registered successfully');
      } catch (registerError) {
        debugLog('Failed to register background task:', registerError);
        return false;
      }
    }
    
    debugLog('Task registration completed successfully');
    return true;
  } catch (error) {
    debugLog('Task registration failed completely:', error);
    return false;
  }
};

// Start timer with iPad optimizations and alarm preparation
const startTimerNotification = async (duration, activity, musicChoice) => {
  try {
    debugLog('Starting timer notification', { duration, activity, musicChoice });
    
    // Configure notifications with timeout
    const configPromise = configureNotifications();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Configuration timeout')), isTablet ? 15000 : 10000)
    );
    
    try {
      await Promise.race([configPromise, timeoutPromise]);
    } catch (error) {
      debugLog('Configuration failed, continuing anyway:', error);
    }
    
    // NEW: Pre-initialize alarm service for faster response on completion
    try {
      debugLog('🔔 Pre-initializing alarm service for background completion...');
      const alarmReady = await alarmService.init();
      if (alarmReady) {
        debugLog('🔔 Alarm service ready for session completion');
      } else {
        debugLog('🔔 Alarm service initialization failed - will retry on completion');
      }
    } catch (error) {
      debugLog('🔔 Alarm pre-initialization error (non-critical):', error);
    }
    
    const durationMs = parseInt(duration) * 60 * 1000;
    
    const sessionData = {
      startTime: Date.now(),
      duration: durationMs,
      activity,
      musicChoice,
      isPaused: false,
      pausedAt: null,
      remainingAtPause: null
    };
    
    await saveActiveSessionToStorage(sessionData);
    await updateTimerNotification(durationMs, sessionData);
    
    debugLog('Timer notification started successfully');
  } catch (error) {
    debugLog('Failed to start timer notification:', error);
    throw error;
  }
};

// Safe stop function with alarm cleanup
const stopTimerNotification = async () => {
  try {
    debugLog('Stopping timer notification');
    
    // NEW: Clean up alarm service when stopping timer
    try {
      debugLog('🔔 Cleaning up alarm service...');
      await alarmService.cleanup();
    } catch (error) {
      debugLog('🔔 Alarm cleanup error (non-critical):', error);
    }
    
    // Try to unregister task with timeout
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TIMER_TASK);
      if (isRegistered) {
        const unregisterPromise = BackgroundFetch.unregisterTaskAsync(BACKGROUND_TIMER_TASK);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Unregister timeout')), 5000)
        );
        
        await Promise.race([unregisterPromise, timeoutPromise]);
        debugLog('Background task unregistered');
      }
    } catch (error) {
      debugLog('Task unregistration failed (non-critical):', error);
    }
    
    await clearActiveSession();
    await Notifications.dismissAllNotificationsAsync();
    
    debugLog('Timer notification stopped successfully');
  } catch (error) {
    debugLog('Error stopping timer notification:', error);
  }
};

// Update pause state with error handling
const updateTimerPauseState = async (isPaused) => {
  try {
    debugLog('Updating pause state:', isPaused);
    
    const sessionData = await getActiveSessionFromStorage();
    if (!sessionData) {
      debugLog('No session data found for pause update');
      return;
    }
    
    let updatedSession;
    
    if (isPaused) {
      const timeRemaining = calculateRemainingTime(sessionData);
      updatedSession = {
        ...sessionData,
        isPaused: true,
        pausedAt: Date.now(),
        remainingAtPause: timeRemaining
      };
      
      await updateTimerNotification(timeRemaining, updatedSession);
    } else {
      const newStartTime = sessionData.remainingAtPause 
        ? Date.now() - (sessionData.duration - sessionData.remainingAtPause)
        : Date.now();
      
      updatedSession = {
        ...sessionData,
        startTime: newStartTime,
        isPaused: false,
        pausedAt: null,
        remainingAtPause: null
      };
      
      const timeRemaining = calculateRemainingTime(updatedSession);
      await updateTimerNotification(timeRemaining, updatedSession);
    }
    
    await saveActiveSessionToStorage(updatedSession);
    debugLog(`Timer ${isPaused ? 'paused' : 'resumed'} successfully`);
  } catch (error) {
    debugLog('Failed to update pause state:', error);
  }
};

// Get current session safely
const getCurrentSession = async () => {
  try {
    return await getActiveSessionFromStorage();
  } catch (error) {
    debugLog('Failed to get current session:', error);
    return null;
  }
};

// Export all functions including new alarm-related ones
export default {
  startTimerNotification,
  stopTimerNotification,
  updateTimerPauseState,
  configureNotifications,
  getCurrentSession,
  calculateRemainingTime,
  sendCompletionNotification,
  updateTimerNotification,
  clearActiveSession,
  ensureTaskIsRegistered,
  // NEW: Export alarm-related functions
  attemptBackgroundAlarm
};