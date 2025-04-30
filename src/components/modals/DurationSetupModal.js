// src/components/modals/DurationSetupModal.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import BaseModal from './BaseModal';

const DurationSetupModal = ({ visible, onClose, onSave }) => {
    // State to track selected durations (limit to 3 as per your settings)
    const [selectedDurations, setSelectedDurations] = useState([]);
    
    // Available duration options
    const durationOptions = [5, 10, 15, 20, 30, 45];

    const handleDurationSelect = (duration) => {
        setSelectedDurations(prev => {
            // If already selected, remove it
            if (prev.includes(duration)) {
                return prev.filter(d => d !== duration);
            }
            // If not selected and we haven't hit limit, add it
            if (prev.length < 3) {
                return [...prev, duration];
            }
            // If we have 3 selections, replace the first one
            return [...prev.slice(1), duration];
        });
    };

    return (
        <BaseModal visible={visible} onClose={onClose}>
            <View style={styles.container}>
                <Text style={styles.title}>Select Session Durations</Text>
                <Text style={styles.instructionText}>
                Choose your durations. This is how long you'll work uninterrupted.
                </Text>
                <Text style={styles.subtitle}>
                    Choose up to 3 durations ({selectedDurations.length}/3)
                </Text>

                <View style={styles.durationsGrid}>
                    {durationOptions.map((duration) => (
                        <TouchableOpacity
                            key={duration}
                            style={[
                                styles.durationButton,
                                selectedDurations.includes(duration) && 
                                styles.durationButtonSelected
                            ]}
                            onPress={() => handleDurationSelect(duration)}
                        >
                            <Text style={[
                                styles.durationText,
                                selectedDurations.includes(duration) && 
                                styles.durationTextSelected
                            ]}>
                                {duration}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        selectedDurations.length === 0 && styles.saveButtonDisabled
                    ]}
                    onPress={() => {
                        if (selectedDurations.length > 0) {
                            onSave(selectedDurations);
                            onClose();
                        }
                    }}
                    disabled={selectedDurations.length === 0}
                >
                    <Text style={styles.saveButtonText}>
                        Save Durations
                    </Text>
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
// Change this in DurationSetupModal.js
    container: {
        padding: 20, // Changed from 0 to 20
        width: '90%'
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    durationsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 20,
    },
    durationButton: {
        width: '48%',  // Allow 2 buttons per row with spacing
        height: 50,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    durationButtonSelected: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    durationText: {
        fontSize: 16,
        color: '#1F2937',
    },
    durationTextSelected: {
        color: 'white',
    },
    saveButton: {
        backgroundColor: '#2563EB',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    instructionText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 10,
        lineHeight: 20,
      }
});

export default DurationSetupModal;