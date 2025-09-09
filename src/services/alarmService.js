// src/services/alarmService.js - Working Version (No Audio Crashes)
import { Platform, Alert, Vibration } from 'react-native';

console.log('🔔 Loading working alarm service...');

class AlarmService {
  constructor() {
    this.isInitialized = false;
    this.isPlaying = false;
    console.log('🔔 Working alarm service created');
  }

  /**
   * Safe initialization that never fails
   */
  async init() {
    try {
      console.log('🔔 Initializing working alarm service...');
      this.isInitialized = true;
      console.log('🔔 Working alarm service initialized successfully');
      return true;
    } catch (error) {
      console.error('🔔 Initialization error:', error);
      this.isInitialized = true; // Always mark as ready
      return true;
    }
  }

  /**
   * Simple completion alarm using visual + vibration
   */
  async playCompletionAlarm(options = {}) {
    try {
      console.log('🔔 Playing working completion alarm...');

      this.isPlaying = true;

      // Safe vibration (won't crash in simulator)
      this.safeVibration();
      
      // Visual celebration alert
      setTimeout(() => {
        this.showCelebrationAlert(options);
      }, 200);

      // Auto-stop after specified time
      if (options.autoStopAfter) {
        setTimeout(() => {
          this.stopAlarm();
        }, options.autoStopAfter * 1000);
      }

      return true;
    } catch (error) {
      console.error('🔔 Working alarm error:', error);
      
      // Ultimate fallback
      Alert.alert('🎉 Session Complete!', 'Great work!');
      return true;
    }
  }

  /**
   * Safe vibration that won't crash
   */
  safeVibration() {
    try {
      // Only attempt vibration on real devices (not simulator)
      if (!__DEV__ || Platform.OS === 'android') {
        Vibration.vibrate([0, 400, 200, 400, 200, 600]);
        console.log('🔔 Vibration played');
      } else {
        console.log('🔔 Skipping vibration (simulator detected)');
      }
    } catch (error) {
      console.log('🔔 Vibration failed (non-critical):', error.message);
    }
  }

  /**
   * Enhanced celebration alert
   */
  showCelebrationAlert(options = {}) {
    try {
      const celebrations = [
        '🎉 Outstanding Work!',
        '🌟 Session Complete!',
        '🎯 Focus Achieved!',
        '💪 Well Done!',
        '🏆 Success!'
      ];
      
      const messages = [
        'You just completed a deep work session! Your dedication is building powerful focus habits.',
        'Another successful session completed! You\'re making real progress toward your goals.',
        'Excellent concentration! You\'re developing the discipline that leads to breakthrough results.',
        'Session finished! Take a moment to appreciate this accomplishment.',
        'Outstanding focus! You\'re proving that deep work creates extraordinary outcomes.'
      ];
      
      const randomTitle = celebrations[Math.floor(Math.random() * celebrations.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
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
            }
          },
          {
            text: 'Another Session',
            style: 'default',
            onPress: () => {
              console.log('🔔 User wants another session');
              this.stopAlarm();
            }
          }
        ],
        { 
          cancelable: true,
          onDismiss: () => {
            this.stopAlarm();
          }
        }
      );
    } catch (error) {
      console.error('🔔 Celebration alert error:', error);
      // Basic fallback
      Alert.alert('🎉 Session Complete!', 'Excellent work on your deep work session!');
    }
  }

  /**
   * Stop alarm
   */
  async stopAlarm() {
    try {
      if (this.isPlaying) {
        Vibration.cancel();
        this.isPlaying = false;
        console.log('🔔 Alarm stopped');
      }
    } catch (error) {
      console.log('🔔 Stop error (non-critical):', error.message);
      this.isPlaying = false;
    }
  }

  /**
   * Test alarm (for settings screen)
   */
  async testAlarm() {
    console.log('🔔 Testing working alarm...');
    return await this.playCompletionAlarm({
      volume: 0.6,
      autoStopAfter: 3
    });
  }

  /**
   * Safe cleanup
   */
  async cleanup() {
    try {
      await this.stopAlarm();
      console.log('🔔 Working alarm service cleaned up');
    } catch (error) {
      console.log('🔔 Cleanup error (non-critical):', error.message);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      type: 'visual-vibration-alarm',
      platform: Platform.OS,
      isDev: __DEV__
    };
  }
}

// Export singleton
export const alarmService = new AlarmService();

console.log('🔔 Working alarm service exported successfully');