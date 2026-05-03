// src/screens/HomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  Platform,
  Alert
} from 'react-native';
import { Clock, Music, Pencil } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import { useTheme, THEMES } from '../context/ThemeContext';
import SharedHeader from '../components/SharedHeader';
import { useSubscription } from '../context/SubscriptionContext';
import { PaywallModal } from '../components/PaywallModal';
import { useFocusLock } from '../context/FocusLockContext';
import {
  getActiveSession,
  discardActiveSession,
  getLastSessionConfig,
  markRestartOffered,
} from '../services/sessionStateService';
import {
  getStreak,
  scheduleStreakRiskNotification,
  getLastStreakModalSeen,
  setLastStreakModalSeen,
} from '../services/streakService';
import { WeeklyStreakModal } from '../components/WeeklyStreakModal';
import {
  getBlockingUsedToday,
  recordBlockingUsed,
  getQuickRestartsToday,
  incrementQuickRestarts,
} from '../services/monetizationService';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 50;
const CONTENT_PADDING_TOP = HEADER_HEIGHT - (Platform.OS === 'ios' ? 0 : 20);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning — ready to focus?';
  if (h < 18) return "Good afternoon — let's get a session in";
  return 'Good evening — finish strong';
};

const calculateTotalHours = (sessions) =>
  Math.floor(
    Object.values(sessions).flat().reduce((sum, s) => sum + (s.duration || 0), 0) / 60
  );


const HomeScreen = () => {
  const navigation = useNavigation();
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;
  
  // ✅ NEW: RevenueCat subscription state
  const { isPremium, isLoading: isSubscriptionLoading } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallGate, setPaywallGate] = useState('session'); // which gate triggered
  const [paywallSecondaryAction, setPaywallSecondaryAction] = useState(null);
  const [paywallSecondaryText, setPaywallSecondaryText] = useState(null);

  const showGatedPaywall = (gate, secondaryText, secondaryAction) => {
    setPaywallGate(gate);
    setPaywallSecondaryText(secondaryText ?? null);
    setPaywallSecondaryAction(() => secondaryAction ?? null);
    setShowPaywall(true);
  };
  
  // Core state for session configuration
  const [duration, setDuration] = useState('');
  const [activity, setActivity] = useState('');
  const [musicChoice, setMusicChoice] = useState('');
  
  // State for managing settings loaded from deepWorkStore
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // ── Session recovery + streak state ─────────────────────────────────────────
  const [activeSession, setActiveSession]         = useState(null); // interrupted session prompt
  const [lastSessionConfig, setLastSessionConfig] = useState(null); // quick restart prompt
  const [streak, setStreak]                       = useState({ count: 0, lastSessionDate: null });
  const [totalHours, setTotalHours]               = useState(0);

  // ── Streak modal state ───────────────────────────────────────────────────────
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [streakModalSessions, setStreakModalSessions] = useState({});

  // ── Session recovery + streak check on every focus ────────────���──────────────
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const checkSessionState = async () => {
        // 1. Check for an interrupted (orphaned) session
        const orphan = await getActiveSession();
        if (!cancelled) setActiveSession(orphan);

        // 2. Check for quick-restart opportunity (only if no orphan)
        if (!orphan) {
          const last = await getLastSessionConfig();
          if (!cancelled) setLastSessionConfig(
            last && !last.hasOfferedRestart ? last : null
          );
        }

        // 3. Load streak + schedule tonight's risk notification if needed
        const currentStreak = await getStreak();
        if (!cancelled) setStreak(currentStreak);
        scheduleStreakRiskNotification(currentStreak);
      };

      checkSessionState();
      return () => { cancelled = true; };
    }, [])
  );

  // ── Interrupted-session handlers ─────────────────────────────────────────────

  const handleResumeSession = () => {
    setActiveSession(null);
    navigation.navigate('DeepWorkSession', {
      duration:         String(activeSession.config.duration),
      activity:         activeSession.config.activity,
      musicChoice:      activeSession.config.musicChoice,
      focusLockEnabled: activeSession.config.focusLockEnabled,
    });
  };

  const handleSaveExpiredSession = async () => {
    const config = activeSession?.config;
    if (!config) { setActiveSession(null); return; }

    try {
      const result = await deepWorkStore.addSession({
        activity:    config.activity,
        duration:    parseFloat(config.duration),
        musicChoice: config.musicChoice || 'none',
        notes:       '',
        timestamp:   activeSession.endTime,
      });
      await discardActiveSession();
      setActiveSession(null);

      if (result.success && result.session?.id) {
        navigation.navigate('SessionRating', { sessionId: result.session.id });
      }
    } catch (err) {
      console.warn('[HomeScreen] Save expired session failed:', err);
      await discardActiveSession();
      setActiveSession(null);
    }
  };

  const handleAbandonSession = async () => {
    await discardActiveSession();
    setActiveSession(null);
  };

  // ── Quick restart handler ─────────────────────────────────────────────────────

  const handleQuickRestart = async () => {
    // 🔒 GATE: second quick restart per day requires premium
    if (!isPremium) {
      const restartsToday = await getQuickRestartsToday();
      if (restartsToday >= 1) {
        dismissQuickRestart();
        showGatedPaywall(
          'quick_restart',
          'Start manually',
          null, // fallback just leaves the user on HomeScreen to configure manually
        );
        return;
      }
    }

    const cfg = lastSessionConfig;
    markRestartOffered();
    setLastSessionConfig(null);
    setDuration(String(cfg.duration));
    setActivity(cfg.activity);
    setMusicChoice(cfg.musicChoice);
    await incrementQuickRestarts();
  };

  const dismissQuickRestart = () => {
    markRestartOffered();
    setLastSessionConfig(null);
  };

  // All durations available, with 15-second option in DEV mode
  const availableDurations = __DEV__ 
    ? [0.25, 5, 10, 15, 20, 30, 45]  // 0.25 = 15 seconds
    : [5, 10, 15, 20, 30, 45];

  // Music options
  const musicOptions = [
    { value: 'none', label: 'No music' },
    { value: 'white-noise', label: 'White noise' },
    { value: 'lofi', label: 'Lo-fi' }
  ];
  const { isAvailable, selectionCount, refreshSelection } = useFocusLock();
