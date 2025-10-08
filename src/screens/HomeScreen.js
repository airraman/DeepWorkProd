// src/screens/HomeScreen.js
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
  // CHANGED: availableDurations is now a constant array, not loaded from settings
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // CHANGED: All durations are now available - no need to load from settings
  const availableDurations = [5, 10, 15, 20, 30, 45];

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
    // CHANGED: Only check for activities, not durations
    if (!settings.activities.length) {
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
      
      // CHANGED: Only load activities, not durations
      setActivities(settings.activities);
      
      // CHANGED: Only validate activity selection
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
          backgroundColor: isDark ? colors.card : colors.background,
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

  // NEW: Render individual duration item in the horizontal list
  const renderDuration = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.durationItem,
        { backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' },
        duration === item.toString() && { backgroundColor: colors.primary }
      ]}
      onPress={() => setDuration(item.toString())}
    >
      <Text
        style={[
          styles.durationItemText,
          { color: isDark ? colors.textSecondary : '#6b7280' },
          duration === item.toString() && { color: 'white' }
        ]}
      >
        {item}m
      </Text>
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
        
        {/* Activity Selection - Section */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: activity ? colors.primary : colors.border 
          },
          activity && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Pencil stroke={colors.textSecondary} size={20} />
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
        
        {/* Duration Selection - Section - CHANGED: Now uses FlatList */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: duration ? colors.primary : colors.border 
          },
          duration && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Clock stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Duration</Text>
          </View>
          <FlatList
            data={availableDurations}
            renderItem={renderDuration}
            keyExtractor={item => item.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.durationsList}
            contentContainerStyle={styles.durationsListContent}
          />
        </View>

        {/* Music Selection - Section */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: musicChoice ? colors.primary : colors.border 
          },
          musicChoice && styles.sectionCompleted
        ]}>
          <View style={styles.sectionHeader}>
            <Music stroke={colors.textSecondary} size={20} />
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
                    { color: isDark ? colors.textSecondary : '#6b7280' },
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
        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={[styles.footer, { 
        backgroundColor: isDark ? '#1f1f1f' : colors.card,
        borderTopColor: colors.border 
      }]}>
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: '#2563EB' },
            (!duration || !activity || !musicChoice) && styles.startButtonDisabled
          ]}
          onPress={handleStartSession}
          disabled={!duration || !activity || !musicChoice}
        >
          <Text style={[styles.startButtonText, { color: 'white' }]}>Begin Deep Work Timer</Text>
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
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingBottom: 20,
    alignItems: 'stretch',
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'center',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCompleted: {
    borderColor: '#2563eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // NEW: Duration List Styles (matching activity list pattern)
  durationsList: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  durationsListContent: {
    gap: 8,
  },
  durationItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  durationItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Activity Styles
  activitiesList: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    width: SCREEN_WIDTH * 0.42,
  },
  activityItemSelected: {
    borderWidth: 2,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Music Styles
  musicButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  musicButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  musicButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Footer Styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  startButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Loading state
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});

export default HomeScreen;