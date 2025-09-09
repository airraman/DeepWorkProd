// src/screens/DeepWorkSession.js - MINIMAL VERSION FOR CRASH TESTING
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
  Alert,
  BackHandler,
  ActivityIndicator,
  TouchableOpacity,
  PanResponder
} from 'react-native';

import { deepWorkStore } from '../services/deepWorkStore';
import SessionNotesModal from '../components/modals/SessionNotesModal';
import { Pause, Play, ChevronLeft } from 'lucide-react-native';
// TESTING: Comment out all service imports that might cause crashes
// import backgroundTimer from '../services/backgroundTimer';
// import { alarmService } from '../services/alarmService';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const DeepWorkSession = ({ route, navigation }) => {
  console.log('🔍 DeepWorkSession starting...');
  
  // Get session parameters from navigation
  const { duration, activity, musicChoice } = route.params;

  // Activity state
  const [activityDetails, setActivityDetails] = useState(null);

  // Convert duration from minutes to milliseconds for timer
  const totalDuration = parseInt(duration) * 60 * 1000;

  // Session state management
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // References for timing management
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);
  const saveRetryCountRef = useRef(0);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animation = useRef(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;

  const MAX_SAVE_RETRIES = 3;

  // Configure the pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) {
          swipeAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > SCREEN_WIDTH / 3) {
          confirmEndSession();
        } else {
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Load activity details
  useEffect(() => {
    console.log('🔍 Loading activity details...');
    const loadActivityDetails = async () => {
      try {
        const settings = await deepWorkStore.getSettings();
        const foundActivity = settings.activities.find(a => a.id === activity);
        
        if (foundActivity) {
          console.log('Found activity details:', foundActivity);
          setActivityDetails(foundActivity);
        } else {
          console.log('Activity not found:', activity);
          setActivityDetails({ name: 'Focus Session', color: '#2563eb' });
        }
      } catch (error) {
        console.error('Error loading activity details:', error);
        setActivityDetails({ name: 'Focus Session', color: '#2563eb' });
      }
    };

    loadActivityDetails();
  }, [activity]);

  // TESTING: Comment out ALL service initialization
  // useEffect(() => {
  //   console.log('🔍 Would initialize alarm service...');
  //   // Alarm service initialization commented out for testing
  // }, []);

  // useEffect(() => {
  //   console.log('🔍 Would initialize background timer...');
  //   // Background timer initialization commented out for testing
  // }, [duration, activity, musicChoice]);

  // Function to confirm ending the session
  const confirmEndSession = () => {
    console.log('🔍 Confirm end session...');
    Alert.alert(
      'End Session?',
      'Are you sure you want to end your deep work session early? This session will not be saved.',
      [
        {
          text: 'Cancel',
          onPress: () => {
            Animated.spring(swipeAnim, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          },
          style: 'cancel',
        },
        {
          text: 'End Session',
          onPress: async () => {
            console.log('🔍 Ending session...');
            // No service cleanup for testing
            navigation.navigate('MainApp', { screen: 'Home' });
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Handle pause/resume
  const togglePause = () => {
    console.log('🔍 Toggle pause...');
    if (isPaused) {
      startTimeRef.current = Date.now() - (totalDuration - timeLeft);

      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: timeLeft,
        useNativeDriver: false,
      }).start();
      
      // No background timer update for testing
    } else {
      animatedHeight.stopAnimation();
      // No background timer update for testing
    }

    setIsPaused(!isPaused);
  };

  // Start or resume the timer
  const startTimer = () => {
    console.log('🔍 Starting timer...');
    startTimeRef.current = Date.now() - (totalDuration - timeLeft);

    intervalRef.current = setInterval(() => {
      if (!isPaused) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, totalDuration - elapsed);
        setTimeLeft(remaining);

        if (remaining <= 0) {
          handleTimeout();
        }
      }
    }, 1000);
  };

  // TESTING: Simplified timeout handler with NO alarm service
  const handleTimeout = async () => {
    console.log('🔍 Session timeout - simplified version');
    try {
      clearInterval(intervalRef.current);
      setIsPaused(true);
      
      // TESTING: No alarm service calls
      console.log('🎉 Session completed - would play alarm here');
      
      // Just show the notes modal
      setShowNotesModal(true);
    } catch (error) {
      console.error('Error handling timeout:', error);
      setShowNotesModal(true);
    }
  };

  // Handle notes submission
  const handleNotesSubmit = async (notes) => {
    console.log('🔍 Notes submitted...');
    setShowNotesModal(false);
    
    // TESTING: No alarm service calls
    console.log('🔍 Would stop alarm here');
    
    const success = await handleSessionComplete(notes);

    if (success) {
      setIsCompleted(true);
    } else {
      startTimer();
      setIsPaused(false);
    }
  };

  // TESTING: Simplified session completion
  const handleSessionComplete = async (notes = '') => {
    console.log('🔍 Completing session...');
    if (isSaving) return false;

    try {
      setIsSaving(true);
      
      // TESTING: No background timer or alarm service
      console.log('🔍 Would stop background services here');

      // Just verify storage and save
      const storageOk = await deepWorkStore.verifyStorageIntegrity();
      if (!storageOk) {
        throw new Error('Storage integrity check failed');
      }

      const result = await deepWorkStore.addSession({
        activity,
        duration: parseInt(duration),
        musicChoice,
        notes
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save session');
      }

      Alert.alert(
        'Session Complete!',
        'Test session completed successfully.',
        [
          {
            text: 'View Progress',
            onPress: () => navigation.navigate('MainApp', { screen: 'Metrics' }),
          },
          {
            text: 'New Session',
            onPress: () => navigation.navigate('MainApp', { screen: 'Home' }),
          },
        ]
      );

      return true;
    } catch (error) {
      console.error('Error completing session:', error);
      Alert.alert('Error', 'Failed to save session');
      return false;
    }
  };

  // Handle back button press
  useEffect(() => {
    console.log('🔍 Setting up back handler...');
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmEndSession();
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  // Initialize timer and animation
  useEffect(() => {
    console.log('🔍 Initializing timer and animation...');
    startTimer();

    if (!animation.current) {
      animation.current = Animated.timing(animatedHeight, {
        toValue: 1,
        duration: totalDuration,
        useNativeDriver: false,
      });

      animation.current.start();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (animation.current) {
        animation.current.stop();
      }
    };
  }, []);

  // Handle pausing and resuming
  useEffect(() => {
    if (isPaused) {
      animatedHeight.stopAnimation();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } else {
      const progress = 1 - (timeLeft / totalDuration);
      animatedHeight.setValue(progress);

      animation.current = Animated.timing(animatedHeight, {
        toValue: 1,
        duration: timeLeft,
        useNativeDriver: false,
      });

      animation.current.start();
      startTimer();
    }
  }, [isPaused]);

  // Format remaining time as MM:SS
  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  console.log('🔍 DeepWorkSession rendering...');

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: swipeAnim }]
        }
      ]}
      {...panResponder.panHandlers}
    >
      <SafeAreaView style={styles.innerContainer}>
        <View style={styles.swipeIndicator}>
          <ChevronLeft size={24} color="#6b7280" />
          <Text style={styles.swipeText}>Swipe right to end session (TESTING)</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.timerSection}>
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.totalTimeText}>
              of {duration}:00 minutes (TEST MODE)
            </Text>
            {isSaving && (
              <ActivityIndicator
                size="small"
                color="#2563eb"
                style={styles.savingIndicator}
              />
            )}
          </View>

          <View style={styles.timerVisualContainer}>
            <View style={styles.columnContainer}>
              <Animated.View
                style={[
                  styles.column,
                  {
                    backgroundColor: activityDetails ? 
                      activityDetails.color : 
                      '#2563eb',
                    height: animatedHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }),
                    bottom: 0
                  }
                ]}
              />
            </View>
          </View>

          <View style={styles.activityInfoContainer}>
            <Text style={styles.activityText}>
              {activityDetails ? activityDetails.name : 'Focus Session'} (TEST)
            </Text>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePause}
              disabled={isCompleted}
            >
              {isPaused ? (
                <Play size={28} color="#2563eb" />
              ) : (
                <Pause size={28} color="#2563eb" />
              )}
            </TouchableOpacity>
          </View>

          <SessionNotesModal
            visible={showNotesModal}
            onSubmit={handleNotesSubmit}
            onClose={() => handleNotesSubmit('')}
          />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  innerContainer: {
    flex: 1,
  },
  swipeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  swipeText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  savingIndicator: {
    marginTop: 8,
  },
  timerSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  timeText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1f2937',
  },
  totalTimeText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 5
  },
  timerVisualContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  columnContainer: {
    width: isTablet ? 140 : 100,
    height: '100%',
    maxHeight: SCREEN_HEIGHT * (isTablet ? 0.35 : 0.45),
    backgroundColor: '#e5e7eb',
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  column: {
    width: '100%',
    position: 'absolute',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  activityInfoContainer: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 40,
    marginTop: 20,
  },
  activityText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});

export default DeepWorkSession;