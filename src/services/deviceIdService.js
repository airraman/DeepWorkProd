// src/services/deviceIdService.js
/**
 * Device Identity Service
 * 
 * PURPOSE:
 * Provides a stable, persistent device identifier that survives app restarts.
 * This is critical for Firebase Cloud Messaging token registration.
 * 
 * INTERVIEW CONCEPT: Identity Management in Distributed Systems
 * 
 * WHY WE NEED THIS:
 * - FCM tokens are registered with a user ID
 * - Notifications are sent to that same user ID
 * - Without consistent ID, token lookup fails
 * - This is a "single source of truth" for device identity
 * 
 * ARCHITECTURE DECISIONS:
 * 
 * 1. Why AsyncStorage?
 *    - Persists across app restarts
 *    - Accessible from any context (React, background tasks, etc.)
 *    - Simple key-value storage
 * 
 * 2. Why not just use random ID each time?
 *    - Registration and notification would use different IDs
 *    - Token lookup would fail
 *    - Notifications wouldn't deliver
 * 
 * 3. Why not use Firebase Auth?
 *    - Requires user sign-up (adds friction)
 *    - This is MVP - anonymous is fine
 *    - Can upgrade to Auth later without breaking existing code
 * 
 * 4. What happens on app reinstall?
 *    - New device ID generated (acceptable for MVP)
 *    - Old FCM token orphaned in Firestore (can be cleaned up later)
 *    - User gets fresh start
 * 
 * FUTURE UPGRADES:
 * - Phase 2: Add Firebase Anonymous Auth (multi-device support)
 * - Phase 3: Add email sign-up (full account system)
 * - Phase 4: Clean up orphaned tokens (maintenance job)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'deepwork_device_id';

class DeviceIdService {
  constructor() {
    // In-memory cache to avoid repeated AsyncStorage reads
    this.deviceId = null;
  }

  /**
   * Get or generate stable device ID
   * 
   * BEHAVIOR:
   * - First call: Generates new ID and stores it
   * - Subsequent calls: Returns cached or stored ID
   * - Persists across app restarts
   * - New ID on app reinstall
   * 
   * ID FORMAT: 'device_<unique_identifier>'
   * Example: 'device_B8E3F9A2-4D7C-4B1E-8F9A-2C3D4E5F6A7B'
   * 
   * @returns {Promise<string>} Stable device identifier
   */
  async getDeviceId() {
    // Return cached if available (fastest path)
    if (this.deviceId) {
      console.log('📱 [DeviceId] Using cached ID:', this.deviceId.substring(0, 20) + '...');
      return this.deviceId;
    }

    try {
      // Try to load from AsyncStorage
      const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (stored) {
        this.deviceId = stored;
        console.log('📱 [DeviceId] Loaded from storage:', this.deviceId.substring(0, 20) + '...');
        return this.deviceId;
      }

      // Generate new ID if none exists
      console.log('📱 [DeviceId] No existing ID found, generating new one...');
      const newId = await this._generateDeviceId();
      
      // Persist to storage
      await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
      this.deviceId = newId;
      
      console.log('📱 [DeviceId] Generated and stored new ID:', newId.substring(0, 20) + '...');
      return newId;
      
    } catch (error) {
      console.error('❌ [DeviceId] Error getting device ID:', error);
      
      // Fallback: Generate temporary ID (won't persist, but allows app to continue)
      const fallbackId = this._generateFallbackId();
      console.warn('⚠️ [DeviceId] Using fallback ID:', fallbackId.substring(0, 20) + '...');
      return fallbackId;
    }
  }

  /**
   * Generate stable device ID using platform APIs
   * 
   * iOS: Uses identifierForVendor
   * - Unique per app vendor (same for all your apps)
   * - Persists across app updates
   * - Resets on app reinstall
   * - Same ID after device backup/restore
   * 
   * Android: Uses ANDROID_ID
   * - Unique per device + app combination
   * - Persists across app updates
   * - Resets on factory reset or app reinstall
   * 
   * @private
   * @returns {Promise<string>} Device-specific unique identifier
   */
  async _generateDeviceId() {
    const timestamp = Date.now();
    let uniqueId;

    if (Platform.OS === 'ios') {
      /**
       * iOS: identifierForVendor
       * 
       * INTERVIEW Q: Why not IDFV (Identifier for Advertisers)?
       * A: IDFA requires user permission (iOS 14+)
       *    IDFV is automatic and perfect for this use case
       * 
       * STABILITY:
       * - Same across app reinstalls from same developer
       * - Different after device restore + app reinstall
       * - Different on different devices
       */
      uniqueId = await Application.getIosIdForVendorAsync();
      console.log('📱 [DeviceId] iOS vendor ID obtained');
      
    } else if (Platform.OS === 'android') {
      /**
       * Android: ANDROID_ID
       * 
       * INTERVIEW Q: Why not IMEI or MAC address?
       * A: Both require special permissions
       *    ANDROID_ID is available without permissions
       * 
       * STABILITY:
       * - Same across app reinstalls
       * - Resets on factory reset
       * - Different on different devices
       */
      uniqueId = Application.androidId;
      console.log('📱 [DeviceId] Android ID obtained');
      
    } else {
      // Fallback for web or other platforms
      console.warn('⚠️ [DeviceId] Unknown platform, using timestamp-based ID');
      uniqueId = `${timestamp}_${Math.random().toString(36).substring(7)}`;
    }

    // Extra safety: If platform API fails, use fallback
    if (!uniqueId) {
      console.warn('⚠️ [DeviceId] Platform ID unavailable, using fallback');
      uniqueId = `${timestamp}_${Math.random().toString(36).substring(7)}`;
    }

    // Format: 'device_<unique_id>'
    return `device_${uniqueId}`;
  }

  /**
   * Generate fallback ID when AsyncStorage fails
   * 
   * THIS IS NOT IDEAL - won't persist across app restarts
   * Only used if AsyncStorage is completely broken
   * 
   * @private
   * @returns {string} Temporary device identifier
   */
  _generateFallbackId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `device_fallback_${timestamp}_${random}`;
  }

  /**
   * Reset device ID (for testing/debugging only)
   * 
   * WHEN TO USE:
   * - Testing FCM registration flow
   * - Debugging token mismatch issues
   * - Simulating new device
   * 
   * DANGER: This will orphan FCM tokens in Firestore
   * User won't receive notifications until they reregister
   * 
   * @returns {Promise<void>}
   */
  async resetDeviceId() {
    try {
      console.log('🔄 [DeviceId] Resetting device ID...');
      
      this.deviceId = null;
      await AsyncStorage.removeItem(DEVICE_ID_KEY);
      
      console.log('✅ [DeviceId] Device ID reset successfully');
    } catch (error) {
      console.error('❌ [DeviceId] Failed to reset device ID:', error);
    }
  }

  /**
   * Check if device ID exists in storage
   * Useful for debugging without triggering generation
   * 
   * @returns {Promise<boolean>} True if device ID exists
   */
  async hasDeviceId() {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
      return !!stored;
    } catch (error) {
      console.error('❌ [DeviceId] Error checking device ID existence:', error);
      return false;
    }
  }
}

// Export singleton instance
// INTERVIEW CONCEPT: Singleton Pattern
// - Only one instance exists app-wide
// - Shared state (cached device ID)
// - Consistent identity across all consumers
export default new DeviceIdService();