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
    Text
} from 'react-native';
import { X } from 'lucide-react-native';

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
                            <X size={24} color="#6b7280" />
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
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: '100%',
        maxWidth: 400,
        minHeight: 300,
        maxHeight: '80%',
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        zIndex: 1,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 231, 235, 0.5)',
    }
});

export default BaseModal;