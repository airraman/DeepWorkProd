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
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import BaseModal from './BaseModal';

// Get device dimensions for responsive design
const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallPhone = height < 700; // For iPhone SE and similar small devices

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

    // Small color picker component
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
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
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
                                    autoCapitalize="none"
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
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1,
        width: '100%',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    container: {
        width: '90%',
        maxWidth: 500,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: isTablet ? 28 : 24,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        width: '100%',
    },
    instructionText: {
        fontSize: isTablet ? 18 : 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: isSmallPhone ? 12 : 20,
    },
    colorCircle: {
        width: isTablet ? 48 : 36,
        height: isTablet ? 48 : 36,
        borderRadius: isTablet ? 24 : 18,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activityInput: {
        flex: 1,
        height: isTablet ? 54 : 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: isTablet ? 16 : 14,
    },
    colorPickerContainer: {
        width: '100%',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 20,
    },
    colorOption: {
        width: isTablet ? 46 : 36,
        height: isTablet ? 46 : 36,
        margin: 6,
        borderRadius: isTablet ? 23 : 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    saveButton: {
        backgroundColor: '#2563eb',
        width: '100%',
        padding: isTablet ? 16 : 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
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