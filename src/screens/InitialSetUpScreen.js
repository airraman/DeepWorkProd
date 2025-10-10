// src/screens/InitialSetUpScreen.js - UPDATED WITHOUT DURATION MODAL
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  Dimensions, 
  SafeAreaView,
  Text 
} from 'react-native';
import { deepWorkStore } from '../services/deepWorkStore';

// Import modals - REMOVED DurationSetupModal import
import ActivitySetupModal from '../components/modals/ActivitySetupModal.js';
import ReminderFrequencyModal from '../components/modals/ReminderFrequencyModal.js';
import WelcomeStatsModal from '../components/modals/WelcomeStatsModal.js';

// Add tablet detection
const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const InitialSetupScreen = ({navigation}) => {
    // Modal visibility states - REMOVED showDurationModal
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [showWelcomeStats, setShowWelcomeStats] = useState(false);
    
    // Loading state
    const [isLoading, setIsLoading] = useState(true);
    const [setupComplete, setSetupComplete] = useState(false);
    const [setupStep, setSetupStep] = useState(0);
    const [error, setError] = useState(null);
    
    // Track transitions to prevent multiple alerts
    const isTransitioning = useRef(false);

    // UPDATED: Define step labels with only 3 steps now
    const stepLabels = [
        'Create Activities',    // Step 1
        'Set Reminders',        // Step 2 (was Step 3)
        'Welcome!'              // Step 3 (was Step 4)
    ];

    useEffect(() => {
        const initializeApp = async () => {
            try {
                console.log('Initializing app...');
                setIsLoading(true);
                setError(null);
                
                // Initialize storage first
                await deepWorkStore.initialize();
                
                // Then check if we need to go through setup
                await checkFirstTimeUser();
            } catch (error) {
                console.error('Error during initialization:', error);
                setError('Failed to initialize app. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };
        
        initializeApp();
    }, []);

    const checkFirstTimeUser = async () => {
        try {
            // Get current settings
            const settings = await deepWorkStore.getSettings();
            
            // UPDATED: Only check for activities since durations are now hardcoded
            // If activities exist, user has completed onboarding
            if (settings.activities && settings.activities.length > 0) {
                console.log('Settings already exist, skipping setup');
                navigation.replace('MainApp');
                return;
            }
            
            // First-time user, start the setup process
            startSetupProcess();
        } catch (error) {
            console.error('Error checking first time user:', error);
            setError('Failed to load settings. Please try again.');
        }
    };

    const startSetupProcess = () => {
        console.log('Starting setup process...');
        setSetupStep(1);
        setShowActivityModal(true);
    };

    const handleActivitySave = async (activities) => {
        try {
            // Mark as transitioning to prevent alerts
            isTransitioning.current = true;
            
            // Hide the activity modal
            setShowActivityModal(false);
            
            // Save activities to settings
            const success = await deepWorkStore.updateActivities(activities);
            
            if (!success) {
                throw new Error('Failed to save activities');
            }
            
            // UPDATED: Skip to step 2 (reminders) instead of step 2 (durations)
            setSetupStep(2);
            
            // Short delay before showing next modal to prevent UI glitches
            setTimeout(() => {
                setShowReminderModal(true);
                isTransitioning.current = false;
            }, 300);
        } catch (error) {
            console.error('Error saving activities:', error);
            Alert.alert('Error', 'Failed to save activities. Please try again.');
            
            // Go back to activity setup
            setShowActivityModal(true);
            isTransitioning.current = false;
        }
    };

    // REMOVED: handleDurationSave function entirely

    const handleReminderSave = async (reminderSettings) => {
        try {
            // Mark as transitioning
            isTransitioning.current = true;
            
            // Hide reminder modal
            setShowReminderModal(false);
            
            // Save reminder settings
            const success = await deepWorkStore.updateReminderFrequency(reminderSettings.frequency);
            
            if (!success) {
                throw new Error('Failed to save reminder settings');
            }
            
            // UPDATED: Move to step 3 (was step 4)
            setSetupStep(3);
            
            // Show welcome stats
            setTimeout(() => {
                setShowWelcomeStats(true);
                isTransitioning.current = false;
            }, 300);
        } catch (error) {
            console.error('Error saving reminder settings:', error);
            Alert.alert('Error', 'Failed to save reminder settings. Please try again.');
            
            // Go back to reminder setup
            setShowReminderModal(true);
            isTransitioning.current = false;
        }
    };

    const handleWelcomeStatsClose = () => {
        // Hide welcome stats modal
        setShowWelcomeStats(false);
        
        // Navigate to main app
        navigation.replace('MainApp');
    };
    
    // Functions to handle modal attempt to close
    const handleModalClose = () => {
        // Don't show alert if we're in the middle of transitioning between modals
        if (isTransitioning.current) {
            return;
        }
        
        Alert.alert(
            'Setup Required', 
            'Please complete the setup to continue.',
            [{ text: 'OK' }]
        );
    };

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Initializing DeepWork...</Text>
            </SafeAreaView>
        );
    }

    // Error state
    if (error) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText} onPress={() => checkFirstTimeUser()}>
                    Tap to retry
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ActivitySetupModal
                visible={showActivityModal}
                onClose={handleModalClose}
                onSave={handleActivitySave}
                preventClose={true}
                // Progress bar props - UPDATED to show step 1 of 3
                showProgress={true}
                currentStep={1}
                totalSteps={3}
                stepLabels={stepLabels}
            />
            
            {/* REMOVED: DurationSetupModal completely */}
            
            <ReminderFrequencyModal
                visible={showReminderModal}
                onClose={handleModalClose}
                onSave={handleReminderSave}
                preventClose={true}
                // Progress bar props - UPDATED to step 2 of 3
                showProgress={true}
                currentStep={2}
                totalSteps={3}
                stepLabels={stepLabels}
            />
            <WelcomeStatsModal
                visible={showWelcomeStats}
                onClose={handleWelcomeStatsClose}
                // Welcome modal - UPDATED to step 3 of 3
                showProgress={true}
                currentStep={3}
                totalSteps={3}
                stepLabels={stepLabels}
            />
            
            {/* Fallback loading view - REMOVED showDurationModal check */}
            {!showActivityModal && !showReminderModal && !showWelcomeStats && !isTransitioning.current && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Preparing setup...</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        width: '100%',
        height: '100%',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#4b5563',
    },
    errorText: {
        fontSize: 16,
        color: '#ef4444',
        marginBottom: 16,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    retryText: {
        fontSize: 16,
        color: '#2563eb',
        textDecorationLine: 'underline',
    }
});

export default InitialSetupScreen;