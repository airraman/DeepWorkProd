// src/components/modals/ActivitySummaryModal.js

import React, { useMemo } from 'react';
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

/**
 * ActivitySummaryModal
 * 
 * Displays comprehensive statistics for a specific activity type.
 * Simple layout with dark styling (black background, white text).
 */
const ActivitySummaryModal = ({ 
  visible, 
  activity, 
  sessions, 
  selectedMonth, 
  onClose 
}) => {

  /**
   * HELPER FUNCTIONS - Defined BEFORE useMemo
   */
  
  /**
   * Format date for display in "Mar 27" format
   * INTERVIEW CONCEPT: Date handling and timezone issues
   */
  const formatSessionDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  /**
   * Format duration for display (e.g., "30m", "1h 10m")
   */
  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  /**
   * CORE DATA PROCESSING
   */
  const activityStats = useMemo(() => {
    if (!activity || !sessions || !selectedMonth) {
      return null;
    }

    // EXTRACT: Get all sessions for the selected month
    const allSessions = [];
    Object.entries(sessions).forEach(([date, daySessions]) => {
      if (date.startsWith(selectedMonth)) {
        daySessions.forEach(session => {
          allSessions.push({ ...session, date });
        });
      }
    });

    // Filter to only this activity's sessions
    const activitySessions = allSessions.filter(
      session => session.activity === activity.id
    );
    
    console.log(`📊 [${activity.name}] Found ${activitySessions.length} sessions in ${selectedMonth}`);

    if (activitySessions.length === 0) {
      return {
        sessionCount: 0,
        totalMinutes: 0,
        totalHours: 0,
        avgMinutes: 0,
        longestSession: 0,
        mostProductiveDay: null,
        recentSessions: []
      };
    }

    // TRANSFORM: Calculate statistics

    // 1. Total time and session count
    const totalMinutes = activitySessions.reduce(
      (sum, session) => sum + session.duration, 
      0
    );
    const sessionCount = activitySessions.length;

    // 2. Convert to hours and minutes for display
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // 3. Average session length
    const avgMinutes = Math.round(totalMinutes / sessionCount);

    // 4. Longest session
    const longestSession = Math.max(
      ...activitySessions.map(s => s.duration)
    );

    // 5. Most productive day
    const dayTotals = {};
    activitySessions.forEach(session => {
      const dayName = new Date(session.date).toLocaleDateString('en-US', { 
        weekday: 'long' 
      });
      dayTotals[dayName] = (dayTotals[dayName] || 0) + session.duration;
    });

    let mostProductiveDay = null;
    let maxMinutes = 0;
    Object.entries(dayTotals).forEach(([day, minutes]) => {
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        mostProductiveDay = day;
      }
    });

    // 6. Recent sessions (last 5, sorted by date descending, then by ID)
    const recentSessions = activitySessions
      .sort((a, b) => {
        const dateComparison = new Date(b.date) - new Date(a.date);
        if (dateComparison !== 0) return dateComparison;
        
        if (a.timestamp && b.timestamp) {
          return b.timestamp - a.timestamp;
        }
        if (a.id && b.id) {
          return b.id.localeCompare(a.id);
        }
        return 0;
      })
      .slice(0, 5)
      .map(session => ({
        date: session.date,
        duration: session.duration,
        formattedDate: formatSessionDate(session.date)
      }));
    
    console.log(`📅 Recent sessions (newest first):`, recentSessions.map(s => s.formattedDate).join(', '));

    // LOAD: Return structured data
    return {
      sessionCount,
      totalMinutes,
      totalHours: hours,
      totalDisplayMinutes: minutes,
      avgMinutes,
      longestSession,
      mostProductiveDay: mostProductiveDay || 'N/A',
      recentSessions
    };
  }, [activity, sessions, selectedMonth]);

  if (!activityStats) return null;

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
        <Pressable 
          style={styles.modalContent} 
          onPress={e => e.stopPropagation()}
        >
          {/* Close button in top right */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#9ca3af" />
          </TouchableOpacity>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Title with activity name */}
            <Text style={styles.title}>{activity.name}</Text>

            {/* Total Focus Time */}
            <View style={styles.detailSection}>
              <Text style={styles.label}>Total Focus Time</Text>
              <Text style={styles.value}>
                {formatDuration(activityStats.totalMinutes)}
              </Text>
            </View>

            {/* Sessions Count */}
            <View style={styles.detailSection}>
              <Text style={styles.label}>Sessions</Text>
              <Text style={styles.value}>
                {activityStats.sessionCount} {activityStats.sessionCount === 1 ? 'session' : 'sessions'}
              </Text>
            </View>

            {/* Longest Session */}
            <View style={styles.detailSection}>
              <Text style={styles.label}>Longest Session</Text>
              <Text style={styles.value}>
                {formatDuration(activityStats.longestSession)}
              </Text>
            </View>

            {/* Average Session */}
            <View style={styles.detailSection}>
              <Text style={styles.label}>Average Session</Text>
              <Text style={styles.value}>
                {formatDuration(activityStats.avgMinutes)}
              </Text>
            </View>

            {/* Most Productive Day */}
            <View style={styles.detailSection}>
              <Text style={styles.label}>Most Productive Day</Text>
              <Text style={styles.value}>
                {activityStats.mostProductiveDay}
              </Text>
            </View>

            {/* Recent Sessions */}
            {activityStats.recentSessions.length > 0 && (
              <View style={styles.recentSessionsSection}>
                <Text style={styles.label}>Recent Sessions</Text>
                
                {activityStats.recentSessions.map((session, index) => (
                  <View 
                    key={`${session.date}-${index}`}
                    style={styles.sessionRow}
                  >
                    <Text style={styles.sessionDate}>
                      {session.formattedDate}
                    </Text>
                    <Text style={styles.sessionDuration}>
                      {formatDuration(session.duration)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Empty state if no sessions */}
            {activityStats.sessionCount === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No sessions recorded for {activity.name} in the selected month.
                </Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/**
 * STYLING NOTES:
 * 
 * Dark theme with SessionDetailsModal proportions
 * - Black background (#1f2937)
 * - White text with gray labels
 * - Simple section-based layout
 * - Fixed height for predictable rendering
 */
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1f2937',  // Dark gray/black
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    height: 550,  // Fixed height to ensure rendering
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
    color: '#ffffff',  // White
    marginBottom: 20,
    textAlign: 'center',
  },
  detailSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#9ca3af',  // Light gray for labels
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#ffffff',  // White for values
    fontWeight: '500',
  },
  recentSessionsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',  // Darker gray border
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  sessionDate: {
    fontSize: 14,
    color: '#9ca3af',  // Light gray
  },
  sessionDuration: {
    fontSize: 14,
    color: '#ffffff',  // White
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',  // Light gray
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ActivitySummaryModal;