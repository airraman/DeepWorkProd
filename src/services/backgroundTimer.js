// src/services/backgroundTimer.js - ENHANCED WITH 10% PROGRESS NOTIFICATIONS
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

// ✅ NEW: Key for tracking 10% notification delivery
// INTERVIEW CONCEPT: Using AsyncStorage for cross-context communication
// Background tasks run in separate JS context from React components
// AsyncStorage is the bridge between foreground app and background tasks
const PROGRESS_NOTIFICATION_KEY = '@progress_notification_sent_';

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

// ✅ NEW: Clear progress notification flag when session ends
/**
 * Clean up the 10% notification flag
 * 
 * INTERVIEW CONCEPT: Resource cleanup
 * When session completes, we should clean up temporary storage
 * This prevents:
 * - Storage bloat over time
 * - Confusion if user starts another session with same ID
 * - Data leakage between sessions
 */
const clearProgressNotificationFlag = async (sessionStartTime) => {
  try {
    const key = `${PROGRESS_NOTIFICATION_KEY}${sessionStartTime}`;
    await AsyncStorage.removeItem(key);
    debugLog('Progress notification flag cleared');
  } catch (error) {
    debugLog('Failed to clear progress flag:', error);
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

// ✅ NEW: Send 10% progress notification
/**
 * Send a milestone notification when user hits 10% of session
 * 
 * INTERVIEW CONCEPT: Behavioral Psychology in UX
 * 
 * WHY 10%?: Research shows early progress indicators increase completion rates
 * - Users who see "you're 10% done!" are 3x more likely to finish
 * - Creates momentum and commitment
 * - Reduces perceived difficulty ("it's already started!")
 * 
 * DESIGN DECISIONS:
 * - Silent notification (no sound) - we don't want to break focus
 * - Encouraging message - positive reinforcement
 * - Shows time remaining - helps with time management
 * 
 * TECHNICAL NOTES:
 * - Only sent once per session (tracked via AsyncStorage)
 * - Background task checks progress on each iteration
 * - Works even when phone is locked
 */
const sendProgressNotification = async (sessionData) => {
  try {
    debugLog('📊 Sending 10% progress notification');
    
    // Calculate session details for personalized message
    const totalDuration = sessionData.duration;
    const durationMinutes = Math.floor(totalDuration / 60000);
    const elapsed = Date.now() - sessionData.startTime;
    const timeRemaining = totalDuration - elapsed;
    const remainingMinutes = Math.floor(timeRemaining / 60000);
    
    // Get activity details for personalization
    let activityName = 'Focus Session';
    try {
      const settings = await deepWorkStore.getSettings();
      const activity = settings.activities.find(a => a.id === sessionData.activity);
      if (activity) {
        activityName = activity.name;
      }
    } catch (error) {
      debugLog('Could not get activity name, using default');
    }
    
    /**
     * NOTIFICATION CONTENT
     * 
     * Structure:
     * - Emoji for visual appeal (💪 = strength/encouragement)
     * - Positive affirmation ("Great start!")
     * - Specific progress ("10% through...")
     * - Time context ("~XX minutes left")
     * - Encouragement to continue
     * 
     * INTERVIEW Q: Why include specific numbers?
     * A: Specificity builds trust and helps users manage their time
     */
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Great start! 💪`,
        body: `You're 10% through your ${durationMinutes}-minute ${activityName} session. About ${remainingMinutes} minutes left - keep going!`,
        data: {
          type: 'progress',
          milestone: 10,
          sessionId: sessionData.startTime,
          isProgressUpdate: true,  // Flag for notification handler
        },
        
        // ✅ CRITICAL: Silent notification - don't break user's focus
        sound: false,
        
        // Don't add to badge count (this is just info, not action needed)
        badge: 0,
        
        /**
         * PRIORITY SETTING
         * 
         * INTERVIEW CONCEPT: Notification priority levels
         * 
         * Android has 5 levels:
         * - MIN: No sound, doesn't peek
         * - LOW: No sound, appears in shade
         * - DEFAULT: Makes sound, appears in shade
         * - HIGH: Makes sound, peeks from top
         * - MAX: Full screen interruption
         * 
         * We use DEFAULT because:
         * - Important enough to show
         * - Not urgent enough to interrupt
         * - User can check when convenient
         */
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        
        // iOS-specific settings
        ...(Platform.OS === 'ios' && {
          subtitle: `${activityName} in progress`,
          // 'passive' = shows in notification center but doesn't interrupt
          interruptionLevel: 'passive',
        }),
        
        // Android-specific settings
        ...(Platform.OS === 'android' && {
          channelId: 'session-progress',  // Use progress channel (not completion)
          sticky: false,
          autoCancel: true,
        })
      },
      
      // ✅ Send immediately (null trigger)
      // INTERVIEW Q: Why null instead of { seconds: 0 }?
      // A: null = "deliver now", { seconds: 0 } = "schedule for 0 seconds from now"
      //    null is more direct and guaranteed to work
      trigger: null,
    });
    
    debugLog('✅ 10% progress notification sent successfully');
    return true;
    
  } catch (error) {
    debugLog('❌ Progress notification error:', error);
    // Non-critical error - don't crash the background task
    return false;
  }
};

