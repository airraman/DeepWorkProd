import { NativeModules, Alert } from 'react-native';

const { FocusLockModule } = NativeModules;

/**
 * Focus Lock Service
 * Bridges to Swift FocusLockModule for iOS Screen Time app blocking
 */
class FocusLockService {
  
  /**
   * Request Screen Time authorization
   */
  async requestAuthorization() {
    try {
      const granted = await FocusLockModule.requestAuthorization();
      console.log('✅ Screen Time authorized:', granted);
      return granted;
    } catch (error) {
      console.error('❌ Screen Time authorization failed:', error);
      Alert.alert(
        'Authorization Failed',
        'Could not access Screen Time. Please check Settings → Screen Time.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }
  
  /**
   * Check if module is available
   */
  isAvailable() {
    return !!FocusLockModule;
  }
}

export default new FocusLockService();
