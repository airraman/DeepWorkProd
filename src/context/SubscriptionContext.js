import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    initializePurchases();
    if (__DEV__) {
      loadDevPremiumOverride();
    }
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

  async function initializePurchases() {
    try {
      const apiKey = Platform.select(REVENUE_CAT_KEYS);
      await Purchases.configure({ apiKey });
      
      // Check initial status
      await checkSubscriptionStatus();
      
      // Listen for purchase updates
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        updateSubscriptionStatus(customerInfo);
      });
    } catch (error) {
      console.error('RevenueCat initialization error:', error);
      setIsLoading(false);
    }
  }

  async function checkSubscriptionStatus() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      updateSubscriptionStatus(customerInfo);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }

  function updateSubscriptionStatus(customerInfo) {
    // 'premium' is your entitlement identifier - we'll set this up in dashboard next
    const hasAccess = customerInfo.entitlements.active['Pro'] !== undefined;
    setIsPremium(hasAccess);
  }

  const effectiveIsPremium = __DEV__ && devPremiumOverride !== null ? devPremiumOverride : isPremium;

  const value = {
    isPremium: effectiveIsPremium,
    isLoading,
    checkSubscriptionStatus,

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