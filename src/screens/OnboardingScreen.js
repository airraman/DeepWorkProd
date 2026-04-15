// src/screens/OnboardingScreen.js
//
// 5-step onboarding flow:
//   1. Welcome         — positioning + value prop
//   2. Use case        — student / worker / creative / developer / entrepreneur / other
//   3. Activities      — 1–2 named + coloured activities
//   4. App blocking    — FamilyControls picker (skippable)
//   5. Paywall intro   — creator-led light CTA, not hard gate
//
// Data is written once at the very end of step 5 so we never leave partial state.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import Purchases from 'react-native-purchases';
import { deepWorkStore } from '../services/deepWorkStore';
import focusLockService from '../services/focusLockService';

const { width } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const USE_CASES = [
  { id: 'student',      label: 'Student',       icon: '📚' },
  { id: 'worker',       label: 'Professional',  icon: '💼' },
  { id: 'creative',     label: 'Creative',      icon: '🎨' },
  { id: 'developer',    label: 'Developer',     icon: '💻' },
  { id: 'entrepreneur', label: 'Entrepreneur',  icon: '🚀' },
  { id: 'other',        label: 'Other',         icon: '✨' },
];

const COLOR_OPTIONS = [
  '#ffb3ba', '#ffcc99', '#ffffba', '#baffc9',
  '#bae1ff', '#d9baff', '#ffb3f7', '#b3f0d4',
  '#ffd9b3', '#fff5cc', '#b3d9ff', '#ffc9f0',
];

const TOTAL_STEPS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeActivity = (id, name = '', color = '#bae1ff') => ({ id, name, color });

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressDots({ current }) {
  return (
    <View style={styles.dotsContainer}>
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i + 1 === current && styles.dotActive]}
          />
        ))}
      </View>
      <Text style={styles.stepLabel}>{current} of {TOTAL_STEPS}</Text>
    </View>
  );
}

