// MetricsScreen.js - Updated with bottom-aligned cards and repositioned legend
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
 * STATIC CARD CONTAINER
 */
const CardContainer = ({ children, style }) => {
  const { colors } = useTheme();

  const containerStyle = [
    styles.cardContainer,
    {
      backgroundColor: colors.cardBackground,
      borderColor: colors.cardBorder,
      shadowColor: colors.shadowColor,
    },
    style
  ];

  return (
    <View style={containerStyle}>
      {children}
    </View>
  );
};

/**
 * DATA TRANSFORMATION FOR WEEKLY CHART
 */
const generateWeeklyChartData = (sessions) => {
  const today = new Date();
  const weekData = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    const daySessions = sessions[dateString] || [];
    const totalMinutes = daySessions.reduce((sum, session) => sum + session.duration, 0);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(1));
    
    weekData.push({
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: totalHours,
      date: dateString,
      sessionsCount: daySessions.length
    });
  }
  
  return weekData;
};

/**
 * WEEKLY FOCUS CHART COMPONENT
 */
const WeeklyFocusChart = ({ sessions }) => {
  const { colors } = useTheme();
  const [selectedBar, setSelectedBar] = useState(null);
  
  const weekData = generateWeeklyChartData(sessions);
  const maxHours = Math.max(...weekData.map(d => d.hours), 1);
  
  const handleBarPress = (day, index) => {
    setSelectedBar(index === selectedBar ? null : index);
    console.log(`${day.fullDate}: ${day.hours}h (${day.sessionsCount} sessions)`);
  };
  
  return (
    <View style={styles.chartContainer}>
      <Text style={[styles.chartTitle, { color: colors.text }]}>This Week</Text>
      <View style={styles.chartContent}>
        <View style={styles.barsContainer}>
          {weekData.map((day, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.barWrapper}
              onPress={() => handleBarPress(day, index)}
              activeOpacity={0.7}
            >
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.bar,
                    {
                      height: `${(day.hours / maxHours) * 100}%`,
                      backgroundColor: selectedBar === index 
                        ? colors.primary 
                        : day.hours > 0 
                          ? '#4ADE80' 
                          : colors.border,
                      opacity: selectedBar === null || selectedBar === index ? 1 : 0.6,
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.barLabel, { 
                color: selectedBar === index ? colors.text : colors.textSecondary,
                fontWeight: selectedBar === index ? '600' : '400'
              }]}>
                {day.day}
              </Text>
              <Text style={[styles.barValue, { 
                color: selectedBar === index ? colors.text : colors.textSecondary,
                fontWeight: selectedBar === index ? '700' : '500'
              }]}>
                {day.hours}h
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.chartFooter}>
          <Text style={[styles.chartFooterText, { color: colors.textSecondary }]}>
            {weekData.reduce((sum, day) => sum + day.hours, 0).toFixed(1)}h total
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * TOTAL TIME CARD COMPONENT
 */
const TotalTimeCard = ({ totalHours }) => {
  const { colors } = useTheme();
  
  const getBackgroundColorForTime = (hours) => {
    if (hours <= 5) return '#D1FADF';   
    if (hours <= 20) return '#A6F4C5';  
    if (hours <= 50) return '#4ADE80';  
    return '#22C55E';                   
  };

  const getTextColorForTime = (hours) => {
    if (hours <= 20) return '#1E3A29';
    return '#FFFFFF';
  };

  const backgroundColor = getBackgroundColorForTime(totalHours);
  const textColor = getTextColorForTime(totalHours);

  return (
    <View style={[
      styles.totalTimeContainer,
      { backgroundColor }
    ]}>
      <Text style={[styles.totalTimeLabel, { color: textColor }]}>
        Focus Time
      </Text>
      <Text style={[styles.totalTimeValue, { color: textColor }]}>
        {totalHours}h
      </Text>
      <Text style={[styles.totalTimeSubtext, { color: textColor }]}>
        All-time
      </Text>
      {totalHours > 50 && (
        <View style={styles.achievementContainer}>
          <Text style={styles.achievementIcon}>🏆</Text>
        </View>
      )}
    </View>
  );
};

/**
 * COMPACT ACTIVITY GRID COMPONENT - GitHub-style heat map
 */
const CompactActivityGrid = ({ sessions }) => {
  const { colors } = useTheme();
  
  const generateActivityGridData = () => {
    const today = new Date();
    const weeks = 20; 
    const gridData = [];
    let maxActivity = 1;
    
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
  
  const getMonthLabelsWithPositions = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    let lastMonth = -1;
    
    gridData.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (firstDay.month !== lastMonth) {
        labels.push({
          month: months[firstDay.month],
          position: weekIndex
        });
        lastMonth = firstDay.month;
      }
    });
    
    return labels;
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
      0: '#484848',    
      1: '#0e4429',    
      2: '#006d32',    
      3: '#26a641',    
      4: '#39d353'     
    };
    return colorMap[level] || colorMap[0];
  };
  
  const monthLabels = getMonthLabelsWithPositions();
  
  return (
    <View style={styles.compactActivityContainer}>
      <Text style={[styles.compactActivityTitle, { color: colors.textSecondary }]}>Activity</Text>
      
      <View style={styles.gridArea}>
        <View style={styles.dayLabels}>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>M</Text>
          <View style={styles.dayLabelSpacer} />
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>W</Text>
          <View style={styles.dayLabelSpacer} />
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>F</Text>
          <View style={styles.dayLabelSpacer} />
          <View style={styles.dayLabelSpacer} />
        </View>
        
        <View style={styles.activityGrid}>
          {gridData.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekColumn}>
              {week.map((day, dayIndex) => (
                <TouchableOpacity
                  key={`${weekIndex}-${dayIndex}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (day.minutes > 0) {
                      console.log(`${day.date}: ${Math.round(day.minutes/60 * 10)/10}h`);
                    }
                  }}
                >
                  <View
                    style={[
                      styles.daySquare,
                      {
                        backgroundColor: getColorForIntensity(getIntensityLevel(day.minutes))
                      }
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>
      
      {/* <View style={styles.monthLabelsContainer}>
        {monthLabels.map((label, index) => (
          <Text 
            key={index}
            style={[
              styles.monthLabel, 
              { 
                color: colors.textSecondary,
                left: `${(label.position / gridData.length) * 100}%`
              }
            ]}
          >
            {label.month}
          </Text>
        ))}
      </View> */}
    </View>
  );
};

/**
 * MAIN METRICS SCREEN COMPONENT
 */
const MetricsScreen = () => {
  const { colors, theme } = useTheme();
  
  const today = new Date();
  const currentRealMonth = today.getMonth();
  const currentRealYear = today.getFullYear();

  const [currentMonth, setCurrentMonth] = useState(currentRealMonth);
  const [currentYear, setCurrentYear] = useState(currentRealYear);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  
  const [sessions, setSessions] = useState({});
  const [activities, setActivities] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  
  const panX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadInitialData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadInitialData();
    }, [])
  );

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [sessionsData, settings] = await Promise.all([
        deepWorkStore.getSessions(),
        deepWorkStore.getSettings()
      ]);

      setSessions(sessionsData);
      setActivities(settings.activities);
      calculateTotalDeepWorkTime(sessionsData);
    } catch (error) {
      console.error('Failed to load metrics data:', error);
      setError('Failed to load data. Pull down to refresh.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const calculateTotalDeepWorkTime = (sessionsData) => {
    let totalMinutes = 0;
    Object.values(sessionsData).forEach(dateSessions => {
      dateSessions.forEach(session => {
        totalMinutes += session.duration;
      });
    });
    const hours = (totalMinutes / 60).toFixed(1);
    setTotalHours(parseFloat(hours));
  };

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

    if (newYear > currentRealYear || 
        (newYear === currentRealYear && newMonth > currentRealMonth)) {
      return;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const handleSessionPress = (session) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  const handleGenerateInsights = () => {
    console.log('Generate Insights pressed');
  };

  const getDaysInMonth = () => {
    const dates = [];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      dates.push(date);
    }
    return dates;
  };

  const getActivityColor = (activityId) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.color || '#gray';
  };

  const formatDate = (date) => {
    return `${date.getDate()}`;
  };

  // Helper function for legend colors
  const getColorForIntensity = (level) => {
    const colorMap = {
      0: '#484848',    
      1: '#0e4429',    
      2: '#006d32',    
      3: '#26a641',    
      4: '#39d353'     
    };
    return colorMap[level] || colorMap[0];
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading metrics...</Text>
      </View>
    );
  }

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
      <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.brandName, { color: colors.text }]}>DeepWork.io</Text>
          <Text style={[styles.title, { color: colors.text }]}>Summary & Insights</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.generateInsightsButton, { 
            backgroundColor: colors.primary,
            shadowColor: colors.primary 
          }]}
          onPress={handleGenerateInsights}
          activeOpacity={0.8}
        >
          <Text style={styles.generateInsightsText}>Generate Insights</Text>
          <Text style={styles.sparkleEmoji}>✨</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.chartsRow, { borderBottomColor: colors.border }]}>
        <View style={styles.compactActivitySection}>
          <CompactActivityGrid sessions={sessions} />
        </View>
        
        <CardContainer style={styles.weeklyChartSection}>
          <WeeklyFocusChart sessions={sessions} />
        </CardContainer>
        
        <CardContainer style={styles.totalTimeSection}>
          <TotalTimeCard totalHours={totalHours} />
        </CardContainer>
        
        <View style={styles.heatMapLegendContainer}>
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>Less</Text>
          {[0, 1, 2, 3, 4].map(level => (
            <View
              key={level}
              style={[
                styles.legendBox,
                { backgroundColor: getColorForIntensity(level) }
              ]}
            />
          ))}
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>More</Text>
        </View>
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
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

  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
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
  generateInsightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    gap: 4,
  },
  generateInsightsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sparkleEmoji: {
    fontSize: 12,
  },
  
  cardContainer: {
    borderRadius: 7,        // Changed from 12 to match heat map
    borderWidth: 1,         // Changed from 0.5 for better visibility
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',     // Added: ensures child content respects border radius
  },
  chartsRow: {
    flexDirection: 'row',           
    paddingHorizontal: 16,
    paddingVertical: 6,           
    borderBottomWidth: 1,
    gap: 6,                        // Changed to 6 for balanced spacing
    alignItems: 'flex-end',
    position: 'relative',
  },
  compactActivitySection: {
    flex: 2.5,
  },
  weeklyChartSection: {
    flex: 2,
  },
  totalTimeSection: {
    flex: 1,
  },
  
  compactActivityContainer: {
    padding: 4,                    // Changed from 8 to 4 to reduce visual gap
    height: 70,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },

  compactActivityTitle: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'left',
    marginBottom: 4,
    opacity: 0.7,
  },
  gridArea: {
    flexDirection: 'row',
    flex: 1,
    zIndex: 1,                     // Added: Ensures grid stays below labels
  },
  dayLabels: {
    width: 12,
    justifyContent: 'space-around',
    marginRight: 3,
  },
  dayLabel: {
    fontSize: 7,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.6,
  },
  dayLabelSpacer: {
    height: 7,
  },
  activityGrid: {
    flexDirection: 'row',
    flex: 1,
    gap: 1,
  },
  weekColumn: {
    flex: 1,
    justifyContent: 'space-around',
    gap: 1,
  },
  daySquare: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 1,
  },
  monthLabelsContainer: {
    position: 'relative',
    height: 12,
    marginTop: 2,
    marginLeft: 15,
    zIndex: 10,                    // Added: Ensures labels appear on top
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 7,
    fontWeight: '500',
    opacity: 0.6,
  },
  
  heatMapLegendContainer: {
    position: 'absolute',
    top: 8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 10,
  },
  legendBox: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  legendLabel: {
    fontSize: 7,
    opacity: 0.6,
  },

  chartContainer: {
    padding: 6,                    // Changed from 4 to 6 for more breathing room
    height: 55,                    // Changed from 50 to 70 to match heat map
    justifyContent: 'space-between',
  },

  chartTitle: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  chartContent: {
    flex: 1,
  },
  chartFooter: {
    marginTop: 2,
    alignItems: 'center',
  },
  chartFooterText: {
    fontSize: 5,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flex: 1,
    paddingTop: 2,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 28,                    // Changed from 15 to 28 for more visible bars
    width: 6,
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  bar: {
    width: '100%',
    borderRadius: 1,
    minHeight: 1,
  },
  barLabel: {
    fontSize: 5,
    marginTop: 1,
  },
  barValue: {
    fontSize: 6,
    fontWeight: '500',
  },
  
  totalTimeContainer: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    position: 'relative',
    borderRadius: 1,        // Added: makes background respect parent's border radius
  },

  totalTimeLabel: {
    fontSize: 7,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 1,
    textAlign: 'center',
  },
  totalTimeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a29',
  },
  totalTimeSubtext: {
    fontSize: 5,
    marginTop: 0.5,
  },
  achievementContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  achievementIcon: {
    fontSize: 10,
  },
  
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
  legendText: {
    fontSize: 12,
  },
});

export default MetricsScreen;