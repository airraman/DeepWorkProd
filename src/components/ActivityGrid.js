// src/components/ActivityGrid.js - iPad-Safe Version
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Safe dimension handling for iPad
const getSafeDimensions = () => {
  try {
    const { width, height } = Dimensions.get('window');
    const isTablet = Platform.isPad || (width > 768 && height > 768);
    
    return {
      width: Math.max(width, 320), // Minimum width fallback
      height: Math.max(height, 480), // Minimum height fallback
      isTablet
    };
  } catch (error) {
    console.error('Error getting dimensions:', error);
    // Fallback dimensions
    return {
      width: 375,
      height: 667,
      isTablet: false
    };
  }
};

const ActivityGrid = ({ sessions }) => {
  const { theme, colors } = useTheme();
  const [activityData, setActivityData] = useState([]);
  const [maxActivity, setMaxActivity] = useState(1);
  const [dimensions, setDimensions] = useState(getSafeDimensions());

  // Dynamic box sizing based on device
  const BOX_SIZE = dimensions.isTablet ? 8 : 6;
  const BOX_MARGIN = 1;
  const BOXES_PER_ROW = 7; // Days of the week
  
  // Safe column calculation with bounds checking
  const calculateColumns = () => {
    try {
      const availableWidth = dimensions.width - 40; // Account for padding
      const boxWidth = BOX_SIZE + BOX_MARGIN;
      const maxColumns = Math.floor(availableWidth / boxWidth);
      
      // iPad can show more columns, but with reasonable limits
      const targetColumns = dimensions.isTablet ? 26 : 20; // ~6 months vs ~5 months
      return Math.min(Math.max(targetColumns, 12), maxColumns); // Minimum 12, maximum what fits
    } catch (error) {
      console.error('Error calculating columns:', error);
      return 20; // Safe fallback
    }
  };

  const NUM_COLUMNS = calculateColumns();

  // Listen for dimension changes (iPad rotation, multitasking)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      try {
        const newDimensions = {
          width: Math.max(window.width, 320),
          height: Math.max(window.height, 480),
          isTablet: Platform.isPad || (window.width > 768 && window.height > 768)
        };
        setDimensions(newDimensions);
      } catch (error) {
        console.error('Error handling dimension change:', error);
      }
    });
    
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (!sessions) return;
    processSessionsData();
  }, [sessions, NUM_COLUMNS]); // Reprocess when columns change

  const processSessionsData = () => {
    try {
      const today = new Date();
      const gridData = [];
      let highestValue = 1;
      
      // Safe grid population with bounds checking
      const totalBoxes = NUM_COLUMNS * BOXES_PER_ROW;
      
      for (let i = 0; i < totalBoxes; i++) {
        try {
          const date = new Date();
          date.setDate(today.getDate() - (totalBoxes - 1) + i);
          
          // Validate date
          if (isNaN(date.getTime())) {
            console.warn('Invalid date generated, skipping');
            continue;
          }
          
          const dateString = date.toISOString().split('T')[0];
          
          // Safely calculate minutes
          const dayMinutes = (sessions[dateString] || []).reduce((total, session) => {
            const duration = typeof session.duration === 'number' ? session.duration : 0;
            return total + duration;
          }, 0);
          
          if (dayMinutes > highestValue) {
            highestValue = dayMinutes;
          }
          
          gridData.push({
            date: dateString,
            minutes: dayMinutes,
            dayOfWeek: date.getDay(),
            index: i // For debugging
          });
        } catch (error) {
          console.error('Error processing date at index', i, error);
        }
      }
      
      setMaxActivity(Math.max(highestValue, 1)); // Prevent division by zero
      setActivityData(gridData);
    } catch (error) {
      console.error('Error processing sessions data:', error);
      // Set safe fallback data
      setActivityData([]);
      setMaxActivity(1);
    }
  };

  // Safe intensity calculation
  const getIntensityLevel = (minutes) => {
    try {
      if (minutes === 0 || maxActivity === 0) return 0;
      
      const quartile = maxActivity / 4;
      if (minutes <= quartile) return 1;
      if (minutes <= quartile * 2) return 2;
      if (minutes <= quartile * 3) return 3;
      return 4;
    } catch (error) {
      console.error('Error calculating intensity:', error);
      return 0;
    }
  };

  // Safe color selection with fallbacks
  const getColorForIntensity = (level) => {
    try {
      const colorMap = {
        0: colors.border || '#e5e7eb',
        1: '#D1FADF',
        2: '#A6F4C5', 
        3: '#4ADE80',
        4: '#22C55E'
      };
      
      return colorMap[level] || colorMap[0];
    } catch (error) {
      console.error('Error getting color:', error);
      return '#e5e7eb'; // Safe fallback
    }
  };

  // Safe month labels generation
  const getMonthLabels = () => {
    try {
      const months = [];
      const today = new Date();
      let lastMonth = '';
      
      const step = Math.max(Math.floor(NUM_COLUMNS / 4), 1); // Show 4 labels max
      
      for (let i = 0; i < NUM_COLUMNS; i += step) {
        try {
          const date = new Date();
          date.setDate(today.getDate() - (NUM_COLUMNS * BOXES_PER_ROW - 1) + (i * BOXES_PER_ROW));
          
          if (isNaN(date.getTime())) continue;
          
          const month = date.toLocaleString('default', { month: 'short' });
          
          if (month !== lastMonth) {
            months.push({
              month,
              position: i
            });
            lastMonth = month;
          }
        } catch (error) {
          console.error('Error generating month label at index', i, error);
        }
      }
      
      return months;
    } catch (error) {
      console.error('Error generating month labels:', error);
      return [];
    }
  };

  // Render with error boundaries
  const renderGrid = () => {
    try {
      if (!activityData.length) {
        return (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No activity data available
            </Text>
          </View>
        );
      }

      return activityData.map((day, index) => {
        try {
          const col = Math.floor(index / BOXES_PER_ROW);
          const row = day.dayOfWeek === 0 ? 6 : day.dayOfWeek - 1;
          
          // Bounds checking
          if (col < 0 || col >= NUM_COLUMNS || row < 0 || row >= BOXES_PER_ROW) {
            return null;
          }
          
          const intensityLevel = getIntensityLevel(day.minutes);
          
          return (
            <View
              key={`${day.date}-${index}`}
              style={[
                styles.gridBox,
                {
                  width: BOX_SIZE,
                  height: BOX_SIZE,
                  backgroundColor: getColorForIntensity(intensityLevel),
                  left: col * (BOX_SIZE + BOX_MARGIN),
                  top: row * (BOX_SIZE + BOX_MARGIN)
                }
              ]}
            />
          );
        } catch (error) {
          console.error('Error rendering grid box at index', index, error);
          return null;
        }
      });
    } catch (error) {
      console.error('Error rendering grid:', error);
      return null;
    }
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
                { 
                  backgroundColor: getColorForIntensity(level),
                  width: dimensions.isTablet ? 8 : 6,
                  height: dimensions.isTablet ? 8 : 6
                }
              ]}
            />
          ))}
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>More</Text>
        </View>
      </View>
      
      <View style={styles.monthLabelsContainer}>
        {getMonthLabels().map((item, index) => (
          <Text
            key={`${item.month}-${index}`}
            style={[
              styles.monthLabel,
              { 
                color: colors.textSecondary,
                left: item.position * (BOX_SIZE + BOX_MARGIN) * (BOXES_PER_ROW / 7),
                fontSize: dimensions.isTablet ? 10 : 9
              }
            ]}
          >
            {item.month}
          </Text>
        ))}
      </View>
      
      <View style={styles.gridContainer}>
        <View style={styles.dayLabelsContainer}>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>M</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>W</Text>
          <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>F</Text>
        </View>
        
        <View style={[
          styles.grid,
          {
            height: BOXES_PER_ROW * (BOX_SIZE + BOX_MARGIN),
            width: NUM_COLUMNS * (BOX_SIZE + BOX_MARGIN),
          }
        ]}>
          {renderGrid()}
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
    marginLeft: 16,
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
    justifyContent: 'space-between',
    paddingVertical: 0,
  },
  dayLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  grid: {
    position: 'relative',
  },
  gridBox: {
    borderRadius: 1,
    position: 'absolute',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  legendBox: {
    borderRadius: 1,
    marginHorizontal: 1,
  },
  legendText: {
    fontSize: 8,
    marginHorizontal: 2,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  }
});

export default ActivityGrid;