const [focusLockEnabled, setFocusLockEnabled] = useState(false);


  // Load settings when component first mounts
  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    const settings = await deepWorkStore.getSettings();
    if (!settings.activities.length) {
      navigation.replace('InitialSetup');
    } else {
      loadSettings();
      maybeShowStreakModal();
    }
  };

  const maybeShowStreakModal = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastSeen = await getLastStreakModalSeen();
      if (lastSeen === today) return;

      const sessions = await deepWorkStore.getSessions();
      setStreakModalSessions(sessions);
      setShowStreakModal(true);
      await setLastStreakModalSeen(today);
    } catch (err) {
      console.warn('[HomeScreen] maybeShowStreakModal failed:', err);
    }
  };

  // Reload settings whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
      refreshSelection();
    }, [])
  );

  // Function to load settings from deepWorkStore
  const loadSettings = async () => {
    try {
      if (!hasInitialized.current) {
        setIsLoading(true);
      }
      const settings = await deepWorkStore.getSettings();

      setActivities(settings.activities);

      // Validate activity selection
      if (activity && !settings.activities.some(a => a.id === activity)) {
        setActivity('');
      }

      const sessions = await deepWorkStore.getSessions();
      setTotalHours(calculateTotalHours(sessions));
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
      hasInitialized.current = true;
    }
  };

  // Handle starting a new deep work session
  const handleStartSession = () => {

    if (!activity || !duration || !musicChoice) {
      Alert.alert('Incomplete', 'Please select all options before starting');
      return;
    }
  
    // Parse duration as number
    const selectedDuration = parseFloat(duration);
    
    // 🔒 GATE: long sessions (45+ min) require premium
    if (!isPremium && selectedDuration >= 45) {
      showGatedPaywall(
        'long_session',
        'Start 30 min session',
        () => setDuration('30'),
      );
      return;
    }
    
    console.log('✅ Starting session - duration:', selectedDuration, 'minutes');

    const effectiveFocusLock = isAvailable && focusLockEnabled;

    // Record blocking usage so the daily gate can check it on next session
    if (effectiveFocusLock) {
      recordBlockingUsed();
    }

    navigation.navigate('DeepWorkSession', {
      duration,
      activity,
      musicChoice,
      focusLockEnabled: effectiveFocusLock,
    });
  };

  // Render individual activity item in the horizontal list
  const renderActivity = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.activityItem,
        { 
          backgroundColor: isDark ? colors.card : colors.background,
          borderColor: activity === item.id ? colors.primary : colors.border
        },
        activity === item.id && styles.activityItemSelected
      ]}
      onPress={() => setActivity(item.id)}
    >
      <View style={[styles.colorDot, { backgroundColor: item.color }]} />
      <Text style={[styles.activityName, { color: colors.text }]}>{item.name}</Text>
    </TouchableOpacity>
  );

  // Render individual duration item in the horizontal list
  const renderDuration = ({ item }) => {
    const displayText = item === 0.25 ? '15 sec' : `${item} min`;
    
    return (
      <TouchableOpacity
        style={[
          styles.durationItem,
          { 
            backgroundColor: isDark ? colors.card : colors.background,
            borderColor: duration === item.toString() ? colors.primary : colors.border
          },
          duration === item.toString() && [
            styles.durationItemSelected,
            { backgroundColor: colors.primary }
          ]
        ]}
        onPress={() => setDuration(item.toString())}
      >
        <Text
          style={[
            styles.durationText,
            { color: isDark ? '#fff' : colors.text },
            duration === item.toString() && styles.durationTextSelected
          ]}
        >
          {displayText}
        </Text>
        {item === 0.25 && __DEV__ && (
          <Text style={{ fontSize: 10, color: colors.primary, marginTop: 2 }}>
            DEV
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Show loading screen while fetching settings
  if (isLoading) {
    return (
      <View style={[
        styles.container, 
        styles.centered,
        { backgroundColor: colors.background }
      ]}>
        <SharedHeader />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SharedHeader />
      
      <ScrollView 
        style={[styles.content, { paddingTop: CONTENT_PADDING_TOP }]}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <View style={homeStyles.headerRow}>
            <View style={homeStyles.streakPill}>
              <Text style={homeStyles.streakPillText}>
                {streak.count > 0 ? `${streak.count} day focus streak` : '0 day focus streak'}
              </Text>
            </View>
            {totalHours > 0 && (
              <View style={homeStyles.hoursPill}>
                <Text style={homeStyles.hoursPillText}>{totalHours}h total focus hours</Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{getGreeting()}</Text>
        </View>
        
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        
        {/* Activity Selection Section */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: activity ? colors.primary : colors.border 
          },
          activity && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Pencil stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity Name</Text>
          </View>
          <FlatList
            data={activities}
            renderItem={renderActivity}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activitiesList}
          />
        </View>
        
        {/* Duration Selection Section */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: duration ? colors.primary : colors.border 
          },
          duration && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Clock stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Duration</Text>
          </View>
          <FlatList
            data={availableDurations}
            renderItem={renderDuration}
            keyExtractor={item => item.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.durationsList}
            contentContainerStyle={styles.durationsListContent}
          />
        </View>

        {/* Music Selection Section */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: musicChoice ? colors.primary : colors.border 
          },
          musicChoice && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Music stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Background Music</Text>
          </View>
          <View style={styles.musicButtons}>
            {musicOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.musicButton,
                  { backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' },
                  musicChoice === option.value && { backgroundColor: colors.primary }
                ]}
                onPress={() => setMusicChoice(option.value)}
              >
                <Text
                  style={[
                    styles.musicButtonText,
                    { color: isDark ? colors.textSecondary : '#6b7280' },
                    musicChoice === option.value && { color: 'white' }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isAvailable && (
  <View style={[
    styles.section,
    {
      backgroundColor: isDark ? '#1f1f1f' : colors.card,
      borderColor: focusLockEnabled ? '#6C63FF' : colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }
  ]}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        🔒 Focus Lock
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
        Block {selectionCount} app{selectionCount !== 1 ? 's' : ''} during session
      </Text>
    </View>
    <TouchableOpacity
      style={{
        width: 51,
        height: 31,
        borderRadius: 15.5,
        backgroundColor: focusLockEnabled ? '#6C63FF' : (isDark ? '#3A3A3C' : '#E5E5EA'),
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}
      onPress={async () => {
        const next = !focusLockEnabled;
        // 🔒 GATE: second block attempt per day requires premium
        if (next && !isPremium) {
          const usedToday = await getBlockingUsedToday();
          if (usedToday) {
            showGatedPaywall(
              'blocking_limit',
              'Continue without blocking',
              () => setFocusLockEnabled(false),
            );
            return;
          }
        }
        setFocusLockEnabled(next);
      }}
      activeOpacity={0.8}
    >
      <View style={{
        width: 27,
        height: 27,
        borderRadius: 13.5,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        alignSelf: focusLockEnabled ? 'flex-end' : 'flex-start',
      }} />
    </TouchableOpacity>
  </View>
)}
        
        {/* Extra padding at bottom */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={[styles.footer, { 
        backgroundColor: isDark ? '#1f1f1f' : colors.card,
        borderTopColor: colors.border 
      }]}>
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: '#2563EB' },
            (!duration || !activity || !musicChoice) && styles.startButtonDisabled
          ]}
          onPress={handleStartSession}
          disabled={!duration || !activity || !musicChoice}
        >
          <Text style={[styles.startButtonText, { color: 'white' }]}>Begin Deep Work Timer</Text>
        </TouchableOpacity>
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        limitType={paywallGate}
        onSecondaryAction={paywallSecondaryAction}
        secondaryCtaText={paywallSecondaryText}
      />

      {/* ── Interrupted session modal ────────────────────────────────────────── */}
      <Modal
        visible={!!activeSession}
        transparent
        animationType="fade"
        onRequestClose={handleAbandonSession}
      >
        <View style={homeStyles.overlay}>
          <View style={[homeStyles.sheet, { backgroundColor: colors.card || '#1a1a1a' }]}>
            {activeSession?.status === 'running' ? (
              <>
                <Text style={[homeStyles.sheetTitle, { color: colors.text }]}>
                  Session in progress
                </Text>
                <Text style={[homeStyles.sheetBody, { color: colors.textSecondary }]}>
                  Your {activeSession.config.duration}-min{' '}
                  {activeSession.config.activity} session is still running.
                  Pick up where you left off?
                </Text>
                <TouchableOpacity
                  style={[homeStyles.primaryBtn, { backgroundColor: '#2563EB' }]}
                  onPress={handleResumeSession}
                >
                  <Text style={homeStyles.primaryBtnText}>Resume Session</Text>
                </TouchableOpacity>
                <TouchableOpacity style={homeStyles.ghostBtn} onPress={handleAbandonSession}>
                  <Text style={[homeStyles.ghostBtnText, { color: colors.textSecondary }]}>
                    Abandon
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[homeStyles.sheetTitle, { color: colors.text }]}>
                  Session ended while away
                </Text>
                <Text style={[homeStyles.sheetBody, { color: colors.textSecondary }]}>
                  Your {activeSession?.config.duration}-min{' '}
                  {activeSession?.config.activity} session finished while the app
                  was closed. Save it to your history?
                </Text>
                <TouchableOpacity
                  style={[homeStyles.primaryBtn, { backgroundColor: '#15803D' }]}
                  onPress={handleSaveExpiredSession}
                >
                  <Text style={homeStyles.primaryBtnText}>Save Session</Text>
                </TouchableOpacity>
                <TouchableOpacity style={homeStyles.ghostBtn} onPress={handleAbandonSession}>
                  <Text style={[homeStyles.ghostBtnText, { color: colors.textSecondary }]}>
                    Skip
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Quick restart modal ──────────────────────────────────────────────── */}
      <Modal
        visible={!!lastSessionConfig}
        transparent
        animationType="fade"
        onRequestClose={dismissQuickRestart}
      >
        <View style={homeStyles.overlay}>
          <View style={[homeStyles.sheet, { backgroundColor: colors.card || '#1a1a1a' }]}>
            <Text style={[homeStyles.sheetTitle, { color: colors.text }]}>
              Quick restart?
            </Text>
            <Text style={[homeStyles.sheetBody, { color: colors.textSecondary }]}>
              Last session:{' '}
              {lastSessionConfig?.activityName || lastSessionConfig?.activity},{' '}
              {lastSessionConfig?.duration} min
            </Text>
            <TouchableOpacity
              style={[homeStyles.primaryBtn, { backgroundColor: '#2563EB' }]}
              onPress={handleQuickRestart}
            >
              <Text style={homeStyles.primaryBtnText}>Start Same Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={homeStyles.ghostBtn} onPress={dismissQuickRestart}>
              <Text style={[homeStyles.ghostBtnText, { color: colors.textSecondary }]}>
                Set up differently
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Weekly streak modal (once per day) ──────────────────────────────── */}
      <WeeklyStreakModal
        visible={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        onStartSession={null}
        sessions={streakModalSessions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingBottom: 20,
    alignItems: 'stretch',
  },
  header: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'center',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCompleted: {
    borderColor: '#2563eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Duration Styles
  durationsList: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  durationsListContent: {
    gap: 8,
  },
  durationItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    borderWidth: 1,
  },
  durationItemSelected: {
    borderWidth: 2,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  durationTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  
  // Activity Styles
  activitiesList: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    width: SCREEN_WIDTH * 0.42,
  },
  activityItemSelected: {
    borderWidth: 2,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Music Styles
  musicButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  musicButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  musicButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Footer Styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  startButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Loading state
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },

  // ✅ NEW: Test Section Styles
  testSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    width: '100%',
  },
  testSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  testLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testLoadingText: {
    fontSize: 14,
  },
  testContent: {
    gap: 12,
  },
  testStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  testStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  testStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  testButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  testHint: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

const homeStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  streakPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(234,88,12,0.12)',
  },
  streakPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ea580c',
  },
  hoursPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(21,128,61,0.12)',
  },
  hoursPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ghostBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontSize: 15,
  },
});

export default HomeScreen;