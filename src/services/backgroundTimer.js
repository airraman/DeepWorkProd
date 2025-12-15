// src/services/backgroundTimer.js - FIXED VERSION (iOS Categories Removed)
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deepWorkStore } from './deepWorkStore';
import { alarmService } from './alarmService';
import { Platform } from 'react-native';

// Constants
const BACKGROUND_TIMER_TASK = 'com.expo.tasks.BACKGROUND_TIMER_TASK';
const ACTIVE_SESSION_KEY = '@active_deep_work_session';

// iPad detection
const isTablet = Platform.isPad || false;

// Enhanced logging for debugging
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

// Enhanced completion notification with alarm trigger
// Enhanced completion notification with alarm trigger
const sendCompletionNotification = async () => {
  try {
    debugLog('Session completed - sending notification with SOUND');
    
    // ✅ CRITICAL FIX: Set notification handler RIGHT BEFORE sending
    // This ensures the handler is active when the notification arrives
    /**
     * WHY THIS IS HERE:
     * - Notification handlers can be overridden by other parts of the app
     * - By setting it immediately before sending, we guarantee it's active
     * - This is especially important for FOREGROUND notifications
     * 
     * INTERVIEW CONCEPT: Timing matters in mobile notifications
     * - iOS/Android check the handler when notification is RECEIVED, not sent
     * - Setting handler during app init might not persist until session ends
     * - This pattern ensures consistent behavior
     */
    await Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        try {
          // Check if this is a completion notification (has alarm data)
          const isCompletion = notification.request.content.data?.shouldPlayAlarm;
          const isTimerUpdate = notification.request.content.data?.isTimerUpdate;
          
          /**
           * PRESENTATION CONFIGURATION
           * 
           * shouldShowAlert: Controls if notification shows as banner/popup
           * - TRUE = Shows even when app is in foreground ✅
           * - FALSE = Only shows when app is backgrounded
           * 
           * shouldPlaySound: Controls if notification plays sound
           * - TRUE for completion notifications (important!)
           * - FALSE for timer updates (would be annoying every second)
           * 
           * shouldSetBadge: Controls app icon badge number (iOS)
           * - TRUE for completion (user should see they finished)
           * - FALSE for updates (don't clutter badge)
           * 
           * INTERVIEW Q: Why return different values for different notification types?
           * A: User experience! Completion is important (loud), updates are info (quiet)
           */
          return {
            shouldShowAlert: true,        // ✅ ALWAYS show, even in foreground
            shouldPlaySound: isCompletion, // ✅ Only sound for completion
            shouldSetBadge: isCompletion,  // ✅ Only badge for completion
            
            // Priority affects Android notification behavior
            priority: isCompletion 
              ? Notifications.AndroidNotificationPriority.MAX      // Completion: MAX priority
              : (isTablet 
                  ? Notifications.AndroidNotificationPriority.DEFAULT  // iPad updates: normal
                  : Notifications.AndroidNotificationPriority.HIGH)   // Phone updates: high
          };
        } catch (handlerError) {
          // If handler logic fails, use safe defaults
          debugLog('Notification handler error:', handlerError);
          return {
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false
          };
        }
      },
    });
    
    debugLog('✅ Notification handler configured for completion notification');
    
    // Get session data for personalized notification
    let sessionInfo = { 
      activity: 'Focus Session', 
      duration: 'Unknown',
      color: '#4ADE80'
    };
    
    try {
      const sessionData = await getActiveSessionFromStorage();
      if (sessionData) {
        const settings = await deepWorkStore.getSettings();
        const activityDetails = settings.activities.find(a => a.id === sessionData.activity);
        
        if (activityDetails) {
          sessionInfo = {
            activity: activityDetails.name,
            duration: Math.floor(sessionData.duration / 60000),
            color: activityDetails.color
          };
        } else {
          // Fallback if activity not found
          sessionInfo.duration = Math.floor(sessionData.duration / 60000);
        }
      }
    } catch (error) {
      debugLog('Error getting session info for notification:', error);
      // Continue with default sessionInfo
    }
    
    /**
     * NOTIFICATION CONTENT CONSTRUCTION
     * 
     * This is the actual notification that will appear on the user's screen
     * Key components:
     * - title: Main heading
     * - body: Detailed message
     * - data: Metadata for app to handle notification tap
     * - sound: Enable/disable audio
     * - Platform-specific enhancements (iOS vs Android)
     */
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Deep Work Session Complete!',
        body: `Congratulations! Your ${sessionInfo.duration}-minute ${sessionInfo.activity} session has finished.`,
        sound: 'default',  // ✅ EXPLICIT

        /**
         * DATA PAYLOAD
         * 
         * INTERVIEW CONCEPT: Notification data vs content
         * - content: What the USER sees (title, body)
         * - data: What the APP sees when notification is tapped
         * 
         * This data is available in App.js notification listener
         * Used to trigger alarm, navigate to screens, etc.
         */
        data: { 
          screen: 'MainApp',              // Where to navigate on tap
          params: { screen: 'Metrics' },  // Sub-navigation
          shouldPlayAlarm: true,           // ✅ Trigger alarm service
          completedAt: new Date().toISOString(),
          sessionInfo: sessionInfo,
          alarmSettings: {
            volume: 0.8,
            autoStopAfter: 10
          }
        },
        
        // ✅ CRITICAL: Enable sound for this notification
        sound: true,
        
        // Set high priority for Android
        priority: Notifications.AndroidNotificationPriority.MAX,
        
        /**
         * iOS-SPECIFIC ENHANCEMENTS
         * 
         * INTERVIEW CONCEPT: Platform-specific notification features
         * iOS has unique notification properties that Android doesn't have:
         * - subtitle: Secondary text under title
         * - badge: Red number on app icon
         * - interruptionLevel: How aggressively notification interrupts user
         * - relevanceScore: Helps iOS decide which notifications to show first
         */
        ...(Platform.OS === 'ios' && {
          subtitle: `${sessionInfo.activity} completed!`,
          badge: 1,  // Show "1" on app icon
          sound: 'default',  // Use system notification sound
          
          /**
           * INTERRUPTION LEVEL
           * 
           * Options:
           * - passive: Silent, only in notification center
           * - active: Standard notification
           * - timeSensitive: Breaks through Focus modes ✅
           * - critical: Even breaks Do Not Disturb (requires special permission)
           * 
           * We use 'active' here (you had this originally)
           * Consider 'timeSensitive' if users complain about missing notifications
           */
          interruptionLevel: 'active',
          relevanceScore: 1.0,  // Highest relevance (0.0 to 1.0)
        }),
        
        /**
         * ANDROID-SPECIFIC ENHANCEMENTS
         * 
         * INTERVIEW CONCEPT: Android notification channels
         * Android 8.0+ requires channels - categories for notifications
         * Each channel has its own settings (sound, vibration, importance)
         * 
         * 'session-completion' channel was created in configureNotifications()
         */
        ...(Platform.OS === 'android' && {
          channelId: 'session-completion',  // References channel we created
          sticky: false,        // User can swipe away
          autoCancel: true,     // Dismiss when tapped
          lights: true,         // LED notification light (if device has one)
          lightColor: sessionInfo.color,  // Match activity color
          vibrationPattern: [0, 500, 200, 500],  // Custom vibration pattern
          importance: Notifications.AndroidImportance.HIGH,
        })
      },
      
      /**
       * TRIGGER
       * 
       * INTERVIEW Q: Why is trigger set to null?
       * A: null = "show immediately"
       * 
       * Other trigger options:
       * - { seconds: 10 } = show after 10 seconds
       * - { date: new Date() } = show at specific time
       * - { channelId: 'X' } = recurring notification
       * 
       * We want immediate notification when session completes
       */
      trigger: null,
    });
    
    debugLog('✅ Enhanced completion notification sent successfully');
    
  } catch (error) {
    debugLog('❌ Failed to send completion notification:', error);
    
    /**
     * ERROR HANDLING
     * 
     * INTERVIEW CONCEPT: Graceful degradation
     * Even if notification fails (permissions denied, system error, etc.):
     * - Don't crash the app
     * - Log for debugging
     * - The alarm service in handleTimeout() will still provide feedback
     * 
     * Multiple feedback layers ensure user always knows session completed
     */
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
        isTimerUpdate: true
      },
      color: activityColor,
      sticky: !isTablet,
      autoDismiss: isTablet,
    };
    
    // Add progress indicator for Android and iPad
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

