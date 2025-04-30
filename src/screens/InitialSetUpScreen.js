// src/screens/InitialSetupScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { deepWorkStore } from '../services/deepWorkStore';

// Import modals
import ActivitySetupModal from '../components/modals/ActivitySetupModal.js';
import DurationSetupModal from '../components/modals/DurationSetupModal.js';
import GoalSetupModal from '../components/modals/GoalSetupModal.js';
import WelcomeStatsModal from '../components/modals/WelcomeStatsModal.js';

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
        try {
            setIsLoading(true);
            console.log('Checking first time user status...'); // Debug log

            // Initialize storage
            await deepWorkStore.initialize();
            
            // Get settings
            const settings = await deepWorkStore.getSettings();
            console.log('Current settings:', settings); // Debug log

            // Check if this is a first-time user
            const isFirstTimeUser = !settings.activities.length || 
                                  !settings.durations.length;

            console.log('Is first time user:', isFirstTimeUser); // Debug log

            if (isFirstTimeUser) {
                // Add a small delay before showing the first modal
                setTimeout(() => {
                    setShowActivityModal(true);
                    setShowWelcomeStats(false);
                    setIsLoading(false);
                }, 500);
            } else {
                setShowActivityModal(false);
                setShowWelcomeStats(true);
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error in checkFirstTimeUser:', error);
            // Show an error alert and allow user to retry or go to main app
            Alert.alert(
                'Setup Error',
                'There was a problem setting up the app. Would you like to try again?',
                [
                    {
                        text: 'Retry',
                        onPress: () => checkFirstTimeUser()
                    },
                    {
                        text: 'Skip Setup',
                        onPress: () => {
                            // Skip setup and go to main app
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'MainApp' }],
                            });
                        }
                    }
                ]
            );
            setIsLoading(false);
        }
    };

    const handleActivitySave = async (activities) => {
        try {
            console.log('Saving activities:', activities); // Debug log
            const success = await deepWorkStore.updateActivities(activities);
            
            if (success) {
                setShowActivityModal(false);
                // Add a small delay before showing the next modal
                setTimeout(() => {
                    setShowDurationModal(true);
                }, 300);
            } else {
                throw new Error('Failed to save activities');
            }
        } catch (error) {
            console.error('Error saving activities:', error);
            Alert.alert(
                'Save Error',
                'Could not save activities. Would you like to try again?',
                [
                    {
                        text: 'Retry',
                        onPress: () => {}  // Stay on current modal
                    },
                    {
                        text: 'Skip Setup',
                        onPress: () => {
                            // Skip setup and go to main app
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'MainApp' }],
                            });
                        }
                    }
                ]
            );
        }
    };

    const handleDurationSave = async (durations) => {
        try {
            console.log('Saving durations:', durations); // Debug log
            const success = await deepWorkStore.updateDurations(durations);
            
            if (success) {
                setShowDurationModal(false);
                // Add a small delay before showing the next modal
                setTimeout(() => {
                    setShowGoalModal(true);
                }, 300);
            } else {
                throw new Error('Failed to save durations');
            }
        } catch (error) {
            console.error('Error saving durations:', error);
            Alert.alert(
                'Save Error',
                'Could not save durations. Would you like to try again?',
                [
                    {
                        text: 'Retry',
                        onPress: () => {}  // Stay on current modal
                    },
                    {
                        text: 'Continue',
                        onPress: () => {
                            // Continue to next step anyway
                            setShowDurationModal(false);
                            setTimeout(() => {
                                setShowGoalModal(true);
                            }, 300);
                        }
                    }
                ]
            );
        }
    };

    const handleWelcomeStatsClose = () => {
        setShowWelcomeStats(false);
        // Add a small delay before navigation
        setTimeout(() => {
            // Use reset to clear the navigation stack
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainApp' }],
            });
        }, 300);
    };

    const handleGoalSave = async (goals) => {
        try {
            console.log('Saving goals:', goals); // Debug log
            const success = await deepWorkStore.updateGoals(goals);
            
            if (success) {
                setShowGoalModal(false);
                setSetupComplete(true);
                // Add a small delay before showing the welcome stats
                setTimeout(() => {
                    setShowWelcomeStats(true);
                }, 300);
            } else {
                throw new Error('Failed to save goals');
            }
        } catch (error) {
            console.error('Error saving goals:', error);
            // Even if there's an error, we should still proceed to the next screen
            setShowGoalModal(false);
            setSetupComplete(true);
            setTimeout(() => {
                setShowWelcomeStats(true);
            }, 300);
        }
    };

    // If setup is complete but welcome stats is not showing,
    // make sure we navigate to main app
    useEffect(() => {
        if (setupComplete && !showWelcomeStats) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainApp' }],
            });
        }
    }, [setupComplete, showWelcomeStats, navigation]);

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
                onClose={() => {
                    // Provide a way to skip setup if modal is closed
                    Alert.alert(
                        'Skip Setup',
                        'Are you sure you want to skip the setup?',
                        [
                            {
                                text: 'Cancel',
                                style: 'cancel'
                            },
                            {
                                text: 'Skip',
                                onPress: () => {
                                    navigation.reset({
                                        index: 0,
                                        routes: [{ name: 'MainApp' }],
                                    });
                                }
                            }
                        ]
                    );
                }} 
                onSave={handleActivitySave}
            />
            <DurationSetupModal
                visible={showDurationModal}
                onClose={() => {
                    // Provide a way to skip this step
                    Alert.alert(
                        'Skip Step',
                        'Are you sure you want to skip setting durations?',
                        [
                            {
                                text: 'Cancel',
                                style: 'cancel'
                            },
                            {
                                text: 'Skip',
                                onPress: () => {
                                    setShowDurationModal(false);
                                    setTimeout(() => {
                                        setShowGoalModal(true);
                                    }, 300);
                                }
                            }
                        ]
                    );
                }} 
                onSave={handleDurationSave}
            />
            <GoalSetupModal
                visible={showGoalModal}
                onClose={() => {
                    // Provide a way to skip this step
                    Alert.alert(
                        'Skip Step',
                        'Are you sure you want to skip setting goals?',
                        [
                            {
                                text: 'Cancel',
                                style: 'cancel'
                            },
                            {
                                text: 'Skip',
                                onPress: () => {
                                    setShowGoalModal(false);
                                    setSetupComplete(true);
                                    setTimeout(() => {
                                        setShowWelcomeStats(true);
                                    }, 300);
                                }
                            }
                        ]
                    );
                }} 
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
        backgroundColor: 'white',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default InitialSetupScreen;