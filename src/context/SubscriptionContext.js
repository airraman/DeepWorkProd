import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const SubscriptionContext = createContext();

// Replace with your actual keys from RevenueCat dashboard
const REVENUE_CAT_KEYS = {
  ios: 'appl_opyzYEYLDpujoQBxsbUtJhovcFC',
  android: 'goog_YOUR_ANDROID_KEY',
};

export function SubscriptionProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

  async function checkSubscriptionStatus() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const hasRevenueCat = customerInfo.entitlements.active['Pro'] !== undefined;

      // Option A: Firestore override for comped users. Add a doc at
      // premium_overrides/{email} (e.g. "jane@example.com") via Firebase Console
      // to grant free premium. Keyed by email so you can pre-populate the list
      // before the user has signed up — takes effect the moment they create an account.
      let hasOverride = false;
      const email = auth().currentUser?.email;
      if (email) {
        const doc = await firestore().collection('premium_overrides').doc(email).get();
        hasOverride = doc.exists;
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

  const value = {
    isPremium,
    isLoading,
    checkSubscriptionStatus,
    setIsPremium, // exposed for dev tooling only

    // Add these for MetricsScreen compatibility
    isSubscribed: isPremium,        // Alias for isPremium
    canGenerateInsights: isPremium, // AI insights are premium-only
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