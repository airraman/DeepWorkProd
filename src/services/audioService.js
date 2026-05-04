// src/services/audioService.js - Full Implementation with Background Music
import { Audio } from 'expo-av';
import { audioSessionManager } from './audioSessionManager';  // Add at top of file


console.log('🎵 Loading audio service...');

/**
 * AudioService handles background music playback during deep work sessions
 * 
 * Key Responsibilities:
 * 1. Play looping background music (white noise, lo-fi)
 * 2. Pause/resume music when user pauses session
 * 3. Clean up audio resources to prevent memory leaks
 * 
 * INTERVIEW CONCEPT: Why a class instead of functions?
 * - We need to maintain STATE (current sound object, playing status)
 * - We need to ensure only ONE instance of audio plays at a time (Singleton pattern)
 * - Classes make it easier to manage the lifecycle of audio resources
 */
class AudioService {
  constructor() {
    // Track the currently playing sound object
    // CRITICAL: We must store this to stop/pause/resume later
    this.currentSound = null;
    
    // Track initialization state
    this.isInitialized = false;
    
    // Track what's currently playing
    this.currentMusicChoice = null;
    
    // Track playback state
    this.isPlaying = false;
    
    console.log('🎵 Audio service instance created');
  }

  /**
   * Initialize the audio system
   * 
   * INTERVIEW Q: Why do we need initialization?
   * A: Mobile audio systems require explicit configuration before use.
   *    We need to tell the OS how to handle our audio (background play,
   *    mixing with other apps, behavior when phone is on silent, etc.)
   * 
   * This is called ONCE when the app starts or when a session begins
   */
  async init() {
    try {
      console.log('🎵 Initializing audio service...');
      
      // Use the shared session manager instead of setting our own mode
      if (!audioSessionManager.isReady()) {
        await audioSessionManager.initialize();
      }
      
      this.isInitialized = true;
      console.log('🎵 Audio service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('🎵 Audio initialization error:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Play background music based on user's choice
   * 
   * @param {string} musicChoice - One of: 'none', 'white-noise', 'lofi'
   * 
   * FLOW:
   * 1. Stop any currently playing music
   * 2. If 'none' selected, just return
   * 3. Load the appropriate audio file
   * 4. Start playing with loop enabled
   * 
   * INTERVIEW Q: Why do we need to stop existing music first?
   * A: To prevent multiple audio streams playing simultaneously (memory leak + bad UX)
   */
  async playMusic(musicChoice) {
    try {
      console.log(`🎵 Request to play music: ${musicChoice}`);
      
      // If service isn't initialized, try to initialize now
      if (!this.isInitialized) {
        console.log('🎵 Service not initialized, initializing now...');
        await this.init();
      }
      
      // Stop any currently playing music first
      // CRITICAL: Prevents memory leaks from overlapping sounds
      await this.stopMusic();
      
      // If user selected 'no music', we're done
      if (musicChoice === 'none') {
        console.log('🎵 No music selected');
        return true;
      }
      
      // Map the user's choice to an actual audio file
      // INTERVIEW CONCEPT: Why use require() instead of a string path?
      // A: React Native bundles assets at compile time. require() tells the
      //    Metro bundler to include this file in the app bundle.
      let soundSource;
      switch (musicChoice) {
        case 'white-noise':
          // Note: File is called "white-noise.mp3" (with dash)
          soundSource = require('../../assets/sounds/white-noise.mp3');
          break;
        case 'lofi':
          soundSource = require('../../assets/sounds/lofi.mp3');
          break;
        default:
          console.warn(`🎵 Unknown music choice: ${musicChoice}`);
          return false;
      }
      
      console.log(`🎵 Loading audio for: ${musicChoice}`);

      // Re-apply audio mode directly before loading — iOS deactivates the audio
      // session when the app is backgrounded, and the audioSessionManager cache
      // keeps isInitialized=true so init() would skip re-setup. This mirrors
      // the same pattern used in alarmService.playCompletionAlarm().
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 2, // DuckOthers
        interruptionModeAndroid: 2,
        shouldDuckAndroid: true,
        allowsRecordingIOS: false,
        playThroughEarpieceAndroid: false,
      });
      console.log('🎵 Audio mode set — playsInSilentMode: true, staysActiveInBackground: true');

      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: true,
          isLooping: true,
          volume: 0.5,
        },
        this.onPlaybackStatusUpdate
      );
      console.log(`🎵 Sound object created for: ${musicChoice}`);

      this.currentSound = sound;
      this.currentMusicChoice = musicChoice;
      this.isPlaying = true;

      console.log(`🎵 Successfully playing: ${musicChoice}`);
      return true;
      
    } catch (error) {
      console.error('🎵 Error playing music:', error);
      
      // Clean up on error
      this.currentSound = null;
      this.currentMusicChoice = null;
      this.isPlaying = false;
      
      // Return false but don't crash the app
      // The session can continue without music
      return false;
    }
  }

  /**
   * Callback function that receives playback status updates
   * 
   * INTERVIEW CONCEPT: Callback Functions
   * - This is called automatically by expo-av when playback state changes
   * - Useful for tracking errors, completion, buffering, etc.
   * 
   * We use arrow function syntax (=>) so 'this' refers to our AudioService instance
   */
  onPlaybackStatusUpdate = (status) => {
    try {
      // If there was an error during playback
      if (status.error) {
        console.error('🎵 Playback error:', status.error);
        this.stopMusic(); // Clean up
      }
      
      // Track if sound has finished playing (shouldn't happen with looping)
      if (status.didJustFinish && !status.isLooping) {
        console.log('🎵 Playback finished');
        this.isPlaying = false;
      }
      
    } catch (error) {
      console.error('🎵 Status update error:', error);
    }
  };

  /**
   * Pause the currently playing music
   * 
   * INTERVIEW Q: What's the difference between pause and stop?
   * A: 
   * - Pause: Keeps audio loaded in memory, can resume from same position
   * - Stop: Unloads audio, resume would start from beginning
   * 
   * We use pause for session pauses (user might resume quickly)
   */
  async pauseMusic() {
    try {
      if (!this.currentSound) {
        console.log('🎵 No music to pause');
        return true;
      }
      
      console.log('🎵 Pausing music...');
      
      // Check if sound is actually playing before trying to pause
      const status = await this.currentSound.getStatusAsync();
      if (status.isPlaying) {
        await this.currentSound.pauseAsync();
        this.isPlaying = false;
        console.log('🎵 Music paused');
      }
      
      return true;
      
    } catch (error) {
      console.error('🎵 Error pausing music:', error);
      return false;
    }
  }

  /**
   * Resume playing music after pause
   * 
   * Continues from where it was paused
   */
  async resumeMusic() {
    try {
      if (!this.currentSound) {
        console.log('🎵 No music to resume');
        return true;
      }
      
      console.log('🎵 Resuming music...');
      
      // Check current status before resuming
      const status = await this.currentSound.getStatusAsync();
      if (!status.isPlaying && status.isLoaded) {
        await this.currentSound.playAsync();
        this.isPlaying = true;
        console.log('🎵 Music resumed');
      }
      
      return true;
      
    } catch (error) {
      console.error('🎵 Error resuming music:', error);
      return false;
    }
  }

  /**
   * Stop music and clean up resources
   * 
   * CRITICAL FUNCTION for preventing memory leaks
   * 
   * INTERVIEW CONCEPT: Resource Management
   * - Audio objects hold data in memory
   * - If we don't unload them, we get memory leaks
   * - Mobile devices have limited memory, so this is critical
   * 
   * Called when:
   * - User changes music selection
   * - Session ends
   * - Component unmounts
   */
  async stopMusic() {
    try {
      if (!this.currentSound) {
        console.log('🎵 No music to stop');
        return true;
      }
      
      console.log('🎵 Stopping music...');
      
      /**
       * IMPORTANT: Two-step cleanup process
       * 1. stopAsync() - Stop playback
       * 2. unloadAsync() - Free memory
       * 
       * INTERVIEW Q: Why two steps?
       * A: stopAsync() pauses playback but keeps data in memory (fast to resume)
       *    unloadAsync() removes data from memory (slow to restart, but frees resources)
       */
      await this.currentSound.stopAsync();
      await this.currentSound.unloadAsync();
      
      // Clear our references
      this.currentSound = null;
      this.currentMusicChoice = null;
      this.isPlaying = false;
      
      console.log('🎵 Music stopped and unloaded');
      return true;
      
    } catch (error) {
      console.error('🎵 Error stopping music:', error);
      
      // Even if there's an error, clear our references
      // This prevents us from trying to use a broken sound object
      this.currentSound = null;
      this.currentMusicChoice = null;
      this.isPlaying = false;
      
      return false;
    }
  }

  /**
   * Get current playback status
   * 
   * Useful for debugging or showing UI state
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isPlaying: this.isPlaying,
      currentMusic: this.currentMusicChoice,
      hasSound: !!this.currentSound
    };
  }

  /**
   * Clean up all resources
   * 
   * Called when:
   * - App is closing
   * - Service is being reinitialized
   * - Component unmounts
   */
  async cleanup() {
    try {
      console.log('🎵 Cleaning up audio service...');
      await this.stopMusic();
      console.log('🎵 Audio service cleaned up successfully');
    } catch (error) {
      console.error('🎵 Cleanup error:', error);
    }
  }
}

/**
 * SINGLETON PATTERN
 * 
 * INTERVIEW CONCEPT: Why export a single instance instead of the class?
 * 
 * A: We want only ONE audio service in the entire app
 *    - Prevents multiple music streams playing simultaneously
 *    - Ensures consistent state across all components
 *    - Easier resource management
 * 
 * This is the Singleton pattern - commonly used for services like:
 * - Audio players
 * - Database connections
 * - API clients
 * - Logging services
 */
export const audioService = new AudioService();

console.log('🎵 Audio service exported successfully');