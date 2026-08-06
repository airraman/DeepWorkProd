// src/services/audioSessionManager.js
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

class AudioSessionManager {
  constructor() {
    this.isInitialized = false;
    this.currentMode = null;
    console.log('🎵 AudioSessionManager instance created');
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('🎵 Audio session already initialized - skipping');
      return true;
    }

    try {
      console.log('🎵 Initializing unified audio session...');

      const audioMode = {
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        allowsRecordingIOS: false,
      };

      await Audio.setAudioModeAsync(audioMode);

      this.isInitialized = true;
      this.currentMode = audioMode;

      console.log('✅ Unified audio session initialized successfully');

      return true;

    } catch (error) {
      console.error('❌ Audio session initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  getMode() {
    return this.currentMode;
  }

  isReady() {
    return this.isInitialized;
  }

  reset() {
    console.log('🎵 Resetting audio session manager');
    this.isInitialized = false;
    this.currentMode = null;
  }
}

export const audioSessionManager = new AudioSessionManager();
