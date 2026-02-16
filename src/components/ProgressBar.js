// src/components/ProgressBar.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ProgressBar = ({ currentStep, totalSteps, stepLabels = [] }) => {
  // useRef for animated value - this persists across re-renders
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Calculate progress percentage
  const progressPercentage = (currentStep / totalSteps) * 100;
  
  // Animate progress bar when step changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: 500, // Smooth 500ms animation
      useNativeDriver: false, // Required for width animations
    }).start();
  }, [currentStep, progressPercentage]);

  // Get step label for display
  const getCurrentStepLabel = () => {
    if (stepLabels.length > 0 && stepLabels[currentStep - 1]) {
      return stepLabels[currentStep - 1];
    }
    return `Step ${currentStep} of ${totalSteps}`;
  };

  return (
    <View style={styles.container}>
      {/* Progress Text */}
      <View style={styles.textContainer}>
        <Text style={styles.stepText}>{getCurrentStepLabel()}</Text>
        <Text style={styles.progressText}>{Math.round(progressPercentage)}%</Text>
      </View>
      
      {/* Progress Bar Track */}
      <View style={styles.progressTrack}>
        {/* Animated Progress Fill */}
        <Animated.View
          style={[
            styles.progressFill,
            {
              // This is the key React Native difference - we animate width using interpolation
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
      
      {/* Step Indicators */}
      <View style={styles.stepsContainer}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[
              styles.stepIndicator,
              {
                backgroundColor: index < currentStep ? '#22C55E' : '#E5E7EB',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    // React Native uses elevation for Android shadows, shadowColor for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  textContainer: {
    flexDirection: 'row', // React Native's equivalent to display: flex; flex-direction: row
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22C55E',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden', // Critical for containing the animated fill
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E', // Green progress color
    borderRadius: 4,
    // In React Native, we don't use CSS transitions - animations are handled by Animated API
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6, // React Native uses borderRadius for circular shapes
    marginHorizontal: 2,
  },
});

export default ProgressBar;