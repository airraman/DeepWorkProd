// src/screens/InitialSetupScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { deepWorkStore } from '../services/deepWorkStore';

// Import modals
import ActivitySetupModal from '../components/modals/ActivitySetupModal.js';
import DurationSetupModal from '../components/modals/DurationSetupModal.js';
import GoalSetupModal from '../components/modals/GoalSetupModal.js';
import WelcomeStatsModal from '../components/modals/WelcomeStatsModal.js';

const InitialSetupScreen = ({navigation}) => {
    // Modal visibility states
    const [showActivityModal, setShowActivityModal] = useState(true); // Start with activity modal
const [showWelcomeStats, setShowWelcomeStats] = useState(false); // Don't show initially
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    
    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        console.log('Initializing app...'); // Debug log
        checkFirstTimeUser();
    }, []);

    const checkFirstTimeUser = async () => {
        try {
            setIsLoading(true);
            console.log('Checking first time user status...'); // Debug log

            // Clear any existing storage to ensure fresh start
            await deepWorkStore.initialize();
            
            // Get settings
            const settings = await deepWorkStore.getSettings();
            console.log('Current settings:', settings); // Debug log

            // Check if this is a first-time user
            const isFirstTimeUser = !settings.activities.length || 
                                  !settings.durations.length;

            console.log('Is first time user:', isFirstTimeUser); // Debug log

            if (isFirstTimeUser) {
                setShowActivityModal(true);
                setShowWelcomeStats(false);
            } else {
                setShowActivityModal(false);
                setShowWelcomeStats(true);
            }
        } catch (error) {
            console.error('Error in checkFirstTimeUser:', error);
            // If there's an error, assume it's a first-time user
            setShowActivityModal(true);
            setShowWelcomeStats(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleActivitySave = async (activities) => {
        try {
            await deepWorkStore.updateActivities(activities);
            setShowActivityModal(false);
            setShowDurationModal(true);
        } catch (error) {
            console.error('Error saving activities:', error);
        }
    };

    const handleDurationSave = async (durations) => {
        try {
            await deepWorkStore.updateDurations(durations);
            setShowDurationModal(false);
            setShowGoalModal(true);
        } catch (error) {
            console.error('Error saving durations:', error);
        }
    };

    const handleWelcomeStatsClose = () => {
        setShowWelcomeStats(false);
        navigation.replace('MainApp');
    };


    const handleGoalSave = async (goals) => {
        try {
            await deepWorkStore.updateGoals(goals);
            setShowGoalModal(false);
            setShowWelcomeStats(true);
        } catch (error) {
            console.error('Error saving goals:', error);
        }
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
                onClose={handleWelcomeStatsClose}  // Updated to handle navigation
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        marginTop: '10%'
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default InitialSetupScreen;