import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Pressable,  // ✅ ADDED: For tap detection
  Alert       // ✅ ADDED: For confirmation dialog
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SessionNotesModal = ({ visible, onSubmit, onClose, sessionData }) => {
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    // ✅ Trim whitespace
    const trimmedNotes = notes.trim();
    onSubmit(trimmedNotes);
    setNotes('');  // Clear for next time
  };

  // ✅ NEW: Auto-dismiss on outside tap closes without saving
  const handleOutsideTap = () => {
    if (notes.trim().length > 0) {
      // User has typed something - confirm before dismissing
      Alert.alert(
        'Discard Notes?',
        'You have unsaved notes. Do you want to discard them?',
        [
          { text: 'Keep Writing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => {
              setNotes('');
              onSubmit('');  // Save session without notes
            }
          }
        ]
      );
    } else {
      // No notes typed - just close
      onSubmit('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* ✅ Changed onPress to use new handler */}
      <Pressable style={styles.modalOverlay} onPress={handleOutsideTap}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* ✅ Stop propagation to prevent closing when typing */}
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Session Complete!</Text>
            <Text style={styles.modalSubtitle}>
              How did your {/* ✅ Show session duration */}
              {sessionData?.duration || 'focus'} minute session go?
            </Text>
            
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="What did you accomplish? What went well? (optional)"
              value={notes}
              onChangeText={setNotes}
              autoFocus
              maxLength={500}  // ✅ Reasonable limit
            />
            
            {/* ✅ Character counter */}
            <Text style={styles.characterCount}>
              {notes.length}/500 characters
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.skipButton]} 
                onPress={() => onSubmit('')}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]}
                onPress={handleSubmit}
                // ✅ Disable if too long
                disabled={notes.length > 500}
              >
                <Text style={styles.saveButtonText}>
                  {notes.trim().length > 0 ? 'Save Note' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 20,
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: -16,
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SessionNotesModal;