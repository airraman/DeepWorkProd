// src/components/modals/ActivitySetupModal.js (update for responsive design)
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Dimensions,
    Platform
} from 'react-native';
import BaseModal from './BaseModal';

// Get device dimensions to handle iPad properly
const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const ActivitySetupModal = ({ visible, onClose, onSave }) => {
    // State for managing activities
    const [activities, setActivities] = useState([
        { id: '1', name: '', color: '#E4D0FF' },
        { id: '2', name: '', color: '#E4D0FF' }
    ]);
    
    // State for color picker
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    
    // Predefined colors for picker
    const colorOptions = [
        '#E4D0FF', '#D0FFDB', '#FFE4D0', '#D0E4FF',
        '#FFD0E4', '#E4FFD0', '#D0FFE4', '#FFE4D0'
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

    const ColorPicker = () => (
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
    );

    return (
        <BaseModal visible={visible} onClose={onClose}>
            <View style={styles.container}>
                <Text style={styles.title}>Activities</Text>
                <Text style={styles.instructionText}>
                    Set your Deep Work activities. Choose something you can do uninterrupted.
                </Text>
                
                {activities.map(activity => (
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
                            placeholderTextColor="#000"
                        />
                    </View>
                ))}

                {showColorPicker && <ColorPicker />}

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
        padding: 10,
        width: '100%',
        maxWidth: isTablet ? '80%' : '100%', 
        alignSelf: 'center',
    },
    title: {
        fontSize: isTablet ? 24 : 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    instructionText: {
        fontSize: isTablet ? 16 : 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 20,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
        width: '100%',
        paddingHorizontal: 16,
    },
    colorCircle: {
        width: isTablet ? 50 : 40,
        height: isTablet ? 50 : 40,
        borderRadius: isTablet ? 25 : 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activityInput: {
        flex: 1,
        height: isTablet ? 60 : 50,
        borderWidth: 1,
        width: '100%',   
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: isTablet ? 18 : 16,
    },
    colorPickerContainer: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 20,
    },
    colorOption: {
        width: isTablet ? 50 : 40,
        height: isTablet ? 50 : 40,
        margin: 5,
        borderRadius: isTablet ? 25 : 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    saveButton: {
        backgroundColor: '#2563eb',
        padding: isTablet ? 18 : 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: isTablet ? 18 : 16,
    },
});

export default ActivitySetupModal;

// Add similar responsive design changes to these files:
// - src/components/modals/DurationSetupModal.js
// - src/components/modals/GoalSetupModal.js 
// - src/components/modals/WelcomeStatsModal.js