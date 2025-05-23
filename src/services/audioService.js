// src/services/audioService.js
import { Audio } from 'expo-av';

// Track the current sound object
let soundObject = null;

// Simple approach to define audio assets
const getAudioSource = (type) => {
  if (type === 'lofi') {
    return require('../../assets/lofi.mp3');
  } else if (type === 'whitenoise') {
    return require('../../assets/whitenoise.mp3');
  }
  return null;
};

export const audioService = {
  // Initialize audio
  async init() {
    try {
      // Set up audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      
      console.log('Audio service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      return false;
    }
  },

  // Play music based on selection
  async playMusic(musicChoice) {
    try {
      // If something is already playing, stop it
      await this.stopMusic();
      
      // If user selected "none", don't play anything
      if (musicChoice === 'none') {
        console.log('No music selected, skipping audio playback');
        return;
      }
      
      try {
        // Create a new sound object with createAsync (more compatible approach)
        const source = getAudioSource(musicChoice);
        if (!source) {
          console.error(`Unknown music choice: ${musicChoice}`);
          return;
        }
        
        const { sound } = await Audio.Sound.createAsync(
          source,
          { shouldPlay: true, isLooping: true }
        );
        
        soundObject = sound;
        console.log(`Now playing: ${musicChoice}`);
      } catch (loadError) {
        console.error(`Error loading audio for ${musicChoice}:`, loadError);
        throw loadError;
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      
      // Reset the sound object on error
      if (soundObject) {
        try {
          await soundObject.unloadAsync();
        } catch (unloadError) {
          // Ignore unload errors
        }
        soundObject = null;
      }
    }
  },

  // Stop any current playback
  async stopMusic() {
    try {
      if (soundObject) {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
        soundObject = null;
      }
    } catch (error) {
      console.error('Failed to stop audio:', error);
      // Reset sound object even if there was an error
      soundObject = null;
    }
  },

  // Pause current playback
  async pauseMusic() {
    try {
      if (soundObject) {
        await soundObject.pauseAsync();
      }
    } catch (error) {
      console.error('Failed to pause audio:', error);
    }
  },

  // Resume paused playback
  async resumeMusic() {
    try {
      if (soundObject) {
        await soundObject.playAsync();
      }
    } catch (error) {
      console.error('Failed to resume audio:', error);
    }
  }
};