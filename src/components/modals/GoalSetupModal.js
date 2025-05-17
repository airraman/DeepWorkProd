// src/components/modals/GoalSetupModal.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Pressable,
} from 'react-native';
import BaseModal from './BaseModal';

const GoalSetupModal = ({ visible, onClose, onSave }) => {
    // State for goals list and current goal being created
    const [goals, setGoals] = useState([]);
    const [currentGoal, setCurrentGoal] = useState({
        name: '',
        frequency: '',
        hours: ''
    });
    
    // State for dropdown visibility
    const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
    const [showHoursPicker, setShowHoursPicker] = useState(false);

    // Options for frequency and hours
    const frequencyOptions = ['Daily', 'Weekly', 'Monthly'];
    const hoursOptions = Array.from({ length: 24 }, (_, i) => (i + 1).toString());

    const handleAddGoal = () => {
        if (currentGoal.name && currentGoal.frequency && currentGoal.hours) {
            setGoals([...goals, { 
                ...currentGoal, 
                id: Date.now().toString() 
            }]);
            setCurrentGoal({ name: '', frequency: '', hours: '' });
        }
    };

    // Custom Dropdown Component
    const Dropdown = ({ options, value, onSelect, placeholder, visible, setVisible }) => (
        <View>
            <Pressable 
                style={styles.dropdownTrigger}
                onPress={() => setVisible(!visible)}
            >
                <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
                    {value || placeholder}
                </Text>
            </Pressable>

            {visible && (
                <View style={styles.dropdownMenu}>
                    {options.map((option) => (
                        <Pressable
                            key={option}
                            style={styles.dropdownItem}
                            onPress={() => {
                                onSelect(option);
                                setVisible(false);
                            }}
                        >
                            <Text style={styles.dropdownItemText}>{option}</Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <BaseModal visible={visible} onClose={onClose}>
            <View style={styles.container}>
                <Text style={styles.title}>Set Your Goals</Text>
                <Text style={styles.instructionText}>
                    Now choose something to work towards. We will track your time towards this.
                </Text>

                {/* Goal Input Form */}
                <View style={styles.inputForm}>
                    <TextInput
                        style={styles.nameInput}
                        value={currentGoal.name}
                        onChangeText={(text) => 
                            setCurrentGoal(prev => ({ ...prev, name: text }))
                        }
                        placeholder="GOAL NAME"
                        placeholderTextColor="#AAAAAA"
                    />

                    <View style={styles.inputRow}>
                        {/* Frequency Dropdown */}
                        <View style={styles.frequencyContainer}>
                            <Dropdown
                                options={frequencyOptions}
                                value={currentGoal.frequency}
                                onSelect={(value) => 
                                    setCurrentGoal(prev => ({ ...prev, frequency: value }))
                                }
                                placeholder="FREQUENCY"
                                visible={showFrequencyPicker}
                                setVisible={setShowFrequencyPicker}
                            />
                        </View>

                        {/* Hours Dropdown - Fixed Container */}
                        <View style={styles.hoursContainer}>
                            <Dropdown
                                options={hoursOptions}
                                value={currentGoal.hours}
                                onSelect={(value) => 
                                    setCurrentGoal(prev => ({ ...prev, hours: value }))
                                }
                                placeholder="HOURS"
                                visible={showHoursPicker}
                                setVisible={setShowHoursPicker}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            (!currentGoal.name || !currentGoal.frequency || !currentGoal.hours) && 
                            styles.addButtonDisabled
                        ]}
                        onPress={handleAddGoal}
                        disabled={!currentGoal.name || !currentGoal.frequency || !currentGoal.hours}
                    >
                        <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Goals List */}
                <View style={styles.goalsList}>
                    {goals.map((goal) => (
                        <View key={goal.id} style={styles.goalItem}>
                            <Text style={styles.goalName}>{goal.name}</Text>
                            <Text style={styles.goalDetails}>
                                {goal.frequency} - {goal.hours} hours
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, !goals.length && styles.saveButtonDisabled]}
                    onPress={() => {
                        if (goals.length > 0) {
                            onSave(goals);
                            onClose();
                        }
                    }}
                    disabled={!goals.length}
                >
                    <Text style={styles.saveButtonText}>Save Goals</Text>
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
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    instructionText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 20,
    },
    inputForm: {
        width: '100%',
    },
    nameInput: {
        height: 50,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    inputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        width: '100%'
    },
    frequencyContainer: {
        flex: 2,
        marginRight: 10,
    },
    hoursContainer: {
        flex: 1,
        minWidth: 80, // Added minimum width to prevent text wrapping
    },
    dropdownTrigger: {
        height: 50,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 15,
        justifyContent: 'center',
    },
    dropdownValue: {
        color: '#000',
    },
    dropdownPlaceholder: {
        color: '#6B7280',
    },
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        zIndex: 1000,
        elevation: 5,
    },
    dropdownItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dropdownItemText: {
        color: '#000',
    },
    addButton: {
        backgroundColor: '#2563EB',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5,
    },
    addButtonDisabled: {
        opacity: 0.5,
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    goalsList: {
        marginTop: 20,
        marginBottom: 20,
    },
    goalItem: {
        padding: 15,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginBottom: 10,
    },
    goalName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    goalDetails: {
        color: '#6B7280',
    },
    saveButton: {
        backgroundColor: '#2563EB',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default GoalSetupModal;