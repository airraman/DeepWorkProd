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
import backgroundTimer from '../services/backgroundTimer';
import { audioService } from '../services/audioService'; // Background music service
import { alarmService } from '../services/alarmService'; // NEW: Alarm service for completion alerts

const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Define colors for different activity types
const ACTIVITY_COLORS = {
  'write': '#4f46e5',     // indigo
  'code': '#0891b2',      // cyan
  'produce-music': '#7c3aed' // violet
};

const DeepWorkSession = ({ route, navigation }) => {
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
  const animatedHeight = useRef(new Animated.Value(0)).current; // Start from 0 (empty)
  const animation = useRef(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;

  // Maximum number of save retries before giving up
  const MAX_SAVE_RETRIES = 3;

  // Configure the pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only set pan responder for horizontal swipes
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only track right swipes (dx > 0)
        if (gestureState.dx > 0) {
          swipeAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swiped more than 1/3 of the screen width to the right
        if (gestureState.dx > SCREEN_WIDTH / 3) {
          confirmEndSession();
        } else {
          // Reset animation if swipe not far enough
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
    const loadActivityDetails = async () => {
      try {
        // Get settings which contains the activities
        const settings = await deepWorkStore.getSettings();
        
        // Find the activity with the matching ID
        const foundActivity = settings.activities.find(a => a.id === activity);
        
        if (foundActivity) {
          console.log('Found activity details:', foundActivity);
          setActivityDetails(foundActivity);
        } else {
          console.log('Activity not found:', activity);
          // Set a default activity if not found
          setActivityDetails({ name: 'Focus Session', color: '#2563eb' });
        }
      } catch (error) {
        console.error('Error loading activity details:', error);
        // Fallback to default
        setActivityDetails({ name: 'Focus Session', color: '#2563eb' });
      }
    };

    loadActivityDetails();
  }, [activity]);

  // // Set up audio playback and alarm service
  // useEffect(() => {
  //   const setupServices = async () => {
  //     try {
  //       // Initialize background music service
  //       await audioService.init();
        
  //       // NEW: Initialize alarm service for completion alerts
  //       console.log('🔔 Initializing alarm service for session...');
  //       const alarmInitialized = await alarmService.init();
  //       if (!alarmInitialized) {
  //         console.warn('⚠️ Alarm service failed to initialize - completion alerts may not work');
  //       } else {
  //         console.log('🔔 Alarm service ready for session completion');
  //       }
        
  //       // Start playing the selected background music
  //       if (musicChoice !== 'none') {
  //         await audioService.playMusic(musicChoice);
  //       }
  //     } catch (error) {
  //       console.error('Error setting up services:', error);
  //     }
  //   };
    
  //   setupServices();
    
  //   // Cleanup function to stop audio AND alarm when component unmounts
  //   return () => {
  //     console.log('🔧 Cleaning up session services...');
  //     audioService.stopMusic();
  //     alarmService.cleanup(); // NEW: Clean up alarm service
  //   };
  // }, [musicChoice]);

  // Initialize background timer
  useEffect(() => {
    // Start background timer when session begins
    const initBackgroundTimer = async () => {
      await backgroundTimer.startTimerNotification(
        parseInt(duration),
        activity,
        musicChoice
      );
    };
    
    initBackgroundTimer();
    
    // Clean up when component unmounts
    return () => {
      backgroundTimer.stopTimerNotification();
    };
  }, [duration, activity, musicChoice]);

  // Function to confirm ending the session
  const confirmEndSession = () => {
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
            await backgroundTimer.stopTimerNotification();
            // await audioService.stopMusic(); // Stop background music
            await alarmService.cleanup(); // NEW: Clean up alarm service
            navigation.navigate('MainApp', { screen: 'Home' });
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Handle pause/resume
  const togglePause = () => {
    if (isPaused) {
      // Resume the timer
      startTimeRef.current = Date.now() - (totalDuration - timeLeft);

      // Calculate the progress value (0 to 1)
      const progress = 1 - (timeLeft / totalDuration);

      // Resume the animation from current position
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: timeLeft,
        useNativeDriver: false,
      }).start();
      
      // Update background timer pause state
      backgroundTimer.updateTimerPauseState(false);
      
      // Resume background music playback if not "none"
      // if (musicChoice !== 'none') {
      //   audioService.resumeMusic();
      // }
    } else {
      // Pause the animation
      animatedHeight.stopAnimation();
      
      // Update background timer pause state
      backgroundTimer.updateTimerPauseState(true);
      
      // Pause background music playback if not "none"
      // if (musicChoice !== 'none') {
      //   audioService.pauseMusic();
      // }
    }

    setIsPaused(!isPaused);
  };

  // Start or resume the timer
  const startTimer = () => {
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

  // Handle timer completion - UPDATED with alarm integration
  const handleTimeout = async () => {
    try {
      clearInterval(intervalRef.current);
      setIsPaused(true);
      
      // Stop background music when time is up
      // if (musicChoice !== 'none') {
      //   audioService.pauseMusic();
      // }
      
      // NEW: Play completion alarm - this is the key addition!
      console.log('🔔 Session completed - playing completion alarm');
      try {
        await alarmService.playCompletionAlarm({
          volume: 0.8, // 80% volume - loud enough to notice but not jarring
          autoStopAfter: 10 // Stop alarm after 10 seconds automatically
        });
        console.log('🔔 Completion alarm started successfully');
      } catch (alarmError) {
        console.error('🔔 Failed to play completion alarm:', alarmError);
        // Continue with the session completion even if alarm fails
      }
      
      // Show the notes modal
      setShowNotesModal(true);
    } catch (error) {
      console.error('Error handling timeout:', error);
      // Still show the modal even if there are errors
      setShowNotesModal(true);
    }
  };

  // Handle notes submission - UPDATED to stop alarm
  const handleNotesSubmit = async (notes) => {
    setShowNotesModal(false);
    
    // NEW: Stop the completion alarm when user starts interacting
    console.log('🔔 User interacting with session completion - stopping alarm');
    try {
      await alarmService.stopAlarm();
    } catch (error) {
      console.error('🔔 Error stopping alarm:', error);
    }
    
    const success = await handleSessionComplete(notes);

    if (success) {
      setIsCompleted(true);
    } else {
      startTimer();
      setIsPaused(false);
      // Resume background music if session continues
      if (musicChoice !== 'none' && !isPaused) {
        audioService.resumeMusic();
      }
    }
  };

  // Handle session completion and data saving - UPDATED with alarm cleanup
  const handleSessionComplete = async (notes = '') => {
    if (isSaving) return false;

    try {
      setIsSaving(true);
      
      // Stop background timer
      await backgroundTimer.stopTimerNotification();
      
      // Stop background music playback
      // await audioService.stopMusic();
      
      // NEW: Ensure alarm is stopped and cleaned up
      console.log('🔔 Session completing - ensuring alarm is stopped');
      try {
        await alarmService.stopAlarm();
      } catch (error) {
        console.error('🔔 Error stopping alarm during completion:', error);
      }

      // Verify storage integrity before saving
      const storageOk = await deepWorkStore.verifyStorageIntegrity();
      if (!storageOk) {
        throw new Error('Storage integrity check failed');
      }

      // Save session data
      const result = await deepWorkStore.addSession({
        activity,
        duration: parseInt(duration),
        musicChoice,
        notes
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save session');
      }

      // Show success message
      Alert.alert(
        'Session Complete!',
        'Great work! Your deep work session has been recorded.',
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
      saveRetryCountRef.current += 1;

      if (saveRetryCountRef.current < MAX_SAVE_RETRIES) {
        Alert.alert(
          'Save Error',
          'There was a problem saving your session. Would you like to try again?',
          [
            {
              text: 'Retry',
              onPress: async () => {
                setIsSaving(false);
                return await handleSessionComplete(notes);
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setIsSaving(false);
                return false;
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Error',
          'Unable to save your session after multiple attempts. Would you like to try again later?',
          [
            {
              text: 'Continue Session',
              onPress: () => {
                setIsSaving(false);
                // Resume background music if continuing session
                if (musicChoice !== 'none' && !isPaused) {
                  audioService.resumeMusic();
                }
                return false;
              },
            },
            {
              text: 'End Without Saving',
              style: 'destructive',
              onPress: async () => {
                await backgroundTimer.stopTimerNotification();
                await audioService.stopMusic();
                await alarmService.cleanup(); // NEW: Clean up alarm service
                navigation.navigate('MainApp', { screen: 'Home' });
              },
            },
          ]
        );
      }

      return false;
    }
  };

  // Handle back button press
  useEffect(() => {
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
    // Start the timer
    startTimer();

    // Setup the animation for the hourglass effect - now filling from top to bottom
    if (!animation.current) {
      // Start with 0 (empty) and animate to 1 (full)
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

      // Ensure the animation is cleaned up
      if (animation.current) {
        animation.current.stop();
      }
    };
  }, []);

  // Handle pausing and resuming
  useEffect(() => {
    if (isPaused) {
      // Pause animation
      animatedHeight.stopAnimation();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } else {
      // Resume animation from current position
      // Calculate current progress (how much has been filled from top)
      const progress = 1 - (timeLeft / totalDuration);

      // Set the current value
      animatedHeight.setValue(progress);

      // Create a new animation for the remaining time
      animation.current = Animated.timing(animatedHeight, {
        toValue: 1, // Animate to full (1)
        duration: timeLeft,
        useNativeDriver: false,
      });

      animation.current.start();

      // Restart the timer
      startTimer();
    }
  }, [isPaused]);

  // Format remaining time as MM:SS
  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format activity name for display
  const formatActivityName = (name) => {
    if (!name || typeof name !== 'string') {
      return 'Unnamed Activity';
    }

    return name.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

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
        {/* Swipe indicator */}
        <View style={styles.swipeIndicator}>
          <ChevronLeft size={24} color="#6b7280" />
          <Text style={styles.swipeText}>Swipe right to end session</Text>
        </View>

        <View style={styles.content}>
          {/* Session Timer */}
          <View style={styles.timerSection}>
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.totalTimeText}>
              of {duration}:00 minutes
            </Text>
            {isSaving && (
              <ActivityIndicator
                size="small"
                color="#2563eb"
                style={styles.savingIndicator}
              />
            )}
          </View>

          {/* Progress Column/Timer Visual */}
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

          {/* Session Activity/Info */}
          <View style={styles.activityInfoContainer}>
            <Text style={styles.activityText}>
              {activityDetails ? activityDetails.name : 'Focus Session'}
            </Text>

            {musicChoice !== 'none' && (
              <Text style={styles.musicText}>
                {formatActivityName(musicChoice)}
              </Text>
            )}

            {/* Pause/Resume Button */}
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
    width: isTablet ? 140 : 100, // Slightly wider on tablets
    height: '100%',
    maxHeight: SCREEN_HEIGHT * (isTablet ? 0.35 : 0.45), // Adjusted for tablets
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
  musicText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
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