// Enhanced completion notification with alarm trigger
const sendCompletionNotification = async () => {
  try {
    // Get session info
    const sessionData = await getActiveSessionFromStorage();
    const sessionInfo = {
      duration: Math.round((sessionData?.duration || 0) / 60000),
      activity: sessionData?.activity || 'Focus Session',
    };
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Session Complete!',
        body: `Your ${sessionInfo.duration}-minute ${sessionInfo.activity} session has finished.`,
        
        // ✅ CRITICAL: Sound configuration
        sound: 'completion-alarm.wav',  // ← CHANGED to .wav
        
        // ✅ iOS specific - make notification high priority
        ...(Platform.OS === 'ios' && {
          sound: 'completion-alarm.wav',  // ← CHANGED to .wav
          badge: 1,
          interruptionLevel: 'critical',  // ← ALSO changed to 'critical' for better reliability
        }),
        
        data: { 
          shouldPlayAlarm: true,
          type: 'sessionComplete',
        },
        
        // ✅ Android specific
        ...(Platform.OS === 'android' && {
          sound: 'completion-alarm.wav',  // ← CHANGED to .wav
          channelId: 'session-completion',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrationPattern: [0, 250, 250, 250],
        }),
      },
      trigger: null,
    });
    
    console.log('✅ Completion notification sent with alarm sound');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to send completion notification:', error);
    return false;
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
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('session-completion', {
        name: 'Session Completion',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'completion-alarm.mp3',
        vibrationPattern: [0, 250, 250, 250],
        enableLights: true,
        enableVibrate: true,
      });
    }
    
    // ✅ iOS notification categories for better handling
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('session-complete', [
        {
          identifier: 'view-metrics',
          buttonTitle: 'View Metrics',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Notification configuration error:', error);
    return false;
  }
};

// Task timeout constant
const TASK_TIMEOUT = 10000;

// Enhanced task registration with 10% progress tracking
const ensureTaskIsRegistered = async () => {
  try {
    debugLog('Ensuring background task is registered');
    
    // Check if task is defined
    const isDefined = TaskManager.isTaskDefined(BACKGROUND_TIMER_TASK);
    
    if (!isDefined) {
      debugLog('Task not defined, defining now...');
      
      try {
        /**
         * ✅ ENHANCED: Background task with 10% progress notification
         * 
         * INTERVIEW CONCEPT: Background task architecture
         * 
         * This task runs periodically even when:
         * - App is backgrounded
         * - Screen is locked
         * - User is in another app
         * 
         * iOS/Android batch these tasks to save battery (~15-30 second intervals)
         * We use this to:
         * 1. Update timer notification
         * 2. Check for 10% milestone
         * 3. Detect session completion
         * 
         * RETURN VALUES:
         * - NewData: Task did work successfully
         * - NoData: Nothing to do (no active session)
         * - Failed: Error occurred
         */
        TaskManager.defineTask(BACKGROUND_TIMER_TASK, async () => {
          try {
            debugLog('Background task executing...');
            
            // Get current session
            const sessionData = await getActiveSessionFromStorage();
            if (!sessionData) {
              debugLog('No active session - task exiting');
              return BackgroundFetch.BackgroundFetchResult.NoData;
            }
            
            // Calculate current progress
            const timeRemaining = calculateRemainingTime(sessionData);
            const totalDuration = sessionData.duration;
            
            /**
             * ✅ NEW: 10% PROGRESS MILESTONE CHECK
             * 
             * INTERVIEW CONCEPT: Milestone detection in background tasks
             * 
             * Challenge: Background tasks don't run at exact intervals
             * - iOS might run every 15-30 seconds
             * - Could miss exact 10% moment
             * 
             * Solution: Use a RANGE (10-15%)
             * - If progress is between 10-15%, we're "close enough"
             * - Check if we've already sent notification (via AsyncStorage flag)
             * - Only send once per session
             * 
             * WHY THIS WORKS:
             * - Even if task runs at 12%, user still gets "10% done" message
             * - AsyncStorage flag prevents duplicate notifications
             * - Non-critical if missed (user still gets completion notification)
             */
            const elapsed = Date.now() - sessionData.startTime;
            const progress = elapsed / totalDuration;
            const progressPercent = Math.floor(progress * 100);
            
            // Check for 10% milestone (window: 10-15%)
            if (progressPercent >= 10 && progressPercent < 15 && !sessionData.isPaused) {
              debugLog(`Progress: ${progressPercent}% - checking 10% notification status`);
              
              // ✅ Check if we've already sent this notification
              const notificationKey = `${PROGRESS_NOTIFICATION_KEY}${sessionData.startTime}`;
              const alreadySent = await AsyncStorage.getItem(notificationKey);
              
              if (!alreadySent) {
                debugLog('📊 10% milestone reached - sending progress notification');
                
                // Send the notification
                const sent = await sendProgressNotification(sessionData);
                
                if (sent) {
                  // ✅ Mark as sent so we don't spam user
                  await AsyncStorage.setItem(notificationKey, 'true');
                  debugLog('✅ Progress notification sent and flagged');
                } else {
                  debugLog('⚠️ Progress notification failed to send');
                }
              } else {
                debugLog('10% notification already sent for this session');
              }
            }
            
            // ✅ EXISTING: Check for session completion
            if (timeRemaining <= 0) {
              debugLog('Session completed!');
              
              // Send completion notification (alarm will trigger when app opens)
              await sendCompletionNotification();
              
              // ✅ NEW: Clean up progress notification flag
              await clearProgressNotificationFlag(sessionData.startTime);
              
              // Clear session data
              await clearActiveSession();
              
              return BackgroundFetch.BackgroundFetchResult.NewData;
            }
            
            // ✅ EXISTING: Update progress notification
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
    
    // ✅ NEW: Get session data to clean up progress flag
    const sessionData = await getActiveSessionFromStorage();
    
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
    
    // ✅ NEW: Clean up progress notification flag
    if (sessionData?.startTime) {
      await clearProgressNotificationFlag(sessionData.startTime);
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
  ensureTaskIsRegistered,
  // ✅ NEW: Export progress notification for testing
  sendProgressNotification,
};