// src/screens/SettingsScreen.js - ENHANCED with Time Picker
/**
 * Settings Screen - Enhanced for Sprint 2
 * 
 * NEW FEATURES:
 * - Time picker for daily reminders
 * - Weekly summary toggle
 * - Improved notification preferences UI
 * - Real-time sync with Firestore
 * 
 * USER EXPERIENCE:
 * - All preferences save immediately
 * - Visual feedback for all actions
 * - Timezone-aware time selection
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Bell, Clock, TrendingUp, Volume2, Plus, X } from 'lucide-react-native';
import { useTheme, THEMES } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import { alarmService } from '../services/alarmService';
import { notificationService } from '../services/notificationService';
import { notificationBackgroundTask } from '../services/notificationBackgroundTask';
import notificationPreferences from '../services/notificationPreferences';
import SharedHeader from '../components/SharedHeader';

const isTablet = Platform.isPad || Dimensions.get('window').width > 768;
const HEADER_HEIGHT = isTablet ? 60 : 50;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SettingsScreen = () => {
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;
  const navigation = useNavigation();
  const { isPremium } = useSubscription();
  
  // Core state
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState('');
  const [selectedColor, setSelectedColor] = useState('#c8b2d6');
  const [selectedDurations, setSelectedDurations] = useState([]);
  
  // Alarm settings
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmVolume, setAlarmVolume] = useState(0.8);
  
  // ✅ NEW: Notification preferences state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState(new Date());
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // UI state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const colorPalette = [
    '#ffb3ba', '#ffdfdf', '#ffcc99', '#ffd9b3',
    '#ffffba', '#fff5cc', '#baffc9', '#b3f0d4',
    '#d4f0b3', '#bae1ff', '#b3d9ff', '#c2e0f0',
    '#d9baff', '#e0b3ff', '#ffb3f7', '#ffc9f0',
  ];

  const durations = [5, 10, 15, 20, 30, 45];

  useEffect(() => {
    loadSettings();
    loadNotificationPreferences();
  }, []);

  /**
   * ✅ NEW: Load notification preferences from Firestore
   */
  const loadNotificationPreferences = async () => {
    try {
      const prefs = await notificationPreferences.getPreferences();
      
      // Update state
      setDailyReminderEnabled(prefs.dailyReminder.enabled);
      setWeeklySummaryEnabled(prefs.weeklySummary);
      
      // Parse time string to Date object
      const [hours, minutes] = prefs.dailyReminder.time.split(':').map(Number);
      const timeDate = new Date();
      timeDate.setHours(hours, minutes, 0, 0);
      setDailyReminderTime(timeDate);
      
      // Check if notifications are enabled globally
      const enabled = await notificationService.areNotificationsEnabled();
      setNotificationsEnabled(enabled);
      
      console.log('📋 [Settings] Loaded notification preferences');
    } catch (error) {
      console.error('❌ [Settings] Error loading notification prefs:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await deepWorkStore.getSettings();
      setActivities(settings.activities);
      setSelectedDurations(settings.durations);
      setAlarmEnabled(settings.alarmEnabled !== undefined ? settings.alarmEnabled : true);
      setAlarmVolume(settings.alarmVolume !== undefined ? settings.alarmVolume : 0.8);
    } catch (error) {
      showFeedback('Error loading settings');
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showFeedback = (message) => {
    setAlertMessage(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 2000);
  };

  /**
   * ✅ NEW: Handle notification toggle
   */
  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Enabling - request permissions first
      const granted = await notificationService.requestPermissions();
      
      if (granted) {
        // Schedule notifications
        await notificationService.scheduleNotifications();
        
        // Register background task
        try {
          await notificationBackgroundTask.register();
        } catch (bgError) {
          console.warn('⚠️ Background task registration failed:', bgError);
        }
        
        setNotificationsEnabled(true);
        showFeedback('Notifications enabled');
      } else {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in Settings:\n\n1. Open Settings\n2. Find DeepWork.io\n3. Enable Notifications\n4. Enable Sound & Badges',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } else {
      // Disabling
      try {
        await notificationService.cancelAllNotifications();
        await notificationBackgroundTask.unregister();
        setNotificationsEnabled(false);
        showFeedback('Notifications disabled');
      } catch (error) {
        console.error('❌ Error disabling notifications:', error);
        showFeedback('Error disabling notifications');
      }
    }
  };

  /**
   * ✅ NEW: Handle daily reminder toggle
   */
  const handleDailyReminderToggle = async () => {
    const newValue = !dailyReminderEnabled;
    setDailyReminderEnabled(newValue);
    
    const success = await notificationPreferences.setDailyReminderEnabled(newValue);
    if (success) {
      showFeedback(newValue ? 'Daily reminders enabled' : 'Daily reminders disabled');
    } else {
      showFeedback('Error updating preference');
      setDailyReminderEnabled(!newValue); // Revert on error
    }
  };

  /**
   * ✅ NEW: Handle time change
   */
  const handleTimeChange = async (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios'); // Keep open on iOS
    
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    
    if (selectedTime) {
      setDailyReminderTime(selectedTime);
      
      // Format time as HH:mm
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      // Save to Firestore
      const success = await notificationPreferences.setDailyReminderTime(timeString);
      if (success) {
        showFeedback(`Reminder time set to ${timeString}`);
        
        // Reschedule notifications with new time
        if (notificationsEnabled) {
          await notificationService.scheduleNotifications();
        }
      } else {
        showFeedback('Error updating reminder time');
      }
      
      // Close picker on Android
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }
    }
  };

  /**
   * ✅ NEW: Handle weekly summary toggle
   */
  const handleWeeklySummaryToggle = async () => {
    const newValue = !weeklySummaryEnabled;
    setWeeklySummaryEnabled(newValue);
    
    const success = await notificationPreferences.setWeeklySummaryEnabled(newValue);
    if (success) {
      showFeedback(newValue ? 'Weekly summary enabled' : 'Weekly summary disabled');
    } else {
      showFeedback('Error updating preference');
      setWeeklySummaryEnabled(!newValue); // Revert on error
    }
  };

  // ... (keep existing functions: handleAddActivity, handleDeleteActivity, etc.)
  
  const handleAddActivity = async () => {
    if (!newActivity.trim()) return;

    if (!isPremium && activities.length >= 2) {
      setShowPaywall(true);
      return;
    }

    try {
      setIsSaving(true);
      const id = newActivity.toLowerCase().replace(/\s+/g, '-');
      const updatedActivities = [
        ...activities,
        { id, name: newActivity, color: selectedColor }
      ];
      
      const success = await deepWorkStore.updateActivities(updatedActivities);
      
      if (success) {
        setActivities(updatedActivities);
        setNewActivity('');
        setSelectedColor(colorPalette[0]);
        showFeedback('Activity added successfully!');
      } else {
        throw new Error('Failed to save activity');
      }
    } catch (error) {
      showFeedback('Error saving activity');
      console.error('Failed to add activity:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteActivity = async (idToDelete) => {
    const activityToDelete = activities.find(a => a.id === idToDelete);
    
    if (!activityToDelete) {
      showFeedback('Activity not found');
      return;
    }
    
    Alert.alert(
      'Delete Activity?',
      `This will delete "${activityToDelete.name}" and ALL sessions. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              
              const { success, deletedCount } = await deepWorkStore.deleteSessionsByActivity(
                activityToDelete.name
              );
              
              if (!success) throw new Error('Failed to delete sessions');
              
              const updatedActivities = activities.filter(a => a.id !== idToDelete);
              const settingsSuccess = await deepWorkStore.updateActivities(updatedActivities);
              
              if (settingsSuccess) {
                setActivities(updatedActivities);
                const message = deletedCount > 0 
                  ? `Deleted "${activityToDelete.name}" and ${deletedCount} session${deletedCount === 1 ? '' : 's'}`
                  : `Deleted "${activityToDelete.name}"`;
                showFeedback(message);
              } else {
                throw new Error('Failed to update settings');
              }
            } catch (error) {
              showFeedback('Error deleting activity');
              console.error('Failed to delete activity:', error);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleAlarmEnabledChange = async (value) => {
    setAlarmEnabled(value);
    const success = await deepWorkStore.updateSettings({
      ...(await deepWorkStore.getSettings()),
      alarmEnabled: value,
    });
    if (success) {
      showFeedback(value ? 'Alarm enabled' : 'Alarm disabled');
    }
  };

  const handleAlarmVolumeChange = async (volume) => {
    setAlarmVolume(volume);
    const success = await deepWorkStore.updateSettings({
      ...(await deepWorkStore.getSettings()),
      alarmVolume: volume,
    });
    if (success) {
      showFeedback(`Volume set to ${Math.round(volume * 100)}%`);
    }
  };

  const handleTestAlarm = async () => {
    try {
      setIsSaving(true);
      const played = await alarmService.playCompletionAlarm({ 
        volume: alarmVolume,
        autoStopAfter: 3
      });
      
      if (played) {
        setTimeout(() => {
          showFeedback('Alarm test successful 🔔');
        }, 1000);
      } else {
        showFeedback('Alarm test failed - check device settings');
      }
    } catch (error) {
      console.error('Error testing alarm:', error);
      showFeedback('Alarm test failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (selectedDurations.length !== 3) {
      showFeedback('Please select exactly 3 durations');
      return;
    }

    try {
      setIsSaving(true);
      const success = await deepWorkStore.updateSettings({
        activities,
        durations: selectedDurations,
        alarmEnabled,
        alarmVolume,
      });

      if (success) {
        showFeedback('Settings updated successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      showFeedback('Error saving settings');
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderActivity = ({ item }) => (
    <View style={[
      styles.activityItem,
      {
        backgroundColor: isDark ? colors.card : 'white',
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 8,
      }
    ]}>
      <View style={styles.activityInfo}>
        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
        <Text style={[styles.activityName, { color: colors.text }]}>{item.name}</Text>
        <TouchableOpacity
          onPress={() => handleDeleteActivity(item.id)}
          style={styles.deleteButton}
          disabled={isSaving}
        >
          <X size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <SharedHeader title="Settings" />
        <View style={[styles.centered, { marginTop: HEADER_HEIGHT }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SharedHeader title="Settings" />
      
      <ScrollView 
        style={[styles.scrollView]}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingHorizontal: 12 }}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Customize Your DeepWork Experience
          </Text>
        </View>
        
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        
        {/* ✅ NEW: Enhanced Notification Section */}
        <View style={[
          styles.section,
          {
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Bell stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Notifications
            </Text>
          </View>
          
          {/* Master notification toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Enable notifications
              </Text>
              <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 4 }]}>
                Get alerts for sessions and reminders
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggle,
                notificationsEnabled && { backgroundColor: colors.primary }
              ]}
              onPress={handleToggleNotifications}
            >
              <View style={[
                styles.toggleCircle,
                notificationsEnabled && styles.toggleCircleActive
              ]} />
            </TouchableOpacity>
          </View>
          
          {/* Daily reminder settings */}
          {notificationsEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.divider, marginVertical: 12 }]} />
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Clock stroke={colors.textSecondary} size={18} style={{ marginRight: 8 }} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Daily reminder
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    dailyReminderEnabled && { backgroundColor: colors.primary }
                  ]}
                  onPress={handleDailyReminderToggle}
                >
                  <View style={[
                    styles.toggleCircle,
                    dailyReminderEnabled && styles.toggleCircleActive
                  ]} />
                </TouchableOpacity>
              </View>
              
              {/* Time picker */}
              {dailyReminderEnabled && (
                <TouchableOpacity
                  style={[styles.timePickerButton, { borderColor: colors.border }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={[styles.timePickerLabel, { color: colors.textSecondary }]}>
                    Reminder time
                  </Text>
                  <Text style={[styles.timePickerValue, { color: colors.text }]}>
                    {dailyReminderTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* iOS Time Picker Modal */}
              {showTimePicker && Platform.OS === 'ios' && (
                <View style={[styles.timePickerContainer, { backgroundColor: colors.card }]}>
                  <DateTimePicker
                    value={dailyReminderTime}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    textColor={colors.text}
                  />
                  <TouchableOpacity
                    style={[styles.timePickerDone, { backgroundColor: colors.primary }]}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.timePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Android Time Picker */}
              {showTimePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={dailyReminderTime}
                  mode="time"
                  display="default"
                  onChange={handleTimeChange}
                />
              )}
              
              {/* Weekly summary toggle */}
              <View style={[styles.divider, { backgroundColor: colors.divider, marginVertical: 12 }]} />
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <TrendingUp stroke={colors.textSecondary} size={18} style={{ marginRight: 8 }} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Weekly summary
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    weeklySummaryEnabled && { backgroundColor: colors.primary }
                  ]}
                  onPress={handleWeeklySummaryToggle}
                >
                  <View style={[
                    styles.toggleCircle,
                    weeklySummaryEnabled && styles.toggleCircleActive
                  ]} />
                </TouchableOpacity>
              </View>
              
              {weeklySummaryEnabled && (
                <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 8 }]}>
                  Sent every Monday at 9:00 AM
                </Text>
              )}
            </>
          )}
        </View>

        {/* Activities Section - UNCHANGED */}
        <View style={[
          styles.section,
          {
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Focus Activities
            </Text>
            {!isPremium && activities.length >= 2 && (
              <Text style={[styles.limitBadge, { color: colors.textSecondary }]}>
                {activities.length}/2 Free
              </Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <View style={styles.colorPickerContainer}>
              <TouchableOpacity
                style={[styles.colorPreview, { backgroundColor: selectedColor }]}
                onPress={() => setShowColorPicker(!showColorPicker)}
              />
              {showColorPicker && (
                <View style={[styles.colorGrid, { backgroundColor: colors.card }]}>
                  {colorPalette.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedColor(color);
                        setShowColorPicker(false);
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
            
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.background : 'white',
                  color: colors.text,
                  borderColor: colors.border,
                }
              ]}
              placeholder="New activity name"
              placeholderTextColor={colors.textSecondary}
              value={newActivity}
              onChangeText={setNewActivity}
              maxLength={30}
            />
            
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.primary },
                (!newActivity.trim() || isSaving) && styles.disabledButton
              ]}
              onPress={handleAddActivity}
              disabled={!newActivity.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Plus size={16} color="white" />
                  <Text style={styles.buttonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {activities.length > 0 && (
            <FlatList
              data={activities}
              renderItem={renderActivity}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.activitiesList}
            />
          )}
        </View>

        {/* Alarm Settings Section - UNCHANGED */}
        <View style={[
          styles.section,
          {
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Volume2 stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Alarm Settings
            </Text>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Enable Alarm
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: alarmEnabled ? colors.primary : colors.border }
              ]}
              onPress={() => handleAlarmEnabledChange(!alarmEnabled)}
            >
              <View 
                style={[
                  styles.toggleIndicator,
                  {
                    backgroundColor: '#FFFFFF',
                    alignSelf: alarmEnabled ? 'flex-end' : 'flex-start'
                  }
                ]}
              />
            </TouchableOpacity>
          </View>
          
          {alarmEnabled && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Volume
                </Text>
                <View style={styles.volumeControls}>
                  {[0.3, 0.5, 0.8, 1.0].map(vol => (
                    <TouchableOpacity
                      key={vol}
                      style={[
                        styles.volumeButton,
                        {
                          backgroundColor: alarmVolume === vol ? colors.primary : colors.border
                        }
                      ]}
                      onPress={() => handleAlarmVolumeChange(vol)}
                    >
                      <Text style={[
                        styles.volumeButtonText,
                        { color: alarmVolume === vol ? '#FFFFFF' : colors.text }
                      ]}>
                        {Math.round(vol * 100)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.testAlarmButton, { backgroundColor: colors.primary }]}
                onPress={handleTestAlarm}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.testAlarmButtonText}>Test Alarm</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.updateButton,
            { backgroundColor: colors.primary },
            isSaving && styles.disabledButton
          ]}
          onPress={handleSaveSettings}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.updateButtonText}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Alert Toast */}
      {showAlert && (
        <View style={[styles.alert, { backgroundColor: colors.primary }]}>
          <Text style={styles.alertText}>{alertMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  limitBadge: {
    fontSize: 12,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 13,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 2,
    justifyContent: 'center',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleCircleActive: {
    marginLeft: 22,
  },
  // ✅ NEW: Time picker styles
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
  timePickerLabel: {
    fontSize: 14,
  },
  timePickerValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  timePickerContainer: {
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  timePickerDone: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timePickerDoneText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Existing styles...
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  colorPickerContainer: {
    position: 'relative',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  colorGrid: {
    position: 'absolute',
    top: 50,
    left: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    width: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#000',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  activitiesList: {
    marginTop: 8,
  },
  activityItem: {
    marginRight: 8,
    padding: 12,
    minWidth: 120,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  activityName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  volumeControls: {
    flexDirection: 'row',
    gap: 8,
  },
  volumeButton: {
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  volumeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  testAlarmButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  testAlarmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  updateButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 4,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  alert: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertText: {
    color: 'white',
    fontWeight: '500',
  },
});

export default SettingsScreen;