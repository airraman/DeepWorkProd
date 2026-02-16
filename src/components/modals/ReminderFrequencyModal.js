// src/components/modals/ReminderFrequencyModal.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import BaseModal from './BaseModal';
import { Bell } from 'lucide-react-native';

const ReminderFrequencyModal = ({ 
    visible, 
    onClose, 
    onSave,
    // Progress bar props
    showProgress = false,
    currentStep = 3,
    totalSteps = 4,
    stepLabels = []
}) => {
    // State for tracking selected reminder frequency
    const [selectedFrequency, setSelectedFrequency] = useState('');
    
    // ✅ FIXED: Moved 'none' option to the bottom per user request
    const frequencyOptions = [
        { 
            id: 'daily', 
            label: 'Once a day',
            description: 'Daily motivation and progress tracking',
            icon: '📅',
            value: 'daily'
        },
        { 
            id: 'weekly', 
            label: 'Once a week',
            description: 'Weekly reflection and planning',
            icon: '📊',
            value: 'weekly'
        },
        { 
            id: 'none', 
            label: "Don't Remind me to Focus",
            description: 'Never nudge me to focus',
            icon: '🔕',  // Muted bell icon
            value: 'none'
        }
    ];

    // Validation logic
    const isValidSelection = (frequency) => {
        return frequency && frequencyOptions.some(option => option.id === frequency);
    };

    // Single selection handler
    const handleFrequencySelect = (frequencyId) => {
        setSelectedFrequency(frequencyId);
    };

    // Data transformation before saving
    const handleSave = () => {
        if (!isValidSelection(selectedFrequency)) {
            return;
        }

        // Find the complete option object
        const selectedOption = frequencyOptions.find(
            option => option.id === selectedFrequency
        );

        // Pass both the ID and the full option for flexibility
        onSave({
            frequency: selectedFrequency,
            option: selectedOption
        });
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
                {/* Header Section */}
                <View style={styles.header}>
                    <Bell size={32} color="#2563eb" style={styles.headerIcon} />
                    <Text style={styles.title}>Reminder Frequency</Text>
                    <Text style={styles.instructionText}>
                        How often would you like to receive reminders to help you stay focused?
                    </Text>
                </View>

                {/* Selection Options */}
                <View style={styles.optionsContainer}>
                    {frequencyOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[
                                styles.optionButton,
                                selectedFrequency === option.id && styles.optionButtonSelected
                            ]}
                            onPress={() => handleFrequencySelect(option.id)}
                            accessible={true}
                            accessibilityLabel={option.label}
                            accessibilityHint={option.description}
                        >
                            {/* Option Layout */}
                            <View style={styles.optionContent}>
                                <View style={styles.optionHeader}>
                                    <Text style={styles.optionIcon}>{option.icon}</Text>
                                    <Text style={[
                                        styles.optionLabel,
                                        selectedFrequency === option.id && styles.optionLabelSelected
                                    ]}>
                                        {option.label}
                                    </Text>
                                </View>
                                
                                <Text style={[
                                    styles.optionDescription,
                                    selectedFrequency === option.id && styles.optionDescriptionSelected
                                ]}>
                                    {option.description}
                                </Text>
                            </View>

                            {/* Selection Indicator */}
                            <View style={[
                                styles.selectionIndicator,
                                selectedFrequency === option.id && styles.selectionIndicatorSelected
                            ]}>
                                {selectedFrequency === option.id && (
                                    <View style={styles.selectionDot} />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        !isValidSelection(selectedFrequency) && styles.saveButtonDisabled
                    ]}
                    onPress={handleSave}
                    disabled={!isValidSelection(selectedFrequency)}
                >
                    <Text style={styles.saveButtonText}>
                        Continue
                    </Text>
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 4,
    },
    
    // Header Styles
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    headerIcon: {
        marginBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        color: '#1f2937',
    },
    instructionText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    
    // Options Container
    optionsContainer: {
        gap: 12,
        marginBottom: 24,
    },
    
    // Option button styling
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    optionButtonSelected: {
        borderColor: '#2563eb',
        backgroundColor: '#eff6ff',
    },
    
    // Option Content Layout
    optionContent: {
        flex: 1,
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    optionIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    optionLabelSelected: {
        color: '#2563eb',
    },
    optionDescription: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
    },
    optionDescriptionSelected: {
        color: '#1e40af',
    },
    
    // Custom selection indicator
    selectionIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        marginLeft: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectionIndicatorSelected: {
        borderColor: '#2563eb',
    },
    selectionDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#2563eb',
    },
    
    // Save Button
    saveButton: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
        marginTop: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ReminderFrequencyModal;