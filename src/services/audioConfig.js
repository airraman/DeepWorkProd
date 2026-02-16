// Create unified audio configuration
// src/services/audioConfig.js
export const UNIFIED_AUDIO_CONFIG = {
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    categoryIOS: Audio.AUDIO_SESSION_CATEGORY_PLAYBACK,
    categoryOptionsIOS: [
      Audio.CATEGORY_OPTIONS_MIXWITHOTHERS,
      Audio.CATEGORY_OPTIONS_ALLOWBLUETOOTH,
      Audio.CATEGORY_OPTIONS_DEFAULTTOSPEAKER,
    ],
    interruptionModeIOS: 2,
    interruptionModeAndroid: 2,
    shouldDuckAndroid: false,
    allowsRecordingIOS: false,
  };
  
  // Use SAME config in both services
  // Only call setAudioModeAsync ONCE on app start