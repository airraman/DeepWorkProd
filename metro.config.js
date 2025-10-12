// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep your existing resolver extensions
config.resolver.sourceExts = ['jsx', 'js', 'tsx', 'ts', 'json'];

// Server configuration for localhost
config.server = {
  host: '127.0.0.1',
  port: 8081,
};

// UPDATED: Enable require.context for OpenAI SDK
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,  // ✅ Changed to TRUE
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