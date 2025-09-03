// src/services/alarmService.js - Simulator-Safe Version
import { Audio } from 'expo-av';
import { Platform, Alert, Vibration } from 'react-native';
import Constants from 'expo-constants';

console.log('Simulator-safe alarm service loaded');

class AlarmService {
  constructor() {
    this.sound = null;
    this.isInitialized = false;
    this.isSimulator = this.detectSimulator();
    this.audioSupported = !this.isSimulator; // Disable audio in simulator by default
  }

  /**
   * Detect if running in simulator
   */
  detectSimulator() {
    try {
      // Multiple ways to detect simulator
      const isSimulator = 
        Platform.OS === 'ios' && 
        (
          Platform.isPad === undefined || // Simulator sometimes has undefined isPad
          Constants.platform?.ios?.simulator === true || // Expo Constants detection
          Constants.deviceName?.includes('Simulator') || // Device name check
          __DEV__ && Platform.OS === 'ios' // Fallback: dev mode on iOS often means simulator
        );

      console.log('🔔 Environment detection:', {
        platform: Platform.OS,
        isSimulator,
        deviceName: Constants.deviceName,
        simulatorFromConstants: Constants.platform?.ios?.simulator
      });

      return isSimulator;
    } catch (error) {
      console.error('🔔 Simulator detection error:', error);
      // Default to safe mode if detection fails
      return Platform.OS === 'ios';
    }
  }

  /**
   * Initialize the alarm service with simulator safety
   */
  async init() {
    try {
      console.log('🔔 Initializing simulator-safe alarm service...');
      console.log('🔔 Audio supported:', this.audioSupported);

      if (!this.audioSupported) {
        console.log('🔔 Running in simulator - using fallback alerts');
        this.isInitialized = true;
        return true;
      }

      // Only try audio initialization on real devices
      try {
        // Very conservative audio setup for real devices
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          // Don't set interruption modes that might cause issues
        });

        await this.loadAlarmSound();
        console.log('🔔 Audio alarm service initialized successfully');
      } catch (audioError) {
        console.warn('🔔 Audio initialization failed, falling back to visual alerts:', audioError);
        this.audioSupported = false; // Disable audio for this session
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('🔔 Failed to initialize alarm service:', error);
      // Always succeed initialization to avoid breaking the app
      this.isInitialized = true;
      this.audioSupported = false;
      return true; // Return true to avoid breaking the app
    }
  }

  /**
   * Load alarm sound (only on real devices)
   */
  async loadAlarmSound() {
    if (!this.audioSupported) {
      console.log('🔔 Skipping sound loading (audio not supported)');
      return;
    }

    try {
      console.log('🔔 Loading alarm sound...');

      // Unload existing sound if any
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      // Try to load the sound file
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/alarm.mp3'),
        {
          shouldPlay: false,
          isLooping: false,
          volume: 1.0,
        }
      );

      this.sound = sound;
      console.log('🔔 Alarm sound loaded successfully');
    } catch (error) {
      console.error('🔔 Failed to load alarm sound:', error);
      
      // Don't throw error - fall back to visual alerts
      this.audioSupported = false;
      console.log('🔔 Falling back to visual alerts due to sound loading failure');
    }
  }

  /**
   * Play completion alarm with simulator fallback
   */
  async playCompletionAlarm(options = {}) {
    try {
      console.log('🔔 Playing completion alarm...');

      if (!this.isInitialized) {
        console.log('🔔 Initializing alarm service...');
        await this.init();
      }

      // Try audio alarm first (real devices only)
      if (this.audioSupported && this.sound) {
        try {
          await this.playAudioAlarm(options);
          return true;
        } catch (audioError) {
          console.warn('🔔 Audio alarm failed, falling back to visual:', audioError);
          this.audioSupported = false; // Disable for this session
        }
      }

      // Fallback to visual/haptic alert
      await this.playFallbackAlarm(options);
      return true;
    } catch (error) {
      console.error('🔔 All alarm methods failed:', error);
      // Always return true to avoid breaking the app flow
      return true;
    }
  }

  /**
   * Play audio alarm (real devices only)
   */
  async playAudioAlarm(options = {}) {
    if (!this.sound) {
      throw new Error('Sound not loaded');
    }

    console.log('🔔 Playing audio alarm');
    
    const volume = Math.max(0, Math.min(1, options.volume || 0.8));

    // Check sound status
    const status = await this.sound.getStatusAsync();
    if (!status.isLoaded) {
      await this.loadAlarmSound();
    }

    // Play the sound
    await this.sound.setVolumeAsync(volume);
    await this.sound.setPositionAsync(0);
    await this.sound.playAsync();

    // Auto-stop if requested
    if (options.autoStopAfter) {
      setTimeout(async () => {
        try {
          await this.stopAlarm();
        } catch (error) {
          console.error('🔔 Error auto-stopping alarm:', error);
        }
      }, options.autoStopAfter * 1000);
    }

    console.log('🔔 Audio alarm playing');
  }

  /**
   * Fallback alarm using system alerts and vibration
   */
  async playFallbackAlarm(options = {}) {
    console.log('🔔 Playing fallback alarm (visual + haptic)');

    try {
      // Vibration (works on real devices, safe on simulators)
      if (Platform.OS === 'ios') {
        // iOS vibration pattern
        Vibration.vibrate([0, 400, 200, 400, 200, 400]);
      } else {
        // Android vibration pattern
        Vibration.vibrate([0, 500, 300, 500, 300, 500]);
      }
    } catch (vibrationError) {
      console.log('🔔 Vibration not available:', vibrationError);
    }

    // Visual alert with delay to let vibration start
    setTimeout(() => {
      Alert.alert(
        '🎉 Session Complete!',
        'Your deep work session has finished successfully!',
        [
          {
            text: 'Awesome!',
            style: 'default',
            onPress: () => {
              // Stop any ongoing vibration
              Vibration.cancel();
            }
          }
        ],
        { 
          cancelable: false // Make sure user sees the completion
        }
      );
    }, 200);

    // Auto-dismiss vibration if requested
    if (options.autoStopAfter) {
      setTimeout(() => {
        Vibration.cancel();
      }, (options.autoStopAfter || 5) * 1000);
    }

    console.log('🔔 Fallback alarm triggered');
  }

  /**
   * Stop the alarm
   */
  async stopAlarm() {
    try {
      // Stop audio if playing
      if (this.sound && this.audioSupported) {
        const status = await this.sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await this.sound.stopAsync();
          console.log('🔔 Audio alarm stopped');
        }
      }

      // Stop vibration
      Vibration.cancel();
      console.log('🔔 Alarm stopped');
    } catch (error) {
      console.error('🔔 Error stopping alarm:', error);
    }
  }

  /**
   * Check if alarm is playing
   */
  async isPlaying() {
    try {
      if (!this.sound || !this.audioSupported) return false;
      
      const status = await this.sound.getStatusAsync();
      return status.isLoaded && status.isPlaying;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      Vibration.cancel();

      if (this.sound && this.audioSupported) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      
      this.isInitialized = false;
      console.log('🔔 Alarm service cleaned up');
    } catch (error) {
      console.error('🔔 Cleanup error (non-critical):', error);
    }
  }

  /**
   * Test the alarm
   */
  async testAlarm() {
    console.log('🔔 Testing alarm...');
    return await this.playCompletionAlarm({
      volume: 0.5,
      autoStopAfter: 3
    });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      audioSupported: this.audioSupported,
      isSimulator: this.isSimulator,
      hasSound: !!this.sound,
      platform: Platform.OS
    };
  }
}

// Export singleton instance
export const alarmService = new AlarmService();