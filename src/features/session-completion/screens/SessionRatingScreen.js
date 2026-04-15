import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';

const ACCENT_DEFAULT = '#991B1B'; // dark red — urgency signal
const ACCENT_SUCCESS = '#15803D'; // green — success state at ≥3 chars

// ─── Progressive prompt ───────────────────────────────────────────────────────
// Renders hidden until `visible` becomes true, then fades in once and stays.
// Exposes focus() via ref so the parent controls when keyboard advances.
const ProgressivePrompt = forwardRef(function ProgressivePrompt(
  { visible, label, placeholder, value, onChangeText, onLayout, returnKeyType, onSubmitEditing },
  ref
) {
  const [revealed, setRevealed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    if (visible && !revealed) {
      setRevealed(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!revealed) return null;

  return (
    <Animated.View style={[styles.promptBlock, { opacity }]} onLayout={onLayout}>
      <Text style={styles.promptLabel}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={styles.promptInput}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={2}
        textAlignVertical="top"
        returnKeyType={returnKeyType || 'default'}
        onSubmitEditing={onSubmitEditing}
        submitBehavior="newline"
      />
    </Animated.View>
  );
});

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

  // Reflection fields
  const [workedOn, setWorkedOn] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [distractions, setDistractions] = useState('');
  const [nextStep, setNextStep] = useState('');

  const scrollRef    = useRef(null);
  const workedOnRef  = useRef(null);
  const wentWellRef  = useRef(null);
  const distractRef  = useRef(null);
  const nextStepRef  = useRef(null);

  // y-offsets of each prompt, measured via onLayout, used for targeted scrolling
  const promptOffsets = useRef({});

  // Progressive disclosure: each prompt unlocks when the prior has content
  const workedOnReady    = workedOn.length >= 3;
  const showWentWell     = workedOnReady;
  const showDistractions = wentWell.length >= 1;
  const showNextStep     = distractions.length >= 1;

  // Scroll just enough to reveal the newly-appeared prompt — no full scrollToEnd
  const scrollToPrompt = (key) => {
    const offset = promptOffsets.current[key];
    if (offset != null) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: offset - 24, animated: true }), 100);
    }
  };

  // When wentWell first appears, scroll to it but do NOT steal focus from workedOn
  const prevShowWentWell = useRef(false);
  useEffect(() => {
    if (showWentWell && !prevShowWentWell.current) {
      prevShowWentWell.current = true;
      scrollToPrompt('wentWell');
    }
  }, [showWentWell]);

  // For subsequent prompts, advance focus automatically since the prior field is done
  const prevShowDistractions = useRef(false);
  useEffect(() => {
    if (showDistractions && !prevShowDistractions.current) {
      prevShowDistractions.current = true;
      scrollToPrompt('distractions');
      setTimeout(() => distractRef.current?.focus(), 150);
    }
  }, [showDistractions]);

  const prevShowNextStep = useRef(false);
  useEffect(() => {
    if (showNextStep && !prevShowNextStep.current) {
      prevShowNextStep.current = true;
      scrollToPrompt('nextStep');
      setTimeout(() => nextStepRef.current?.focus(), 150);
    }
  }, [showNextStep]);

  // Accent color on the primary input: dark red → green at ≥3 chars
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
          wentWell: wentWell.trim(),
          distractions: distractions.trim(),
          nextStep: nextStep.trim(),
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
          ref={scrollRef}
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
            returnKeyType="next"
            onSubmitEditing={() => wentWellRef.current?.focus()}
            submitBehavior="submit"
          />
          {workedOn.length > 0 && workedOn.length < 3 && (
            <Text style={styles.hintText}>Keep going — 1–5 words works great</Text>
          )}

          {/* ── Progressive follow-up prompts ── */}
          <ProgressivePrompt
            ref={wentWellRef}
            visible={showWentWell}
            label="What went well?"
            placeholder="What went well?"
            value={wentWell}
            onChangeText={setWentWell}
            returnKeyType="next"
            onSubmitEditing={() => distractRef.current?.focus()}
            onLayout={(e) => { promptOffsets.current.wentWell = e.nativeEvent.layout.y; }}
          />
          <ProgressivePrompt
            ref={distractRef}
            visible={showDistractions}
            label="What distracted you?"
            placeholder="What distracted you?"
            value={distractions}
            onChangeText={setDistractions}
            returnKeyType="next"
            onSubmitEditing={() => nextStepRef.current?.focus()}
            onLayout={(e) => { promptOffsets.current.distractions = e.nativeEvent.layout.y; }}
          />
          <ProgressivePrompt
            ref={nextStepRef}
            visible={showNextStep}
            label="What will you do next?"
            placeholder="What will you do next?"
            value={nextStep}
            onChangeText={setNextStep}
            returnKeyType="done"
            onLayout={(e) => { promptOffsets.current.nextStep = e.nativeEvent.layout.y; }}
          />

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
  // Progressive prompt
  promptBlock: {
    marginTop: 20,
  },
  promptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FAFAFA',
    minHeight: 60,
    textAlignVertical: 'top',
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