// FIXED: Safe notification configuration (iOS categories removed)
const configureNotifications = async () => {
  try {
    debugLog('Configuring notifications system');
    
    // Create Android notification channels ONLY
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
      
      debugLog('Android notification channels configured');
    }
    
    // FIXED: Skip iOS notification categories entirely to prevent JSI crash
    if (Platform.OS === 'ios') {
      debugLog('iOS notification categories disabled for stability');
      // Categories will be implemented in a future update with proper type validation
    }

    // Set notification handler with safe defaults
    try {
      await Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          try {
            const isCompletion = notification.request.content.data?.shouldPlayAlarm;
            const isTimerUpdate = notification.request.content.data?.isTimerUpdate;
            
            return {
              shouldShowAlert: true,
              shouldPlaySound: isCompletion,
              shouldSetBadge: isCompletion,
              priority: isCompletion 
                ? Notifications.AndroidNotificationPriority.HIGH 
                : (isTablet ? Notifications.AndroidNotificationPriority.DEFAULT : Notifications.AndroidNotificationPriority.HIGH)
            };
          } catch (handlerError) {
            debugLog('Notification handler error:', handlerError);
            return {
              shouldShowAlert: true,
              shouldPlaySound: false,
              shouldSetBadge: false
            };
          }
        },
      });
    } catch (handlerError) {
      debugLog('Failed to set notification handler:', handlerError);
    }
    
    // Register background task
    let taskRegistered = false;
    try {
      taskRegistered = await ensureTaskIsRegistered();
    } catch (taskError) {
      debugLog('Background task registration failed (non-critical):', taskError);
    }
    
    debugLog('Notification configuration completed', { taskRegistered });
    return true;
  } catch (error) {
    debugLog('Notification configuration failed:', error);
    return true; // Don't block app startup
  }
};

