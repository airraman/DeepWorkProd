import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Clock, Music, Pencil } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import { useTheme, THEMES } from '../context/ThemeContext';
import SharedHeader from '../components/SharedHeader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Add tablet detection
const isTablet = SCREEN_WIDTH > 768 || SCREEN_HEIGHT > 768;
const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 50;
const CONTENT_PADDING_TOP = HEADER_HEIGHT - (Platform.OS === 'ios' ? 0 : 20);

const HomeScreen = () => {
  const navigation = useNavigation();
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;
  
  // Core state for session configuration
  const [duration, setDuration] = useState('');
  const [activity, setActivity] = useState('');
  const [musicChoice, setMusicChoice] = useState('');
  
  // State for managing settings loaded from deepWorkStore
  const [availableDurations, setAvailableDurations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Music options remain constant as they're not configurable in settings
  const musicOptions = [
    { value: 'none', label: 'No music' },
    { value: 'white-noise', label: 'White noise' },
    { value: 'lofi', label: 'Lo-fi' }
  ];

  // Load settings when component first mounts
  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    const settings = await deepWorkStore.getSettings();
    if (!settings.activities.length || !settings.durations.length) {
      navigation.replace('InitialSetup');
    } else {
      loadSettings();
    }
  };

  // Reload settings whenever the screen comes into focus
  // This ensures we have the latest settings after changes in SettingsScreen
  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
    }, [])
  );

  // Function to load settings from deepWorkStore
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await deepWorkStore.getSettings();
      
      // Update local state with settings
      setAvailableDurations(settings.durations);
      setActivities(settings.activities);
      
      // Validate existing selections against new settings
      // If a selected duration or activity is no longer available, reset it
      if (duration && !settings.durations.includes(parseInt(duration))) {
        setDuration('');
      }
      if (activity && !settings.activities.some(a => a.id === activity)) {
        setActivity('');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle starting a new deep work session
  const handleStartSession = () => {
    navigation.navigate('DeepWorkSession', {
      duration,
      activity,
      musicChoice
    });
  };

  // Render individual activity item in the horizontal list
  const renderActivity = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.activityItem,
        { 
          backgroundColor: isDark ? colors.card : 'white',
          borderColor: activity === item.id ? colors.primary : colors.border 
        },
        activity === item.id && styles.activityItemSelected
      ]}
      onPress={() => setActivity(item.id)}
    >
      <View style={[styles.colorDot, { backgroundColor: item.color }]} />
      <Text style={[styles.activityName, { color: colors.text }]}>{item.name}</Text>
    </TouchableOpacity>
  );

  // Show loading screen while fetching settings
  if (isLoading) {
    return (
      <View style={[
        styles.container, 
        styles.centered,
        { backgroundColor: colors.background }
      ]}>
        <SharedHeader />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SharedHeader />
      
      <ScrollView 
        style={[styles.content, { paddingTop: CONTENT_PADDING_TOP }]}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Prepare Deep Work Session</Text>
        </View>
        
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        
        {/* Activity Selection - Now using dynamic activities from settings */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: colors.card,
            borderColor: activity ? colors.primary : colors.border 
          },
          activity && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Pencil stroke={colors.textSecondary} size={isTablet ? 24 : 20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity Name</Text>
          </View>
          <FlatList
            data={activities}
            renderItem={renderActivity}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activitiesList}
          />
        </View>
        
        {/* Duration Selection - Now using dynamic durations from settings */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: colors.card,
            borderColor: duration ? colors.primary : colors.border 
          },
          duration && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Clock stroke={colors.textSecondary} size={isTablet ? 24 : 20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Duration</Text>
          </View>
          <View style={styles.durationButtons}>
            {availableDurations.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.durationButton,
                  { backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' },
                  duration === time.toString() && { backgroundColor: colors.primary }
                ]}
                onPress={() => setDuration(time.toString())}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    { color: isDark ? colors.textSecondary : '#1f2937' },
                    duration === time.toString() && { color: 'white' }
                  ]}
                >
                  {time}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Music Selection */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: colors.card,
            borderColor: musicChoice ? colors.primary : colors.border 
          },
          musicChoice && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Music stroke={colors.textSecondary} size={isTablet ? 24 : 20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Background Music</Text>
          </View>
          <View style={styles.musicButtons}>
            {musicOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.musicButton,
                  { backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' },
                  musicChoice === option.value && { backgroundColor: colors.primary }
                ]}
                onPress={() => setMusicChoice(option.value)}
              >
                <Text
                  style={[
                    styles.musicButtonText,
                    { color: isDark ? colors.textSecondary : '#1f2937' },
                    musicChoice === option.value && { color: 'white' }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Extra padding at the bottom to ensure all content is visible above the footer */}
        <View style={{ height: isTablet ? 120 : 80 }} />
      </ScrollView>

      <View style={[styles.footer, { 
        backgroundColor: colors.card, 
        borderTopColor: colors.border 
      }]}>
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: colors.primary },
            (!duration || !activity || !musicChoice) && styles.startButtonDisabled
          ]}
          onPress={handleStartSession}
          disabled={!duration || !activity || !musicChoice}
        >
          <Text style={[styles.startButtonText, { color: colors.buttonText }]}>Begin Deep Work Timer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  // Content styles
  content: {
    flex: 1,
    paddingHorizontal: isTablet ? 24 : 12,
  },
  contentContainer: {
    paddingBottom: isTablet ? 32 : 20,
    alignItems: isTablet ? 'center' : 'stretch',
  },
  header: {
    alignItems: 'center',
    marginBottom: isTablet ? 16 : 10,
  },
  headerTitle: {
    fontSize: isTablet ? 26 : 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginBottom: isTablet ? 24 : 16,
    width: isTablet ? '80%' : '100%',
    alignSelf: 'center',
  },
  section: {
    borderRadius: 12,
    padding: isTablet ? 24 : 16,
    marginBottom: isTablet ? 18 : 12,
    borderWidth: 2,
    maxWidth: isTablet ? 800 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  sectionCompleted: {
    borderColor: '#2563eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isTablet ? 16 : 12,
    gap: isTablet ? 12 : 8,
  },
  sectionTitle: {
    fontSize: isTablet ? 20 : 16,
    fontWeight: '600',
  },
  durationButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: isTablet ? 16 : 8,
    maxWidth: isTablet ? 600 : '100%',
    alignSelf: 'center',
  },
  durationButton: {
    width: isTablet ? 120 : (SCREEN_WIDTH - 96) / 3,
    padding: isTablet ? 16 : 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: isTablet ? 18 : 14,
    fontWeight: '500',
  },
  // Activity Styles
  activitiesList: {
    flexGrow: 0,
    paddingVertical: isTablet ? 16 : 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: isTablet ? 16 : 12,
    marginRight: isTablet ? 16 : 8,
    borderWidth: 1,
    width: isTablet ? SCREEN_WIDTH * 0.35 : SCREEN_WIDTH * 0.6,
  },
  activityItemSelected: {
    borderWidth: 2,
  },
  colorDot: {
    width: isTablet ? 28 : 20,
    height: isTablet ? 28 : 20,
    borderRadius: isTablet ? 14 : 10,
    marginRight: isTablet ? 12 : 8,
  },
  activityName: {
    fontSize: isTablet ? 18 : 14,
    fontWeight: '500',
  },
  // Music Styles
  musicButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: isTablet ? 16 : 8,
    maxWidth: isTablet ? 600 : '100%',
    alignSelf: 'center',
  },
  musicButton: {
    flex: 1,
    padding: isTablet ? 16 : 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  musicButtonText: {
    fontSize: isTablet ? 18 : 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Footer Styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: isTablet ? 24 : 16,
    borderTopWidth: 1,
  },
  startButton: {
    padding: isTablet ? 20 : 16,
    borderRadius: 8,
    alignItems: 'center',
    maxWidth: isTablet ? 600 : '100%',
    alignSelf: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: isTablet ? 20 : 16,
    fontWeight: '500',
  },
  // Loading state
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: isTablet ? 18 : 16,
  },
});

export default HomeScreen;