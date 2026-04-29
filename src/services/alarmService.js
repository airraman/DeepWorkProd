import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Vibration } from 'react-native';
import { audioSessionManager } from './audioSessionManager';


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
      // Always re-apply audio mode immediately before playing.
      // iOS revokes the audio session when the app is backgrounded; the
      // shared audioSessionManager caches isInitialized=true so it would
      // skip re-setup, silencing the alarm. Calling setAudioModeAsync here
      // directly bypasses that cache and guarantees the mode is active.
      // DoNotMix — alarm must interrupt, not duck, other audio.
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
      });

      console.log('🔔 Loading alarm sound...');
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/completion_alarm.wav'),
        {
          shouldPlay: true,
          volume,
          isLooping: false,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.alarmSound = sound;
      this.isPlaying = true;

      Vibration.vibrate([0, 500, 200, 500]);

      this.autoStopTimer = setTimeout(() => {
        this.stopAlarm();
      }, autoStopAfter * 1000);

      return true;
    } catch (error) {
      console.error('🔔 Alarm play error:', error);
      return false;
    }
  }

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
