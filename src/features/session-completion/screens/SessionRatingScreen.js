import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';

const ACCENT_DEFAULT = '#991B1B'; // dark red — urgency signal
const ACCENT_SUCCESS = '#15803D'; // green — success state at ≥3 chars

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
          <TouchableOpacity
            key={num}
            onPress={() => onValueChange(num)}
            style={[sliderStyles.numberButton, value === num && sliderStyles.numberButtonActive]}
          >
            <Text style={[sliderStyles.numberText, value === num && sliderStyles.numberTextActive]}>
              {num}
            </Text>
          </TouchableOpacity>
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
  const workedOnBorderColor = workedOnReady ? ACCENT_SUCCESS : ACCENT_DEFAULT;

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
        'Are you sure? Notes help DeepWork.io analyze your patterns.',
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
            <Text style={styles.logo}>DeepWork.io</Text>
          </View>

          <Text style={styles.title}>RATE YOUR SESSION</Text>

          {/* ── Sliders (required, position: top) ── */}
          <View style={styles.sliderSection}>
            <CustomSlider
              value={focusRating}
              onValueChange={handleSliderChange(setFocusRating)}
            />
            <Text style={styles.sliderLabel}>How focused did you feel</Text>
          </View>

          <View style={styles.sliderSection}>
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
          <Text style={styles.workedOnLabel}>What did you work on?</Text>
          <TextInput
            ref={workedOnRef}
            style={[styles.workedOnInput, { borderColor: workedOnBorderColor }]}
            placeholder="e.g. deck, coding, writing"
            placeholderTextColor="#9CA3AF"
            value={workedOn}
            onChangeText={setWorkedOn}
            autoFocus
            maxLength={120}
            returnKeyType="done"
          />
          {workedOn.length > 0 && workedOn.length < 3 && (
            <Text style={styles.hintText}>Keep going — 1–5 words works great</Text>
          )}

          {/* ── Actions ── */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipAttempt}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  header: {
    paddingVertical: 16,
  },
  logo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#000000',
    marginTop: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  sliderSection: {
    marginBottom: 40,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 24,
  },
  captureHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  workedOnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  workedOnInput: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
    // borderColor set dynamically
  },
  hintText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Actions
  buttonContainer: {
    marginTop: 32,
    gap: 12,
  },
  continueButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 4,
    backgroundColor: '#DDDDDD',
    borderRadius: 2,
    marginBottom: 16,
  },
  fill: {
    height: '100%',
    backgroundColor: '#000000',
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
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonActive: {
    backgroundColor: '#000000',
  },
  numberText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  numberTextActive: {
    color: '#FFFFFF',
  },
});