// Safe task registration
const ensureTaskIsRegistered = async () => {
  try {
    debugLog('Starting task registration check');
    
    if (isTablet) {
      debugLog('iPad detected - using conservative task registration');
    }
    
    const TASK_TIMEOUT = 10000;
    
    // Check if task is already defined
    let isTaskDefined = false;
    try {
      const taskCheckPromise = TaskManager.isTaskDefined(BACKGROUND_TIMER_TASK);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task check timeout')), TASK_TIMEOUT)
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
        
            // Handle paused sessions
            if (sessionData.isPaused) {
              await updateTimerNotification(sessionData.remainingAtPause, sessionData);
              return BackgroundFetch.BackgroundFetchResult.NewData;
            }
        
            const timeRemaining = calculateRemainingTime(sessionData);
            
            if (timeRemaining <= 0) {
              debugLog('Session completed via background task');
              
              // Send completion notification (alarm will trigger when app opens)
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
      const registrationPromise = TaskManager.isTaskRegisteredAsync(BACKGROUND_TIMER_TASK);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Registration check timeout')), TASK_TIMEOUT)
      );
      
      isRegistered = await Promise.race([registrationPromise, timeoutPromise]);
    } catch (error) {
      debugLog('Registration check failed:', error);
      return false;
    }
    
    if (!isRegistered) {
      debugLog('Registering background task');
      
      try {
        const registrationOptions = {
          minimumInterval: isTablet ? 30 : 15,
          stopOnTerminate: false,
          startOnBoot: true,
        };
        
        const registrationPromise = BackgroundFetch.registerTaskAsync(
          BACKGROUND_TIMER_TASK, 
          registrationOptions
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Registration timeout')), TASK_TIMEOUT)
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

// Start timer with alarm preparation
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
    
    // Pre-initialize alarm service for faster response
    try {
      debugLog('🔔 Pre-initializing alarm service...');
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
    
    // Clean up alarm service
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

// Update pause state
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

// Export all functions
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
  ensureTaskIsRegistered
};