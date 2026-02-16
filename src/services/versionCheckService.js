// src/services/versionCheckService.js

import { Platform, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';

/**
 * Version Check Service - Force Update Implementation
 * 
 * PURPOSE: Ensures users are running a compatible version of the app
 * 
 * CONCEPTS:
 * 1. Semantic Versioning (SemVer): "1.0.2" = Major.Minor.Patch
 * 2. Remote Config Pattern: App reads config from server to change behavior
 * 3. Graceful Degradation: Continues if check fails (network issues)
 * 
 * INTERVIEW RELEVANCE:
 * - Shows understanding of production app maintenance
 * - Demonstrates API integration patterns
 * - Error handling and user experience considerations
 */

const VERSION_CHECK_URL = 'https://deepwork.io/version.json';
const CHECK_TIMEOUT = 5000; // 5 seconds

class VersionCheckService {
  constructor() {
    // Cache the version config to avoid repeated network calls
    this.cachedConfig = null;
    this.lastCheckTime = 0;
    this.CHECK_INTERVAL = 60 * 60 * 1000; // Check once per hour
  }

  /**
   * Get current app version from expo config
   * 
   * IMPORTANT: This reads from app.json at build time
   * Must match the version you set in app.json
   */
  getCurrentVersion() {
    return Constants.expoConfig?.version || '1.0.0';
  }

  /**
   * Compare two version strings
   * 
   * ALGORITHM EXPLANATION:
   * Semantic versioning comparison
   * "1.0.2" vs "1.0.1" → Returns 1 (newer)
   * "1.0.1" vs "1.0.2" → Returns -1 (older)
   * "1.0.1" vs "1.0.1" → Returns 0 (same)
   * 
   * @param {string} v1 - First version
   * @param {string} v2 - Second version
   * @returns {number} - 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    // Split version strings into arrays: "1.0.2" → [1, 0, 2]
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    // Compare each segment (major, minor, patch)
    for (let i = 0; i < 3; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;   // v1 is newer
      if (part1 < part2) return -1;  // v1 is older
    }
    
    return 0; // Versions are equal
  }

  /**
   * Fetch version config from server
   * 
   * NETWORK PATTERN: Fetch with timeout
   * This prevents hanging if server is slow/down
   */
  async fetchVersionConfig() {
    try {
      console.log('📱 [Version Check] Fetching config from:', VERSION_CHECK_URL);
      
      // Create fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT);
      
      const response = await fetch(VERSION_CHECK_URL, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache', // Always get fresh data
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const config = await response.json();
      
      // Validate response structure
      if (!config.ios && !config.android) {
        throw new Error('Invalid config structure');
      }
      
      // Cache the config
      this.cachedConfig = config;
      this.lastCheckTime = Date.now();
      
      console.log('📱 [Version Check] Config fetched:', config);
      return config;
      
    } catch (error) {
      console.error('📱 [Version Check] Fetch failed:', error.message);
      
      // Return cached config if available
      if (this.cachedConfig) {
        console.log('📱 [Version Check] Using cached config');
        return this.cachedConfig;
      }
      
      // Graceful failure: Allow app to continue if check fails
      return null;
    }
  }

  /**
   * Check if update is required
   * 
   * BUSINESS LOGIC:
   * 1. Fetch remote config
   * 2. Compare current version vs minimum required
   * 3. Return update requirement status
   * 
   * @returns {Promise<Object>} Update status object
   */
  async checkForUpdate() {
    try {
      // Skip check if we checked recently (within last hour)
      const timeSinceLastCheck = Date.now() - this.lastCheckTime;
      if (this.cachedConfig && timeSinceLastCheck < this.CHECK_INTERVAL) {
        console.log('📱 [Version Check] Using recent check result');
        return this.evaluateVersion(this.cachedConfig);
      }
      
      const config = await this.fetchVersionConfig();
      
      // If fetch failed and no cache, allow app to run
      if (!config) {
        console.log('📱 [Version Check] No config available, allowing app to run');
        return {
          updateRequired: false,
          forceUpdate: false,
          message: null,
        };
      }
      
      return this.evaluateVersion(config);
      
    } catch (error) {
      console.error('📱 [Version Check] Check failed:', error);
      
      // GRACEFUL FAILURE: Never block app if check system fails
      return {
        updateRequired: false,
        forceUpdate: false,
        message: null,
      };
    }
  }

  /**
   * Evaluate if current version meets requirements
   * 
   * @param {Object} config - Version config from server
   * @returns {Object} Evaluation result
   */
  evaluateVersion(config) {
    const platform = Platform.OS;
    const platformConfig = config[platform];
    
    if (!platformConfig) {
      console.log('📱 [Version Check] No config for platform:', platform);
      return {
        updateRequired: false,
        forceUpdate: false,
        message: null,
      };
    }
    
    const currentVersion = this.getCurrentVersion();
    const { minimumVersion, latestVersion, forceUpdate, message, updateUrl } = platformConfig;
    
    console.log('📱 [Version Check] Comparison:', {
      current: currentVersion,
      minimum: minimumVersion,
      latest: latestVersion,
    });
    
    // Check if current version is below minimum
    const isOutdated = this.compareVersions(currentVersion, minimumVersion) < 0;
    
    // Check if there's a newer version available
    const hasUpdate = this.compareVersions(currentVersion, latestVersion) < 0;
    
    return {
      updateRequired: isOutdated || hasUpdate,
      forceUpdate: isOutdated && forceUpdate,
      currentVersion,
      minimumVersion,
      latestVersion,
      message,
      updateUrl,
    };
  }

  /**
   * Show update alert to user
   * 
   * REACT NATIVE PATTERN: Native alert dialogs
   * Different behavior for force vs optional updates
   * 
   * @param {Object} updateStatus - Result from checkForUpdate()
   * @param {Function} onDismiss - Optional callback when dismissed (optional updates only)
   */
  showUpdateAlert(updateStatus, onDismiss = null) {
    const { forceUpdate, message, updateUrl } = updateStatus;
    
    if (!updateStatus.updateRequired) {
      return;
    }
    
    const title = forceUpdate 
      ? '⚠️ Update Required' 
      : '🎉 Update Available';
    
    const defaultMessage = forceUpdate
      ? 'A critical update is required to continue using DeepWork. Please update now.'
      : 'A new version of DeepWork is available with improvements and bug fixes!';
    
    const buttons = [];
    
    // Add "Later" button only for optional updates
    if (!forceUpdate) {
      buttons.push({
        text: 'Later',
        style: 'cancel',
        onPress: () => {
          console.log('📱 [Version Check] User dismissed optional update');
          if (onDismiss) onDismiss();
        },
      });
    }
    
    // Add "Update" button
    buttons.push({
      text: 'Update Now',
      style: 'default',
      onPress: () => {
        console.log('📱 [Version Check] User tapped update');
        this.openAppStore(updateUrl);
      },
    });
    
    Alert.alert(
      title,
      message || defaultMessage,
      buttons,
      { 
        cancelable: !forceUpdate, // Can't dismiss if force update
        onDismiss: !forceUpdate ? onDismiss : undefined,
      }
    );
  }

  /**
   * Open App Store to app page
   * 
   * DEEP LINKING: Direct users to update
   */
  openAppStore(updateUrl) {
    if (updateUrl) {
      Linking.openURL(updateUrl).catch((error) => {
        console.error('📱 [Version Check] Failed to open App Store:', error);
        Alert.alert('Error', 'Could not open App Store. Please update manually.');
      });
    }
  }

  /**
   * Main function to call on app launch
   * 
   * USAGE IN App.js:
   * 
   * useEffect(() => {
   *   versionCheckService.performVersionCheck();
   * }, []);
   * 
   * @param {Function} onDismiss - Optional callback for dismissible updates
   */
  async performVersionCheck(onDismiss = null) {
    console.log('📱 [Version Check] Starting check...');
    
    const updateStatus = await this.checkForUpdate();
    
    if (updateStatus.updateRequired) {
      console.log('📱 [Version Check] Update required:', updateStatus);
      this.showUpdateAlert(updateStatus, onDismiss);
      
      // Return true if force update (caller might want to block navigation)
      return updateStatus.forceUpdate;
    }
    
    console.log('📱 [Version Check] App is up to date');
    return false;
  }
}

// Export singleton instance
export const versionCheckService = new VersionCheckService();

/**
 * USAGE EXAMPLE:
 * 
 * // In App.js:
 * import { versionCheckService } from './src/services/versionCheckService';
 * 
 * function App() {
 *   const [isBlocked, setIsBlocked] = useState(false);
 *   
 *   useEffect(() => {
 *     async function checkVersion() {
 *       const forceUpdate = await versionCheckService.performVersionCheck();
 *       setIsBlocked(forceUpdate);
 *     }
 *     checkVersion();
 *   }, []);
 *   
 *   if (isBlocked) {
 *     return <UpdateRequiredScreen />;
 *   }
 *   
 *   return <YourApp />;
 * }
 */