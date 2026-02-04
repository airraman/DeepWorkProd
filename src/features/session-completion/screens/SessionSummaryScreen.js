import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';

export default function SessionSummaryScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const data = await sessionService.getSession(sessionId);
      setSession(data);
    } catch (error) {
      console.error('Failed to load session:', error);
      Alert.alert('Error', 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!session) return;

    const minutes = Math.round(session.duration);
    const ratingText = session.rating 
      ? ` (${getRatingEmoji(session.rating.rating)} ${session.rating.rating}/5)` 
      : '';
    
    const message = `I just completed a ${minutes} minute focused work session${ratingText} using DeepWork.io 🧠\n\nStay focused, stay productive.`;

    try {
      await Share.share({
        message,
        url: 'https://deep-work.io',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleDone = () => {
    navigation.navigate('MainApp', { screen: 'Home' });
  };

  const getRatingEmoji = (rating) => {
    const emojiMap = {
      1: '😔',
      2: '😐',
      3: '🙂',
      4: '😊',
      5: '🤩',
    };
    return emojiMap[rating] || '⭐';
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Summary Card */}
        <View style={styles.card}>
          <Text style={styles.logo}>DeepWork.io</Text>
          
          <Text style={styles.activity}>{session.activityName}</Text>
          
          <View style={styles.durationContainer}>
            <Text style={styles.duration}>
              {Math.round(session.duration)}
            </Text>
            <Text style={styles.durationLabel}>minutes</Text>
          </View>
          
          <Text style={styles.label}>of deep work</Text>

          {session.rating && (
            <View style={styles.ratingContainer}>
              <Text style={styles.stars}>
                {'⭐'.repeat(session.rating.rating)}
              </Text>
              {session.rating.notes && (
                <Text style={styles.notes} numberOfLines={2}>
                  "{session.rating.notes}"
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Congrats Message */}
        <View style={styles.congratsContainer}>
          <Text style={styles.congratsEmoji}>🎉</Text>
          <Text style={styles.congrats}>Great work!</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.shareButton} 
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Text style={styles.shareText}>📤 Share session</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDone}>
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  activity: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
    color: '#000',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  duration: {
    fontSize: 56,
    fontWeight: '700',
    color: '#007AFF',
    marginRight: 8,
  },
  durationLabel: {
    fontSize: 18,
    color: '#666',
  },
  label: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  ratingContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  stars: {
    fontSize: 28,
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  congratsContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  congratsEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  congrats: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  shareButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  shareText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  done: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    padding: 12,
    fontWeight: '500',
  },
});