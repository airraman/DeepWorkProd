// src/services/audioSessionManager.js
import { Audio } from 'expo-av';

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
        categoryIOS: Audio.AUDIO_SESSION_CATEGORY_PLAYBACK,
        categoryOptionsIOS: [
          Audio.CATEGORY_OPTIONS_MIXWITHOTHERS,
          Audio.CATEGORY_OPTIONS_DUCKOTHERS,
          Audio.CATEGORY_OPTIONS_ALLOWBLUETOOTH,
          Audio.CATEGORY_OPTIONS_DEFAULTTOSPEAKER,
        ],
        interruptionModeIOS: 2,
        interruptionModeAndroid: 2,
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