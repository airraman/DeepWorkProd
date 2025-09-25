// src/screens/MetricsScreen.js - Enhanced with Weekly Chart
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

/**
 * ADVANCED CONCEPT: Data transformation for weekly chart
 * 
 * This function demonstrates several important programming concepts:
 * 1. Date manipulation and formatting (critical for time-based data)
 * 2. Data aggregation and grouping (common in data processing)
 * 3. Array methods (map, reduce, filter) - frequently asked in interviews
 * 4. Object destructuring and spreading
 * 
 * Interview tip: Be prepared to explain time complexity - O(n*m) where 
 * n is number of dates, m is average sessions per date
 * 
 * How this differs from regular React:
 * - Same logic, but React Native uses different date formatting
 * - Mobile considerations: less data processing on device
 */
const generateWeeklyChartData = (sessions) => {
  const today = new Date();
  const weekData = [];
  
  // Generate last 7 days of data
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    // Calculate total minutes for this day - common data aggregation pattern
    const daySessions = sessions[dateString] || [];
    const totalMinutes = daySessions.reduce((sum, session) => sum + session.duration, 0);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(1));
    
    weekData.push({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue, etc.
      fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: totalHours,
      date: dateString,
      sessionsCount: daySessions.length
    });
  }
  
  return weekData;
};

/**
 * REACT NATIVE SPECIFIC: Custom Chart Component
 * 
 * Key differences from regular React web development:
 * 1. No HTML elements - everything is View, Text, TouchableOpacity
 * 2. Styling uses StyleSheet.create for performance optimization
 * 3. Flexbox is the default and often only layout system
 * 4. Touch handling uses TouchableOpacity/Pressable instead of onClick
 * 5. No CSS classes - all styling is done via style prop
 * 
 * Interview relevance: 
 * - Understanding React Native's bridge architecture
 * - Performance considerations (why StyleSheet.create vs inline styles)
 * - Mobile-first design principles
 */
