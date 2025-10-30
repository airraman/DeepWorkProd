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

const SessionList = ({ sessions, activities, onSessionPress }) => {
  const { colors } = useTheme();
  
  const generateDaysList = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
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
              {day.sessions.length} {day.sessions.length === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
          
          {day.sessions.length > 0 && (
            <View style={styles.daySessionsContainer}>
              {day.sessions.map((session, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.sessionCard,
                    { 
                      backgroundColor: colors.cardBackground,
                      borderLeftColor: getActivityColor(session.activity),
                      borderLeftWidth: 4
                    }
                  ]}
                  onPress={() => onSessionPress(session)}
                >
                  <View style={styles.sessionCardContent}>
                    <View style={styles.sessionCardHeader}>
                      <Text style={[styles.sessionActivity, { color: colors.text }]}>
                        {getActivityName(session.activity)}
                      </Text>
                      <Text style={[styles.sessionDuration, { color: colors.textSecondary }]}>
                        {session.duration} min
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
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const ActivitiesSection = ({ activities, onActivityPress }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.activitiesFilterContainer, { 
      backgroundColor: colors.background, 
      borderTopColor: colors.border 
    }]}>
      <Text style={[styles.activitiesLabel, { color: colors.text }]}>
        Activities:
      </Text>
      
      <View style={styles.activitiesCheckboxes}>
        {activities.map((activity) => (
          <TouchableOpacity
            key={activity.id}
            style={[styles.activityCard, { 
              backgroundColor: activity.color + '20',
              borderColor: activity.color,
            }]}
            onPress={() => onActivityPress(activity)}
          >
            <View style={[styles.activityColorDot, { backgroundColor: activity.color }]} />
            <Text style={[styles.activityName, { color: colors.text }]}>
              {activity.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Main MetricsScreen Component
const MetricsScreen = () => {
  const { colors, theme } = useTheme();
  const { isPremium } = useSubscription();
  
  const today = new Date();
  const currentRealMonth = today.getMonth();
  const currentRealYear = today.getFullYear();

  const [currentMonth, setCurrentMonth] = useState(currentRealMonth);
  const [currentYear, setCurrentYear] = useState(currentRealYear);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessions, setSessions] = useState({});
  const [activities, setActivities] = useState([]);
  const [totalHours, setTotalHours] = useState(0);

  const [weeklyInsight, setWeeklyInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(null);
  
  const [showPaywall, setShowPaywall] = useState(false);
  const [insightsGeneratedCount, setInsightsGeneratedCount] = useState(0);
  
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityInsights, setShowActivityInsights] = useState(false);
  
  const panX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadInitialData();
    loadInsightCount();
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
  
  const loadInsightCount = async () => {
    try {
      const settings = await deepWorkStore.getSettings();
      setInsightsGeneratedCount(settings.insightsGeneratedCount || 0);
    } catch (error) {
      console.error('Failed to load insight count:', error);
    }
  };
  
  const calculateTotalDeepWorkTime = (sessionsData) => {
    const allSessions = Object.values(sessionsData).flat();
    const totalMinutes = allSessions.reduce((sum, session) => sum + session.duration, 0);
    const hours = parseFloat((totalMinutes / 60).toFixed(1));
    setTotalHours(hours);
  };

  const loadWeeklyInsight = async () => {
    if (!isPremium && insightsGeneratedCount >= 3) {
      console.log('🔒 Insights limit reached - showing paywall');
      setShowPaywall(true);
      return;
    }

    try {
      setInsightLoading(true);
      setInsightError(null);
      
      const sessionsArray = Object.values(sessions).flat();
      
      if (sessionsArray.length === 0) {
        setInsightError('No sessions to analyze yet. Start tracking your deep work!');
        return;
      }
      
      const result = await InsightGenerator.generateWeeklyInsight({
        sessions: sessionsArray,
        activities,
        forceRegenerate: false
      });
      
      console.log('📊 Insight generation result:', {
        success: result.success,
        hasText: !!result.insightText,
        fromCache: result.metadata?.fromCache
      });
      
      if (result.success && result.insightText) {
        setWeeklyInsight({ 
          insightText: result.insightText,
          metadata: {
            fromCache: result.metadata?.fromCache || false,
            generatedAt: result.metadata?.generatedAt || new Date().toISOString()
          }
        });
        
        if (!isPremium) {
          const newCount = insightsGeneratedCount + 1;
          setInsightsGeneratedCount(newCount);
          
          const settings = await deepWorkStore.getSettings();
          await deepWorkStore.updateSettings({
            ...settings,
            insightsGeneratedCount: newCount
          });
        }
      } else {
        setInsightError('Failed to generate insight. Please try again.');
      }
    } catch (error) {
      console.error('Failed to generate insight:', error);
      setInsightError('Failed to generate insight. Please try again.');
    } finally {
      setInsightLoading(false);
    }
  };

  const handleSessionPress = (session) => {
    setSelectedSession(session);
    setShowSessionDetails(true);
  };

  const handleActivityPress = (activity) => {
    setSelectedActivity(activity);
    setShowActivityInsights(true);
  };

  const getFilteredSessions = () => {
    return sessions;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading metrics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.container, styles.centered]}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadInitialData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header with Insights Button */}
        <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.brandName, { color: colors.primary }]}>DEEP TRACKER.io</Text>
            <Text style={[styles.title, { color: colors.text }]}>DEEP WORK SUMMARY</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.generateInsightsButton,
              { 
                backgroundColor: colors.primary,
                shadowColor: colors.shadowColor,
              }
            ]}
            onPress={loadWeeklyInsight}
            disabled={insightLoading}
          >
            {insightLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={styles.sparkleEmoji}>✨</Text>
                <Text style={styles.generateInsightsText}>Generate Insights</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Show remaining insights for free users */}
        {!isPremium && (
          <View style={[styles.limitIndicator, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.limitText, { color: colors.textSecondary }]}>
              {3 - insightsGeneratedCount} free insights remaining
            </Text>
            <TouchableOpacity 
              onPress={() => setShowPaywall(true)}
              style={styles.upgradeLink}
            >
              <Text style={[styles.upgradeLinkText, { color: colors.primary }]}>
                Upgrade →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Insight Section */}
        {(weeklyInsight || insightLoading || insightError) && (
          <View style={[
            styles.insightSection,
            { 
              backgroundColor: colors.cardBackground,
              borderColor: colors.border 
            }
          ]}>
            {insightLoading && (
              <View style={styles.insightLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.insightLoadingText, { color: colors.text }]}>
                  Generating insight...
                </Text>
              </View>
            )}

            {insightError && (
              <Text style={[styles.insightError, { color: colors.error }]}>
                {insightError}
              </Text>
            )}

            {weeklyInsight && !insightLoading && (
              <ExpandableInsight insight={weeklyInsight} />
            )}
          </View>
        )}

        {/* Charts Section */}
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

        {/* Scrollable Session List */}
        <SessionList
          sessions={getFilteredSessions()}
          activities={activities}
          onSessionPress={handleSessionPress}
        />

        {/* Activities Section */}
        <ActivitiesSection
          activities={activities}
          onActivityPress={handleActivityPress}
        />

        {/* Paywall Modal */}
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          limitType="insights"
        />

        {/* Session Details Modal */}
        <SessionDetailsModal
          visible={showSessionDetails}
          session={selectedSession}
          activities={activities}
          onClose={() => {
            setShowSessionDetails(false);
            setSelectedSession(null);
          }}
        />
      </SafeAreaView>

      {/* Activity Insights Modal */}
      <Modal
        visible={showActivityInsights}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowActivityInsights(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedActivity?.name} Insights
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.cardBackground }]}
              onPress={() => setShowActivityInsights(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalInsightText, { color: colors.text }]}>
              Activity-specific insights will appear here
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
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
    fontWeight: '600',
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
  limitIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
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
  activitiesFilterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  activitiesLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  activitiesCheckboxes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 8,
  },
  activityColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalInsightText: {
    fontSize: 16,
    lineHeight: 24,
  },
});

export default MetricsScreen;