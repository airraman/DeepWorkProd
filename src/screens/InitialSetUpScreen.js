// src/screens/InitialSetupScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { deepWorkStore } from '../services/deepWorkStore';

// Import modals
import ActivitySetupModal from '../components/modals/ActivitySetupModal.js';
import DurationSetupModal from '../components/modals/DurationSetupModal.js';
import GoalSetupModal from '../components/modals/GoalSetupModal.js';
import WelcomeStatsModal from '../components/modals/WelcomeStatsModal.js';

// Add tablet detection
const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const InitialSetupScreen = ({navigation}) => {
    // Modal visibility states
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showWelcomeStats, setShowWelcomeStats] = useState(false);
    
    // Loading state
    const [isLoading, setIsLoading] = useState(true);
    // Add state to track if setup is complete
    const [setupComplete, setSetupComplete] = useState(false);

    useEffect(() => {
        console.log('Initializing app...'); // Debug log
        checkFirstTimeUser();
    }, []);

    const checkFirstTimeUser = async () => {
        // ... existing code ...
    };

    const handleActivitySave = async (activities) => {
        // ... existing code ...
    };

    const handleDurationSave = async (durations) => {
        // ... existing code ...
    };

    const handleWelcomeStatsClose = () => {
        // ... existing code ...
    };

    const handleGoalSave = async (goals) => {
        // ... existing code ...
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ActivitySetupModal
                visible={showActivityModal}
                onClose={() => {}} 
                onSave={handleActivitySave}
            />
            <DurationSetupModal
                visible={showDurationModal}
                onClose={() => {}} 
                onSave={handleDurationSave}
            />
            <GoalSetupModal
                visible={showGoalModal}
                onClose={() => {}} 
                onSave={handleGoalSave}
            />
            <WelcomeStatsModal
                visible={showWelcomeStats}
                onClose={handleWelcomeStatsClose}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',  // Change from dark gray to white
        // Remove any width constraints that might be creating the column effect
        width: '100%',
        height: '100%',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default InitialSetupScreen;