const WeeklyFocusChart = ({ sessions }) => {
  const weekData = generateWeeklyChartData(sessions);
  const maxHours = Math.max(...weekData.map(d => d.hours), 1); // Prevent division by zero
  const { colors } = useTheme();
  
  return (
    <View style={styles.chartContainer}>
      <Text style={[styles.chartTitle, { color: colors.text }]}>This Week's Focus</Text>
      <View style={styles.chartContent}>
        {/* 
          Simple bar chart implementation - we avoid external charting libraries
          in React Native for better performance and smaller bundle size.
          
          In a web React app, you'd likely use recharts or d3.js directly.
        */}
        <View style={styles.barsContainer}>
          {weekData.map((day, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.barWrapper}
              onPress={() => console.log(`Tapped ${day.fullDate}: ${day.hours}h`)}
            >
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      height: `${(day.hours / maxHours) * 100}%`,
                      backgroundColor: day.hours > 0 ? '#4ADE80' : colors.border
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                {day.day}
              </Text>
              <Text style={[styles.barValue, { color: colors.text }]}>
                {day.hours}h
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Additional info section */}
        <View style={styles.chartFooter}>
          <Text style={[styles.chartFooterText, { color: colors.textSecondary }]}>
            {weekData.reduce((sum, day) => sum + day.hours, 0).toFixed(1)}h total this week
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * PERFORMANCE OPTIMIZATION: Moved to separate component
 * 
 * This demonstrates:
 * 1. Component composition - breaking UI into smaller, focused pieces
 * 2. Props passing and validation
 * 3. Conditional rendering and styling
 * 4. React Native styling patterns
 * 
 * Why separate components matter:
 * - React's reconciliation algorithm can optimize re-renders
 * - Easier testing and maintenance
 * - Better code organization
 * - Potential for memoization with React.memo
 */
const TotalTimeCard = ({ totalHours }) => {
  const { colors } = useTheme();
  
  const getBackgroundColorForTime = (hours) => {
    // Color coding based on productivity levels
    if (hours <= 5) return '#D1FADF';   // Light green - getting started
    if (hours <= 20) return '#A6F4C5';  // Medium green - good progress  
    if (hours <= 50) return '#4ADE80';  // Dark green - excellent
    return '#22C55E';                   // Very dark green - exceptional
  };

  return (
    <View style={[
      styles.totalTimeContainer, 
      { backgroundColor: getBackgroundColorForTime(totalHours) }
    ]}>
      <Text style={styles.totalTimeLabel}>Total Focus Time</Text>
      <Text style={styles.totalTimeValue}>{totalHours}h</Text>
      <Text style={styles.totalTimeSubtext}>All-time</Text>
    </View>
  );
};

/**
 * COMPACT ACTIVITY GRID - GitHub-style heat map (matches original design)
 * 
 * This recreates the original Activity grid design in a compact form
 */
const CompactActivityGrid = ({ sessions }) => {
  const { colors } = useTheme();
  
  // Generate GitHub-style grid data
  const generateActivityGridData = () => {
    const today = new Date();
    const weeks = 20; // ~5 months of data
    const gridData = [];
    let maxActivity = 1;
    
    // Generate data by weeks (GitHub style)
    for (let week = 0; week < weeks; week++) {
      const weekData = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (weeks - week - 1) * 7 - (6 - day));
        const dateString = date.toISOString().split('T')[0];
        
        const dayMinutes = (sessions[dateString] || []).reduce((total, session) => {
          return total + session.duration;
        }, 0);
        
        if (dayMinutes > maxActivity) {
          maxActivity = dayMinutes;
        }
        
        weekData.push({
          date: dateString,
          minutes: dayMinutes,
          day: date.getDay(),
          month: date.getMonth(),
          dayOfMonth: date.getDate()
        });
      }
      gridData.push(weekData);
    }
    
    return { gridData, maxActivity };
  };
  
  const { gridData, maxActivity } = generateActivityGridData();
  
  // Get month labels for the top
  const getMonthLabels = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    let lastMonth = -1;
    
    gridData.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (firstDay.month !== lastMonth && weekIndex % 4 === 0) { // Show every 4th week
        labels.push({
          month: months[firstDay.month],
          position: weekIndex
        });
        lastMonth = firstDay.month;
      }
    });
    
    return labels.slice(0, 4); // Max 4 labels to fit
  };
  
  const getIntensityLevel = (minutes) => {
    if (minutes === 0) return 0;
    const quartile = maxActivity / 4;
    if (minutes <= quartile) return 1;
    if (minutes <= quartile * 2) return 2;
    if (minutes <= quartile * 3) return 3;
    return 4;
  };
  
  const getColorForIntensity = (level) => {
    const colorMap = {
      0: '#484848',    // Visible gray for empty blocks (no activity)
      1: '#0e4429',    // GitHub light green
      2: '#006d32',    // GitHub medium green  
      3: '#26a641',    // GitHub darker green
      4: '#39d353'     // GitHub bright green
    };
    return colorMap[level] || colorMap[0];
  };
  
  const monthLabels = getMonthLabels();
  
  return (
    <View style={styles.compactActivityContainer}>
      <Text style={[styles.compactActivityTitle, { color: colors.text }]}>Activity</Text>
      
      {/* Main grid area - fills entire space */}
      <View style={styles.gridArea}>
        {/* Day labels with M, W, F enlarged */}
        <View style={styles.dayLabels}>
          <Text style={[styles.dayLabel, styles.dayLabelLarge, { color: colors.textSecondary }]}>M</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>T</Text>
          <Text style={[styles.dayLabel, styles.dayLabelLarge, { color: colors.textSecondary }]}>W</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>T</Text>
          <Text style={[styles.dayLabel, styles.dayLabelLarge, { color: colors.textSecondary }]}>F</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>S</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>S</Text>
        </View>
        
        {/* Activity grid container with month labels floating over */}
        <View style={styles.gridContainer}>
          {/* Month labels floating over the top row of blocks */}
          <View style={styles.monthLabelsOverlay}>
            {monthLabels.map((label, index) => (
              <Text
                key={index}
                style={[
                  styles.monthLabelOverlay,
                  { 
                    color: colors.text,
                    left: label.position * 2.3, // Adjusted positioning for new layout
                    textShadowColor: 'rgba(0, 0, 0, 0.8)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 2,
                  }
                ]}
              >
                {label.month}
              </Text>
            ))}
          </View>
          
          {/* Activity grid - fills all space with minimal gaps */}
          <View style={styles.activityGrid}>
            {gridData.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekColumn}>
                {week.map((day, dayIndex) => (
                  <View
                    key={`${weekIndex}-${dayIndex}`}
                    style={[
                      styles.daySquare,
                      {
                        backgroundColor: getColorForIntensity(getIntensityLevel(day.minutes))
                      }
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
      
      {/* Legend stays in current position */}
      <View style={styles.compactLegend}>
        <Text style={[styles.compactLegendText, { color: colors.textSecondary }]}>Less</Text>
        {[0, 1, 2, 3, 4].map(level => (
          <View
            key={level}
            style={[
              styles.compactLegendBox,
              { backgroundColor: getColorForIntensity(level) }
            ]}
          />
        ))}
        <Text style={[styles.compactLegendText, { color: colors.textSecondary }]}>More</Text>
      </View>
    </View>
  );
};

/**
 * MAIN COMPONENT: Enhanced Metrics Screen
 * 
 * Key architectural decisions explained:
 * 1. State management with hooks (useState, useEffect, useRef)
 * 2. Component composition with custom components
 * 3. Responsive design considerations for mobile
 * 4. Error boundary patterns (loading/error states)
 * 5. Theme integration for dark/light mode support
 * 
 * Interview topics this covers:
 * - React lifecycle and hooks
 * - State management patterns
 * - Performance optimization techniques
 * - Mobile UI/UX considerations
 * - Data flow and prop drilling alternatives
 */
const MetricsScreen = () => {
  const { colors, theme } = useTheme();
  
  // Date-related state for navigation
  const today = new Date();
  const currentRealMonth = today.getMonth();
  const currentRealYear = today.getFullYear();

  // UI state management
  const [currentMonth, setCurrentMonth] = useState(currentRealMonth);
  const [currentYear, setCurrentYear] = useState(currentRealYear);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  
  // Data state
  const [sessions, setSessions] = useState({});
  const [activities, setActivities] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  
  // Performance optimization: useRef for gesture animations
  const panX = useRef(new Animated.Value(0)).current;

  // Load data when component mounts or comes into focus
  useEffect(() => {
    loadInitialData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadInitialData();
    }, [])
  );

  /**
   * DATA LOADING FUNCTION
   * 
   * This demonstrates:
   * - Async/await patterns
   * - Error handling strategies  
   * - Parallel data loading with Promise.all
   * - State updates and loading states
   * 
   * Interview tip: Explain error handling strategies and why
   * we use try/catch with async operations
   */
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load sessions and settings in parallel for better performance
      const [sessionsData, settings] = await Promise.all([
        deepWorkStore.getSessions(),
        deepWorkStore.getSettings()
      ]);

      setSessions(sessionsData);
      setActivities(settings.activities);
      
      // Calculate derived state
      calculateTotalDeepWorkTime(sessionsData);
    } catch (error) {
      console.error('Failed to load metrics data:', error);
      setError('Failed to load data. Pull down to refresh.');
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * DATA PROCESSING FUNCTION
   * 
   * Time Complexity Analysis (important for interviews):
   * - O(n*m) where n is number of dates, m is average sessions per date
   * - Could be optimized to O(k) where k is total sessions if we restructure data
   * 
   * Space Complexity: O(1) - we only store running totals
   */
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

  /**
   * GESTURE HANDLING - Advanced React Native concept
   * 
   * PanResponder demonstrates:
   * - Touch event handling in React Native
   * - Animation integration
   * - Gesture recognition patterns
   * - Performance considerations with native driver
   */
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20; // Minimum movement threshold
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > SCREEN_WIDTH / 3) {
          if (gestureState.dx > 0) {
            navigateMonth(-1); // Swipe right = previous month
          } else {
            navigateMonth(1);  // Swipe left = next month
          }
        }
        // Always animate back to center
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true, // Performance optimization
        }).start();
      },
    })
  ).current;

  // Month navigation logic
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

  // Session handling functions
  const handleSessionPress = (session) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  // Get days in current month for rendering
  const getDaysInMonth = () => {
    const dates = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      dates.push(date);
    }
    return dates;
  };

  // Helper functions for rendering
  const getActivityColor = (activityId) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.color || '#gray';
  };

  const formatDate = (date) => {
    return `${date.getDate()}`;
  };

  // LOADING STATE HANDLING
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading metrics...</Text>
      </View>
    );
  }

  // ERROR STATE HANDLING
  if (error) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadInitialData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER - Simplified (no total time here anymore) */}
      <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.brandName, { color: colors.text }]}>DeepWork.io</Text>
          <Text style={[styles.title, { color: colors.text }]}>Summary & Insights</Text>
        </View>
      </View>

      {/* FIXED: ALL THREE CHARTS IN ONE HORIZONTAL ROW */}
      <View style={[styles.chartsRow, { borderBottomColor: colors.border }]}>
        {/* Chart 1: Condensed Activity Grid (6 months) */}
        <View style={styles.compactActivitySection}>
          <CompactActivityGrid sessions={sessions} />
        </View>
        
        {/* Chart 2: Weekly Focus Chart (your box "1") */}
        <View style={styles.weeklyChartSection}>
          <WeeklyFocusChart sessions={sessions} />
        </View>
        
        {/* Chart 3: Total Time Card (your box "2") */}
        <View style={styles.totalTimeSection}>
          <TotalTimeCard totalHours={totalHours} />
        </View>
      </View>

      {/* EXISTING: Month Navigation Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={[styles.monthTabsContainer, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.monthTabsContent}
      >
        {MONTHS.map((month, index) => {
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
                { color: colors.textSecondary },
                currentMonth === index && { color: colors.text }
              ]}>
                {month}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      {/* EXISTING: Daily Sessions ScrollView */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        {...panResponder.panHandlers}
      >
        {getDaysInMonth().map((date, index) => {
          const dateString = date.toISOString().split('T')[0];
          const daySessions = sessions[dateString] || [];
          
          return (
            <View key={index} style={[styles.dateRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                {formatDate(date)}
              </Text>
              <View style={styles.boxesContainer}>
                <View style={styles.activitiesSection}>
                  {daySessions.map((session, sessionIndex) => (
                    <TouchableOpacity
                      key={`${dateString}-${sessionIndex}`}
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
                  {/* Fill empty slots */}
                  {[...Array(Math.max(0, MAX_BOXES_PER_ROW - daySessions.length))].map((_, emptyIndex) => (
                    <View
                      key={`empty-${dateString}-${emptyIndex}`}
                      style={[styles.activityBox, styles.emptyBox]}
                    />
                  ))}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* EXISTING: Activities Legend */}
      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        <Text style={[styles.legendTitle, { color: colors.text }]}>Activities:</Text>
        <View style={styles.legendItems}>
          {activities.map((activity) => (
            <View key={activity.id} style={styles.legendItem}>
              <View
                style={[styles.legendBox, { backgroundColor: activity.color }]}
              />
              <Text style={[styles.legendText, { color: colors.text }]}>
                {activity.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* EXISTING: Session Details Modal */}
      <SessionDetailsModal
        visible={showSessionDetails}
        session={selectedSession}
        onClose={() => {
          setShowSessionDetails(false);
          setSelectedSession(null);
        }}
      />
    </SafeAreaView>
  );
};

/**
 * STYLING SECTION - React Native specific patterns
 * 
 * Key differences from CSS that are important to understand:
 * 1. camelCase properties (backgroundColor vs background-color)
 * 2. No units needed for most values (16 instead of 16px)
 * 3. Flexbox is default display mode - no need to declare
 * 4. No CSS cascading - all styles must be explicitly applied
 * 5. StyleSheet.create provides performance optimizations
 * 6. Platform-specific styles can be applied conditionally
 * 
 * Interview tip: Be ready to explain why React Native uses this approach
 * (performance, consistency across platforms, type safety)
 */
const styles = StyleSheet.create({
  // Base container styles
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Loading and error states
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },

  // Header section
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    alignItems: 'left',
  },
  brandName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // FIXED STYLES FOR COMPACT HORIZONTAL LAYOUT - Half height, better proportions
  chartsRow: {
    flexDirection: 'row',           // All children side by side
    paddingHorizontal: 16,
    paddingVertical: 8,             // Reduced from 12 to 8 for less height
    borderBottomWidth: 1,
    gap: 8,                         // Equal spacing between all three sections
    alignItems: 'stretch',          // All sections same height
  },
  compactActivitySection: {
    flex: 2.5,                      // Activity grid gets more space (50%) - fills better
  },
  weeklyChartSection: {
    flex: 2,                        // Weekly chart gets medium space (40%)
  },
  totalTimeSection: {
    flex: 1,                        // Total time narrower (20%) - as requested
  },
  
  // COMPACT ACTIVITY GRID STYLES - No borders, fills entire space
  compactActivityContainer: {
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    padding: 0,                     // Removed padding - no empty space
    height: 60,
    overflow: 'hidden',             // Ensure content stays within bounds
  },
  compactActivityTitle: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 0,
    textAlign: 'center',
    paddingHorizontal: 4,           // Only title has padding
    backgroundColor: '#1f1f1f',     // Ensure title background
  },
  gridArea: {
    flexDirection: 'row',
    flex: 1,                        // Fill remaining space
  },
  dayLabels: {
    width: 12,                      // Slightly wider for all 7 days
    justifyContent: 'space-around', // Even distribution of all 7 days
    paddingVertical: 2,
  },
  dayLabel: {
    fontSize: 4,                    // Small font for T, T, S, S
    textAlign: 'center',
    fontWeight: '500',
  },
  dayLabelLarge: {
    fontSize: 8,                    // Twice as large for M, W, F
    fontWeight: '600',
  },
  gridContainer: {
    flex: 1,
    position: 'relative',           // For absolute positioned month labels
  },
  monthLabelsOverlay: {
    position: 'absolute',
    top: -2,                        // Float over top row of blocks
    left: 0,
    right: 0,
    height: 8,
    zIndex: 10,                     // Above the blocks
  },
  monthLabelOverlay: {
    position: 'absolute',
    fontSize: 5,
    fontWeight: '600',
    top: 0,
  },
  activityGrid: {
    flexDirection: 'row',
    flex: 1,
    paddingTop: 3,                  // Small space for month labels
  },
  weekColumn: {
    flex: 1,                        // Equal width columns
    justifyContent: 'space-around', // Even distribution of 7 squares
  },
  daySquare: {
    aspectRatio: 1,                 // Keep squares square
    width: '100%',                  // Fill column width
    maxHeight: 6,                   // Limit height for proper fit
    borderRadius: 0,                // Sharp corners for tight fit
  },
  compactLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 2,             // Small padding for legend only
    paddingHorizontal: 4,
    backgroundColor: '#1f1f1f',     // Ensure legend background
  },
  compactLegendBox: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
  },
  compactLegendText: {
    fontSize: 5,
  },
  // WEEKLY CHART STYLES - Reduced height for compact layout
  chartContainer: {
    backgroundColor: '#1f1f1f',     // Dark theme card background
    borderRadius: 8,
    padding: 2,                     // Reduced padding from 6 to 4
    height: 60,                     // Reduced height from 100 to 60
    justifyContent: 'space-between',
  },
  chartTitle: {
    fontSize: 8,                    // Smaller title font
    fontWeight: '600',
    marginBottom: 1,                // Minimal margin
    textAlign: 'center',
  },
  chartContent: {
    flex: 1,
  },
  chartFooter: {
    marginTop: 1,                   // Minimal margin for compact view
    alignItems: 'center',
  },
  chartFooterText: {
    fontSize: 5,                    // Very small font for tight space
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',        // Align bars to bottom
    flex: 1,
    paddingTop: 1,                  // Minimal padding
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 25,                     // Reduced height for compact view (was 35)
    width: 5,                       // Narrower bars
    justifyContent: 'flex-end',     // Bar grows upward
    marginBottom: 1,                // Minimal margin
  },
  bar: {
    width: '100%',
    borderRadius: 1,
    minHeight: 1,                  // Smaller minimum height
  },
  barLabel: {
    fontSize: 5,                    // Very small font for tight space
    marginTop: 0.5,                 // Minimal margin
  },
  barValue: {
    fontSize: 5,                    // Very small font for tight space
    fontWeight: '500',
  },
  
  // TOTAL TIME CARD STYLES - Reduced height and narrower width
  totalTimeContainer: {
    backgroundColor: '#4ADE80',     // Green background that changes based on hours
    borderRadius: 8,
    padding: 4,                     // Reduced padding from 6 to 4
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,                     // Reduced height from 100 to 60
  },
  totalTimeLabel: {
    fontSize: 7,                    // Smaller font for compact space
    color: '#1e3a29',              
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 1,                // Minimal margin
    textAlign: 'center',
  },
  totalTimeValue: {
    fontSize: 16,                   // Reduced font size for compact view
    fontWeight: 'bold',
    color: '#1e3a29',
  },
  totalTimeSubtext: {
    fontSize: 5,                    // Very small subtext
    color: '#1e3a29',
    marginTop: 0.5,
  },
  
  // REMOVED: Unused activity breakdown chart styles
  // These were for the third chart that's no longer in this layout
  
  // MONTH TABS - Horizontal scrolling navigation
  monthTabsContainer: {
    maxHeight: 40,
    borderBottomWidth: 1,
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
    fontSize: 14,
    fontWeight: '500',
  },
  
  // SESSIONS LIST - Daily activity display
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
  },
  dateText: {
    width: 30,
    fontSize: 12,
  },
  boxesContainer: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
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
  
  // LEGEND - Activity color mapping
  legend: {
    padding: 12,
    borderTopWidth: 1,
  },
  legendTitle: {
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
    fontSize: 12,
  },
});

export default MetricsScreen;