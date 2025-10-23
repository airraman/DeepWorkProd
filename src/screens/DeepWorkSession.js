// src/screens/DeepWorkSession.js - SAFE VERSION with Background Music
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
  PanResponder,
  Platform
} from 'react-native';

import { deepWorkStore } from '../services/deepWorkStore';
import SessionNotesModal from '../components/modals/SessionNotesModal';
import { Pause, Play, ChevronLeft } from 'lucide-react-native';
import backgroundTimer from '../services/backgroundTimer';
import { audioService } from '../services/audioService';
import { alarmService } from '../services/alarmService';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DeepWorkSession = ({ route, navigation }) => {
  console.log('🔍 DeepWorkSession starting with safe initialization...');
  
  const { duration, activity, musicChoice } = route.params;
  const totalDuration = parseInt(duration) * 60 * 1000;

  // Core state - only what's essential
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [activityDetails, setActivityDetails] = useState(null);

  // Services loaded dynamically to prevent crashes
  const [servicesReady, setServicesReady] = useState(false);
  const servicesRef = useRef({
    backgroundTimer: null,
    alarmService: null,
    audioService: null
  });

  // Timer management
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;

  // SAFE: Load activity details without crashing
  useEffect(() => {
    const loadActivityDetails = async () => {
      try {
        const settings = await deepWorkStore.getSettings();
        const foundActivity = settings.activities.find(a => a.id === activity);
        setActivityDetails(foundActivity || { name: 'Focus Session', color: '#2563eb' });
      } catch (error) {
        console.warn('Could not load activity details:', error);
        setActivityDetails({ name: 'Focus Session', color: '#2563eb' });
      }
    };
    
    loadActivityDetails();
  }, [activity]);

  // SAFE: Load services gradually to prevent memory crashes
  useEffect(() => {
    const loadServices = async () => {
      console.log('🔍 Loading services safely...');
      
      // Small delay to let the UI render first
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Load background timer service
      try {
        const timerModule = await import('../services/backgroundTimer');
        servicesRef.current.backgroundTimer = timerModule.default;
        console.log('🔍 Background timer loaded');
      } catch (error) {
        console.warn('🔍 Background timer not available:', error.message);
      }
      
      // Small delay between service loads
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Load alarm service
      try {
        const alarmModule = await import('../services/alarmService');
        servicesRef.current.alarmService = alarmModule.alarmService;
        console.log('🔔 Alarm service loaded');
      } catch (error) {
        console.warn('🔔 Alarm service not available:', error.message);
      }
      
      // ✅ Load audio service
      try {
        const audioModule = await import('../services/audioService');
        servicesRef.current.audioService = audioModule.audioService;
        console.log('🎵 Audio service loaded');
      } catch (error) {
        console.warn('🎵 Audio service not available:', error.message);
      }
      
      setServicesReady(true);
      console.log('🔍 Services loaded safely');
    };
    
    // Load services after component is mounted and stable
    const timeoutId = setTimeout(loadServices, isTablet ? 2000 : 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Initialize session with services when ready
  useEffect(() => {
    if (servicesReady) {
      initializeSession();
    }
  }, [servicesReady]);

  // SAFE: Session initialization
  const initializeSession = async () => {
    console.log('🔍 Initializing session...');
    
    try {
      // Start local timer first (always works)
      startLocalTimer();
      
      // Try to start background services if available
      if (servicesRef.current.backgroundTimer) {
        try {
          await servicesRef.current.backgroundTimer.startTimerNotification(
            duration,
            activity,
            musicChoice
          );
          console.log('🔍 Background timer started');
        } catch (error) {
          console.warn('🔍 Background timer failed to start:', error);
        }
      }
      
      // ✅ START BACKGROUND MUSIC
      if (servicesRef.current.audioService && musicChoice !== 'none') {
        try {
          console.log(`🎵 Starting background music: ${musicChoice}`);
          await servicesRef.current.audioService.init();
          await servicesRef.current.audioService.playMusic(musicChoice);
          console.log('🎵 Background music started successfully');
        } catch (error) {
          console.warn('🎵 Music failed to start (non-critical):', error);
        }
      } else if (musicChoice === 'none') {
        console.log('🎵 No background music selected');
      }
      
      // Initialize alarm service if available
      if (servicesRef.current.alarmService) {
        try {
          await servicesRef.current.alarmService.init();
          console.log('🔔 Alarm service initialized');
        } catch (error) {
          console.warn('🔔 Alarm service failed to initialize:', error);
        }
      }
      
    } catch (error) {
      console.warn('🔍 Session initialization had issues:', error);
      // Continue anyway - the session can work without all services
    }
  };

  // CORE: Local timer that always works (no external dependencies)
  const startLocalTimer = () => {
    startTimeRef.current = Date.now() - (totalDuration - timeLeft);

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

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

    // Start progress animation
    Animated.timing(animatedHeight, {
      toValue: 1,
      duration: timeLeft,
      useNativeDriver: false,
    }).start();
  };

  const handleTimeout = async () => {
    console.log('🎉 Session completed!');
    
    try {
      // Stop local timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      setIsPaused(true);
      
      // ✅ STOP BACKGROUND MUSIC
      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.stopMusic();
          console.log('🎵 Background music stopped');
        } catch (error) {
          console.warn('🎵 Music stop error:', error);
        }
      }
      
      // ADDED: Send completion notification with sound
      try {
        await backgroundTimer.sendCompletionNotification();
        console.log('📱 Completion notification with sound sent');
      } catch (notificationError) {
        console.warn('📱 Notification failed:', notificationError);
      }
      
      // Try to play alarm if service is available (visual feedback)
      if (servicesRef.current.alarmService) {
        try {
          await servicesRef.current.alarmService.playCompletionAlarm({
            volume: 0.8,
            autoStopAfter: 8
          });
          console.log('🔔 Completion alarm played');
        } catch (error) {
          console.warn('🔔 Alarm failed to play:', error);
          showFallbackCelebration();
        }
      } else {
        showFallbackCelebration();
      }
      
      // Show notes modal
      setShowNotesModal(true);
      
    } catch (error) {
      console.error('Error in timeout handler:', error);
      setShowNotesModal(true);
    }
  };

  // Fallback celebration when alarm service isn't available
  const showFallbackCelebration = () => {
    Alert.alert(
      '🎉 Session Complete!',
      'Congratulations! You completed your deep work session.',
      [{ text: 'Awesome!', style: 'default' }]
    );
  };

  // ✅ UPDATED: Handle pause/resume with music control
  const togglePause = async () => {
    console.log('🔍 Toggle pause:', isPaused);
    
    const newPauseState = !isPaused;
    
    if (isPaused) {
      // Resume
      startTimeRef.current = Date.now() - (totalDuration - timeLeft);
      
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: timeLeft,
        useNativeDriver: false,
      }).start();
      
      // Update background service if available
      if (servicesRef.current.backgroundTimer) {
        try {
          await servicesRef.current.backgroundTimer.updateTimerPauseState(false);
        } catch (error) {
          console.warn('Background pause update failed:', error);
        }
      }
      
      // ✅ RESUME MUSIC
      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.resumeMusic();
          console.log('🎵 Music resumed');
        } catch (error) {
          console.warn('🎵 Music resume error:', error);
        }
      }
      
    } else {
      // Pause
      animatedHeight.stopAnimation();
      
      // Update background service if available
      if (servicesRef.current.backgroundTimer) {
        try {
          await servicesRef.current.backgroundTimer.updateTimerPauseState(true);
        } catch (error) {
          console.warn('Background pause update failed:', error);
        }
      }
      
      // ✅ PAUSE MUSIC
      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.pauseMusic();
          console.log('🎵 Music paused');
        } catch (error) {
          console.warn('🎵 Music pause error:', error);
        }
      }
    }

    setIsPaused(newPauseState);
  };

  // Pan responder for swipe to end
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) {
          swipeAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > Dimensions.get('window').width / 3) {
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

  // Confirm early session end
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
            await cleanup();
            navigation.navigate('MainApp', { screen: 'Home' });
          },
          style: 'destructive',
        },
      ]
    );
  };

  // ✅ UPDATED: Safe cleanup function with music cleanup
  const cleanup = async () => {
    console.log('🔍 Cleaning up session...');
    
    try {
      // Clear local timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // ✅ STOP BACKGROUND MUSIC
      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.stopMusic();
          console.log('🎵 Music stopped during cleanup');
        } catch (error) {
          console.warn('🎵 Music cleanup error:', error);
        }
      }
      
      // Stop background services if available
      if (servicesRef.current.backgroundTimer) {
        try {
          await servicesRef.current.backgroundTimer.stopTimerNotification();
        } catch (error) {
          console.warn('Background cleanup error:', error);
        }
      }
      
      if (servicesRef.current.alarmService) {
        try {
          await servicesRef.current.alarmService.cleanup();
        } catch (error) {
          console.warn('Alarm cleanup error:', error);
        }
      }
      
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  // Handle session completion with notes
  const handleNotesSubmit = async (notes) => {
    setShowNotesModal(false);
    
    try {
      // Stop alarm if playing
      if (servicesRef.current.alarmService) {
        await servicesRef.current.alarmService.stopAlarm();
      }
    } catch (error) {
      console.warn('Error stopping alarm:', error);
    }
    
    const success = await handleSessionComplete(notes);
    
    if (success) {
      setIsCompleted(true);
    } else {
      // If save failed, allow user to continue session
      setIsPaused(false);
      startLocalTimer();
    }
  };

  // Save completed session
  const handleSessionComplete = async (notes = '') => {
    if (isSaving) return false;

    try {
      setIsSaving(true);
      
      // Clean up services
      await cleanup();

      // Save session to storage
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
        'Congratulations! Your deep work session has been saved.',
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
    } finally {
      setIsSaving(false);
    }
  };

  // Handle back button
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Format time display
  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
        <View style={styles.swipeIndicator}>
          <ChevronLeft size={24} color="#6b7280" />
          <Text style={styles.swipeText}>Swipe right to end session</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.timerSection}>
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.totalTimeText}>
              of {duration}:00 minutes
            </Text>
            
            {/* Show services status for debugging */}
            {__DEV__ && (
              <Text style={styles.statusText}>
                Services: {servicesReady ? '✅ Ready' : '⏳ Loading...'}
                {musicChoice !== 'none' && ' | 🎵 Music: ' + musicChoice}
              </Text>
            )}
            
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
              {activityDetails ? activityDetails.name : 'Focus Session'}
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
  },
  statusText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  savingIndicator: {
    marginTop: 8,
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