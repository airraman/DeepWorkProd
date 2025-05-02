const withBackgroundTasks = (config) => {
    // Ensure we have the iOS section
    if (!config.ios) config.ios = {};
    if (!config.ios.infoPlist) config.ios.infoPlist = {};
    
    // Add background modes if not already present
    if (!config.ios.infoPlist.UIBackgroundModes) {
      config.ios.infoPlist.UIBackgroundModes = [];
    }
    
    // Ensure all required background modes are present
    const requiredModes = ['fetch', 'processing', 'audio'];
    requiredModes.forEach(mode => {
      if (!config.ios.infoPlist.UIBackgroundModes.includes(mode)) {
        config.ios.infoPlist.UIBackgroundModes.push(mode);
      }
    });
    
    // Set the permitted identifiers
    config.ios.infoPlist.BGTaskSchedulerPermittedIdentifiers = [
      'BACKGROUND_TIMER_TASK',
      'com.anonymous.DeepWorkApp.BACKGROUND_TIMER_TASK',
      'com.transistorsoft.fetch',
      'com.transistorsoft.processing',
      'com.expo.tasks.BACKGROUND_TIMER_TASK'
    ];
    
    return config;
  };
  
  module.exports = config => {
    return withBackgroundTasks(config);
  };