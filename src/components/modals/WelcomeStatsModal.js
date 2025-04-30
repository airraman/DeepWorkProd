// src/components/modals/WelcomeStatsModal.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import BaseModal from './BaseModal';
import { deepWorkStore } from '../../services/deepWorkStore';

const WelcomeStatsModal = ({ visible, onClose }) => {
    const [totalHours, setTotalHours] = useState(0);

    useEffect(() => {
        calculateTotalHours();
    }, [visible]); // Recalculate when modal becomes visible

    const calculateTotalHours = async () => {
        try {
            const sessions = await deepWorkStore.getSessions();
            
            // Calculate total minutes from all sessions
            const totalMinutes = Object.values(sessions)
                .flat() // Flatten array of arrays
                .reduce((total, session) => total + session.duration, 0);
            
            // Convert to hours and round to 1 decimal place
            setTotalHours((totalMinutes / 60).toFixed(1));
        } catch (error) {
            console.error('Error calculating total hours:', error);
            setTotalHours(0);
        }
    };

    return (
        <BaseModal visible={visible} onClose={onClose}>
            <View style={styles.container}>
                <Text style={styles.welcomeText}>WELCOME!</Text>
                
                <View style={styles.statsContainer}>
                    {parseFloat(totalHours) > 0 ? (
                        <>
                            <Text style={styles.statsText}>
                                So far, you've focused for
                            </Text>
                            <Text style={styles.hoursText}>
                                {totalHours} hours!
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.statsText}>
                            Let's start your journey!
                        </Text>
                    )}
                </View>

                <TouchableOpacity 
                    style={styles.startButton}
                    onPress={onClose}
                >
                    <Text style={styles.startButtonText}>
                        Start New Session
                    </Text>
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 24,
        alignItems: 'center',
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    statsContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    statsText: {
        fontSize: 18,
        color: '#4B5563',
        marginBottom: 8,
        textAlign: 'center',
    },
    hoursText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2563EB',
        marginVertical: 8,
    },
    startButton: {
        backgroundColor: '#2563EB',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
    },
    startButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default WelcomeStatsModal;