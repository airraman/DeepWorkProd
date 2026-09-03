import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';
import { themeColors, THEMES } from '../../../context/ThemeContext';
import { spacing, radius, typeScale, pressFeedback, shadow } from '../../../theme/insightTokens';

// SessionRatingScreen always uses the Insight Card dark surface language,
// independent of the app-wide light/dark theme toggle.
const dark = themeColors[THEMES.DARK];

const colors = {
  screenBackground: '#0f0f0f', // matches insightTokens.sheet.background
  surface: dark.cardBackground, // #111111
  border: dark.cardBorder, // #1e1e1e
  track: dark.track, // #1a1a1a
  primaryText: '#f0f0f0',
  secondaryText: dark.subText, // #555555
  green: dark.success, // #4ade80
};

// Press feedback shared across all tappable elements on this screen.
const pressedStyle = { opacity: pressFeedback.opacity, transform: [{ scale: pressFeedback.scale }] };

// ─── Custom slider ────────────────────────────────────────────────────────────
function CustomSlider({ value, onValueChange, min = 1, max = 5 }) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${percentage}%` }]} />
      </View>
      <View style={sliderStyles.buttonsRow}>
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(num => (
          <Pressable
            key={num}
            onPress={() => onValueChange(num)}
            style={({ pressed }) => [
              sliderStyles.numberButton,
              value === num && sliderStyles.numberButtonActive,
              pressed && pressedStyle,
            ]}
          >
            <Text style={[sliderStyles.numberText, value === num && sliderStyles.numberTextActive]}>
              {num}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SessionRatingScreen({ navigation, route }) {
  const { sessionId } = route.params;

  // Sliders
  const [focusRating, setFocusRating] = useState(3);
  const [productivityRating, setProductivityRating] = useState(3);
  const [slidersTouched, setSlidersTouched] = useState(false);

  // Reflection — single field, source of truth for all downstream AI insights
  const [workedOn, setWorkedOn] = useState('');

  const workedOnRef = useRef(null);

  const workedOnReady = workedOn.length >= 3;
  const workedOnBorderColor = workedOnReady ? colors.green : colors.border;

  const handleSliderChange = (setter) => (val) => {
    setter(val);
    setSlidersTouched(true);
  };

  const handleContinue = async () => {
    try {
      await sessionService.saveRating(sessionId, {
        rating: Math.round((focusRating + productivityRating) / 2),
        focus: focusRating,
        productivity: productivityRating,
        reflection: {
          workedOn: workedOn.trim(),
        },
        ratedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save rating:', error);
    }
    navigation.navigate('SessionSummary', { sessionId });
  };

  const handleSkipAttempt = () => {
    if (slidersTouched) {
      // User interacted with sliders — confirm before abandoning reflection
      Alert.alert(
        'Skip reflection?',
        'Are you sure? Notes help Lucid analyze your patterns.',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Skip Anyway',
            style: 'destructive',
            onPress: () => navigation.navigate('SessionSummary', { sessionId }),
          },
        ]
      );
    } else {
      navigation.navigate('SessionSummary', { sessionId });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Lucid</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>RATE YOUR SESSION</Text>

            {/* ── Sliders (required, position: top) ── */}
            <View style={styles.sliderSection}>
              <CustomSlider
                value={focusRating}
                onValueChange={handleSliderChange(setFocusRating)}
              />
              <Text style={styles.sliderLabel}>How focused did you feel</Text>
            </View>

            <View style={styles.sliderSectionLast}>
              <CustomSlider
                value={productivityRating}
                onValueChange={handleSliderChange(setProductivityRating)}
              />
              <Text style={styles.sliderLabel}>
                How much do you feel like you{'\n'}accomplished?
              </Text>
            </View>

            {/* ── Divider ── */}
            <View style={styles.divider} />

            {/* ── Primary capture prompt ── */}
            <Text style={styles.captureHint}>
              Capture what you worked on before you lose it.
            </Text>
            <Text style={styles.nudgeText}>
              The more detail you include, the more accurate your insights will be.
            </Text>
            <Text style={styles.workedOnLabel}>What did you work on?</Text>
            <TextInput
              ref={workedOnRef}
              style={[styles.workedOnInput, { borderColor: workedOnBorderColor }]}
              placeholder="e.g. deck, coding, writing"
              placeholderTextColor={colors.secondaryText}
              value={workedOn}
              onChangeText={setWorkedOn}
              autoFocus
              maxLength={120}
              returnKeyType="done"
            />
            {workedOn.length > 0 && workedOn.length < 3 && (
              <Text style={styles.hintText}>Keep going — 1–5 words works great</Text>
            )}
          </View>

          {/* ── Actions ── */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [styles.continueButton, pressed && pressedStyle]}
              onPress={handleContinue}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.skipButton, pressed && pressedStyle]}
              onPress={handleSkipAttempt}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  header: {
    paddingVertical: spacing.xl,
  },
  logo: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryText,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
    ...shadow.card.wide,
    shadowColor: '#000000',
  },
  title: {
    ...typeScale.statSmall,
    color: colors.primaryText,
    marginBottom: spacing.xxxl,
    textAlign: 'center',
  },
  sliderSection: {
    marginBottom: spacing.xxxl,
  },
  sliderSectionLast: {
    marginBottom: spacing.xl,
  },
  sliderLabel: {
    ...typeScale.cardValue,
    color: colors.primaryText,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xxl,
  },
  captureHint: {
    ...typeScale.subText,
    color: colors.secondaryText,
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  nudgeText: {
    ...typeScale.subText,
    color: colors.secondaryText,
    marginBottom: spacing.lg,
    textAlign: 'left',
  },
  workedOnLabel: {
    ...typeScale.cardValue,
    color: colors.primaryText,
    marginBottom: spacing.sm,
  },
  workedOnInput: {
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.primaryText,
    backgroundColor: colors.screenBackground,
    // borderColor set dynamically
  },
  hintText: {
    ...typeScale.subText,
    color: colors.secondaryText,
    marginTop: spacing.xs,
  },
  // Actions
  buttonContainer: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.green,
    paddingVertical: spacing.lg,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.screenBackground,
    fontSize: 14,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typeScale.cardValue,
    color: colors.secondaryText,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 4,
    backgroundColor: colors.track,
    borderRadius: 2,
    marginBottom: spacing.xl,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.green,
    borderRadius: 2,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.track,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonActive: {
    backgroundColor: colors.green,
  },
  numberText: {
    fontSize: 12,
    color: colors.secondaryText,
    fontWeight: '600',
  },
  numberTextActive: {
    color: colors.screenBackground,
  },
});
