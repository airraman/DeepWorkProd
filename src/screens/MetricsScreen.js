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
import ActivitySummaryModal from '../components/modals/ActivitySummaryModal';
import { useFocusEffect } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import SessionDetailsModal from '../components/modals/SessionDetailsModal';
import { useTheme } from '../context/ThemeContext';
import InsightGenerator from '../services/insights/InsightGenerator';
import ExpandableInsight from '../components/ExpandableInsight';
import { useSubscription } from '../context/SubscriptionContext';
import { PaywallModal } from '../components/PaywallModal';
// At the top of src/screens/MetricsScreen.js
import { getStartOfWeek } from '../utils/dateHelpers';

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



  
  
  // ✅ Single-letter day names to prevent bunching
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    const daySessions = sessions[dateString] || [];
    const totalMinutes = daySessions.reduce((sum, session) => sum + session.duration, 0);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(1));
    
    weekData.push({
      day: dayNames[date.getDay()],  // ✅ Single letter (S, M, T, W, T, F, S)
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
          <Text style={styles.achievementIcon}></Text>
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
  let lastShownPosition = -4; // Track last shown position to prevent overlap
  
  for (let i = 0; i < gridData.length; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - (gridData.length - i - 1) * 7);
    
    // Show month label if:
    // 1. First week of month (date <= 7) OR first position (i === 0)
    // 2. At least 4 weeks since last label (prevents overlap)
    const isNewMonth = weekDate.getDate() <= 7 || i === 0;
    const hasEnoughSpacing = i - lastShownPosition >= 4;
    
    if (isNewMonth && hasEnoughSpacing) {
      monthLabels.push({
        month: MONTHS[weekDate.getMonth()],
        position: i
      });
      lastShownPosition = i; // Update tracker
    }
  }
  
  return (
    <View style={styles.compactActivityContainer}>
      {/* <Text style={[styles.compactActivityTitle, { color: colors.textSecondary }]}>
        Activity
      </Text> */}
      
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
  const { isPremium } = useSubscription();
  const scrollViewRef = useRef(null);
  const [monthsLayout, setMonthsLayout] = useState([]);
  
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
    
    // ✅ CHANGE: Keep chronological order (oldest to newest, left to right)
    return months;
  };
  
  const months = generateMonthsList();
  
  // Get current month value for comparison
  const getCurrentMonthValue = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  };
  
  const currentMonthValue = getCurrentMonthValue();
  
  // ✅ NEW: Auto-scroll to current month on mount
  useEffect(() => {
    if (scrollViewRef.current && monthsLayout.length > 0) {
      const currentMonthIndex = months.findIndex(m => m.value === currentMonthValue);
      if (currentMonthIndex !== -1 && monthsLayout[currentMonthIndex]) {
        // Scroll to show current month on the right side of screen
        scrollViewRef.current.scrollTo({
          x: monthsLayout[currentMonthIndex].x - 100, // Offset to show it near right edge
          animated: true
        });
      }
    }
  }, [monthsLayout]);
  
  const handleMonthPress = (month) => {
    // Current month is always accessible
    if (month.value === currentMonthValue) {
      onMonthSelect(month.value); // ✅ Calls the prop function
      return;
    }
    
    // Previous months require premium
    if (!isPremium) {
      // Show paywall - parent component will handle this via the prop
      onMonthSelect(null, 'previousMonths'); // ✅ Calls the prop function with reason
      return;
    }
    
    // Premium users can access any month
    onMonthSelect(month.value); // ✅ Calls the prop function
  };
  
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
          const isCurrentMonth = month.value === currentMonthValue;
          
          return (
            <TouchableOpacity
              key={month.value}
              style={[
                styles.monthButton,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  opacity: 1, // Always show full opacity
                },
              ]}
              onPress={() => handleMonthPress(month)}
              onLayout={(event) => {
                // Track layout positions for auto-scroll
                const { x, width } = event.nativeEvent.layout;
                setMonthsLayout(prev => {
                  const newLayout = [...prev];
                  newLayout[index] = { x, width };
                  return newLayout;
                });
              }}
            >
              <Text
                style={[
                  styles.monthButtonText,
                  {
                    color: isSelected ? '#fff' : colors.text,
                  },
                ]}
              >
                {month.month} {month.year}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const SessionList = ({ sessions, activities, onSessionPress, selectedMonth,  onActivityPress }) => {
  const { colors } = useTheme();
  
  const generateDaysList = () => {
    const days = [];
    
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      // Count DOWN from last day to 1 (reverse order)
// Count UP from 1 to last day
for (let d = 1; d <= lastDay.getDate(); d++) {
  const date = new Date(year, month - 1, d);
  const dateString = date.toISOString().split('T')[0];
  
  days.push({
    date: dateString,
    dayNumber: d,
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
  
  const calculateDayTotal = (daySessions) => {
    const totalMinutes = daySessions.reduce((sum, session) => sum + session.duration, 0);
    return (totalMinutes / 60).toFixed(1);
  };
  
  return (
    <View style={styles.sessionListContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {days.map((day) => {
          const dayTotal = calculateDayTotal(day.sessions);
          
          return (
            <View key={day.date} style={styles.dayRow}>
              {/* Date number on left */}
              <View style={styles.dateColumn}>
                <Text style={[styles.dateNumber, { color: colors.text }]}>
                  {day.dayNumber}
                </Text>
              </View>
              
              {/* Session cubes in middle */}
              <View style={styles.sessionsColumn}>
                {day.sessions.length > 0 ? (
                  <View style={styles.sessionCubesContainer}>
                    {day.sessions.map((session) => (
                      <TouchableOpacity
                        key={session.id}
                        style={[
                          styles.sessionCube,
                          { backgroundColor: getActivityColor(session.activity) }
                        ]}
                        onPress={() => onSessionPress(session)}
                        activeOpacity={0.7}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              
              {/* Total hours on right */}
              <View style={styles.totalColumn}>
                {day.sessions.length > 0 && (
                  <View style={styles.totalBadge}>
                    <Text style={styles.totalText}>{dayTotal}h</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
      
      {/* Activities Legend at bottom */}
      <View style={[styles.activitiesLegend, { backgroundColor: colors.background }]}>
        <Text style={[styles.legendTitle, { color: colors.text }]}>
          Activities:
        </Text>
        <View style={styles.legendItems}>
        {activities.map((activity) => (
  <TouchableOpacity  // ✅ CHANGED from View to TouchableOpacity
    key={activity.id} 
    style={styles.legendItem}
    onPress={() => onActivityPress(activity)}  // ✅ ADD THIS
    activeOpacity={0.7}
  >
    <View style={[styles.legendCube, { backgroundColor: activity.color }]} />
    <Text style={[styles.legendText, { color: colors.text }]}>
      {activity.name}
    </Text>
  </TouchableOpacity>
))}
        </View>
      </View>
    </View>
  );
};



const MetricsScreen = () => {
  const { colors, isDarkMode } = useTheme();

  // const { 
  //   isPremium,           // ← Remove ": actualIsPremium"
  //   canGenerateInsights, // ← Remove ": actualCanGenerateInsights"
  // } = useSubscription();

  const { isPremium: _orig, canGenerateInsights: _origCan } = useSubscription();
const isPremium = true; // 🧪 TEST MODE
const canGenerateInsights = true; // 🧪 TEST MODE

  const [sessions, setSessions] = useState({});
  const [activities, setActivities] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [currentInsight, setCurrentInsight] = useState(null);
  const [insightError, setInsightError] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isGeneratingAllInsights, setIsGeneratingAllInsights] = useState(false);
const [showInsightsModal, setShowInsightsModal] = useState(false);
const [hasGeneratedInsights, setHasGeneratedInsights] = useState(false);

  const [insights, setInsights] = useState({
    daily: null,
    weekly: null,
    monthly: null,
  });

  const handleAnalyzeClick = async () => {
    setIsGeneratingAllInsights(true);
    await generateAllInsights();
    setIsGeneratingAllInsights(false);
    setHasGeneratedInsights(true);
  };
  
  const handleInsightCardClick = () => {
    setShowInsightsModal(true);
  };
  
  const generateAllInsights = async () => {
    try {
      setInsightError(null); // Clear previous errors
      
      // ✅ FIX 1: Always use current date for insights
      // "Monthly" means "last 30 days from today", not "selected month"
      const now = new Date();
      
      console.log('🤖 [Metrics] Starting insight generation:', {
        timestamp: now.toISOString(),
        selectedMonth: selectedMonth ? new Date(selectedMonth).toISOString() : 'current'
      });
      
      // ✅ Generate all three insights in parallel for better UX
      const [dailyInsight, weeklyInsight, monthlyInsight] = await Promise.allSettled([
        InsightGenerator.generate('daily', {
          referenceDate: now,
          forceRegenerate: false,
        }),
        InsightGenerator.generate('weekly', {
          referenceDate: now,
          forceRegenerate: false,
        }),
        InsightGenerator.generate('monthly', {
          referenceDate: now,  // ← Always use now, not selectedMonth
          forceRegenerate: false,
        })
      ]);
      
      // ✅ FIX 2: Better error handling with specific messages
      const newInsights = {
        daily: dailyInsight.status === 'fulfilled' ? dailyInsight.value : null,
        weekly: weeklyInsight.status === 'fulfilled' ? weeklyInsight.value : null,
        monthly: monthlyInsight.status === 'fulfilled' ? monthlyInsight.value : null,
      };
      
      // Check if any succeeded
      const hasAnySuccess = newInsights.daily || newInsights.weekly || newInsights.monthly;
      
      if (!hasAnySuccess) {
        // All failed - show specific error
        const errors = [
          dailyInsight.status === 'rejected' ? `Daily: ${dailyInsight.reason?.message}` : null,
          weeklyInsight.status === 'rejected' ? `Weekly: ${weeklyInsight.reason?.message}` : null,
          monthlyInsight.status === 'rejected' ? `Monthly: ${monthlyInsight.reason?.message}` : null,
        ].filter(Boolean);
        
        const errorMessage = errors.length > 0 
          ? errors.join('\n') 
          : 'Unknown error generating insights';
        
        console.error('🤖 [Metrics] All insights failed:', {
          daily: dailyInsight.reason,
          weekly: weeklyInsight.reason,
          monthly: monthlyInsight.reason
        });
        
        // ✅ IMPROVED: More helpful error message
        setInsightError(
          __DEV__ 
            ? `Debug Errors:\n${errorMessage}` 
            : 'Unable to generate insights. Please try again in a few moments.'
        );
        
        return;
      }
      
      // At least one succeeded
      setInsights(newInsights);
      
      console.log('✅ [Metrics] Insights generated:', {
        daily: !!newInsights.daily,
        weekly: !!newInsights.weekly,
        monthly: !!newInsights.monthly
      });
      
    } catch (error) {
      console.error('🤖 [Metrics] Error generating insights:', error);
      setInsightError(
        __DEV__ 
          ? `Debug: ${error.message}` 
          : 'Unable to generate insights. Please check your OpenAI API key in settings.'
      );
    }
  };
  
  const [isGeneratingInsights, setIsGeneratingInsights] = useState({
    daily: false,
    weekly: false,
    monthly: false,
  });


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
    console.log('\n🔍 [MetricsScreen] Loading data...');
    
    try {
      const loadedSessions = await deepWorkStore.getSessions();
      const settings = await deepWorkStore.getSettings();
      const loadedActivities = settings.activities;
      
      console.log('✅ [MetricsScreen] Loaded successfully');
      console.log(`   Sessions dates: ${Object.keys(loadedSessions).length}`);
      console.log(`   Activities: ${loadedActivities.length}`);
      
      setSessions(loadedSessions);
      setActivities(loadedActivities);
    } catch (error) {
      console.error('❌ [MetricsScreen] Error loading:', error.message);
      
      // AGGRESSIVE REPAIR: Bypass all validation and directly fix storage
      console.log('🔧 [MetricsScreen] Starting aggressive repair...');
      
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        
        // Read raw data
        const rawSessions = await AsyncStorage.getItem('@deep_work_sessions');
        console.log('📦 [MetricsScreen] Raw data exists?', !!rawSessions);
        
        if (!rawSessions) {
          console.log('⚠️ [MetricsScreen] No session data in storage - initializing empty');
          await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
          setSessions({});
          const settings = await deepWorkStore.getSettings();
          setActivities(settings.activities || []);
          return;
        }
        
        console.log('📦 [MetricsScreen] Raw data length:', rawSessions.length);
        
        // Parse raw data
        let parsed;
        try {
          parsed = JSON.parse(rawSessions);
          console.log('✅ [MetricsScreen] JSON parse successful');
        } catch (parseError) {
          console.error('❌ [MetricsScreen] JSON parse failed:', parseError.message);
          console.log('🗑️ [MetricsScreen] Clearing corrupt JSON');
          await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
          setSessions({});
          const settings = await deepWorkStore.getSettings();
          setActivities(settings.activities || []);
          return;
        }
        
        // Validate it's an object
        if (!parsed || typeof parsed !== 'object') {
          console.error('❌ [MetricsScreen] Data is not an object, type:', typeof parsed);
          console.log('🗑️ [MetricsScreen] Clearing invalid data structure');
          await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
          setSessions({});
          const settings = await deepWorkStore.getSettings();
          setActivities(settings.activities || []);
          return;
        }

        const hasAnyInsights = () => {
          return insights.daily || insights.weekly || insights.monthly;
        };
        

        
        const dateKeys = Object.keys(parsed);
        console.log(`📊 [MetricsScreen] Found ${dateKeys.length} date keys`);
        
        // Repair each date
        const repairedSessions = {};
        let totalValid = 0;
        let totalInvalid = 0;
        
        dateKeys.forEach(date => {
          const dateSessions = parsed[date];
          
          // Check if it's an array
          if (!Array.isArray(dateSessions)) {
            console.error(`❌ [MetricsScreen] ${date}: Not an array (${typeof dateSessions})`);
            totalInvalid++;
            return;
          }
          
          // Filter valid sessions
          const validSessions = dateSessions.filter((session, idx) => {
            const isValid = (
              session &&
              typeof session.activity === 'string' &&
              session.activity.length > 0 &&
              typeof session.duration === 'number' &&
              session.duration > 0 &&
              typeof session.musicChoice === 'string'
            );
            
            if (!isValid) {
              console.error(`❌ [MetricsScreen] ${date}[${idx}] invalid:`, {
                exists: !!session,
                activity: session?.activity,
                activityType: typeof session?.activity,
                duration: session?.duration,
                durationType: typeof session?.duration,
                musicChoice: session?.musicChoice,
                musicChoiceType: typeof session?.musicChoice
              });
              totalInvalid++;
            } else {
              totalValid++;
            }
            
            return isValid;
          });
          
          if (validSessions.length > 0) {
            repairedSessions[date] = validSessions;
          }
        });
        
        console.log(`📊 [MetricsScreen] Repair complete:`);
        console.log(`   Valid sessions: ${totalValid}`);
        console.log(`   Invalid sessions: ${totalInvalid}`);
        console.log(`   Repaired dates: ${Object.keys(repairedSessions).length}`);
        
        // Save repaired data
        await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify(repairedSessions));
        console.log('✅ [MetricsScreen] Repaired data saved');
        
        // Load settings
        const settings = await deepWorkStore.getSettings();
        console.log(`✅ [MetricsScreen] Loaded ${settings.activities?.length || 0} activities`);
        
        // Set state
        setSessions(repairedSessions);
        setActivities(settings.activities || []);
        
        console.log('✅ [MetricsScreen] Repair successful, data loaded');
        
      } catch (repairError) {
        console.error('❌ [MetricsScreen] Repair failed:', repairError);
        console.error('❌ [MetricsScreen] Stack:', repairError.stack);
        
        // NUCLEAR OPTION: Clear everything and start fresh
        console.log('☢️ [MetricsScreen] NUCLEAR: Clearing all session data');
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
          console.log('✅ [MetricsScreen] Storage cleared');
        } catch (clearError) {
          console.error('❌ [MetricsScreen] Even clear failed:', clearError);
        }
        
        // Set empty state
        setSessions({});
        setActivities([]);
      }
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
      console.log('📊 Generating insight for selected month:', selectedMonth);
      
      // ✅ FIX: Use correct API - generate(insightType, options)
      const insight = await InsightGenerator.generate('monthly', {
        referenceDate: selectedMonth ? new Date(selectedMonth) : new Date(),
        forceRegenerate: false,
      });
      
      console.log('✅ Insight generated:', insight);
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

  const handleActivityPress = (activity) => {
    console.log('📊 Activity pressed:', activity.name);
    setSelectedActivity(activity);
  };

  const handleMonthSelect = (value, reason) => {
    // If reason is provided, it means paywall should show
    if (reason === 'previousMonths') {
      setShowPaywall(true);
      return;
    }
    
    // Normal month selection
    setSelectedMonth(value);
  };

  const totalHours = calculateTotalHours();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          DeepWork.io
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.text }]}>
          Metrics
        </Text>
      </View>

      <View style={styles.content}>
        {/* Fixed Section: Insights + Metrics + Month Selector */}
        <View style={styles.fixedSection}>
{/* AI Insights Section - Gate for Premium */}
{!isPremium ? (
  // FREE USER: Show locked insight button
  <TouchableOpacity
    style={[styles.analyzeButton, { backgroundColor: colors.cardBackground }]}
    onPress={() => setShowPaywall(true)}
  >
    <Text style={[styles.analyzeButtonIcon, { color: colors.primary }]}>
      ✨
    </Text>
    <Text style={[styles.analyzeButtonText, { color: colors.text }]}>
      Analyze my focus patterns
    </Text>
  </TouchableOpacity>
) : (
  // PREMIUM USER: Show button or preview card
  <>
    {!hasGeneratedInsights ? (
      // BEFORE GENERATION: Show button
      <TouchableOpacity
        style={[styles.analyzeButton, { backgroundColor: colors.cardBackground }]}
        onPress={handleAnalyzeClick}
        disabled={isGeneratingAllInsights}
      >
        {isGeneratingAllInsights ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.analyzeButtonText, { color: colors.text }]}>
              Generating insights...
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.analyzeButtonIcon, { color: colors.primary }]}>
              ✨
            </Text>
            <Text style={[styles.analyzeButtonText, { color: colors.text }]}>
              Analyze my focus patterns
            </Text>
          </>
        )}
      </TouchableOpacity>
    ) : (
      // AFTER GENERATION: Show inline preview card
      <TouchableOpacity
        style={[styles.insightPreviewCard, { backgroundColor: colors.cardBackground }]}
        onPress={handleInsightCardClick}
        activeOpacity={0.7}
      >
        <View style={styles.insightPreviewHeader}>
          <Text style={[styles.insightPreviewTitle, { color: colors.text }]}>
            INSIGHT
          </Text>
          <View style={styles.insightDateBadge}>
            <Text style={styles.insightDateIcon}>📦</Text>
            <Text style={[styles.insightDateText, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>
        
        {/* Show preview of first available insight */}
        <Text 
          style={[styles.insightPreviewText, { color: colors.text }]}
          numberOfLines={3}
        >
          {insights.monthly?.insightText || insights.weekly?.insightText || insights.daily?.insightText || 'Tap to view insights'}
        </Text>
        
        <Text style={[styles.tapToSeeMore, { color: colors.primary }]}>
          Tap to see more
        </Text>
      </TouchableOpacity>
    )}
  </>
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
            onMonthSelect={handleMonthSelect}
            sessions={sessions}
          />
        </View>

        {/* Scrollable Section: Session List Only */}
        <SessionList 
          sessions={sessions} 
          activities={activities}
          onSessionPress={handleSessionPress}
          selectedMonth={selectedMonth}
          onActivityPress={handleActivityPress}  // ✅ NEW: Pass the handler
        />
      </View>

      <SessionDetailsModal
        visible={!!selectedSession}
        session={selectedSession}
        activities={activities}
        onClose={handleCloseModal}
      />

           {/* Insights Modal */}
           <InsightsModal
        visible={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        insights={insights}
        colors={colors}
      />

{selectedActivity && (
        <ActivitySummaryModal
        visible={!!selectedActivity}
        activity={selectedActivity}
        sessions={sessions}
        selectedMonth={selectedMonth}
        onClose={() => setSelectedActivity(null)}
      />

)}



<PaywallModal
  visible={showPaywall}
  onClose={() => setShowPaywall(false)}
  feature="previousMonths"
/>

    </SafeAreaView>
  )
  
  ;
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
    // marginBottom: 6
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
    marginBottom: 6
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
    // marginBottom: 8,
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
    paddingBottom: 4,  // ✅ ADD THIS LINE
    height: 65,
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
    height: 40,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
    // minWidth: 32,  // ✅ Ensures enough space for "Wed"

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
    lineHeight: 10,  // ✅ ADD THIS - locks vertical space

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
    borderRadius: 1000,
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
    position: 'relative',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 40,
  },
  dateColumn: {
    width: 30,
    alignItems: 'flex-start',
  },
  dateNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  sessionsColumn: {
    flex: 1,
    paddingHorizontal: 8,
  },
  sessionCubesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sessionCube: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  totalColumn: {
    width: 60,
    alignItems: 'flex-end',
  },
  totalBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  activitiesLegend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendCube: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  legendText: {
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
  lockedInsightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  lockIcon: {
    fontSize: 20,
  },
  lockedInsightText: {
    fontSize: 16,
    fontWeight: '600',
  },
  lockedInsightSubtext: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  generateInsightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  sparkleEmoji: {
    fontSize: 20,
  },
  generateInsightText: {
    fontSize: 16,
    fontWeight: '600',
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
  insightBox: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  insightSection: {
    marginBottom: 16,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  }, // ===== AI INSIGHTS STYLES =====
  
  // Analyze Button (Before Generation)
  analyzeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  analyzeButtonIcon: {
    fontSize: 24,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // Inline Preview Card (After Generation)
  insightPreviewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  insightPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  insightDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightDateIcon: {
    fontSize: 14,
  },
  insightDateText: {
    fontSize: 13,
  },
  insightPreviewText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  tapToSeeMore: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  
  // Modal Styles
  insightModalContainer: {
    flex: 1,
  },
  insightModalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightModalSubtitle: {
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  insightModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  insightSection: {
    marginBottom: 24,
  },
  insightSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  insightSectionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  insightDivider: {
    height: 1,
    marginBottom: 24,
  }
});


// ===== INSIGHTS MODAL COMPONENT =====
const InsightsModal = ({ visible, onClose, insights, colors }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.insightModalContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.insightModalHeader, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.insightModalTitle, { color: colors.text }]}>
              Insight
            </Text>
            <Text style={[styles.insightModalSubtitle, { color: colors.textSecondary }]}>
              Cached • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.insightModalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Yesterday Insight */}
          {insights.daily?.insightText && (
            <>
              <View style={styles.insightSection}>
                <Text style={[styles.insightSectionLabel, { color: colors.primary }]}>
                  YESTERDAY
                </Text>
                <Text style={[styles.insightSectionText, { color: colors.text }]}>
                  {insights.daily.insightText}
                </Text>
              </View>
              
              {/* Divider */}
              <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Last 7 Days Insight */}
          {insights.weekly?.insightText && (
            <>
              <View style={styles.insightSection}>
                <Text style={[styles.insightSectionLabel, { color: colors.primary }]}>
                  LAST 7 DAYS
                </Text>
                <Text style={[styles.insightSectionText, { color: colors.text }]}>
                  {insights.weekly.insightText}
                </Text>
              </View>
              
              {/* Divider */}
              <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Last 30 Days Insight */}
          {insights.monthly?.insightText && (
            <View style={styles.insightSection}>
              <Text style={[styles.insightSectionLabel, { color: colors.primary }]}>
                LAST 30 DAYS
              </Text>
              <Text style={[styles.insightSectionText, { color: colors.text }]}>
                {insights.monthly.insightText}
              </Text>
            </View>
          )}

          {/* Bottom padding for scroll */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default MetricsScreen;