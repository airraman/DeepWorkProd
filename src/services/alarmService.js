import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';
import { audioSessionManager } from './audioSessionManager';  // Add at top of file


class AlarmService {

  constructor() {
    this.alarmSound = null;
    this.isInitialized = false;
    this.isPlaying = false;
    this.autoStopTimer = null;
    console.log('🔔 Alarm service instance created');
  }

  async init() {
    try {
      console.log('🔔 Initializing alarm service...');
      
      // Use the shared session manager
      if (!audioSessionManager.isReady()) {
        await audioSessionManager.initialize();
      }
      
      this.isInitialized = true;
      console.log('🔔 Alarm service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('🔔 Alarm init error:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async playCompletionAlarm(options = {}) {
    const { volume = 0.8, autoStopAfter = 10 } = options;
    
    try {
      // ✅ DEFENSIVE: Re-initialize audio session right before playing
      // WHY: iOS can revoke audio session if app was backgrounded long
      await this.init();
      
      // ✅ Load and play alarm sound
      console.log('🔔 Loading alarm sound...');
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/completion-alarm.wav'),  // ✅ CORRECT FILE
        { 
          shouldPlay: true, 
          volume,
          // ✅ CRITICAL: Don't loop (one-shot alarm)
          isLooping: false,
        },
        this.onPlaybackStatusUpdate.bind(this)  // Track playback status
      );
      
      this.alarmSound = sound;
      this.isPlaying = true;
      
      // ✅ Trigger vibration for multi-sensory alert
      Vibration.vibrate([0, 500, 200, 500]);
      
      // ✅ Auto-stop timer
      this.autoStopTimer = setTimeout(() => {
        this.stopAlarm();
      }, autoStopAfter * 1000);
      
      return true;
    } catch (error) {
      console.error('🔔 Alarm play error:', error);
      return false;
    }
  }
  
  // ✅ NEW: Track playback status for debugging
  onPlaybackStatusUpdate(status) {
    if (status.didJustFinish) {
      console.log('🔔 Alarm finished naturally');
      this.stopAlarm();
    }
    if (status.error) {
      console.error('🔔 Playback error:', status.error);
    }
  }

  async stopAlarm() {
    try {
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }
      
      if (this.alarmSound) {
        await this.alarmSound.stopAsync();
        await this.alarmSound.unloadAsync();
        this.alarmSound = null;
      }
      
      this.isPlaying = false;
      console.log('🔔 Alarm stopped');
      return true;
    } catch (error) {
      console.error('🔔 Error stopping alarm:', error);
      return false;
    }
  }

  async cleanup() {
    try {
      console.log('🔔 Cleaning up alarm service...');
      await this.stopAlarm();
      console.log('🔔 Alarm service cleaned up');
    } catch (error) {
      console.error('🔔 Cleanup error:', error);
    }
  }

}

export const alarmService = new AlarmService();
