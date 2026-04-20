import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
  } from 'react';
  import { Platform } from 'react-native';
  import focusLockService from '../services/focusLockService';
  
  const FocusLockContext = createContext(null);
  
  export function FocusLockProvider({ children }) {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [selectionCount, setSelectionCount] = useState(0);
    const [isBlocking, setIsBlocking] = useState(false);
    const [isReady, setIsReady] = useState(false);
  
    // Initialize once on mount. Uses the single-call initialize() from Session 4
    // so we don't hammer the bridge with three calls on every app launch.
    useEffect(() => {
      if (!focusLockService.isSupported) {
        setIsReady(true);
        return;
      }
  
      focusLockService.initialize()
        .then(state => {
          setIsAuthorized(state.authorizationStatus === 'approved');
          setSelectionCount(state.selection.totalCount);
          setIsBlocking(state.blocking.isBlocking);
        })
        .catch(err => {
          console.warn('[FocusLock] Initialization failed (non-critical):', err.message);
        })
        .finally(() => setIsReady(true));
    }, []);
  
    // Whether the Focus Lock toggle should be visible to the user.
    // Requires authorization AND at least one app selected.
    const isAvailable = focusLockService.isSupported && isAuthorized && selectionCount > 0;
  
    const startBlocking = useCallback(async () => {
      if (!isAvailable) return;
      try {
        const result = await focusLockService.startBlocking();
        setIsBlocking(result.isBlocking);
      } catch (err) {
        console.warn('[FocusLock] startBlocking failed (non-critical):', err.message);
      }
    }, [isAvailable]);
  
    const stopBlocking = useCallback(async () => {
      if (!focusLockService.isSupported) return;
      try {
        const result = await focusLockService.stopBlocking();
        setIsBlocking(result.isBlocking);
      } catch (err) {
        console.warn('[FocusLock] stopBlocking failed (non-critical):', err.message);
      }
    }, []);
  
    // Called after the user configures apps in FocusLockTest screen,
    // so HomeScreen reflects the updated count without re-initializing.
    const refreshSelection = useCallback(async () => {
      if (!focusLockService.isSupported) return;
      try {
        const result = await focusLockService.getSelectionCount();
        setSelectionCount(result.totalCount);
        const status = await focusLockService.getAuthorizationStatus();
        setIsAuthorized(status === 'approved');
      } catch (err) {
        console.warn('[FocusLock] refreshSelection failed:', err.message);
      }
    }, []);
  
    return (
      <FocusLockContext.Provider
        value={{
          isReady,
          isAuthorized,
          isAvailable,
          isBlocking,
          selectionCount,
          startBlocking,
          stopBlocking,
          refreshSelection,
        }}
      >
        {children}
      </FocusLockContext.Provider>
    );
  }
  
  export function useFocusLock() {
    const context = useContext(FocusLockContext);
    if (!context) {
      throw new Error('useFocusLock must be used within FocusLockProvider');
    }
    return context;
  }