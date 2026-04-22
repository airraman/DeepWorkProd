// src/screens/DeepWorkSession.js - COMPLETE VERSION with Enhanced Session Questions
import React, { useEffect, useRef, useState } from 'react';
import { useSessionTimer } from '../hooks/useSessionTimer';
import {
  scheduleSessionEndNotification,
  cancelSessionEndNotification,
} from '../services/sessionEndNotification';
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
import { useFocusLock } from '../context/FocusLockContext';
import { saveSessionToFirestore } from '../services/firestoreSessionService';
import {
  saveActiveSession,
  clearActiveSession,
  saveLastSessionConfig,
} from '../services/sessionStateService';
import {
  incrementStreak,
  cancelStreakRiskNotification,
} from '../services/streakService';

import {
  logSessionStart,
  logSessionComplete,
  logSessionAbandon,
  logSessionPause,
  logSessionResume,
} from '../services/analyticsService';


const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DeepWorkSession = ({ route, navigation }) => {
  console.log('🔍 DeepWorkSession starting with safe initialization...');

  // Destructure FIRST — using route.params before this declaration causes NaN
  const { duration, activity, musicChoice, focusLockEnabled } = route.params;
  const totalDuration = parseFloat(duration) * 60 * 1000;

  const { startBlocking, stopBlocking, isReady: focusLockReady } = useFocusLock();

  // Timestamp-based timer — no drift, survives app reload
  const { timeLeft, isPaused, isExpired, start, pause, resume, stop } = useSessionTimer(totalDuration);

  // Core state
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // UI spinner only
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [activityDetails, setActivityDetails] = useState(null);

  // Synchronous guards — React state updates are async/batched and can't be
  // used reliably as mutex locks. Refs are synchronous and safe for this purpose.
  const isSavingRef             = useRef(false); // prevents double-save
  const isHandlingTimeoutRef    = useRef(false); // prevents double handleTimeout
  const isCleanedUpRef          = useRef(false); // prevents double cleanup
  const completionTimeoutRef    = useRef(null);  // 1500ms delay handle in handleTimeout
  const hasStartedBlockingRef   = useRef(false); // prevents double startBlocking call

  // Services loaded dynamically to prevent crashes
  const [servicesReady, setServicesReady] = useState(false);
  const servicesRef = useRef({
    backgroundTimer: null,
    alarmService: null,
    audioService: null
  });

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

  // Start blocking only after BOTH services and FocusLock context are ready.
  // Avoids a race condition where startBlocking() fires before context.initialize()
  // has resolved — which causes isAvailable to be false and blocking to silently no-op.
  useEffect(() => {
    if (!focusLockEnabled || !servicesReady || !focusLockReady) return;
    if (hasStartedBlockingRef.current) return;
    hasStartedBlockingRef.current = true;
    startBlocking()
      .then(() => console.log('🔒 Focus Lock blocking started'))
      .catch(err => console.warn('🔒 Focus Lock start failed (non-critical):', err));
  }, [focusLockEnabled, servicesReady, focusLockReady]);

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

  // React to timer expiry — isCompleted guard prevents a second fire if the
  // effect re-runs (e.g. strict-mode double-invoke in dev).
  useEffect(() => {
    if (isExpired && !isCompleted) {
      handleTimeout();
    }
  }, [isExpired]);

  // SAFE: Session initialization
  const initializeSession = async () => {
    console.log('🔍 Initializing session...');

    try {
      // start() returns the effective endTime (fresh or restored from AsyncStorage)
      const endTime = await start();
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: totalDuration,
        useNativeDriver: false,
      }).start();

      logSessionStart(
        parseFloat(duration),
        musicChoice,
        activityDetails?.name || activity
      ).catch(() => {});

      // Schedule OS-level notification at endTime — fires even if app is killed/locked.
      if (endTime) {
        scheduleSessionEndNotification(
          endTime,
          activityDetails?.name || 'Focus Session',
          parseFloat(duration)
        );
      }

      // Persist config so HomeScreen can offer resume if app is killed mid-session
      saveActiveSession({ activity, duration, musicChoice, focusLockEnabled });

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
          .catch(err => console.warn('🔔 Alarm init failed:', err)),

          focusLockEnabled
          ? Promise.resolve() // startBlocking handled by dedicated useEffect below
          : Promise.resolve(),
      
      
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

  const handleTimeout = async () => {
    // Synchronous re-entry guard — prevents double fire from strict-mode or
    // rapid state updates delivering isExpired=true more than once.
    if (isHandlingTimeoutRef.current) {
      console.log('⏰ handleTimeout already running — skipping duplicate');
      return;
    }
    isHandlingTimeoutRef.current = true;
    console.log('⏰ Session completed!');

    try {
      await cancelSessionEndNotification();

      if (servicesRef.current.audioService) {
        await servicesRef.current.audioService.stopMusic();
      }

      if (servicesRef.current.alarmService) {
        try {
          await servicesRef.current.alarmService.playCompletionAlarm();
          console.log('🔔 Completion alarm played');
        } catch (alarmError) {
          console.warn('🔔 Alarm failed (non-critical):', alarmError);
        }
      }

      setIsCompleted(true);
      logSessionComplete(parseFloat(duration)).catch(() => {});

      // Store the timeout handle so we can cancel it on unmount.
      completionTimeoutRef.current = setTimeout(async () => {
        completionTimeoutRef.current = null;
        await handleNotesSubmit({
          notes: '',
          productivityRating: null,
          focusRating: null,
          energyLevel: null,
        });
      }, 800);

    } catch (error) {
      console.error('❌ Error in handleTimeout:', error);
      setIsCompleted(true);
      completionTimeoutRef.current = setTimeout(() => {
        completionTimeoutRef.current = null;
        setShowNotesModal(true);
      }, 800);
    }
  };

  const togglePause = async () => {
    console.log('🔍 Toggle pause:', isPaused);

    if (isPaused) {
      // Resume — hook recomputes endTime from remaining; reschedule OS notification
      // with the new (extended) endTime so the lock-screen alert still fires correctly.
      logSessionResume(Math.round((totalDuration - timeLeft) / 1000)).catch(() => {});
      const newEndTime = await resume();
      if (newEndTime) {
        scheduleSessionEndNotification(
          newEndTime,
          activityDetails?.name || 'Focus Session',
          parseFloat(duration)
        );
      }
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: timeLeft,
        useNativeDriver: false,
      }).start();

      if (servicesRef.current.backgroundTimer) {
        try {
          await servicesRef.current.backgroundTimer.updateTimerPauseState(false);
        } catch (error) {
          console.warn('Background pause update failed:', error);
        }
      }

      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.resumeMusic();
          console.log('🎵 Music resumed');
        } catch (error) {
          console.warn('🎵 Music resume error:', error);
        }
      }
    } else {
      // Pause — hook captures endTime → remainingAtPause, clears interval
      logSessionPause(Math.round((totalDuration - timeLeft) / 1000)).catch(() => {});
      await pause();
      animatedHeight.stopAnimation();

      if (servicesRef.current.backgroundTimer) {
        try {
          await servicesRef.current.backgroundTimer.updateTimerPauseState(true);
        } catch (error) {
          console.warn('Background pause update failed:', error);
        }
      }

      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.pauseMusic();
          console.log('🎵 Music paused');
        } catch (error) {
          console.warn('🎵 Music pause error:', error);
        }
      }
    }
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
            const elapsedSeconds = Math.round((totalDuration - timeLeft) / 1000);
            logSessionAbandon(elapsedSeconds, parseFloat(duration)).catch(() => {});
            await cleanup();
            navigation.navigate('MainApp', { screen: 'Home' });
          },
          style: 'destructive',
        },
      ]
    );
  };

  const cleanup = async () => {
    // Idempotency guard — cleanup is called from both handleSessionComplete and
    // the unmount effect; running it twice wastes bridge calls and can cause
    // "already stopped" warnings from audio/alarm services.
    if (isCleanedUpRef.current) {
      console.log('🔍 cleanup already ran — skipping');
      return;
    }
    isCleanedUpRef.current = true;
    console.log('🔍 Cleaning up session...');

    // Cancel the pending 1500ms completion timeout if cleanup is called early
    // (e.g. user force-quits mid-delay). Prevents ghost save on unmounted component.
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    try {
      await stop();
      await cancelSessionEndNotification();
      await clearActiveSession(); // remove orphan-detection key


      // Stop Focus Lock blocking regardless of whether it was enabled —
      // defensive call ensures shields are never left on after session ends.
      try {
        await stopBlocking();
        console.log('🔒 Focus Lock blocking stopped');
      } catch (error) {
        console.warn('🔒 Focus Lock cleanup error (non-critical):', error);
      }
  
      if (servicesRef.current.audioService) {
        try {
          await servicesRef.current.audioService.stopMusic();
        } catch (error) {
          console.warn('🎵 Music cleanup error:', error);
        }
      }
  
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
  // Use a ref — not state — as the mutex. State updates are async/batched,
  // so two rapid calls can both read isSaving===false before the re-render.
  if (isSavingRef.current) {
    console.log('🐛 DEBUG: Already saving, skipping duplicate call');
    return false;
  }
  isSavingRef.current = true;

  try {
    setIsSaving(true);
    await cleanup();

    // deepWorkStore.getSessions() auto-repairs storage on read — no need to
    // duplicate that logic here before every save.
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

    // Use the ID that was actually stored — deepWorkStore.addSession generates
    // its own ID internally, so result.session.id is the canonical ID.
    // Pass the full sessionToSave fields (for timestamp, ratings, etc.) but
    // override id so the Firestore doc matches AsyncStorage.
    const savedSessionId = result.session?.id || sessionToSave.id;
    try {
      await saveSessionToFirestore({ ...sessionToSave, id: savedSessionId });
    } catch (firestoreError) {
      console.log('❌ [DeepWorkSession] Firestore save failed (non-critical):', firestoreError.message);
    }
    console.log('✅ Session saved successfully!');
    console.log('===================================\n');
    console.log('🐛 DEBUG: About to navigate to SessionRating with sessionId:', savedSessionId);

    // Navigate to rating screen
    navigation.navigate('SessionRating', { sessionId: savedSessionId });

    // Non-critical post-save: streak + quick-restart config (fire-and-forget)
    Promise.all([
      saveLastSessionConfig({
        activity,
        activityName: activityDetails?.name || '',
        duration,
        musicChoice,
      }),
      incrementStreak(),
      cancelStreakRiskNotification(),
    ]).catch(err => console.warn('[DeepWorkSession] Post-save services failed:', err));

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
    isSavingRef.current = false;
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