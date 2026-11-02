import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';
import { useSubscription } from '../../../context/SubscriptionContext';
import { PaywallModal } from '../../../components/PaywallModal';
import {
  getPostInsightSessionCount,
  incrementPostInsightSessionCount,
  resetPostInsightSessionCount,
  checkQuickRestart,
  incrementQuickRestarts,
} from '../../../services/monetizationService';
import { startAnotherNavigationState } from '../../../services/sessionPrefill';
import { deepWorkStore } from '../../../services/deepWorkStore';
import { markRestartOffered } from '../../../services/sessionStateService';
import { getWeekRecap, normalizeStoreSessions } from '../../../services/homeProgress';
import { trackEvent } from '../../../services/analytics';
import {
  EVENTS,
  sessionSummaryViewedParams,
  startAnotherTappedParams,
} from '../../../services/analyticsEvents';

export default function SessionSummaryScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const { isPremium } = useSubscription();

  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInsightPaywall, setShowInsightPaywall] = useState(false);
  const [weekRecap, setWeekRecap] = useState(null);
  const [showQuickRestartPaywall, setShowQuickRestartPaywall] = useState(false);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      const sessionData = await sessionService.getSession(sessionId);
      const statsData = await sessionService.getSessionStats(sessionId);

      setSession(sessionData);
      setStats(statsData);

      // "Build on it" recap from completed sessions (this one is already
      // saved). Best-effort: the section simply hides if this fails.
      // session_summary_viewed fires once, after the recap settles, with
      // counts and 0/1 flags only — never the activity name or reflection.
      deepWorkStore.getSessions()
        .then((all) => getWeekRecap(normalizeStoreSessions(all), Date.now()))
        .catch(() => null)
        .then((recap) => {
          setWeekRecap(recap);
          trackEvent(EVENTS.SESSION_SUMMARY_VIEWED, sessionSummaryViewedParams({
            durationMinutes:       sessionData?.duration,
            weekSessionCount:      recap ? recap.weekCount : null,
            hasNextStep:           !!sessionData?.rating?.reflection?.nextStep?.trim(),
            startAnotherAvailable: sessionData?.found === true && !!sessionData?.activity,
            isFirstSession:        recap ? recap.allTimeCount === 1 : false,
          }));
        });

      // 🔒 GATE: post-insight paywall — show once every 2 sessions after the 3rd
      if (!isPremium && statsData?.allTime >= 3) {
        await incrementPostInsightSessionCount();
        const count = await getPostInsightSessionCount();
        if (count >= 2) {
          await resetPostInsightSessionCount();
          // Small delay so the summary screen renders fully before the modal appears
          setTimeout(() => setShowInsightPaywall(true), 800);
        }
      }
    } catch (error) {
      console.error('Failed to load session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    // Reset the entire navigation stack and go to Metrics
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainApp',
          state: {
            routes: [{ name: 'Metrics' }],
            index: 0,
          },
        },
      ],
    });
  };

  // Prefill Home with this session's activity, duration and music. Never
  // starts a session: the user still presses Begin, so every Home gate
  // (45-min, Focus Lock) applies as usual. Focus Lock is deliberately not
  // carried over — its daily limit is checked when the toggle is tapped.
  // Prefill Home with this session's activity, duration and music. Never
  // starts a session: the user still presses Begin, so every Home gate
  // (45-min, Focus Lock) applies as usual. Focus Lock is deliberately not
  // carried over — its daily limit is checked when the toggle is tapped.
  //
  // Re-loading the last session's settings is a quick restart, so it uses
  // the same entitlement as Home's "Quick restart?" (quickRestartPolicy.js):
  // free users get one per day. A denied tap records nothing.
  const handleStartAnother = async () => {
    trackEvent(EVENTS.SESSION_START_ANOTHER_TAPPED, startAnotherTappedParams({
      durationMinutes:  session.duration,
      weekSessionCount: weekRecap ? weekRecap.weekCount : null,
    }));
    const decision = await checkQuickRestart(isPremium);
    if (!decision.allowed) {
      if (decision.showPaywall) {
        setShowQuickRestartPaywall(true);
      } else {
        // Premium (2/day) is already upgraded — tell them rather than sell.
        Alert.alert('Quick restarts used', "You've used today's quick restarts.", [
          { text: 'Set up manually', onPress: handleSetUpManually },
        ]);
      }
      return;
    }
    await incrementQuickRestarts();
    // Home would otherwise also offer "Quick restart?" for this same config.
    await markRestartOffered();
    navigation.reset(startAnotherNavigationState(session));
  };

  // Paywall fallback: Home with nothing pre-filled, like Home's own
  // "Start manually". Consumes nothing.
  const handleSetUpManually = () => {
    navigation.reset(startAnotherNavigationState(null));
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!session) return null;

  const nextStep = session.rating?.reflection?.nextStep?.trim() || null;
  const canStartAnother = session.found === true && !!session.activity;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getFocusRatingText = (rating) => {
    if (!rating || !rating.focus) return 'Not rated';
    return `${rating.focus}/5`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Lucid</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {session.activityName.toUpperCase()} SESSION{'\n'}SUMMARY
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Date */}
        <Text style={styles.label}>DATE</Text>
        <Text style={styles.value}>{formatDate(session.completedAt)}</Text>

        {/* Session Length */}
        <Text style={styles.label}>SESSION LENGTH: {Math.round(session.duration)}</Text>

        {/* Summary Section */}
        <Text style={styles.sectionTitle}>SUMMARY</Text>

        <Text style={styles.label}>
          Focus Rating: <Text style={styles.value}>{getFocusRatingText(session.rating)}</Text>
        </Text>

        {/* Structured reflection — falls back to legacy `notes` string */}
        {(session.rating?.reflection?.workedOn || session.rating?.notes) && (
          <Text style={styles.label}>
            Worked on: <Text style={styles.value}>
              {session.rating.reflection?.workedOn || session.rating.notes}
            </Text>
          </Text>
        )}
        {session.rating?.reflection?.wentWell ? (
          <Text style={styles.label}>
            Went well: <Text style={styles.value}>{session.rating.reflection.wentWell}</Text>
          </Text>
        ) : null}
        {session.rating?.reflection?.distractions ? (
          <Text style={styles.label}>
            Distractions: <Text style={styles.value}>{session.rating.reflection.distractions}</Text>
          </Text>
        ) : null}

        {/* Stats Section */}
        {stats && (
          <>
            <Text style={styles.statsLabel}>THIS MONTH: {stats.thisMonth || 0}</Text>
            <Text style={styles.statsLabel}>THIS YEAR: {stats.thisYear || 0}</Text>
            <Text style={styles.statsLabel}>ALL TIME: {stats.allTime || 0}</Text>
            <Text style={styles.statsLabel}>AVERAGE SESSION LENGTH: {stats.avgLength || 0}</Text>
            <Text style={styles.statsLabel}>MOST PRODUCTIVE DAY: {stats.mostProductiveDay || 'N/A'}</Text>
          </>
        )}

        {/* Build on it — only real data; hidden entirely when there's none */}
        {(weekRecap || nextStep) && (
          <View style={styles.buildOnIt}>
            <Text style={styles.sectionTitle}>BUILD ON IT</Text>
            {weekRecap ? (
              <Text style={styles.buildHeadline}>{weekRecap.headline}</Text>
            ) : null}
            {nextStep ? (
              <Text style={styles.label}>
                Next step: <Text style={styles.value}>{nextStep}</Text>
              </Text>
            ) : null}
          </View>
        )}

        {/* Done Button */}
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>

        {canStartAnother && (
          <TouchableOpacity
            style={styles.startAnotherButton}
            onPress={handleStartAnother}
            accessibilityHint="Opens Home with this session's settings. Press Begin to start."
          >
            <Text style={styles.startAnotherButtonText}>Start another</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 🔒 Post-insight paywall — non-blocking, appears after summary renders */}
      <PaywallModal
        visible={showInsightPaywall}
        onClose={() => setShowInsightPaywall(false)}
        limitType="post_insight"
      />

      {/* 🔒 Quick-restart limit reached via "Start another" — same gate as Home */}
      <PaywallModal
        visible={showQuickRestartPaywall}
        onClose={() => setShowQuickRestartPaywall(false)}
        limitType="quick_restart"
        secondaryCtaText="Set up manually"
        onSecondaryAction={handleSetUpManually}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#000000',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#000000',
    marginVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  value: {
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    letterSpacing: 0.3,
  },
  doneButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buildOnIt: {
    marginTop: 8,
  },
  buildHeadline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  startAnotherButton: {
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  startAnotherButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});