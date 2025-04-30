import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Make boxes even smaller for more compact display
const BOX_SIZE = 6;
const BOX_MARGIN = 1;
const BOXES_PER_ROW = 7; // One for each day of the week
const NUM_COLUMNS = Math.floor((SCREEN_WIDTH - 40) / (BOX_SIZE + BOX_MARGIN)); // Based on screen width

const ActivityGrid = ({ sessions }) => {
  const { theme, colors } = useTheme();
  const [activityData, setActivityData] = useState([]);
  const [maxActivity, setMaxActivity] = useState(1);

  useEffect(() => {
    if (!sessions) return;
    processSessionsData();
  }, [sessions]);

  const processSessionsData = () => {
    const today = new Date();
    const gridData = [];
    let highestValue = 1;
    
    // Fill the grid with days based on available columns
    for (let i = 0; i < NUM_COLUMNS * BOXES_PER_ROW; i++) {
      const date = new Date();
      date.setDate(today.getDate() - (NUM_COLUMNS * BOXES_PER_ROW - 1) + i);
      const dateString = date.toISOString().split('T')[0];
      
      // Count minutes spent in deep work for this day
      const dayMinutes = (sessions[dateString] || []).reduce((total, session) => {
        return total + session.duration;
      }, 0);
      
      if (dayMinutes > highestValue) {
        highestValue = dayMinutes;
      }
      
      gridData.push({
        date: dateString,
        minutes: dayMinutes,
        dayOfWeek: date.getDay()
      });
    }
    
    setMaxActivity(highestValue);
    setActivityData(gridData);
  };

  // Get the intensity level (0-4) based on activity amount
  const getIntensityLevel = (minutes) => {
    if (minutes === 0) return 0;
    
    const quartile = maxActivity / 4;
    if (minutes <= quartile) return 1;
    if (minutes <= quartile * 2) return 2;
    if (minutes <= quartile * 3) return 3;
    return 4;
  };

  // Get the color for a specific intensity level
  const getColorForIntensity = (level) => {
    // Use green colors with different intensity levels
    switch (level) {
      case 0: return colors.border; // Empty box
      case 1: return '#D1FADF'; // Very light green
      case 2: return '#A6F4C5'; // Light green
      case 3: return '#4ADE80'; // Medium green
      case 4: return '#22C55E'; // Dark green
      default: return colors.border;
    }
  };

  // Get selected month labels to display (just a few to save space)
  const getMonthLabels = () => {
    const months = [];
    const today = new Date();
    let lastMonth = '';
    
    // Show only 3-4 month labels to save space
    for (let i = 0; i < NUM_COLUMNS; i += Math.floor(NUM_COLUMNS / 3)) {
      const date = new Date();
      date.setDate(today.getDate() - (NUM_COLUMNS * BOXES_PER_ROW - 1) + (i * BOXES_PER_ROW));
      const month = date.toLocaleString('default', { month: 'short' });
      
      if (month !== lastMonth) {
        months.push({
          month,
          position: i
        });
        lastMonth = month;
      }
    }
    
    return months;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
        
        <View style={styles.legendContainer}>
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Less</Text>
          {[0, 1, 2, 3, 4].map(level => (
            <View
              key={level}
              style={[
                styles.legendBox,
                { backgroundColor: getColorForIntensity(level) }
              ]}
            />
          ))}
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>More</Text>
        </View>
      </View>
      
      <View style={styles.monthLabelsContainer}>
        {getMonthLabels().map((item, index) => (
          <Text
            key={index}
            style={[
              styles.monthLabel,
              { 
                color: colors.textSecondary,
                left: item.position * (BOX_SIZE + BOX_MARGIN) * (BOXES_PER_ROW / 7)
              }
            ]}
          >
            {item.month}
          </Text>
        ))}
      </View>
      
      <View style={styles.gridContainer}>
        {/* Minimal day indicators */}
        <View style={styles.dayLabelsContainer}>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>M</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>W</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>F</Text>
        </View>
        
        {/* The actual grid */}
        <View style={styles.grid}>
          {activityData.map((day, index) => {
            const col = Math.floor(index / BOXES_PER_ROW);
            const row = day.dayOfWeek === 0 ? 6 : day.dayOfWeek - 1; // Adjust Sunday to be last
            
            const intensityLevel = getIntensityLevel(day.minutes);
            
            return (
              <View
                key={index}
                style={[
                  styles.gridBox,
                  {
                    backgroundColor: getColorForIntensity(intensityLevel),
                    left: col * (BOX_SIZE + BOX_MARGIN),
                    top: row * (BOX_SIZE + BOX_MARGIN)
                  }
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  monthLabelsContainer: {
    height: 12,
    position: 'relative',
    marginLeft: 16, // Align with grid
    marginBottom: 1,
  },
  monthLabel: {
    fontSize: 9,
    position: 'absolute',
  },
  gridContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayLabelsContainer: {
    width: 12,
    height: BOXES_PER_ROW * (BOX_SIZE + BOX_MARGIN) - 2,
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  dayLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  grid: {
    height: BOXES_PER_ROW * (BOX_SIZE + BOX_MARGIN),
    width: NUM_COLUMNS * (BOX_SIZE + BOX_MARGIN),
    position: 'relative',
  },
  gridBox: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 1,
    position: 'absolute',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  legendBox: {
    width: 6,
    height: 6,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  legendText: {
    fontSize: 8,
    marginHorizontal: 2,
  }
});

export default ActivityGrid;