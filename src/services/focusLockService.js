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

  /**
   * Call once on app launch. Returns auth status, selection, and blocking
   * state in a single bridge call. Use this to hydrate UI instead of
   * calling three separate methods.
   *
   * @returns {Promise<{
   *   authorizationStatus: 'approved' | 'denied' | 'notDetermined' | 'unknown',
   *   selection: { appTokenCount: number, categoryTokenCount: number, webDomainTokenCount: number, totalCount: number },
   *   blocking: { isBlocking: boolean, shieldedAppCount: number, shieldedCategoryCount: number, shieldedWebDomainCount: number }
   * }>}
   */
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
};

export default focusLockService;