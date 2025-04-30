import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import SessionDetailsModal from '../components/modals/SessionDetailsModal';
import ActivityGrid from '../components/ActivityGrid';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOX_SIZE = 24;
const MAX_BOXES_PER_ROW = 10;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec'
];

// Define base activity colors - these should match the display colors from settings
const activityColors = {
  'write': '#E4D0FF',      // Purple
  'code': '#D0FFDB',       // Green
  'produce-music': '#FFE4D0' // Orange
};

// New threshold values for color gradient (in hours)
const TIME_THRESHOLDS = {
  LOW: 5,      // 0-5 hours: Light green
  MEDIUM: 20,  // 5-20 hours: Medium green
  HIGH: 50,    // 20-50 hours: Dark green
  // Above 50 hours: Very dark green
};

// New color gradient for total time background
const TIME_COLORS = {
  VERY_LIGHT: '#D1FADF', // Very light green
  LIGHT: '#A6F4C5',      // Light green
  MEDIUM: '#4ADE80',     // Medium green
  DARK: '#22C55E',       // Dark green
  VERY_DARK: '#16A34A',  // Very dark green
};

const MetricsScreen = () => {
  // Date-related state
  const today = new Date();
  const currentRealMonth = today.getMonth();
  const currentRealYear = today.getFullYear();

  // UI state
  const [currentMonth, setCurrentMonth] = useState(currentRealMonth);
  const [currentYear, setCurrentYear] = useState(currentRealYear);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  
  // Data state
  const [sessions, setSessions] = useState({});
  const [activities, setActivities] = useState([]);
  
  // New state for total deep work time
  const [totalHours, setTotalHours] = useState(0);
  
  // New state for activity details popup
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [activityStats, setActivityStats] = useState(null);
  
  // Theme context
  const { colors, theme } = useTheme();
  
  // Animation state
  const panX = useRef(new Animated.Value(0)).current;

  // Load data when component mounts
  useEffect(() => {
    loadInitialData();
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadInitialData();
    }, [])
  );

  // Load both sessions and activities data
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load sessions and settings in parallel
      const [sessionsData, settings] = await Promise.all([
        deepWorkStore.getSessions(),
        deepWorkStore.getSettings()
      ]);

      setSessions(sessionsData);
      setActivities(settings.activities);
      
      // Calculate total deep work time
      calculateTotalDeepWorkTime(sessionsData);
    } catch (error) {
      console.error('Failed to load metrics data:', error);
      setError('Failed to load data. Pull down to refresh.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate total deep work time from all sessions
  const calculateTotalDeepWorkTime = (sessionsData) => {
    let totalMinutes = 0;
    
    // Iterate through all dates and their sessions
    Object.values(sessionsData).forEach(dateSessions => {
      dateSessions.forEach(session => {
        totalMinutes += session.duration;
      });
    });
    
    // Convert to hours with 1 decimal place
    const hours = (totalMinutes / 60).toFixed(1);
    setTotalHours(parseFloat(hours));
  };
  
  // Get background color based on total hours of deep work
  const getBackgroundColorForTime = (hours) => {
    if (hours <= TIME_THRESHOLDS.LOW) {
      return TIME_COLORS.VERY_LIGHT;
    } else if (hours <= TIME_THRESHOLDS.MEDIUM) {
      return TIME_COLORS.LIGHT;
    } else if (hours <= TIME_THRESHOLDS.HIGH) {
      return TIME_COLORS.MEDIUM;
    } else {
      return TIME_COLORS.DARK;
    }
  };
  
  // Calculate statistics for a specific activity
  const calculateActivityStats = (activityId) => {
    let stats = {
      totalSessions: 0,
      totalMinutes: 0,
      dailyAverage: 0,
      longestSession: 0,
      mostProductiveDay: null,
      mostProductiveDate: null,
      recentSessions: []
    };
    
    let dayTotals = {};
    
    // Iterate through all dates and their sessions
    Object.entries(sessions).forEach(([date, dateSessions]) => {
      // Filter sessions for the selected activity
      const activitySessions = dateSessions.filter(
        session => session.activity === activityId
      );
      
      if (activitySessions.length > 0) {
        stats.totalSessions += activitySessions.length;
        
        // Calculate minutes and find longest session
        let dayTotal = 0;
        activitySessions.forEach(session => {
          const duration = session.duration;
          stats.totalMinutes += duration;
          
          if (duration > stats.longestSession) {
            stats.longestSession = duration;
          }
          
          dayTotal += duration;
          
          // Add to recent sessions (limited to 5)
          if (stats.recentSessions.length < 5) {
            stats.recentSessions.push({
              date,
              duration,
              completedAt: session.completedAt
            });
          }
        });
        
        // Track total minutes for this day
        dayTotals[date] = dayTotal;
      }
    });
    
    // Find most productive day
    let maxMinutes = 0;
    Object.entries(dayTotals).forEach(([date, minutes]) => {
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        stats.mostProductiveDate = date;
        
        // Format as day of week
        const dayDate = new Date(date);
        stats.mostProductiveDay = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
      }
    });
    
    // Calculate daily average (if there are sessions)
    if (stats.totalSessions > 0) {
      // Use unique days with this activity
      const uniqueDays = Object.keys(dayTotals).length;
      stats.dailyAverage = uniqueDays > 0 
        ? (stats.totalMinutes / uniqueDays).toFixed(1) 
        : 0;
    }
    
    // Sort recent sessions by date (newest first)
    stats.recentSessions.sort((a, b) => 
      new Date(b.completedAt) - new Date(a.completedAt)
    );
    
    return stats;
  };
  
  // Handle activity selection for detailed popup
  const handleActivitySelect = (activityId) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      // Calculate statistics for this activity
      const stats = calculateActivityStats(activityId);
      setSelectedActivity(activity);
      setActivityStats(stats);
      setShowActivityDetails(true);
    }
  };

  // Handle month navigation through gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > SCREEN_WIDTH / 3) {
          if (gestureState.dx > 0) {
            navigateMonth(-1);
          } else {
            navigateMonth(1);
          }
        }
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Navigate between months
  const navigateMonth = (direction) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;

    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }

    // Prevent navigation to future dates
    if (newYear > currentRealYear || 
        (newYear === currentRealYear && newMonth > currentRealMonth)) {
      return;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  // Get all days in the current month
  const getDaysInMonth = () => {
    const dates = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      dates.push(date);
    }
    return dates;
  };
  
  // Check if a date has any sessions
  const hasSessionsForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    const daySessions = sessions[dateString] || [];
    return daySessions.length > 0;
  };

  // Format date for display
  const formatDate = (date) => {
    return `${date.getDate()}`;
  };

  // Get color for an activity, falling back to a default if not found
  const getActivityColor = (activityId) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.color || activityColors[activityId] || '#gray';
  };

  // Session handling
  const handleSessionPress = (session) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

 // Functions defined within component scope - no "this" required
  
  // Calculate total hours for a specific date
  const calculateDateTotal = (date) => {
    const dateString = date.toISOString().split('T')[0];
    const daySessions = sessions[dateString] || [];
    
    // Sum up all minutes for this date
    let totalMinutes = 0;
    daySessions.forEach(session => {
      totalMinutes += session.duration;
    });
    
    // Convert to hours with 1 decimal place
    return (totalMinutes / 60).toFixed(1);
  };

  const renderActivityBoxes = (date) => {
    const dateString = date.toISOString().split('T')[0];
    const daySessions = sessions[dateString] || [];
    
    // Calculate total hours for this date
    let totalMinutes = 0;
    daySessions.forEach(session => {
      totalMinutes += session.duration;
    });
    
    // Convert to hours with 1 decimal place
    const dateHours = (totalMinutes / 60).toFixed(1);
    
    return (
      <View style={styles.boxesContainer}>
        <View style={styles.activitiesSection}>
          {daySessions.map((session, index) => (
            <TouchableOpacity
              key={`${dateString}-${index}`}
              onPress={() => handleSessionPress(session)}
            >
              <View
                style={[
                  styles.activityBox,
                  { backgroundColor: getActivityColor(session.activity) }
                ]}
              />
            </TouchableOpacity>
          ))}
          {[...Array(MAX_BOXES_PER_ROW - daySessions.length)].map((_, index) => (
            <View
              key={`empty-${dateString}-${index}`}
              style={[styles.activityBox, styles.emptyBox]}
            />
          ))}
        </View>
        
        {/* Always show date total (with 0h if no sessions) */}
        <View style={[
          styles.dateTotalContainer,
          { 
            backgroundColor: parseFloat(dateHours) > 0 
              ? getBackgroundColorForTime(parseFloat(dateHours)) 
              : 'transparent',
            borderWidth: parseFloat(dateHours) > 0 ? 0 : 1,
            borderColor: '#333'
          }
        ]}>
          <Text style={[
            styles.dateTotalText,
            parseFloat(dateHours) <= 0 && { color: '#6b7280' }
          ]}>
            {parseFloat(dateHours) > 0 ? `${dateHours}h` : '0h'}
          </Text>
        </View>
      </View>
    );
  };

  // Render month selection tabs
  const renderMonthTabs = () => {
    const visibleMonths = MONTHS.map((month, index) => {
      const isVisible = currentYear < currentRealYear || 
        (currentYear === currentRealYear && index <= currentRealMonth);
      
      if (!isVisible) return null;

      return (
        <TouchableOpacity
          key={month}
          onPress={() => setCurrentMonth(index)}
          style={[
            styles.monthTab,
            currentMonth === index && styles.monthTabActive
          ]}
        >
          <Text style={[
            styles.monthTabText,
            currentMonth === index && styles.monthTabTextActive
          ]}>
            {month}
          </Text>
        </TouchableOpacity>
      );
    });

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.monthTabsContainer}
        contentContainerStyle={styles.monthTabsContent}
      >
        {visibleMonths}
      </ScrollView>
    );
  };
  
  // Format time for display (minutes to hours and minutes)
  const formatTimeDisplay = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#E4D0FF" />
        <Text style={styles.loadingText}>Loading metrics...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={loadInitialData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.brandName}>DEEP TRACKER.io</Text>
          <Text style={styles.title}>DEEP WORK SUMMARY</Text>
        </View>
        
        {/* New Total Deep Work Time Display */}
        <View style={[
          styles.totalTimeContainer, 
          { backgroundColor: getBackgroundColorForTime(totalHours) }
        ]}>
          <Text style={styles.totalTimeLabel}>Total</Text>
          <Text style={styles.totalTimeValue}>{totalHours}h</Text>
        </View>
      </View>

      {/* Activity Grid - GitHub style visualization */}
      <ActivityGrid sessions={sessions} />

      {renderMonthTabs()}
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        {...panResponder.panHandlers}
      >
        {getDaysInMonth().map((date, index) => (
          <View key={index} style={styles.dateRow}>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            {renderActivityBoxes(date)}
          </View>
        ))}
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Activities:</Text>
        <View style={styles.legendItems}>
          {activities.map((activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.legendItem}
              onPress={() => handleActivitySelect(activity.id)}
            >
              <View
                style={[styles.legendBox, { backgroundColor: activity.color }]}
              />
              <Text style={styles.legendText}>
                {activity.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Session Details Modal (existing) */}
      <SessionDetailsModal
        visible={showSessionDetails}
        session={selectedSession}
        onClose={() => {
          setShowSessionDetails(false);
          setSelectedSession(null);
        }}
      />
      
      {/* New Activity Details Modal */}
      <Modal
        visible={showActivityDetails}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActivityDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.activityModalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowActivityDetails(false)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            
            {selectedActivity && activityStats && (
              <>
                <View style={styles.activityModalHeader}>
                  <View 
                    style={[styles.activityColorDot, { backgroundColor: selectedActivity.color }]} 
                  />
                  <Text style={styles.activityModalTitle}>{selectedActivity.name}</Text>
                </View>
                
                <View style={styles.activityStatsContainer}>
                  {/* Main Stats */}
                  <View style={styles.mainStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {formatTimeDisplay(activityStats.totalMinutes)}
                      </Text>
                      <Text style={styles.statLabel}>Total Focus Time</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{activityStats.totalSessions}</Text>
                      <Text style={styles.statLabel}>Sessions</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  
                  {/* Detail Stats */}
                  <View style={styles.detailStats}>
                    {activityStats.longestSession > 0 && (
                      <View style={styles.detailStatRow}>
                        <Text style={styles.detailStatLabel}>Longest Session:</Text>
                        <Text style={styles.detailStatValue}>
                          {formatTimeDisplay(activityStats.longestSession)}
                        </Text>
                      </View>
                    )}
                    
                    {activityStats.dailyAverage > 0 && (
                      <View style={styles.detailStatRow}>
                        <Text style={styles.detailStatLabel}>Daily Average:</Text>
                        <Text style={styles.detailStatValue}>
                          {activityStats.dailyAverage}m
                        </Text>
                      </View>
                    )}
                    
                    {activityStats.mostProductiveDay && (
                      <View style={styles.detailStatRow}>
                        <Text style={styles.detailStatLabel}>Most Productive Day:</Text>
                        <Text style={styles.detailStatValue}>
                          {activityStats.mostProductiveDay}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Recent Sessions */}
                  {activityStats.recentSessions.length > 0 && (
                    <>
                      <View style={styles.divider} />
                      <Text style={styles.recentSessionsTitle}>Recent Sessions</Text>
                      
                      {activityStats.recentSessions.map((session, index) => {
                        const sessionDate = new Date(session.completedAt);
                        return (
                          <View key={index} style={styles.recentSessionItem}>
                            <Text style={styles.recentSessionDate}>
                              {sessionDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </Text>
                            <Text style={styles.recentSessionTime}>
                              {formatTimeDisplay(session.duration)}
                            </Text>
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  }, 
  
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // New styles for total time display
  totalTimeContainer: {
    backgroundColor: '#4ADE80', // Default medium green
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  totalTimeLabel: {
    fontSize: 10,
    color: '#1e3a29', // Dark green text
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  totalTimeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a29', // Dark green text
  },
  monthTabsContainer: {
    maxHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  monthTabsContent: {
    paddingHorizontal: 8,
  },
  monthTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#E4D0FF',
  },
  monthTabText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  monthTabTextActive: {
    color: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContentContainer: {
    paddingTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dateText: {
    width: 30,
    color: '#FFFFFF',
    fontSize: 12,
  },
  boxesContainer: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  // New styles for date totals
  dateTotalContainer: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTotalText: {
    color: '#1e3a29',
    fontSize: 12,
    fontWeight: '600',
  },
  activityBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 4,
  },
  emptyBox: {
    backgroundColor: 'transparent',
  },
  legend: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  legendTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 4,
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  // New styles for Activity Details Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  activityModalContent: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    width: '100%',
    maxWidth: 350,
    paddingBottom: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  activityColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  activityModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  activityStatsContainer: {
    padding: 16,
  },
  mainStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  detailStats: {
    marginBottom: 16,
  },
  detailStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailStatLabel: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  detailStatValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  recentSessionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  recentSessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  recentSessionDate: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  recentSessionTime: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dateText: {
    width: 30,
    color: '#FFFFFF',
    fontSize: 12,
  },
  boxesContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between', // This ensures space between activities and total
  },
  activitiesSection: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  activityBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 4,
  },
  emptyBox: {
    backgroundColor: 'transparent',
  },
  // Improved date total container styles
  dateTotalContainer: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTotalText: {
    color: '#1e3a29',
    fontSize: 12,
    fontWeight: '600',
  }

  


});

export default MetricsScreen;