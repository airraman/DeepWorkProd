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
        categoryIOS: Audio.AUDIO_SESSION_CATEGORY_PLAYBACK,
        // ✅ FIXED: Use proper Expo Audio constants for interruption mode
        // DO_NOT_MIX means alarm will play at full volume (better for alerts)
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        
        allowsRecordingIOS: false,
        
        // ✅ FIXED: Changed from true to false
        // Alarms should play at full volume, not ducked
        shouldDuckAndroid: false,
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
          require('../../assets/sounds/completion-alarm.mp3'),
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
      this.showCelebration();
      
      /**
       * AUTO-STOP TIMER
       * 
       * INTERVIEW Q: Why auto-stop an alarm?
       * A: Prevents annoying infinite alarms if user is away from device
       *    Also prevents memory leaks from sounds playing indefinitely
       */
      this.autoStopTimer = setTimeout(() => {
        console.log('🔔 Auto-stopping alarm after timeout');
        this.stopAlarm();
      }, autoStopAfter * 1000);
      
      return true;
      
    } catch (error) {
      console.error('🔔 Error playing alarm:', error);
      
      // FALLBACK: Show visual alert even if everything else fails
      this.showCelebration();
      
      return false;
    }
  }

  /**
   * Trigger device vibration
   * 
   * Pattern explanation:
   * [0, 500, 200, 500]
   * - 0ms wait
   * - 500ms vibrate
   * - 200ms pause
   * - 500ms vibrate
   * 
   * Creates a distinctive double-pulse pattern
   */
  triggerVibration() {
    try {
      if (Platform.OS === 'ios') {
        // iOS: Simple vibration (doesn't support patterns)
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        // Android: Full pattern support
        Vibration.vibrate([0, 500, 200, 500], false);
      }
      console.log('🔔 Vibration triggered');
    } catch (error) {
      console.warn('🔔 Vibration error:', error);
      // Non-critical - continue without vibration
    }
  }

  /**
   * Show celebration alert
   * 
   * INTERVIEW CONCEPT: Alert vs Modal
   * - Alert: System-level, always visible, works even if app backgrounded
   * - Modal: In-app only, requires app to be in foreground
   * 
   * For alarms, Alert is better because it works even if user switches apps
   */
  showCelebration() {
    try {
      Alert.alert(
        '🎉 Session Complete!',
        'Congratulations on finishing your deep work session!',
        [
          {
            text: 'Awesome!',
            style: 'default',
            onPress: () => {
              console.log('🔔 User acknowledged completion');
              this.stopAlarm();
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.warn('🔔 Alert error:', error);
      // If alert fails, at least we have audio/vibration
    }
  }

  /**
   * Callback for audio playback status updates
   * 
   * Called automatically by expo-av when sound state changes
   */
  onPlaybackStatusUpdate = (status) => {
    try {
      if (status.error) {
        console.error('🔔 Playback error:', status.error);
        this.stopAlarm();
      }
      
      // Alarm finished playing naturally
      if (status.didJustFinish && !status.isLooping) {
        console.log('🔔 Alarm finished playing');
        this.stopAlarm();
      }
    } catch (error) {
      console.error('🔔 Status update error:', error);
    }
  };

  /**
   * Stop the alarm and clean up resources
   * 
   * CRITICAL: Always clean up audio resources to prevent memory leaks
   */
  async stopAlarm() {
    try {
      // Clear auto-stop timer
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }
      
      // Stop and unload sound
      if (this.alarmSound) {
        console.log('🔔 Stopping alarm...');
        
        await this.alarmSound.stopAsync();
        await this.alarmSound.unloadAsync();
        
        this.alarmSound = null;
        this.isPlaying = false;
        
        console.log('🔔 Alarm stopped and unloaded');
      }
      
      // Stop vibration
      Vibration.cancel();
      
      return true;
      
    } catch (error) {
      console.error('🔔 Error stopping alarm:', error);
      
      // Even on error, clear references
      this.alarmSound = null;
      this.isPlaying = false;
      
      return false;
    }
  }

  /**
   * Get current alarm status
   * 
   * Useful for debugging or showing UI state
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      hasSound: !!this.alarmSound
    };
  }

  /**
   * Clean up all resources
   * 
   * Called when app is closing or service is being reinitialized
   */
  async cleanup() {
    try {
      console.log('🔔 Cleaning up alarm service...');
      await this.stopAlarm();
      console.log('🔔 Alarm service cleaned up successfully');
    } catch (error) {
      console.error('🔔 Cleanup error:', error);
    }
  }
}

/**
 * SINGLETON PATTERN
 * 
 * Export a single instance to ensure only one alarm plays at a time
 */
export const alarmService = new AlarmService();

console.log('🔔 Alarm service exported successfully');