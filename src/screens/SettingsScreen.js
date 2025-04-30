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
  Dimensions
} from 'react-native';
import { Plus, X, Save, Clock, Pencil } from 'lucide-react-native';
import { deepWorkStore } from '../services/deepWorkStore';
import SharedHeader from '../components/SharedHeader';
import { useTheme, THEMES } from '../context/ThemeContext';

// Use the same header height as other screens
const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 50;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SettingsScreen = () => {
  const { colors, theme } = useTheme();
  const isDark = theme === THEMES.DARK;
  
  // Core state management
  const [activities, setActivities] = useState([]);
  const [newActivity, setNewActivity] = useState('');
  const [selectedColor, setSelectedColor] = useState('#c8b2d6');
  const [selectedDurations, setSelectedDurations] = useState([]);
  
  // UI state management
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const colorPalette = [
    '#c8b2d6', '#f1dbbc', '#bcd2f1', '#d6b2c8', 
    '#b2d6c8', '#dbbcf1', '#bcf1db', '#f1bcdb'
  ];

  const durations = [5, 10, 15, 20, 30, 45];

  // Load saved settings when component mounts
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await deepWorkStore.getSettings();
      setActivities(settings.activities);
      setSelectedDurations(settings.durations);
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

    try {
      setIsSaving(true);
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

  const handleDeleteActivity = async (idToDelete) => {
    try {
      setIsSaving(true);
      const updatedActivities = activities.filter(
        activity => activity.id !== idToDelete
      );
      
      const success = await deepWorkStore.updateActivities(updatedActivities);
      
      if (success) {
        setActivities(updatedActivities);
        showFeedback('Activity deleted');
      } else {
        throw new Error('Failed to delete activity');
      }
    } catch (error) {
      showFeedback('Error deleting activity');
      console.error('Failed to delete activity:', error);
    } finally {
      setIsSaving(false);
    }
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Configure Your App</Text>
        </View>
        
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        
        {/* Add Activity Section */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12, 
            borderWidth: 2 
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Plus stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Activity</Text>
          </View>
          
          <View style={styles.addActivityForm}>
            <TextInput
              style={[
                styles.input,
                { 
                  borderColor: colors.border, 
                  backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
                  color: colors.text
                }
              ]}
              value={newActivity}
              onChangeText={setNewActivity}
              placeholder="Activity name"
              placeholderTextColor={colors.textSecondary}
              maxLength={20}
              editable={!isSaving}
            />
            <View style={styles.formControls}>
              <View style={styles.colorSelectContainer}>
                <Text style={[styles.colorSelectLabel, { color: colors.textSecondary }]}>Color:</Text>
                <TouchableOpacity
                  style={[styles.selectedColorPreview, { backgroundColor: selectedColor, borderColor: colors.border }]}
                  onPress={() => setShowColorPicker(true)}
                  disabled={isSaving}
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
                    <Plus size={20} color="white" />
                    <Text style={styles.buttonText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Activities List */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12, 
            borderWidth: 2
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Pencil stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Activities</Text>
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

        {/* Duration Selection */}
        <View style={[
          styles.section, 
          { 
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: 12, 
            borderWidth: 2
          }
        ]}>
          <View style={styles.sectionHeader}>
            <Clock stroke={colors.textSecondary} size={20} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Lengths</Text>
          </View>
          
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Select 3 options ({selectedDurations.length}/3)
          </Text>
          
          <View style={styles.durationButtons}>
            {durations.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.durationButton,
                  { backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' },
                  selectedDurations.includes(duration) && { backgroundColor: colors.primary },
                  selectedDurations.length === 3 &&
                    !selectedDurations.includes(duration) &&
                    styles.disabledDuration
                ]}
                onPress={() => handleDurationClick(duration)}
                disabled={
                  isSaving ||
                  (selectedDurations.length === 3 &&
                    !selectedDurations.includes(duration))
                }
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    { color: isDark ? colors.textSecondary : '#1f2937' },
                    selectedDurations.includes(duration) && { color: 'white' }
                  ]}
                >
                  {duration}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Update Button */}
        <TouchableOpacity
          style={[
            styles.updateButton,
            { backgroundColor: colors.primary },
            (selectedDurations.length !== 3 || isSaving) && styles.disabledButton,
          ]}
          onPress={handleSaveSettings}
          disabled={selectedDurations.length !== 3 || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.updateButtonText}>Save Settings</Text>
          )}
        </TouchableOpacity>

        {/* Extra padding at the bottom for better scrolling experience */}
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
});

export default SettingsScreen;