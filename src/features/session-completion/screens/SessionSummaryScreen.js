import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';

export default function SessionSummaryScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      const sessionData = await sessionService.getSession(sessionId);
      const statsData = await sessionService.getSessionStats(sessionId);
      
      setSession(sessionData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!session) return;

    const message = `I just completed a ${Math.round(session.duration)} minute ${session.activityName} session using DeepWork.io 🧠\n\nStay focused, stay productive.`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Share failed:', error);
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
    return `${rating.focus}/10`;
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
        
        {session.rating?.notes && (
          <>
            <Text style={styles.label}>Description: <Text style={styles.value}>{session.rating.notes}</Text></Text>
          </>
        )}
        
        <Text style={styles.label}>
          Focus Rating: <Text style={styles.value}>{getFocusRatingText(session.rating)}</Text>
        </Text>

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

        {/* Share Buttons */}
        <View style={styles.shareButtons}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TouchableOpacity 
              key={i} 
              style={styles.shareButton}
              onPress={handleShare}
            >
              <View style={styles.sharePlaceholder} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Done Button */}
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
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
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 24,
  },
  shareButton: {
    width: 50,
    height: 50,
  },
  sharePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DDDDDD',
  },
  doneButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});