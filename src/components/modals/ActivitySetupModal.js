// src/components/modals/ActivitySetupModal.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Dimensions,
} from 'react-native';
import BaseModal from './BaseModal';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const ActivitySetupModal = ({ 
    visible, 
    onClose, 
    onSave,
    // Progress bar props
    showProgress = false,
    currentStep = 1,
    totalSteps = 4,
    stepLabels = []
}) => {
    // State for managing activities
    const [activities, setActivities] = useState([
        { id: '1', name: '', color: '#E4D0FF' },
        { id: '2', name: '', color: '#D0FFDB' }
    ]);
    
    // State for color picker
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    
    // Predefined colors for picker
// ✅ UPDATED: Full-spectrum color palette (same as SettingsScreen)
const colorOptions = [
    // Reds/Pinks
    '#ffb3ba', '#ffdfdf',
    
    // Oranges
    '#ffcc99', '#ffd9b3',
    
    // Yellows
    '#ffffba', '#fff5cc',
    
    // Greens
    '#baffc9', '#b3f0d4', '#d4f0b3',
    
    // Blues
    '#bae1ff', '#b3d9ff', '#c2e0f0',
    
    // Purples
    '#d9baff', '#e0b3ff',
    
    // Magentas
    '#ffb3f7', '#ffc9f0',
  ];

    const handleActivityChange = (id, text) => {
        setActivities(prevActivities => 
            prevActivities.map(activity => 
                activity.id === id ? { ...activity, name: text } : activity
            )
        );
    };

    const handleColorSelect = (color) => {
        if (selectedActivityId) {
            setActivities(prevActivities =>
                prevActivities.map(activity =>
                    activity.id === selectedActivityId ? { ...activity, color } : activity
                )
            );
            setShowColorPicker(false);
            setSelectedActivityId(null);
        }
    };

    return (
        <BaseModal 
            visible={visible} 
            onClose={onClose} 
            preventClose={true}
            showProgress={showProgress}
            currentStep={currentStep}
            totalSteps={totalSteps}
            stepLabels={stepLabels}
        >
            <View style={styles.container}>
                <Text style={styles.title}>Activities</Text>
                
                <Text style={styles.instructionText}>
                    Set your Deep Work activities. Choose something you can do uninterrupted.
                </Text>
                
                {activities.map((activity, index) => (
                    <View key={activity.id} style={styles.activityRow}>
                        <TouchableOpacity
                            style={[styles.colorCircle, { backgroundColor: activity.color }]}
                            onPress={() => {
                                setSelectedActivityId(activity.id);
                                setShowColorPicker(true);
                            }}
                        />
                        <TextInput
                            style={styles.activityInput}
                            value={activity.name}
                            onChangeText={(text) => handleActivityChange(activity.id, text)}
                            placeholder="CREATE ACTIVITY"
                            placeholderTextColor="#AAAAAA"
                        />
                    </View>
                ))}

                {showColorPicker && (
                    <View style={styles.colorPickerContainer}>
                        <FlatList
                            data={colorOptions}
                            numColumns={4}
                            renderItem={({ item: color }) => (
                                <TouchableOpacity
                                    style={[styles.colorOption, { backgroundColor: color }]}
                                    onPress={() => handleColorSelect(color)}
                                />
                            )}
                            keyExtractor={color => color}
                        />
                    </View>
                )}

                <TouchableOpacity 
                    style={[
                        styles.saveButton,
                        !activities.every(a => a.name.trim()) && styles.saveButtonDisabled
                    ]}
                    onPress={() => {
                        if (activities.every(a => a.name.trim())) {
                            onSave(activities);
                        }
                    }}
                    disabled={!activities.every(a => a.name.trim())}
                >
                    <Text style={styles.saveButtonText}>Save Activities</Text>
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        width: '100%', // Ensure full width for the title
    },
    instructionText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
    },
    colorCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activityInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    colorPickerContainer: {
        width: '100%',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginVertical: 16,
        alignItems: 'center',
    },
    colorOption: {
        width: 36,
        height: 36,
        margin: 6,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    saveButton: {
        backgroundColor: '#2563eb',
        width: '100%',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default ActivitySetupModal;