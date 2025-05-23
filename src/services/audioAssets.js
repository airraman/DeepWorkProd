// src/services/audioAssets.js
// This file provides a compatibility layer for audio assets

// Define audio sources explicitly
const audioAssets = {
    lofi: require('../../assets/lofi.mp3'),
    whitenoise: require('../../assets/whitenoise.mp3')
  };
  
  // Function to safely get audio assets
  export const getAudioAsset = (name) => {
    if (!audioAssets[name]) {
      console.warn(`Audio asset '${name}' not found`);
      return null;
    }
    return audioAssets[name];
  };