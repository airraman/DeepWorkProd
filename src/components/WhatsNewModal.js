import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const FEATURES = [
  {
    icon: '🔒',
    title: 'Focus Lock',
    description: 'Block distracting apps during your sessions and stay in the zone.',
  },
  {
    icon: '⚡',
    title: 'Quick Restart',
    description: 'Pick up exactly where you left off without losing momentum.',
  },
  {
    icon: '📈',
    title: 'Weekly Insights',
    description: 'See your streaks, patterns, and weekly focus trends at a glance.',
  },
  {
    icon: '🔔',
    title: 'Smart Notifications',
    description: 'Get timely reminders that adapt to how you work.',
  },
];

const SCROLL_THRESHOLD = 0.95;

export function WhatsNewModal({ visible, onComplete }) {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasStartedScrolling, setHasStartedScrolling] = useState(false);

  // CTA animation values
  const ctaOpacity = useRef(new Animated.Value(0.35)).current;
  const ctaScale = useRef(new Animated.Value(0.97)).current;

  // "Scroll to continue" hint fade
  const hintOpacity = useRef(new Animated.Value(1)).current;

  // Bottom gradient fade (fades out once user reaches bottom)
  const gradientOpacity = useRef(new Animated.Value(1)).current;

  // Progress bar width (0–100%)
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset all state when modal hides
      setIsScrolledToBottom(false);
      setScrollProgress(0);
      setHasStartedScrolling(false);
      ctaOpacity.setValue(0.35);
      ctaScale.setValue(0.97);
      hintOpacity.setValue(1);
      gradientOpacity.setValue(1);
      progressWidth.setValue(0);
    }
  }, [visible]);

  const handleScroll = ({ nativeEvent }) => {
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;

    if (!hasStartedScrolling && contentOffset.y > 4) {
      setHasStartedScrolling(true);
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    const progress = Math.min(
      (contentOffset.y + layoutMeasurement.height) / contentSize.height,
      1
    );
    setScrollProgress(progress);

    Animated.timing(progressWidth, {
      toValue: progress * 100,
      duration: 60,
      useNativeDriver: false,
    }).start();

    const reachedBottom = progress >= SCROLL_THRESHOLD;
    if (reachedBottom && !isScrolledToBottom) {
      setIsScrolledToBottom(true);

      // Fade out bottom gradient
      Animated.timing(gradientOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Unlock CTA with animation
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(ctaScale, {
          toValue: 1,
          tension: 70,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Haptic feedback when CTA unlocks
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {
        // Haptics unavailable — no-op
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {/* non-dismissible until scrolled */}}
    >
      <View style={styles.container}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DeepWork just got better</Text>
          <Text style={styles.subtitle}>New features to help you stay consistent</Text>
        </View>

        {/* Scrollable content */}
        <View style={styles.scrollWrapper}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {FEATURES.map((feature) => (
              <View key={feature.title} style={styles.featureRow}>
                <View style={styles.iconBox}>
                  <Text style={styles.icon}>{feature.icon}</Text>
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.description}</Text>
                </View>
              </View>
            ))}

            {/* Bottom spacer so last item isn't obscured by the gradient */}
            <View style={styles.scrollBottomSpacer} />
          </ScrollView>

          {/* Fade gradient — hints there's more content */}
          <Animated.View
            style={[styles.bottomGradient, { opacity: gradientOpacity }]}
            pointerEvents="none"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {/* "Scroll to continue" hint */}
          <Animated.Text style={[styles.scrollHint, { opacity: hintOpacity }]}>
            Scroll to continue ↓
          </Animated.Text>

          <Animated.View style={{ opacity: ctaOpacity, transform: [{ scale: ctaScale }] }}>
            <TouchableOpacity
              style={[
                styles.ctaButton,
                !isScrolledToBottom && styles.ctaButtonDisabled,
              ]}
              onPress={isScrolledToBottom ? onComplete : undefined}
              activeOpacity={0.85}
              disabled={!isScrolledToBottom}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#E5E7EB',
    width: '100%',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  scrollWrapper: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  scrollBottomSpacer: {
    height: 48,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  icon: {
    fontSize: 22,
  },
  featureText: {
    flex: 1,
    paddingTop: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#FFFFFF',
    // Simulated fade: a solid white cap — enough to signal more content below
    opacity: 0.92,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  scrollHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
