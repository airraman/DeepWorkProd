// src/screens/MetricsScreen.js - COMPLETE UPDATED VERSION

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
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import SessionDetailsModal from '../components/modals/SessionDetailsModal';
import { useTheme } from '../context/ThemeContext';
import InsightGenerator from '../services/insights/InsightGenerator';
import ExpandableInsight from '../components/ExpandableInsight';
import { useSubscription } from '../context/SubscriptionContext';
import { PaywallModal } from '../components/PaywallModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOX_SIZE = 24;
const MAX_BOXES_PER_ROW = 10;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec'
];

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
      
      {/* Month labels now BEFORE the grid */}
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
      
      {/* Grid area with day labels and activity squares */}
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
    </View>
  );
};

const MonthSelector = ({ selectedMonth, onMonthSelect, sessions }) => {
  const { colors } = useTheme();
  const scrollViewRef = useRef(null);
  
  const generateMonthsList = () => {
    const months = [];
    const today = new Date();
    
    // Find earliest session date
    let earliestDate = today;
    Object.keys(sessions).forEach(dateString => {
      if (sessions[dateString].length > 0) {
        const date = new Date(dateString);
        if (date < earliestDate) {
          earliestDate = date;
        }
      }
    });
    
    // Generate months from earliest to now
    const startYear = earliestDate.getFullYear();
    const startMonth = earliestDate.getMonth();
    const endYear = today.getFullYear();
    const endMonth = today.getMonth();
    
    let currentDate = new Date(startYear, startMonth, 1);
    const endDate = new Date(endYear, endMonth, 1);
    
    while (currentDate <= endDate) {
      months.push({
        month: MONTHS[currentDate.getMonth()],
        year: currentDate.getFullYear(),
        value: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months.reverse(); // Most recent first
  };
  
  const months = generateMonthsList();
  
  return (
    <View style={[styles.monthSelectorContainer, { borderBottomColor: colors.border }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthScrollContent}
      >
        {months.map((month, index) => {
          const isSelected = selectedMonth === month.value;
          return (
            <TouchableOpacity
              key={month.value}
              style={[
                styles.monthButton,
                isSelected && { backgroundColor: colors.primary }
              ]}
              onPress={() => onMonthSelect(month.value)}
            >
              <Text
                style={[
                  styles.monthButtonText,
                  { color: isSelected ? '#FFFFFF' : colors.text }
                ]}
              >
                {month.month}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const SessionList = ({ sessions, activities, onSessionPress, selectedMonth }) => {
  const { colors } = useTheme();
  
  const generateDaysList = () => {
    const days = [];
    
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      for (let d = lastDay.getDate(); d >= 1; d--) {
        const date = new Date(year, month - 1, d);
        const dateString = date.toISOString().split('T')[0];
        
        days.push({
          date: dateString,
          displayDate: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            day: 'numeric' 
          }),
          sessions: sessions[dateString] || []
        });
      }
    }
    
    return days;
  };
  
  const days = generateDaysList();
  
  const getActivityColor = (activityId) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.color || colors.primary;
  };
  
  const getActivityName = (activityId) => {
    const activity = activities.find(a => a.id === activityId);
    return activity?.name || activityId;
  };
  
  return (
    <ScrollView 
      style={styles.sessionListContainer}
      showsVerticalScrollIndicator={false}
    >
      {days.map((day) => (
        <View key={day.date}>
          <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.dayHeaderText, { color: colors.text }]}>
              {day.displayDate}
            </Text>
            <Text style={[styles.daySessionCount, { color: colors.textSecondary }]}>
              {day.sessions.length > 0 ? `${day.sessions.length} session${day.sessions.length !== 1 ? 's' : ''}` : '0h'}
            </Text>
          </View>
          
          {day.sessions.length > 0 && (
            <View style={styles.daySessionsContainer}>
              {day.sessions.map((session) => {
                const activityColor = getActivityColor(session.activityId);
                const activityName = getActivityName(session.activityId);
                
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      styles.sessionCard,
                      { backgroundColor: colors.cardBackground }
                    ]}
                    onPress={() => onSessionPress(session)}
                  >
                    <View style={styles.sessionCardContent}>
                      <View style={styles.sessionCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View 
                            style={[
                              styles.activityColorDot, 
                              { backgroundColor: activityColor }
                            ]} 
                          />
                          <Text style={[styles.sessionActivity, { color: colors.text }]}>
                            {activityName}
                          </Text>
                        </View>
                        <Text style={[styles.sessionDuration, { color: colors.textSecondary }]}>
                          {session.duration}m
                        </Text>
                      </View>
                      
                      {session.description && (
                        <Text 
                          style={[styles.sessionDescription, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {session.description}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const MetricsScreen = () => {
  const { colors, isDarkMode } = useTheme();
  const { canGenerateInsights, generationsRemaining, isSubscribed } = useSubscription();
  const [sessions, setSessions] = useState({});
  const [activities, setActivities] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [currentInsight, setCurrentInsight] = useState(null);
  const [insightError, setInsightError] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    // Set default to current month
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  const loadData = async () => {
    try {
      const loadedSessions = await deepWorkStore.getAllSessions();
      const loadedActivities = await deepWorkStore.getAllActivities();
      setSessions(loadedSessions);
      setActivities(loadedActivities);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const handleGenerateInsight = async () => {
    if (!canGenerateInsights) {
      setShowPaywall(true);
      return;
    }

    setIsGeneratingInsight(true);
    setInsightError(null);
    setCurrentInsight(null);

    try {
      const insight = await InsightGenerator.generateInsight(sessions, activities);
      setCurrentInsight(insight);
    } catch (error) {
      console.error('Error generating insight:', error);
      setInsightError('Unable to generate insight. Please try again.');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const calculateTotalHours = () => {
    let totalMinutes = 0;
    Object.values(sessions).forEach(daySessions => {
      daySessions.forEach(session => {
        totalMinutes += session.duration;
      });
    });
    return Math.round(totalMinutes / 60);
  };

  const handleSessionPress = (session) => {
    setSelectedSession(session);
  };

  const handleCloseModal = () => {
    setSelectedSession(null);
  };

  const totalHours = calculateTotalHours();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          DeepWork.io
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.text }]}>
          DEEP WORK SUMMARY
        </Text>
      </View>

      <View style={styles.content}>
        {/* Fixed Section: Insights + Metrics + Month Selector */}
        <View style={styles.fixedSection}>
          {/* Insights Section */}
          {!isSubscribed && (
            <View style={[
              styles.limitIndicator,
              { 
                backgroundColor: colors.cardBackground,
                borderColor: colors.border 
              }
            ]}>
              <Text style={[styles.limitText, { color: colors.textSecondary }]}>
                {generationsRemaining} AI insight{generationsRemaining !== 1 ? 's' : ''} remaining
              </Text>
              <TouchableOpacity 
                style={styles.upgradeLink}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={[styles.upgradeLinkText, { color: colors.primary }]}>
                  Upgrade
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isGeneratingInsight && (
            <View style={[
              styles.insightSection,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border
              }
            ]}>
              <View style={styles.insightLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.insightLoadingText, { color: colors.textSecondary }]}>
                  Generating insight...
                </Text>
              </View>
            </View>
          )}

          {insightError && (
            <View style={[
              styles.insightSection,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border
              }
            ]}>
              <Text style={[styles.insightError, { color: colors.error }]}>
                {insightError}
              </Text>
            </View>
          )}

          {currentInsight && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              <ExpandableInsight insight={currentInsight} />
            </View>
          )}

          {/* Metrics Row */}
          <View style={[styles.chartsRow, { borderBottomColor: colors.border }]}>
            <View style={styles.compactActivitySection}>
              <CompactActivityGrid sessions={sessions} />
            </View>
            
            <View style={styles.weeklyChartSection}>
              <WeeklyFocusChart sessions={sessions} />
            </View>
            
            <View style={styles.totalTimeSection}>
              <TotalTimeCard totalHours={totalHours} />
            </View>
          </View>

          {/* Month Selector */}
          <MonthSelector 
            selectedMonth={selectedMonth}
            onMonthSelect={setSelectedMonth}
            sessions={sessions}
          />
        </View>

        {/* Scrollable Section: Session List Only */}
        <SessionList 
          sessions={sessions} 
          activities={activities}
          onSessionPress={handleSessionPress}
          selectedMonth={selectedMonth}
        />
      </View>

      <TouchableOpacity 
        style={[
          styles.generateInsightsButton,
          !canGenerateInsights && { opacity: 0.7 }
        ]}
        onPress={handleGenerateInsight}
        disabled={isGeneratingInsight}
      >
        <Text style={styles.sparkleEmoji}>✨</Text>
        <Text style={styles.generateInsightsText}>
          {isGeneratingInsight ? 'Generating...' : 'Generate Insight'}
        </Text>
      </TouchableOpacity>

      <SessionDetailsModal
        visible={!!selectedSession}
        session={selectedSession}
        activities={activities}
        onClose={handleCloseModal}
      />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  fixedSection: {
    // No flex, this will size to content and stay fixed
  },
  generateInsightsButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
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
  limitIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  limitText: {
    fontSize: 13,
    fontWeight: '500',
  },
  upgradeLink: {
    paddingVertical: 4,
  },
  upgradeLinkText: {
    fontSize: 13,
    fontWeight: '600',
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
  chartsRow: {
    flexDirection: 'row',           
    paddingHorizontal: 16,
    paddingVertical: 6,
    paddingTop: 12,
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
    marginBottom: 2,
    marginLeft: 15,
    zIndex: 10,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 7,
    fontWeight: '500',
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
  monthSelectorContainer: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  monthScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  dayHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  daySessionCount: {
    fontSize: 14,
  },
  daySessionsContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  sessionCard: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  sessionCardContent: {
    gap: 4,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionActivity: {
    fontSize: 15,
    fontWeight: '600',
  },
  sessionDuration: {
    fontSize: 14,
  },
  sessionDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  activityColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default MetricsScreen;