// src/services/notificationBackgroundTask.js
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { notificationService } from './notificationService';

// ✅ CRITICAL: Task name must be unique across app
const NOTIFICATION_REFRESH_TASK = 'notification-refresh-task';

/**
 * BACKGROUND TASK DEFINITION
 * 
 * INTERVIEW CONCEPT: Background Tasks in React Native
 * - Run even when app is closed/force-quit
 * - iOS wakes app periodically to execute
 * - Limited execution time (~30 seconds)
 * - Must be lightweight and efficient
 * 
 * This task re-schedules notifications to keep them fresh
 */
TaskManager.defineTask(NOTIFICATION_REFRESH_TASK, async () => {
  try {
    const now = new Date();
    console.log(`🔄 [${now.toISOString()}] Background task: Refreshing notifications...`);
    
    // Check if user has notifications enabled
    const enabled = await notificationService.areNotificationsEnabled();
    
    if (!enabled) {
      console.log('⏭️  Notifications disabled, skipping refresh');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    // Re-schedule all notifications
    // This is the KEY action that keeps notifications working
    await notificationService.scheduleNotifications();
    
    console.log('✅ Background task: Notifications refreshed successfully');
    
    // Tell iOS we fetched new data
    return BackgroundFetch.BackgroundFetchResult.NewData;
    
  } catch (error) {
    console.error('❌ Background task error:', error);
    
    // Tell iOS the task failed
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * BACKGROUND TASK MANAGER
 * 
 * Handles registration, unregistration, and status of the background task
 */
export const notificationBackgroundTask = {
  
  /**
   * Register the background task
   * 
   * WHEN TO CALL: 
   * - App startup (if notifications are enabled)
   * - When user enables notifications
   */
  async register() {
    try {
      console.log('📝 Registering notification background task...');
      
      // Check if already registered (prevent duplicates)
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        NOTIFICATION_REFRESH_TASK
      );
      
      if (isRegistered) {
        console.log('✅ Task already registered, skipping');
        return true;
      }
      
      // Register the task with iOS
      await BackgroundFetch.registerTaskAsync(NOTIFICATION_REFRESH_TASK, {
        // How often iOS should run this task (minimum 12 hours)
        minimumInterval: 60 * 60 * 12, // 12 hours in seconds
        
        // Continue running even if app is terminated
        stopOnTerminate: false,
        
        // Start task after device reboots
        startOnBoot: true,
      });
      
      console.log('✅ Background task registered successfully');
      console.log('   - Will run every ~12 hours');
      console.log('   - Continues after force quit');
      console.log('   - Starts after device restart');
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to register background task:', error);
      return false;
    }
  },
  
  /**
   * Unregister the background task
   * 
   * WHEN TO CALL:
   * - When user disables notifications
   * - When cleaning up on app uninstall
   */
  async unregister() {
    try {
      console.log('🗑️  Unregistering background task...');
      
      await BackgroundFetch.unregisterTaskAsync(NOTIFICATION_REFRESH_TASK);
      
      console.log('✅ Background task unregistered');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to unregister task:', error);
      return false;
    }
  },
  
  /**
   * Get task status (for debugging)
   * 
   * WHEN TO USE:
   * - Debugging notification issues
   * - Showing user if background refresh is working
   * - TestFlight testing
   */
  async getStatus() {
    try {
      // Check if task is registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        NOTIFICATION_REFRESH_TASK
      );
      
      // Check if background fetch is available on device
      const status = await BackgroundFetch.getStatusAsync();
      
      const statusText = 
        status === BackgroundFetch.BackgroundFetchStatus.Available 
          ? 'available' 
          : status === BackgroundFetch.BackgroundFetchStatus.Denied
          ? 'denied'
          : 'restricted';
      
      console.log('📊 Background Task Status:');
      console.log('   - Registered:', isRegistered);
      console.log('   - Status:', statusText);
      
      return {
        isRegistered,
        status: statusText,
        isWorking: isRegistered && status === BackgroundFetch.BackgroundFetchStatus.Available
      };
      
    } catch (error) {
      console.error('❌ Failed to get task status:', error);
      return {
        isRegistered: false,
        status: 'error',
        isWorking: false
      };
    }
  },
};