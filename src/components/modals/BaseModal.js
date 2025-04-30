// src/components/modals/BaseModal.js
import React from 'react';
import {
    Modal,
    View,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    KeyboardAvoidingView,
    Platform
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
                        >
                            {/* <X size={24} color="#6b7280" /> */}
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
        // backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        margin: 10,
        padding: 0,
    },
    modalContent: {
        backgroundColor: 'white',
        borderColor: 'black',
        borderWidth: 1,
        borderRadius: 12,
        width: '100%',
        maxWidth: 400,
        minHeight: 300,  // Add this
        maxHeight: '80%',
        padding: 24,    // Add this
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        zIndex: 1,
        
    }
});

export default BaseModal;