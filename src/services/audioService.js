import { Audio } from 'expo-av';

// Track the current sound object
let soundObject = null;

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
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  },

  // Play music based on selection
  async playMusic(musicChoice) {
    try {
      // If something is already playing, stop it
      await this.stopMusic();
      
      // If user selected "none", don't play anything
      if (musicChoice === 'none') return;
      
      // Determine which file to play
      const audioSource = 
        musicChoice === 'lofi' 
          ? require('../../assets/lofi.mp3')
          : require('../../assets/whitenoise.mp3');
      
      // Create and load a new sound object
      soundObject = new Audio.Sound();
      await soundObject.loadAsync(audioSource);
      
      // Play and loop the audio
      await soundObject.setIsLoopingAsync(true);
      await soundObject.playAsync();
      
      console.log(`Now playing: ${musicChoice}`);
    } catch (error) {
      console.error('Failed to play audio:', error);
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