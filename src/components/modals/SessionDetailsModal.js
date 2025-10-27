import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable
} from 'react-native';
import { X } from 'lucide-react-native';

const SessionDetailsModal = ({ visible, session, activities = [], onClose }) => {
  if (!session) return null;

  /**
   * Get the activity name by looking up the activity ID
   * 
   * INTERVIEW CONCEPT: Data normalization
   * Sessions store activity IDs (like "1", "2") instead of full activity objects
   * This is called "normalization" - storing references instead of duplicating data
   * 
   * Benefits:
   * - If activity name changes, we only update it in one place (activities list)
   * - Sessions take up less storage space
   * - Prevents data inconsistency
   * 
   * Trade-off: Need to "join" the data when displaying (like SQL joins)
   */
  const getActivityName = () => {
    // Find the activity object that matches the session's activity ID
    const activity = activities.find(a => a.id === session.activity);
    
    // If found, return the name; otherwise return a formatted version of the ID
    if (activity) {
      return activity.name;
    }
    
    // Fallback: If activity not found (maybe it was deleted?), format the ID
    // This prevents the app from crashing if data is inconsistent
    return formatActivityName(session.activity);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatActivityName = (name) => {
    // Helper function for formatting activity IDs as fallback
    // Handles cases like "deep-work" → "Deep Work"
    return name.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay} 
        onPress={onClose}
      >
        <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <X size={24} color="#6b7280" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Session Details</Text>
            
            <View style={styles.detailSection}>
              <Text style={styles.label}>Activity</Text>
              <Text style={styles.value}>
                {getActivityName()}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.value}>{session.duration} minutes</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.label}>Music Choice</Text>
              <Text style={styles.value}>
                {session.musicChoice === 'none' ? 'No music' : formatActivityName(session.musicChoice)}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.label}>Completed</Text>
              <Text style={styles.value}>
                {formatTime(session.completedAt)}
              </Text>
              <Text style={styles.dateValue}>
                {formatDate(session.completedAt)}
              </Text>
            </View>

            {session.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.label}>Session Notes</Text>
                <Text style={styles.notes}>{session.notes}</Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
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
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  notesSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notes: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
  },
});

export default SessionDetailsModal;