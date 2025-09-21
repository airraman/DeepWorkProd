// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure compatibility with newer React Native versions
config.resolver.sourceExts = ['jsx', 'js', 'tsx', 'ts', 'json'];

// ADD: Server configuration to fix development build connectivity
config.server = {
  // Bind to all interfaces so both localhost and LAN work
  host: '0.0.0.0',
  port: 8081,
  
  // Enable enhanced middleware for better development experience
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add CORS headers for cross-origin requests (development only)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
      } else {
        middleware(req, res, next);
      }
    };
  }
};

// ADD: Additional resolver configuration for development builds
config.resolver.platforms = ['ios', 'android', 'web'];

// ADD: Transformer optimizations for development
config.transformer = {
  ...config.transformer,
  // Enable source maps for better debugging
  enableBabelRCLookup: false,
  // Use faster minifier for development builds
  minifierPath: 'metro-minify-uglify',
};

module.exports = config;