function StepWrapper({ children, step, onBack }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <ProgressDots current={step} />
        <View style={styles.backBtn} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }) {
  return (
    <StepWrapper step={1} onBack={null}>
      <View style={styles.centerBlock}>
        <Text style={styles.heroEmoji}>🧠</Text>
        <Text style={styles.heroTitle}>Block out noise.{'\n'}Make progress.</Text>
        <Text style={styles.heroSub}>
          DeepWork.io helps you tap into your unique focus rhythm, unlocking deep creativity and consistency.
        </Text>
      </View>
      <View style={styles.featureList}>
        {[
          ['⏱', 'Timed focus sessions with end-of-session alerts'],
          ['📵', 'Block distracting apps while you work'],
          ['📈', 'Unlock insights about your focus habits'],
        ].map(([icon, text]) => (
          <View key={text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.primaryBtn} onPress={onNext}>
        <Text style={styles.primaryBtnText}>Get Started</Text>
      </TouchableOpacity>
    </StepWrapper>
  );
}

// ─── Step 2: Use Case ─────────────────────────────────────────────────────────

function UseCaseStep({ selected, onSelect, onNext, onBack }) {
  return (
    <StepWrapper step={2} onBack={onBack}>
      <Text style={styles.stepTitle}>What best describes you?</Text>
      <Text style={styles.stepSub}>We'll personalise your experience.</Text>
      <View style={styles.useCaseGrid}>
        {USE_CASES.map((uc) => (
          <TouchableOpacity
            key={uc.id}
            style={[styles.useCaseCard, selected === uc.id && styles.useCaseCardSelected]}
            onPress={() => onSelect(uc.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.useCaseIcon}>{uc.icon}</Text>
            <Text style={[styles.useCaseLabel, selected === uc.id && styles.useCaseLabelSelected]}>
              {uc.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, !selected && styles.primaryBtnDisabled]}
        onPress={onNext}
        disabled={!selected}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
      </TouchableOpacity>
      {!selected && (
        <Text style={styles.hintText}>Tap a card above to continue</Text>
      )}
    </StepWrapper>
  );
}

// ─── Step 3: Activities ───────────────────────────────────────────────────────

function ActivitiesStep({ activities, onUpdate, onNext, onBack }) {
  const [pickerFor, setPickerFor] = useState(null);

  const updateName = (id, name) => {
    onUpdate(activities.map(a => a.id === id ? { ...a, name } : a));
  };

  const updateColor = (id, color) => {
    onUpdate(activities.map(a => a.id === id ? { ...a, color } : a));
    setPickerFor(null);
  };

  const canContinue = activities.some(a => a.name.trim().length > 0);

  return (
    <StepWrapper step={3} onBack={onBack}>
      <Text style={styles.stepTitle}>What will you focus on?</Text>
      <Text style={styles.stepSub}>
        Add 1–2 activities. You can change these later.
      </Text>

      {activities.map((activity, idx) => (
        <View key={activity.id} style={styles.activityRow}>
          <TouchableOpacity
            style={[styles.colorSwatch, { backgroundColor: activity.color }]}
            onPress={() => setPickerFor(pickerFor === activity.id ? null : activity.id)}
          />
          <TextInput
            style={styles.activityInput}
            placeholder={idx === 0 ? 'e.g. Deep Work' : 'Second activity (optional)'}
            placeholderTextColor="#9ca3af"
            value={activity.name}
            onChangeText={text => updateName(activity.id, text)}
            maxLength={30}
          />
        </View>
      ))}

      {pickerFor && (
        <View style={styles.colorPicker}>
          {COLOR_OPTIONS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.colorOption, { backgroundColor: c }]}
              onPress={() => updateColor(pickerFor, c)}
            />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
        onPress={onNext}
        disabled={!canContinue}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
      </TouchableOpacity>
      {!canContinue && (
        <Text style={styles.hintText}>Name at least one activity to continue</Text>
      )}
    </StepWrapper>
  );
}

// ─── Step 4: App Blocking ─────────────────────────────────────────────────────

function AppBlockingStep({ onNext, onSkip, onBack }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | selecting | done | error | unsupported

  useEffect(() => {
    if (!focusLockService.isSupported) {
      setStatus('unsupported');
    }
  }, []);

  const handleSetup = async () => {
    setStatus('requesting');
    try {
      const result = await focusLockService.requestAuthorization();
      // Native module resolves with "authorized" on success (see FocusLockModule.swift:67)
      // getAuthorizationStatus returns "approved" — handle both strings
      const authorized = result === 'authorized' || result === 'approved' || result === true ||
        (typeof result === 'object' && result?.authorizationStatus === 'approved');
      if (!authorized) {
        setStatus('error');
        return;
      }
      setStatus('selecting');
      await focusLockService.selectAppsToBlock();
      setStatus('done');
    } catch (err) {
      console.warn('[Onboarding] App blocking setup error:', err);
      setStatus('error');
    }
  };

  return (
    <StepWrapper step={4} onBack={onBack}>
      <Text style={styles.stepTitle}>Block distractions</Text>
      <Text style={styles.stepSub}>
        Choose which apps to block during your focus sessions. iOS enforces
        this at the OS level — even if you close DeepWork.
      </Text>

      <View style={styles.blockingIllustration}>
        <Text style={styles.blockingEmoji}>📵</Text>
        <Text style={styles.blockingCaption}>
          Powered by Apple Screen Time (FamilyControls)
        </Text>
      </View>

      {status === 'done' && (
        <View style={styles.successRow}>
          <Text style={styles.successText}>✅ Apps selected — you're all set!</Text>
        </View>
      )}
      {status === 'error' && (
        <View style={styles.successRow}>
          <Text style={styles.errorText}>
            Permission denied. Open Settings → Screen Time → DeepWork to enable FamilyControls, then try again.
          </Text>
        </View>
      )}
      {status === 'unsupported' && (
        <View style={styles.successRow}>
          <Text style={styles.errorText}>
            App blocking requires iOS with FamilyControls. Not available on this device.
          </Text>
        </View>
      )}

      {status === 'selecting' && (
        <View style={styles.selectingHint}>
          <Text style={styles.selectingHintText}>
            Select the apps you want to block, then tap{' '}
            <Text style={styles.selectingHintBold}>Done</Text>
            {' '}in the top-right of the picker.
          </Text>
        </View>
      )}

      {status === 'done' ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={onNext}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      ) : status === 'unsupported' ? null : (
        <TouchableOpacity
          style={[styles.primaryBtn, (status === 'requesting' || status === 'selecting') && styles.primaryBtnDisabled]}
          onPress={handleSetup}
          disabled={status === 'requesting' || status === 'selecting'}
        >
          {status === 'requesting' || status === 'selecting' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {status === 'error' ? 'Try Again' : 'Choose Apps to Block'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>
          {status === 'error' || status === 'unsupported' ? 'Continue without blocking' : 'Skip for now'}
        </Text>
      </TouchableOpacity>
    </StepWrapper>
  );
}

// ─── Step 5: Paywall Intro ────────────────────────────────────────────────────

function PaywallStep({ onStart, onBack, saving }) {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadOfferings();
  }, []);

  async function loadOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current?.availablePackages) {
        const pkgs = offerings.current.availablePackages;
        setPackages(pkgs);
        // Auto-select annual if present, otherwise first package
        const annual = pkgs.find(p => p.packageType === Purchases.PACKAGE_TYPE.ANNUAL);
        setSelectedPackage((annual ?? pkgs[0])?.identifier ?? null);
      }
    } catch (err) {
      console.warn('[Onboarding] Failed to load offerings:', err);
    } finally {
      setLoadingOfferings(false);
    }
  }

  async function handlePurchase() {
    const pkg = packages.find(p => p.identifier === selectedPackage);
    if (!pkg) return;
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (customerInfo.entitlements.active['Pro']) {
        onStart();
      }
    } catch (err) {
      if (!err.userCancelled) {
        Alert.alert('Purchase Failed', err.message);
      }
    } finally {
      setPurchasing(false);
    }
  }

  function getDisplayName(pkg) {
    if (pkg.product.title) return pkg.product.title;
    switch (pkg.packageType) {
      case Purchases.PACKAGE_TYPE.MONTHLY:  return 'Monthly';
      case Purchases.PACKAGE_TYPE.ANNUAL:   return 'Annual';
      case Purchases.PACKAGE_TYPE.LIFETIME: return 'Lifetime';
      default: return 'Premium';
    }
  }

  function getPeriod(pkg) {
    switch (pkg.packageType) {
      case Purchases.PACKAGE_TYPE.MONTHLY:  return 'per month';
      case Purchases.PACKAGE_TYPE.ANNUAL:   return 'per year';
      case Purchases.PACKAGE_TYPE.LIFETIME: return 'one-time';
      default: return '';
    }
  }

  const busy = purchasing || saving;

  return (
    <StepWrapper step={5} onBack={onBack}>
      <View style={styles.centerBlock}>
        <Text style={styles.heroEmoji}>🎯</Text>
        <Text style={styles.stepTitle}>Unlock your full potential.</Text>
        <Text style={styles.stepSub}>
          Start free, or go Pro to unlock everything from day one.
        </Text>
      </View>

      <View style={styles.proList}>
        {[
          ['⏱', 'Unlimited focus sessions'],
          ['📊', 'Intelligent weekly insights'],
          ['📵', 'Full app blocking during sessions'],
          ['🔔', 'Smart reminders & streaks'],
        ].map(([icon, text]) => (
          <View key={text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      {loadingOfferings ? (
        <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
      ) : packages.length > 0 ? (
        <>
          <View style={styles.packagesContainer}>
            {packages.map(pkg => {
              const isSelected = selectedPackage === pkg.identifier;
              const isAnnual = pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                  onPress={() => setSelectedPackage(pkg.identifier)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  {isAnnual && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>Best Value</Text>
                    </View>
                  )}
                  <View style={styles.packageContent}>
                    <View style={styles.packageLeft}>
                      <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View>
                        <Text style={[styles.packageName, isSelected && styles.packageNameSelected]}>
                          {getDisplayName(pkg)}
                        </Text>
                        <Text style={styles.packagePeriod}>{getPeriod(pkg)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.packagePrice, isSelected && styles.packagePriceSelected]}>
                      {pkg.product.priceString}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!selectedPackage || busy) && styles.primaryBtnDisabled]}
            onPress={handlePurchase}
            disabled={!selectedPackage || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Start Pro</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={onStart} disabled={busy}>
            <Text style={styles.skipText}>Continue with free plan</Text>
          </TouchableOpacity>

          <Text style={styles.legalNote}>
            Subscriptions auto-renew. Cancel anytime in Settings.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.offeringsUnavailable}>
            Subscription plans unavailable right now. You can upgrade anytime from Settings.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onStart} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Start Free</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </StepWrapper>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState(null);
  const [activities, setActivities] = useState([
    makeActivity('1', '', '#bae1ff'),
    makeActivity('2', '', '#baffc9'),
  ]);
  const [saving, setSaving] = useState(false);

  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const slideTransition = (callback, direction) => {
    // direction: 1 = forward (exit left, enter right), -1 = back (exit right, enter left)
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 0,               duration: 140, useNativeDriver: true }),
      Animated.timing(translateX,  { toValue: -28 * direction, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      translateX.setValue(28 * direction);
      callback();
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };

  const goTo = (next) => slideTransition(() => setStep(next), next > step ? 1 : -1);
  const goBack = () => goTo(step - 1);

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      // Build activities list — filter out blanks, keep ≤2
      const validActivities = activities
        .filter(a => a.name.trim().length > 0)
        .slice(0, 2)
        .map((a, i) => ({ id: String(i + 1), name: a.name.trim(), color: a.color }));

      // Save activities via existing method
      await deepWorkStore.updateActivities(validActivities);

      // Patch in onboarding metadata — safe merge, won't overwrite activities
      await deepWorkStore.patchSettings({
        userType,
        onboardingComplete: true,
      });

      navigation.replace('MainApp');
    } catch (err) {
      console.error('[Onboarding] Save failed:', err);
      setSaving(false);
    }
  };

  return (
    <Animated.View style={[styles.root, { opacity, transform: [{ translateX }] }]}>
      {step === 1 && <WelcomeStep onNext={() => goTo(2)} />}
      {step === 2 && (
        <UseCaseStep
          selected={userType}
          onSelect={setUserType}
          onNext={() => goTo(3)}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <ActivitiesStep
          activities={activities}
          onUpdate={setActivities}
          onNext={() => goTo(4)}
          onBack={goBack}
        />
      )}
      {step === 4 && (
        <AppBlockingStep
          onNext={() => goTo(5)}
          onSkip={() => goTo(5)}
          onBack={goBack}
        />
      )}
      {step === 5 && (
        <PaywallStep
          onStart={finishOnboarding}
          onBack={goBack}
          saving={saving}
        />
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: '#374151',
  },
  dotsContainer: {
    alignItems: 'center',
    gap: 5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  dotActive: {
    backgroundColor: '#2563EB',
    width: 18,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },

  // Hero block (step 1 + step 5)
  centerBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Feature rows
  featureList: {
    marginBottom: 36,
    gap: 12,
  },
  proList: {
    marginBottom: 32,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    lineHeight: 22,
  },

  // Step titles
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSub: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },

  // Use-case grid
  useCaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
  },
  useCaseCard: {
    width: (width - 72) / 3,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  useCaseCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#eff6ff',
  },
  useCaseIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  useCaseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  useCaseLabelSelected: {
    color: '#2563EB',
  },

  // Activity inputs
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activityInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  // App blocking step
  blockingIllustration: {
    alignItems: 'center',
    marginVertical: 24,
  },
  blockingEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  blockingCaption: {
    fontSize: 13,
    color: '#9ca3af',
  },
  successRow: {
    marginBottom: 16,
    alignItems: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#16a34a',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Buttons
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  selectingHint: {
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  selectingHintText: {
    fontSize: 14,
    color: '#bfdbfe',
    textAlign: 'center',
    lineHeight: 20,
  },
  selectingHintBold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  legalNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  hintText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  offeringsUnavailable: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },

  // Package cards (step 5)
  packagesContainer: {
    gap: 10,
    marginBottom: 16,
  },
  packageCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 14,
    position: 'relative',
  },
  packageCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#eff6ff',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bestValueText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  packageContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  packageName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  packageNameSelected: {
    color: '#2563EB',
  },
  packagePeriod: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  packagePriceSelected: {
    color: '#2563EB',
  },
});
