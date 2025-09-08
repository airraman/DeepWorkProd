// src/services/alarmService.js - Crash-Proof Simulator Version
import { Platform, Alert, Vibration } from 'react-native';

console.log('Crash-proof alarm service loaded');

class AlarmService {
  constructor() {
    this.sound = null;
    this.isInitialized = false;
    this.isSimulator = this.detectSimulator();
    this.audioSupported = false; // Disable all audio for now
  }

  /**
   * Detect if running in simulator - conservative approach
   */
  detectSimulator() {
    try {
      // Very conservative detection
      const isLikelySimulator = Platform.OS === 'ios' && __DEV__;
      
      console.log('🔔 Environment detection (safe mode):', {
        platform: Platform.OS,
        isDev: __DEV__,
        audioDisabled: true // Always disabled for crash prevention
      });

      return isLikelySimulator;
    } catch (error) {
      console.error('🔔 Simulator detection error:', error);
      return true; // Default to simulator mode for safety
    }
  }

  /**
   * Safe initialization - no audio APIs
   */
  async init() {
    try {
      console.log('🔔 Initializing crash-proof alarm service...');
      
      // Always use visual/haptic alerts only - no audio
      console.log('🔔 Using visual alerts only (crash prevention mode)');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('🔔 Safe initialization error:', error);
      // Always return true to prevent app crashes
      this.isInitialized = true;
      return true;
    }
  }

  /**
   * Skip audio loading completely
   */
  async loadAlarmSound() {
    console.log('🔔 Skipping audio loading (crash prevention mode)');
    return true;
  }

  /**
   * Safe completion alarm using only visual/haptic feedback
   */
  async playCompletionAlarm(options = {}) {
    try {
      console.log('🔔 Playing safe completion alarm...');

      if (!this.isInitialized) {
        await this.init();
      }

      // Use only safe system features
      await this.playSafeAlarm(options);
      return true;
    } catch (error) {
      console.error('🔔 Safe alarm error:', error);
      // Still show basic completion feedback
      console.log('🔔 Session completed (alarm had issues)');
      return true;
    }
  }

  /**
   * Safe alarm using only system alerts and vibration
   */
  async playSafeAlarm(options = {}) {
    console.log('🔔 Playing safe alarm (visual + haptic only)');

    try {
      // Safe vibration with error handling
      try {
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 400, 200, 400]);
        } else {
          Vibration.vibrate([0, 500, 300, 500]);
        }
      } catch (vibrationError) {
        console.log('🔔 Vibration not available:', vibrationError.message);
      }

      // Visual alert with error handling
      setTimeout(() => {
        try {
          Alert.alert(
            '🎉 Session Complete!',
            'Your deep work session has finished successfully!',
            [
              {
                text: 'Awesome!',
                style: 'default',
                onPress: () => {
                  try {
                    Vibration.cancel();
                  } catch (e) {
                    // Silent fail
                  }
                }
              }
            ],
            { 
              cancelable: false,
              onDismiss: () => {
                try {
                  Vibration.cancel();
                } catch (e) {
                  // Silent fail
                }
              }
            }
          );
        } catch (alertError) {
          console.error('🔔 Alert failed:', alertError.message);
        }
      }, 200);

      // Auto-stop vibration
      if (options.autoStopAfter) {
        setTimeout(() => {
          try {
            Vibration.cancel();
          } catch (e) {
            // Silent fail
          }
        }, (options.autoStopAfter || 5) * 1000);
      }

      console.log('🔔 Safe alarm completed');
    } catch (error) {
      console.error('🔔 Safe alarm error:', error.message);
    }
  }

  /**
   * Safe stop - only vibration
   */
  async stopAlarm() {
    try {
      Vibration.cancel();
      console.log('🔔 Safe alarm stopped');
    } catch (error) {
      console.log('🔔 Stop alarm error (non-critical):', error.message);
    }
  }

  /**
   * Safe playing check
   */
  async isPlaying() {
    return false; // Visual alerts don't have a "playing" state
  }

  /**
   * Safe cleanup
   */
  async cleanup() {
    try {
      Vibration.cancel();
      this.isInitialized = false;
      console.log('🔔 Safe alarm service cleaned up');
    } catch (error) {
      console.log('🔔 Cleanup error (non-critical):', error.message);
    }
  }

  /**
   * Safe test
   */
  async testAlarm() {
    console.log('🔔 Testing safe alarm...');
    return await this.playCompletionAlarm({
      autoStopAfter: 3
    });
  }

  /**
   * Safe status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      audioSupported: false, // Always false for safety
      isSimulator: this.isSimulator,
      hasSound: false,
      platform: Platform.OS,
      safeMode: true
    };
  }
}

// Export singleton instance
export const alarmService = new AlarmService();