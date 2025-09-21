// src/screens/InitialSetupScreen.js - FIXED WITH PROGRESS BAR
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
    // Add state to track setup step
    const [setupStep, setSetupStep] = useState(0);
    // Add state for error handling
    const [error, setError] = useState(null);
    
    // Track transitions to prevent multiple alerts
    const isTransitioning = useRef(false);

    // Define step labels for the progress bar
    const stepLabels = [
        'Create Activities',    // Step 1
        'Choose Durations',     // Step 2  
        'Set Goals',           // Step 3
        'Welcome!'             // Step 4
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
            
            // Check if basic settings are already set up
            if (settings.activities && settings.activities.length > 0 && 
                settings.durations && settings.durations.length > 0) {
                console.log('Settings already exist, skipping setup');
                
                // If settings already exist, redirect to main app
                navigation.replace('MainApp');
                return;
            }
            
            // First-time user or incomplete setup, start the setup process
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
            
            // Move to next step
            setSetupStep(2);
            
            // Short delay before showing next modal to prevent UI glitches
            setTimeout(() => {
                setShowDurationModal(true);
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

    const handleDurationSave = async (durations) => {
        try {
            // Mark as transitioning to prevent alerts
            isTransitioning.current = true;
            
            // Hide the duration modal
            setShowDurationModal(false);
            
            // Save durations to settings
            const success = await deepWorkStore.updateDurations(durations);
            
            if (!success) {
                throw new Error('Failed to save durations');
            }
            
            // Move to next step 
            setSetupStep(3);
            
            // Short delay before showing next modal to prevent UI glitches
            setTimeout(() => {
                setShowGoalModal(true);
                isTransitioning.current = false;
            }, 300);
        } catch (error) {
            console.error('Error saving durations:', error);
            Alert.alert('Error', 'Failed to save durations. Please try again.');
            
            // Go back to duration setup
            setShowDurationModal(true);
            isTransitioning.current = false;
        }
    };

    const handleGoalSave = async (goals) => {
        try {
            // Mark as transitioning to prevent alerts
            isTransitioning.current = true;
            
            // Hide the goal modal
            setShowGoalModal(false);
            
            // Save goals to settings
            const success = await deepWorkStore.updateGoals(goals);
            
            if (!success) {
                throw new Error('Failed to save goals');
            }
            
            // Setup is complete
            setSetupComplete(true);
            setSetupStep(4);
            
            // Short delay before showing welcome stats to prevent UI glitches
            setTimeout(() => {
                setShowWelcomeStats(true);
                isTransitioning.current = false;
            }, 300);
        } catch (error) {
            console.error('Error saving goals:', error);
            Alert.alert('Error', 'Failed to save goals. Please try again.');
            
            // Go back to goal setup
            setShowGoalModal(true);
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
                // Progress bar props
                showProgress={true}
                currentStep={1}
                totalSteps={4}
                stepLabels={stepLabels}
            />
            <DurationSetupModal
                visible={showDurationModal}
                onClose={handleModalClose}
                onSave={handleDurationSave}
                preventClose={true}
                // Progress bar props
                showProgress={true}
                currentStep={2}
                totalSteps={4}
                stepLabels={stepLabels}
            />
            <GoalSetupModal
                visible={showGoalModal}
                onClose={handleModalClose}
                onSave={handleGoalSave}
                preventClose={true}
                // Progress bar props
                showProgress={true}
                currentStep={3}
                totalSteps={4}
                stepLabels={stepLabels}
            />
            <WelcomeStatsModal
                visible={showWelcomeStats}
                onClose={handleWelcomeStatsClose}
                // Welcome modal can also show progress (step 4)
                showProgress={true}
                currentStep={4}
                totalSteps={4}
                stepLabels={stepLabels}
            />
            
            {/* Fallback loading view if no modals are displayed */}
            {!showActivityModal && !showDurationModal && !showGoalModal && !showWelcomeStats && !isTransitioning.current && (
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