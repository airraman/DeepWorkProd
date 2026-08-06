import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [devPremiumOverride, setDevPremiumOverrideState] = useState(null); // null | true | false

  useEffect(() => {
    if (__DEV__) {
      loadDevPremiumOverride();
    }

    let rcInitialized = false;

    // Wait for Firebase Auth to restore the session before checking entitlements.
    // auth().currentUser is null on cold start, so checking synchronously would
    // skip the UID login and return no entitlements for an anonymous RevenueCat user.
    const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
      try {
        if (!rcInitialized) {
          const apiKey = Platform.select(REVENUE_CAT_KEYS);
          Purchases.configure({ apiKey });
          Purchases.addCustomerInfoUpdateListener(updateSubscriptionStatus);
          rcInitialized = true;
        }

        if (user?.uid) {
          await Purchases.logIn(user.uid);
          console.log('[Subscription] RevenueCat logged in with uid:', user.uid.substring(0, 8) + '...');
        }

        await checkSubscriptionStatus();
      } catch (error) {
        console.error('RevenueCat initialization error:', error);
        setIsLoading(false);
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

  async function checkSubscriptionStatus() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const hasRevenueCat = customerInfo.entitlements.active['Pro'] !== undefined;

      // Firestore override for comped users. Add a doc at
      // premium_overrides/{email} via Firebase Console to grant free premium.
      // Doc IDs are entered manually and their casing is inconsistent, so
      // match case-insensitively against every doc ID rather than doing a
      // direct .doc(email).get() lookup.
      let hasOverride = false;
      const email = auth().currentUser?.email?.toLowerCase();
      if (email) {
        const snapshot = await firestore().collection('premium_overrides').get();
        hasOverride = snapshot.docs.some((doc) => doc.id.toLowerCase() === email);
        if (hasOverride) {
          console.log('[Subscription] Premium granted via Firestore override');
        }
      }

      setIsPremium(hasRevenueCat || hasOverride);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }

  function updateSubscriptionStatus(customerInfo) {
    const hasAccess = customerInfo.entitlements.active['Pro'] !== undefined;
    // Note: updateSubscriptionStatus is called by the RevenueCat listener only —
    // it does not re-check the Firestore override. checkSubscriptionStatus() handles
    // the full check including the override on app launch.
    setIsPremium(prev => prev || hasAccess);
  }

  const effectiveIsPremium = __DEV__ && devPremiumOverride !== null ? devPremiumOverride : isPremium;

  const value = {
    isPremium: effectiveIsPremium,
    isLoading,
    checkSubscriptionStatus,
    setIsPremium, // exposed for dev tooling only

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