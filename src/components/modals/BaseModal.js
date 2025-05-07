// src/components/modals/BaseModal.js
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

// Add detection for iPad/tablet
const { width, height } = Dimensions.get('window');
const isTablet = width > 768 || height > 768;

const BaseModal = ({ visible, onClose, children }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <Pressable 
                    style={styles.modalOverlay} 
                    onPress={onClose}
                >
                    <Pressable 
                        style={styles.modalContent} 
                        onPress={e => e.stopPropagation()}
                    >
                        <TouchableOpacity 
                            style={styles.closeButton}
                            onPress={onClose}
                            accessible={true}
                            accessibilityLabel="Close modal"
                            accessibilityHint="Closes the current modal"
                        >
                            <X size={isTablet ? 30 : 24} color="#6b7280" />
                        </TouchableOpacity>
                        {children}
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        margin: 0,
        padding: isTablet ? 40 : 20,
        width: '100%',     // Ensure full width
        height: '100%',    // Ensure full height
        left: 0,           // Position at left edge
        top: 0,            // Position at top edge
        right: 0,          // Extend to right edge
        bottom: 0,         // Extend to bottom edge
        position: 'absolute', // Make sure it covers the entire screen
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: isTablet ? '70%' : '100%',
        maxWidth: isTablet ? 600 : 400,
        minHeight: isTablet ? 400 : 300,
        maxHeight: '80%',
        padding: isTablet ? 32 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        right: isTablet ? 24 : 16,
        top: isTablet ? 24 : 16,
        zIndex: 1,
        width: isTablet ? 48 : 40,
        height: isTablet ? 48 : 40,
        borderRadius: isTablet ? 24 : 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 231, 235, 0.5)',
    }
});

export default BaseModal;