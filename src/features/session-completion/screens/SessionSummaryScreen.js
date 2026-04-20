import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';
import { useSubscription } from '../../../context/SubscriptionContext';
import { PaywallModal } from '../../../components/PaywallModal';
import {
  getPostInsightSessionCount,
  incrementPostInsightSessionCount,
  resetPostInsightSessionCount,
} from '../../../services/monetizationService';

export default function SessionSummaryScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const { isPremium } = useSubscription();

  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInsightPaywall, setShowInsightPaywall] = useState(false);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      const sessionData = await sessionService.getSession(sessionId);
      const statsData = await sessionService.getSessionStats(sessionId);

      setSession(sessionData);
      setStats(statsData);

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

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (!session) return null;

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
          <Text style={styles.logo}>DeepWork.io</Text>
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
        {session.rating?.reflection?.nextStep ? (
          <Text style={styles.label}>
            Next step: <Text style={styles.value}>{session.rating.reflection.nextStep}</Text>
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

        {/* Done Button */}
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 🔒 Post-insight paywall — non-blocking, appears after summary renders */}
      <PaywallModal
        visible={showInsightPaywall}
        onClose={() => setShowInsightPaywall(false)}
        limitType="post_insight"
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
});