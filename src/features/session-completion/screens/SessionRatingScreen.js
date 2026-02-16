import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';

// Custom Slider Component (no native dependencies)
function CustomSlider({ value, onValueChange, min = 1, max = 10 }) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${percentage}%` }]} />
      </View>
      <View style={sliderStyles.buttonsRow}>
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
          <TouchableOpacity
            key={num}
            onPress={() => onValueChange(num)}
            style={[
              sliderStyles.numberButton,
              value === num && sliderStyles.numberButtonActive,
            ]}
          >
            <Text
              style={[
                sliderStyles.numberText,
                value === num && sliderStyles.numberTextActive,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

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

export default function SessionRatingScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const [focusRating, setFocusRating] = useState(5); // 1-10 scale
  const [productivityRating, setProductivityRating] = useState(5); // 1-10 scale
  const [workDescription, setWorkDescription] = useState('');

  const handleContinue = async () => {
    try {
      await sessionService.saveRating(sessionId, {
        rating: Math.round((focusRating + productivityRating) / 2),
        focus: focusRating,
        productivity: productivityRating,
        notes: workDescription.trim() || undefined,
        ratedAt: new Date().toISOString(),
      });

      navigation.navigate('SessionSummary', { sessionId });
    } catch (error) {
      console.error('Failed to save rating:', error);
      navigation.navigate('SessionSummary', { sessionId });
    }
  };

  const handleSkip = () => {
    navigation.navigate('SessionSummary', { sessionId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
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

          {/* Title */}
          <Text style={styles.title}>RATE YOUR SESSION</Text>

          {/* Focus Slider */}
          <View style={styles.sliderSection}>
            <CustomSlider
              value={focusRating}
              onValueChange={setFocusRating}
              min={1}
              max={10}
            />
            <Text style={styles.sliderLabel}>How focused did you feel</Text>
          </View>

          {/* Productivity Slider */}
          <View style={styles.sliderSection}>
            <CustomSlider
              value={productivityRating}
              onValueChange={setProductivityRating}
              min={1}
              max={10}
            />
            <Text style={styles.sliderLabel}>
              How much do you feel like you{'\n'}accomplished?
            </Text>
          </View>

          {/* Work Description */}
          <Text style={styles.descriptionLabel}>Describe what you worked on</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={6}
            placeholder="Type here..."
            placeholderTextColor="#999"
            value={workDescription}
            onChangeText={setWorkDescription}
            textAlignVertical="top"
          />

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  descriptionLabel: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    color: '#000000',
    minHeight: 180,
    marginBottom: 32,
  },
  buttonContainer: {
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
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666666',
    fontSize: 16,
  },
});