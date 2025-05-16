// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure compatibility with newer React Native versions
config.resolver.sourceExts = ['jsx', 'js', 'tsx', 'ts', 'json'];

module.exports = config;