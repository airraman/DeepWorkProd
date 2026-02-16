// src/screens/DeepWorkSession.js - COMPLETE VERSION with Enhanced Session Questions
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
// import functions from '@react-native-firebase/functions';


const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DeepWorkSession = ({ route, navigation }) => {
  console.log('🔍 DeepWorkSession starting with safe initialization...');
  
  const { duration, activity, musicChoice } = route.params;
  const totalDuration = parseFloat(duration) * 60 * 1000;

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
      console.log('🔍 Loading services in parallel...');
      
      try {
        // ✅ Load ALL services in parallel (no delays!)
        const [timerModule, alarmModule, audioModule] = await Promise.all([
          import('../services/backgroundTimer').catch(err => {
            console.warn('🔍 Background timer not available:', err.message);
            return null;
          }),
          import('../services/alarmService').catch(err => {
            console.warn('🔔 Alarm service not available:', err.message);
            return null;
          }),
          import('../services/audioService').catch(err => {
            console.warn('🎵 Audio service not available:', err.message);
            return null;
          })
        ]);
        
        // Assign loaded services
        if (timerModule) {
          servicesRef.current.backgroundTimer = timerModule.default;
          console.log('🔍 Background timer loaded');
        }
        
        if (alarmModule) {
          servicesRef.current.alarmService = alarmModule.alarmService;
          console.log('🔔 Alarm service loaded');
        }
        
        if (audioModule) {
          servicesRef.current.audioService = audioModule.audioService;
          console.log('🎵 Audio service loaded');
        }
        
        setServicesReady(true);
        console.log('🔍 Services loaded successfully in parallel!');
        
      } catch (error) {
        console.error('🔍 Error loading services:', error);
        // Still mark as ready even if some services failed
        setServicesReady(true);
      }
    };
    
    // Load services after component is mounted and stable
    const timeoutId = setTimeout(loadServices, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Initialize session with services when ready
  useEffect(() => {
    if (servicesReady) {
      initializeSession();
    }
  }, [servicesReady]);

  // Handle back button (Android)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmEndSession();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // SAFE: Session initialization
  const initializeSession = async () => {
    console.log('🔍 Initializing session...');
    
    try {
      // ✅ CRITICAL: Start timer IMMEDIATELY (user sees countdown start)
      startLocalTimer();
      
      // ✅ Initialize everything else in parallel (non-blocking)
      // User already sees timer counting down while this happens in background
      Promise.all([
        // Background timer notifications
        servicesRef.current.backgroundTimer
          ?.startTimerNotification(duration, activity, musicChoice)
          .then(() => console.log('🔍 Background timer started'))
          .catch(err => console.warn('🔍 Background timer failed:', err)),
        
        // Music initialization
        initializeMusic(),
        
        // Alarm service initialization  
        servicesRef.current.alarmService
          ?.init()
          .then(() => console.log('🔔 Alarm service initialized'))
          .catch(err => console.warn('🔔 Alarm init failed:', err))
      ]).catch(err => {
        console.warn('🔍 Some services failed to initialize:', err);
        // Non-critical - timer still works
      });
      
    } catch (error) {
      console.warn('🔍 Session initialization had issues:', error);
      // Continue anyway - the session can work without all services
    }
  };
  
  // ✅ Helper function for music initialization
  const initializeMusic = async () => {
    if (musicChoice === 'none') {
      console.log('🎵 No background music selected');
      return;
    }
    
    if (!servicesRef.current.audioService) {
      console.warn('🎵 Audio service not available');
      return;
    }
    
    try {
      console.log(`🎵 Starting background music: ${musicChoice}`);
      await servicesRef.current.audioService.init();
      await servicesRef.current.audioService.playMusic(musicChoice);
      console.log('🎵 Background music started successfully');
    } catch (error) {
      console.warn('🎵 Music failed to start (non-critical):', error);
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
    console.log('⏰ Session completed!');
    console.log('🐛 DEBUG: About to set isCompleted and show modal');
    
    try {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPaused(true);
      
      // Stop music
      if (servicesRef.current.audioService) {
        await servicesRef.current.audioService.stopMusic();
      }
      
      // Play completion alarm
      if (servicesRef.current.alarmService) {
        try {
          await servicesRef.current.alarmService.playCompletionAlarm();
          console.log('🔔 Completion alarm played');
        } catch (alarmError) {
          console.warn('🔔 Alarm failed (non-critical):', alarmError);
        }
      }
      
      setIsCompleted(true);
      console.log('🐛 DEBUG: isCompleted set to true, skipping modal and going straight to save');
      
      // Skip the modal - go straight to saving and rating
      setTimeout(async () => {
        console.log('🐛 DEBUG: Auto-submitting session without modal');
        // Call handleNotesSubmit with empty data (no notes from old modal)
        await handleNotesSubmit({
          notes: '',
          productivityRating: null,
          focusRating: null,
          energyLevel: null
        });
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error in handleTimeout:', error);
      setIsCompleted(true);
      setTimeout(() => setShowNotesModal(true), 1500);
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
const handleNotesSubmit = async (sessionData) => {
  console.log('🐛 DEBUG: handleNotesSubmit called with:', sessionData);
  setShowNotesModal(false);
  
  try {
    // ✅ Stop alarm regardless of save outcome
    if (servicesRef.current.alarmService) {
      await servicesRef.current.alarmService.stopAlarm();
    }
  } catch (error) {
    console.warn('Alarm stop error:', error);
  }
  
  console.log('🐛 DEBUG: About to call handleSessionComplete');
  // ✅ Attempt to save session
  const success = await handleSessionComplete(sessionData);
  console.log('🐛 DEBUG: handleSessionComplete returned:', success);
  
  if (success) {
    // ✅ Success path: navigate to rating screen
    console.log('🐛 DEBUG: Session saved successfully, navigation should happen in handleSessionComplete');
    setIsCompleted(true);
  } else {
    // ❌ Failure path: inform user but don't panic
    setIsCompleted(true);  // ✅ Still mark as complete visually
    
    Alert.alert(
      '⚠️ Save Issue',
      'Your session data couldn\'t be saved. This might be due to storage limits. Your session is complete, but won\'t appear in metrics.',
      [
        {
          text: 'Retry Save',
          onPress: async () => {
            const retrySuccess = await handleSessionComplete(sessionData);
            if (retrySuccess) {
              Alert.alert('Success', 'Session saved successfully!');
            } else {
              Alert.alert('Failed', 'Please contact support if this persists.');
            }
          }
        },
        {
          text: 'Continue Anyway',
          onPress: () => navigation.navigate('MainApp', { screen: 'Home' })
        }
      ]
    );
  }
};
// Save completed session
const handleSessionComplete = async (sessionData = {}) => {
  if (isSaving) {
    console.log('🐛 DEBUG: Already saving, skipping duplicate call');
    return false;
  }

  try {
    setIsSaving(true);
    await cleanup();
  
    // ===== STORAGE REPAIR SECTION =====
    try {
      console.log('🔧 Checking storage integrity...');
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const rawSessions = await AsyncStorage.getItem('@deep_work_sessions');
      
      if (rawSessions) {
        const parsed = JSON.parse(rawSessions);
        
        // Check if it's a valid object
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          console.log('⚠️ Storage is corrupted (not an object), resetting...');
          await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
        } else {
          // Check if all keys are valid date strings and values are arrays
          let needsRepair = false;
          const repairedSessions = {};
          
          for (const [key, value] of Object.entries(parsed)) {
            // Valid date format: YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
              console.log(`⚠️ Invalid date key: ${key}, skipping...`);
              needsRepair = true;
              continue;
            }
            
            // Must be array
            if (!Array.isArray(value)) {
              console.log(`⚠️ Invalid value for ${key} (not an array), skipping...`);
              needsRepair = true;
              continue;
            }
            
            repairedSessions[key] = value;
          }
          
          if (needsRepair) {
            console.log('🔧 Repairing storage structure...');
            await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify(repairedSessions));
          } else {
            console.log('✅ Storage structure is valid');
          }
        }
      } else {
        console.log('📝 No existing sessions, initializing empty storage');
        await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
      }
    } catch (repairError) {
      console.error('⚠️ Storage repair failed, initializing fresh:', repairError);
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
    }
    // ===== END STORAGE REPAIR SECTION =====
  
    // ===== ENHANCED VALIDATION SECTION =====
    console.log('📝 ===== SESSION SAVE DEBUG =====');
    console.log('Route params:', { duration, activity, musicChoice });
    console.log('Session data from modal:', sessionData);
    
    // Prepare session data
    const now = Date.now();
    const dateString = new Date().toISOString().split('T')[0];
    
    const sessionToSave = {
      id: `${dateString}-${now}`,
      date: dateString,
      activity: activity,
      duration: parseFloat(duration),
      musicChoice: musicChoice || 'none',
      
      // CHANGED: Store structured session data instead of just notes string
      notes: sessionData.notes || '',
      ratings: {
        productivity: sessionData.productivityRating,
        focus: sessionData.focusRating,
        energy: sessionData.energyLevel,
      },
      
      timestamp: now,
      completedAt: new Date().toISOString(),
      syncStatus: 'synced',
      metadata: {
        appVersion: '1.0.0',
        created: now,
        modified: now
      }
    };
    
    console.log('Prepared session data:', sessionToSave);
    
    // Additional validation checks
    console.log('Validation checks:');
    console.log('- activity type:', typeof sessionToSave.activity, 'value:', sessionToSave.activity);
    console.log('- duration type:', typeof sessionToSave.duration, 'value:', sessionToSave.duration);
    console.log('- notes type:', typeof sessionToSave.notes, 'value:', sessionToSave.notes);
    console.log('- ratings:', sessionToSave.ratings);
    console.log('- duration > 0?', sessionToSave.duration > 0);
    console.log('- activity not empty?', sessionToSave.activity.length > 0);
    
    // Check for potential issues
    if (!sessionToSave.activity || sessionToSave.activity.length === 0) {
      throw new Error('Activity is required but was empty');
    }
    
    if (isNaN(sessionToSave.duration) || sessionToSave.duration <= 0) {
      throw new Error(`Invalid duration: ${sessionToSave.duration}`);
    }
    
    console.log('✅ Validation passed, saving session...');
    // ===== END VALIDATION SECTION =====

    // Save session to storage
    const result = await deepWorkStore.addSession(sessionToSave);

    if (!result.success) {
      throw new Error(result.error || 'Failed to save session');
    }

    console.log('✅ Session saved successfully!');
    console.log('===================================\n');
    console.log('🐛 DEBUG: About to navigate to SessionRating with sessionId:', sessionToSave.id);

    // Navigate to rating screen instead of showing alert
    navigation.navigate('SessionRating', { sessionId: sessionToSave.id });
    console.log('🐛 DEBUG: Navigation called successfully');

    return true;
  } catch (error) {
    console.error('❌ Error saving session:', error);
    console.error('🐛 DEBUG: Error details:', error.message, error.stack);
    Alert.alert(
      'Error',
      'Failed to save your session. Please try again.',
      [{ text: 'OK' }]
    );
    return false;
  } finally {
    setIsSaving(false);
  }
};

  // Format time display
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatTotalTime = (milliseconds) => {
    const totalMinutes = Math.floor(milliseconds / 60000);
    return `${totalMinutes} min`;
  };

  // Show loading while services initialize
  if (!servicesReady || !activityDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.innerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.statusText}>Preparing your session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show completion state
  if (isCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.innerContainer, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
          <Text style={[styles.timeText, { marginBottom: 8 }]}>Session Complete!</Text>
          <Text style={styles.totalTimeText}>
            {formatTotalTime(totalDuration)} of focused work
          </Text>
          {isSaving && (
            <ActivityIndicator size="small" color="#2563eb" style={styles.savingIndicator} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Main session UI
  return (
    <SafeAreaView style={styles.container}>
      <Animated.View 
        style={[
          styles.innerContainer,
          {
            transform: [{ translateX: swipeAnim }]
          }
        ]}
        {...panResponder.panHandlers}
      >
        {/* Swipe indicator */}
        <View style={styles.swipeIndicator}>
          <ChevronLeft size={20} color="#6b7280" />
          <Text style={styles.swipeText}>Swipe right to end session early</Text>
        </View>

        <View style={styles.content}>
          {/* Timer Display */}
          <View style={styles.timerSection}>
            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.totalTimeText}>of {formatTotalTime(totalDuration)}</Text>
            {isPaused && <Text style={styles.statusText}>PAUSED</Text>}
          </View>

          {/* Visual timer (column) */}
          <View style={styles.timerVisualContainer}>
            <View style={styles.columnContainer}>
              <Animated.View
                style={[
                  styles.column,
                  {
                    backgroundColor: activityDetails.color,
                    bottom: 0,
                    height: animatedHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>

          {/* Activity info and controls */}
          <View style={styles.activityInfoContainer}>
            <Text style={styles.activityText}>{activityDetails.name}</Text>
            
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePause}
            >
              {isPaused ? (
                <Play size={24} color="#1f2937" fill="#1f2937" />
              ) : (
                <Pause size={24} color="#1f2937" fill="#1f2937" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Session Notes Modal */}
      <SessionNotesModal
        visible={showNotesModal}
        onSubmit={handleNotesSubmit}
        onClose={() => {
          setShowNotesModal(false);
          navigation.navigate('MainApp', { screen: 'Home' });
        }}
      />
    </SafeAreaView>
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