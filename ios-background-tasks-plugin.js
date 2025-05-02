const { withInfoPlist } = require("@expo/config-plugins");

// This is a custom config plugin that directly modifies the Info.plist
const withBackgroundTasks = (config) => {
  return withInfoPlist(config, config => {
    // Ensure we have UIBackgroundModes array
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    
    // Add required background modes if not present
    const requiredModes = ['fetch', 'processing', 'audio'];
    requiredModes.forEach(mode => {
      if (!config.modResults.UIBackgroundModes.includes(mode)) {
        config.modResults.UIBackgroundModes.push(mode);
      }
    });
    
    // Set BGTaskSchedulerPermittedIdentifiers
    config.modResults.BGTaskSchedulerPermittedIdentifiers = [
      'com.expo.tasks.BACKGROUND_TIMER_TASK'
    ];
    
    return config;
  });
};

module.exports = (config) => {
  return withBackgroundTasks(config);
};