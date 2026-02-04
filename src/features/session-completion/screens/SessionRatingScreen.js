import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionService } from '../services/sessionService';

const EMOJIS = ['😔', '😐', '🙂', '😊', '🤩'];

export default function SessionRatingScreen({ navigation, route }) {
  const { sessionId } = route.params;
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');

  const handleContinue = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before continuing');
      return;
    }

    try {
      await sessionService.saveRating(sessionId, {
        rating,
        notes: notes.trim() || undefined,
        ratedAt: new Date().toISOString(),
      });

      navigation.navigate('SessionSummary', { sessionId });
    } catch (error) {
      console.error('Failed to save rating:', error);
      Alert.alert('Error', 'Failed to save rating. Please try again.');
    }
  };

  const handleSkip = () => {
    navigation.navigate('SessionSummary', { sessionId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>How was your session?</Text>

          {/* Rating Emojis */}
          <View style={styles.emojiRow}>
            {EMOJIS.map((emoji, index) => {
              const value = index + 1;
              const selected = rating === value;
              
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setRating(value)}
                  style={[styles.emoji, selected && styles.emojiSelected]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes Input */}
          <TextInput
            style={styles.input}
            placeholder="What did you work on?"
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{notes.length}/200</Text>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.button, rating === 0 && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={rating === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 40,
    color: '#000',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  emoji: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiSelected: {
    backgroundColor: '#E8F4FF',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  emojiText: {
    fontSize: 32,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  skip: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    padding: 12,
  },
});