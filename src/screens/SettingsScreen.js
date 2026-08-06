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
  Modal,
} from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { useTheme, THEMES } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';
import { deepWorkStore } from '../services/deepWorkStore';
import SharedHeader from '../components/SharedHeader';
import { useFocusLock } from '../context/FocusLockContext';
import focusLockService from '../services/focusLockService';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/authService';
import { PaywallModal } from '../components/PaywallModal';
import * as Updates from 'expo-updates';

const isTablet = Platform.isPad || Dimensions.get('window').width > 768;
const HEADER_HEIGHT = isTablet ? 60 : 50;

const SettingsScreen = () => {
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;
  const navigation = useNavigation();
  const { isPremium } = useSubscription();
  const { user } = useAuth();
  
  
  // Core state
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState('');
  const [selectedColor, setSelectedColor] = useState('#c8b2d6');
  const [selectedDurations, setSelectedDurations] = useState([]);
  
  // UI state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);

  // Focus Lock
  const { isAuthorized, selectionCount, refreshSelection } = useFocusLock();
  const [focusLockSelecting, setFocusLockSelecting] = useState(false);



  const colorPalette = [
    '#ffb3ba', '#ffdfdf', '#ffcc99', '#ffd9b3',
    '#ffffba', '#fff5cc', '#baffc9', '#b3f0d4',
    '#d4f0b3', '#bae1ff', '#b3d9ff', '#c2e0f0',
    '#d9baff', '#e0b3ff', '#ffb3f7', '#ffc9f0',
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await deepWorkStore.getSettings();
      setActivities(settings.activities);
      setSelectedDurations(settings.durations);
      const sessions = await deepWorkStore.getSessions();
      setTotalSessions(Object.values(sessions).flat().length);
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

  const handleAddActivity = async () => {
    if (!newActivity.trim()) return;

    if (!isPremium && activities.length >= 2) {
      showFeedback('Upgrade to premium to add more activities');
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
      `"${activityToDelete.name}" will be removed from future sessions. Past session history is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSaving(true);
              const updatedActivities = activities.filter(a => a.id !== idToDelete);
              const success = await deepWorkStore.updateActivities(updatedActivities);
              if (success) {
                setActivities(updatedActivities);
                showFeedback(`Deleted "${activityToDelete.name}"`);
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

  const handleChangeBlockedApps = async () => {
    if (!focusLockService.isSupported) return;
    setFocusLockSelecting(true);
    try {
      if (!isAuthorized) {
        const result = await focusLockService.requestAuthorization();
        const authorized = result === 'authorized' || result === 'approved' || result === true ||
          (typeof result === 'object' && result?.authorizationStatus === 'approved');
        if (!authorized) {
          showFeedback('Permission denied. Enable Screen Time in iOS Settings.');
          return;
        }
      }
      await focusLockService.selectAppsToBlock();
      await refreshSelection();
      showFeedback('Blocked apps updated.');
    } catch (err) {
      console.warn('[Settings] handleChangeBlockedApps failed:', err);
      showFeedback('Could not open app picker. Try again.');
    } finally {
      setFocusLockSelecting(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const currentSettings = await deepWorkStore.getSettings();
      const success = await deepWorkStore.updateSettings({
        ...currentSettings,
        activities,
        durations: selectedDurations,
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
        {/* Membership Status Card */}
        <TouchableOpacity
          style={[
            styles.membershipCard,
            {
              backgroundColor: isPremium ? 'rgba(21,128,61,0.08)' : 'rgba(234,88,12,0.08)',
              borderColor:     isPremium ? 'rgba(21,128,61,0.3)'  : 'rgba(234,88,12,0.3)',
            }
          ]}
          onPress={() => setShowPaywall(true)}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 26 }}>{isPremium ? '💎' : '⭐'}</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.membershipTitle, { color: isPremium ? '#15803D' : '#ea580c' }]}>
              {isPremium ? 'Pro Member' : 'Free Plan'}
            </Text>
            <Text style={[styles.membershipSub, { color: colors.textSecondary }]}>
              {isPremium ? 'All features unlocked' : 'Upgrade to unlock all features'}
            </Text>
          </View>
          {!isPremium && (
            <Text style={{ color: '#ea580c', fontWeight: '700', fontSize: 13 }}>Upgrade →</Text>
          )}
        </TouchableOpacity>

        {/* Account Row */}
        <TouchableOpacity
          style={[styles.accountRow, { backgroundColor: isDark ? '#1f1f1f' : colors.card, borderColor: colors.border }]}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>👤</Text>
          <Text style={[styles.accountRowLabel, { color: colors.text }]}>Account</Text>
          <Text style={[styles.accountRowChevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>

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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Focus Activities
            </Text>
            {!isPremium && activities.length >= 2 && (
              <Text style={[styles.limitBadge, { color: colors.textSecondary }]}>
                {activities.length}/2 Free
              </Text>
            )}
          </View>
          
          <View style={{ zIndex: 100 }}>
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[styles.colorPreview, { backgroundColor: selectedColor }]}
              onPress={() => setShowColorPicker(!showColorPicker)}
            />
            
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

          {showColorPicker && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.colorGrid, { backgroundColor: colors.card }]}
              contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>
          )}
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

        {/* Focus Lock Section */}
        {focusLockService.isSupported && (
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
              <Text style={{ fontSize: 20 }}>📵</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                App Blocking
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Blocked apps
                </Text>
                <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 4 }]}>
                  {selectionCount > 0
                    ? `${selectionCount} app${selectionCount !== 1 ? 's' : ''} selected`
                    : 'No apps selected yet'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.changeAppsBtn,
                  { borderColor: colors.primary },
                  focusLockSelecting && { opacity: 0.5 },
                ]}
                onPress={handleChangeBlockedApps}
                disabled={focusLockSelecting}
              >
                {focusLockSelecting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.changeAppsBtnText, { color: colors.primary }]}>
                    {selectionCount > 0 ? 'Change' : 'Set up'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {focusLockSelecting && (
              <Text style={[styles.helpText, { color: colors.textSecondary, marginTop: 8, marginHorizontal: 4 }]}>
                Select apps to block, then tap{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>Done</Text>
                {' '}in the top-right of the picker.
              </Text>
            )}
          </View>
        )}

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

<Text style={[styles.bundleInfo, { color: colors.textSecondary }]}>
  {Updates.isEmbeddedLaunch ? 'embedded' : (Updates.updateId?.slice(0, 8) ?? 'unknown')} · {Updates.runtimeVersion ?? '—'} · {Updates.channel ?? '—'}
</Text>

{__DEV__ && (
  <>
    <TouchableOpacity
      style={{
        margin: 16,
        marginBottom: 8,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#1f2937',
        alignItems: 'center',
      }}
      onPress={() => navigation.navigate('DevTools')}
    >
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
        🛠️ Dev Tools
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#6C63FF',
        alignItems: 'center',
      }}
      onPress={() => navigation.navigate('FocusLockTest')}
    >
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
        🔒 Focus Lock Test (Dev)
      </Text>
    </TouchableOpacity>
  </>
)}

</ScrollView>
      {/* Alert Toast */}
      {showAlert && (
        <View style={[styles.alert, { backgroundColor: colors.primary }]}>
          <Text style={styles.alertText}>{alertMessage}</Text>
        </View>
      )}

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={[styles.profileModal, { backgroundColor: colors.background }]}>
          <View style={[styles.profileModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileModalTitle, { color: colors.text }]}>Account</Text>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={[styles.profileModalClose, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.profileModalBody}>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || 'No email on file'}
            </Text>
            <View style={[styles.profileStat, { backgroundColor: isDark ? '#1f1f1f' : colors.card, borderColor: colors.border }]}>
              <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>Total sessions</Text>
              <Text style={[styles.profileStatValue, { color: colors.text }]}>{totalSessions}</Text>
            </View>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={async () => {
                setShowProfileModal(false);
                await signOut();
              }}
            >
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        limitType="pro_membership"
      />
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
    right: 0,
    padding: 12,
    borderRadius: 12,
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
  changeAppsBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeAppsBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
  profileButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  profileButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  membershipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  membershipTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  membershipSub: {
    fontSize: 12,
    marginTop: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  accountRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  accountRowChevron: {
    fontSize: 20,
  },
  profileModal: {
    flex: 1,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  profileModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileModalClose: {
    fontSize: 16,
    padding: 4,
  },
  profileModalBody: {
    padding: 20,
    gap: 14,
  },
  profileEmail: {
    fontSize: 14,
  },
  profileStat: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileStatLabel: {
    fontSize: 14,
  },
  profileStatValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  signOutBtn: {
    marginTop: 12,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  signOutBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bundleInfo: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.4,
  },
});

export default SettingsScreen;