import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const SubscriptionContext = createContext();

// Replace with your actual keys from RevenueCat dashboard
const REVENUE_CAT_KEYS = {
  ios: 'appl_opyzYEYLDpujoQBxsbUtJhovcFC',
  android: 'goog_YOUR_ANDROID_KEY',
};

const DEV_PREMIUM_OVERRIDE_KEY = '@dev_premium_override';

export function SubscriptionProvider({ children }) {
  // RevenueCat and the Firestore premiumOverride are two independent
  // entitlement sources. Each is tracked separately (null = not yet
  // resolved) and isPremium is derived as rcPremium || overridePremium
  // below, so a failure/stale result on one source can never erase a
  // confirmed true from the other.
  const [rcPremium, setRcPremium] = useState(null);
  const [overridePremium, setOverridePremium] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devPremiumOverride, setDevPremiumOverrideState] = useState(null); // null | true | false

  // Incremented on every auth event. Async results only get committed if
  // they still belong to the latest generation, so a stale/overlapping
  // check (e.g. from a duplicate onAuthStateChanged firing) can't clobber
  // a newer, correct result.
  const requestGenRef = useRef(0);
  const rcLoggedInRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      loadDevPremiumOverride();
    }

    let rcConfigured = false;

    // Wait for Firebase Auth to restore the session before checking entitlements.
    // auth().currentUser is null on cold start, so checking synchronously would
    // skip the UID login and return no entitlements for an anonymous RevenueCat user.
    const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
      const myGen = ++requestGenRef.current;

      try {
        if (!rcConfigured) {
          const apiKey = Platform.select(REVENUE_CAT_KEYS);
          Purchases.configure({ apiKey });
          Purchases.addCustomerInfoUpdateListener(updateSubscriptionStatus);
          rcConfigured = true;
        }

        if (!user?.uid) {
          // No authenticated user — don't run a full entitlement calculation.
          // Log RevenueCat out (if it was logged in as a previous user) so its
          // SDK identity doesn't linger into the next sign-in, and clear both
          // entitlement states so a signed-out session never reads as premium.
          if (rcLoggedInRef.current) {
            try {
              await Purchases.logOut();
            } catch (logoutError) {
              console.warn('[Subscription] RevenueCat logOut error (non-critical):', logoutError.message);
            }
            rcLoggedInRef.current = false;
          }
          if (myGen === requestGenRef.current) {
            setRcPremium(false);
            setOverridePremium(false);
            setIsLoading(false);
          }
          return;
        }

        await Purchases.logIn(user.uid);
        rcLoggedInRef.current = true;
        console.log('[Subscription] RevenueCat logged in with uid:', user.uid.substring(0, 8) + '...');

        await checkSubscriptionStatus(myGen, user);
      } catch (error) {
        console.error('RevenueCat initialization error:', error);
        if (myGen === requestGenRef.current) {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  async function loadDevPremiumOverride() {
    const stored = await AsyncStorage.getItem(DEV_PREMIUM_OVERRIDE_KEY);
    if (stored !== null) {
      setDevPremiumOverrideState(stored === 'true');
    }
  }

  async function setDevPremiumOverride(value) {
    if (!__DEV__) return;
    if (value === null) {
      await AsyncStorage.removeItem(DEV_PREMIUM_OVERRIDE_KEY);
    } else {
      await AsyncStorage.setItem(DEV_PREMIUM_OVERRIDE_KEY, String(value));
    }
    setDevPremiumOverrideState(value);
  }

  // Evaluate RevenueCat and the Firestore premiumOverride independently for
  // the given auth generation/user. Each source has its own try/catch, so a
  // failure on one never prevents the other's result from being recorded,
  // and a failure never overwrites an already-confirmed true with false —
  // it just leaves that source's state as-is (last known-good). Results are
  // only committed if myGen is still the current generation, so a stale
  // call from an earlier/overlapping auth event can't win a race against a
  // newer one.
  async function checkSubscriptionStatus(myGen, user) {
    const revenueCatCheck = (async () => {
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const hasRevenueCat = customerInfo.entitlements.active['Pro'] !== undefined;
        if (myGen === requestGenRef.current) {
          setRcPremium(hasRevenueCat);
        }
      } catch (error) {
        console.error('[Subscription] RevenueCat check failed (non-critical, preserving prior state):', error.message);
      }
    })();

    const overrideCheck = (async () => {
      try {
        // Firestore override for comped users. Add a doc at
        // premium_overrides/{email.trim().toLowerCase()} via Firebase Console
        // to grant free premium. This must be a targeted single-document read
        // (not a collection scan) — Firestore rules only allow a user to read
        // the override doc matching their own normalized email, not list the
        // collection, so an existing doc with a non-normalized ID (mixed case
        // or stray whitespace) will silently not match.
        const email = user?.email?.trim().toLowerCase();
        let hasOverride = false;
        if (email) {
          const doc = await firestore().collection('premium_overrides').doc(email).get();
          hasOverride = doc.exists;
          if (hasOverride) {
            console.log('[Subscription] Premium granted via Firestore override');
          }
        }
        if (myGen === requestGenRef.current) {
          setOverridePremium(hasOverride);
        }
      } catch (error) {
        // Logged by uid, not email, to avoid PII in production logs. Do not
        // touch overridePremium here — an error (e.g. permission-denied) must
        // never be treated as proof the user lacks an override; the prior
        // known-good state (or null while never-yet-resolved) is preserved.
        console.error(
          '[Subscription] Premium override lookup failed for uid',
          user?.uid,
          '(non-critical, preserving prior state):',
          error.message
        );
      }
    })();

    await Promise.allSettled([revenueCatCheck, overrideCheck]);

    if (myGen === requestGenRef.current) {
      setIsLoading(false);
    }
  }

  // RevenueCat CustomerInfoUpdateListener — updates only the RevenueCat-
  // specific entitlement state. It never touches the Firestore-override
  // state and never writes a combined isPremium value directly, so it can't
  // downgrade a user who is premium solely via the override.
  function updateSubscriptionStatus(customerInfo) {
    if (!auth().currentUser) return; // ignore updates while signed out
    const hasAccess = customerInfo.entitlements.active['Pro'] !== undefined;
    setRcPremium(hasAccess);
  }

  const combinedIsPremium = rcPremium === true || overridePremium === true;
  const effectiveIsPremium = __DEV__ && devPremiumOverride !== null ? devPremiumOverride : combinedIsPremium;

  const value = {
    isPremium: effectiveIsPremium,
    isLoading,
    checkSubscriptionStatus: () => {
      const user = auth().currentUser;
      if (!user?.uid) return Promise.resolve();
      const myGen = ++requestGenRef.current;
      return checkSubscriptionStatus(myGen, user);
    },

    // Add these for MetricsScreen compatibility
    isSubscribed: effectiveIsPremium,        // Alias for isPremium
    canGenerateInsights: effectiveIsPremium, // AI insights are premium-only

    // Dev-only premium testing override (no-op outside __DEV__)
    devPremiumOverride,
    setDevPremiumOverride,
  };


  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};
