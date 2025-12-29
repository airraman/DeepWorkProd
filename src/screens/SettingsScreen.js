import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { Plus, X, Save, Clock, Pencil, Volume2 } from 'lucide-react-native';
import { deepWorkStore } from '../services/deepWorkStore';
import { alarmService } from '../services/alarmService';
import SharedHeader from '../components/SharedHeader';
import { useTheme, THEMES } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useSubscription } from '../context/SubscriptionContext';  // ✅ NEW IMPORT
import { PaywallModal } from '../components/PaywallModal';  // ✅ NEW IMPORT
import { notificationService } from '../services/notificationService';
import { Bell } from 'lucide-react-native';
import { notificationBackgroundTask } from '../services/notificationBackgroundTask';


const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 50;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SettingsScreen = () => {
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;
  const navigation = useNavigation();
  const { isPremium } = useSubscription();  // ✅ NEW: Get subscription status
  
  // Core state management
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState('');
  const [selectedColor, setSelectedColor] = useState('#c8b2d6');
  const [selectedDurations, setSelectedDurations] = useState([]);
  
  // Alarm settings state
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmVolume, setAlarmVolume] = useState(0.8);
  
  // UI state management
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // ✅ NEW: Paywall state
  const [showPaywall, setShowPaywall] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
// ✅ UPDATED: Full-spectrum color palette (16 colors)
const colorPalette = [
  // Reds/Pinks
  '#ffb3ba',  // Pastel Red
  '#ffdfdf',  // Light Pink
  
  // Oranges
  '#ffcc99',  // Pastel Orange
  '#ffd9b3',  // Peach
  
  // Yellows
  '#ffffba',  // Pastel Yellow
  '#fff5cc',  // Cream
  
  // Greens
  '#baffc9',  // Pastel Green
  '#b3f0d4',  // Mint
  '#d4f0b3',  // Light Lime
  
  // Blues
  '#bae1ff',  // Pastel Blue
  '#b3d9ff',  // Sky Blue
  '#c2e0f0',  // Light Cyan
  
  // Purples
  '#d9baff',  // Pastel Purple
  '#e0b3ff',  // Lavender
  
  // Magentas
  '#ffb3f7',  // Pastel Magenta
  '#ffc9f0',  // Light Fuchsia
];

  const durations = [5, 10, 15, 20, 30, 45];

  useEffect(() => {
    loadSettings();
    loadNotificationStatus();
  }, []);

  const loadNotificationStatus = async () => {
    const enabled = await notificationService.areNotificationsEnabled();
    setNotificationsEnabled(enabled);
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

  // ✅ UPDATED: Add paywall gate to activity creation
  const handleAddActivity = async () => {
    if (!newActivity.trim()) return;

    // 🔒 PAYWALL GATE: Check activity limit for free users
    if (!isPremium && activities.length >= 2) {
      console.log('🔒 Activity limit reached - showing paywall');
      console.log('Current activities:', activities.length);
      console.log('User isPremium:', isPremium);
      
      // Show paywall
      setShowPaywall(true);
      return; // Block the action
    }

    try {
      setIsSaving(true);
      console.log('✅ Adding activity...');
      
      const id = newActivity.toLowerCase().replace(/\s+/g, '-');
      const updatedActivities = [
        ...activities, 
        { 
          id, 
          name: newActivity, 
          color: selectedColor 
        }
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

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Enabling - request permissions first
      const granted = await notificationService.requestPermissions();
      
      if (granted) {
        // Schedule notifications based on user's frequency preference
        await notificationService.scheduleNotifications();
        // Register background task to keep notifications fresh
  try {
    console.log('🔄 Registering background task for notifications...');
    await notificationBackgroundTask.register();
    console.log('✅ Background task registered');
  } catch (bgError) {
    console.warn('⚠️ Background task registration failed:', bgError);
    // Non-critical - user can still use notifications
  }
        setNotificationsEnabled(true);
        
        // Get frequency to show helpful feedback
        const frequency = await deepWorkStore.getReminderFrequency();
        
        // ✅ PRODUCTION: Clear, informative feedback (no test notification)
        let message;
        if (frequency === 'daily') {
          message = 'Daily reminders enabled (9 AM, 2 PM, 7 PM)';
        } else if (frequency === 'weekly') {
          message = 'Weekly reminders enabled (Monday 9 AM)';
        } else {
          message = 'Reminders enabled';
        }
        
        showFeedback(message);
        
        // ❌ REMOVED: No test notification for end users
        
      } else {
        // Better instructions for enabling permissions
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in Settings:\n\n1. Open Settings\n2. Find DeepWork.io\n3. Enable Notifications\n4. Enable Sound & Badges',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            }
          ]
        );
      }
    } else {
      // Disabling - cancel all notifications and unregister background task
      try {
        await notificationService.cancelAllNotifications();
        
        // Unregister background task
        console.log('🗑️  Unregistering background task...');
        await notificationBackgroundTask.unregister();
        console.log('✅ Background task unregistered');
        
        setNotificationsEnabled(false);
        showFeedback('All reminders disabled');
        
      } catch (error) {
        console.error('❌ Error disabling notifications:', error);
        showFeedback('Error disabling notifications');
      }
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
              
              // Delete sessions
              const { success, deletedCount } = await deepWorkStore.deleteSessionsByActivity(
                activityToDelete.name
              );
              
              if (!success) throw new Error('Failed to delete sessions');
              
              // Remove from settings
              const updatedActivities = activities.filter(a => a.id !== idToDelete);
              const settingsSuccess = await deepWorkStore.updateActivities(updatedActivities);
              
              if (settingsSuccess) {
                setActivities(updatedActivities);
                const message = deletedCount > 0 
                  ? `Deleted "${activityToDelete.name}" and ${deletedCount} session${deletedCount === 1 ? '' : 's'}`
                  : `Deleted "${activityToDelete.name}"`;
                showFeedback(message);
              } else {
                throw new Error('Failed to delete activity');
              }
            } catch (error) {
              showFeedback('Error deleting activity');
              console.error('Failed to delete:', error);
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const handleDurationClick = async (duration) => {
    try {
      setIsSaving(true);
      let newDurations;
      
      if (selectedDurations.includes(duration)) {
        newDurations = selectedDurations.filter(d => d !== duration);
      } else {
        if (selectedDurations.length === 3) {
          newDurations = [duration];
        } else {
          newDurations = [...selectedDurations, duration];
        }
      }
      
      const success = await deepWorkStore.updateDurations(newDurations);
      
      if (success) {
        setSelectedDurations(newDurations);
      } else {
        throw new Error('Failed to update durations');
      }
    } catch (error) {
      showFeedback('Error updating durations');
      console.error('Failed to update durations:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAlarmEnabledChange = async (enabled) => {
    try {
      setAlarmEnabled(enabled);
      const currentSettings = await deepWorkStore.getSettings();
      const success = await deepWorkStore.updateSettings({
        ...currentSettings,
        alarmEnabled: enabled
      });
      
      if (!success) {
        setAlarmEnabled(!enabled);
        showFeedback('Failed to update alarm setting');
      }
    } catch (error) {
      console.error('Error updating alarm enabled setting:', error);
      setAlarmEnabled(!enabled);
      showFeedback('Error updating alarm setting');
    }
  };

  const handleAlarmVolumeChange = async (volume) => {
    try {
      setAlarmVolume(volume);
      
      const currentSettings = await deepWorkStore.getSettings();
      const success = await deepWorkStore.updateSettings({
        ...currentSettings,
        alarmVolume: volume
      });
      
      if (!success) {
        setAlarmVolume(alarmVolume);
        showFeedback('Failed to update volume setting');
      } else {
        showFeedback(`Volume set to ${Math.round(volume * 100)}%`);
      }
    } catch (error) {
      console.error('Error updating alarm volume setting:', error);
      showFeedback('Error updating volume setting');
    }
  };

  const handleTestAlarm = async () => {
    try {
      setIsSaving(true);
      showFeedback('Testing alarm...');
      
      const alarmPlayed = await alarmService.playCompletionAlarm({
        volume: alarmVolume,  // ← Use user's selected volume
        autoStopAfter: 3      // ← Short test duration
      });
            
      if (alarmPlayed) {
        setTimeout(() => {
          showFeedback('Alarm test complete! 🔔');
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

  {/* Notification Reminders Section */}
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
      Focus Reminders
    </Text>
  </View>
  
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>
        Enable reminders
      </Text>
      <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 4 }]}>
        Get reminded to start deep work sessions
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
</View>

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
        
        {/* Activities Section */}
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
            <Pencil stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Activity Names
            </Text>
            {/* ✅ NEW: Show premium badge for free users */}
            {!isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          
          {/* ✅ NEW: Show limit warning for free users */}
          {!isPremium && activities.length >= 2 && (
            <View style={[styles.limitWarning, { backgroundColor: colors.warningBackground, borderColor: colors.warning }]}>
              <Text style={[styles.limitWarningText, { color: colors.warningText }]}>
                🔒 Free users can have up to 2 activities
              </Text>
              <TouchableOpacity 
                style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowPaywall(true)}
              >
                <Text style={styles.upgradeButtonText}>Upgrade for Unlimited</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.addActivityForm}>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: isDark ? '#2a2a2a' : 'white',
                  borderColor: colors.border,
                  color: colors.text 
                }
              ]}
              placeholder="Enter activity name"
              placeholderTextColor={colors.textSecondary}
              value={newActivity}
              onChangeText={setNewActivity}
            />
            
            <View style={styles.formControls}>
              <View style={styles.colorSelectContainer}>
                <Text style={[styles.colorSelectLabel, { color: colors.textSecondary }]}>
                  Color:
                </Text>
                <TouchableOpacity
                  style={[
                    styles.selectedColorPreview,
                    { backgroundColor: selectedColor, borderColor: colors.border }
                  ]}
                  onPress={() => setShowColorPicker(true)}
                />
              </View>
              
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

        {/* Duration Selection Section */}
        {/* <View style={[
          styles.section, 
          { 
            backgroundColor: isDark ? '#1f1f1f' : colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Clock stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Available Durations
            </Text>
          </View>
          
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Select exactly 3 durations
          </Text>
          
          <View style={styles.durationButtons}>
            {durations.map(duration => {
              const isSelected = selectedDurations.includes(duration);
              const isDisabled = selectedDurations.length === 3 && !isSelected;
              
              return (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.durationButton,
                    { 
                      backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                    isDisabled && styles.disabledDuration
                  ]}
                  onPress={() => handleDurationClick(duration)}
                  disabled={isDisabled || isSaving}
                >
                  <Text style={[
                    styles.durationButtonText,
                    { color: isSelected ? colors.primary : colors.text }
                  ]}>
                    {duration} min
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View> */}

        {/* Alarm Settings Section */}
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
      {/* Notification Reminders Section */}
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
            Focus Reminders
          </Text>
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              Enable reminders
            </Text>
            <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 4 }]}>
              Get reminded to start deep work sessions
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
        {/* Test Notification Button */}
{/* {notificationsEnabled && (
  <TouchableOpacity
    style={[
      styles.testButton,
      { 
        backgroundColor: colors.primary,
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center'
      }
    ]}
    onPress={async () => {
      setIsSaving(true);
      await notificationService.sendTestNotification();
      showFeedback('Test notification sent!');
      setIsSaving(false);
    }}
  >
    <Text style={{ color: 'white', fontWeight: '600' }}>
      Send Test Notification
    </Text>
  </TouchableOpacity>
)} */}
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

        {__DEV__ && (
          <TouchableOpacity
            style={[
              styles.updateButton,
              { backgroundColor: '#6b7280', marginTop: 8 }
            ]}
            onPress={() => navigation.navigate('DevTools')}
          >
            <Text style={styles.updateButtonText}>🛠️ Dev Tools (Testing Only)</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Color</Text>
            <View style={styles.colorGrid}>
              {colorPalette.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedColor(color);
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ✅ NEW: Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        limitType="activities"
      />

      {/* Alert */}
      {showAlert && (
        <View style={[styles.alert, { backgroundColor: colors.background === '#000000' ? '#1f2937' : '#1f2937' }]}>
          <Text style={styles.alertText}>{alertMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
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
  },
  section: {
    padding: 16,
    marginBottom: 12,
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
    flex: 1,
  },
  // ✅ NEW: Premium badge styles
  premiumBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  premiumBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // ✅ NEW: Limit warning styles
  limitWarning: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  limitWarningText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  upgradeButton: {
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addActivityForm: {
    width: '100%',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: 16,
  },
  formControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,  // ✅ Add this - creates space below the row

  },
  colorSelectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSelectLabel: {
    fontSize: 14,
  },
  selectedColorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  activitiesList: {
    flexGrow: 0,
  },
  activityItem: {
    padding: 12,
    marginRight: 8,
    width: SCREEN_WIDTH * 0.6,
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flex: 1,
  },
  deleteButton: {
    padding: 4,
  },
  helpText: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  durationButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationButton: {
    width: (SCREEN_WIDTH - 96) / 3,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  disabledDuration: {
    opacity: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  volumeControls: {
    flexDirection: 'row',
    gap: 8,
  },
  volumeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
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
  // Add these to the existing styles object:
settingRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 12,
},
settingInfo: {
  flex: 1,
  marginRight: 12,
},
settingLabel: {
  fontSize: 16,
  fontWeight: '500',
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
});

export default SettingsScreen;