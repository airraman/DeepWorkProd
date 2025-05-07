// src/components/modals/WelcomeStatsModal.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import BaseModal from './BaseModal';
import { deepWorkStore } from '../../services/deepWorkStore';

// Add detection for iPad/tablet
const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const WelcomeStatsModal = ({ visible, onClose }) => {
    const [totalHours, setTotalHours] = useState(0);

    useEffect(() => {
        calculateTotalHours();
    }, [visible]);

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
        padding: isTablet ? 36 : 24,
        alignItems: 'center',
        width: isTablet ? '100%' : 'auto',
        maxWidth: isTablet ? 500 : 'auto',
    },
    welcomeText: {
        fontSize: isTablet ? 32 : 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: isTablet ? 24 : 16,
    },
    statsContainer: {
        alignItems: 'center',
        marginVertical: isTablet ? 30 : 20,
    },
    statsText: {
        fontSize: isTablet ? 24 : 18,
        color: '#4B5563',
        marginBottom: isTablet ? 12 : 8,
        textAlign: 'center',
    },
    hoursText: {
        fontSize: isTablet ? 36 : 28,
        fontWeight: 'bold',
        color: '#2563EB',
        marginVertical: isTablet ? 12 : 8,
    },
    startButton: {
        backgroundColor: '#2563EB',
        paddingVertical: isTablet ? 16 : 12,
        paddingHorizontal: isTablet ? 36 : 24,
        borderRadius: 8,
        marginTop: isTablet ? 24 : 16,
    },
    startButtonText: {
        color: 'white',
        fontSize: isTablet ? 20 : 16,
        fontWeight: '600',
    },
});

export default WelcomeStatsModal;