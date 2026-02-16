import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Purchases from 'react-native-purchases';

export function PaywallModal({ visible, onClose, limitType }) {
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    if (visible) {
      loadOfferings();
    }
  }, [visible]);

  async function loadOfferings() {
    try {
      console.log('📦 Loading offerings...');
      const offerings = await Purchases.getOfferings();
      console.log('📦 Offerings received:', offerings);
      
      if (offerings.current?.availablePackages) {
        const pkgs = offerings.current.availablePackages;
        setPackages(pkgs);
        console.log('📦 Packages loaded:', pkgs.length);
        
        // Auto-select annual if available (best value)
        const annual = pkgs.find(pkg => 
          pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL
        );
        if (annual) {
          setSelectedPackage(annual.identifier);
        }
      } else {
        console.log('⚠️ No packages in current offering');
      }
    } catch (error) {
      console.error('❌ Error loading offerings:', error);
      Alert.alert('Error', 'Could not load subscription options');
    }
  }

  async function handlePurchase() {
    if (!selectedPackage) {
      Alert.alert('Please select a subscription option');
      return;
    }

    const pkg = packages.find(p => p.identifier === selectedPackage);
    if (!pkg) return;

    setIsLoading(true);
    try {
      console.log('💳 Attempting purchase:', pkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      if (customerInfo.entitlements.active['Pro']) {
        console.log('✅ Purchase successful!');
        Alert.alert('Success!', 'Welcome to Premium', [
          { text: 'Awesome!', onPress: onClose }
        ]);
      }
    } catch (error) {
      if (!error.userCancelled) {
        console.error('❌ Purchase error:', error);
        Alert.alert('Purchase Failed', error.message);
      } else {
        console.log('🚫 User cancelled purchase');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Helper function to get display name
  function getPackageDisplayName(pkg) {
    // Try to use product title first
    if (pkg.product.title) {
      return pkg.product.title;
    }
    
    // Fallback based on package type
    switch (pkg.packageType) {
      case Purchases.PACKAGE_TYPE.MONTHLY:
        return 'Monthly Premium';
      case Purchases.PACKAGE_TYPE.ANNUAL:
        return 'Annual Premium';
      case Purchases.PACKAGE_TYPE.LIFETIME:
        return 'Lifetime Access';
      default:
        return pkg.product.identifier.split('.').pop() || 'Premium';
    }
  }

  // Helper function to get period description
  function getPeriodDescription(pkg) {
    switch (pkg.packageType) {
      case Purchases.PACKAGE_TYPE.MONTHLY:
        return 'per month';
      case Purchases.PACKAGE_TYPE.ANNUAL:
        return 'per year';
      case Purchases.PACKAGE_TYPE.LIFETIME:
        return 'one-time payment';
      default:
        return '';
    }
  }

  // Helper function to determine if package is best value
  function isBestValue(pkg) {
    return pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL;
  }

  const limitMessages = {
    session: 'Unlock unlimited session time',
    activities: 'Add more than 2 activities',
    insights: 'Unlock AI-powered insights',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Subtitle */}
          <Text style={styles.subtitle}>{limitMessages[limitType]}</Text>

{/* Benefits List */}
<View style={styles.benefitsContainer}>
  <BenefitItem text="Unlimited session duration" />
  <BenefitItem text="More than 2 activities" />
  <BenefitItem text="AI-powered insights" />
</View>

          {/* Subscription Options */}
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>
          
          <View style={styles.packagesContainer}>
            {packages.map((pkg) => {
              const isSelected = selectedPackage === pkg.identifier;
              const showBestValue = isBestValue(pkg);
              
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isSelected && styles.packageCardSelected,
                  ]}
                  onPress={() => setSelectedPackage(pkg.identifier)}
                  disabled={isLoading}
                >
                  {showBestValue && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>Best Value</Text>
                    </View>
                  )}
                  
                  <View style={styles.packageContent}>
                    <View style={styles.packageLeft}>
                      <View style={[
                        styles.radioButton,
                        isSelected && styles.radioButtonSelected
                      ]}>
                        {isSelected && <View style={styles.radioButtonInner} />}
                      </View>
                      
                      <View style={styles.packageInfo}>
                        <Text style={[
                          styles.packageTitle,
                          isSelected && styles.packageTitleSelected
                        ]}>
                          {getPackageDisplayName(pkg)}
                        </Text>
                        <Text style={styles.packagePeriod}>
                          {getPeriodDescription(pkg)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.packageRight}>
                      <Text style={[
                        styles.packagePrice,
                        isSelected && styles.packagePriceSelected
                      ]}>
                        {pkg.product.priceString}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fine Print */}
          <Text style={styles.finePrint}>
            Subscriptions auto-renew unless cancelled 24 hours before the end of the current period.
          </Text>
        </ScrollView>

        {/* Purchase Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              (!selectedPackage || isLoading) && styles.purchaseButtonDisabled
            ]}
            onPress={handlePurchase}
            disabled={!selectedPackage || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={onClose} style={styles.restoreButton}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Helper component for benefit items
function BenefitItem({ text }) {
  return (
    <View style={styles.benefitItem}>
      <Text style={styles.benefitCheck}>✓</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  benefitsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitCheck: {
    fontSize: 18,
    color: '#2563EB',
    marginRight: 12,
    fontWeight: 'bold',
  },
  benefitText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  packagesContainer: {
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
    padding: 16,
    position: 'relative',
  },
  packageCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F0F7FF',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  packageContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#2563EB',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  packageTitleSelected: {
    color: '#2563EB',
  },
  packagePeriod: {
    fontSize: 13,
    color: '#666',
  },
  packageRight: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  packagePriceSelected: {
    color: '#2563EB',
  },
  finePrint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  purchaseButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    opacity: 0.5,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
});