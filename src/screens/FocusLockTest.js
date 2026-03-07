import { NativeModules, Platform } from 'react-native';

const { FocusLockModule } = NativeModules;

const isSupported = Platform.OS === 'ios' && !!FocusLockModule;

function assertSupported() {
  if (!isSupported) {
    throw new Error(
      Platform.OS !== 'ios'
        ? 'Focus Lock is only available on iOS.'
        : 'FocusLockModule not found. Ensure you are running a development build (not Expo Go).'
    );
  }
}

const focusLockService = {
  isSupported,

  async initialize() {
    assertSupported();
    return FocusLockModule.initialize();
  },

  async requestAuthorization() {
    assertSupported();
    return FocusLockModule.requestAuthorization();
  },

  async getAuthorizationStatus() {
    assertSupported();
    return FocusLockModule.getAuthorizationStatus();
  },

  async selectAppsToBlock() {
    assertSupported();
    return FocusLockModule.selectAppsToBlock();
  },

  async getSelectionCount() {
    assertSupported();
    return FocusLockModule.getSelectionCount();
  },

  async clearSelection() {
    assertSupported();
    return FocusLockModule.clearSelection();
  },

  async startBlocking() {
    assertSupported();
    return FocusLockModule.startBlocking();
  },

  async stopBlocking() {
    assertSupported();
    return FocusLockModule.stopBlocking();
  },

  async getBlockingStatus() {
    assertSupported();
    return FocusLockModule.getBlockingStatus();
  },

  /**
   * Emergency recovery. Removes all shields and resets all state.
   * Use when apps are stuck blocked or state is known to be corrupted.
   * Safe to call at any time.
   *
   * @returns {Promise<{ success: boolean, message: string, blocking: object, selection: object }>}
   */
  async forceStopBlocking() {
    assertSupported();
    return FocusLockModule.forceStopBlocking();
  },
};

export default focusLockService;