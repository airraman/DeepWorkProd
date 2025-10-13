// src/screens/MetricsScreen.js

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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import SessionDetailsModal from '../components/modals/SessionDetailsModal';
import { useTheme } from '../context/ThemeContext';
import InsightGenerator from '../services/insights/InsightGenerator';
import ExpandableInsight from '../components/ExpandableInsight';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOX_SIZE = 24;
const MAX_BOXES_PER_ROW = 10;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec'
];

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

const WeeklyFocusChart = ({ sessions }) => {
  const { colors } = useTheme();
  const [selectedBar, setSelectedBar] = useState(null);
  
  const weekData = generateWeeklyChartData(sessions);
  const maxHours = Math.max(...weekData.map(d => d.hours), 1);
  
  const handleBarPress = (day, index) => {
    setSelectedBar(index === selectedBar ? null : index);
  };

  return (
    <View style={styles.chartContainer}>
      <Text style={[styles.chartTitle, { color: colors.text }]}>
        This Week
      </Text>
      
      <View style={styles.chartContent}>
        <View style={styles.barsContainer}>
          {weekData.map((day, index) => (
            <TouchableOpacity
              key={day.date}
              style={styles.barWrapper}
              onPress={() => handleBarPress(day, index)}
            >
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      backgroundColor: colors.primary,
                      height: `${(day.hours / maxHours) * 100}%`,
                      opacity: selectedBar === null ? 1 : selectedBar === index ? 1 : 0.4,
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.barLabel, { 
                color: selectedBar === index ? colors.text : colors.textSecondary,
                fontWeight: selectedBar === index ? '600' : '500'
              }]}>
                {day.day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

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
        const daysAgo = week * 7 + day;
        const date = new Date(today);
        date.setDate(today.getDate() - daysAgo);
        const dateString = date.toISOString().split('T')[0];
        
        const daySessions = sessions[dateString] || [];
        const activityCount = daySessions.length;
        
        if (activityCount > maxActivity) {
          maxActivity = activityCount;
        }
        
        weekData.unshift({
          date: dateString,
          count: activityCount,
          sessions: daySessions
        });
      }
      gridData.unshift(weekData);
    }
    
    return { gridData, maxActivity };
  };
  
  const getIntensityColor = (count, maxActivity) => {
    if (count === 0) return '#484848';
    const ratio = count / maxActivity;
    if (ratio <= 0.25) return '#0e4429';
    if (ratio <= 0.5) return '#006d32';
    if (ratio <= 0.75) return '#26a641';
    return '#39d353';
  };
  
  const { gridData, maxActivity } = generateActivityGridData();
  
  const monthLabels = [];
  const today = new Date();
  for (let i = 0; i < gridData.length; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - (gridData.length - i - 1) * 7);
    
    if (weekDate.getDate() <= 7 || i === 0) {
      monthLabels.push({
        month: MONTHS[weekDate.getMonth()],
        position: i
      });
    }
  }
  
  return (
    <View style={styles.compactActivityContainer}>
      <Text style={[styles.compactActivityTitle, { color: colors.textSecondary }]}>
        Activity
      </Text>
      
      <View style={styles.gridArea}>
        <View style={styles.dayLabels}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <View key={index} style={styles.dayLabelSpacer}>
              {(index === 1 || index === 3 || index === 5) && (
                <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
                  {day}
                </Text>
              )}
            </View>
          ))}
        </View>
        
        <View style={styles.activityGrid}>
          {gridData.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekColumn}>
              {week.map((day, dayIndex) => (
                <View
                  key={dayIndex}
                  style={[
                    styles.daySquare,
                    { 
                      backgroundColor: getIntensityColor(day.count, maxActivity),
                      borderRadius: 1
                    }
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      
      <View style={styles.monthLabelsContainer}>
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
      </View>
    </View>
  );
};

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

  const [weeklyInsight, setWeeklyInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(null);
  
  const panX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadInitialData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadInitialData();
      loadWeeklyInsight();
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

  const loadWeeklyInsight = async () => {
    try {
      console.log('[Metrics] Loading weekly insight...');
      
      const result = await InsightGenerator.generate('weekly');
      
      if (result.success) {
        setWeeklyInsight(result);
      }
    } catch (error) {
      console.error('[Metrics] Failed to load insight:', error);
    }
  };

  const handleGenerateInsights = async () => {
    try {
      setInsightLoading(true);
      setInsightError(null);
      
      console.log('[Metrics] Generating weekly insight...');
      
      const result = await InsightGenerator.generate('weekly', {
        forceRegenerate: true
      });
      
      if (result.success) {
        setWeeklyInsight(result);
        console.log('[Metrics] Insight generated:', result.metadata.fromCache ? 'from cache' : 'fresh');
      } else {
        setInsightError('Unable to generate insight. Please try again.');
      }
      
    } catch (error) {
      console.error('[Metrics] Error generating insight:', error);
      setInsightError('Failed to generate insight. Please try again.');
    } finally {
      setInsightLoading(false);
    }
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
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayOfWeek} ${date.getDate()}`;
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

      {weeklyInsight && (
        <ExpandableInsight 
          insight={weeklyInsight}
          title="WEEKLY INSIGHT"
        />
      )}

      {insightLoading && (
        <View style={[styles.insightSection, { 
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        }]}>
          <View style={styles.insightLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.insightLoadingText, { color: colors.textSecondary }]}>
              Generating insight...
            </Text>
          </View>
        </View>
      )}

      {insightError && !insightLoading && (
        <View style={[styles.insightSection, { 
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
        }]}>
          <Text style={[styles.insightError, { color: colors.textSecondary }]}>
            {insightError}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleGenerateInsights}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

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
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        {...panResponder.panHandlers}
      >
        {getDaysInMonth().map((date) => {
          const dateString = date.toISOString().split('T')[0];
          const daySessions = sessions[dateString] || [];

          return (
            <View key={dateString}>
              <View style={[styles.dateRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  {formatDate(date)}
                </Text>
                
                <View style={styles.boxesContainer}>
                  <View style={styles.activitiesSection}>
                    {daySessions.map((session, index) => (
                      <TouchableOpacity
                        key={`${session.id}-${index}`}
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
  insightSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  insightLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  insightLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  insightError: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardContainer: {
    borderRadius: 7,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  chartsRow: {
    flexDirection: 'row',           
    paddingHorizontal: 16,
    paddingVertical: 6,           
    borderBottomWidth: 1,
    gap: 6,
    alignItems: 'flex-end',
    position: 'relative',
    height: 73,
  },
  compactActivitySection: {
    flex: 2.3,
  },
  weeklyChartSection: {
    flex: 2.2,
  },
  totalTimeSection: {
    flex: 1,
  },
  compactActivityContainer: {
    padding: 4,
    height: 70,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  compactActivityTitle: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'left',
    marginBottom: 4,
    opacity: 0.85,
  },
  gridArea: {
    flexDirection: 'row',
    flex: 1,
    zIndex: 1,
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
    opacity: 0.8,
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
    zIndex: 10,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 7,
    fontWeight: '500',
    opacity: 0.6,
  },
  heatMapLegendContainer: {
    position: 'absolute',
    top: 4,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 10,
    marginTop:-12,
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
    padding: 8,
    paddingTop: 4,
    height: 58,
    justifyContent: 'flex-start',
  },
  chartTitle: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  chartContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 28,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 18,
    width: 8,
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  bar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 8,
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  totalTimeContainer: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    position: 'relative',
    borderRadius: 1,
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
    width: 50,
    fontSize: 11,
    fontWeight: '500',
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
    paddingTop: 20,
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