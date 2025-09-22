// metro.config.js - FIXED: Removed problematic minifier reference
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep your existing resolver extensions
config.resolver.sourceExts = ['jsx', 'js', 'tsx', 'ts', 'json'];

// Server configuration for localhost
config.server = {
  host: '127.0.0.1',
  port: 8081,
};

// FIXED: Use default Metro transformer (removed minifierPath)
config.transformer = {
  ...config.transformer,
  // Disable experimental features for stability
  unstable_allowRequireContext: false,
  experimentalImportSupport: false,
};

// Resolver settings for legacy architecture compatibility
config.resolver = {
  ...config.resolver,
  sourceExts: ['jsx', 'js', 'tsx', 'ts', 'json'],
  platforms: ['ios', 'android', 'web'],
  unstable_enableSymlinks: false,
  unstable_enablePackageExports: false,
};

module.exports = config;