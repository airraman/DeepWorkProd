// src/services/alarmService.js - Full Implementation with Audio + Vibration
import { Audio } from 'expo-av';
import { Platform, Alert, Vibration } from 'react-native';

console.log('🔔 Loading alarm service with audio support...');

/**
 * AlarmService handles completion alarms when sessions finish
 * 
 * Key Differences from AudioService:
 * 1. Plays ONE-SHOT sounds (not looping)
 * 2. Combines audio with vibration for stronger notification
 * 3. Has visual fallback (Alert) if audio fails
 * 4. Auto-stops after a set duration
 * 
 * INTERVIEW CONCEPT: Why separate alarm from background music?
 * - Different use cases (one-shot vs continuous)
 * - Different volume expectations (alarm should be louder)
 * - Different error handling (alarm failure needs immediate fallback)
 */
class AlarmService {
  constructor() {
    // Track the alarm sound object
    this.alarmSound = null;
    
    // Track initialization state
    this.isInitialized = false;
    
    // Track if alarm is currently playing
    this.isPlaying = false;
    
    // Track auto-stop timer
    this.autoStopTimer = null;
    
    console.log('🔔 Alarm service instance created');
  }

  /**
   * Initialize the alarm service
   * 
   * IMPORTANT: We initialize the audio system similar to audioService,
   * but with settings optimized for SHORT, LOUD alerts
   */
  async init() {
    try {
      console.log('🔔 Initializing alarm service...');
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        
        // ✅ NEW: Proper interruption mode for alarm sounds
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        
        allowsRecordingIOS: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      this.isInitialized = true;
      console.log('🔔 Alarm service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('🔔 Alarm initialization error:', error);
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Play the completion alarm
   * 
   * This is the MAIN function called when a session completes
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.volume - Volume level 0.0 to 1.0 (default 0.8)
   * @param {number} options.autoStopAfter - Seconds until auto-stop (default 10)
   * 
   * FLOW:
   * 1. Initialize if needed
   * 2. Play audio file
   * 3. Trigger vibration
   * 4. Show visual celebration
   * 5. Auto-stop after duration
   * 6. If audio fails, show fallback alert
   * 
   * INTERVIEW CONCEPT: Layered feedback (audio + haptic + visual)
   * Mobile UX best practice: Use multiple feedback types for important events
   */
  async playCompletionAlarm(options = {}) {
    try {
      console.log('🔔 Playing completion alarm...');
      
      // Default options
      const volume = options.volume || 0.8;
      const autoStopAfter = options.autoStopAfter || 10;
      
      // Initialize if not already done
      if (!this.isInitialized) {
        console.log('🔔 Service not initialized, initializing now...');
        await this.init();
      }
      
      // Stop any existing alarm first
      await this.stopAlarm();
      
      /**
       * AUDIO PLAYBACK (with fallback if file missing)
       * 
       * INTERVIEW Q: Why try-catch around audio loading?
       * A: The audio file might not exist (as in this case)
       *    We gracefully degrade to vibration + visual only
       */
      try {
        console.log('🔔 Loading completion alarm audio...');
        
        const { sound } = await Audio.Sound.createAsync(
          // Use require() to bundle the asset at compile time
          require('../../assets/alarm.mp3'),
          {
            // Start playing immediately
            shouldPlay: true,
            
            // DON'T loop - this is a one-shot alarm
            isLooping: false,
            
            // Higher volume for alarms (user configurable)
            volume: volume,
          },
          // Status callback to track completion/errors
          this.onPlaybackStatusUpdate
        );
        
        // Store reference so we can stop it
        this.alarmSound = sound;
        this.isPlaying = true;
        
        console.log('🔔 Alarm audio playing');
      } catch (audioError) {
        console.log('🔔 Audio file not found, using vibration + visual only:', audioError.message);
        // Continue without audio - vibration and visual alert still work
      }
      
      /**
       * VIBRATION
       * 
       * INTERVIEW CONCEPT: Haptic Feedback
       * - Provides tactile confirmation without requiring user to look at screen
       * - Pattern: [wait, vibrate, wait, vibrate, ...]
       * - Times in milliseconds
       * 
       * SIMULATOR NOTE: This won't work in simulator (no haptic hardware)
       * But it will work perfectly on real devices!
       */
      this.triggerVibration();
      
      /**
       * VISUAL CELEBRATION
       * 
       * INTERVIEW Q: Why show an alert if we have audio/vibration?
       * A: Redundancy for accessibility:
       *    - User might have volume off
       *    - User might be deaf/hard of hearing
       *    - Device might not support vibration
       *    Always provide visual feedback!
       */
      setTimeout(() => {
        this.showCelebrationAlert(options);
      }, 200); // Slight delay so audio/vibration start first
      
      /**
       * AUTO-STOP TIMER
       * 
       * INTERVIEW CONCEPT: Resource cleanup with timers
       * - We don't want alarm playing forever (bad UX + wastes battery)
       * - setTimeout creates a cleanup timer
       * - Store timer ID so we can cancel if user manually stops
       */
      this.autoStopTimer = setTimeout(() => {
        console.log('🔔 Auto-stopping alarm after timeout');
        this.stopAlarm();
      }, autoStopAfter * 1000);
      
      console.log('🔔 Completion alarm playing successfully');
      return true;
      
    } catch (error) {
      console.error('🔔 Error playing completion alarm:', error);
      
      /**
       * FALLBACK HANDLING
       * 
       * INTERVIEW CONCEPT: Graceful degradation
       * - If audio fails (permissions, file missing, etc.), don't crash
       * - Fall back to visual-only notification
       * - User still knows their session completed
       */
      console.log('🔔 Falling back to visual-only alert');
      this.showFallbackAlert();
      
      return false;
    }
  }

  /**
   * Trigger device vibration
   * 
   * VIBRATION PATTERNS:
   * Array of times [wait, vibrate, wait, vibrate, ...]
   * Times in milliseconds
   * 
   * Pattern explanation:
   * [0, 400, 200, 400, 200, 600]
   * - 0ms wait (start immediately)
   * - 400ms vibrate (strong pulse)
   * - 200ms wait (short pause)
   * - 400ms vibrate (strong pulse)
   * - 200ms wait (short pause)
   * - 600ms vibrate (long finish)
   * 
   * Result: "buzz-buzz-BUZZ" pattern that feels celebratory!
   * 
   * INTERVIEW CONCEPT: Haptic Design
   * Different patterns convey different meanings:
   * - Short single buzz: notification
   * - Double buzz: warning
   * - Triple buzz with crescendo: success/celebration
   */
  triggerVibration() {
    try {
      /**
       * SIMULATOR DETECTION
       * 
       * INTERVIEW Q: Why check __DEV__ and Platform.OS?
       * A: 
       * - __DEV__ = true when running in development mode
       * - iOS simulator doesn't have haptic hardware
       * - Calling Vibration.vibrate() in simulator logs warnings
       * 
       * We skip vibration in iOS simulator but:
       * - Log that it would happen (for debugging)
       * - Still works on real iOS devices
       * - Works in Android emulator (it simulates vibration)
       */
      if (__DEV__ && Platform.OS === 'ios') {
        console.log('🔔 iOS Simulator detected - vibration skipped (will work on real device)');
        return;
      }
      
      // Pattern: buzz-buzz-BUZZ (celebratory!)
      Vibration.vibrate([0, 400, 200, 400, 200, 600]);
      console.log('🔔 Vibration triggered');
      
    } catch (error) {
      // Vibration can fail on some devices (permissions, hardware)
      // This is non-critical - just log and continue
      console.log('🔔 Vibration failed (non-critical):', error.message);
    }
  }

  /**
   * Callback for audio playback status updates
   * 
   * INTERVIEW CONCEPT: Event-driven programming
   * - This function is called by expo-av whenever playback state changes
   * - We use it to detect errors and completion
   * - Arrow function preserves 'this' context
   */
  onPlaybackStatusUpdate = (status) => {
    try {
      // Handle playback errors
      if (status.error) {
        console.error('🔔 Alarm playback error:', status.error);
        this.stopAlarm();
        this.showFallbackAlert();
      }
      
      // Alarm finished playing naturally (reached end of audio file)
      if (status.didJustFinish) {
        console.log('🔔 Alarm finished playing');
        this.isPlaying = false;
        // Auto-cleanup after finish
        setTimeout(() => this.stopAlarm(), 1000);
      }
      
    } catch (error) {
      console.error('🔔 Status update error:', error);
    }
  };

  /**
   * Show celebration alert with random messages
   * 
   * INTERVIEW CONCEPT: User engagement through variety
   * - Randomized messages prevent habituation
   * - Users don't tune out repeated messages
   * - Keeps the experience fresh
   */
  showCelebrationAlert(options = {}) {
    try {
      // Array of celebration titles
      const celebrations = [
        '🎉 Outstanding Work!',
        '🌟 Session Complete!',
        '🎯 Focus Achieved!',
        '💪 Well Done!',
        '🏆 Success!',
        '✨ Brilliant!',
        '🚀 Crushing It!',
      ];
      
      // Array of encouraging messages
      const messages = [
        'You just completed a deep work session! Your dedication is building powerful focus habits.',
        'Another successful session completed! You\'re making real progress toward your goals.',
        'Excellent concentration! You\'re developing the discipline that leads to breakthrough results.',
        'Session finished! Take a moment to appreciate this accomplishment.',
        'Outstanding focus! You\'re proving that deep work creates extraordinary outcomes.',
        'Your commitment to deep work is inspiring! Keep up the amazing progress.',
        'Session complete! Each focused hour compounds into remarkable achievements.',
      ];
      
      // Pick random title and message
      // INTERVIEW Q: Why Math.floor(Math.random() * array.length)?
      // A: Math.random() gives 0 to 0.999...
      //    Multiply by length gives 0 to (length - 0.001)
      //    Math.floor rounds down to valid index
      const randomTitle = celebrations[Math.floor(Math.random() * celebrations.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      /**
       * Alert API
       * 
       * INTERVIEW CONCEPT: Native UI vs Custom UI
       * Alert.alert uses NATIVE OS dialogs:
       * - iOS: UIAlertController (iOS-style popup)
       * - Android: AlertDialog (Material Design)
       * 
       * Pros: Familiar to users, accessible, system-handled
       * Cons: Limited customization, blocking (modal)
       */
      Alert.alert(
        randomTitle,
        randomMessage,
        [
          {
            text: 'View Progress',
            style: 'default',
            onPress: () => {
              console.log('🔔 User wants to view progress');
              this.stopAlarm();
              // Navigation handled by DeepWorkSession
            }
          },
          {
            text: 'Another Session',
            style: 'default',
            onPress: () => {
              console.log('🔔 User wants another session');
              this.stopAlarm();
              // Navigation handled by DeepWorkSession
            }
          }
        ],
        { 
          // Allow dismissing by tapping outside
          cancelable: true,
          // Clean up when dismissed
          onDismiss: () => {
            this.stopAlarm();
          }
        }
      );
      
    } catch (error) {
      console.error('🔔 Celebration alert error:', error);
      // Ultimate fallback - simple alert
      Alert.alert('🎉 Session Complete!', 'Excellent work on your deep work session!');
    }
  }

  /**
   * Fallback alert when audio fails
   * 
   * Simpler message, no buttons, just acknowledgment
   */
  showFallbackAlert() {
    try {
      Alert.alert(
        '🎉 Session Complete!',
        'Congratulations! Your deep work session has finished.',
        [{ text: 'Awesome!', style: 'default' }]
      );
    } catch (error) {
      console.error('🔔 Fallback alert error:', error);
    }
  }

  /**
   * Stop the alarm
   * 
   * CRITICAL for resource management
   * 
   * Called when:
   * - User dismisses celebration alert
   * - Auto-stop timer triggers
   * - New alarm needs to play
   * - Session cleanup
   */
  async stopAlarm() {
    try {
      // Cancel auto-stop timer if it exists
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }
      
      // Stop vibration (in case it's still going)
      Vibration.cancel();
      
      // Stop and unload audio
      if (this.alarmSound) {
        console.log('🔔 Stopping alarm audio...');
        
        /**
         * INTERVIEW CONCEPT: Why try-catch inside try-catch?
         * A: The sound might already be unloaded or in a bad state
         *    We want to ensure cleanup happens even if stop/unload fails
         */
        try {
          await this.alarmSound.stopAsync();
          await this.alarmSound.unloadAsync();
        } catch (unloadError) {
          console.log('🔔 Error unloading alarm (may already be unloaded):', unloadError.message);
        }
        
        this.alarmSound = null;
        console.log('🔔 Alarm audio stopped and unloaded');
      }
      
      this.isPlaying = false;
      console.log('🔔 Alarm stopped');
      
    } catch (error) {
      console.error('🔔 Error stopping alarm:', error);
      // Force cleanup even on error
      this.alarmSound = null;
      this.isPlaying = false;
      this.autoStopTimer = null;
    }
  }

  /**
   * Test the alarm (for settings screen)
   * 
   * Plays a shorter version for testing
   * User can verify volume/vibration before actual sessions
   */
  async testAlarm() {
    console.log('🔔 Testing alarm...');
    return await this.playCompletionAlarm({
      volume: 0.6, // Slightly quieter for testing
      autoStopAfter: 3 // Shorter duration
    });
  }

  /**
   * Clean up all resources
   * 
   * Called when:
   * - App is shutting down
   * - Service needs to be reinitialized
   * - Session screen unmounts
   */
  async cleanup() {
    try {
      console.log('🔔 Cleaning up alarm service...');
      await this.stopAlarm();
      console.log('🔔 Alarm service cleaned up');
    } catch (error) {
      console.error('🔔 Cleanup error:', error);
    }
  }

  /**
   * Get current service status
   * 
   * Useful for debugging and UI state
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      hasAlarmSound: !!this.alarmSound,
      platform: Platform.OS,
      isDev: __DEV__
    };
  }
}

/**
 * SINGLETON EXPORT
 * 
 * Same pattern as audioService
 * One instance for the entire app
 */
export const alarmService = new AlarmService();

console.log('🔔 Alarm service exported successfully');