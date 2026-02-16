// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ONLY override what's needed for OpenAI SDK
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,  // Required for OpenAI SDK
};

module.exports = config;