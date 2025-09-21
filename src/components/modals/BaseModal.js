// src/components/modals/BaseModal.js - FIXED WITH PROGRESS BAR
import React from 'react';
import {
    Modal,
    View,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { X } from 'lucide-react-native';
import ProgressBar from '../ProgressBar';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const BaseModal = ({ 
    visible, 
    onClose, 
    children, 
    preventClose = false,
    // New progress bar props
    showProgress = false,
    currentStep = 1,
    totalSteps = 4,
    stepLabels = []
}) => {
    // Function to handle close attempts
    const handleCloseAttempt = (e) => {
        // If we should prevent closing, call onClose which will show the warning
        // Otherwise, just close normally
        if (preventClose) {
            e.stopPropagation();
            onClose();
        } else {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleCloseAttempt}
        >
            <View style={styles.modalOverlay}>
                <Pressable 
                    style={styles.backdropPressable} 
                    onPress={preventClose ? (e) => e.stopPropagation() : onClose}
                >
                    <View 
                        style={styles.modalContent}
                        // This prevents taps on the modal content from closing the modal
                        onStartShouldSetResponder={() => true}
                        onTouchEnd={(e) => e.stopPropagation()}
                    >
                        {/* Progress Bar - shown at the very top when enabled */}
                        {showProgress && (
                            <ProgressBar 
                                currentStep={currentStep}
                                totalSteps={totalSteps}
                                stepLabels={stepLabels}
                            />
                        )}
                        
                        {!preventClose && (
                            <TouchableOpacity 
                                style={[
                                    styles.closeButton,
                                    // Adjust close button position if progress bar is shown
                                    showProgress && styles.closeButtonWithProgress
                                ]}
                                onPress={onClose}
                                accessible={true}
                                accessibilityLabel="Close modal"
                            >
                                <X size={24} color="#6b7280" />
                            </TouchableOpacity>
                        )}
                        
                        <View style={[
                            styles.childrenContainer,
                            // Adjust padding if progress bar is shown
                            showProgress && styles.childrenContainerWithProgress
                        ]}>
                            {children}
                        </View>
                    </View>
                </Pressable>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdropPressable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: isTablet ? '80%' : '85%',
        maxWidth: isTablet ? 500 : 350,
        minHeight: 200,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        position: 'relative',
        overflow: 'hidden', // Important for progress bar styling
    },
    childrenContainer: {
        padding: 20,
        paddingTop: 40, // Make room for the close button
    },
    // New style for when progress bar is shown
    childrenContainerWithProgress: {
        paddingTop: 20, // Less top padding since progress bar takes space
    },
    closeButton: {
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 10,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 231, 235, 0.5)',
    },
    // New style for close button when progress bar is shown
    closeButtonWithProgress: {
        top: 70, // Position below the progress bar
        backgroundColor: 'rgba(229, 231, 235, 0.8)', // Slightly more opaque
    }
});

export default BaseModal;