import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

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
    initializePurchases();
  }, []);

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

  const value = {
    isPremium,
    isLoading,
    checkSubscriptionStatus,
    
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