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

export function WhatsNewModal({ visible, onComplete }) {
  const [scrollProgress, setScrollProgress] = useState(0);

  // Progress bar width (0–100%)
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset scroll progress when modal hides
      setScrollProgress(0);
      progressWidth.setValue(0);
    }
  }, [visible]);

  const handleScroll = ({ nativeEvent }) => {
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;

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
  };

  const handleContinuePress = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {
      // Haptics unavailable — no-op
    }
    onComplete();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {/* non-dismissible except via Continue */}}
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
          <Text style={styles.title}>Lucid just got better</Text>
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

          {/* Fade gradient — hints there's more content; fades out as the
              user nears the bottom, purely a reading affordance (Continue
              is available regardless of scroll position). */}
          <Animated.View
            style={[
              styles.bottomGradient,
              {
                opacity: progressWidth.interpolate({
                  inputRange: [0, 90, 100],
                  outputRange: [0.92, 0.92, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            pointerEvents="none"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleContinuePress}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
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
  ctaButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
